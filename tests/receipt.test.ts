import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createWorker} from 'tesseract.js';
import {receiptSuggestions} from '../server/policy.ts';

test('labelled fixture remains compatible and missing facts remain empty',()=>{
 const result=receiptSuggestions(readFileSync('fixtures/receipt.txt','utf8'));
 assert.equal(result.product,'SoundArc Studio Headphones');
 assert.equal(result.merchant,'Fictional Northstar Store');
 assert.equal(result.price_minor,799900);
 assert.equal(result.currency,'INR');
 assert.equal(result.purchase_date,'2026-06-19');
 assert.equal(result.order_ref,'DEMO-UPLOAD-001');
 assert.equal(result.serial,'');
 assert.equal(result.delivery_date,null);
});

test('ordinary Indian invoice layout extracts grouped total, seller, item and explicit identifiers',()=>{
 const result=receiptSuggestions(`NORTHSTAR COMPUTERS\nTAX INVOICE\nInvoice No: NS-1042  Invoice Date: 17/10/2026\nBill to: Test Customer\nDescription  Qty  Rate  Amount\n1  Dell Inspiron 15 Laptop  1  59,999.00  59,999.00\nSubtotal: Rs. 59,999.00\nGST: 10,799.82\nGrand Total: ₹70,798.82\nSerial No: ABC-123-XYZ\nDelivery Date: 19 October 2026`);
 assert.equal(result.merchant,'NORTHSTAR COMPUTERS');
 assert.equal(result.product,'Dell Inspiron 15 Laptop');
 assert.equal(result.purchase_date,'2026-10-17');
 assert.equal(result.delivery_date,'2026-10-19');
 assert.equal(result.order_ref,'NS-1042');
 assert.equal(result.serial,'ABC-123-XYZ');
 assert.equal(result.price_minor,7079882);
 assert.equal(result.currency,'INR');
 assert.equal(result.category,'Electronics');
});

test('US invoice and invoice date do not become an order identifier',()=>{
 const result=receiptSuggestions(`Merchant: Example Electronics\nProduct: Laptop\nInvoice date: 10/17/2026\nOrder ID: TEST-42\nSubtotal: $999.00\nTax: $79.92\nTotal: USD 1,078.92`);
 assert.equal(result.price_minor,107892);
 assert.equal(result.currency,'USD');
 assert.equal(result.purchase_date,'2026-10-17');
 assert.equal(result.order_ref,'TEST-42');
 assert.equal(receiptSuggestions('Invoice date: 17/10/2026\nGrand Total: INR 100.00').order_ref,'');
});

test('ambiguous numeric dates require review unless a date convention is printed',()=>{
 const result=receiptSuggestions('Merchant: Example\nDate: 04/05/2026\nTotal: INR 300.00');
 assert.equal(result.purchase_date,null);
 assert(result.extraction_notes.some(note=>note.includes('ambiguous')));
 assert.equal(receiptSuggestions('Date (DD/MM/YYYY)\nDate: 04/05/2026').purchase_date,'2026-05-04');
 assert.equal(receiptSuggestions('Format MM/DD/YYYY\nDate: 04/05/2026').purchase_date,'2026-04-05');
});

test('calendar-invalid dates stay empty; named dates and two-digit years are explicit',()=>{
 assert.equal(receiptSuggestions('Purchase date: 2026-02-30').purchase_date,null);
 assert.equal(receiptSuggestions('Invoice date: 31/04/2026').purchase_date,null);
 assert.equal(receiptSuggestions('Invoice date: October 17, 2026').purchase_date,'2026-10-17');
 const result=receiptSuggestions('Invoice date: 17-Oct-26');
 assert.equal(result.purchase_date,'2026-10-17');
 assert(result.extraction_notes.some(note=>note.includes('two-digit year')));
});

test('label values on following lines and a single-space item table are supported',()=>{
 const result=receiptSuggestions(`Sold by:\nExample Retail Ltd\nOrder number:\nEX-4821\nDate:\n17-10-2026\nItem Qty Price Amount\n1 Lenovo IdeaPad Laptop 1 45999.00 45999.00\nGrand Total\nRs.45,999.00\nS/N: LNV-456`);
 assert.equal(result.merchant,'Example Retail Ltd');
 assert.equal(result.product,'Lenovo IdeaPad Laptop');
 assert.equal(result.order_ref,'EX-4821');
 assert.equal(result.price_minor,4599900);
 assert.equal(result.serial,'LNV-456');
});

test('multiple item rows are not silently assigned to one product',()=>{
 const result=receiptSuggestions(`Example Store\nDescription  Qty  Price\nLaptop  1  60000.00\nMouse  1  1000.00\nTotal: INR 61,000.00`);
 assert.equal(result.product,'');
 assert.equal(result.price_minor,6100000);
 assert(result.extraction_notes.some(note=>note.includes('Multiple receipt items')));
});

test('subtotal, tax and quantities cannot become the purchase price',()=>{
 for(const total of ['Subtotal: INR 700.00','Tax total: INR 126.00','Total items: 3','Total tax: INR 126.00','Total savings: INR 50.00','Total in words: Seven Hundred','Total: -500.00','Total: 1,234,56']){
  assert.equal(receiptSuggestions(total).price_minor,null,total);
 }
});

test('final total wins over interim total and contradictory final totals require review',()=>{
 assert.equal(receiptSuggestions('Total: INR 100.00\nGrand total: INR 118.00').price_minor,11800);
 const result=receiptSuggestions('Grand total: INR 118.00\nGrand total: INR 218.00');
 assert.equal(result.price_minor,null);
 assert(result.extraction_notes.some(note=>note.includes('different final totals')));
});

test('Indian lakh separators, zero total and explicitly identified currencies are retained',()=>{
 assert.equal(receiptSuggestions('Grand total: Rs.1,25,999.50').price_minor,12599950);
 assert.equal(receiptSuggestions('Total: INR 0.00').price_minor,0);
 assert.equal(receiptSuggestions('Total: CAD $399.95').currency,'CAD');
 assert.equal(receiptSuggestions('Total: £399.95').currency,'GBP');
 assert.equal(receiptSuggestions('Total: €399.95').currency,'EUR');
});

test('missing date, merchant, currency, category and identifiers are not invented',()=>{
 const result=receiptSuggestions('TAX INVOICE\nBill to: Example Customer\n123 Example Road\nProduct: Mystery item\nTotal: 123.45');
 assert.equal(result.merchant,'');
 assert.equal(result.purchase_date,null);
 assert.equal(result.delivery_date,null);
 assert.equal(result.serial,'');
 assert.equal(result.order_ref,'');
 assert.equal(result.currency,'');
 assert.equal(result.category,'');
 assert.equal(result.price_minor,12345);
});

test('real local OCR reads the synthetic receipt photo into reviewable purchase fields',{timeout:60000},async()=>{
 const require=createRequire(import.meta.url);
 const langPath=path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')),'4.0.0_best_int');
 const worker=await createWorker('eng',1,{langPath,cacheMethod:'none',gzip:true});
 try{
  const {data}=await worker.recognize(readFileSync('fixtures/receipt-photo.png'));
  assert(data.confidence>=30);
  const result=receiptSuggestions(data.text);
  assert.equal(result.merchant,'Northstar Computers');
  assert.equal(result.product,'Dell Inspiron 15 Laptop');
  assert.equal(result.purchase_date,'2026-10-17');
  assert.equal(result.delivery_date,'2026-10-19');
  assert.equal(result.price_minor,7079882);
  assert.equal(result.currency,'INR');
  assert.equal(result.order_ref,'DEMO-2026-1042');
  assert.equal(result.serial,'DEMO-SN-4821');
 }finally{await worker.terminate();}
});

test('photo upload persists autofilled details as unconfirmed, including after a corrected transcription',{timeout:60000},async()=>{
 process.env.DATA_DIR=mkdtempSync(path.join(tmpdir(),'claimmate-receipt-'));
 process.env.UPLOAD_DIR=path.join(process.env.DATA_DIR,'uploads');
 const {db,run}=await import('../server/db.ts');
 const {savePurchase,getPurchase,createCase}=await import('../server/services.ts');
 const {upload,saveExtraction}=await import('../server/documents.ts');
 try{
  run('INSERT INTO users VALUES(?,?,?,?)','receipt-test','receipt@example.test','unused',new Date().toISOString());
  const purchase=savePurchase('receipt-test',{product:'New receipt',confirmed:false});
  const document=await upload('receipt-test',purchase.id,'receipt','receipt-photo.png',readFileSync('fixtures/receipt-photo.png'));
  assert.equal(document.state,'ready');
  let saved=getPurchase('receipt-test',purchase.id);
  assert.equal(saved.product,'Dell Inspiron 15 Laptop');
  assert.equal(saved.merchant,'Northstar Computers');
  assert.equal(saved.price_minor,7079882);
  assert.equal(saved.purchase_date,'2026-10-17');
  assert.equal(saved.delivery_date,'2026-10-19');
  assert.equal(saved.serial,'DEMO-SN-4821');
  assert.equal(saved.confirmed,0);
  assert.throws(()=>createCase('receipt-test',{purchase_id:purchase.id,issue:'Display stopped working',idempotency_key:'receipt-test-case'}),/confirm/);
  savePurchase('receipt-test',{...saved,confirmed:true},purchase.id);
  saveExtraction(document,['Product: Dell Inspiron 15 Laptop\nMerchant: Northstar Computers\nTotal: INR 69999.00\nPurchase date: 04/05/2026'],'User transcription');
  saved=getPurchase('receipt-test',purchase.id);
  assert.equal(saved.price_minor,6999900);
  assert.equal(saved.confirmed,0);
  assert(saved.extraction_notes.some((note:string)=>note.includes('ambiguous')));
  assert.equal(saved.purchase_date,null);
 }finally{db.close();}
});
