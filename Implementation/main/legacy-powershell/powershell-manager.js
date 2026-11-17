import {evaluateCommand} from './permission-policy.js';
// OCDA browser-side facade. This never executes commands or grants OS privileges.
export class PowerShellManager {
  #rules=[]; #status='UNCONFIGURED'; #lastError='';
  constructor({agent=null,expectedVersion=null}={}){
    this.agent=agent;
    this.expectedVersion=expectedVersion;
  }
  getStatus(){return Object.freeze({status:this.#status,configured:this.#status==='CONNECTED',error:this.#lastError});}
  async checkConnection(){
    if(!this.agent){this.#status='UNCONFIGURED';return this.getStatus();}
    try{
      const response=await this.agent.checkConnection();
      const validVersion=!this.expectedVersion ||
        response?.version===this.expectedVersion;
      this.#status=response?.connected===true&&validVersion?
        'CONNECTED':'DISCONNECTED';
      this.#lastError=this.#status==='CONNECTED'?'':
        (!validVersion?'AGENT_VERSION_MISMATCH':'AGENT_NOT_CONNECTED');
    }catch(error){this.#status='DISCONNECTED';this.#lastError=error?.message||'NETWORK_UNAVAILABLE';}
    return this.getStatus();
  }
  listRules(){return this.#rules.map(r=>({...r}));}
  // Rules shown in browser are advisory; PLA must independently enforce them.
  setRules(rules){if(!Array.isArray(rules))throw new TypeError('rules');this.#rules=rules.map(r=>({...r}));}
  previewPermission(request){return evaluateCommand({...request,rules:this.#rules});}
  async executeCommand(request){
    if(this.#status!=='CONNECTED'||!this.agent) return {ok:false,code:503,message:'LOCAL_AGENT_UNAVAILABLE'};
    // Never trust client-side permission preview as authorization.
    return this.agent.executeAuthorized(request);
  }
  async revokeLocalAccess(){
    if(!this.agent){this.#status='UNCONFIGURED';return {ok:false,code:503};}
    try{return await this.agent.revokeLocalAccess();}
    finally{this.#status='DISCONNECTED';}
  }
}
