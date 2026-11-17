import {timingSafeEqual} from 'node:crypto';
const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
/** Attach a native Windows ConPTY terminal to the existing loopback HTTP server. */
export async function attachNativeTerminal(server,{token,allowedOrigins,maxSessions=8}){
 const [{WebSocketServer},pty]=await Promise.all([import('ws'),import('node-pty')]);
 const wss=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
 const sessions=new Set();
 server.on('upgrade',(req,socket,head)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname!=='/terminal/ws'||!allowedOrigins.has(req.headers.origin)||req.headers['sec-websocket-protocol']!=='clusteropt-terminal-v1'||sessions.size>=maxSessions){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{
   sessions.add(ws);let term=null,authed=false;
   const timeout=setTimeout(()=>{if(!authed)ws.close(1008,'Auth timeout');},5000);
   ws.on('message',buffer=>{
    let m;try{m=JSON.parse(buffer.toString());}catch{ws.close(1003);return;}
    if(!authed){
     if(m.type!=='auth'||!same(m.token,token)){ws.close(1008,'Unauthorized');return;}
     authed=true;clearTimeout(timeout);
     try{
      term=pty.spawn(process.platform==='win32'?'powershell.exe':'pwsh',['-NoLogo'],{name:'xterm-256color',cols:80,rows:24,cwd:process.env.USERPROFILE||process.cwd(),env:{...process.env,TERM:'xterm-256color'}});
      term.onData(data=>{if(ws.readyState===1)ws.send(JSON.stringify({type:'data',data}));});
      term.onExit(({exitCode})=>{if(ws.readyState===1)ws.send(JSON.stringify({type:'exit',exitCode}));ws.close();});
      ws.send(JSON.stringify({type:'ready'}));
     }catch(e){ws.send(JSON.stringify({type:'error',message:e.message}));ws.close();}
     return;
    }
    if(m.type==='input'&&typeof m.data==='string'&&m.data.length<=32768)term?.write(m.data);
    if(m.type==='resize'&&Number.isInteger(m.cols)&&Number.isInteger(m.rows)&&m.cols>=10&&m.cols<=500&&m.rows>=5&&m.rows<=200)term?.resize(m.cols,m.rows);
   });
   ws.on('close',()=>{clearTimeout(timeout);sessions.delete(ws);term?.kill();});
   ws.on('error',()=>{});
  });
 });
 return {close(){for(const ws of sessions)ws.close();wss.close();}};
}
