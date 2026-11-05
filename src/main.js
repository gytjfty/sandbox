import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { AtlasRobotKernel } from './physics/robotKernel.js';
import { AtlasMaterialFoundation, AtlasMaterialFoundationTests } from './materials/materialFoundation.js';

window.AtlasRobotKernel = AtlasRobotKernel;
window.AtlasMaterialFoundation = AtlasMaterialFoundation;
window.AtlasMaterialFoundationTests = AtlasMaterialFoundationTests;

const RK = AtlasRobotKernel;
const MF = AtlasMaterialFoundation;

const $=id=>document.getElementById(id), LY=9460730472580800, AU=149597870700, R=46.5e9*LY, LEGACY='atlas-consistency-v4', NEW='atlas-populations-v5', SESSIONKEY='atlas-active-universe-v2';

function withPlanetGravity(body) {
  const giant=body.planetCategory==='giant-size proxy'||body.radius>=15000000;
  const density=giant?1300:5500;
  const mass=4*Math.PI*body.radius**3*density/3;
  return {
    ...body, mass, densityKgM3:density, gravityModel:'density-proxy-v1',
    surfaceGravity:6.67430e-11*mass/body.radius**2
  };
}

function gravityVectorAt(position, sources) {
  let result=[0, 0, 0];
  for(const source of sources) {
    const d=sub(source.position, position), r=norm(d);
    if(!(r>0)||!(source.mass>0))throw Error('Invalid gravity source or singular state.');
    result=add(result, scale(d, G*source.mass/(r*r*r)));
  }
  if(!finiteVector(result))throw Error('Nonfinite gravitational acceleration.');
  return result;
}

function integrateLocalGravity(initial, start, end, sourceAt, thrust=[0, 0, 0], budget=1024) {
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw Error('Invalid gravity integration interval.');
  let state={
    position:initial.position.slice(), velocity:initial.velocity.slice(),
    contact:initial.contact?structuredClone(initial.contact):null
  };
  let t=start, steps=0;
  if(state.contact&&norm(thrust)>0){
    state.position=add(state.position, scale(state.contact.normal, .05));
    state.contact=null;
  }
  while(t<end) {
    if(++steps>budget)throw Error('Gravity step budget exceeded.');
    const sources=sourceAt(t);
    if(state.contact) {
      const source=sourceAt(end).find(b=>b.id===state.contact.bodyId);
      if(!source||source.kind!=='planet')throw Error('Contact source no longer exists.');
      state.position=add(source.position, scale(state.contact.normal, source.radius+2));
      state.velocity=source.velocity.slice();
      t=end;
      break;
    }
    let h=Math.min(2, end-t);
    for(const source of sources) {
      const distance=norm(sub(state.position, source.position));
      if(!(distance>0))throw Error('Gravity singularity.');
      h=Math.min(h, .025*Math.sqrt(distance**3/(G*source.mass)));
    }
    if(!(h>0)||!Number.isFinite(h)||t+h===t)throw Error('Gravity timestep below numerical resolution.');
    const a0=add(gravityVectorAt(state.position, sources), thrust);
    const halfVelocity=add(state.velocity, scale(a0, h/2));
    const nextPosition=add(state.position, scale(halfVelocity, h));
    const nextSources=sourceAt(t+h);
    let hit=null;
    for(let i=0; i<sources.length; i++) {
      const source=sources[i], next=nextSources.find(b=>b.id===source.id);
      const q=sub(state.position, source.position), q1=sub(nextPosition, next.position);
      const radius=source.radius+(source.kind==='planet'?2:0);
      let u=norm(q)<radius-1e-6?0:sphereEvent(q, sub(q1, q), [0, 0, 0], radius, true);
      if(u!==null&&(!hit||u<hit.u))hit={
        u, source, normal:normalized(add(q, scale(sub(q1, q), u)))
      };
    }
    if(hit) {
      if(hit.source.kind==='star')throw Error('Stellar surface reached.');
      state.contact={ bodyId:hit.source.id, normal:hit.normal };
      const source=sourceAt(t+h).find(b=>b.id===hit.source.id);
      state.position=add(source.position, scale(hit.normal, source.radius+2));
      state.velocity=source.velocity.slice();
    } else {
      const a1=add(gravityVectorAt(nextPosition, nextSources), thrust);
      state.position=nextPosition;
      state.velocity=add(halfVelocity, scale(a1, h/2));
    }
    if(!finiteVector(state.position)||!finiteVector(state.velocity)||norm(state.velocity)>1e7)
    throw Error('Gravity state outside finite safety limits.');
    t+=h;
  }
  return { ...state, steps };
}

function sessionConfig(mode){
  if(mode==='v4-planar')return{ mode, generation:LEGACY, layout:'legacy-planar-v1', observer:'atlas-inertial-save-v1', books:'atlas-bookmarks-v1', world:'atlas-world-events-v1' };
  let spatial=mode==='v5-spatial', s=spatial?'-spatial-v1':'';
  return{ mode:spatial?'v5-spatial':'v5-planar', generation:NEW, layout:spatial?'spatial-3d-v1':'legacy-planar-v1', observer:'atlas-observer-populations-v5'+s, books:'atlas-bookmarks-populations-v5'+s, world:'atlas-world-populations-v5'+s };
}

function chooseSession(store){
  let m=store.getItem(SESSIONKEY);
  if(['v4-planar', 'v5-planar', 'v5-spatial'].includes(m))return m;
  return'v5-spatial';
}

let MODE='v5-spatial';
try{ MODE=chooseSession(localStorage); }catch(e){}
const CFG=sessionConfig(MODE), VER=CFG.generation, LAYOUT=CFG.layout, KEY=CFG.observer, BOOKKEY=CFG.books, WORLDKEY=CFG.world, PLAYERKEY='atlas-physical-player-v1:'+MODE, NAVKEY='atlas-navigation-mode-v1:'+MODE, legacy=VER===LEGACY;

if($('presetSelect'))$('presetSelect').value=MODE;
if($('presetHUD'))$('presetHUD').textContent=MODE+' / '+LAYOUT;
if($('presetStatus'))$('presetStatus').textContent=MODE+' · independent Explorer / player / world saves';

const rootNode=(id, r, count, profile)=>({ id, c:[0, 0, 0], h:r, r, count, depth:0, ...(profile?{profile}:{}) });
const groot=g=>rootNode(g.id+'/stars', g.radius, g.stars, g.profile);
const world={ version:1, generation:VER, baselineLayout:LAYOUT, model:'circular-orbit-edits-v1', events:[], nextSeq:1 };

let persistence='NO EDITS YET', worldLoadFailed=false, storedRaw='';
const TAU=2*Math.PI, G=6.67430e-11;

function wrap(x){ return((x%TAU)+TAU)%TAU; }
function dot(a, b){ return a.reduce((s, x, i)=>s+x*b[i], 0); }
function cross(a, b){ return[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function norm(a){ return Math.hypot(...a); }
function scale(a, s){ return a.map(x=>x*s); }
function add(a, b){ return a.map((x, i)=>x+b[i]); }
function sub(a, b){ return a.map((x, i)=>x-b[i]); }
function normalized(a){ let n=norm(a); if(!(n>0))throw Error('Degenerate vector'); return scale(a, 1/n); }
function clamp(x){ return Math.max(-1, Math.min(1, x)); }
function finiteVector(v){ return Array.isArray(v)&&v.length===3&&v.every(Number.isFinite); }

function seeded(s){
  let x=2166136261;
  for(let c of s)x=Math.imul(x^c.charCodeAt(0), 16777619);
  return()=>{ x=(Math.imul(x, 1664525)+1013904223)>>>0; return x/4294967296; };
}

function classicalBasis(i, node, arg){
  let N=[Math.cos(node), 0, -Math.sin(node)], H=[Math.sin(node)*Math.sin(i), Math.cos(i), Math.cos(node)*Math.sin(i)], B=cross(H, N);
  return{ P:add(scale(N, Math.cos(arg)), scale(B, Math.sin(arg))), Q:add(scale(N, -Math.sin(arg)), scale(B, Math.cos(arg))) };
}

function classical(o){
  let H=normalized(cross(o.P, o.Q)), inc=Math.acos(clamp(H[1])), n=cross([0, 1, 0], H), equatorial=norm(n)<1e-10, N=equatorial?[1, 0, 0]:normalized(n);
  return{ inclination:inc, node:equatorial?0:wrap(Math.atan2(-N[2], N[0])), arg:wrap(Math.atan2(dot(o.P, cross(H, N)), dot(o.P, N))), H, equatorial, circular:o.e<1e-10 };
}

function baselineBasis(b, star, layout=LAYOUT){
  if(layout==='legacy-planar-v1')return{ P:[1, 0, 0], Q:[0, 0, 1] };
  let r=seeded(star.id+'/system-orientation-v1'), i=Math.acos(2*r()-1), node=TAU*r(), system=classicalBasis(i, node, 0), H=normalized(cross(system.P, system.Q)), p=seeded(b.id+'/relative-inclination-v1'), tilt=.08*p(), azimuth=TAU*p(), normal=normalized(add(scale(H, Math.cos(tilt)), scale(add(scale(system.P, Math.cos(azimuth)), scale(system.Q, Math.sin(azimuth))), Math.sin(tilt)))), P=normalized(sub(system.P, scale(normal, dot(system.P, normal))));
  return{ P, Q:normalized(cross(normal, P)) };
}

function selectOrbit(b, star, t, events=world.events, layout=LAYOUT){
  if(b.authored)return {a:b.a,e:0,P:[1,0,0],Q:[0,0,1],M0:0,epoch:0,event:null,modified:false};
  let ev=null;
  for(let e of events)if(e.objectId===b.id&&e.time<=t&&(!ev||e.time>ev.time||e.time===ev.time&&e.seq>ev.seq))ev=e;
  if(ev?.type==='orbit'){
    let basis, M0, e;
    if(ev.model==='kepler-3d-v1'){ basis={P:ev.P.slice(), Q:ev.Q.slice()}; M0=ev.M0; e=ev.e; }
    else{
      let old=ev.model==='circular-orbit-v1', omega=old?0:ev.omega, side=old?1:ev.direction;
      basis={ P:[Math.cos(omega), 0, Math.sin(omega)], Q:[-side*Math.sin(omega), 0, side*Math.cos(omega)] };
      M0=old?ev.angle:ev.M0; e=old?0:ev.e;
    }
    return{ a:ev.a, e, ...basis, M0, epoch:ev.time, event:ev, modified:true };
  }
  return{ a:b.a, e:0, ...baselineBasis(b, star, layout), M0:b.phase, epoch:0, event:ev, modified:false };
}

function solveKepler(M, e){
  M=wrap(M);
  let lo=0, hi=TAU, E=e<.8?M:Math.PI;
  for(let i=0;i<64;i++){
    let f=E-e*Math.sin(E)-M;
    if(Math.abs(f)<2e-14)return E;
    if(f>0)hi=E; else lo=E;
    let n=E-f/(1-e*Math.cos(E));
    E=n>lo&&n<hi?n:(lo+hi)/2;
  }
  return E;
}

function propagate(o, mu, t){
  let n=Math.sqrt(mu/o.a**3), M=wrap(o.M0+n*(t-o.epoch)), E=solveKepler(M, o.e), c=Math.cos(E), s=Math.sin(E), b=Math.sqrt(1-o.e*o.e), ed=n/(1-o.e*c);
  return{
    position:add(scale(o.P, o.a*(c-o.e)), scale(o.Q, o.a*b*s)),
    velocity:add(scale(o.P, -o.a*s*ed), scale(o.Q, o.a*b*c*ed)),
    orbit:{ ...o, n, M, E }
  };
}

function physical(b, star, t=time, events=world.events, layout=LAYOUT){
  if(b.authored&&b.kind==='planet'){
    const k=RK.orbit(t),n=Math.sqrt(G*star.mass/b.a**3);
    return {...k,orbit:{a:b.a,e:0,P:[1,0,0],Q:[0,0,1],M0:0,epoch:0,n,M:wrap(n*t),E:wrap(n*t),modified:false,event:null}};
  }
  return b.a?propagate(selectOrbit(b, star, t, events, layout), G*star.mass, t):{ position:[0, 0, 0], velocity:[0, 0, 0], orbit:null };
}

function stumpff(z){
  if(Math.abs(z)<.01){
    let C=.5, S=1/6, tc=C, ts=S;
    for(let k=1;k<18;k++){
      tc*=-z/((2*k+1)*(2*k+2)); ts*=-z/((2*k+2)*(2*k+3));
      C+=tc; S+=ts;
      if(Math.abs(tc)+Math.abs(ts)<1e-18)break;
    }
    return[C, S];
  }
  if(z>0){ let u=Math.sqrt(z); return[2*Math.sin(u/2)**2/z, (u-Math.sin(u))/u**3]; }
  let u=Math.sqrt(-z);
  if(u>700)return[Infinity, Infinity];
  return[2*Math.sinh(u/2)**2/(-z), (Math.sinh(u)-u)/u**3];
}

function universal(seed, mu, t){
  let L=norm(seed.position), V=Math.sqrt(mu/L), T=L/V, dt=(t-seed.epoch)/T;
  if(!(L>0)||!Number.isFinite(dt)||!(mu>0))throw Error('Invalid universal propagation state.');
  if(dt===0)return{ position:seed.position.slice(), velocity:seed.velocity.slice() };
  let r0=scale(seed.position, 1/L), v0=scale(seed.velocity, 1/V), alpha=2-dot(v0, v0), rv=dot(r0, v0);
  if(alpha>1e-12){
    let P=TAU/alpha**1.5;
    if(Math.abs(dt)>P/2)dt-=Math.round(dt/P)*P;
  }
  if(dt===0)return{ position:seed.position.slice(), velocity:seed.velocity.slice() };
  let sign=dt<0?-1:1, target=Math.abs(dt), rad=rv*sign;
  function evaluate(x){
    let z=alpha*x*x, [C, S]=stumpff(z);
    if(!Number.isFinite(C)||!Number.isFinite(S))return{ F:Infinity, D:Infinity };
    return{ F:rad*x*x*C+(1-alpha)*x*x*x*S+x-target, D:rad*x*(1-z*S)+(1-alpha)*x*x*C+1, C, S };
  }
  let lo=0, hi=Math.max(1, Math.log1p(target))/Math.sqrt(Math.max(1, Math.abs(alpha))), e=evaluate(hi), bracket=0;
  while(e.F<0&&bracket++<128){ hi*=2; e=evaluate(hi); }
  let x=Math.min(hi, Math.max(0, Math.abs(dt))), converged=false;
  for(let i=0;i<160;i++){
    e=evaluate(x);
    if(Number.isFinite(e.F)&&Math.abs(e.F)<=3e-15*Math.max(1e-100, target)){ converged=true; break; }
    if(e.F>0||!Number.isFinite(e.F))hi=x; else lo=x;
    let next=x-e.F/e.D;
    x=Number.isFinite(next)&&next>lo&&next<hi?next:(lo+hi)/2;
    if(hi-lo<3e-15*Math.max(1e-100, x)){ x=(lo+hi)/2; converged=true; break; }
  }
  let chi=sign*x, z=alpha*x*x, [C, S]=stumpff(z), f=1-x*x*C, g=dt-chi**3*S, r=add(scale(r0, f), scale(v0, g)), rr=norm(r), fd=(alpha*chi**3*S-chi)/rr, gd=1-x*x*C/rr, v=add(scale(r0, fd), scale(v0, gd));
  let position=scale(r, L), velocity=scale(v, V);
  return{ position, velocity };
}

function conicInfo(k, mu){
  let r=norm(k.position), v2=dot(k.velocity, k.velocity), energy=v2/2-mu/r, h=cross(k.position, k.velocity), hm=norm(h), ev=sub(scale(cross(k.velocity, h), 1/mu), scale(k.position, 1/r)), e=norm(ev), alpha=-2*energy/mu, a=alpha===0?Infinity:1/alpha, near=Math.abs(energy)/(mu/r)<1e-10, kind=near?'NEAR-PARABOLIC':energy<0?'ELLIPTIC':'HYPERBOLIC', periapsis=hm*hm/(mu*(1+e)), period=energy<0?TAU*Math.sqrt(a/mu)*a:Infinity;
  return{ r, speed:Math.sqrt(v2), energy, h, e, a, alpha, kind, near, periapsis, period, radialSpeed:dot(k.position, k.velocity)/r, inclination:Math.acos(clamp(h[1]/hm)), bound:energy<0 };
}

// Worker Initialization
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

// Scene Setup
const universe={ kind:'universe', name:'Spherical cosmic domain', root:rootNode(VER, R, 2000000000000) };
let levels=[universe], depth=0, position=new Float64Array([0, 0, R*1.2]), velocity=new T.Vector3(), speedScale=1e8*LY, yaw=0, pitch=0, time=0, rate=1, paused=false, unit=1e9*LY, locked=false, hud=true, nav=true, showOrbit=true, exposure=1.8, budget=1400, selected=null, navMode='EXPLORER';

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

// Phase 2 Surface Setup
const ROBOT_HOME={id:'atlas-authored-home-development-v1',version:1,rotationEnabled:false,terrain:'radial-solid-relief-v1',cellM:4,chunkM:64};
let robotWorld=null,robotState=null,robotSavedRevision=null,robotHome=null,robotLegacy=null,robotSaving=false,robotActionBusy=false,robotJump=false,robotAnchor=null,robotMessage='No robot world active',robotStreamMS=0;
const robotGround=new T.Group(),robotBody=new T.Group();scene.add(robotGround,robotBody);robotGround.visible=robotBody.visible=false;
const robotGroundMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
const robotMetal=new T.MeshStandardMaterial({color:0x899ba2,roughness:.6,metalness:.65});
const torso=new T.Mesh(new T.BoxGeometry(.48,.65,.28),robotMetal);torso.position.y=-.15;robotBody.add(torso);
for(const side of [-1,1]){const arm=new T.Mesh(new T.BoxGeometry(.14,.65,.14),robotMetal);arm.position.set(side*.34,-.16,0);robotBody.add(arm);const leg=new T.Mesh(new T.BoxGeometry(.18,.5,.2),robotMetal);leg.position.set(side*.15,-.65,0);robotBody.add(leg);}

function clearRobotGround(){for(const m of [...robotGround.children]){robotGround.remove(m);m.geometry.dispose();}robotAnchor=null;}
function streamRobotGround(){
 if(robotAnchor&&RK.len(RK.sub(robotState.positionM,robotAnchor))<32)return;
 const start=performance.now(),anchor=RK.mul(RK.unit(robotState.positionM),RK.R),b=RK.basis(RK.unit(anchor)),next=[];
 try{
 for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++){
  const vertices=[],colors=[],indices=[];
  for(let j=0;j<=16;j++)for(let i=0;i<=16;i++){
   const n=RK.unit(RK.add(anchor,RK.add(RK.mul(b.east,x*64+(i-8)*4),RK.mul(b.north,z*64+(j-8)*4)))),p=RK.mul(n,RK.R+RK.height(n)),h=RK.height(n),tint=.035*Math.sin(p[0]/19)*Math.cos(p[2]/23);
   vertices.push(...RK.sub(p,anchor));colors.push((h>0?.19:.25)+tint,(h>0?.29:.28)+tint,(h>0?.12:.18)+tint);
  }
  for(let j=0;j<16;j++)for(let i=0;i<16;i++){const a=j*17+i,c=a+17;indices.push(a,a+1,c,a+1,c+1,c);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();const m=new T.Mesh(g,robotGroundMaterial);m.frustumCulled=false;m.userData.anchor=anchor;next.push(m);
 }
 clearRobotGround();for(const m of next)robotGround.add(m);robotAnchor=robotState.positionM.slice();robotStreamMS=performance.now()-start;
 }catch(e){for(const m of next)m.geometry.dispose();throw e;}
}

function robotCamera(){
 if(!robotState)return;
 const b=RK.viewBasis(robotState),f=RK.add(RK.mul(b.north,Math.cos(yaw)),RK.mul(b.east,Math.sin(yaw))),v=RK.add(RK.mul(f,Math.cos(pitch)),RK.mul(b.up,Math.sin(pitch)));
 camera.up.set(...b.up);camera.position.set(...RK.mul(b.up,.65));camera.lookAt(camera.position.clone().add(new T.Vector3(...v)));camera.updateMatrixWorld();
}

function robotVisuals(){
 for(const m of robotGround.children)m.position.set(...RK.sub(m.userData.anchor,robotState.positionM));
 robotBody.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...RK.unit(robotState.positionM)));robotGround.visible=robotBody.visible=true;
}

function advanceRobot(oldTime,newTime){
 if(rate!==1){rate=1;throw Error('Robot physics supports time x1 only');}
 const c=locked?{yaw,forward:(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),right:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),jump:robotJump}:{yaw};
 const prior=robotState;robotState=RK.step(prior,newTime-oldTime,oldTime,c);robotState.yaw=yaw;robotState.pitch=pitch;robotJump=false;
 streamRobotGround();
 const o=RK.orbit(newTime);position.set(RK.add(o.position,robotState.positionM));velocity.fromArray(RK.add(o.velocity,robotState.velocityMps));robotVisuals();
}

const keys=new Set();
document.addEventListener('keydown', e=>{ if(locked)keys.add(e.code); });
document.addEventListener('keyup', e=>keys.delete(e.code));

function tick(t){
  if(navMode==='ROBOT'&&robotState)advanceRobot(time, time+0.016);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

document.body.onclick = () => document.body.requestPointerLock();
document.addEventListener('pointerlockchange', ()=>{ locked=document.pointerLockElement===document.body; });

window.ready=true;
requestAnimationFrame(tick);