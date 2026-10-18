import {z} from 'zod';
export const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !isNaN(+d)&&d.toISOString().slice(0,10)===v},'Use a valid calendar date');
export function calculateDeadline(start:string,amount:number,unit:'days'|'months'|'years',inclusive:boolean){
 date.parse(start);if(!Number.isInteger(amount)||amount<1||amount>36500)throw Error('Invalid period');
 const d=new Date(start+'T00:00:00Z');
 if(unit==='days')d.setUTCDate(d.getUTCDate()+amount);
 else {const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+amount*(unit==='years'?12:1));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}
 if(inclusive)d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
}
export function policySuggestion(text:string){
 const m=text.match(/(\d+)\s*(day|month|year)s?\s*(?:from|after|of)\s*(purchase|delivery|registration)/i);
 return m?{period:Number(m[1]),unit:m[2].toLowerCase()+'s',trigger:m[3].toLowerCase()}:null;
}
export function receiptSuggestions(text:string){
 const lines=text.normalize('NFKC').replace(/\r/g,'').split('\n').map(line=>line.trim()).filter(Boolean);
 const notes:string[]=[];
 const field=(labels:string)=>receiptField(lines,labels);
 const merchant=field('merchant(?: name)?|seller(?: name)?|sold by|retailer|store(?: name)?|supplier')||receiptMerchant(lines);
 let product=field('product(?: name)?|item(?: name)?|description(?: of goods)?');
 if(!product){
  const items=receiptItems(lines);
  if(items.length===1)product=items[0];
  else if(items.length>1)notes.push('Multiple receipt items found. Choose the product for this purchase.');
 }
 // A generic "Date" is usually the invoice date, but a labelled order/purchase date takes precedence.
 const purchaseRaw=field('purchase date|order date|date of purchase')||field('invoice date|receipt date|bill date|date');
 const deliveryRaw=field('delivery date|delivered on|date of delivery');
 const purchase_date=receiptDate(purchaseRaw,text,notes,'Purchase date');
 const delivery_date=receiptDate(deliveryRaw,text,notes,'Delivery date');
 const amount=receiptTotal(lines,notes);
 const currency=receiptCurrency(amount?.raw||'')||receiptCurrency(text);
 if(amount&&!currency)notes.push('The receipt does not clearly identify a currency. Confirm the currency before saving.');
 if(amount&&/(^|[^A-Z])\$/.test(amount.raw)&&!/(?:USD|US\s*\$)/i.test(text)&&currency==='USD')notes.push('The dollar symbol was read as USD. Confirm the currency for this receipt.');
 const order_ref=field('order (?:id|number|no\\.?|reference|ref\\.?)|invoice (?:id|number|no\\.?|reference|ref\\.?)|receipt (?:id|number|no\\.?)|bill (?:id|number|no\\.?)')||field('order(?=\\s*[:#])|invoice(?=\\s*[:#])');
 const serial=field('serial(?: (?:number|no\\.?))?|s\\/?n|imei(?: (?:number|no\\.?))?');
 const category=/\b(?:laptop|notebook|computer|headphones?|earbuds?|earphones?|smartphone|phone|tablet|television|monitor|camera|printer|speaker|keyboard|mouse|charger|electronic)\b/i.test(product)?'Electronics':/\b(?:shirt|jeans|trousers|dress|jacket|shoes?|sneakers?|clothing)\b/i.test(product)?'Clothing':/\b(?:sofa|chair|table|mattress|kettle|toaster|blender|vacuum|refrigerator|washing machine)\b/i.test(product)?'Home':'';
 return {product:product.slice(0,180),merchant:merchant.slice(0,180),purchase_date,delivery_date,price_minor:amount?.minor??null,currency,order_ref:order_ref.slice(0,180),serial:serial.slice(0,180),category,extraction_notes:notes};
}

// Keep receipt extraction local and deterministic. It proposes values, never fills missing facts.
function receiptField(lines:string[],labels:string){
 lines=lines.flatMap(line=>line.replace(/\s*\((?:DD|MM)[-/.](?:DD|MM)[-/.](?:YYYY|YY)\)/ig,'').split(/\s{2,}(?=[A-Za-z][A-Za-z /.-]{1,30}[:#])/));
 const prefix=new RegExp('^(?:'+labels+')(?=\\s|[:#=|]|$)\\s*(?:[:#=|]\\s*|[-–]\\s+)?(.*)$','i');
 for(let i=0;i<lines.length;i++){
  if(/\b(?:description|particulars|product|item)\b/i.test(lines[i])&&/\b(?:qty|quantity|rate|price|amount)\b/i.test(lines[i])&&!/[:#]/.test(lines[i]))continue;
  const match=lines[i].match(prefix);
  if(!match)continue;
  // OCR often joins two labelled columns. Do not include the second column in a value.
  const value=match[1].split(/\s{2,}(?=[A-Za-z][A-Za-z /.-]*[:#])/)[0].trim();
  if(value)return value;
  const next=lines[i+1];
  if(next&&!/^[A-Za-z][A-Za-z /.-]{1,30}\s*[:#]/.test(next))return next;
 }
 return '';
}

function receiptMerchant(lines:string[]){
 for(const line of lines.slice(0,8)){
  if(/\b(?:bill(?:ed)? to|ship(?:ped)? to|customer|buyer|consignee|product|description)\b/i.test(line))break;
  if(line.length<3||line.length>120||!/[A-Za-z]{2}/.test(line))continue;
  if(/(?:\b(?:invoice|receipt|original|duplicate|copy|gstin|gst|vat|tax|date|order|phone|mobile|tel|fax|email|www|http|address|welcome|thank|sample|demo)\b|@|:\s|\d{5,})/i.test(line))continue;
  if(/^\d/.test(line))continue;
  return line;
 }
 return '';
}

function receiptItems(lines:string[]){
 const header=lines.findIndex(line=>/\b(?:description|particulars|product|item)\b/i.test(line)&&/\b(?:qty|quantity|rate|price|amount)\b/i.test(line));
 if(header<0)return [];
 const items:string[]=[];
 for(const line of lines.slice(header+1)){
  if(/^(?:sub\s*total|grand total|total|tax|cgst|sgst|igst|gst|discount|shipping|round\s*off|amount|payment|terms|warranty|bank)\b/i.test(line))break;
  if(!/[A-Za-z]{2}/.test(line)||/^(?:hsn|sac|serial|s\/?n|imei|sku|model|page|note)\b/i.test(line))continue;
  let item=line.replace(/^\d{1,3}[.)]?\s+/,'');
  const columns=item.split(/\s{2,}|\s*\|\s*/);
  if(columns.length>1)item=columns[0];
  else item=item.replace(/\s+\d+(?:\.\d+)?\s+(?:(?:INR|USD|Rs\.?)\s*|[₹$€£]\s*)?\d[\d,.]*(?:\s+\d[\d,.%]*)*\s*$/i,'');
  item=item.replace(/\s+(?:INR|USD|Rs\.?)?\s*[₹$€£]?\s*\d[\d,]*\.\d{2}\s*$/i,'').trim();
  if(item.length>2&&/[A-Za-z]{2}/.test(item))items.push(item);
 }
 return [...new Set(items)];
}

function receiptDate(raw:string,fullText:string,notes:string[],label:string):string|null{
 if(!raw)return null;
 const valid=(year:number,month:number,day:number)=>{const iso=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return date.safeParse(iso).success?iso:null;};
 let result:string|null=null;
 const iso=raw.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
 const numeric=raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/);
 const named=raw.match(/\b(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{4}|\d{2})\b/)||raw.match(/\b([A-Za-z]{3,9})[\s-]+(\d{1,2})(?:st|nd|rd|th)?[\s,-]+(\d{4}|\d{2})\b/);
 const year=(value:string)=>{if(value.length===2){notes.push(`${label} uses a two-digit year; interpreted as 20${value}. Please verify.`);return 2000+Number(value);}return Number(value);};
 if(iso)result=valid(Number(iso[1]),Number(iso[2]),Number(iso[3]));
 else if(named){
  const dayFirst=/^\d/.test(named[1]),monthText=dayFirst?named[2]:named[1];
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const month=months.indexOf(monthText.slice(0,3).toLowerCase())+1;
  if(month)result=valid(year(named[3]),month,Number(dayFirst?named[1]:named[2]));
 }else if(numeric){
  const a=Number(numeric[1]),b=Number(numeric[2]);
  const dayFirst=/\bdd\s*[-/.]\s*mm\s*[-/.]\s*(?:yyyy|yy)\b/i.test(fullText);
  const monthFirst=/\bmm\s*[-/.]\s*dd\s*[-/.]\s*(?:yyyy|yy)\b/i.test(fullText);
  if(a<=12&&b<=12&&a!==b&&dayFirst===monthFirst){notes.push(`${label} "${numeric[0]}" is ambiguous (day/month or month/day). Enter the date after reviewing the receipt.`);return null;}
  const isDayFirst=dayFirst||(!monthFirst&&a>12);
  result=valid(year(numeric[3]),isDayFirst?b:a,isDayFirst?a:b);
 }
 if(!result)notes.push(`${label} could not be read as a valid calendar date. Enter it after reviewing the receipt.`);
 return result;
}

function receiptCurrency(raw:string){
 const code=raw.match(/\b(INR|USD|EUR|GBP|CAD|AUD|NZD|SGD|HKD|JPY|CNY|AED)\b/i)?.[1]?.toUpperCase();
 if(code)return code;
 if(/₹|\b(?:rs\.?|rupees)\b/i.test(raw))return 'INR';
 if(/€/.test(raw))return 'EUR';
 if(/£/.test(raw))return 'GBP';
 if(/(?:CA|C)\s*\$/i.test(raw))return 'CAD';
 if(/(?:AU|A)\s*\$/i.test(raw))return 'AUD';
 if(/NZ\s*\$/i.test(raw))return 'NZD';
 if(/SG\s*\$/i.test(raw))return 'SGD';
 if(/HK\s*\$/i.test(raw))return 'HKD';
 if(/\$/.test(raw))return 'USD';
 return '';
}

function receiptTotal(lines:string[],notes:string[]){
 const candidates:{minor:number,raw:string,rank:number}[]=[];
 const labels=/^(grand\s+total|order\s+total|invoice\s+total|total\s+(?:amount|paid|payable|due|inclusive)|amount\s+(?:paid|payable)|net\s+(?:payable|amount)|total)(?=\s|[:=|]|$)\s*[:=|]?\s*(.*)$/i;
 for(let i=0;i<lines.length;i++){
  const match=lines[i].match(labels);
  if(!match)continue;
  const raw=match[2]||lines[i+1]||'';
  // Never treat quantities, tax percentages, amount-in-words or a subtotal as the final price.
  if(/\b(?:items?|qty|quantity|savings?|discount|tax|before|excluding|in words)\b|%/i.test(raw))continue;
  const numericText=raw.replace(/\b(?:INR|USD|EUR|GBP|CAD|AUD|NZD|SGD|HKD|JPY|CNY|AED|Rs\.?)\s*/ig,' ');
  const number=numericText.match(/(?:^|\s|[₹$€£:=])((?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3}|\d+)(?:\.\d{1,2})?)(?![\d,.])/);
  if(!number||/-\s*(?:[₹$€£]\s*)?\d/.test(raw))continue;
  const minor=Math.round(Number(number[1].replaceAll(',',''))*100);
  if(!Number.isSafeInteger(minor)||minor>1000000000)continue;
  candidates.push({minor,raw,rank:/^grand|^order|^invoice|payable|inclusive/i.test(match[1])?3:/^total$/i.test(match[1])?1:2});
 }
 if(!candidates.length)return null;
 const rank=Math.max(...candidates.map(x=>x.rank)),best=candidates.filter(x=>x.rank===rank);
 if(new Set(best.map(x=>x.minor)).size>1){notes.push('Several different final totals were found. Confirm the purchase amount from the receipt.');return null;}
 return best[0];
}
