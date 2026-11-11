import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sphereUnits,validateWorld} from '../material.js';
import {stepPhysics,add,sub,scale as mul,dot,length,unit,cross} from '../physics.js';
const R=6371000;let cases=0;
function check(value,message){assert(value,message);cases++;}
function body(p,r=2,v=[0,0,0]){return {id:crypto.randomUUID(),p:p.slice(),r,units:sphereUnits(r),v:v.slice(),w:[0,0,0]};}
function bruteSphere(r){let n=0;for(let x=Math.floor(-r);x<Math.ceil(r);x++)for(let y=Math.floor(-r);y<Math.ceil(r);y++)for(let z=Math.floor(-r);z<Math.ceil(r);z++)if((x+.5)**2+(y+.5)**2+(z+.5)**2<=r*r)n++;return n;}
for(let i=0;i<45;i++){const r=1+i*.25;check(sphereUnits(r)===bruteSphere(r),'Local sphere accounting');}
const initial={kind:'cut',x:0,y:R-20,z:0,r:8,units:1000};const b=body([0,R+10,0]);const world={format:'earth-editor-v1',cellSize:1,density:2700,baselineCount:0,inventoryUnits:1000-b.units,ops:[initial],bodies:[b]};validateWorld(world);cases++;const moved=structuredClone(world);moved.bodies[0].p=[12345,R+200,993];moved.bodies[0].v=[1,2,3];validateWorld(moved);cases++;
const duplicated=structuredClone(world);duplicated.bodies.push({...b,id:crypto.randomUUID()});assert.throws(()=>validateWorld(duplicated),/ledger/);cases++;
const resized=structuredClone(world);resized.bodies[0].r=3;assert.throws(()=>validateWorld(resized),/material/);cases++;
const recovered=structuredClone(world);recovered.inventoryUnits+=recovered.bodies.pop().units;validateWorld(recovered);cases++;recovered.inventoryUnits+=b.units;assert.throws(()=>validateWorld(recovered),/ledger/);cases++;
const fall=body([0,20,0]),flat=p=>p[1];const g=()=>[0,-9.81,0];for(let i=0;i<60;i++)stepPhysics([fall],flat,1/120,null,g);check(Math.abs(fall.v[1]+4.905)<.00001,'Free fall velocity');for(let i=0;i<1800;i++)stepPhysics([fall],flat,1/120,null,g);check(Math.abs(fall.p[1]-fall.r)<.02,'Ground support');check(fall.units===sphereUnits(fall.r),'Fall preserves units');
const a=body([-1,100,0],1,[1,0,0]),c=body([1,100,0],1,[-1,0,0]);stepPhysics([a,c],()=>1e9,1/120,null,()=>[0,0,0]);check(Math.abs(a.v[0]+c.v[0])<1e-9,'Contact momentum');check(a.v[0]<0&&c.v[0]>0,'Contact separates');
const tower=Array.from({length:6},(_,i)=>body([i*.06,2.05+i*4,0]));const original=tower.map(p=>p.units),initialTop=tower.at(-1).p.slice();for(let i=0;i<2400;i++)stepPhysics(tower,flat,1/120,null,g);check(tower.every(p=>p.p.every(Number.isFinite)&&p.v.every(Number.isFinite)),'Tower finite');check(tower.every((p,i)=>p.units===original[i]),'Tower material invariant');check(tower.at(-1).p[1]<initialTop[1]-4,'Leaning tower collapses');
let posted;const wc={onmessage:null,postMessage:x=>posted=x,Math,Float64Array,Array};vm.createContext(wc);vm.runInContext(fs.readFileSync(new URL('../world-worker.js',import.meta.url),'utf8'),wc);
let seed=67891;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function inside(e,p){return (p[0]-e.x)**2+(p[1]-e.y)**2+(p[2]-e.z)**2<=e.r*e.r;}
function solid(p,ops){const base=p.reduce((s,v)=>s+v*v,0)<=R*R;for(let i=ops.length-1;i>=0;i--)if((!ops[i].clipToPlanet||base)&&inside(ops[i],p))return ops[i].kind==='fill';return base;}
function brute(e,ops){let n=0;for(let x=Math.floor(e.x-e.r);x<Math.ceil(e.x+e.r);x++)for(let y=Math.floor(e.y-e.r);y<Math.ceil(e.y+e.r);y++)for(let z=Math.floor(e.z-e.r);z<Math.ceil(e.z+e.r);z++){const p=[x+.5,y+.5,z+.5];if(inside(e,p)&&solid(p,ops)===(e.kind==='cut'))n++;}return n;}
const ops=[];for(let i=0;i<100;i++){const e={x:(random()-.5)*25,y:R-10+random()*25,z:(random()-.5)*25,r:2+random()*3,kind:i%3===0?'fill':'cut'},units=wc.measureChange(e,ops);check(units===brute(e,ops),'Terrain grid accounting');ops.push({...e,units});check(wc.measureChange(e,ops)===0,'Repeat transfer blocked');}
const clip={kind:'fill',x:0,y:R,z:0,r:4,clipToPlanet:true};check(!wc.solidAt(0,R+1,0,[clip]),'Legacy clip preserved');
wc.onmessage({data:{version:1,ops}});check(!posted.error&&posted.nodes.length>0,'BVH builds');

const planetBody=body([0,R+20,0]);for(let i=0;i<1200;i++)stepPhysics([planetBody],p=>Math.hypot(...p)-R,1/120);check(Math.abs(Math.hypot(...planetBody.p)-R-planetBody.r)<.02,'Radial planet contact');
const mainSource=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8'),qc={world:{ops,bodies:[]},R,BODY_RADIUS:.28,OFFSETS:[0,.44,.88,1.3],add,sub,mul,dot,length,unit,cross,Math};vm.createContext(qc);vm.runInContext(mainSource.slice(mainSource.indexOf('function terrainField'),mainSource.indexOf('function aimedBody')),qc);
function referenceRay(o,d){const list=[.001,1e9],a=Math.hypot(...o)-R,b=dot(o,d),c=a*(2*R+a),h=b*b-c;const put=t=>{if(t>.00101&&t<1e9)list.push(t);};if(h>=0){const root=Math.sqrt(h);put(c>0&&b<0?c/(-b+root):-b-root);put(-b+root);}for(const e of ops){const v=[e.x-o[0],e.y-o[1],e.z-o[2]],along=dot(v,d),p=sub(v,mul(d,along)),h=e.r*e.r-dot(p,p);if(h>=0){const root=Math.sqrt(h);put(along-root);put(along+root);}}list.sort((a,b)=>a-b);for(let i=0;i<list.length-1;i++){if(list[i+1]-list[i]<1e-8)continue;const t=(list[i]+list[i+1])/2;if(solid(add(o,mul(d,t)),ops))return list[i];}return null;}
for(let i=0;i<400;i++){const e=ops[i%ops.length],o=i%2?[e.x,e.y,e.z]:[(random()-.5)*50,R-20+random()*70,(random()-.5)*50],d=unit([random()-.5,random()-.5,random()-.5]),a=qc.terrainRay(o,d,1e9),b=referenceRay(o,d);check((a===null)===(b===null)&&(a===null||Math.abs(a-b)<.001),'Terrain picking');}
for(let i=0;i<300;i++){const p=[(random()-.5)*50,R-25+random()*70,(random()-.5)*50];check(qc.terrainSolid(p)===solid(p,ops),'Terrain state');check((qc.terrainField(p)<0)===solid(p,ops),'Terrain field sign');}
check(qc.sphereRay([0,0,-10],[0,0,1],[0,0,0],2)===8,'Physical sphere ray');

console.log(JSON.stringify({checks:cases,sphereLocalVolumeChecks:45,randomTerrainOperations:100,physicsSteps:5461,towerTopInitial:initialTop,towerTopAfter:tower.at(-1).p,towerMaterialUnits:tower.reduce((s,b)=>s+b.units,0),browserTested:false}));
