'use strict';
// Cluster MCP stdio bridge. Local requests use the browser's scoped ToolBox approvals.\n// Mutating operations are never authorized merely by a tools/list response.
// MCP stdio transport uses newline-delimited JSON-RPC messages.
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const tokenPath=path.join(process.env.LOCALAPPDATA||path.join(require('node:os').homedir(),'AppData','Local'),'ClusterTerminalAgent','pairing-token');
const configPath=path.join(process.env.LOCALAPPDATA||
  path.join(require('node:os').homedir(),'AppData','Local'),
  'ClusterOpt2','AI-Agent-MCP','service-ports.json');
let configuredPort=43881;
try {
 const data=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
 const port=Number(data.terminal);
 if(Number.isInteger(port)&&port>=1024&&port<=65535)configuredPort=port;
} catch { /* No config yet: use canonical default. */ }
const endpoint='http://127.0.0.1:'+
  (process.env.CLUSTER_TERMINAL_PORT||configuredPort);
function respond(id,result){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n');}
function error(id,code,message){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,error:{code,message}})+'\n');}
async function local(route,call){
 const token=fs.readFileSync(tokenPath,'utf8').trim();
 const response=await fetch(endpoint+route,{method:call?'POST':'GET',headers:{Authorization:'Bearer '+token,...(call?{'Content-Type':'application/json'}:{})},...(call?{body:JSON.stringify(call)}:{}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Local gateway returned HTTP '+response.status);
 return response.json();
}
const tools=[
 {name:'cluster.get_status',description:'Get status of the paired Cluster local Agent and browser editor.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.get_task_status',description:'Get recent local task states.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.list_files',description:'List files opened in Cluster editor.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.get_editor_state',description:'Get active Cluster editor state.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.read_file',description:'Read an open and saved Cluster editor file by its ID.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
 {name:'cluster.list_roots',description:'List Explorer roots.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.find_root_windows_path',description:'Search bounded Windows user folders for Explorer root directory name. Returns candidates only; browser handle identity is not verified.',inputSchema:{type:'object',properties:{root:{type:'string'}},required:['root'],additionalProperties:false}},
 {name:'cluster.list_directory',description:'List entries in an authorized Explorer directory.',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}},
 {name:'cluster.read_path',description:'Read a portion of an Explorer file using offset and length; supports large files without loading them all.',inputSchema:{type:'object',properties:{path:{type:'string'},offset:{type:'integer',minimum:0},length:{type:'integer',minimum:1,maximum:262144}},required:['path'],additionalProperties:false}},
 {name:'cluster.create_file',description:'Create an empty file in an authorized Explorer directory.',inputSchema:{type:'object',properties:{path:{type:'string'},name:{type:'string'}},required:['path','name'],additionalProperties:false}},
 {name:'cluster.write_path',description:'Replace an authorized Explorer file with UTF-8 text. No timestamp or extra confirmation flags required. This overwrites the full file.',inputSchema:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content'],additionalProperties:false}},
 {name:'cluster.delete_path',description:'Delete one Explorer file when workspace Delete permission and browser write permission are granted.',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}},
 {name:'cluster.open_powershell',description:'Request opening a Cluster PowerShell terminal window; execution still requires Workspace PowerShell permission and approval.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'cluster.powershell_request',description:'Execute a PowerShell command only after the Cluster browser explicitly confirms the exact command. Runs as the local signed-in user; not sandboxed.',inputSchema:{type:'object',properties:{path:{type:'string',description:'Authorized Explorer workspace root name'},command:{type:'string'}},required:['path','command'],additionalProperties:false}}
];
async function handle(m){
 if(!m||m.jsonrpc!=='2.0'||typeof m.method!=='string')return;
 if(m.method==='notifications/initialized')return;
 if(m.id===undefined)return;
 if(m.method==='initialize'){respond(m.id,{protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'cluster-local-mcp',version:'0.1.0'}});return;}
 if(m.method==='ping'){respond(m.id,{});return;}
 if(m.method==='tools/list'){respond(m.id,{tools});return;}
 if(m.method==='tools/call'){
  const name=m.params?.name;
  const route=name==='cluster.get_status'?'/mcp/status':name==='cluster.get_task_status'?'/mcp/tasks':tools.some(t=>t.name===name)?'/mcp/call':null;
  if(!route){error(m.id,-32602,'Unknown tool');return;}
  try{const data=await local(route,route==='/mcp/call'?{name,arguments:m.params?.arguments||{}}:null);respond(m.id,{content:[{type:'text',text:JSON.stringify(data,null,2)}]});}
  catch(e){respond(m.id,{isError:true,content:[{type:'text',text:'Cluster gateway unavailable: '+e.message}]});}
  return;
 }
 error(m.id,-32601,'Method not found');
}
readline.createInterface({input:process.stdin,crlfDelay:Infinity}).on('line',line=>{try{void handle(JSON.parse(line)).catch(e=>console.error(e.message));}catch(e){console.error('Invalid MCP message: '+e.message);}});
