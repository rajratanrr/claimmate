import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createWorker} from 'tesseract.js';
import {one,all,run,transaction} from './db.ts';
import {storage} from './storage.ts';
import {receiptSuggestions} from './policy.ts';
export const MAX_BYTES=10*1024*1024;
export function ownedPurchase(owner:string,id:string){const p=one('SELECT * FROM purchases WHERE id=? AND owner_id=?',id,owner);if(!p)throw Object.assign(Error('Purchase not found'),{status:404});return p;}
export function ownedDocument(owner:string,id:string){const d=one('SELECT * FROM documents WHERE id=? AND owner_id=?',id,owner);if(!d)throw Object.assign(Error('Document not found'),{status:404});return d;}
export function fileType(name:string,b:Buffer){
 if(!b.length||b.length>MAX_BYTES)throw Object.assign(Error('Use a nonempty file up to 10 MB.'),{status:400});
 const ext=path.extname(name).toLowerCase();
 if(ext==='.pdf'&&b.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
 if(ext==='.png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(['.jpg','.jpeg'].includes(ext)&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(ext==='.txt'&&!b.includes(0)){try{new TextDecoder('utf-8',{fatal:true}).decode(b);return 'text/plain';}catch{}}
 throw Object.assign(Error('File signature and extension must match PDF, UTF-8 TXT, PNG or JPEG.'),{status:400});
}
let ocrBusy=false;
async function extract(b:Buffer,mime:string):Promise<{pages:string[],method:string}>{
 if(mime==='text/plain')return {pages:[b.toString('utf8')],method:'Text file'};
 if(mime==='application/pdf'){
  const task=getDocument({data:new Uint8Array(b),useSystemFonts:true});
  const pdf=await task.promise;try{
   if(pdf.numPages>30)throw Error('PDF exceeds the 30-page limit. Upload a shorter document.');
   const pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();pages.push(content.items.map((v:any)=>v.str+(v.hasEOL?'\n':' ')).join(''));}
   if(pages.join('').trim().length<15)throw Error('Scanned or unreadable PDF. Paste a transcription below, or upload each page as PNG/JPEG for OCR.');
   return {pages,method:'PDF text'};
  }finally{await pdf.destroy();}
 }
 if(ocrBusy)throw Error('OCR is busy. Retry shortly, or paste the text.');
 ocrBusy=true;let worker:any;
 try{
 const require=createRequire(import.meta.url);const langPath=path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')),'4.0.0_best_int');
 worker=await createWorker('eng',1,{langPath,cacheMethod:'none',gzip:true,errorHandler:()=>{ /* The recognition promise carries this error to the manual-text fallback. */ }});
 const result:any=await Promise.race([worker.recognize(b),new Promise((_,reject)=>setTimeout(()=>reject(Error('OCR timed out. Paste a transcription or retry a clearer image.')),45000).unref())]);
 if(result.data.text.trim().length<10||result.data.confidence<30)throw Error('Image text was not readable. Try a clearer image or paste a transcription.');
 return {pages:[result.data.text],method:'Local English OCR'};
 }finally{if(worker)await worker.terminate();ocrBusy=false;}
}
export function saveExtraction(d:any,pages:string[],method:string){
 if(pages.join('').length>200000)throw Error('Extracted text exceeds 200,000 characters. Use a shorter document.');
 transaction(()=>{
  run('DELETE FROM passages WHERE document_id=?',d.id);
  run("UPDATE documents SET text=?,method=?,state='ready',error=NULL,version=version+1 WHERE id=?",pages.join('\n\f\n'),method,d.id);
  if(d.type==='receipt'){
   const s=receiptSuggestions(pages.join('\n'));
   const fields=['product','merchant','purchase_date','delivery_date','price_minor','currency','order_ref','serial','category'] as const;
   const entries=fields.filter(k=>s[k]!==null&&s[k]!==undefined&&s[k]!=='').map(k=>[k,s[k]]);
   if(s.purchase_date===null&&s.extraction_notes.some(n=>n.startsWith('Purchase date')))entries.push(['purchase_date',null]);
   if(s.delivery_date===null&&s.extraction_notes.some(n=>n.startsWith('Delivery date')))entries.push(['delivery_date',null]);
   if(s.price_minor===null&&s.extraction_notes.some(n=>n.includes('different final totals')))entries.push(['price_minor',null]);
   const prior=one('SELECT purchase_date,delivery_date FROM purchases WHERE id=?',d.purchase_id);
   for(const [field,value] of entries){if((field==='purchase_date'||field==='delivery_date')&&prior[field]!==value)run('DELETE FROM deadlines WHERE purchase_id=? AND trigger=?',d.purchase_id,field==='purchase_date'?'purchase':'delivery');}

   // Store unconfirmed suggestions so reloads preserve the review step.
   if(entries.length)run('UPDATE purchases SET '+entries.map(([k])=>k+'=?').join(',')+',confirmed=0 WHERE id=?',...entries.map(([,v])=>v),d.purchase_id);
   else run('UPDATE purchases SET confirmed=0 WHERE id=?',d.purchase_id);
  }
  if(d.type==='policy')pages.forEach((page,i)=>{const chunks=page.match(/[\s\S]{1,1800}/g)||[page];for(const excerpt of chunks){if(!excerpt.trim())continue;run('INSERT INTO passages VALUES(?,?,?,?,?,?,?)',randomUUID(),d.id,d.purchase_id,i+1,excerpt.trim(),/return/i.test(excerpt)?'return':/warranty/i.test(excerpt)?'warranty':'policy',d.version+1);}});
 });
}
export async function processDocument(owner:string,id:string){const d=ownedDocument(owner,id);run("UPDATE documents SET state='processing',error=NULL WHERE id=?",id);try{const r=await extract(await storage.get(d.storage_key),d.mime);saveExtraction(d,r.pages,r.method);}catch(e:any){run("UPDATE documents SET state='needs_text',error=? WHERE id=?",String(e?.message||e).slice(0,500),id);}return ownedDocument(owner,id);}
export async function upload(owner:string,purchaseId:string,type:string,name:string,b:Buffer){
 ownedPurchase(owner,purchaseId);if(!['receipt','policy','evidence'].includes(type))throw Error('Invalid document type');
 const mime=fileType(name,b),hash=createHash('sha256').update(b).digest('hex');
 const old=one('SELECT * FROM documents WHERE purchase_id=? AND type=? AND hash=?',purchaseId,type,hash);if(old)return {...old,duplicate:true};
 const id=randomUUID();await storage.put(id,b);
 try{run('INSERT INTO documents(id,owner_id,purchase_id,type,name,storage_key,mime,byte_size,hash,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,owner,purchaseId,type,path.basename(name).replace(/[\x00-\x1f]/g,'').slice(0,140),id,mime,b.length,hash,'processing',new Date().toISOString());}catch(e){await storage.delete(id);throw e;}
 if(type==='receipt')run('UPDATE purchases SET confirmed=0 WHERE id=?',purchaseId);
 return processDocument(owner,id);
}
export async function deleteDocument(owner:string,id:string){const d=ownedDocument(owner,id);await storage.delete(d.storage_key);run('DELETE FROM documents WHERE id=?',id);}
export function evidence(owner:string,purchaseId:string,q=''){ownedPurchase(owner,purchaseId);const rows=all('SELECT p.*,d.name,d.method FROM passages p JOIN documents d ON p.document_id=d.id WHERE p.purchase_id=? AND d.owner_id=? ORDER BY d.created_at,p.page,p.rowid',purchaseId,owner);return q?rows.filter(x=>x.excerpt.toLowerCase().includes(q.toLowerCase())):rows;}
