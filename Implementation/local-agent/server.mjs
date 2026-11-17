// ClusterOpt2 Local Agent — version injected by the trusted installer at launch.
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const DEFAULT_PORT=43881;
export const ALLOWED_ORIGINS=new Set(['https://xcxc84584-prog.github.io']);
export const READ_ONLY_COMMANDS=Object.freeze({
  version:['-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.ToString()'],
  location:['-NoProfile','-NonInteractive','-Command','(Get-Location).Path']
});
const json=(res,code,data,origin)=>{
 res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});
 res.end(JSON.stringify(data));
};
function equalSecret(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
export function createLocalAgent({token=randomBytes(32).toString('hex'),origins=ALLOWED_ORIGINS,runner=runReadOnly}={}){
 let revoked=false;
 const sessions=new Map();
 const level='FULL';
 const server=createServer(async(req,res)=>{
   const origin=req.headers.origin;
   if(!origin||!origins.has(origin))return json(res,403,{ok:false,code:'ORIGIN_DENIED'});
   if(req.method==='OPTIONS'){
     if(req.headers['access-control-request-method']!=='POST')return json(res,405,{ok:false,code:'METHOD_DENIED'},origin);
     res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'0','Vary':'Origin'});return res.end();
   }
   if(req.method!=='POST'||!['/status','/execute','/revoke','/session/start','/session/run','/session/poll','/session/interrupt','/session/close'].includes(req.url))return json(res,404,{ok:false,code:'NOT_FOUND'},origin);
   if(revoked||!equalSecret(req.headers.authorization?.replace(/^Bearer /,''),token))return json(res,401,{ok:false,code:'UNAUTHORIZED'},origin);
   let raw='';
   try{for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw new Error('PAYLOAD_TOO_LARGE');}}
   catch{return json(res,413,{ok:false,code:'PAYLOAD_TOO_LARGE'},origin);}
   let body;try{body=JSON.parse(raw||'{}');}catch{return json(res,400,{ok:false,code:'INVALID_JSON'},origin);}
   if(req.url==='/session/start'){
     if(sessions.size>=12)return json(res,429,{ok:false,code:'SESSION_LIMIT'},origin);
     const id=randomBytes(16).toString('hex');
     const session=createPersistentSession();sessions.set(id,session);
     return json(res,200,{ok:true,id},origin);
   }
   if(req.url?.startsWith('/session/')){
     const session=sessions.get(body.id);
     if(!session)return json(res,404,{ok:false,code:'SESSION_NOT_FOUND'},origin);
     if(req.url==='/session/run'){
       if(typeof body.command!=='string'||!body.command.trim()||body.command.length>16384)return json(res,400,{ok:false,code:'INVALID_COMMAND'},origin);
       try{return json(res,200,{ok:true,...session.run(body.command)},origin);}catch(e){return json(res,409,{ok:false,code:e.message},origin);}
     }
     if(req.url==='/session/poll')return json(res,200,{ok:true,...session.poll()},origin);
     if(req.url==='/session/interrupt'){session.stop();sessions.delete(body.id);return json(res,200,{ok:true,interrupted:true},origin);}
     if(req.url==='/session/close'){session.stop();sessions.delete(body.id);return json(res,200,{ok:true,closed:true},origin);}
   }
   if(req.url==='/status')return json(res,200,{ok:true,connected:true,mode:'INTERACTIVE',permission:level,version:process.env.CLUSTEROPT_AGENT_VERSION||'unknown'},origin);
   if(req.url==='/revoke'){revoked=true;for(const session of sessions.values())session.stop();sessions.clear();return json(res,200,{ok:true,revoked:true},origin);}
   if(body.action==='interactive'){
    if(typeof body.command!=='string'||!body.command.trim()||body.command.length>2048)return json(res,403,{ok:false,code:'COMMAND_APPROVAL_REQUIRED'},origin);
    try{const result=await runInteractive(body.command);return json(res,200,{ok:true,...result},origin);}
    catch{return json(res,503,{ok:false,code:'COMMAND_FAILED'},origin);}
  }
  if(typeof body.action!=='string'||!Object.hasOwn(READ_ONLY_COMMANDS,body.action))return json(res,403,{ok:false,code:'COMMAND_DENIED'},origin);
   try{const result=await runner(body.action);return json(res,200,{ok:true,...result},origin);}
   catch{return json(res,503,{ok:false,code:'COMMAND_FAILED'},origin);}
 });
 server.on('close',()=>{for(const session of sessions.values())session.stop();sessions.clear();});
 return {server,get revoked(){return revoked;},get token(){return token;},get permission(){return level;}};
}

/** Persistent per-tab PowerShell. Output is polled, bounded, and never written to storage. */
export function createPersistentSession(){
 const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-Command','-'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
 const pending=[];let running=null;let closed=false;let output='';let partial='';
 const maxBuffer=256*1024;
 const capture=chunk=>{output+=String(chunk);if(output.length>maxBuffer)output=output.slice(-maxBuffer);};
 child.stdout.on('data',chunk=>{
   partial+=chunk.toString('utf8');
   // Keep only the possible marker prefix buffered; stream all other output immediately.
   while(partial){
     const marker=running?.marker;
     if(!marker){capture(partial);partial='';break;}
     const at=partial.indexOf(marker);
     if(at>=0){capture(partial.slice(0,at));partial=partial.slice(at+marker.length);running=null;drain();continue;}
     let keep=0;
     for(let n=Math.min(marker.length-1,partial.length);n>0;n--){
       if(partial.endsWith(marker.slice(0,n))){keep=n;break;}
     }
     if(partial.length>keep)capture(partial.slice(0,partial.length-keep));
     partial=keep?partial.slice(-keep):'';
     break;
   }
 });
 child.stderr.on('data',capture);
 child.on('error',e=>{capture(String(e.message));closed=true;running=null;});
 child.on('close',code=>{if(partial)capture(partial);partial='';closed=true;running=null;capture('\n[PowerShell exited: '+code+']');});
 function drain(){
   if(closed||running||!pending.length)return;
   running=pending.shift();
   // Base64 avoids command injection through the protocol framing; the decoded script is user-provided code.
   const b64=Buffer.from(running.command,'utf8').toString('base64');
   const line="$__cluster_script=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+b64+"')); try { Invoke-Expression $__cluster_script 2>&1 | Out-String -Width 240 | Write-Output } finally { Write-Output '"+running.marker+"' }";
   child.stdin.write(line+'\n\n');
 }
 return {
  run(command){if(closed)throw new Error('SESSION_CLOSED');if(pending.length>=20)throw new Error('QUEUE_FULL');const marker='__CLUSTER_END_'+randomBytes(12).toString('hex')+'__';pending.push({command,marker});drain();return {queued:pending.length,busy:Boolean(running)};},
  poll(){const chunk=output;output='';return {output:chunk,busy:Boolean(running),queued:pending.length,closed};},
  stop(){closed=true;pending.length=0;child.kill();}
 };
}

export function runReadOnly(action){
 return new Promise((resolve,reject)=>{
  if(!Object.hasOwn(READ_ONLY_COMMANDS,action))return reject(new Error('COMMAND_DENIED'));
  const child=spawn('powershell.exe',READ_ONLY_COMMANDS[action],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',error='',finished=false;
  const timer=setTimeout(()=>child.kill(),5000);
  const add=(key,chunk)=>{if(key==='out')output+=chunk;else error+=chunk;if(output.length+error.length>16384)child.kill();};
  child.stdout.on('data',chunk=>add('out',chunk));child.stderr.on('data',chunk=>add('err',chunk));
  child.on('error',e=>{if(!finished){finished=true;clearTimeout(timer);reject(e);}});
  child.on('close',code=>{clearTimeout(timer);if(finished)return;finished=true;code===0&&output.length+error.length<=16384?resolve({output:output.trim()}):reject(new Error('EXECUTION_FAILED'));});
 });
}

// Interactive commands use the authenticated local agent. No per-command dialog or elevation.
// One-shot process: command state does not persist between executions.
export function runInteractive(command){
 return new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],windowsVerbatimArguments:false});
  let output='',error='',finished=false;
  const timer=setTimeout(()=>child.kill(),15000);
  const add=(key,chunk)=>{if(key==='out')output+=chunk;else error+=chunk;if(output.length+error.length>65536)child.kill();};
  child.stdout.on('data',chunk=>add('out',chunk));child.stderr.on('data',chunk=>add('err',chunk));
  child.on('error',e=>{if(!finished){finished=true;clearTimeout(timer);reject(e);}});
  child.on('close',code=>{clearTimeout(timer);if(finished)return;finished=true;
   if(output.length+error.length>65536)return reject(new Error('OUTPUT_LIMIT'));
   resolve({output:[output.trim(),error.trim()].filter(Boolean).join('\n'),exitCode:code});
  });
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 // The detached installer provides a one-time token in the child environment.
 // Delete it before spawning any native PowerShell descendants.
 const suppliedToken=process.env.CLUSTEROPT_PAIRING_TOKEN;
 delete process.env.CLUSTEROPT_PAIRING_TOKEN;
 const hasSuppliedToken=/^[a-f0-9]{64}$/i.test(suppliedToken||'');
 if(suppliedToken&&!hasSuppliedToken)throw Error('INVALID_PAIRING_TOKEN');
 const agent=createLocalAgent(hasSuppliedToken?{token:suppliedToken.toLowerCase()}:{});

 try{const {attachNativeTerminal}=await import('./native-terminal.mjs');await attachNativeTerminal(agent.server,{token:agent.token,allowedOrigins:ALLOWED_ORIGINS});console.log('Native ConPTY terminal: enabled');}
 catch(error){console.error('Native terminal unavailable:',error.message);}
 console.log('PowerShell sessions: enabled after browser pairing');
 const port=Number(process.env.CLUSTEROPT_PORT)||DEFAULT_PORT;
 agent.server.listen(port,'127.0.0.1',()=>{
  console.log('ClusterOpt Local Agent listening on 127.0.0.1:'+port);
  if(!hasSuppliedToken)console.log('Pairing token (do not share): '+agent.token);
  console.log('Allowed origin: https://xcxc84584-prog.github.io');
   console.log('Agent version: '+(process.env.CLUSTEROPT_AGENT_VERSION||'unknown'));
 });
}
