/* Atlas material/physics foundation v1. Additive contracts only. */
const root = globalThis;
'use strict';
const CONTRACT='atlas-material-world-v1', DB='atlas-material-worlds-v1';
const Q=1000000;
const copy=x=>JSON.parse(JSON.stringify(x));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const finite=(n,m)=>assert(Number.isFinite(n),m||'Expected finite number');
const vec=v=>assert(Array.isArray(v)&&v.length===3&&v.every(Number.isFinite),'Expected finite 3-vector');
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
const identity=()=>[1,0,0,0,1,0,0,0,1];
const apply=(r,v)=>[dot(r.slice(0,3),v),dot(r.slice(3,6),v),dot(r.slice(6,9),v)];
const transpose=r=>[r[0],r[3],r[6],r[1],r[4],r[7],r[2],r[5],r[8]];
function rotation(r){
 assert(Array.isArray(r)&&r.length===9&&r.every(Number.isFinite),'Invalid rotation');
 const a=r.slice(0,3),b=r.slice(3,6),c=r.slice(6,9);
 for(const v of [a,b,c])assert(Math.abs(dot(v,v)-1)<1e-9,'Rotation is not orthonormal');
 assert(Math.abs(dot(a,b))+Math.abs(dot(a,c))+Math.abs(dot(b,c))<1e-9,'Rotation axes not perpendicular');
 const det=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
 assert(Math.abs(det-1)<1e-9,'Rotation must be right handed');
}
function toParent(frame,state){
 vec(frame.originM);vec(frame.velocityMps);rotation(frame.rotation);vec(state.positionM);vec(state.velocityMps);
 assert(frame.rotationEnabled===false,'Rotating frames not implemented');
 return {positionM:add(frame.originM,apply(frame.rotation,state.positionM)),velocityMps:add(frame.velocityMps,apply(frame.rotation,state.velocityMps))};
}
function fromParent(frame,state){
 rotation(frame.rotation);vec(frame.originM);vec(frame.velocityMps);vec(state.positionM);vec(state.velocityMps);
 assert(frame.rotationEnabled===false,'Rotating frames not implemented');
 return {positionM:apply(transpose(frame.rotation),sub(state.positionM,frame.originM)),velocityMps:apply(transpose(frame.rotation),sub(state.velocityMps,frame.velocityMps))};
}
function rebase(state,oldOriginM,newOriginM){
 vec(state.positionM);vec(state.velocityMps);vec(oldOriginM);vec(newOriginM);
 return {positionM:add(state.positionM,sub(oldOriginM,newOriginM)),velocityMps:state.velocityMps.slice()};
}
function massUnits(kg){finite(kg);assert(kg>=0,'Negative mass');const n=Math.round(kg*Q);assert(Number.isSafeInteger(n),'Mass exceeds supported precision');assert(Math.abs(n/Q-kg)<1e-12,'Mass must be an exact multiple of one microkilogram');return n;}
function composition(c){
 assert(c&&['known','unknown'].includes(c.knowledge),'Composition knowledge required');
 assert(c.basis==='mass-fraction','Composition basis must be explicit mass-fraction');
 assert(c.fractions&&typeof c.fractions==='object'&&!Array.isArray(c.fractions),'Missing fractions');
 let sum=0;
 for(const [id,v] of Object.entries(c.fractions)){assert(id&&Number.isFinite(v)&&v>=0&&v<=1,'Invalid mass fraction');sum+=v;}
 if(c.knowledge==='known')assert(Math.abs(sum-1)<1e-9,'Known mixture must sum to one');
 else assert(sum<=1+1e-9,'Partial composition exceeds one');
}
const elements={
 O:{id:'O',name:'Oxygen',molarMassKgPerMol:0.015999},
 Si:{id:'Si',name:'Silicon',molarMassKgPerMol:0.028085}
};
const materials={
 'dev-silica-stone-v1':{id:'dev-silica-stone-v1',name:'Development silica stone',densityKgM3:2650,
 composition:{knowledge:'known',basis:'mass-fraction',fractions:{Si:0.028085/(0.028085+2*0.015999),O:2*0.015999/(0.028085+2*0.015999)}},
 properties:{implemented:['density','composition'],strength:null,thermal:null},
 provenance:'Provisional development fixture: idealized SiO2, assigned bulk density; not approved home geology.'}
};
function elementInspection(materialId,kg,elementId){
 const m=materials[materialId];assert(m,'Unknown material');finite(kg);assert(kg>=0,'Negative mass');
 const c=m.composition, f=c.fractions[elementId];
 if(f===undefined&&c.knowledge==='unknown')return {knowledge:'unknown',massKg:null,moles:null,estimatedAtoms:null};
 const e=elements[elementId],massKg=kg*(f||0),moles=e?massKg/e.molarMassKgPerMol:null;
 return {knowledge:'known',massKg,moles,estimatedAtoms:moles===null?null:moles*6.02214076e23};
}
function validateSolid(g,depth=0,budget={n:0}){
 assert(g&&++budget.n<=256&&depth<=24,'Geometry complexity exceeded');
 if(g.op==='union'||g.op==='subtract'){
  assert(Array.isArray(g.children)&&g.children.length>=2&&g.children.length<=32,'Invalid CSG children');
  if(g.op==='subtract')assert(g.children.length===2,'Subtraction is binary');
  for(const c of g.children)validateSolid(c,depth+1,budget);
 }else{
  assert(['box','sphere','cylinder'].includes(g.kind),'Unsupported primitive');
  vec(g.centerM);rotation(g.rotation);
  const dims=g.kind==='box'?g.sizeM:g.kind==='sphere'?[g.radiusM*2]:[g.radiusM*2,g.heightM];
  assert(Array.isArray(dims)&&dims.length===(g.kind==='box'?3:g.kind==='sphere'?1:2)&&dims.every(x=>Number.isFinite(x)&&x>=.02&&x<=1000),'Feature size must be 0.02–1000 m');
 }
 return g;
}
function contains(g,point){
 vec(point);
 if(g.op==='union')return g.children.some(c=>contains(c,point));
 if(g.op==='subtract')return contains(g.children[0],point)&&!contains(g.children[1],point);
 const p=apply(transpose(g.rotation),sub(point,g.centerM));
 if(g.kind==='box')return p.every((x,i)=>Math.abs(x)<=g.sizeM[i]/2);
 if(g.kind==='sphere')return dot(p,p)<=g.radiusM*g.radiusM;
 return p[0]*p[0]+p[2]*p[2]<=g.radiusM*g.radiusM&&Math.abs(p[1])<=g.heightM/2;
}
function analyticVolume(g){
 validateSolid(g);
 if(g.op)return {volumeM3:null,status:'requires-authoritative-solid-evaluation'};
 return {volumeM3:g.kind==='box'?g.sizeM.reduce((a,b)=>a*b,1):g.kind==='sphere'?4*Math.PI*g.radiusM**3/3:Math.PI*g.radiusM**2*g.heightM,status:'analytic'};
}
function newWorld(id){
 assert(typeof id==='string'&&/^mw-[a-zA-Z0-9-]{8,100}$/.test(id),'Use an independent material-world identity');
 return {contract:CONTRACT,worldId:id,revision:0,timeS:0,
 units:{length:'m',time:'s',mass:'kg',accountingQuantumKg:1/Q,compositionBasis:'mass-fraction'},
 homeSystem:{status:'unconfigured',definitionVersion:null,definition:null,rotationEnabled:false},
 robot:{id:id+'/robot',status:'unspawned',bodyId:null},
 definitions:{elements:copy(elements),materials:copy(materials)},
 batches:{},containers:{},solids:{},bodies:{},connections:{},tools:{},blueprints:{},workOrders:{},terrainEdits:{},
 frames:{},receipts:{},remainderUnits:{},audit:{introducedUnits:0}};
}
function safeAmount(n){assert(Number.isSafeInteger(n)&&n>=0,'Invalid accounting amount');}
function validWorld(w){
 assert(w&&w.contract===CONTRACT&&/^mw-[a-zA-Z0-9-]{8,100}$/.test(w.worldId),'Incompatible save contract');
 assert(Number.isSafeInteger(w.revision)&&w.revision>=0&&Number.isFinite(w.timeS)&&w.timeS>=0,'Invalid revision/time');
 assert(w.units?.accountingQuantumKg===1/Q&&w.units.length==='m'&&w.units.time==='s'&&w.units.mass==='kg'&&w.units.compositionBasis==='mass-fraction','Incompatible units');
 assert(w.homeSystem?.rotationEnabled===false,'Planet rotation unsupported');
 assert(w.robot?.id===w.worldId+'/robot','Robot identity mismatch');
 for(const key of ['batches','containers','solids','bodies','connections','tools','blueprints','workOrders','terrainEdits','frames','receipts','remainderUnits'])assert(w[key]&&typeof w[key]==='object'&&!Array.isArray(w[key]),'Missing record store: '+key);
 assert(w.definitions?.elements&&w.definitions?.materials,'Missing definitions');
 for(const [id,m] of Object.entries(w.definitions.materials)){assert(m.id===id&&Number.isFinite(m.densityKgM3)&&m.densityKgM3>0,'Invalid material definition');composition(m.composition);for(const e of Object.keys(m.composition.fractions))assert(w.definitions.elements[e],'Unknown element');}
 let total=0;const capacities={};
 for(const [id,c] of Object.entries(w.containers)){assert(c.id===id,'Container identity mismatch');safeAmount(c.capacityUnits);capacities[id]=0;}
 for(const [id,b] of Object.entries(w.batches)){
  assert(b.id===id&&w.definitions.materials[b.materialId]&&w.containers[b.containerId],'Invalid batch reference');safeAmount(b.massUnits);safeAmount(b.reservedUnits);assert(b.reservedUnits<=b.massUnits,'Overreserved batch');
  assert(typeof b.state?.phase==='string','Batch physical state required');total+=b.massUnits;capacities[b.containerId]+=b.massUnits;
 }
 for(const [id,n] of Object.entries(capacities))assert(n<=w.containers[id].capacityUnits,'Container overflow');
 for(const r of Object.values(w.remainderUnits)){assert(Number.isFinite(r)&&r>=0&&r<1,'Invalid fractional mass remainder');total+=r;}
 safeAmount(w.audit?.introducedUnits);assert(Number.isFinite(total)&&total>=0&&total<=Number.MAX_SAFE_INTEGER,'Invalid total');
 assert(Math.abs(total-w.audit.introducedUnits)<1e-6,'Material conservation failure');
 for(const g of Object.values(w.solids))validateSolid(g.definition);
 for(const b of Object.values(w.bodies)){
  assert(w.solids[b.solidId],'Dangling body geometry');vec(b.positionM);vec(b.velocityMps);
  assert(Array.isArray(b.batchIds)&&b.batchIds.every(id=>w.batches[id]),'Dangling body batch');
 }
 for(const c of Object.values(w.connections))assert(c.kind==='rigid-unbreakable'&&w.bodies[c.bodyA]&&w.bodies[c.bodyB]&&c.bodyA!==c.bodyB,'Invalid connection');
 for(const b of Object.values(w.blueprints)){
  assert(b.version===1&&w.solids[b.solidId],'Invalid blueprint geometry');
  assert(Array.isArray(b.materialIds)&&b.materialIds.every(id=>w.definitions.materials[id]),'Invalid blueprint material');
 }
 const reservations={};
 for(const o of Object.values(w.workOrders)){
  assert(w.blueprints[o.blueprintId]&&['preview','validated','supplied','executing','blocked','complete','canceled'].includes(o.stage),'Invalid work order');
  assert(Array.isArray(o.reservations),'Missing work reservations');
  for(const r of o.reservations){assert(w.batches[r.batchId],'Dangling reservation');safeAmount(r.units);reservations[r.batchId]=(reservations[r.batchId]||0)+r.units;}
 }
 for(const b of Object.values(w.batches))assert((reservations[b.id]||0)===b.reservedUnits,'Reservation ledger mismatch');
 for(const f of Object.values(w.frames)){vec(f.originM);vec(f.velocityMps);rotation(f.rotation);assert(f.rotationEnabled===false,'Rotating frame unsupported');}
 return w;
}
function transact(w,operationId,request,mutate){
 validWorld(w);assert(typeof operationId==='string'&&operationId.length>0&&operationId.length<200,'Operation ID required');
 const signature=JSON.stringify(request);
 if(w.receipts[operationId]){
  assert(w.receipts[operationId].signature===signature,'Operation ID reused with different request');
  return {world:copy(w),result:copy(w.receipts[operationId].result),replayed:true};
 }
 const next=copy(w),result=mutate(next);next.revision++;
 next.receipts[operationId]={signature,result:copy(result??null)};
 validWorld(next);return {world:next,result,replayed:false};
}
function transfer(w,op,batchId,destinationId,kg,newBatchId){
 const units=massUnits(kg);
 return transact(w,op,{kind:'transfer',batchId,destinationId,units,newBatchId},n=>{
  const b=n.batches[batchId];assert(b&&n.containers[destinationId],'Missing transfer endpoint');
  assert(typeof newBatchId==='string'&&newBatchId&&!n.batches[newBatchId],'New batch identity must be unique');
  assert(units>0&&b.massUnits-b.reservedUnits>=units,'Insufficient unreserved material');
  b.massUnits-=units;n.batches[newBatchId]={...copy(b),id:newBatchId,containerId:destinationId,massUnits:units,reservedUnits:0};
  return {batchId:newBatchId,transferredKg:units/Q};
 });
}
function reserve(w,op,orderId,batchId,kg){
 const units=massUnits(kg);
 return transact(w,op,{kind:'reserve',orderId,batchId,units},n=>{
  const o=n.workOrders[orderId],b=n.batches[batchId];assert(o&&b,'Missing order/batch');
  assert(['validated','supplied','blocked'].includes(o.stage),'Order cannot accept supply');
  assert(units>0&&b.massUnits-b.reservedUnits>=units,'Insufficient available mass');
  b.reservedUnits+=units;o.reservations.push({batchId,units});o.stage='supplied';return {reservedKg:units/Q};
 });
}
function snapshot(w){
 validWorld(w);
 return {manifest:{contract:CONTRACT,worldId:w.worldId,revision:w.revision,timeS:w.timeS,snapshotId:w.worldId+':'+w.revision},world:copy(w)};
}
function restore(envelope){
 const w=validWorld(copy(envelope?.world)),m=envelope.manifest;
 assert(m&&m.contract===CONTRACT&&m.worldId===w.worldId&&m.revision===w.revision&&m.timeS===w.timeS&&m.snapshotId===w.worldId+':'+w.revision,'Snapshot manifest mismatch');return w;
}
function openDB(){
 return new Promise((resolve,reject)=>{
  assert(root.indexedDB,'IndexedDB unavailable; legacy storage will not be used as fallback');
  const req=root.indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{const d=req.result;d.createObjectStore('snapshots');d.createObjectStore('heads');};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  req.onblocked=()=>reject(new Error('Database upgrade blocked by another tab'));
 });
}
async function save(w,expectedRevision){
 const envelope=snapshot(w),db=await openDB();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['snapshots','heads'],'readwrite');let failure;
  tx.oncomplete=()=>resolve(copy(envelope.manifest));tx.onabort=()=>reject(failure||tx.error||new Error('Save aborted'));tx.onerror=()=>{};
  const heads=tx.objectStore('heads'),req=heads.get(w.worldId);
  req.onsuccess=()=>{
   const head=req.result;
   if((head?.revision??null)!==expectedRevision){failure=new Error('Stale save: reload or create an explicit branch');tx.abort();return;}
   if(head&&w.revision<=head.revision){failure=new Error('Revision must advance');tx.abort();return;}
   tx.objectStore('snapshots').add(envelope,envelope.manifest.snapshotId);heads.put(envelope.manifest,w.worldId);
  };
 });}finally{db.close();}
}
async function load(worldId){
 const db=await openDB();try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['snapshots','heads'],'readonly');let value=null;
  tx.oncomplete=()=>{try{resolve(value?restore(value):null)}catch(e){reject(e)}};tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};
  const req=tx.objectStore('heads').get(worldId);
  req.onsuccess=()=>{if(req.result){const r=tx.objectStore('snapshots').get(req.result.snapshotId);r.onsuccess=()=>{value=r.result;if(!value)tx.abort();};}};
 });}finally{db.close();}
}
const AtlasMaterialFoundation=Object.freeze({contract:CONTRACT,databaseName:DB,massQuantumKg:1/Q,
 newWorld,validWorld,massUnits,elementInspection,validateSolid,contains,analyticVolume,toParent,fromParent,rebase,identity,
 transact,transfer,reserve,snapshot,restore,save,load});

export { AtlasMaterialFoundation };
export default AtlasMaterialFoundation;
