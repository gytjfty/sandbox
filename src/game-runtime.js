import AtlasRobotKernel from './players/robot-kernel.js';
import AtlasMaterialFoundation from './materials/foundation.js';
import { createPopulationWorker } from './universe/worker-client.js';

import * as T from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const $=id=>document.getElementById(id), LY=9460730472580800, AU=149597870700, R=46.5e9*LY, LEGACY='atlas-consistency-v4', NEW='atlas-populations-v5', SESSIONKEY='atlas-active-universe-v2';
// ============================================================================
// LOCAL GRAVITY FOUNDATION v1. Planet masses are synthetic density proxies.
// This helper consumes no random values: original IDs/radii/orbits are unchanged.
// ============================================================================
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
// Velocity Verlet / kick-drift-kick for a time-dependent prescribed source field.
// sourceAt returns fixed-star + analytically moving planets in star-centred metres.
// Collisions use moving-sphere swept tests. Planet contact is deliberately sticky;
// it dissipates relative velocity and follows translation (not planetary rotation).
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
    if(++steps>budget)throw Error('Gravity step budget exceeded. Clock paused without committing this frame; reduce time rate.');
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
    for(let i=0;
    i<sources.length;
    i++) {
      const source=sources[i], next=nextSources.find(b=>b.id===source.id);
      const q=sub(state.position, source.position), q1=sub(nextPosition, next.position);
      const radius=source.radius+(source.kind==='planet'?2:0);
      let u=norm(q)<radius-1e-6?0:sphereEvent(q, sub(q1, q), [0, 0, 0], radius, true);
      if(u!==null&&(!hit||u<hit.u))hit={
        u, source, normal:normalized(add(q, scale(sub(q1, q), u)))
      };
    }
    if(hit) {
      if(hit.source.kind==='star')throw Error('Stellar surface reached. Clock paused; no stellar collision/damage model.');
      state.contact={
        bodyId:hit.source.id, normal:hit.normal
      };
      const source=sourceAt(t+h).find(b=>b.id===hit.source.id);
      state.position=add(source.position, scale(hit.normal, source.radius+2));
      state.velocity=source.velocity.slice();
    } else {
      const a1=add(gravityVectorAt(nextPosition, nextSources), thrust);
      state.position=nextPosition;
      state.velocity=add(halfVelocity, scale(a1, h/2));
    }
    if(!finiteVector(state.position)||!finiteVector(state.velocity)||norm(state.velocity)>1e7)
    throw Error('Gravity state outside finite / 10,000 km/s safety limits.');
    t+=h;
  }
  return {
    ...state, steps
  };
}
function sessionConfig(mode){
  if(mode==='v4-planar')return{
    mode, generation:LEGACY, layout:'legacy-planar-v1', observer:'atlas-inertial-save-v1', books:'atlas-bookmarks-v1', world:'atlas-world-events-v1'
  };
  let spatial=mode==='v5-spatial', s=spatial?'-spatial-v1':'';
  return{
    mode:spatial?'v5-spatial':'v5-planar', generation:NEW, layout:spatial?'spatial-3d-v1':'legacy-planar-v1', observer:'atlas-observer-populations-v5'+s, books:'atlas-bookmarks-populations-v5'+s, world:'atlas-world-populations-v5'+s
  }
}
function chooseSession(store){
  let m=store.getItem(SESSIONKEY);
  if(['v4-planar', 'v5-planar', 'v5-spatial'].includes(m))return m;
  let old=store.getItem('atlas-active-generation-v1');
  if(old===LEGACY)return'v4-planar';
  if(old===NEW)return'v5-planar';
  if(store.getItem('atlas-inertial-save-v1')||store.getItem('atlas-world-events-v1')||store.getItem('atlas-bookmarks-v1'))return'v4-planar';
  if(store.getItem('atlas-observer-populations-v5')||store.getItem('atlas-world-populations-v5')||store.getItem('atlas-bookmarks-populations-v5'))return'v5-planar';
  return'v5-spatial'
}let MODE='v5-spatial';
try{
  MODE=chooseSession(localStorage)
}catch(e){
}const CFG=sessionConfig(MODE), VER=CFG.generation, LAYOUT=CFG.layout, KEY=CFG.observer, BOOKKEY=CFG.books, WORLDKEY=CFG.world, PLAYERKEY='atlas-physical-player-v1:'+MODE, NAVKEY='atlas-navigation-mode-v1:'+MODE, legacy=VER===LEGACY;
$('presetSelect').value=MODE;
$('presetHUD').textContent=MODE+' / '+LAYOUT;
$('presetStatus').textContent=MODE+' · independent Explorer / player / world saves';
const rootNode=(id, r, count, profile)=>({
  id, c:[0, 0, 0], h:r, r, count, depth:0, ...(profile?{
    profile
  }:{
  })
}), groot=g=>rootNode(g.id+'/stars', g.radius, g.stars, g.profile), world={
  version:1, generation:VER, baselineLayout:LAYOUT, model:'circular-orbit-edits-v1', events:[], nextSeq:1
};
let persistence='NO EDITS YET', worldLoadFailed=false, storedRaw='';
const TAU=2*Math.PI, G=6.67430e-11;
function wrap(x){
  return((x%TAU)+TAU)%TAU
}function dot(a, b){
  return a.reduce((s, x, i)=>s+x*b[i], 0)
}function cross(a, b){
  return[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
}function norm(a){
  return Math.hypot(...a)
}function scale(a, s){
  return a.map(x=>x*s)
}function add(a, b){
  return a.map((x, i)=>x+b[i])
}function sub(a, b){
  return a.map((x, i)=>x-b[i])
}function normalized(a){
  let n=norm(a);
  if(!(n>0))throw Error('Degenerate vector');
  return scale(a, 1/n)
}function clamp(x){
  return Math.max(-1, Math.min(1, x))
}function finiteVector(v){
  return Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)
}
function seeded(s){
  let x=2166136261;
  for(let c of s)x=Math.imul(x^c.charCodeAt(0), 16777619);
  return()=>{
    x=(Math.imul(x, 1664525)+1013904223)>>>0;
    return x/4294967296
  }
}
function classicalBasis(i, node, arg){
  let N=[Math.cos(node), 0, -Math.sin(node)], H=[Math.sin(node)*Math.sin(i), Math.cos(i), Math.cos(node)*Math.sin(i)], B=cross(H, N);
  return{
    P:add(scale(N, Math.cos(arg)), scale(B, Math.sin(arg))), Q:add(scale(N, -Math.sin(arg)), scale(B, Math.cos(arg)))
  }
}function classical(o){
  let H=normalized(cross(o.P, o.Q)), inc=Math.acos(clamp(H[1])), n=cross([0, 1, 0], H), equatorial=norm(n)<1e-10, N=equatorial?[1, 0, 0]:normalized(n);
  return{
    inclination:inc, node:equatorial?0:wrap(Math.atan2(-N[2], N[0])), arg:wrap(Math.atan2(dot(o.P, cross(H, N)), dot(o.P, N))), H, equatorial, circular:o.e<1e-10
  }
}
function baselineBasis(b, star, layout=LAYOUT){
  if(layout==='legacy-planar-v1')return{
    P:[1, 0, 0], Q:[0, 0, 1]
  };
  let r=seeded(star.id+'/system-orientation-v1'), i=Math.acos(2*r()-1), node=TAU*r(), system=classicalBasis(i, node, 0), H=normalized(cross(system.P, system.Q)), p=seeded(b.id+'/relative-inclination-v1'), tilt=.08*p(), azimuth=TAU*p(), normal=normalized(add(scale(H, Math.cos(tilt)), scale(add(scale(system.P, Math.cos(azimuth)), scale(system.Q, Math.sin(azimuth))), Math.sin(tilt)))), P=normalized(sub(system.P, scale(normal, dot(system.P, normal))));
  return{
    P, Q:normalized(cross(normal, P))
  }
}
function selectOrbit(b, star, t, events=world.events, layout=LAYOUT){
  if(b.authored)return {a:b.a,e:0,P:[1,0,0],Q:[0,0,1],M0:0,epoch:0,event:null,modified:false};
  let ev=null;
  for(let e of events)if(e.objectId===b.id&&e.time<=t&&(!ev||e.time>ev.time||e.time===ev.time&&e.seq>ev.seq))ev=e;
  if(ev?.type==='orbit'){
    let basis, M0, e;
    if(ev.model==='kepler-3d-v1'){
      basis={
        P:ev.P.slice(), Q:ev.Q.slice()
      };
      M0=ev.M0;
      e=ev.e
    }else{
      let old=ev.model==='circular-orbit-v1', omega=old?0:ev.omega, side=old?1:ev.direction;
      basis={
        P:[Math.cos(omega), 0, Math.sin(omega)], Q:[-side*Math.sin(omega), 0, side*Math.cos(omega)]
      };
      M0=old?ev.angle:ev.M0;
      e=old?0:ev.e
    }return{
      a:ev.a, e, ...basis, M0, epoch:ev.time, event:ev, modified:true
    }
  }return{
    a:b.a, e:0, ...baselineBasis(b, star, layout), M0:b.phase, epoch:0, event:ev, modified:false
  }
}
function solveKepler(M, e){
  M=wrap(M);
  let lo=0, hi=TAU, E=e<.8?M:Math.PI;
  for(let i=0;
  i<64;
  i++){
    let f=E-e*Math.sin(E)-M;
    if(Math.abs(f)<2e-14)return E;
    if(f>0)hi=E;
    else lo=E;
    let n=E-f/(1-e*Math.cos(E));
    E=n>lo&&n<hi?n:(lo+hi)/2
  }return E
}function propagate(o, mu, t){
  let n=Math.sqrt(mu/o.a**3), M=wrap(o.M0+n*(t-o.epoch)), E=solveKepler(M, o.e), c=Math.cos(E), s=Math.sin(E), b=Math.sqrt(1-o.e*o.e), ed=n/(1-o.e*c);
  return{
    position:add(scale(o.P, o.a*(c-o.e)), scale(o.Q, o.a*b*s)), velocity:add(scale(o.P, -o.a*s*ed), scale(o.Q, o.a*b*c*ed)), orbit:{
      ...o, n, M, E
    }
  }
}function physical(b, star, t=time, events=world.events, layout=LAYOUT){
  if(b.authored&&b.kind==='planet'){const k=RK.orbit(t),n=Math.sqrt(G*star.mass/b.a**3);return {...k,orbit:{a:b.a,e:0,P:[1,0,0],Q:[0,0,1],M0:0,epoch:0,n,M:wrap(n*t),E:wrap(n*t),modified:false,event:null}};}
  return b.a?propagate(selectOrbit(b, star, t, events, layout), G*star.mass, t):{
    position:[0, 0, 0], velocity:[0, 0, 0], orbit:null
  }
}
function fromState(p, v, mu, epoch){
  let r=norm(p), h=cross(p, v), hm=norm(h), energy=dot(v, v)/2-mu/r;
  if(!(r>0)||!Number.isFinite(energy)||energy>=0||hm<Math.sqrt(mu*r)*1e-10)throw Error('Planetary editor still supports bound nonradial ellipses only.');
  let a=-mu/(2*energy), H=scale(h, 1/hm), ev=sub(scale(cross(v, h), 1/mu), scale(p, 1/r)), e=norm(ev), P, Q, M0;
  if(e>=.999)throw Error('Planet eccentricity must remain below 0.999.');
  if(e<1e-10){
    e=0;
    P=scale(p, 1/r);
    Q=normalized(cross(H, P));
    M0=0
  }else{
    P=scale(ev, 1/e);
    Q=normalized(cross(H, P));
    let E=Math.atan2(dot(p, Q)/(a*Math.sqrt(1-e*e)), dot(p, P)/a+e);
    M0=wrap(E-e*Math.sin(E))
  }return{
    a, e, P, Q, M0, epoch
  }
}
function orbitCheck(o, b, star){
  if(!Number.isFinite(o.a)||o.a<.005*AU||o.a>10000*AU||!Number.isFinite(o.e)||o.e<0||o.e>=.999)throw Error('Planet editor: a=0.005–10,000 AU; 0≤e<0.999.');
  if(o.a*(1-o.e)<=star.radius+(b.radius||0))throw Error('Periapsis intersects star.');
  return o
}function validBasis(o){
  return[o.P, o.Q].every(v=>finiteVector(v)&&Math.abs(norm(v)-1)<1e-8)&&Math.abs(dot(o.P, o.Q))<1e-8
}
function stumpff(z){
  if(Math.abs(z)<.01){
    let C=.5, S=1/6, tc=C, ts=S;
    for(let k=1;
    k<18;
    k++){
      tc*=-z/((2*k+1)*(2*k+2));
      ts*=-z/((2*k+2)*(2*k+3));
      C+=tc;
      S+=ts;
      if(Math.abs(tc)+Math.abs(ts)<1e-18)break
    }return[C, S]
  }if(z>0){
    let u=Math.sqrt(z);
    return[2*Math.sin(u/2)**2/z, (u-Math.sin(u))/u**3]
  }let u=Math.sqrt(-z);
  if(u>700)return[Infinity, Infinity];
  return[2*Math.sinh(u/2)**2/(-z), (Math.sinh(u)-u)/u**3]
}
function universal(seed, mu, t){
  let L=norm(seed.position), V=Math.sqrt(mu/L), T=L/V, dt=(t-seed.epoch)/T;
  if(!(L>0)||!Number.isFinite(dt)||!(mu>0))throw Error('Invalid universal propagation state.');
  if(dt===0)return{
    position:seed.position.slice(), velocity:seed.velocity.slice()
  };
  let r0=scale(seed.position, 1/L), v0=scale(seed.velocity, 1/V), alpha=2-dot(v0, v0), rv=dot(r0, v0);
  if(alpha>1e-12){
    let P=TAU/alpha**1.5;
    if(Math.abs(dt)>P/2)dt-=Math.round(dt/P)*P
  }if(dt===0)return{
    position:seed.position.slice(), velocity:seed.velocity.slice()
  };
  let sign=dt<0?-1:1, target=Math.abs(dt), rad=rv*sign;
  function evaluate(x){
    let z=alpha*x*x, [C, S]=stumpff(z);
    if(!Number.isFinite(C)||!Number.isFinite(S))return{
      F:Infinity, D:Infinity
    };
    return{
      F:rad*x*x*C+(1-alpha)*x*x*x*S+x-target, D:rad*x*(1-z*S)+(1-alpha)*x*x*C+1, C, S
    }
  }
  let lo=0, hi=Math.max(1, Math.log1p(target))/Math.sqrt(Math.max(1, Math.abs(alpha))), e=evaluate(hi), bracket=0;
  while(e.F<0&&bracket++<128){
    hi*=2;
    e=evaluate(hi)
  }if(e.F<0)throw Error('Universal solver could not bracket time-of-flight.');
  let x=Math.min(hi, Math.max(0, Math.abs(dt))), converged=false;
  for(let i=0;
  i<160;
  i++){
    e=evaluate(x);
    if(Number.isFinite(e.F)&&Math.abs(e.F)<=3e-15*Math.max(1e-100, target)){
      converged=true;
      break
    }if(e.F>0||!Number.isFinite(e.F))hi=x;
    else lo=x;
    let next=x-e.F/e.D;
    x=Number.isFinite(next)&&next>lo&&next<hi?next:(lo+hi)/2;
    if(hi-lo<3e-15*Math.max(1e-100, x)){
      x=(lo+hi)/2;
      converged=true;
      break
    }
  }if(!converged)throw Error('Universal solver did not converge; simulation paused.');
  let chi=sign*x, z=alpha*x*x, [C, S]=stumpff(z), f=1-x*x*C, g=dt-chi**3*S, r=add(scale(r0, f), scale(v0, g)), rr=norm(r), fd=(alpha*chi**3*S-chi)/rr, gd=1-x*x*C/rr, v=add(scale(r0, fd), scale(v0, gd));
  let position=scale(r, L), velocity=scale(v, V);
  if(!finiteVector(position)||!finiteVector(velocity)||!(rr>0))throw Error('Nonfinite universal propagation result.');
  return{
    position, velocity
  }
}
function conicInfo(k, mu){
  let r=norm(k.position), v2=dot(k.velocity, k.velocity), energy=v2/2-mu/r, h=cross(k.position, k.velocity), hm=norm(h), ev=sub(scale(cross(k.velocity, h), 1/mu), scale(k.position, 1/r)), e=norm(ev), alpha=-2*energy/mu, a=alpha===0?Infinity:1/alpha, near=Math.abs(energy)/(mu/r)<1e-10, kind=near?'NEAR-PARABOLIC':energy<0?'ELLIPTIC':'HYPERBOLIC', periapsis=hm*hm/(mu*(1+e)), period=energy<0?TAU*Math.sqrt(a/mu)*a:Infinity;
  return{
    r, speed:Math.sqrt(v2), energy, h, e, a, alpha, kind, near, periapsis, period, radialSpeed:dot(k.position, k.velocity)/r, inclination:Math.acos(clamp(h[1]/hm)), bound:energy<0
  }
}
function safePlayerState(k, star){
  if(!finiteVector(k.position)||!finiteVector(k.velocity))throw Error('Player vectors must be finite.');
  if(norm(k.velocity)>1e7)throw Error('Player input speed exceeds the 10,000 km/s nonrelativistic/numerical safety cap.');
  let info=conicInfo(k, G*star.mass);
  if(!(info.r>star.radius)||!Number.isFinite(info.energy)||!Number.isFinite(info.periapsis)||norm(info.h)<Math.sqrt(G*star.mass*info.r)*1e-10)throw Error('Unsupported surface/radial/degenerate player state.');
  if(info.periapsis<=star.radius)throw Error('Star-intersecting conic rejected; no collision response.');
  return info
}
function velocityPulse(k, rd, td, nd){
  let R=normalized(k.position), N=normalized(cross(k.position, k.velocity)), T=cross(N, R), delta=add(scale(R, rd), add(scale(T, td), scale(N, nd)));
  return{
    position:k.position.slice(), velocity:add(k.velocity, delta), deltaVInertial:delta
  }
}
function modelTests(){
  let mu=G*1.98847e30, L=AU, V=Math.sqrt(mu/L), T=L/V, energyWorst=0, hWorst=0, reversalWorst=0, keplerWorst=0, fgCases=0;
  for(let radial of[0, .05])for(let speed of[.7, 1, Math.sqrt(2)*(1-1e-9), Math.sqrt(2), Math.sqrt(2)*(1+1e-9), 1.6, 2.5])for(let dt of[-100, -1, -.01, .01, 1, 100]){
    let seed={
      position:[L, 0, 0], velocity:[radial*V, 0, speed*V], epoch:0
    }, base=conicInfo(seed, mu), k=universal(seed, mu, dt*T), info=conicInfo(k, mu), back=universal({
      ...k, epoch:dt*T
    }, mu, 0);
    energyWorst=Math.max(energyWorst, Math.abs(info.energy-base.energy)/(mu/L));
    hWorst=Math.max(hWorst, norm(sub(info.h, base.h))/norm(base.h));
    reversalWorst=Math.max(reversalWorst, norm(sub(back.position, seed.position))/L, norm(sub(back.velocity, seed.velocity))/V);
    fgCases++
  }for(let e of[0, .3, .8, .95])for(let j=0;
  j<12;
  j++){
    let o={
      a:L, e, ...classicalBasis(.6, .8, .4), M0:TAU*j/12, epoch:0
    }, k0=propagate(o, mu, 0), seed={
      ...k0, epoch:0
    }, u=universal(seed, mu, 2.7*T), old=propagate(o, mu, 2.7*T);
    keplerWorst=Math.max(keplerWorst, norm(sub(u.position, old.position))/L, norm(sub(u.velocity, old.velocity))/V)
  }let seed={
    position:[L, 0, 0], velocity:[0, 0, V], epoch:0
  }, k=universal(seed, mu, T), pulse=velocityPulse(k, 0, .5*V, 0), unbound=conicInfo(pulse, mu), old=conicInfo(k, mu), par={
    position:[L, 0, 0], velocity:[0, 0, Math.sqrt(2)*V], epoch:0
  }, u=universal(par, mu, T), v=universal({
    ...u, epoch:T
  }, mu, 0), step=1e-8;
  let minus=universal({
    position:[L, 0, 0], velocity:[0, 0, Math.sqrt(2)*V*(1-step)], epoch:0
  }, mu, T), plus=universal({
    position:[L, 0, 0], velocity:[0, 0, Math.sqrt(2)*V*(1+step)], epoch:0
  }, mu, T);
  return{
    checks:{
      allConicPropagation:Number.isFinite(energyWorst), energy:energyWorst<1e-9, angularMomentum:hWorst<1e-9, timeReversal:reversalWorst<1e-8, legacyKeplerAgreement:keplerWorst<1e-9, escapePulseAccepted:old.bound&&!unbound.bound, impulsePositionContinuous:norm(sub(pulse.position, k.position))===0, parabolicReversal:norm(sub(v.position, par.position))/L<1e-9, boundaryContinuous:norm(sub(plus.position, minus.position))/L<1e-6
    }, metrics:{
      universalCases:fgCases, maxScaledEnergyError:energyWorst, maxRelativeAngularMomentumError:hWorst, maxScaledTimeReversalError:reversalWorst, maxScaledKeplerAgreementError:keplerWorst, boundaryPositionDifferenceOverAU:norm(sub(plus.position, minus.position))/L
    }
  }
}
function validateWorld(d){
  if(!d||d.version!==1||d.generation!==VER||(d.baselineLayout||'legacy-planar-v1')!==LAYOUT||d.model!=='circular-orbit-edits-v1'||!Array.isArray(d.events)||d.events.length>10000)throw Error('Wrong generation/layout or incompatible world');
  let seen=new Set();
  for(let e of d.events){
    if(!e||typeof e.objectId!=='string'||!e.objectId.startsWith(VER+'/')||e.objectId.length>1500||!/\/p[0-7]$/.test(e.objectId)||!Number.isSafeInteger(e.seq)||e.seq<1||seen.has(e.seq)||!Number.isFinite(e.time)||e.time<0||!['orbit', 'baseline'].includes(e.type)||!['circular-orbit-v1', 'kepler-orbit-v1', 'kepler-3d-v1'].includes(e.model))throw Error('Invalid event');
    if(e.type==='orbit'){
      if(!Number.isFinite(e.a)||e.a<.005*AU||e.a>10000*AU)throw Error('Invalid a');
      if(e.model==='circular-orbit-v1'){
        if(!Number.isFinite(e.angle)||Math.abs(e.angle)>TAU+1e-10)throw Error('Invalid phase')
      }else{
        if(!Number.isFinite(e.e)||e.e<0||e.e>=.999||!Number.isFinite(e.M0)||Math.abs(e.M0)>TAU+1e-10)throw Error('Invalid ellipse');
        if(e.model==='kepler-orbit-v1'){
          if(!Number.isFinite(e.omega)||![1, -1].includes(e.direction))throw Error('Invalid old plane')
        }else if(!validBasis(e))throw Error('Invalid 3D basis')
      }
    }seen.add(e.seq)
  }return{
    version:1, generation:VER, baselineLayout:LAYOUT, model:d.model, events:d.events.map(e=>structuredClone(e)), nextSeq:Math.max(0, ...d.events.map(e=>e.seq))+1
  }
}
try{
  storedRaw=localStorage.getItem(WORLDKEY)||'';
  if(storedRaw){
    Object.assign(world, validateWorld(JSON.parse(storedRaw)));
    persistence='RESTORED'
  }
}catch(e){
  persistence='WORLD LOAD FAILED — ORIGINAL PRESERVED: '+e.message;
  worldLoadFailed=true
}function persistWorld(){
  if(worldLoadFailed){
    persistence='SAVE BLOCKED: repair/import original world';
    return false
  }try{
    localStorage.setItem(WORLDKEY, JSON.stringify(world));
    persistence='SAVED LOCALLY';
    return true
  }catch(e){
    persistence='SAVE FAILED: '+e.message;
    return false
  }
}
function validSeed(s){
  return s&&finiteVector(s.position)&&finiteVector(s.velocity)&&Number.isFinite(s.epoch)&&s.epoch>=0&&norm(s.position)>0
}
function validatePlayer(d){
  if(!d||d.generation!==VER||d.baselineLayout!==LAYOUT||typeof d.starId!=='string'||!d.starId.startsWith(VER+'/')||d.starId.length>1500||!Number.isFinite(d.time)||d.time<0||![1, 3600, 86400].includes(d.rate)||typeof d.paused!=='boolean')throw Error('Wrong session or invalid player checkpoint');
  if(d.version===1&&d.model==='fixed-star-player-v1'){
    let o=d.orbit;
    if(!o||!validBasis(o)||!Number.isFinite(o.a)||o.a<.005*AU||o.a>10000*AU||!Number.isFinite(o.e)||o.e<0||o.e>=.999||!Number.isFinite(o.M0)||!Number.isFinite(o.epoch)||o.epoch<0||d.time<o.epoch)throw Error('Invalid legacy player conic')
  }else if(d.version===2&&d.model==='universal-player-v2'){
    if(!validSeed(d.seed)||d.time<d.seed.epoch||!Array.isArray(d.maneuvers)||d.maneuvers.length>5000)throw Error('Invalid universal seed/journal');
    let last=d.seed.epoch, seq=0;
    for(let e of d.maneuvers){
      if(!Number.isSafeInteger(e.seq)||e.seq<=seq||!Number.isFinite(e.time)||e.time<last||e.time>d.time||!finiteVector(e.deltaVRTN)||!finiteVector(e.deltaVInertial)||!e.before||!e.after||!finiteVector(e.before.position)||!finiteVector(e.before.velocity)||!finiteVector(e.after.position)||!finiteVector(e.after.velocity))throw Error('Invalid maneuver record');
      last=e.time;
      seq=e.seq
    }
  }else throw Error('Unsupported player model/version');
  return{
    ...structuredClone(d), pulseSize:Number.isFinite(d.pulseSize)?Math.max(.01, Math.min(1000000, d.pulseSize)):10, predictionDays:Number.isFinite(d.predictionDays)?Math.max(.001, Math.min(1e6, d.predictionDays)):100
  }
}
function seedAt(p, t){
  if(t<p.seed.epoch)throw Error('Epoch predates player initialization.');
  let s=p.seed;
  for(let e of p.maneuvers){
    if(e.time>t)break;
    s={
      position:e.after.position, velocity:e.after.velocity, epoch:e.time
    }
  }return s
}
function migrateAndVerifyPlayer(d, star){
  d=validatePlayer(d);
  let p;
  if(d.version===1){
    let k=propagate(d.orbit, G*star.mass, d.orbit.epoch);
    p={
      starId:d.starId, seed:{
        position:k.position, velocity:k.velocity, epoch:d.orbit.epoch
      }, maneuvers:[], nextSeq:1, origin:'migrated-v1-latest-conic; earlier history unavailable'
    }
  }else p={
    starId:d.starId, seed:structuredClone(d.seed), maneuvers:structuredClone(d.maneuvers), nextSeq:Math.max(0, ...d.maneuvers.map(e=>e.seq))+1, origin:d.origin||'universal-player'
  };
  safePlayerState(p.seed, star);
  let previous=p.seed;
  for(let e of p.maneuvers){
    let expected=universal(previous, G*star.mass, e.time), pulse=velocityPulse(expected, ...e.deltaVRTN), posTol=.02+1e-10*norm(expected.position), velTol=1e-6+1e-10*norm(expected.velocity);
    if(norm(sub(expected.position, e.before.position))>posTol||norm(sub(expected.velocity, e.before.velocity))>velTol||norm(sub(e.after.position, e.before.position))>posTol||norm(sub(pulse.deltaVInertial, e.deltaVInertial))>velTol||norm(sub(pulse.velocity, e.after.velocity))>velTol)throw Error('Maneuver journal inconsistent with predecessor/Δv');
    safePlayerState(e.after, star);
    previous={
      ...e.after, epoch:e.time
    }
  }safePlayerState(universal(seedAt(p, d.time), G*star.mass, d.time), star);
  return p
}
let storedPlayer=null, playerStorage='NO PHYSICAL CHECKPOINT', playerRaw='', savedNav='EXPLORER';
try{
  playerRaw=localStorage.getItem(PLAYERKEY)||'';
  if(playerRaw){
    storedPlayer=validatePlayer(JSON.parse(playerRaw));
    playerStorage='CHECKPOINT LOADED · '+storedPlayer.model+' · t='+storedPlayer.time.toFixed(3)+' s'
  }savedNav=['PHYSICAL', 'GRAVITY'].includes(localStorage.getItem(NAVKEY))?localStorage.getItem(NAVKEY):'EXPLORER'
}catch(e){
  playerStorage='PLAYER LOAD FAILED — ORIGINAL PRESERVED: '+e.message
}
let worker;
try {
  worker = createPopulationWorker();
} catch(e) {
  $('error').textContent=e.message;
  throw e;
}
let rid=0, pending=new Map(), workerMS=0;
function ask(type, data={
}){
  return new Promise((resolve, reject)=>{
    let id=++rid;
    pending.set(id, {
      resolve, reject
    });
    worker.postMessage({
      id, type, ...data
    })
  })
}worker.onmessage=e=>{
  let m=e.data, p=pending.get(m.id);
  if(!p)return;
  pending.delete(m.id);
  if(m.error)p.reject(Error(m.error));
  else{
    workerMS=m.ms;
    p.resolve(m.result)
  }
};
worker.onerror=e=>{
  for(let p of pending.values())p.reject(Error('Worker failed'));
  pending.clear();
  auto=null;
  autoState='BLOCKED';
  $('error').textContent=e.message
};
const universe={
  kind:'universe', name:'Spherical cosmic domain', root:rootNode(VER, R, 2000000000000)
};
let levels=[universe], depth=0, position=new Float64Array([0, 0, R*1.2]), velocity=new T.Vector3(), speedScale=1e8*LY, yaw=0, pitch=0, time=0, rate=1, paused=false, unit=1e9*LY, locked=false, hud=true, nav=true, showOrbit=true, exposure=1.8, budget=1400, query=null, queryPos=null, queryAt=0, queryBusy=false, querySerial=0, lastQuery=-Infinity, lastLOD=-Infinity, last=0, aim=-1, until=0, preparing=false, contextVersion=0, crossings=0, renderBuilds=0, buildsAtCross=0, tests=null, metrics=null, testPanel=false, failures=0, fov=65, auto=null, autoRequest=0, autoState='IDLE', selected=null, books=[], panelOpen=false, bodyIndex=-1, sweepEvents=0, eventLimitHits=0, surfaceWarnings=0, lastWarning=-Infinity, entryConfirmed=false, browse={
  kind:'universe', root:universe.root, parents:[], name:'All galaxies'
}, pageStart=0, pageTotal=2000000000000, pageRequest=0, navMode='EXPLORER', player=null, playerStar=null, pulseSize=storedPlayer?.pulseSize||10, predictionDays=storedPlayer?.predictionDays||100, explorerSnapshot=null, transitioning=false, pathCache=null, pathRevision=0, pathStatus='NO PLAYER PATH';
const PAGE=20, views=[], keys=new Set(), remainingTravel=new T.Vector3();
let restored=[];
try{
  let d=JSON.parse(localStorage.getItem(KEY));
  if(d&&d.version===1&&d.position?.length===3&&d.position.every(Number.isFinite)&&Number.isFinite(d.time)&&(!d.generation||d.generation===VER)&&(d.baselineLayout||'legacy-planar-v1')===LAYOUT){
    restored=d.bodies||[];
    depth=Math.min(restored.length, d.depth||0);
    position.set(d.position);
    yaw=d.yaw||0;
    pitch=d.pitch||0;
    time=d.time;
    rate=[1, 3600, 86400].includes(d.rate)?d.rate:1;
    paused=!!d.paused;
    if(d.velocity?.length===3&&d.velocity.every(Number.isFinite))velocity.fromArray(d.velocity);
    speedScale=Math.max(.01, Math.min(1e28, d.thrustScale||speedScale));
    fov=Math.max(5, Math.min(110, d.fov||65))
  }let b=JSON.parse(localStorage.getItem(BOOKKEY));
  if(Array.isArray(b))books=b.filter(t=>t?.body?.id&&t.generation===VER&&(t.baselineLayout||'legacy-planar-v1')===LAYOUT).slice(0, 100).map(t=>({
    ...t, baselineLayout:LAYOUT
  }))
}catch(e){
}
const scene=new T.Scene();
scene.background=new T.Color(0x010309);
const renderer=new T.WebGLRenderer({
  antialias:true, logarithmicDepthBuffer:true
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const canvas=renderer.domElement, camera=new T.PerspectiveCamera(fov, innerWidth/innerHeight, 1e-12, 1e13);
camera.rotation.order='YXZ';
scene.add(new T.AmbientLight(0xc2daee, 1.2));
const light=new T.PointLight(0xffebcf, 3, 0, 0);
scene.add(light);
const group=new T.Group();
scene.add(group);
const sphere=new T.SphereGeometry(1, 36, 24);
function makeOrbitLine(color){
  let g=new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(257*3), 3));
  let line=new T.Line(g, new T.LineBasicMaterial({
    color, transparent:true, opacity:.55, depthWrite:false
  }));
  line.frustumCulled=false;
  scene.add(line);
  return line
}const orbitLine=makeOrbitLine(0x6dba9b), playerLine=makeOrbitLine(0xffd38a);
function notice(s){
  $('msg').textContent=s;
  until=performance.now()+3500
}function fail(s){
  failures++;
  notice('CHECK FAILED: '+s)
}function observerAt(level){
  let p=Array.from(position);
  if(level<depth)for(let i=depth;
  i>level;
  i--)for(let k=0;
  k<3;
  k++)p[k]+=levels[i].body.p[k];
  else if(level>depth)for(let i=depth+1;
  i<=level;
  i++)for(let k=0;
  k<3;
  k++)p[k]-=levels[i].body.p[k];
  return p
}function state(b, star, t=time){
  return physical(b, star, t).position
}function navVelocity(b, star){
  return new T.Vector3(...physical(b, star).velocity).multiplyScalar(navMode==='PHYSICAL'||navMode==='GRAVITY'?1:paused?0:rate)
}function record(body, parentLevel){
  return{
    version:1, generation:VER, baselineLayout:LAYOUT, body:structuredClone(body), parents:levels.slice(1, parentLevel+1).map(f=>structuredClone(f.body)), verified:true
  }
}function matching(t){
  let n=0;
  while(n<t.parents.length&&levels[n+1]?.body.id===t.parents[n].id)n++;
  return n
}function routeStep(t){
  let n=matching(t);
  return n<t.parents.length?{
    body:t.parents[n], level:n, final:false
  }:{
    body:t.body, level:t.parents.length, final:true
  }
}function selectedMetrics(t=selected){
  if(!t)return null;
  if(matching(t)!==t.parents.length)return{
    remote:true
  };
  let b=t.body, star=t.parents.at(-1), p=b.a?state(b, star):b.p, obs=observerAt(t.parents.length), d=new T.Vector3(...sub(p, obs)), center=d.length(), rel=velocity.clone().sub(b.a?navVelocity(b, star):new T.Vector3());
  return{
    remote:false, delta:d, center, surface:center-b.radius, closing:center?rel.dot(d.clone().divideScalar(center)):0, relativeSpeed:rel.length()
  }
}
function disposeLayer(l){
  if(l){
    group.remove(l.points);
    l.points.geometry.dispose();
    l.points.material.dispose()
  }
}function createLayer(data, weight=1){
  renderBuilds++;
  let p=new Float32Array(data.length*3), c=new Float32Array(data.length*3), sizes=new Float32Array(data.length);
  data.forEach((d, i)=>{
    let col=new T.Color(d.body?.color||0xc2dbf3);
    c.set([col.r, col.g, col.b], i*3);
    sizes[i]=Math.min(14, 5+Math.log10(Math.max(1, d.count))*.75)
  });
  let g=new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(p, 3));
  g.setAttribute('color', new T.BufferAttribute(c, 3));
  g.setAttribute('psize', new T.BufferAttribute(sizes, 1));
  let m=new T.ShaderMaterial({
    vertexColors:true, transparent:true, depthWrite:false, blending:T.AdditiveBlending, uniforms:{
      gain:{
        value:exposure
      }, weight:{
        value:weight
      }, dpr:{
        value:renderer.getPixelRatio()
      }
    }, vertexShader:'attribute float psize;uniform float dpr;varying vec3 tint;void main(){tint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=psize*dpr;}', fragmentShader:'varying vec3 tint;uniform float gain;uniform float weight;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(tint*gain,(exp(-r*r*20.)+.32*exp(-r*r*4.))*(1.-smoothstep(.8,1.,r))*weight);}'
  });
  let points=new T.Points(g, m);
  points.frustumCulled=false;
  group.add(points);
  return{
    data, points
  }
}function viewAt(i){
  return views[i]||(views[i]={
    data:[], active:null, old:null, fadeAt:0, busy:false, revision:0, meshes:[]
  })
}function replaceData(i, data){
  let v=viewAt(i);
  disposeLayer(v.old);
  v.old=v.active;
  v.data=data;
  v.active=createLayer(data, v.old?0:1);
  v.fadeAt=performance.now()
}function dropView(i){
  let v=views[i];
  if(!v)return;
  v.revision++;
  disposeLayer(v.active);
  disposeLayer(v.old);
  for(let x of v.meshes){
    group.remove(x.mesh);
    x.mesh.material.dispose();
    if(x.mesh.userData.robotOwnedGeometry)x.mesh.geometry.dispose();
  }views[i]=null
}
async function requestLOD(i){
  let f=levels[i];
  if(!f||f.kind==='system')return;
  let v=viewAt(i);
  if(v.busy)return;
  v.busy=true;
  let rev=v.revision, version=contextVersion;
  try{
    let r=await ask('lod', {
      root:f.root, kind:f.kind, galaxy:f.kind==='galaxy'?f.body:null, position:observerAt(i), budget:i===depth?budget:Math.min(800, budget), exclude:levels[i+1]?.body?.authored?null:levels[i+1]?.body
    });
    if(version!==contextVersion||v!==views[i]||rev!==v.revision)return;
    if(r.total!==r.expected||!r.unique||r.outside)fail('LOD invariant');
    replaceData(i, r.display)
  }catch(e){
    fail(e.message)
  }finally{
    v.busy=false
  }
}function createSystem(i){
  let f=levels[i], v=viewAt(i);
  for(let b of[{
    ...f.body, central:true
  }, ...f.planets]){
    renderBuilds++;
    let mesh=new T.Mesh(sphere, b.central?new T.MeshBasicMaterial({
      color:b.color
    }):new T.MeshStandardMaterial({
      color:b.color, roughness:.8
    }));
    group.add(mesh);
    v.meshes.push({
      b, mesh
    })
  }
}
async function prepare(body, parentIndex){
  if(preparing||transitioning||navMode!=='EXPLORER'||parentIndex<depth)return;
  if(levels[parentIndex+1]?.body.id===body.id){
    if(levels[parentIndex+1].kind!=='system'&&!views[parentIndex+1]?.active)requestLOD(parentIndex+1);
    return
  }preparing=true;
  try{
    contextVersion++;
    for(let i=views.length-1;
    i>parentIndex;
    i--)dropView(i);
    levels=levels.slice(0, parentIndex+1);
    let f=body.kind==='galaxy'?{
      kind:'galaxy', name:body.name, body, root:groot(body)
    }:{
      kind:'system', name:body.name, body, planets:await ask('planets', {
        star:body
      })
    };
    levels.push(f);
    if(f.kind==='system')createSystem(parentIndex+1);
    else await requestLOD(parentIndex+1);
    await requestLOD(parentIndex)
  }catch(e){
    fail(e.message);
    auto=null;
    autoState='BLOCKED'
  }finally{
    preparing=false
  }
}
function crossFrame(next){
  let builds=renderBuilds, v=velocity.clone();
  if(next>depth)for(let k=0;
  k<3;
  k++)position[k]-=levels[next].body.p[k];
  else for(let k=0;
  k<3;
  k++)position[k]+=levels[depth].body.p[k];
  depth=next;
  unit=depth===0?1e9*LY:depth===1?10000*LY:AU;
  querySerial++;
  query=null;
  queryPos=null;
  lastQuery=-Infinity;
  crossings++;
  buildsAtCross=renderBuilds-builds;
  if(buildsAtCross||!v.equals(velocity))fail('Frame crossing mutation');
  if(levels[depth].kind==='system')notice('ENTERED SYSTEM: '+levels[depth].name)
}function sphereEvent(p, d, c, r, enter){
  let q=scale(sub(p, c), 1/r), v=scale(d, 1/r), sc=Math.max(1, ...q.map(Math.abs), ...v.map(Math.abs)), qq=scale(q, 1/sc), vv=scale(v, 1/sc), rr=1/sc, A=dot(vv, vv), B=dot(qq, vv), C=dot(qq, qq)-rr*rr;
  if(!A)return null;
  let D=B*B-A*C;
  if(D<0)return null;
  for(let u of[(-B-Math.sqrt(D))/A, (-B+Math.sqrt(D))/A]){
    if(u< -1e-10||u>1+1e-10)continue;
    u=Math.max(0, Math.min(1, u));
    if(enter?B+A*u<0:B+A*u>0)return u
  }return null
}function physicalWarnings(d){
  let f=levels[depth];
  if(f.kind!=='system')return;
  for(let b of[{
    ...f.body, central:true
  }, ...f.planets])if(sphereEvent(Array.from(position), d.toArray(), state(b, f.body), b.radius, true)!==null&&performance.now()-lastWarning>1500){
    lastWarning=performance.now();
    surfaceWarnings++;
    notice('Surface crossing: '+b.name+' · no collision response');
    break
  }
}function advanceSwept(displacement){
  let rem=displacement.clone(), events=0;
  while(rem.lengthSq()>0&&events<16){
    let p=Array.from(position), d=rem.toArray(), choice=null, f=levels[depth], child=levels[depth+1], ready=child&&!preparing&&(views[depth+1]?.active||views[depth+1]?.meshes.length);
    if(ready){
      let r=child.kind==='galaxy'?child.body.radius*1.2:400*AU, u=norm(sub(p, child.body.p))<r*(1-1e-12)?0:sphereEvent(p, d, child.body.p, r, true);
      if(u!==null)choice={
        u, next:depth+1
      }
    }if(depth>0){
      let r=f.kind==='system'?1000*AU:f.body.radius*2.5, u=norm(p)>r*(1+1e-12)?0:sphereEvent(p, d, [0, 0, 0], r, false);
      if(u!==null&&(!choice||u<choice.u))choice={
        u, next:depth-1
      }
    }let fraction=choice?choice.u:1, part=rem.clone().multiplyScalar(fraction);
    physicalWarnings(part);
    for(let k=0;
    k<3;
    k++)position[k]+=part.getComponent(k);
    rem.multiplyScalar(1-fraction);
    if(!choice){
      rem.set(0, 0, 0);
      break
    }crossFrame(choice.next);
    events++;
    sweepEvents++
  }if(rem.lengthSq()>0){
    remainingTravel.add(rem);
    eventLimitHits++
  }
}
function goalSatisfied(route, frames, at){
  return route.goal!=='system'||frames[at]?.kind==='system'&&frames[at].body.id===route.body.id
}async function verify(id){
  const home=homeTarget(id);if(home)return home;
  if(typeof id!=='string'||!id.startsWith(VER+'/'))throw Error('ID belongs to another population preset.');
  let t=await ask('address', {
    idString:id
  });
  return{
    ...t, baselineLayout:LAYOUT
  }
}function cancelAuto(){
  auto=null;
  autoRequest++;
  autoState='CANCELED';
  entryConfirmed=false
}async function startAuto(t, goal='approach'){
  if(navMode!=='EXPLORER'||transitioning){
    notice('Autopilot is Explorer-only.');
    return
  }let req=++autoRequest;
  autoState='RESOLVING';
  try{
    if(t.baselineLayout&&t.baselineLayout!==LAYOUT)throw Error('Wrong target layout');
    let v=await verify(t.body.id);
    if(req!==autoRequest)return;
    if(goal==='system'){
      if(v.body.kind==='galaxy'){
        let g=v.body, star=await ask('rank', {
          root:groot(g), kind:'galaxy', rank:0, galaxy:g
        });
        v={
          version:1, generation:VER, baselineLayout:LAYOUT, body:star, parents:[g], verified:true
        }
      }else if(v.body.kind==='planet')v={
        version:1, generation:VER, baselineLayout:LAYOUT, body:v.parents.at(-1), parents:v.parents.slice(0, -1), verified:true
      };
      if(v.body.kind!=='star')throw Error('System target must be star')
    }if(req!==autoRequest||navMode!=='EXPLORER')return;
    selected=v;
    auto={
      ...v, goal
    };
    autoState='PREPARING'
  }catch(e){
    if(req===autoRequest){
      auto=null;
      autoState='BLOCKED';
      notice(e.message)
    }
  }
}async function resolveAim(){
  let f=levels[depth];
  if(f.kind==='system'){
    cycleBody();
    return selected
  }let d=views[depth]?.data[aim>=0?aim:0];
  if(!d)return null;
  let at=depth, v=contextVersion, b=d.body||await ask('resolve', {
    node:d.node, kind:f.kind, galaxy:f.kind==='galaxy'?f.body:null
  });
  if(at!==depth||v!==contextVersion)return null;
  selected=record(b, at);
  fillInputs();
  return selected
}async function toggleAuto(){
  if(navMode!=='EXPLORER'){
    notice('Physical autopilot is not implemented.');
    return
  }if(auto||autoState==='RESOLVING'){
    cancelAuto();
    return
  }let t=selected||await resolveAim();
  if(t)startAuto(t, t.body.kind==='planet'?'approach':'system')
}function cycleBody(){
  let f=levels[depth];
  if(f.kind!=='system'){
    notice('Enter a system first');
    return
  }bodyIndex=(bodyIndex+1)%(f.planets.length+1);
  selected=bodyIndex===0?record(f.body, depth-1):record(f.planets[bodyIndex-1], depth);
  if(navMode==='EXPLORER')cancelAuto();
  fillInputs();
  notice('Selected '+selected.body.name)
}
async function queryNearest(){
  if(queryBusy)return;
  let f=levels[depth], at=depth, serial=querySerial, p=Array.from(position), epoch=time;
  queryBusy=true;
  try{
    let r;
    if(f.kind==='system'){
      let best=null;
      for(let b of[{
        ...f.body, central:true
      }, ...f.planets]){
        let center=norm(sub(state(b, f.body, epoch), p)), surface=center-b.radius;
        if(!best||surface<best.surface)best={
          body:b, center, surface
        }
      }r={
        best, complete:true
      }
    }else r=await ask('query', {
      root:f.root, kind:f.kind, galaxy:f.kind==='galaxy'?f.body:null, position:p
    });
    if(at!==depth||serial!==querySerial)return;
    query=r;
    queryPos=p;
    queryAt=performance.now();
    let b=r.best?.body;
    if(navMode==='EXPLORER'&&b&&f.kind!=='system'&&!levels[depth+1]&&norm(sub(b.p, Array.from(position)))<(b.kind==='galaxy'?b.radius*8:4000*AU))prepare(b, depth)
  }catch(e){
    fail(e.message)
  }finally{
    queryBusy=false
  }
}
function invalidate(){
  cancelAuto();
  querySerial++;
  query=null;
  queryPos=null;
  lastQuery=-Infinity;
  remainingTravel.set(0, 0, 0)
}function snapshotExplorer(){
  return{
    levels:structuredClone(levels), depth, position:Array.from(position), velocity:velocity.toArray(), yaw, pitch, fov, selected:selected?structuredClone(selected):null
  }
}async function rebuildContext(newLevels, newDepth, p, v){
  contextVersion++;
  for(let i=views.length-1;
  i>=0;
  i--)dropView(i);
  levels=newLevels;
  depth=newDepth;
  position.set(p);
  velocity.fromArray(v);
  unit=depth===0?1e9*LY:depth===1?10000*LY:AU;
  invalidate();
  for(let i=0;
  i<levels.length;
  i++)if(levels[i].kind==='system')createSystem(i);
  else await requestLOD(i)
}
function playerAt(t=time){
  if(!player||!playerStar)return null;
  return universal(seedAt(player, t), G*playerStar.body.mass, t)
}
async function activatePlayer(candidate, clock=null){
  if(navMode==='ROBOT'||navMode==='GRAVITY')throw Error("Return to Explorer from the active mode first.");
  if(transitioning||preparing)throw Error('Wait for destination preparation.');
  transitioning=true;
  cancelAuto();
  try{
    let target=await verify(candidate.starId);
    if(target.body.kind!=='star')throw Error('Player reference must be star');
    let proposed;
    if(candidate.model)proposed=migrateAndVerifyPlayer(candidate, target.body);
    else{
      proposed=structuredClone(candidate);
      safePlayerState(proposed.seed, target.body)
    }let t=clock?clock.time:time, k=universal(seedAt(proposed, t), G*target.body.mass, t);
    safePlayerState(k, target.body);
    let ps=await ask('planets', {
      star:target.body
    }), g=target.parents[0], next=[universe, {
      kind:'galaxy', name:g.name, body:g, root:groot(g)
    }, {
      kind:'system', name:target.body.name, body:target.body, planets:ps
    }];
    if(navMode==='EXPLORER')explorerSnapshot=snapshotExplorer();
    if(clock){
      time=clock.time;
      rate=clock.rate;
      paused=clock.paused;
      pulseSize=clock.pulseSize||pulseSize;
      predictionDays=clock.predictionDays||predictionDays
    }player=proposed;
    playerStar=target;
    navMode='PHYSICAL';
    pathRevision++;
    pathCache=null;
    await rebuildContext(next, 2, k.position, k.velocity);
    selected=target;
    let look=normalized(scale(k.position, -1));
    yaw=Math.atan2(-look[0], -look[2]);
    pitch=Math.asin(clamp(look[1]));
    autoState='DISABLED IN PHYSICAL';
    $('flightStatus').textContent='Physical Flight active · '+conicInfo(k, G*target.body.mass).kind+' · fixed reference '+target.body.name+'. Checkpoint unchanged until saved.'
  }finally{
    transitioning=false
  }
}
async function leavePhysical(){
  if(navMode==='GRAVITY')return leaveGravity();
  if(navMode!=='PHYSICAL'||transitioning)return;
  let s=explorerSnapshot;
  if(!s)throw Error('No Explorer snapshot available.');
  transitioning=true;
  try{
    navMode='EXPLORER';
    await rebuildContext(structuredClone(s.levels), s.depth, s.position, s.velocity);
    yaw=s.yaw;
    pitch=s.pitch;
    fov=s.fov;
    camera.fov=fov;
    camera.updateProjectionMatrix();
    selected=s.selected;
    explorerSnapshot=null;
    $('flightStatus').textContent='Explorer restored. Live trajectory/journal and saved player checkpoint unchanged.'
  }finally{
    transitioning=false
  }
}
function chosenStar(){
  if(!selected)throw Error('Select a star or planet first.');
  if(selected.body.kind==='star')return selected.body.id;
  if(selected.body.kind==='planet')return selected.parents.at(-1).id;
  throw Error('Browse galaxy contents and select star.')
}async function initializePlayer(useCurrent){
  if(navMode!=='EXPLORER')throw Error('Return to Explorer before initializing another state.');
  if(!paused)throw Error('Pause shared clock before initialization.');
  let id=chosenStar(), target=await verify(id), seed;
  if(useCurrent){
    if(depth!==2||levels[2]?.body.id!==id)throw Error('Current-state handoff requires Explorer inside that same star system.');
    seed={
      position:Array.from(position), velocity:velocity.toArray(), epoch:time
    };
    safePlayerState(seed, target.body);
    if(!confirm('Use current position/velocity around '+target.body.name+'? No capture/rescaling. Reference: '+id))return
  }else{
    let a=Number($('demoA').value)*AU;
    if(!$('demoA').value.trim())throw Error('Enter demo radius');
    let o={
      a, e:0, ...baselineBasis({
        id:id+'/player-demo'
      }, target.body), M0:0, epoch:time
    };
    orbitCheck(o, {
      radius:0
    }, target.body);
    let k=propagate(o, G*target.body.mass, time);
    seed={
      position:k.position, velocity:k.velocity, epoch:time
    };
    if(!confirm('SANDBOX PLACEMENT: circular '+(a/AU).toFixed(6)+' AU orbit around '+target.body.name+' with assigned orbital velocity? Not a maneuver. Reference: '+id))return
  }await activatePlayer({
    starId:id, seed, maneuvers:[], nextSeq:1, origin:useCurrent?'current-explorer-state':'demo-circular-placement'
  })
}
function pulsePreview(rd, td, nd){
  if(navMode!=='PHYSICAL'||!player||transitioning)throw Error('Activate Physical Flight first.');
  if(![rd, td, nd].every(Number.isFinite))throw Error('Finite Δv required');
  if(player.maneuvers.length>=5000)throw Error('Journal limit 5,000 maneuvers reached.');
  if(player.maneuvers.length&&time<player.maneuvers.at(-1).time)throw Error('Cannot branch before a recorded maneuver. Restore a suitable checkpoint.');
  let before=playerAt(), after=velocityPulse(before, rd, td, nd), info=safePlayerState(after, playerStar.body);
  universal({
    ...after, epoch:time
  }, G*playerStar.body.mass, time+Math.max(1, Math.min(86400, predictionDays*86400)));
  return{
    before, after, info, deltaVRTN:[rd, td, nd]
  }
}
function pulseText(x){
  let before=conicInfo(x.before, G*playerStar.body.mass), i=x.info;
  return'Trajectory: '+before.kind+' → '+i.kind+'\nSigned energy: '+i.energy.toExponential(10)+' J/kg\nΔ specific energy: '+(i.energy-before.energy).toExponential(9)+' J/kg\ne: '+i.e.toFixed(10)+'\nPeriapsis: '+fmt(i.periapsis)+'\n'+(i.bound?'Period: '+eta(i.period):'Asymptotic speed (single-star model): '+fmt(Math.sqrt(2*i.energy))+'/s')+'\nInertial Δv [m/s]: '+x.after.deltaVInertial.map(v=>v.toExponential(8)).join(', ')+'\nPosition is unchanged at the maneuver epoch; reference star unchanged.'
}
function applyPlayerPulse(rd, td, nd){
  let x=pulsePreview(rd, td, nd), e={
    seq:player.nextSeq, time, deltaVRTN:x.deltaVRTN, deltaVInertial:x.after.deltaVInertial.slice(), before:{
      position:x.before.position.slice(), velocity:x.before.velocity.slice()
    }, after:{
      position:x.before.position.slice(), velocity:x.after.velocity.slice()
    }
  };
  player.maneuvers.push(e);
  player.nextSeq++;
  position.set(e.after.position);
  velocity.fromArray(e.after.velocity);
  pathRevision++;
  pathCache=null;
  $('playerPreview').textContent='APPLIED / JOURNAL #'+e.seq+' / t='+time.toFixed(3)+' s\n'+pulseText(x);
  notice('Player maneuver #'+e.seq+' · '+x.info.kind+' · checkpoint not auto-saved');
  lastQuery=-Infinity
}
function numericPlayerPulse(apply){
  try{
    if(!paused)throw Error('Pause for numeric preview/apply; keyboard pulses work during flight.');
    let ids=['playerR', 'playerT', 'playerN'];
    if(ids.some(id=>!$(id).value.trim()))throw Error('Fill every component');
    let d=ids.map(id=>Number($(id).value));
    if(apply)applyPlayerPulse(...d);
    else $('playerPreview').textContent='PREVIEW ONLY / NO JOURNAL ENTRY\n'+pulseText(pulsePreview(...d))
  }catch(e){
    $('playerPreview').textContent=e.message
  }
}
function playerCheckpoint(){
  if(!player||!playerStar)throw Error('No live player');
  playerAt();
  return{
    version:2, generation:VER, baselineLayout:LAYOUT, model:'universal-player-v2', starId:player.starId, seed:structuredClone(player.seed), maneuvers:structuredClone(player.maneuvers), origin:player.origin, time, rate, paused, pulseSize, predictionDays
  }
}
function savePhysical(){
  try{
    if(navMode==='ROBOT')throw Error('Return to Explorer before saving a legacy player checkpoint.');
    let d=validatePlayer(playerCheckpoint());
    localStorage.setItem(PLAYERKEY, JSON.stringify(d));
    storedPlayer=d;
    playerRaw=JSON.stringify(d);
    playerStorage='SAVED v2 · '+d.maneuvers.length+' maneuvers · t='+d.time.toFixed(3)+' s';
    $('flightStatus').textContent=playerStorage;
    return true
  }catch(e){
    playerStorage='PLAYER SAVE FAILED: '+e.message;
    $('flightStatus').textContent=playerStorage;
    return false
  }
}async function restorePhysical(d, askFirst=true){
  d=validatePlayer(d);
  if(askFirst&&!confirm('Restore player and SHARED CLOCK to '+d.time.toFixed(3)+' s? Model '+d.model+'. Future world events remain recorded. Reference: '+d.starId))return;
  await activatePlayer(d, d)
}function saveExplorer(){
  localStorage.setItem(KEY, JSON.stringify({
    version:1, generation:VER, baselineLayout:LAYOUT, bodies:levels.slice(1).map(f=>f.body), depth, position:Array.from(position), velocity:velocity.toArray(), thrustScale:speedScale, yaw, pitch, time, rate, paused, fov
  }))
}function save(){
  if(navMode==='ROBOT')return saveRobotWorld();
  if(navMode==='GRAVITY')return saveGravity();
  try{
    if(transitioning)throw Error('Wait for mode transition');
    if(!persistWorld())throw Error(persistence);
    if(navMode==='PHYSICAL'){
      if(!savePhysical())return false
    }else saveExplorer();
    localStorage.setItem(NAVKEY, navMode);
    notice('Saved world + '+navMode+' state; other navigation save unchanged');
    return true
  }catch(e){
    notice('Save incomplete: '+e.message);
    return false
  }
}
$('demoFlight').onclick=()=>initializePlayer(false).catch(e=>$('flightStatus').textContent=e.message);
$('currentFlight').onclick=()=>initializePlayer(true).catch(e=>$('flightStatus').textContent=e.message);
$('liveFlight').onclick=()=>{
  if(!player){
    $('flightStatus').textContent='No live player; initialize or restore.';
    return
  }if(navMode==='PHYSICAL')return;
  activatePlayer(player).catch(e=>$('flightStatus').textContent=e.message)
};
$('leaveFlight').onclick=()=>leavePhysical().catch(e=>$('flightStatus').textContent=e.message);
$('previewPlayer').onclick=()=>numericPlayerPulse(false);
$('applyPlayer').onclick=()=>numericPlayerPulse(true);
$('setPulse').onclick=()=>{
  let v=Number($('pulseSize').value);
  if(!Number.isFinite(v)||v<.01||v>1e6){
    $('flightStatus').textContent='Pulse size: 0.01–1,000,000 m/s';
    return
  }pulseSize=v
};
$('setPrediction').onclick=()=>{
  let v=Number($('predictionDays').value);
  if(!Number.isFinite(v)||v<.001||v>1e6){
    $('flightStatus').textContent='Prediction: 0.001–1,000,000 days';
    return
  }predictionDays=v;
  pathRevision++;
  pathCache=null
};
$('savePlayer').onclick=savePhysical;
$('restorePlayer').onclick=()=>{
  if(!storedPlayer){
    $('flightStatus').textContent='No valid saved checkpoint';
    return
  }restorePhysical(storedPlayer).catch(e=>$('flightStatus').textContent=e.message)
};
$('exportPlayer').onclick=()=>{
  $('playerJSON').value=playerRaw||'';
  $('playerJSON').focus();
  $('playerJSON').select();
  $('flightStatus').textContent='Last SAVED checkpoint/original data selected; live unsaved changes excluded.'
};
$('importPlayer').onclick=()=>{
  try{
    if($('playerJSON').value.length>7000000)throw Error('Player JSON too large');
    let d=validatePlayer(JSON.parse($('playerJSON').value));
    restorePhysical(d).catch(e=>$('flightStatus').textContent=e.message)
  }catch(e){
    $('flightStatus').textContent=e.message
  }
};
$('switchPreset').onclick=()=>{
  if(navMode==='ROBOT'){notice('Return to Explorer before switching presets.');return;}
  let next=$('presetSelect').value;
  if(next===MODE)return;
  if(!confirm('Save active '+navMode+' + world and switch to '+next+'? Other navigation save stays untouched.'))return;
  if(!save()){
    $('presetStatus').textContent='Switch canceled: save failed';
    return
  }try{
    localStorage.setItem(SESSIONKEY, next);
    location.reload()
  }catch(e){
    $('presetStatus').textContent=e.message
  }
};
function bookmark(){
  if(navMode==='ROBOT'){notice('Robot bookmarks are not implemented; legacy bookmarks unchanged.');return;}
  if(!selected)return;
  if(!books.some(t=>t.body.id===selected.body.id))books.push(structuredClone(selected));
  try{
    localStorage.setItem(BOOKKEY, JSON.stringify(books.slice(-100)));
    notice('Bookmarked '+selected.body.name)
  }catch(e){
    notice('Bookmark save failed')
  }renderBooks()
}function fmt(x){
  if(!Number.isFinite(x))return x===Infinity?'∞':'—';
  let s=x<0?'-':'';
  x=Math.abs(x);
  return s+(x>=1e9*LY?(x/(1e9*LY)).toFixed(3)+' Gly':x>=1e6*LY?(x/(1e6*LY)).toFixed(3)+' Mly':x>=LY?(x/LY).toFixed(5)+' ly':x>=AU*.1?(x/AU).toFixed(5)+' AU':x>=1000?(x/1000).toPrecision(6)+' km':x.toFixed(2)+' m')
}function eta(s){
  return !Number.isFinite(s)||s<0?'—':s<60?s.toFixed(1)+' s':s<3600?(s/60).toFixed(1)+' min':s<86400?(s/3600).toFixed(2)+' h':(s/86400).toPrecision(5)+' days'
}function deg(x){
  return(x*180/Math.PI).toFixed(7)
}function tab(id){
  document.querySelectorAll('.section').forEach(e=>e.classList.toggle('active', e.id===id));
  document.querySelectorAll('.tab').forEach(e=>e.classList.toggle('active', e.dataset.tab===id))
}document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$('toFlight').onclick=()=>tab('flight');
function scopeCurrent(){
  let f=levels[depth];
  return f.kind==='universe'?{
    kind:'universe', root:f.root, parents:[], name:'All galaxies'
  }:f.kind==='galaxy'?{
    kind:'galaxy', root:f.root, galaxy:f.body, parents:[f.body], name:'All supported stars in '+f.name
  }:{
    kind:'system', star:f.body, planets:f.planets, parents:levels.slice(1, depth+1).map(f=>f.body), name:'All bodies in '+f.name
  }
}async function setBrowse(s){
  browse=s;
  pageStart=0;
  await loadPage()
}async function contents(t){
  if(!t)return;
  let b=t.body;
  if(b.kind==='galaxy')return setBrowse({
    kind:'galaxy', root:groot(b), galaxy:b, parents:[b], name:'All supported stars in '+b.name
  });
  if(b.kind==='star')return setBrowse({
    kind:'system', star:b, planets:await ask('planets', {
      star:b
    }), parents:[...t.parents, b], name:'All bodies in '+b.name
  });
  $('listStatus').textContent='Moons/minor bodies excluded.'
}function rowTarget(body){
  return{
    version:1, generation:VER, baselineLayout:LAYOUT, body, parents:structuredClone(browse.kind==='system'&&body.kind==='star'?browse.parents.slice(0, -1):browse.parents), verified:true
  }
}
async function loadPage(){
  let req=++pageRequest, s=browse;
  pageTotal=s.kind==='system'?s.planets.length+1:s.root.count;
  pageStart=Math.max(0, Math.min(Math.floor((pageTotal-1)/PAGE)*PAGE, pageStart));
  $('scopeLabel').textContent=s.name+' · '+pageTotal.toLocaleString()+' objects';
  $('listStatus').textContent='Resolving…';
  $('objectRows').replaceChildren();
  try{
    let items=s.kind==='system'?[s.star, ...s.planets].slice(pageStart, pageStart+PAGE).map((b, i)=>({
      index:pageStart+i, body:b
    })):(await ask('page', {
      root:s.root, kind:s.kind, galaxy:s.galaxy, start:pageStart, size:PAGE
    })).items;
    if(req!==pageRequest)return;
    $('pageIndex').value=Math.floor(pageStart/PAGE)+1;
    $('listStatus').textContent='Objects '+(pageStart+1).toLocaleString()+'–'+(pageStart+items.length).toLocaleString()+' of '+pageTotal.toLocaleString()+' · page '+(Math.floor(pageStart/PAGE)+1).toLocaleString()+'/'+Math.ceil(pageTotal/PAGE).toLocaleString();
    for(let x of items){
      let t=rowTarget(x.body), row=document.createElement('div');
      row.className='obj';
      let desc=document.createElement('div');
      desc.className='desc';
      let name=document.createElement('div');
      name.textContent='#'+(x.index+1).toLocaleString()+' · '+x.body.name+' · '+x.body.kind;
      let sm=document.createElement('small');
      sm.textContent=(x.body.profile?x.body.profile+' · '+x.body.stars.toLocaleString()+' MS proxies · ':x.body.massSolar?x.body.massSolar.toFixed(3)+' M☉ · '+x.body.temperatureK.toFixed(0)+' K · ':'')+x.body.id;
      desc.append(name, sm);
      row.append(desc);
      for(let[label, fn]of[['Inspect', ()=>{
        selected=structuredClone(t);
        if(navMode==='EXPLORER')cancelAuto();
        fillInputs();
        refreshInspector();
        tab('inspect')
      }], ...(x.body.kind==='galaxy'||x.body.kind==='star'?[['Contents', ()=>contents(t)]]:[]), [x.body.kind==='planet'?'Explorer approach':'Explorer enter system', ()=>{
        startAuto(t, x.body.kind==='planet'?'approach':'system');
        $('panelStatus').textContent=navMode==='EXPLORER'?'Route armed; resume view.':'Explorer-only travel disabled.'
      }]]){
        let b=document.createElement('button');
        b.textContent=label;
        b.onclick=fn;
        row.append(b)
      }$('objectRows').append(row)
    }
  }catch(e){
    $('listStatus').textContent=e.message
  }
}
$('rootBrowse').onclick=()=>setBrowse({
  kind:'universe', root:universe.root, parents:[], name:'All galaxies'
});
$('currentBrowse').onclick=()=>setBrowse(scopeCurrent());
$('selectedChildren').onclick=()=>contents(selected);
$('parentBrowse').onclick=()=>{
  if(browse.kind==='system'){
    let g=browse.parents[0];
    setBrowse({
      kind:'galaxy', root:groot(g), galaxy:g, parents:[g], name:'All supported stars in '+g.name
    })
  }else $('rootBrowse').click()
};
$('prevPage').onclick=()=>{
  pageStart-=PAGE;
  loadPage()
};
$('nextPage').onclick=()=>{
  pageStart+=PAGE;
  loadPage()
};
$('goPage').onclick=()=>{
  let p=Number($('pageIndex').value);
  if(!Number.isSafeInteger(p)||p<1||p>Math.ceil(pageTotal/PAGE)){
    $('listStatus').textContent='Invalid page';
    return
  }pageStart=(p-1)*PAGE;
  loadPage()
};
$('goOrdinal').onclick=()=>{
  let n=Number($('ordinal').value);
  if(!Number.isSafeInteger(n)||n<1||n>pageTotal){
    $('listStatus').textContent='Invalid population index';
    return
  }pageStart=Math.floor((n-1)/PAGE)*PAGE;
  loadPage()
};
function orbitSelection(){
  return selected?.body.kind==='planet'?{
    b:selected.body, star:selected.parents.at(-1)
  }:null
}function fillInputs(){
  $('impulsePreview').textContent='';
  let q=orbitSelection();
  if(!q){
    for(let id of['orbitA', 'orbitE', 'orbitI', 'orbitNode', 'orbitArg', 'orbitM'])$(id).value='';
    return
  }let o=physical(q.b, q.star).orbit, c=classical(o);
  $('orbitA').value=(o.a/AU).toPrecision(12);
  $('orbitE').value=o.e.toPrecision(10);
  $('orbitI').value=deg(c.inclination);
  $('orbitNode').value=deg(c.node);
  $('orbitArg').value=deg(c.arg);
  $('orbitM').value=deg(o.M)
}function editReady(){
  if(navMode==='ROBOT')throw Error('Return to Explorer before editing legacy planetary orbits.');
  let q=orbitSelection();
  if(!q||!paused)throw Error('Select planet and pause clock first');
  if(worldLoadFailed)throw Error('Repair/import original world first');
  return q
}function commit(e, message){
  e.seq=world.nextSeq++;
  world.events.push(e);
  invalidate();
  let ok=persistWorld();
  fillInputs();
  $('editStatus').textContent=(ok?'SAVED':'IN MEMORY ONLY — EXPORT BACKUP')+' · #'+e.seq+' · '+message
}
function assignOrbit(type){
  try{
    let q=editReady(), ev={
      objectId:q.b.id, time, model:'kepler-3d-v1', type, origin:'sandbox-editor'
    };
    if(type==='orbit'){
      for(let id of['orbitA', 'orbitE', 'orbitI', 'orbitNode', 'orbitArg', 'orbitM'])if(!$(id).value.trim())throw Error('Fill all elements');
      let i=Number($('orbitI').value)*Math.PI/180, node=Number($('orbitNode').value)*Math.PI/180, arg=Number($('orbitArg').value)*Math.PI/180, M0=wrap(Number($('orbitM').value)*Math.PI/180);
      if(![i, node, arg, M0].every(Number.isFinite)||i<0||i>Math.PI)throw Error('Finite angles; inclination 0–180°');
      let o={
        a:Number($('orbitA').value)*AU, e:Number($('orbitE').value), ...classicalBasis(i, wrap(node), wrap(arg)), M0
      };
      orbitCheck(o, q.b, q.star);
      Object.assign(ev, o)
    }commit(ev, type==='orbit'?'Planet sandbox orbit assigned.':'Planet baseline restored.')
  }catch(e){
    $('editStatus').textContent=e.message
  }
}
function planetPulse(apply){
  try{
    let q=editReady(), ids=['radialDV', 'transverseDV', 'normalDV'];
    if(ids.some(id=>!$(id).value.trim()))throw Error('Fill every component');
    let ds=ids.map(id=>Number($(id).value));
    if(!ds.every(Number.isFinite))throw Error('Finite Δv required');
    let after=velocityPulse(physical(q.b, q.star), ...ds), o=orbitCheck(fromState(after.position, after.velocity, G*q.star.mass, time), q.b, q.star), c=classical(o), text='PLANET, NOT PLAYER\nNew a/e: '+fmt(o.a)+' / '+o.e.toFixed(9)+'\nInclination: '+deg(c.inclination)+'°\nPosition continuous at event epoch.';
    if(apply){
      commit({
        objectId:q.b.id, time, type:'orbit', model:'kepler-3d-v1', origin:'ideal-3axis-velocity-change', a:o.a, e:o.e, P:o.P, Q:o.Q, M0:o.M0, deltaV:{
          radial:ds[0], transverse:ds[1], normal:ds[2]
        }
      }, 'Planet Δv applied.');
      $('impulsePreview').textContent='APPLIED\n'+text
    }else $('impulsePreview').textContent='PREVIEW ONLY\n'+text
  }catch(e){
    $('impulsePreview').textContent=e.message
  }
}function undo(){
  try{
    let q=editReady(), es=world.events.filter(e=>e.objectId===q.b.id);
    if(!es.length)throw Error('No events');
    let e=es.reduce((a, b)=>a.seq>b.seq?a:b);
    world.events=world.events.filter(x=>x!==e);
    invalidate();
    persistWorld();
    fillInputs();
    $('editStatus').textContent='Removed #'+e.seq
  }catch(e){
    $('editStatus').textContent=e.message
  }
}
function provenance(b){
  if(b.authored)return b.kind==='star'?'AUTHORED DEVELOPMENT STAR\nAssigned mass: '+b.mass.toExponential(9)+' kg':'AUTHORED DEVELOPMENT PLANET\nAssigned mass: '+RK.M.toExponential(9)+' kg\nRadius: '+RK.R+' m\nRotation disabled; robot gravity uses assigned mass.';
  if(b.kind==='planet')return 'PLANET MODEL: '+(b.planetModel||'legacy baseline')+'\nGRAVITY MASS: '+withPlanetGravity(b).mass.toExponential(9)+' kg\nMASS MODEL: density-proxy-v1 (assigned, not measured)\nSURFACE g: '+withPlanetGravity(b).surfaceGravity.toFixed(6)+' m/s²\nOnly Local Gravity mode uses planetary attraction.';
  if(legacy)return b.kind==='galaxy'?'MODEL: legacy fixed census\nASSIGNED STARS: 100,000,000,000':b.kind==='star'?'MODEL: legacy solar proxy\nMASS: 1 M☉; radius 696,340 km\nPLANETS: six':'MODEL: legacy circular baseline / editable 3D state';
  if(b.kind==='galaxy')return 'MODEL: '+b.populationModel+'\nASSIGNED PROFILE: '+b.profile+'\nASSIGNED AGE / Z: '+b.ageGyr.toFixed(4)+' Gyr / '+b.metallicity.toFixed(6)+'\nASSIGNED MS-PROXY MASS BUDGET: '+b.massBudgetSolar.toExponential(8)+' M☉\nEXPECTED MEAN MASS: '+b.meanMass.toFixed(8)+' M☉\nDERIVED CENSUS: '+b.stars.toLocaleString()+' single MS proxies\nEXPECTED CENSUS MASS: '+b.expectedCensusMassSolar.toExponential(8)+' M☉\nACTUAL MASS SUM: NOT EVALUATED\nMASS CUTOFF: '+b.upperMass.toFixed(6)+' M☉';
  if(b.kind==='star')return 'CATEGORY: '+b.stellarCategory+'\nPROPERTY MODEL: '+b.propertyModel+'\nSAMPLED MASS: '+b.massSolar.toFixed(8)+' M☉\nLUMINOSITY PROXY: '+b.luminositySolar.toExponential(8)+' L☉\nTEMPERATURE PROXY: '+b.temperatureK.toFixed(2)+' K\nASSIGNED AGE / Z: '+b.ageGyr.toFixed(4)+' Gyr / '+b.metallicity.toFixed(6)+'\nTOY LIFETIME: '+b.lifetimeProxyGyr.toFixed(3)+' Gyr\nPLANETS: resolve Contents';
  return 'SIZE CATEGORY: '+b.planetCategory+'\nMODEL: '+b.planetModel+'\nPlanet mass uses an assigned density proxy; planetary gravity is used only in Local Gravity mode.'
}
function refreshPlayer(){
  let text='MODE: '+navMode+'\nCHECKPOINT: '+playerStorage+'\nSHARED EPOCH: '+time.toFixed(3)+' s · '+(paused?'PAUSED':'×'+rate)+'\nKEYBOARD PULSE: '+pulseSize.toFixed(3)+' m/s';
  if(player&&playerStar){
    try{
      let k=playerAt(), i=conicInfo(k, G*playerStar.body.mass);
      text+='\n\nREFERENCE STAR: '+playerStar.body.name+'\nID: '+player.starId+'\nMASS: '+playerStar.body.mass.toExponential(9)+' kg\nTRAJECTORY: '+i.kind+(i.near?' [signed energy retained]':'')+'\nSPECIFIC ENERGY: '+i.energy.toExponential(11)+' J/kg\nECCENTRICITY: '+i.e.toFixed(11)+'\nSIGNED a: '+fmt(i.a)+'\nRADIUS FROM STAR: '+fmt(i.r)+'\nRADIAL SPEED: '+fmt(i.radialSpeed)+'/s\nSPEED: '+fmt(i.speed)+'/simulation second\nGRAVITATIONAL ACCELERATION: '+(G*playerStar.body.mass/i.r**2).toExponential(8)+' m/s²\nPERIAPSIS: '+fmt(i.periapsis)+'\n'+(i.bound?'BOUND PERIOD: '+eta(i.period):'SINGLE-STAR ASYMPTOTIC SPEED: '+fmt(Math.sqrt(Math.max(0, 2*i.energy)))+'/s')+'\nINCLINATION: '+deg(i.inclination)+'°\nPOSITION [m]: '+k.position.map(v=>v.toExponential(12)).join(', ')+'\nVELOCITY [m/s]: '+k.velocity.map(v=>v.toExponential(9)).join(', ')+'\nANGULAR MOMENTUM [m²/s]: '+i.h.map(v=>v.toExponential(9)).join(', ')+'\nPREDICTION: '+pathStatus+'\nORIGIN: '+player.origin+'\nNo automatic reference changes.'
    }catch(e){
      text+='\n'+e.message
    }
  }else text+='\nNo live player. Initialize or restore.';
  $('playerText').textContent=text;
  let id;
  try{
    id=chosenStar()
  }catch(e){
  }$('flightTarget').textContent='Initialization star: '+(id||'select star or planet')+'\nPause first. Demo = sandbox placement; current-state = no capture/rescaling.';
  $('maneuverLog').textContent=player?(player.maneuvers.length?player.maneuvers.map(e=>{
    let mu=G*playerStar.body.mass;
    return'#'+e.seq+' · t='+e.time.toFixed(6)+' s\nRTN Δv [m/s]: '+e.deltaVRTN.join(', ')+'\nInertial Δv [m/s]: '+e.deltaVInertial.map(v=>v.toExponential(8)).join(', ')+'\nBefore v [m/s]: '+e.before.velocity.map(v=>v.toExponential(8)).join(', ')+'\nAfter v [m/s]: '+e.after.velocity.map(v=>v.toExponential(8)).join(', ')+'\nClass: '+conicInfo(e.before, mu).kind+' → '+conicInfo(e.after, mu).kind
  }).join('\n\n'):'No applied maneuvers after initialization/migration. Earlier v1 history is unavailable.'):'No live player journal.';
  for(let name of['previewPlayer', 'applyPlayer'])$(name).disabled=navMode!=='PHYSICAL'||transitioning;
  $('leaveFlight').disabled=navMode!=='PHYSICAL'||transitioning
}
function refreshInspector(){
  refreshGravity();
  let q=orbitSelection();
  $('clock').textContent=paused?'Resume clock':'Pause clock';
  $('editInfo').textContent=q?q.b.name+' · '+(paused?'PAUSED — planet editable':'Pause for planet edits'):'Select planet for orbital lab';
  for(let id of['applyOrbit', 'resetOrbit', 'undoOrbit', 'previewImpulse', 'applyImpulse'])$(id).disabled=!q||!paused||worldLoadFailed;
  $('history').textContent=q?world.events.filter(e=>e.objectId===q.b.id).sort((a, b)=>a.seq-b.seq).map(e=>'#'+e.seq+' · t='+e.time.toFixed(3)+' s · '+e.type+' · '+e.model+' · '+(e.origin||'legacy')).join('\n'):'';
  $('worldStatus').textContent=VER+' / '+LAYOUT+'\nWORLD: '+persistence+' · '+world.events.length+' events\nPlayer checkpoint is separate.';
  refreshPlayer();
  if(!selected){
    $('inspectText').textContent='Select from Objects, or aim and J.';
    return
  }let t=selected, b=t.body, m=selectedMetrics(), k=b.a?physical(b, t.parents.at(-1)):null, p=k?k.position:b.p, v=k?k.velocity:[0, 0, 0], o=k?.orbit, c=o?classical(o):null;
  $('inspectText').textContent='NAME: '+b.name+'\nTYPE: '+b.kind+'\nID: '+b.id+'\nGENERATION / BASELINE: '+VER+' / '+LAYOUT+'\nPROVENANCE: synthetic, NOT measured catalog\nRADIUS: '+fmt(b.radius)+'\n\n'+provenance(b)+(o?'\n\nSTATE: '+(o.modified?'MODIFIED':o.event?'BASELINE RESTORED':'BASELINE')+'\na/e: '+fmt(o.a)+' / '+o.e.toFixed(9)+'\nINCLINATION: '+deg(c.inclination)+'°\nNODE Ω: '+deg(c.node)+'°'+(c.equatorial?' [undefined; convention]':'')+'\nPERIAPSIS ω: '+deg(c.arg)+'°'+(c.circular?' [phase reference]':'')+'\nMEAN ANOMALY: '+deg(o.M)+'°\nPERIAPSIS / APOAPSIS: '+fmt(o.a*(1-o.e))+' / '+fmt(o.a*(1+o.e))+'\nPERIOD: '+eta(TAU/o.n):'')+'\n\nPOSITION [m]: '+p.map(x=>x.toExponential(12)).join(', ')+'\nVELOCITY [m/s]: '+v.map(x=>x.toExponential(9)).join(', ')+'\nEPOCH: '+time.toFixed(3)+' s'+(m?.remote?'\nREMOTE':m?'\nSURFACE: '+fmt(m.surface)+'\nCLOSING: '+fmt(m.closing)+'/s':'')
}
function renderBooks(){
  $('books').replaceChildren();
  if(!books.length)$('books').textContent='No bookmarks for '+MODE;
  books.forEach((t, i)=>{
    let row=document.createElement('div');
    row.className='book';
    let label=document.createElement('span');
    label.textContent=t.body.name+' · '+t.body.kind+' · '+t.body.id;
    row.append(label);
    for(let[text, fn]of[['Verify + inspect', async()=>{
      try{
        selected=await verify(t.body.id);
        if(navMode==='EXPLORER')cancelAuto();
        fillInputs();
        tab('inspect')
      }catch(e){
        $('panelStatus').textContent=e.message
      }
    }], ['Explorer travel', ()=>startAuto(t, t.body.kind==='planet'?'approach':'system')], ['Remove', ()=>{
      books.splice(i, 1);
      try{
        localStorage.setItem(BOOKKEY, JSON.stringify(books))
      }catch(e){
      }renderBooks()
    }]]){
      let b=document.createElement('button');
      b.textContent=text;
      b.onclick=fn;
      row.append(b)
    }$('books').append(row)
  })
}
function openInspector(){
  panelOpen=true;
  keys.clear();
  document.exitPointerLock?.();
  $('gate').style.display='none';
  $('panel').style.display='grid';
  fillInputs();
  refreshInspector();
  renderBooks();
  setBrowse(scopeCurrent())
}$('openPanel').onclick=openInspector;
$('panelClose').onclick=()=>{
  panelOpen=false;
  $('panel').style.display='none';
  $('gate').style.display='grid'
};
$('resume').onclick=()=>{
  panelOpen=false;
  $('panel').style.display='none';
  capture()
};
$('clock').onclick=()=>{
  paused=!paused;
  if(paused)fillInputs()
};
$('saveAll').onclick=save;
$('cycle').onclick=cycleBody;
$('bookmark').onclick=bookmark;
$('approach').onclick=()=>{
  if(selected)startAuto(selected, 'approach')
};
$('enterSystem').onclick=()=>{
  if(selected)startAuto(selected, 'system')
};
$('copyID').onclick=async()=>{
  if(!selected)return;
  $('address').value=selected.body.id;
  try{
    await navigator.clipboard.writeText(selected.body.id);
    $('panelStatus').textContent='ID copied.'
  }catch(e){
    tab('bookmarks');
    $('address').focus();
    $('address').select()
  }
};
$('exportTarget').onclick=()=>{
  if(selected){
    tab('bookmarks');
    $('portable').value=JSON.stringify(selected, null, 2);
    $('portable').focus();
    $('portable').select()
  }
};
async function loadID(id){
  try{
    selected=await verify(id.trim());
    if(navMode==='EXPLORER')cancelAuto();
    fillInputs();
    tab('inspect');
    $('panelStatus').textContent='Verified active-layout object.'
  }catch(e){
    $('panelStatus').textContent=e.message
  }
}$('resolveID').onclick=()=>loadID($('address').value);
$('loadTarget').onclick=()=>{
  try{
    if($('portable').value.length>20000)throw Error('Too large');
    let t=JSON.parse($('portable').value);
    if((t.baselineLayout||'legacy-planar-v1')!==LAYOUT)throw Error('Target layout differs');
    loadID(t.body?.id||t.id||'')
  }catch(e){
    $('panelStatus').textContent=e.message
  }
};
$('fillOrbit').onclick=fillInputs;
$('applyOrbit').onclick=()=>assignOrbit('orbit');
$('resetOrbit').onclick=()=>assignOrbit('baseline');
$('undoOrbit').onclick=undo;
$('previewImpulse').onclick=()=>planetPulse(false);
$('applyImpulse').onclick=()=>planetPulse(true);
$('exportWorld').onclick=()=>{
  $('worldJSON').value=worldLoadFailed?storedRaw:JSON.stringify(world, null, 2);
  $('worldJSON').focus();
  $('worldJSON').select()
};
$('importWorld').onclick=async()=>{
  try{
    if(navMode==='ROBOT')throw Error('Return to Explorer before importing orbital edits.');
    if(!paused)throw Error('Pause before import');
    if($('worldJSON').value.length>5000000)throw Error('Too large');
    let d=validateWorld(JSON.parse($('worldJSON').value)), targets=new Map();
    for(let id of new Set(d.events.map(e=>e.objectId))){
      let t=await verify(id);
      if(t.body.kind!=='planet')throw Error('Invalid edited object');
      targets.set(id, t)
    }for(let e of d.events)if(e.type==='orbit'&&e.model!=='circular-orbit-v1'){
      let t=targets.get(e.objectId);
      orbitCheck(e, t.body, t.parents.at(-1))
    }if(!confirm('Replace '+MODE+' world layer with '+d.events.length+' imported events? Player is separate.'))return;
    Object.assign(world, d);
    worldLoadFailed=false;
    invalidate();
    persistWorld();
    fillInputs();
    $('panelStatus').textContent='World imported.'
  }catch(e){
    $('panelStatus').textContent=e.message
  }
};
$('modelText').textContent='SESSION: '+MODE+'\nGENERATION: '+VER+'\nBASELINE: '+LAYOUT+'\nPLAYER PROPAGATOR: universal variables / Stumpff functions\nPLAYER MODEL: one fixed reference star / massless test particle\nPLAYER v2: Cartesian seed + applied maneuver journal\nPLAYER v1: verified migration from latest bound conic\nPLAYER CLOCK: same simulation seconds as planets\nPLAYER CHECKPOINT KEY: '+PLAYERKEY+'\nEXPLORER OBSERVER KEY: '+KEY+'\nSINGLE-STAR PLAYER: no planetary gravity / Local Gravity tab: summed local gravity\nPLANET EDITOR: previous bound Kepler limits retained\nEXPLORER: nonphysical camera navigation\nGRAVITY HANDOFF: explicit reinitialization only, no automatic switching\nWORLD EVENTS: independent planetary edits\nPOPULATION: static uncalibrated proxies; membership conserved, actual mass/light sums not computed';
function speedAdjust(up, fine){
  let factor=fine?1.1:2;
  if(navMode==='PHYSICAL'){
    pulseSize=Math.max(.01, Math.min(1e6, pulseSize*(up?factor:1/factor)));
    $('pulseSize').value=pulseSize;
    notice('Pulse size '+pulseSize.toFixed(3)+' m/s; velocity unchanged');
    return
  }let old=speedScale;
  speedScale=Math.max(.01, Math.min(1e28, speedScale*(up?factor:1/factor)));
  if(!auto&&velocity.lengthSq())velocity.multiplyScalar(speedScale/old);
  notice('Explorer scale '+fmt(speedScale)+'/s')
}
async function capture(){
  try{
    await canvas.requestPointerLock()
  }catch(e){
    $('error').textContent='Pointer lock blocked; NULL needs allow-pointer-lock.'
  }
}$('enter').onclick=capture;
document.addEventListener('pointerlockchange', ()=>{
  locked=document.pointerLockElement===canvas;
  keys.clear();
  $('gate').style.display=locked||panelOpen?'none':'grid';
  $('enter').textContent='Resume '+navMode+' view'
});
document.addEventListener('pointerlockerror', ()=>{
  $('error').textContent='Check NULL pointer lock.'
});
document.addEventListener('mousemove', e=>{
  if(locked){
    yaw+=(navMode==='ROBOT'?1:-1)*e.movementX*.002;
    pitch=Math.max(-1.55, Math.min(1.55, pitch-e.movementY*.002))
  }
});
canvas.addEventListener('wheel', e=>{
  if(locked){
    e.preventDefault();
    fov=Math.max(5, Math.min(110, fov*Math.exp(e.deltaY*.001)));
    camera.fov=fov;
    camera.updateProjectionMatrix()
  }
}, {
  passive:false
});
document.addEventListener('keydown', e=>{
  if(e.code==='F2'){
    e.preventDefault();
    testPanel=!testPanel;
    $('tests').style.display=testPanel?'block':'none';
    return
  }if(!locked||transitioning)return;
  if(navMode==='ROBOT'&&robotKey(e))return;
  if(navMode==='GRAVITY'&&gravityKey(e))return;
  keys.add(e.code);
  if(e.code==='Comma'||e.code==='Period'){
    e.preventDefault();
    speedAdjust(e.code==='Period', e.shiftKey);
    return
  }if(e.code==='Space')e.preventDefault();
  if(navMode==='PHYSICAL'&&['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyX'].includes(e.code)){
    if(e.repeat)return;
    if(e.code==='KeyX'){
      notice('No instant brake; use explicit RTN Δv.');
      return
    }let r=e.code==='KeyD'?pulseSize:e.code==='KeyA'?-pulseSize:0, t=e.code==='KeyW'?pulseSize:e.code==='KeyS'?-pulseSize:0, n=e.code==='KeyE'?pulseSize:e.code==='KeyQ'?-pulseSize:0;
    try{
      applyPlayerPulse(r, t, n)
    }catch(err){
      notice('Pulse rejected: '+err.message)
    }return
  }if(navMode==='EXPLORER'&&['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyX'].includes(e.code))cancelAuto();
  if(e.repeat)return;
  if(e.code==='KeyJ')toggleAuto().catch(e=>fail(e.message));
  if(e.code==='KeyI')openInspector();
  if(e.code==='KeyB')bookmark();
  if(e.code==='KeyM')cycleBody();
  if(e.code==='KeyO')showOrbit=!showOrbit;
  if(e.code==='KeyN')nav=!nav;
  if(e.code==='KeyK')save();
  if(e.code==='Space')paused=!paused;
  if(e.code==='KeyT')rate=[1, 3600, 86400][([1, 3600, 86400].indexOf(rate)+1)%3];
  if(e.code==='KeyZ'){
    fov=65;
    camera.fov=fov;
    camera.updateProjectionMatrix()
  }if(e.code==='Equal'||e.code==='NumpadAdd')exposure=Math.min(8, exposure*1.25);
  if(e.code==='Minus'||e.code==='NumpadSubtract')exposure=Math.max(.25, exposure/1.25);
  if(e.code==='BracketLeft'||e.code==='BracketRight'){
    budget=Math.max(300, Math.min(3000, budget+(e.code==='BracketLeft'?-300:300)));
    lastLOD=-Infinity
  }if(e.code==='KeyH'){
    hud=!hud;
    document.querySelectorAll('.hud').forEach(x=>x.style.display=hud?'block':'none')
  }
});
document.addEventListener('keyup', e=>keys.delete(e.code));
window.addEventListener('blur', ()=>keys.clear());
const fwd=new T.Vector3(), right=new T.Vector3(), thrust=new T.Vector3(), desired=new T.Vector3(), deltaV=new T.Vector3(), direction=new T.Vector3(), projected=new T.Vector3();
function renderLayer(l, i, weight){
  if(!l)return;
  let p=observerAt(i), a=l.points.geometry.attributes.position;
  for(let j=0;
  j<l.data.length;
  j++)a.setXYZ(j, ...scale(sub(l.data[j].p, p), 1/unit));
  a.needsUpdate=true;
  l.points.material.uniforms.gain.value=exposure;
  l.points.material.uniforms.weight.value=weight
}function drawConic(line, o, obs){
  let b=Math.sqrt(1-o.e*o.e), a=line.geometry.attributes.position;
  for(let i=0;
  i<=256;
  i++){
    let E=TAU*i/256, p=add(scale(o.P, o.a*(Math.cos(E)-o.e)), scale(o.Q, o.a*b*Math.sin(E)));
    a.setXYZ(i, ...scale(sub(p, obs), 1/unit))
  }a.needsUpdate=true
}
function drawOrbits(){
  let q=orbitSelection();
  orbitLine.visible=!!q&&showOrbit&&matching(selected)===selected.parents.length;
  if(orbitLine.visible)drawConic(orbitLine, selectOrbit(q.b, q.star, time), observerAt(selected.parents.length));
  playerLine.visible=navMode!=='GRAVITY'&&!!player&&showOrbit&&levels[2]?.body.id===player.starId;
  if(!playerLine.visible)return;
  try{
    let k=playerAt(), info=conicInfo(k, G*playerStar.body.mass), closed=info.bound&&!info.near&&Number.isFinite(info.period)&&info.period<1e13, span=closed?info.period:predictionDays*86400, start=closed?seedAt(player, time).epoch:time, key=pathRevision+':'+closed;
    if(!pathCache||pathCache.key!==key||!closed&&Math.abs(time-pathCache.start)>span/256){
      let seed=seedAt(player, time), coords=[], count=0;
      pathStatus=closed?'CLOSED ELLIPTIC ORBIT':'FORWARD '+predictionDays+' DAY WINDOW / '+info.kind;
      for(let j=0;
      j<=256;
      j++){
        try{
          let p=universal(seed, G*playerStar.body.mass, start+span*j/256).position;
          coords.push(p);
          count++
        }catch(e){
          pathStatus='PREDICTION TRUNCATED: '+e.message;
          break
        }
      }pathCache={
        key, start, coords, count
      }
    }let a=playerLine.geometry.attributes.position, obs=observerAt(2);
    for(let j=0;
    j<pathCache.count;
    j++)a.setXYZ(j, ...scale(sub(pathCache.coords[j], obs), 1/unit));
    playerLine.geometry.setDrawRange(0, pathCache.count);
    a.needsUpdate=true
  }catch(e){
    playerLine.visible=false;
    pathStatus='PREDICTION UNAVAILABLE: '+e.message
  }
}
function autopilot(dt){
  let step=routeStep(auto), b=step.body, level=step.level, needs=b.kind!=='planet'&&level>=depth&&(levels[level+1]?.body.id!==b.id||!views[level+1]?.active&&levels[level+1]?.kind!=='system');
  if(needs){
    prepare(b, level);
    autoState='PREPARING';
    velocity.multiplyScalar(Math.exp(-dt*4));
    return
  }if(preparing){
    autoState='PREPARING';
    velocity.multiplyScalar(Math.exp(-dt*4));
    return
  }let p=b.a?state(b, auto.parents.at(-1)):b.p, obs=observerAt(level), bv=b.a?navVelocity(b, auto.parents.at(-1)):new T.Vector3();
  direction.set(...sub(p, obs));
  let distance=direction.length(), stop=b.kind==='galaxy'?b.radius*.8:b.kind==='star'?100*AU:b.radius*3, remaining=distance-stop;
  direction.normalize();
  let accel=Math.max(.01, Math.min(speedScale, Math.max(distance, b.radius)*.2)), allowed=Math.min(speedScale, Math.sqrt(2*accel*Math.max(0, remaining))*.65, Math.max(0, remaining)*.65);
  desired.copy(direction).multiplyScalar(allowed).add(bv);
  deltaV.copy(desired).sub(velocity);
  let dv=accel*dt;
  if(deltaV.length()>dv)deltaV.setLength(dv);
  velocity.add(deltaV);
  let rel=velocity.clone().sub(bv), closing=rel.dot(direction), brake=Math.max(0, closing)**2/(2*accel);
  autoState=closing>allowed*1.02||brake>Math.max(0, remaining)*.4?'BRAKING':allowed>=speedScale*.98&&Math.abs(closing-allowed)<speedScale*.02?'CRUISING':'ACCELERATING';
  let y=Math.atan2(-direction.x, -direction.z), diff=Math.atan2(Math.sin(y-yaw), Math.cos(y-yaw));
  yaw+=diff*(1-Math.exp(-dt*3));
  pitch+=(Math.asin(clamp(direction.y))-pitch)*(1-Math.exp(-dt*3));
  let tol=Math.max(1, stop*.005);
  if(step.final&&remaining<tol&&rel.length()<Math.max(.01, tol*.05)){
    if(!goalSatisfied(auto, levels, depth)){
      autoState='ENTERING SYSTEM';
      return
    }entryConfirmed=auto.goal==='system';
    velocity.copy(bv);
    auto=null;
    autoState='ARRIVED';
    notice('Explorer arrived · no physical orbital capture')
  }
}function marker(id, v){
  if(!nav||!hud||!v.lengthSq()){
    $(id).style.display='none';
    return
  }let front=v.dot(fwd)>0;
  projected.copy(v).normalize().multiplyScalar(10).project(camera);
  let ok=front&&Math.abs(projected.x)<.96&&Math.abs(projected.y)<.96;
  $(id).style.display=ok?'block':'none';
  if(ok){
    $(id).style.left=(projected.x*.5+.5)*innerWidth+'px';
    $(id).style.top=(-projected.y*.5+.5)*innerHeight+'px'
  }
}
function tick(t){
  let dt=last?Math.min((t-last)/1000, .05):0;
  last=t;
  let oldTime=time;
  if(!paused&&!transitioning)time+=dt*rate;
  camera.rotation.set(pitch, yaw, 0);
  if(navMode==='ROBOT')robotCamera();
  camera.updateMatrixWorld();
  camera.getWorldDirection(fwd);
  let f=levels[depth];
  if(t-lastLOD>2500&&!preparing&&!transitioning){
    lastLOD=t;
    for(let i=0;
    i<levels.length;
    i++)requestLOD(i)
  }if(!transitioning){
    if(navMode==='ROBOT'){
      try{advanceRobot(oldTime,time)}catch(e){time=oldTime;paused=true;robotNotice(e.message);}
    }else if(navMode==='GRAVITY'){
      try{
        advanceGravity(oldTime, time)
      }catch(e){
        time=oldTime;
        paused=true;
        gravityStatus(e.message);
        notice(e.message)
      }
    }else if(navMode==='PHYSICAL'){
      try{
        let k=playerAt();
        position.set(k.position);
        velocity.fromArray(k.velocity)
      }catch(e){
        time=oldTime;
        paused=true;
        fail(e.message)
      }
    }else if(locked){
      if(remainingTravel.lengthSq()>0){
        let back=remainingTravel.clone();
        remainingTravel.set(0, 0, 0);
        advanceSwept(back)
      }else{
        if(auto)autopilot(dt);
        else{
          right.setFromMatrixColumn(camera.matrixWorld, 0);
          thrust.set(0, 0, 0).addScaledVector(fwd, (keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)).addScaledVector(right, (keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0));
          thrust.y+=(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0);
          thrust.normalize();
          if(keys.has('KeyX')){
            velocity.multiplyScalar(Math.exp(-dt*10));
            if(velocity.length()<Math.max(.001, speedScale*1e-8))velocity.set(0, 0, 0)
          }else velocity.addScaledVector(thrust, speedScale*(keys.has('ShiftLeft')||keys.has('ShiftRight')?8:1)*dt)
        }advanceSwept(velocity.clone().multiplyScalar(dt))
      }
    }let moved=queryPos?norm(sub(queryPos, Array.from(position))):Infinity;
    if(t-lastQuery>500||moved>Math.max(1, Math.abs(query?.best?.surface||0)*.05)&&t-lastQuery>150){
      lastQuery=t;
      queryNearest()
    }
  }
  for(let i=0;
  i<views.length;
  i++){
    let v=views[i];
    if(!v||!levels[i])continue;
    let weight=1;
    if(i>depth){
      let p=observerAt(i), rad=levels[i].kind==='galaxy'?levels[i].body.radius:AU*400;
      weight=Math.max(0, Math.min(1, (rad*8-norm(p))/(rad*6)))
    }let fade=Math.min(1, Math.max(0, (t-v.fadeAt)/900));
    if(v.active)renderLayer(v.active, i, weight*(v.old?fade:1));
    if(v.old){
      renderLayer(v.old, i, weight*(1-fade));
      if(fade===1){
        disposeLayer(v.old);
        v.old=null
      }
    }if(levels[i].kind==='system'){
      let p=observerAt(i);
      for(let x of v.meshes){
        let q=state(x.b, levels[i].body);
        x.mesh.position.set(...scale(sub(q, p), 1/unit));
        x.mesh.scale.setScalar(x.b.radius/unit);
        if(x.b.central)light.position.copy(x.mesh.position);
        x.mesh.visible=weight>.001
      }
    }
  }drawOrbits();
  aim=-1;
  let best=.997, data=views[depth]?.data||[];
  for(let i=0;
  i<data.length;
  i++){
    let d=sub(data[i].p, Array.from(position)), len=norm(d), cos=len?(d[0]*fwd.x+d[1]*fwd.y+d[2]*fwd.z)/len:0;
    if(cos>best){
      best=cos;
      aim=i
    }
  }f=levels[depth];
  let met=selectedMetrics(), ci=navMode==='PHYSICAL'?conicInfo({
    position:Array.from(position), velocity:velocity.toArray()
  }, G*playerStar.body.mass):null;
  marker('prograde', velocity);
  if(met&&!met.remote)marker('targetMark', met.delta);
  else $('targetMark').style.display='none';
  $('flightHUD').textContent=transitioning?'PREPARING EXPLICIT HANDOFF':navMode==='PHYSICAL'?'PHYSICAL / '+ci.kind+' / FIXED STAR REFERENCE':'EXPLORER / NONPHYSICAL';
  $('stats').textContent='MODE / '+navMode+'\nFRAME / '+f.name+'\n'+(ci?'REFERENCE / '+playerStar.body.name+'\nCLASS / '+ci.kind+'\nENERGY / '+ci.energy.toExponential(7)+' J/kg\nSPEED / '+fmt(ci.speed)+'/sim s\nRADIAL / '+fmt(ci.radialSpeed)+'/sim s\nPULSE / '+pulseSize.toFixed(3)+' m/s\nMANEUVERS / '+player.maneuvers.length:'AUTO / '+autoState+'\nSPEED / '+fmt(velocity.length())+'/s\nCAP / '+fmt(speedScale)+'/s')+'\nZOOM / '+(65/fov).toFixed(2)+'×\nTARGET / '+(selected?selected.body.name:'NONE')+'\nWORLD EVENTS / '+world.events.length+'\nEPOCH + '+(time/86400).toFixed(5)+' days\n'+(paused?'CLOCK PAUSED':'TIME ×'+rate)+'\nCROSSINGS / '+crossings+' · BUILDS '+buildsAtCross+'\nWORLD / '+persistence;
  $('help').textContent=ci?'PHYSICAL: W/S ±T · D/A ±R · E/Q ±N / ONE PULSE PER PRESS\n, . · PULSE SIZE / NO INSTANT BRAKE OR PHYSICAL AUTOPILOT\nI · PLAYER / JOURNAL / DIRECTORY / O · PATHS / M · BODY\nSPACE · CLOCK / T · RATE / K · SAVE ACTIVE / F2 · TESTS':'EXPLORER: WASD Q E · THRUST / , . · SPEED / SHIFT · BOOST\nJ · AUTO / X · NONPHYSICAL BRAKE / I · DIRECTORY + PLAYER\nM · BODY / B · BOOKMARK / O · PATHS / SCROLL · ZOOM\nSPACE · CLOCK / T · RATE / K · SAVE ACTIVE / F2 · TESTS';
  if(query){
    let b=query.best, c=b?norm(sub(f.kind==='system'?state(b.body, f.body):b.body.p, Array.from(position))):null;
    $('prox').textContent='CANDIDATE / '+(b?b.body.name:'SEARCHING')+(b?'\nSURFACE / '+fmt(c-b.body.radius)+'\nCENTER / '+fmt(c):'')+'\nSEARCH / '+(query.complete?'COMPLETE AT QUERY STATE':'BUDGET-LIMITED')+'\nAGE / '+((t-queryAt)/1000).toFixed(2)+' s'+(ci?'\nGRAVITY: REFERENCE STAR ONLY\n'+pathStatus:'')
  }else $('prox').textContent='Querying…';
  if(panelOpen)refreshInspector();
  if(testPanel)$('tests').textContent='GENERATOR / UNIVERSAL PLAYER CHECKS\n'+(tests?Object.entries(tests).map(([k, v])=>k+' / '+(v?'PASS':'FAIL')).join('\n'):'Running…')+(metrics?'\n\nRESIDUALS\n'+Object.entries(metrics).map(([k, v])=>k+' / '+v.toExponential(5)).join('\n'):'')+'\n\nRuntime failures / '+failures+'\nExplorer sweeps / '+sweepEvents+' · budget hits '+eventLimitHits+'\n\nMANUAL CHECKLIST — NOT AUTOMATICALLY PASSED\n• Restore/migrate v1 player; compare state\n• Preview and apply escape Δv; class becomes hyperbolic\n• Open prediction arc, fixed reference star\n• Journal contains applied events, not previews\n• Save/reload v2 journal and clock\n• Explorer save does not overwrite physical checkpoint\n\nNo automatic handoffs, planetary gravity or physical autopilot.';
  if(t>until)$('msg').textContent='';
  if(navMode==='GRAVITY')gravityHUD(t);
  if(navMode==='ROBOT'){robotCamera();robotHUD();}
  renderer.render(scene, camera);
  requestAnimationFrame(tick)
}
function policyTests(){
  let configs=['v4-planar', 'v5-planar', 'v5-spatial'].map(sessionConfig), store=d=>({
    getItem:k=>d[k]||null
  }), mu=G*1.98847e30, seed={
    position:[AU, 0, 0], velocity:[0, 0, Math.sqrt(mu/AU)], epoch:0
  }, p={
    seed, maneuvers:[]
  }, before=universal(seed, mu, 100), dv=velocityPulse(before, 0, 1000, 0), ev={
    seq:1, time:100, before, after:{
      position:before.position, velocity:dv.velocity
    }
  }, afterP={
    seed, maneuvers:[ev]
  };
  return{
    saveNamespacesDistinct:new Set(configs.flatMap(c=>[c.observer, c.books, c.world, 'atlas-physical-player-v1:'+c.mode])).size===12, oldPlanarPreference:chooseSession(store({
      'atlas-active-generation-v1':NEW
    }))==='v5-planar', freshSpatialDefault:chooseSession(store({
    }))==='v5-spatial', historyBeforeManeuver:JSON.stringify(universal(seedAt(afterP, 50), mu, 50))===JSON.stringify(universal(seed, mu, 50)), historyAtManeuver:JSON.stringify(universal(seedAt(afterP, 100), mu, 100).velocity)===JSON.stringify(dv.velocity), checkpointSerialization:JSON.stringify(universal(seedAt(JSON.parse(JSON.stringify(afterP)), 150), mu, 150))===JSON.stringify(universal(seedAt(afterP, 150), mu, 150)), sweptEntry:Math.abs(sphereEvent([-2, 0, 0], [4, 0, 0], [0, 0, 0], 1, true)-.25)<1e-12
  }
}
// ============================================================================
// LOCAL GRAVITY MODE / UI / INDEPENDENT SAVE CONTRACT
// ============================================================================
const GRAVITY_KEY='atlas-local-gravity-player-v1:'+MODE;
let gravityPlayer=null, gravityStar=null, gravityPlanets=[];
let gravityExplorerSnapshot=null, gravityStored=null, gravityRaw='';
let gravityAcceleration=20, gravityLastSteps=0;
function gravityStatus(text){
  $('gravityStatus').textContent=text;
}
function worldGravitySignature() {
  const text=JSON.stringify({
    generation:VER, layout:LAYOUT, events:world.events
  });
  let hash=2166136261;
  for(const c of text)hash=Math.imul(hash^c.charCodeAt(0), 16777619);
  return 'fnv1a32:'+((hash>>>0).toString(16))+':'+text.length;
}
function gravitySourcesAt(epoch) {
  if(!gravityStar)throw Error('No gravity reference system.');
  const star=gravityStar.body;
  return [{
    id:star.id, kind:'star', mass:star.mass, radius:star.radius, position:[0, 0, 0], velocity:[0, 0, 0]
  },
  ...gravityPlanets.map(body=>{
    const k=physical(body, star, epoch), properties=withPlanetGravity(body);
    return {
      id:body.id, kind:'planet', mass:properties.mass, radius:body.radius, position:k.position, velocity:k.velocity
    };
  })];
}
function gravityThrustVector() {
  if(!locked||paused||transitioning||panelOpen)return [0, 0, 0];
  const forward=new T.Vector3();
  camera.getWorldDirection(forward);
  const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const thrust=new T.Vector3().addScaledVector(forward, (keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0))
  .addScaledVector(right, (keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0));
  thrust.y+=(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0);
  if(thrust.lengthSq())thrust.normalize().multiplyScalar(gravityAcceleration);
  return thrust.toArray();
}
function advanceGravity(oldTime, newTime) {
  if(!gravityPlayer||newTime===oldTime)return;
  const next=integrateLocalGravity(gravityPlayer, oldTime, newTime, gravitySourcesAt, gravityThrustVector());
  gravityPlayer={
    position:next.position, velocity:next.velocity, contact:next.contact
  };
  gravityLastSteps=next.steps;
  position.set(next.position);
  velocity.fromArray(next.velocity);
}
function gravityKey(e) {
  const controls=['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyX', 'KeyJ', 'Comma', 'Period'];
  if(!controls.includes(e.code))return false;
  e.preventDefault();
  if(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code))keys.add(e.code);
  else if(!e.repeat) {
    if(e.code==='Comma'||e.code==='Period') {
      gravityAcceleration=Math.max(.01, Math.min(1000, gravityAcceleration*(e.code==='Period'?2:.5)));
      $('gravityThrust').value=gravityAcceleration;
      notice('Local-gravity manual acceleration '+gravityAcceleration+' m/s²');
    } else notice('No instant brake or autopilot in Local Gravity.');
  }
  return true;
}
function validateGravityCheckpoint(d) {
  if(!d||d.version!==1||d.model!=='local-gravity-player-v1'||d.massModel!=='density-proxy-v1'
  ||d.generation!==VER||d.baselineLayout!==LAYOUT||typeof d.starId!=='string'
  ||!d.starId.startsWith(VER+'/')||d.starId.length>1500||!Number.isFinite(d.time)||d.time<0
  ||![1, 3600, 86400].includes(d.rate)||typeof d.paused!=='boolean'
  ||!d.state||!finiteVector(d.state.position)||!Number.isFinite(norm(d.state.position))||!finiteVector(d.state.velocity)||norm(d.state.velocity)>1e7
  ||typeof d.worldSignature!=='string'||!Number.isFinite(d.thrust)||d.thrust<.01||d.thrust>1000)
  throw Error('Invalid or incompatible local-gravity checkpoint.');
  if(d.state.contact&&(
  typeof d.state.contact.bodyId!=='string'||!finiteVector(d.state.contact.normal)
  ||Math.abs(norm(d.state.contact.normal)-1)>1e-8))throw Error('Invalid gravity contact state.');
  return structuredClone(d);
}
try {
  gravityRaw=localStorage.getItem(GRAVITY_KEY)||'';
  if(gravityRaw)gravityStored=validateGravityCheckpoint(JSON.parse(gravityRaw));
} catch(e){
  gravityStatus('Original gravity JSON preserved; load failed: '+e.message);
}
async function activateGravity(candidate, restoreClock=false) {
  if(navMode!=='EXPLORER')throw Error('Return to Explorer before activating Local Gravity.');
  if(transitioning||preparing)throw Error('Wait for current navigation preparation.');
  candidate=validateGravityCheckpoint(candidate);
  if(candidate.worldSignature!==worldGravitySignature())throw Error('World edits differ from this checkpoint. Restore its matching world backup first.');
  const target=await verify(candidate.starId);
  if(target.body.kind!=='star')throw Error('Gravity reference must be a generated star.');
  const ps=await ask('planets', {
    star:target.body
  }), epoch=restoreClock?candidate.time:time;
  if(!restoreClock&&candidate.time!==time)throw Error('Initialization epoch mismatch.');
  const sources=[{
    id:target.body.id, kind:'star', mass:target.body.mass, radius:target.body.radius, position:[0, 0, 0], velocity:[0, 0, 0]
  },
  ...ps.map(b=>({
    ...withPlanetGravity(b), ...physical(b, target.body, epoch)
  }))];
  const proposed=structuredClone(candidate.state);
  for(const source of sources) {
    const distance=norm(sub(proposed.position, source.position));
    if(distance<source.radius-0.01)throw Error('Checkpoint is inside a celestial body in the current world.');
  }
  if(proposed.contact) {
    const body=sources.find(b=>b.id===proposed.contact.bodyId&&b.kind==='planet');
    if(!body)throw Error('Contact planet does not belong to this system.');
    const expected=add(body.position, scale(proposed.contact.normal, body.radius+2));
    if(norm(sub(expected, proposed.position))>.1||norm(sub(proposed.velocity, body.velocity))>.001)
    throw Error('Checkpoint contact is inconsistent with planet ephemeris.');
  }
  const snapshot=snapshotExplorer(), oldClock={
    time, rate, paused
  };
  transitioning=true;
  cancelAuto();
  try {
    const galaxy=target.parents[0];
    gravityExplorerSnapshot=snapshot;
    gravityStar=target;
    gravityPlanets=ps;
    gravityPlayer=proposed;
    if(restoreClock){
      time=candidate.time;
      rate=candidate.rate;
      paused=candidate.paused;
    }
    gravityAcceleration=candidate.thrust;
    navMode='GRAVITY';
    keys.clear();
    await rebuildContext([universe, {
      kind:'galaxy', name:galaxy.name, body:galaxy, root:groot(galaxy)
    },
    {
      kind:'system', name:target.body.name, body:target.body, planets:ps
    }], 2, proposed.position, proposed.velocity);
    selected=target;
    autoState='DISABLED IN LOCAL GRAVITY';
    gravityStatus('Local Gravity active. Star + '+ps.length+' planets. Original physical checkpoint unchanged.');
  } catch(e) {
    navMode='EXPLORER';
    time=oldClock.time;
    rate=oldClock.rate;
    paused=oldClock.paused;
    await rebuildContext(snapshot.levels, snapshot.depth, snapshot.position, snapshot.velocity);
    selected=snapshot.selected;
    gravityExplorerSnapshot=null;
    throw e;
  } finally{
    transitioning=false;
  }
}
async function initializeGravity(kind) {
  if(!paused)throw Error('Pause shared clock before initializing Local Gravity.');
  if(navMode!=='EXPLORER')throw Error('Return to Explorer first.');
  const thrustValue=Number($('gravityThrust').value);
  if(!$('gravityThrust').value.trim()||!Number.isFinite(thrustValue)||thrustValue<.01||thrustValue>1000)throw Error('Manual acceleration must be 0.01–1,000 m/s².');
  let starId, state, planetTarget=null;
  if(kind==='current') {
    if(depth!==2||levels[2]?.kind!=='system')throw Error('Current-state handoff requires Explorer inside a star system.');
    starId=levels[2].body.id;
    state={
      position:Array.from(position), velocity:velocity.toArray(), contact:null
    };
  } else {
    if(selected?.body.kind!=='planet')throw Error('Select a planet in Objects or the inspector first.');
    planetTarget=await verify(selected.body.id);
    const planet=withPlanetGravity(planetTarget.body), star=planetTarget.parents.at(-1);
    const altitude=Number($('gravityAltitude').value);
    if(!$('gravityAltitude').value.trim()||!Number.isFinite(altitude)||altitude<10||altitude>1e9)throw Error('Altitude must be 10–1,000,000,000 m.');
    const k=physical(planet, star), radial=[0, 1, 0], tangent=[1, 0, 0], r=planet.radius+altitude;
    starId=star.id;
    state={
      position:add(k.position, scale(radial, r)), velocity:k.velocity.slice(), contact:null
    };
    if(kind==='orbit')state.velocity=add(state.velocity, scale(tangent, Math.sqrt(G*planet.mass/r)));
  }
  if(!confirm('Activate LOCAL GRAVITY using '+kind+' initialization? '+
  (kind==='current'?'Preserve Explorer Cartesian state.':'Explicit sandbox placement and velocity assignment.')+
  ' Star and planets contribute gravity; planetary trajectories remain prescribed. Original checkpoint is separate.'))return;
  const candidate={
    version:1, model:'local-gravity-player-v1', massModel:'density-proxy-v1', generation:VER, baselineLayout:LAYOUT,
    starId, state, time, rate, paused, thrust:thrustValue, worldSignature:worldGravitySignature()
  };
  await activateGravity(candidate);
  if(planetTarget){
    selected=planetTarget;
    pitch=-1.4;
    yaw=0;
    fillInputs();
  }
  tab('gravity');
}
async function leaveGravity() {
  if(navMode!=='GRAVITY'||transitioning)return;
  const snap=gravityExplorerSnapshot;
  if(!snap)throw Error('Explorer snapshot missing.');
  transitioning=true;
  try {
    navMode='EXPLORER';
    keys.clear();
    await rebuildContext(structuredClone(snap.levels), snap.depth, snap.position, snap.velocity);
    yaw=snap.yaw;
    pitch=snap.pitch;
    fov=snap.fov;
    camera.fov=fov;
    camera.updateProjectionMatrix();
    selected=snap.selected;
    gravityExplorerSnapshot=null;
    gravityStatus('Explorer restored. Gravity checkpoint and original single-star checkpoint unchanged.');
  } finally{
    transitioning=false;
  }
}
function gravityCheckpoint() {
  if(navMode!=='GRAVITY'||!gravityPlayer||!gravityStar)throw Error('Local Gravity must be active to save it.');
  return validateGravityCheckpoint({
    version:1, model:'local-gravity-player-v1', massModel:'density-proxy-v1', generation:VER,
    baselineLayout:LAYOUT, starId:gravityStar.body.id, state:structuredClone(gravityPlayer), time, rate, paused,
    thrust:gravityAcceleration, worldSignature:worldGravitySignature()
  });
}
function saveGravity() {
  try {
    if(transitioning)throw Error('Wait for mode transition.');
    const data=gravityCheckpoint();
    if(!persistWorld())throw Error(persistence);
    const raw=JSON.stringify(data);
    localStorage.setItem(GRAVITY_KEY, raw);
    localStorage.setItem(NAVKEY, 'GRAVITY');
    gravityStored=data;
    gravityRaw=raw;
    gravityStatus('Saved local gravity + world at '+time.toFixed(3)+' s. Original physical/Explorer checkpoints untouched.');
    notice('Local gravity + world saved');
    return true;
  } catch(e){
    gravityStatus('Save incomplete: '+e.message);
    return false;
  }
}
function refreshGravity() {
  let text='MODE: '+navMode+'\nMODEL: local-gravity-player-v1 / density-proxy-v1\nCHECKPOINT KEY: '+GRAVITY_KEY;
  if(navMode==='GRAVITY'&&gravityPlayer&&gravityStar) {
    const sources=gravitySourcesAt(time), a=gravityVectorAt(gravityPlayer.position, sources);
    text+='\nREFERENCE SYSTEM: '+gravityStar.body.name+'\nACTIVE SOURCES: '+sources.length+' (all local planets + star)'
    +'\nNET ACCELERATION: '+norm(a).toPrecision(8)+' m/s²\nLAST SUBSTEPS: '+gravityLastSteps
    +'\nCONTACT: '+(gravityPlayer.contact?gravityPlayer.contact.bodyId:'none')
    +'\nMANUAL ACCELERATION: '+gravityAcceleration+' m/s²\nNo full-body orbital backreaction / no galaxy gravity.';
  }
  if(gravityStored)text+='\nSAVED EPOCH: '+gravityStored.time.toFixed(3)+' s';
  $('gravityInfo').textContent=text;
}
function gravityHUD(t) {
  const sources=gravitySourcesAt(time), a=gravityVectorAt(gravityPlayer.position, sources);
  const ranked=sources.map(b=>({
    body:b, strength:G*b.mass/norm(sub(b.position, gravityPlayer.position))**2
  })).sort((a, b)=>b.strength-a.strength);
  const dominant=ranked[0].body, relative=sub(gravityPlayer.velocity, dominant.velocity);
  $('flightHUD').textContent='LOCAL GRAVITY / STAR + PLANETS / NUMERICAL';
  $('stats').textContent='MODE / LOCAL GRAVITY\nSYSTEM / '+gravityStar.body.name+'\nSOURCES / '+sources.length
  +'\nNET g / '+norm(a).toPrecision(6)+' m/s²\nDOMINANT / '+(gravityPlanets.find(b=>b.id===dominant.id)?.name||gravityStar.body.name)
  +'\nRELATIVE SPEED / '+fmt(norm(relative))+'/s\nHEIGHT / '+fmt(norm(sub(gravityPlayer.position, dominant.position))-dominant.radius)
  +'\nTHRUST / '+gravityAcceleration+' m/s²\nCONTACT / '+(gravityPlayer.contact?'LOCKED TO SPHERE':'FREE FLIGHT')
  +'\nSUBSTEPS / '+gravityLastSteps+'\nEPOCH / '+time.toFixed(3)+' s\n'+(paused?'CLOCK PAUSED':'TIME ×'+rate);
  $('help').textContent='LOCAL GRAVITY: WASD / E Q · CONTINUOUS IDEAL THRUST\n, . · ACCELERATION / NO INSTANT BRAKE OR AUTO\nSPACE · CLOCK / T · RATE / K · SEPARATE SAVE\nI · LOCAL GRAVITY TAB / F2 · CHECKS';
}
$('openGravityMenu').onclick=()=>{
  openInspector();
  tab('gravity')
};
$('gravityDrop').onclick=()=>initializeGravity('drop').catch(e=>gravityStatus(e.message));
$('gravityOrbit').onclick=()=>initializeGravity('orbit').catch(e=>gravityStatus(e.message));
$('gravityCurrent').onclick=()=>initializeGravity('current').catch(e=>gravityStatus(e.message));
$('gravityLeave').onclick=()=>leaveGravity().catch(e=>gravityStatus(e.message));
$('gravitySave').onclick=saveGravity;
$('gravitySetThrust').onclick=()=>{
  const value=Number($('gravityThrust').value);
  if(!$('gravityThrust').value.trim()||!Number.isFinite(value)||value<.01||value>1000){
    gravityStatus('Acceleration must be 0.01–1,000 m/s².');
    return;
  }gravityAcceleration=value;
  gravityStatus('Manual acceleration set to '+value+' m/s².');
};
$('gravityRestore').onclick=()=>{
  if(!gravityStored){
    gravityStatus('No valid saved local-gravity checkpoint.');
    return;
  }
  if(navMode!=='EXPLORER'){
    gravityStatus('Return to Explorer before restore.');
    return;
  }
  if(confirm('Restore LOCAL GRAVITY and shared clock to '+gravityStored.time.toFixed(3)+' s? Original physical checkpoint unchanged.'))
  activateGravity(gravityStored, true).catch(e=>gravityStatus(e.message));
};
$('gravityExport').onclick=()=>{
  $('gravityJSON').value=gravityRaw;
  $('gravityJSON').focus();
  $('gravityJSON').select();
  gravityStatus('Last saved/original local-gravity JSON; unsaved live changes excluded.');
};
$('gravityImport').onclick=()=>{
  try {
    if($('gravityJSON').value.length>50000)throw Error('Gravity JSON too large.');
    const data=validateGravityCheckpoint(JSON.parse($('gravityJSON').value));
    if(navMode!=='EXPLORER')throw Error('Return to Explorer before import.');
    if(confirm('Restore imported LOCAL GRAVITY and shared clock to '+data.time.toFixed(3)+' s? This does not overwrite the saved checkpoint until Save.'))
    activateGravity(data, true).catch(e=>gravityStatus(e.message));
  } catch(e){
    gravityStatus(e.message);
  }
};
function localGravityTests() {
  const source={
    id:'test', kind:'star', mass:1/G, radius:.1, position:[0, 0, 0], velocity:[0, 0, 0]
  };
  const a=gravityVectorAt([2, 0, 0], [source]), b=gravityVectorAt([4, 0, 0], [source]);
  const cancellation=gravityVectorAt([0, 0, 0], [{
    ...source, position:[2, 0, 0]
  }, {
    ...source, id:'other', position:[-2, 0, 0]
  }]);
  const moving=t=>[{
    id:'planet', kind:'planet', mass:1/G, radius:1, position:[t*.1, 0, 0], velocity:[.1, 0, 0]
  }];
  const fall=integrateLocalGravity({
    position:[0, 5, 0], velocity:[.1, -2, 0], contact:null
  }, 0, 5, moving);
  const after=integrateLocalGravity(fall, 5, 6, moving);
  const start={
    position:[10, 0, 0], velocity:[0, Math.sqrt(.1), 0], contact:null
  }, period=TAU*Math.sqrt(1000);
  const orbit=integrateLocalGravity(start, 0, period, ()=>[source], [0, 0, 0], 20000);
  const energy=k=>dot(k.velocity, k.velocity)/2-1/norm(k.position);
  let budgetAtomic=false;
  const copy=JSON.stringify(start);
  try{
    integrateLocalGravity(start, 0, 100, ()=>[source], [0, 0, 0], 1)
  }catch(e){
    budgetAtomic=JSON.stringify(start)===copy;
  }
  return {
    localGravityInverseSquare:Math.abs(norm(a)/norm(b)-4)<1e-12,
    localGravityPointsInward:a[0]<0&&a[1]===0&&a[2]===0,
    localGravitySuperposition:norm(cancellation)<1e-14,
    localGravityPlanetMass:withPlanetGravity({
      radius:6371000
    }).mass>0,
    localGravityCircularEnergy:Math.abs(energy(orbit)-energy(start))<1e-6,
    localGravityMovingSphereContact:!!fall.contact&&norm(sub(after.velocity, [.1, 0, 0]))<1e-12,
    localGravityContactFollowsTranslation:Math.abs(norm(sub(after.position, moving(6)[0].position))-3)<1e-10,
    localGravityBudgetAtomic:budgetAtomic
  };
}
window.addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight)
});
ask('test').then(r=>{
  let m=modelTests();
  metrics=m.metrics;
  tests={
    ...r, ...policyTests(), ...m.checks, ...localGravityTests()
  };
  if(!Object.values(tests).every(Boolean))fail('Startup checks')
}).catch(e=>fail(e.message));

// Additive Phase 2 robot session. Original navigation saves remain separate.
const RK=AtlasRobotKernel,MF=AtlasMaterialFoundation;
const ROBOT_HOME={id:'atlas-authored-home-development-v1',version:1,rotationEnabled:false,terrain:'radial-solid-relief-v1',cellM:4,chunkM:64};
let robotWorld=null,robotState=null,robotSavedRevision=null,robotHome=null,robotLegacy=null,robotSaving=false,robotActionBusy=false,robotJump=false,robotAnchor=null,robotMessage='No robot world active',robotStreamMS=0;
const robotGround=new T.Group(),robotBody=new T.Group();scene.add(robotGround,robotBody);robotGround.visible=robotBody.visible=false;
const robotGroundMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
const robotMetal=new T.MeshStandardMaterial({color:0x899ba2,roughness:.6,metalness:.65});
const torso=new T.Mesh(new T.BoxGeometry(.48,.65,.28),robotMetal);torso.position.y=-.15;robotBody.add(torso);
for(const side of [-1,1]){const arm=new T.Mesh(new T.BoxGeometry(.14,.65,.14),robotMetal);arm.position.set(side*.34,-.16,0);robotBody.add(arm);const leg=new T.Mesh(new T.BoxGeometry(.18,.5,.2),robotMetal);leg.position.set(side*.15,-.65,0);robotBody.add(leg);}
function robotNotice(text){robotMessage=text;robotStatus.textContent=text;notice(text);}
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
 const c=locked&&!panelOpen?{yaw,forward:(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),right:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),jump:robotJump}:{yaw};
 const prior=robotState;robotState=RK.step(prior,newTime-oldTime,oldTime,c);robotState.yaw=yaw;robotState.pitch=pitch;robotJump=false;
 try{streamRobotGround();}catch(e){robotState=prior;throw e;}
 const o=RK.orbit(newTime);position.set(RK.add(o.position,robotState.positionM));velocity.fromArray(RK.add(o.velocity,robotState.velocityMps));robotVisuals();
}
function robotKey(e){
 if(!['KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','KeyL','KeyT','KeyJ','KeyX','Comma','Period'].includes(e.code))return false;
 e.preventDefault();if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code))keys.add(e.code);
 else if(e.code==='KeyE'&&!e.repeat&&robotState.grounded&&!paused)robotJump=true;
 else if(!e.repeat)notice(e.code==='KeyL'?'L remains reserved for the future jetpack. No flight installed.':'Robot controls: WASD walk, Shift run, E grounded jump; normal-time physics only.');return true;
}
function robotHUD(){
 $('flightHUD').textContent='ROBOT / PLANETARY SURFACE / DEVELOPMENT HOME';
 $('stats').textContent='WORLD / '+robotWorld.worldId+'\nCONTACT / '+(robotState.grounded?'GROUNDED':'AIRBORNE')+'\nGROUND-REL SPEED / '+RK.len(robotState.velocityMps).toFixed(3)+' m/s\nSYSTEM SPEED / '+velocity.length().toFixed(3)+' m/s\nALTITUDE / '+(RK.distance(robotState.positionM)-.9).toFixed(3)+' m\nLOCAL g / '+RK.len(RK.gravity(robotState.positionM,time)).toFixed(4)+' m/s²\nCHUNKS / '+robotGround.children.length+'\nLAST STREAM / '+robotStreamMS.toFixed(1)+' ms\nTIME / '+time.toFixed(3)+' s · '+(paused?'PAUSED':'x1')+'\nSAVE / '+robotMessage;
 $('help').textContent='ROBOT: WASD WALK / SHIFT RUN / E GROUNDED JUMP\nMOUSE LOOK / SPACE PAUSE / K SAVE ROBOT WORLD\nESC MENU / I DIRECTORY / L RESERVED, NO FLIGHT';
 $('prox').textContent='DEVELOPMENT HOME PLANET\nProcedural solid ground; visual grass tint only\n4 m samples / 64 m chunks / rotation disabled\nRobot collision: spherical proxy, radius 0.9 m\nNo excavation, damage, resources or fabrication yet.';
}
function homeTarget(id){
 if(!robotHome)return null;const h=robotHome;
 if(id===h.star.id)return {version:1,generation:VER,baselineLayout:LAYOUT,body:h.star,parents:[h.galaxy],verified:true};
 if(id===h.planet.id)return {version:1,generation:VER,baselineLayout:LAYOUT,body:h.planet,parents:[h.galaxy,h.star],verified:true};return null;
}
async function enterRobotWorld(w,revision){
 if(navMode!=='EXPLORER'||transitioning||preparing)throw Error('Return to Explorer and wait for initialization first');
 MF.validWorld(w);const d=w.homeSystem.definition;
 if(w.homeSystem.definitionVersion!==1||!d)throw Error('Unsupported home definition');
 for(const [key,value] of Object.entries(ROBOT_HOME))if(d[key]!==value)throw Error('Incompatible home setting: '+key);
 if(d.generation!==VER||d.layout!==LAYOUT)throw Error('Switch to the original robot-world preset: '+d.preset);
 if(d.planetRadiusM!==RK.R||d.planetMassKg!==RK.M||d.starMassKg!==RK.S||d.orbitRadiusM!==RK.AU)throw Error('Incompatible physical constants');
 const rs=w.robot.surfaceState;RK.step(rs,0,w.timeS,{});if(Math.abs(rs.pitch)>1.55||RK.distance(rs.positionM)<.85)throw Error('Invalid saved robot placement/view');
 const galaxy=(await verify(d.galaxyId)).body,snap=snapshotExplorer(),clock={time,rate,paused};
 robotLegacy={snap,clock,background:scene.background.clone(),near:camera.near,far:camera.far};
 const star={id:ROBOT_HOME.id+'/star',name:'Development home star',kind:'star',p:[0,0,0],mass:RK.S,radius:696340000,color:0xffefd1,authored:true};
 const planet={id:ROBOT_HOME.id+'/planet',name:'Development home planet',kind:'planet',a:RK.AU,phase:0,radius:RK.R,mass:RK.M,color:0x6c8254,authored:true};
 transitioning=true;cancelAuto();
 try{
  robotHome={star,planet,galaxy};robotWorld=w;robotSavedRevision=revision;robotState=structuredClone(rs);time=w.timeS;rate=1;paused=false;navMode='ROBOT';yaw=rs.yaw;pitch=rs.pitch;keys.clear();
  const o=RK.orbit(time);await rebuildContext([universe,{kind:'galaxy',name:galaxy.name,body:galaxy,root:groot(galaxy)},{kind:'system',name:'Development home system',body:star,planets:[planet]}],2,RK.add(o.position,rs.positionM),RK.add(o.velocity,rs.velocityMps));
  unit=1;camera.near=.05;camera.far=1e13;camera.updateProjectionMatrix();scene.background=new T.Color(0x8aa5b5);selected=homeTarget(planet.id);clearRobotGround();streamRobotGround();robotVisuals();robotCamera();
  const pview=views[2].meshes.find(x=>x.b.id===planet.id);if(pview){const g=new T.SphereGeometry(1,128,64),a=g.attributes.position;for(let i=0;i<a.count;i++){const n=RK.unit([a.getX(i),a.getY(i),a.getZ(i)]);a.setXYZ(i,...RK.mul(n,1+RK.height(n)/RK.R));}g.computeVertexNormals();pview.mesh.geometry=g;pview.mesh.userData.robotOwnedGeometry=true;}
  $('enter').textContent='Enter ROBOT view';robotNotice(revision===null?'New unsaved robot world — K saves separately':'Robot snapshot restored; legacy saves unchanged');
 }catch(e){
  robotGround.visible=robotBody.visible=false;clearRobotGround();navMode='EXPLORER';time=clock.time;rate=clock.rate;paused=clock.paused;scene.background=robotLegacy.background;camera.near=robotLegacy.near;camera.far=robotLegacy.far;camera.position.set(0,0,0);camera.up.set(0,1,0);camera.updateProjectionMatrix();await rebuildContext(snap.levels,snap.depth,snap.position,snap.velocity);yaw=snap.yaw;pitch=snap.pitch;selected=snap.selected;robotWorld=null;robotState=null;robotHome=null;robotLegacy=null;throw e;
 }finally{transitioning=false;}
}
async function newRobotWorld(){
 if(!window.ready||navMode!=='EXPLORER')throw Error('Wait for initialization and return to Explorer first');
 const galaxy=await ask('rank',{root:universe.root,kind:'universe',rank:0}),id='mw-'+crypto.randomUUID(),w=MF.newWorld(id),rs=RK.spawn();
 w.homeSystem={status:'configured-development',definitionVersion:1,rotationEnabled:false,definition:{...ROBOT_HOME,generation:VER,layout:LAYOUT,preset:MODE,galaxyId:galaxy.id,planetRadiusM:RK.R,planetMassKg:RK.M,starMassKg:RK.S,orbitRadiusM:RK.AU}};
 w.robot={id:id+'/robot',status:'embodied',bodyId:id+'/robot-body',surfaceState:rs};
 w.solids[id+'/robot-proxy']={definition:{kind:'sphere',centerM:[0,0,0],rotation:MF.identity(),radiusM:.9}};
 w.bodies[id+'/robot-body']={id:id+'/robot-body',solidId:id+'/robot-proxy',positionM:rs.positionM.slice(),velocityMps:rs.velocityMps.slice(),batchIds:[],massKg:120,massModel:'assigned-chassis-material-unmodeled',frame:'planet-fixed-nonrotating'};
 const o=RK.orbit(0);w.frames['planet-fixed-nonrotating']={originM:o.position,velocityMps:o.velocity,rotation:MF.identity(),rotationEnabled:false};await enterRobotWorld(w,null);
}
async function saveRobotWorld(){
 if(robotSaving||navMode!=='ROBOT'||transitioning)return false;robotSaving=true;
 try{
 const rs=structuredClone(robotState),epoch=time,tx=MF.transact(robotWorld,'snapshot-'+crypto.randomUUID(),{kind:'robot-snapshot',timeS:epoch},w=>{w.timeS=epoch;w.robot.surfaceState=rs;const b=w.bodies[w.robot.bodyId];b.positionM=rs.positionM.slice();b.velocityMps=rs.velocityMps.slice();const f=w.frames['planet-fixed-nonrotating'],o=RK.orbit(epoch);f.originM=o.position;f.velocityMps=o.velocity;return {timeS:epoch};});
 await MF.save(tx.world,robotSavedRevision);robotWorld=tx.world;robotSavedRevision=tx.world.revision;robotNotice('Saved snapshot r'+robotSavedRevision+' at '+epoch.toFixed(2)+' s');await listRobotSaves().catch(()=>{});return true;
 }catch(e){robotNotice('Save failed; previous snapshot retained: '+e.message);return false;}finally{robotSaving=false;}
}
async function leaveRobotWorld(){
 if(navMode!=='ROBOT'||transitioning)return;if(robotSaving)throw Error('Wait for the save to finish');
 if(!confirm('Return to preserved Explorer? Unsaved robot progress will be discarded. K saves the robot world.'))return;
 const l=robotLegacy,snap=l.snap;transitioning=true;
 try{
 robotGround.visible=robotBody.visible=false;clearRobotGround();navMode='EXPLORER';time=l.clock.time;rate=l.clock.rate;paused=l.clock.paused;scene.background=l.background;camera.near=l.near;camera.far=l.far;camera.position.set(0,0,0);camera.up.set(0,1,0);camera.updateProjectionMatrix();await rebuildContext(structuredClone(snap.levels),snap.depth,snap.position,snap.velocity);yaw=snap.yaw;pitch=snap.pitch;selected=snap.selected;robotState=null;robotWorld=null;robotHome=null;robotLegacy=null;keys.clear();$('enter').textContent='Resume EXPLORER view';robotNotice('Preserved Explorer session and clock restored');
 }finally{transitioning=false;}
}
async function listRobotSaves(){
 if(!window.indexedDB)throw Error('IndexedDB is required for robot saves');
 const heads=await new Promise((resolve,reject)=>{const req=indexedDB.open(MF.databaseName,1);req.onupgradeneeded=()=>{req.result.createObjectStore('snapshots');req.result.createObjectStore('heads');};req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Storage blocked by another tab'));req.onsuccess=()=>{const db=req.result,tx=db.transaction('heads','readonly'),q=tx.objectStore('heads').getAll();q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error)};};});
 robotSelect.replaceChildren();for(const h of heads){const o=document.createElement('option');o.value=h.worldId;o.textContent=h.worldId+' · r'+h.revision+' · '+h.timeS.toFixed(1)+' s';robotSelect.append(o);}if(!heads.length){const o=document.createElement('option');o.value='';o.textContent='No saved robot worlds';robotSelect.append(o);}
}
async function robotAction(fn){if(robotActionBusy)return;robotActionBusy=true;try{await fn();}catch(e){robotNotice(e.message);}finally{robotActionBusy=false;}}
const robotMenu=document.createElement('div');robotMenu.className='box';robotMenu.style.marginTop='14px';
const robotTitle=document.createElement('h2');robotTitle.textContent='ROBOT WORLD — PHASE 2 DEVELOPMENT';
const robotDescription=document.createElement('p');robotDescription.textContent='Explicit independent world: Earth-sized development planet, solid ground, walk/run/jump, rotation disabled. Provisional names and 4 m terrain sampling are development settings. No excavation or manufacturing yet. Start from Explorer; existing saves are not overwritten.';
const robotStatus=document.createElement('p');robotStatus.className='status';robotStatus.textContent='New worlds stay unsaved until K or Save is used. Refresh to list robot snapshots.';
const robotSelect=document.createElement('select'),initialOption=document.createElement('option');initialOption.value='';initialOption.textContent='Refresh robot saves to select a world';robotSelect.append(initialOption);
const robotButtons=document.createElement('div');robotButtons.className='row';
for(const [label,fn] of [['New robot world',newRobotWorld],['Save robot world',saveRobotWorld],['Return to preserved Explorer',leaveRobotWorld],['Refresh robot saves',listRobotSaves],['Resume selected robot world',async()=>{if(!robotSelect.value)throw Error('Select a saved robot world');const w=await MF.load(robotSelect.value);if(!w)throw Error('Snapshot missing');await enterRobotWorld(w,w.revision);} ]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>robotAction(fn);robotButtons.append(b);}
robotMenu.append(robotTitle,robotDescription,robotButtons,robotSelect,robotStatus);document.querySelector('#gate article').append(robotMenu);
window.AtlasRobotBuild=Object.freeze({get state(){return robotState?structuredClone(robotState):null},get settings(){return structuredClone(ROBOT_HOME)},get status(){return {active:navMode==='ROBOT',savedRevision:robotSavedRevision,lastStreamMS:robotStreamMS}},save:saveRobotWorld});

async function init(){
  let savedDepth=depth;
  depth=0;
  for(let b of restored){
    let t=await verify(b.id);
    b=t.body;
    levels.push(b.kind==='galaxy'?{
      kind:'galaxy', name:b.name, body:b, root:groot(b)
    }:{
      kind:'system', name:b.name, body:b, planets:await ask('planets', {
        star:b
      })
    })
  }depth=Math.min(savedDepth, levels.length-1);
  unit=depth===0?1e9*LY:depth===1?10000*LY:AU;
  for(let i=0;
  i<levels.length;
  i++)if(levels[i].kind==='system')createSystem(i);
  else await requestLOD(i);
  if(savedNav==='PHYSICAL'&&storedPlayer){
    try{
      await restorePhysical(storedPlayer, false)
    }catch(e){
      $('flightStatus').textContent='Player restore failed; Explorer retained: '+e.message
    }
  }if(savedNav==='GRAVITY'&&gravityStored){
    try{
      await activateGravity(gravityStored, true)
    }catch(e){
      gravityStatus('Gravity restore failed; Explorer retained: '+e.message)
    }
  }window.ready=true;
  $('enter').textContent='Enter '+navMode;
  $('error').textContent=worldLoadFailed?persistence:'Ready. I → Player Flight. F2 → universal and journal checks.';
  $('pulseSize').value=pulseSize;
  $('predictionDays').value=predictionDays;
  requestAnimationFrame(tick)
}init().catch(e=>{
  $('error').textContent='Initialization failed: '+e.message
});
window.Atlas=Object.freeze({
  get localGravityState(){
    return gravityPlayer?structuredClone(gravityPlayer):null
  }, get localGravitySources(){
    return gravityStar?structuredClone(gravitySourcesAt(time)):[]
  }, get session(){
    return MODE
  }, get generation(){
    return VER
  }, get baselineLayout(){
    return LAYOUT
  }, get navigationMode(){
    return navMode
  }, get frame(){
    return levels[depth].name
  }, get time(){
    return time
  }, get position(){
    return Array.from(position)
  }, get velocity(){
    return velocity.toArray()
  }, get playerPhysicalState(){
    return player?playerAt():null
  }, get playerTrajectory(){
    return player?conicInfo(playerAt(), G*playerStar.body.mass):null
  }, get maneuverJournal(){
    return player?structuredClone(player.maneuvers):[]
  }, get playerCheckpoint(){
    return storedPlayer?structuredClone(storedPlayer):null
  }, get selected(){
    return selected?structuredClone(selected):null
  }, get worldEvents(){
    return structuredClone(world.events)
  }, get checks(){
    return tests?{
      ...tests
    }:null
  }, save
});
