import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { AtlasRobotKernel } from './physics/robotKernel.js';
import { AtlasMaterialFoundation, AtlasMaterialFoundationTests } from './materials/materialFoundation.js';

window.AtlasRobotKernel = AtlasRobotKernel;
window.AtlasMaterialFoundation = AtlasMaterialFoundation;
window.AtlasMaterialFoundationTests = AtlasMaterialFoundationTests;

setTimeout(()=>{
  if(!window.ready)document.getElementById('error').textContent='Still initializing. Check Three.js internet, WebGL and Blob workers.'
}, 18000);

const $=id=>document.getElementById(id), LY=9460730472580800, AU=149597870700, R=46.5e9*LY, LEGACY='atlas-consistency-v4', NEW='atlas-populations-v5', SESSIONKEY='atlas-active-universe-v2';

function sessionConfig(mode){
  if(mode==='v4-planar')return{
    mode, generation:LEGACY, layout:'legacy-planar-v1', observer:'atlas-inertial-save-v1', books:'atlas-bookmarks-v1', world:'atlas-world-events-v1'
  };
  let spatial=mode==='v5-spatial', s=spatial?'-spatial-v1':'';
  return{
    mode:spatial?'v5-spatial':'v5-planar', generation:NEW, layout:spatial?'spatial-3d-v1':'legacy-planar-v1', observer:'atlas-observer-populations-v5'+s, books:'atlas-bookmarks-populations-v5'+s, world:'atlas-world-populations-v5'+s
  }
}function chooseSession(store){
  let m=store.getItem(SESSIONKEY);
  if(['v4-planar', 'v5-planar', 'v5-spatial'].includes(m))return m;
  return'v5-spatial'
}
let MODE='v5-spatial';
try{
  MODE=chooseSession(localStorage)
}catch(e){
}const CFG=sessionConfig(MODE), VER=CFG.generation, LAYOUT=CFG.layout, KEY=CFG.observer, BOOKKEY=CFG.books, WORLDKEY=CFG.world, PLAYERKEY='atlas-physical-player-v1:'+MODE, NAVKEY='atlas-navigation-mode-v1:'+MODE, legacy=VER===LEGACY;
if($('presetSelect'))$('presetSelect').value=MODE;
if($('presetHUD'))$('presetHUD').textContent=MODE+' / '+LAYOUT;
if($('presetStatus'))$('presetStatus').textContent=MODE+' · independent Explorer / player / world saves';

const rootNode=(id, r, count, profile)=>({
  id, c:[0, 0, 0], h:r, r, count, depth:0, ...(profile?{
    profile
  }:{
  })
}), groot=g=>rootNode(g.id+'/stars', g.radius, g.stars, g.profile), world={
  version:1, generation:VER, baselineLayout:LAYOUT, model:'circular-orbit-edits-v1', events:[], nextSeq:1
};
let persistence='NO EDITS YET', worldLoadFailed=false, storedRaw='';
try{
  let s=localStorage.getItem(WORLDKEY);
  if(s){
    storedRaw=s;
    let d=JSON.parse(s);
    if(d.version===1&&d.generation===VER&&d.baselineLayout===LAYOUT&&d.model==='circular-orbit-edits-v1'&&Array.isArray(d.events)&&Number.isInteger(d.nextSeq)){
      world.events=d.events;
      world.nextSeq=d.nextSeq;
      persistence='LOADED'
    }else{
      persistence='INVALID';
      worldLoadFailed=true
    }
  }
}catch(e){
  persistence='READ ERROR';
  worldLoadFailed=true
}
const TAU=2*Math.PI, G=6.67430e-11;
function wrap(x){ return((x%TAU)+TAU)%TAU }
function dot(a, b){ return a.reduce((s, x, i)=>s+x*b[i], 0) }
function cross(a, b){ return[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]] }
function norm(a){ return Math.hypot(...a) }
function scale(a, s){ return a.map(x=>x*s) }
function add(a, b){ return a.map((x, i)=>x+b[i]) }
function sub(a, b){ return a.map((x, i)=>x-b[i]) }
function normalized(a){ let n=norm(a); if(!(n>0))throw Error('Degenerate vector'); return scale(a, 1/n) }
function clamp(x){ return Math.max(-1, Math.min(1, x)) }
function finiteVector(v){ return Array.isArray(v)&&v.length===3&&v.every(Number.isFinite) }

function seeded(s){
  let x=2166136261;
  for(let c of s)x=Math.imul(x^c.charCodeAt(0), 16777619);
  return()=>{
    x=(Math.imul(x, 1664525)+1013904223)>>>0;
    return x/4294967296
  }
}

const worker = new Worker(new URL('./worker/universeWorker.js', import.meta.url), { type: 'module' });
let rid=0, pending=new Map(), workerMS=0;
function ask(type, data={}){
  return new Promise((resolve, reject)=>{
    let id=++rid;
    pending.set(id, {resolve, reject});
    worker.postMessage({id, type, ...data});
  });
}
worker.onmessage=e=>{
  let m=e.data, p=pending.get(m.id);
  if(!p)return;
  pending.delete(m.id);
  if(m.error)p.reject(Error(m.error));
  else{ workerMS=m.ms; p.resolve(m.result); }
};

const scene=new T.Scene();
scene.background=new T.Color(0x010309);
const renderer=new T.WebGLRenderer({ antialias:true, logarithmicDepthBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const camera=new T.PerspectiveCamera(65, innerWidth/innerHeight, 1e-12, 1e13);
camera.rotation.order='YXZ';
scene.add(new T.AmbientLight(0xc2daee, 1.2));
const light=new T.PointLight(0xffebcf, 3, 0, 0);
scene.add(light);

const ROBOT_HOME={id:'atlas-authored-home-development-v1',version:1,rotationEnabled:false,terrain:'radial-solid-relief-v1',cellM:4,chunkM:64};
let robotWorld=null,robotState=null,robotSavedRevision=null,robotHome=null,robotLegacy=null,robotSaving=false,robotActionBusy=false,robotJump=false,robotAnchor=null,robotMessage='No robot world active',robotStreamMS=0;
const robotGround=new T.Group(),robotBody=new T.Group();scene.add(robotGround,robotBody);robotGround.visible=robotBody.visible=false;
const robotGroundMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
const robotMetal=new T.MeshStandardMaterial({color:0x899ba2,roughness:.6,metalness:.65});
const torso=new T.Mesh(new T.BoxGeometry(.48,.65,.28),robotMetal);torso.position.y=-.15;robotBody.add(torso);
for(const side of [-1,1]){const arm=new T.Mesh(new T.BoxGeometry(.14,.65,.14),robotMetal);arm.position.set(side*.34,-.16,0);robotBody.add(arm);const leg=new T.Mesh(new T.BoxGeometry(.18,.5,.2),robotMetal);leg.position.set(side*.15,-.65,0);robotBody.add(leg);}

const keys=new Set();
document.addEventListener('keydown', e=>{ keys.add(e.code); });
document.addEventListener('keyup', e=>keys.delete(e.code));

function tick(t){
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

document.body.onclick = () => document.body.requestPointerLock();
window.ready=true;
requestAnimationFrame(tick);

(function(){
 const gate=document.querySelector('#gate article');
 if(!gate)return;
 const section=document.createElement('div');section.className='box';section.style.marginTop='16px';
 section.innerHTML='<h2>ROBOT WORLD — PHASE 2 DEVELOPMENT</h2><p>Earth-sized development planet surface physics, grounded walk/run/jump movement.</p>';
 gate.appendChild(section);
})();