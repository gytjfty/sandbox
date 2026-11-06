'use strict';
const R=6371000,M=5.9722e24,G=6.67430e-11,S=1.98847e30,AU=149597870700;
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,k)=>a.map(x=>x*k),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),len=a=>Math.hypot(...a);
const unit=a=>{const n=len(a);if(!(n>0))throw Error('Invalid direction');return mul(a,1/n)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const height=n=>7*Math.sin(n[0]*R/1800)*Math.cos(n[2]*R/2200)+3*Math.sin(n[2]*R/700);
const radius=p=>len(p)===0?R:R+height(unit(p));
const distance=p=>len(p)-radius(p);
function normal(p){return unit([0,1,2].map(i=>{const a=p.slice(),b=p.slice();a[i]+=.25;b[i]-=.25;return (distance(a)-distance(b))/.5}));}
function basis(up){const east=unit(cross(Math.abs(up[1])<.95?[0,1,0]:[0,0,1],up));return {up,east,north:unit(cross(up,east))};}
function viewBasis(state){const up=unit(state.positionM),seed=state.northAxis||basis(up).north,north=unit(sub(seed,mul(up,dot(seed,up))));return {up,north,east:unit(cross(north,up))};}
function orbit(t){const n=Math.sqrt(G*S/AU**3),a=n*t;return {position:[AU*Math.cos(a),0,AU*Math.sin(a)],velocity:[-AU*n*Math.sin(a),0,AU*n*Math.cos(a)],acceleration:[-AU*n*n*Math.cos(a),0,-AU*n*n*Math.sin(a)]};}
function gravity(p,t){const o=orbit(t),q=add(o.position,p);return sub(add(mul(p,-G*M/len(p)**3),mul(q,-G*S/len(q)**3)),o.acceleration);}
function spawn(){return {positionM:[0,R+.93,0],velocityMps:[0,0,0],grounded:false,yaw:0,pitch:0,northAxis:[0,0,1]};}
function step(input,dt,t,c){
 if(!Number.isFinite(dt)||dt<0||dt>.051)throw Error('Robot physics requires time x1');
 const s=JSON.parse(JSON.stringify(input));
 for(const k of ['positionM','velocityMps'])if(!Array.isArray(s[k])||s[k].length!==3||!s[k].every(Number.isFinite))throw Error('Invalid robot vector');
 if(!Number.isFinite(s.yaw)||!Number.isFinite(s.pitch)||typeof s.grounded!=='boolean'||len(s.positionM)<R/2)throw Error('Invalid robot state');
 const count=Math.max(1,Math.ceil(dt*120)),h=dt/count;
 for(let i=0;i<count;i++){
  const b=viewBasis(s),n=normal(s.positionM),yaw=c.yaw||0,f=add(mul(b.north,Math.cos(yaw)),mul(b.east,Math.sin(yaw))),r=add(mul(b.east,Math.cos(yaw)),mul(b.north,-Math.sin(yaw)));
  let wish=add(mul(f,c.forward||0),mul(r,c.right||0));if(len(wish)>1)wish=unit(wish);wish=sub(wish,mul(n,dot(wish,n)));
  if(s.grounded){const tangent=sub(s.velocityMps,mul(n,dot(s.velocityMps,n))),d=sub(mul(wish,c.sprint?6:3.5),tangent),l=len(d),cap=24*h;s.velocityMps=add(s.velocityMps,l>cap?mul(d,cap/l):d);if(c.jump&&i===0){s.velocityMps=add(s.velocityMps,mul(n,4));s.grounded=false;}}
  s.velocityMps=add(s.velocityMps,mul(gravity(s.positionM,t+i*h),h));s.positionM=add(s.positionM,mul(s.velocityMps,h));s.grounded=false;
  if(distance(s.positionM)-.9<=.015){s.positionM=mul(unit(s.positionM),radius(s.positionM)+.9);const nn=normal(s.positionM),v=dot(s.velocityMps,nn);if(v<0)s.velocityMps=sub(s.velocityMps,mul(nn,v));s.grounded=true;}
  s.northAxis=viewBasis(s).north;
 }
 return s;
}
const AtlasRobotKernel=Object.freeze({R,M,S,AU,add,sub,mul,dot,len,unit,cross,height,radius,distance,normal,basis,viewBasis,orbit,gravity,spawn,step});
export { AtlasRobotKernel };
export default AtlasRobotKernel;
