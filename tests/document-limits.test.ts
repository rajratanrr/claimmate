import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import {deflateSync,crc32} from 'node:zlib';
process.env.DATA_DIR=mkdtempSync(path.join(tmpdir(),'claimmate-limits-'));
const {run}=await import('../server/db.ts');
const {savePurchase}=await import('../server/services.ts');
const {upload}=await import('../server/documents.ts');
run('INSERT INTO users VALUES(?,?,?,?)','limits','limits@example.test','unused',new Date().toISOString());
const p=savePurchase('limits',{product:'Limit test'});
async function makePdf(pages:number){const d=new PDFDocument();const parts:Buffer[]=[];const done=new Promise<Buffer>(resolve=>{d.on('data',b=>parts.push(b));d.on('end',()=>resolve(Buffer.concat(parts)));});for(let i=1;i<pages;i++)d.addPage();d.end();return done;}
test('scanned/empty PDF has a visible manual transcription fallback',async()=>{const d=await upload('limits',p.id,'receipt','scan.pdf',await makePdf(1));assert.equal(d.state,'needs_text');assert.match(d.error,/Scanned or unreadable PDF/);});
test('over-30-page PDF is rejected with a specific processing message',async()=>{const d=await upload('limits',p.id,'policy','large.pdf',await makePdf(31));assert.equal(d.state,'needs_text');assert.match(d.error,/30-page/);});
test('corrupted PNG fails safely without crashing the process',{timeout:60000},async()=>{const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');const d=await upload('limits',p.id,'receipt','blank.png',b);assert.equal(d.state,'needs_text');assert(d.error);});

test('blank but valid PNG offers readable fallback',{timeout:60000},async()=>{
 const chunk=(name:string,data:Buffer)=>{const size=Buffer.alloc(4);size.writeUInt32BE(data.length);const content=Buffer.concat([Buffer.from(name),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(content));return Buffer.concat([size,content,crc]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(100,0);header.writeUInt32BE(100,4);header[8]=8;header[9]=2;
 const pixels=Buffer.alloc(301*100,255);for(let y=0;y<100;y++)pixels[y*301]=0;
 const b=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
 const d=await upload('limits',p.id,'receipt','blank-valid.png',b);assert.equal(d.state,'needs_text');assert.match(d.error,/not readable/);
});
