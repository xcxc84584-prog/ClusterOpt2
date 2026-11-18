'use strict';
// Windows integration: MCP must follow the currently running Agent port.
// No Cloudflare tunnel or real user services are touched.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const net=require('node:net');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../plugins/ai-agent-mcp/local-agent');
const secure=require(path.join(root,'secure-store.cjs'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function openServer(server){
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolve);
 });
 return server.address().port;
}
async function freePort(){
 const listener=net.createServer();
 const port=await openServer(listener);
 await new Promise(resolve=>listener.close(resolve));
 return port;
}
async function invoke(port,bearer,name){
 const res=await fetch('http://127.0.0.1:'+port+'/mcp',{
  method:'POST',
  headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',
   params:{name,arguments:{}}}),
  signal:AbortSignal.timeout(4000)
 });
 assert.equal(res.status,200);
 return res.json();
}
test('MCP uses recorded Agent port and distinguishes HTTP 403',async t=>{
 if(process.platform!=='win32'){t.skip('DPAPI integration is Windows-only');return}
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cluster-agent-port-'));
 const token=crypto.randomBytes(32).toString('hex');
 const config=path.join(temp,'ClusterTerminalAgent');
 const recordDir=path.join(temp,'ClusterOpt2','AI-Agent-MCP');
 fs.mkdirSync(config,{recursive:true});
 fs.mkdirSync(recordDir,{recursive:true});
 secure.protectFile(path.join(config,'pairing-token.dpapi'),token);
 const a=http.createServer((req,res)=>{
  const valid=req.headers.authorization==='Bearer '+token;
  res.writeHead(valid?200:403,{'Content-Type':'application/json'});
  res.end(JSON.stringify(valid?{marker:'A'}:{error:'Forbidden'}));
 });
 const b=http.createServer((req,res)=>{
  const valid=req.headers.authorization==='Bearer '+token;
  res.writeHead(valid?200:403,{'Content-Type':'application/json'});
  res.end(JSON.stringify(valid?{marker:'B'}:{error:'Forbidden'}));
 });
 const aPort=await openServer(a),bPort=await openServer(b);
 const mcpPort=await freePort();
 const record=path.join(recordDir,'background-agent.json');
 const save=(port,pid=process.pid)=>fs.writeFileSync(record,
  JSON.stringify({port,pid}));
 save(aPort);
 const child=spawn(process.execPath,[path.join(root,'remote-mcp.cjs')],{
  env:{...process.env,LOCALAPPDATA:temp,
   CLUSTER_MCP_PORT:String(mcpPort),
   // Deliberately stale: effective port must come from saved record.
   CLUSTER_TERMINAL_PORT:String(bPort)},
  stdio:['ignore','pipe','pipe'],windowsHide:true
 });
 t.after(async()=>{
  child.kill();
  await Promise.all([new Promise(r=>a.close(r)),new Promise(r=>b.close(r))]);
  fs.rmSync(temp,{recursive:true,force:true});
 });
 let ready=false;
 for(let i=0;i<80;i++){
  if(child.exitCode!==null)break;
  try{
   const probe=await fetch('http://127.0.0.1:'+mcpPort+'/mcp',{
    signal:AbortSignal.timeout(300)});
   if(probe.status===401){ready=true;break}
  }catch{}
  await wait(100);
 }
 assert.equal(ready,true,'MCP listener did not become ready');
 const bearer=fs.readFileSync(path.join(config,'remote-mcp-token'),'utf8').trim();
 let response=await invoke(mcpPort,bearer,'cluster.get_status');
 assert.match(response.result.content[0].text,/"marker":"A"/);
 save(bPort);
 response=await invoke(mcpPort,bearer,'cluster.get_status');
 assert.match(response.result.content[0].text,/"marker":"B"/);
 // Windows PowerShell 5.1 may serialize JSON with a UTF-8 BOM.
 // The MCP bridge must parse that legacy record without restarting.
 fs.writeFileSync(record,'\uFEFF'+JSON.stringify({port:bPort,pid:process.pid}));
 response=await invoke(mcpPort,bearer,'cluster.get_status');
 assert.match(response.result.content[0].text,/"marker":"B"/);
 secure.protectFile(path.join(config,'pairing-token.dpapi'),
   crypto.randomBytes(32).toString('hex'));
 response=await invoke(mcpPort,bearer,'cluster.get_status');
 assert.equal(response.result.isError,true);
 assert.match(response.result.content[0].text,/pairing token.*HTTP 403/);
});
