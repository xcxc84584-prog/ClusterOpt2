// v0.0.60 PPMU: pure, fail-closed policy evaluation. No OS execution here.
export const CRUD = Object.freeze({CREATE:8,READ:4,UPDATE:2,DELETE:1});
export const LEVEL = Object.freeze({DENY:'DENY',READ_ONLY:'READ_ONLY',CUSTOM:'CUSTOM',REQUESTABLE:'REQUESTABLE',FULL:'FULL'});
export function parseCrud(bits){
  if(typeof bits!=='string'||!/^[01]{4}$/.test(bits)) throw new TypeError('CRUD must be four binary digits');
  return parseInt(bits,2);
}
export function normalizeCommandName(name){
  if(typeof name!=='string'||!/^[a-z][a-z0-9_-]*$/i.test(name)) return null;
  return name.toLowerCase();
}
export function matchCommand(pattern,name,mode='EXACT'){
  const n=normalizeCommandName(name);
  if(!n||typeof pattern!=='string') return false;
  if(pattern==='ALL') return true;
  const p=normalizeCommandName(pattern);
  if(!p) return false;
  return mode==='EXACT'?n===p:mode==='PREFIX'?n.startsWith(p):false;
}
export function permissionMask(rule){
  switch(rule.level){
    case LEVEL.DENY:return 0;
    case LEVEL.READ_ONLY:return CRUD.READ;
    case LEVEL.CUSTOM:return parseCrud(rule.crud);
    case LEVEL.REQUESTABLE:return CRUD.READ;
    case LEVEL.FULL:return 15;
    default:return 0;
  }
}
export function evaluateCommand({command,operation,rules=[],now=Date.now()}){
  if(!Number.isInteger(operation)||operation<1||operation>15) return {decision:'DENY',reason:'INVALID_OPERATION'};
  const name=normalizeCommandName(command);
  if(!name) return {decision:'DENY',reason:'UNSAFE_COMMAND_NAME'};
  const matching=rules.filter(r=>r&&r.targetType==='COMMAND'&&
    (!r.expiresAt||Date.parse(r.expiresAt)>now)&&
    matchCommand(r.pattern,name,r.matchMode));
  if(matching.some(r=>r.listType==='DENY'||r.level===LEVEL.DENY))
    return {decision:'DENY',reason:'BLACKLIST'};
  const grants=matching.filter(r=>r.listType==='ALLOW');
  if(grants.length===0) return {decision:(operation&~CRUD.READ)?'PENDING':'ALLOW',reason:'DEFAULT_REQUESTABLE'};
  // Intersection prevents one permissive rule overriding a restrictive rule.
  const mask=grants.reduce((m,r)=>m&permissionMask(r),15);
  if((operation&~mask)===0) return {decision:'ALLOW',reason:'RULE'};
  return {decision:grants.some(r=>r.level===LEVEL.REQUESTABLE)?'PENDING':'DENY',reason:'INSUFFICIENT_PERMISSION'};
}
