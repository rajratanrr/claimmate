import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// A separate process and temporary database keep the developer's real vault untouched.
const root=fileURLToPath(new URL('../',import.meta.url));
let dir='',base='',server:ChildProcess|undefined,logs='';
let aliceCookie='',bobCookie='',aliceToken='',bobToken='';
let alice:Client|undefined,bob:Client|undefined,purchase:any,receipt:any,policy:any,claim:any;
const protocol='2025-11-25';
const renderOrigin='https://claimmate-integration.onrender.com';
const mcpHeaders={'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':protocol};

async function freePort(){
 const socket=createServer();
 await new Promise<void>((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});
 const address=socket.address();assert(address&&typeof address!=='string');
 await new Promise<void>((resolve,reject)=>socket.close(e=>e?reject(e):resolve()));
 return address.port;
}
async function request(route:string,method='GET',body?:unknown,cookie=aliceCookie){
 return fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function json(route:string,method='GET',body?:unknown,cookie=aliceCookie){
 const response=await request(route,method,body,cookie);const value=await response.json();
 assert(response.ok,`${method} ${route}: ${response.status} ${JSON.stringify(value)}`);return value;
}
async function upload(type:string,name:string,text:string){
 const form=new FormData();form.set('type',type);form.set('file',new Blob([text],{type:'text/plain'}),name);
 const response=await fetch(`${base}/api/purchases/${purchase.id}/documents`,{method:'POST',headers:{Cookie:aliceCookie},body:form});
 assert.equal(response.status,200);return response.json();
}
function resultData(result:any){
 assert.notEqual(result.isError,true,JSON.stringify(result.content));
 const text=result.content.find((item:any)=>item.type==='text')?.text;assert(text);return JSON.parse(text);
}
function resultError(result:any,match:RegExp){
 assert.equal(result.isError,true);assert.match(JSON.stringify(result.content),match);
}

before(async()=>{
 dir=await mkdtemp(path.join(tmpdir(),'claimmate-http-test-'));
 const port=await freePort();base=`http://127.0.0.1:${port}`;
 server=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:root,env:{...process.env,DATA_DIR:dir,UPLOAD_DIR:path.join(dir,'uploads'),PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',ALLOWED_ORIGINS:` ${base} `,RENDER_EXTERNAL_URL:renderOrigin,COOKIE_SECURE:'true'},stdio:['ignore','pipe','pipe']});
 server.stdout?.on('data',chunk=>{logs=(logs+chunk).slice(-32000);});
 server.stderr?.on('data',chunk=>{logs=(logs+chunk).slice(-32000);});
 const deadline=Date.now()+20000;
 while(true){
  try{const health=await fetch(base+'/api/health');if(health.ok)break;}catch{}
  if(server.exitCode!==null||Date.now()>deadline)throw Error(`Isolated server did not start: ${logs}`);
  await delay(50);
 }
 for(const who of ['alice','bob']){
  const response=await request('/api/register','POST',{email:`${who}@integration.example`,password:'integration-test-password'},'');
  assert.equal(response.status,200);const setCookie=response.headers.get('set-cookie');assert.match(setCookie||'',/; Secure/i);const cookie=setCookie?.split(';')[0];assert(cookie);
  const {token}=await json('/api/mcp-token','POST',{},cookie);
  if(who==='alice'){aliceCookie=cookie;aliceToken=token;}else{bobCookie=cookie;bobToken=token;}
 }
}, {timeout:25000});

after(async()=>{
 await Promise.allSettled([alice?.close(),bob?.close()]);
 if(server&&server.exitCode===null){
  const stopped=new Promise<void>(resolve=>server!.once('exit',()=>resolve()));server.kill('SIGTERM');
  await Promise.race([stopped,delay(5000,undefined,{ref:false})]);
  if(server.exitCode===null)server.kill('SIGKILL');
 }
 if(dir)await rm(dir,{recursive:true,force:true});
});

test('HTTP health identifies guided mode; authentication protects API and MCP',async()=>{
 const health=await json('/api/health');assert.equal(health.mcp_protocol,protocol);assert.match(health.mode,/Guided mode/);
 assert.equal((await request('/api/purchases','GET',undefined,'')).status,401);
 assert.equal((await request('/api/mcp-token','POST',{},'')).status,401);
 assert.equal((await request('/mcp','POST',{},'')).status,401);
 const invalid=await fetch(base+'/mcp',{method:'POST',headers:{...mcpHeaders,Authorization:'Bearer invalid'},body:'{}'});
 assert.equal(invalid.status,401);
});

test('HTTP allows Render and configured origins while rejecting lookalikes and cross-site requests',async()=>{
 const unsafeHeaders:Record<string,string>[]=[{Origin:'https://untrusted.example'},{Origin:renderOrigin+'.untrusted.example'},{Origin:renderOrigin.replace('https:','http:')},{'Sec-Fetch-Site':'cross-site'}];
 for(const headers of unsafeHeaders){
  const response=await fetch(base+'/mcp',{method:'POST',headers:{...mcpHeaders,Authorization:`Bearer ${aliceToken}`,...headers},body:'{}'});
  assert.equal(response.status,403);
 }
 for(const origin of [base,renderOrigin]){
  const allowed=await fetch(base+'/api/purchases',{headers:{Cookie:aliceCookie,Origin:origin}});assert.equal(allowed.status,200);
 }
});

test('real SDK initializes stateless Streamable HTTP with protocol 2025-11-25 and lists ten tools',async()=>{
 const initialization=await fetch(base+'/mcp',{method:'POST',headers:{...mcpHeaders,Authorization:`Bearer ${aliceToken}`},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:protocol,capabilities:{},clientInfo:{name:'claimmate-integration-raw',version:'1.0.0'}}})});
 assert.equal(initialization.status,200);const initialized=await initialization.json();
 assert.equal(initialized.result.protocolVersion,protocol);assert.equal(initialized.result.serverInfo.name,'claimmate');
 assert.equal(initialization.headers.get('mcp-session-id'),null);
 alice=new Client({name:'claimmate-integration-sdk',version:'1.0.0'});
 const transport=new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:`Bearer ${aliceToken}`}}});
 await alice.connect(transport);assert.equal(transport.protocolVersion,protocol);
 const {tools}=await alice.listTools();
 assert.deepEqual(tools.map(tool=>tool.name).sort(),['list_purchases','get_purchase','search_policy_evidence','assess_documented_options','find_support_contacts','create_claim_draft','get_claim','update_claim','get_claim_packet','resume_case'].sort());
 for(const tool of tools){assert.equal(tool.inputSchema.type,'object');assert.equal(tool.annotations?.destructiveHint,false);}
 assert.equal(tools.find(tool=>tool.name==='update_claim')?.annotations?.idempotentHint,false);
 assert.deepEqual(resultData(await alice.callTool({name:'list_purchases'})),[]);
 assert.equal((await fetch(base+'/mcp',{headers:{Authorization:`Bearer ${aliceToken}`}})).status,405);
});

test('HTTP purchase and document intake require review before MCP can create a claim',async()=>{
 purchase=await json('/api/purchases','POST',{product:'Integration headphones',merchant:'Example Store',purchase_date:'2026-01-15',price_minor:129900,currency:'INR'});
 receipt=await upload('receipt','receipt.txt','Example Store\nProduct: Integration headphones\nPurchase date: 2026-01-15\nOrder: TEST-123456\nTotal: INR 1,299.00');
 policy=await upload('policy','policy.txt','Limited warranty: manufacturing defects may be assessed within 12 months of purchase. Accidental damage is excluded. Contact the seller with proof of purchase.');
 assert.equal(receipt.state,'ready');assert.equal(policy.state,'ready');
 resultError(await alice!.callTool({name:'create_claim_draft',arguments:{purchase_id:purchase.id,issue:'Headphones no longer charge',idempotency_key:'integration-draft-1'}}),/confirm purchase/);
 purchase=await json(`/api/purchases/${purchase.id}`,'PUT',{...purchase,confirmed:true});assert.equal(purchase.confirmed,1);
});

test('SDK runs purchase, policy assessment, draft, update, packet and resume flow',async()=>{
 assert.equal(resultData(await alice!.callTool({name:'get_purchase',arguments:{purchase_id:purchase.id}})).product,'Integration headphones');
 const sources=resultData(await alice!.callTool({name:'search_policy_evidence',arguments:{purchase_id:purchase.id,query:'warranty'}}));
 assert.equal(sources.length,1);assert.match(sources[0].excerpt,/Accidental damage is excluded/);
 const assessment=resultData(await alice!.callTool({name:'assess_documented_options',arguments:{purchase_id:purchase.id}}));assert.equal(assessment.mode,'guided');assert.equal(assessment.sources.length,1);
 const automaticSupport=resultData(await alice!.callTool({name:'find_support_contacts',arguments:{purchase_id:purchase.id}}));assert.equal(automaticSupport.mode,'verified-directory');assert.equal(automaticSupport.matches.length,0);
 const selectedSupport=resultData(await alice!.callTool({name:'find_support_contacts',arguments:{purchase_id:purchase.id,brand:'dell'}}));assert.equal(selectedSupport.matches[0].name,'Dell');assert.match(selectedSupport.matches[0].url,/^https:\/\/www\.dell\.com\//);assert(selectedSupport.matches[0].checked);
 const args={purchase_id:purchase.id,issue:'Headphones no longer charge',idempotency_key:'integration-draft-1'};
 claim=resultData(await alice!.callTool({name:'create_claim_draft',arguments:args}));assert.equal(claim.status,'draft');assert.match(claim.draft,/TEST-123456|reference needed/);
 assert.equal(resultData(await alice!.callTool({name:'create_claim_draft',arguments:args})).id,claim.id);
 resultError(await alice!.callTool({name:'create_claim_draft',arguments:{...args,issue:'A different reported fault'}}),/different issue/);
 const edited='Reviewed support request. Please assess the charging fault.';
 resultData(await alice!.callTool({name:'update_claim',arguments:{case_id:claim.id,notes:'Started yesterday.',draft:edited}}));
 const saved=resultData(await alice!.callTool({name:'get_claim',arguments:{case_id:claim.id}}));assert.equal(saved.draft,edited);assert.equal(saved.notes,'Started yesterday.');
 const packet=resultData(await alice!.callTool({name:'get_claim_packet',arguments:{case_id:claim.id}}));assert.equal(packet.draft,edited);assert.equal(packet.sources.length,1);assert.equal(packet.source_warning,null);
 const resumed=resultData(await alice!.callTool({name:'resume_case',arguments:{case_id:claim.id}}));assert(resumed.events.length>=3);assert.equal(resumed.draft,edited);
});

test('MCP schema validation rejects malformed arguments and cannot mark a request sent',async()=>{
 resultError(await alice!.callTool({name:'get_purchase',arguments:{purchase_id:'invalid-uuid'}}),/validation|UUID|uuid/i);
 resultError(await alice!.callTool({name:'create_claim_draft',arguments:{purchase_id:purchase.id,issue:'x',idempotency_key:'short'}}),/validation|characters|small/i);
 resultError(await alice!.callTool({name:'find_support_contacts',arguments:{purchase_id:purchase.id,brand:'invented-brand'}}),/validation|option|enum/i);
 resultError(await alice!.callTool({name:'update_claim',arguments:{case_id:claim.id,status:'user marked sent'}}),/Only the user/);
 assert.equal((await json(`/api/cases/${claim.id}`)).status,'draft');
});

test('second user cannot read first user purchases, policy, claims or original downloads',async()=>{
 bob=new Client({name:'claimmate-other-user',version:'1.0.0'});
 await bob.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:`Bearer ${bobToken}`}}}));
 assert.deepEqual(resultData(await bob.callTool({name:'list_purchases'})),[]);
 for(const name of ['get_purchase','search_policy_evidence','assess_documented_options','find_support_contacts'])resultError(await bob.callTool({name,arguments:{purchase_id:purchase.id}}),/not found/);
 for(const name of ['get_claim','get_claim_packet','resume_case'])resultError(await bob.callTool({name,arguments:{case_id:claim.id}}),/not found/);
 for(const route of [`/api/purchases/${purchase.id}`,`/api/documents/${receipt.id}/download`,`/api/documents/${receipt.id}/suggestions`,`/api/cases/${claim.id}/packet.pdf`,`/api/cases/${claim.id}/draft.txt`])assert.equal((await request(route,'GET',undefined,bobCookie)).status,404,route);
 assert.equal((await request(`/api/documents/${receipt.id}/download`,'GET',undefined,'')).status,401);
 const download=await request(`/api/documents/${receipt.id}/download`);assert.equal(download.status,200);assert.match(await download.text(),/TEST-123456/);
 assert.match((await request(`/api/cases/${claim.id}/packet.pdf`)).headers.get('content-type')||'',/application\/pdf/);
});

test('logout revokes the browser session without revoking the separate MCP token',async()=>{
 await json('/api/logout','POST',{});
 assert.equal((await request('/api/purchases')).status,401);
 assert.equal(resultData(await alice!.callTool({name:'list_purchases'})).length,1);
});
