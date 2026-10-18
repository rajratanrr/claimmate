import PDFDocument from 'pdfkit';
import {casePacket,event} from './services.ts';
export async function pdfPacket(owner:string,id:string){const c=casePacket(owner,id);const doc=new PDFDocument({margin:50,size:'A4',bufferPages:true,info:{Title:'ClaimMate support packet'}});doc.registerFont('Body','public/fonts/DejaVuSans.ttf');doc.font('Body');const buffers:Buffer[]=[];doc.on('data',(b)=>buffers.push(b));const result=new Promise<Buffer>((resolve,reject)=>{doc.on('end',()=>resolve(Buffer.concat(buffers)));doc.on('error',reject);});
 const heading=(s:string)=>{if(doc.y>710)doc.addPage();doc.moveDown().fontSize(15).fillColor('#154b43').text(s).moveDown(.4).fontSize(10).fillColor('#243b37');};
 doc.fontSize(26).fillColor('#154b43').text('ClaimMate');doc.fontSize(11).text('Support request · For user review');doc.moveDown().fontSize(9).fillColor('#586b66').text(`Case ${c.id}\nGenerated ${new Date().toISOString()}\n${c.purchase.sample?'FICTIONAL SAMPLE DATA\n':''}No claim has been submitted. Seller assessment required.`);
 heading('Purchase summary');doc.text(`${c.purchase.product}\n${c.purchase.merchant}\nPurchased: ${c.purchase.purchase_date||'Not provided'}\nOrder: ${c.purchase.order_ref||'Not provided'}\nAmount: ${c.purchase.price_minor===null?'Not provided':c.purchase.currency+' '+(c.purchase.price_minor/100).toFixed(2)}\nSerial: ${c.purchase.serial||'Not provided'}`);
 heading('Reported issue and notes');doc.text(c.issue+'\n'+(c.notes||'No additional notes provided.'));
 heading('Reviewed support message');doc.text(c.draft);
 heading('Current source evidence');if(c.source_warning)doc.text(c.source_warning);if(!c.sources.length)doc.text('No current policy passages available.');for(const s of c.sources)doc.text(`[${s.id}] ${s.name}, page ${s.page}, version ${s.version}\n${s.excerpt}\n\n`);
 heading('Evidence checklist');for(const item of c.checklist)doc.text(`${item.done?'[Provided / user marked ready]':'[Still needed]'} ${item.label}`);
 heading('Original documents');doc.text('Original files are available separately from the purchase. They are not embedded in this PDF.');for(const d of c.purchase.documents)doc.text(`${d.name} — ${d.type} — ${d.state}`);
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.fontSize(8).fillColor('#697b73').text(`ClaimMate · Review before sending    |    ${i+1} / ${range.count}`,50,800,{lineBreak:false});}
 doc.end();const bytes=await result;event(id,'download','PDF packet generated from saved case. Nothing sent.');return bytes;
}
