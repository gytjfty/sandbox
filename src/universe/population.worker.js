function withPlanetGravity(body) {
  const giant=body.planetCategory==='giant-size proxy'||body.radius>=15000000;
  const density=giant?1300:5500;
  const mass=4*Math.PI*body.radius**3*density/3;
  return {
    ...body, mass, densityKgM3:density, gravityModel:'density-proxy-v1',
    surfaceGravity:6.67430e-11*mass/body.radius**2
  };
}
const LY=9460730472580800, AU=149597870700, R=46.5e9*LY, LEGACY='atlas-consistency-v4', NEW='atlas-populations-v5', cache=new Map(), TAU=2*Math.PI;
function rng(s){
  let x=2166136261;
  for(let c of s)x=Math.imul(x^c.charCodeAt(0), 16777619);
  return()=>{
    x=(Math.imul(x, 1664525)+1013904223)>>>0;
    return x/4294967296
  }
}function inside(p, r){
  return Math.hypot(...p)<=r*(1+1e-14)
}function rootNode(id, r, count, profile=null){
  return{
    id, c:[0, 0, 0], h:r, r, count, depth:0, ...(profile?{
      profile
    }:{
    })
  }
}function isNew(id){
  return id.startsWith(NEW+'/')||id===NEW
}
function intPow(lo, hi, p){
  return(Math.pow(hi, p+1)-Math.pow(lo, p+1))/(p+1)
}function imfParts(upper){
  let low=intPow(.08, .5, -1.3), high=.5*intPow(.5, upper, -2.3), mean=(intPow(.08, .5, -.3)+.5*intPow(.5, upper, -1.3))/(low+high);
  return{
    low, high, mean
  }
}function samplePower(lo, hi, alpha, u){
  let p=1-alpha;
  return(Math.pow(lo, p)+u*(Math.pow(hi, p)-Math.pow(lo, p)))**(1/p)
}function sampleMass(r, upper){
  let q=imfParts(upper);
  return r()<q.low/(q.low+q.high)?samplePower(.08, .5, 1.3, r()):samplePower(.5, upper, 2.3, r())
}
function galaxyProperties(id, p){
  let r=rng(id+'/population-v1'), types=['disk', 'spheroid', 'irregular'], profile=types[Math.floor(r()*3)], ageGyr=.1+11.9*r(), metallicity=.0005+.0295*r(), upperMass=Math.min(12, (10/ageGyr)**.4), massBudgetSolar=10**(6+5.8*r()), meanMass=imfParts(upperMass).mean, stars=Math.max(1, Math.round(massBudgetSolar/meanMass)), radius=(1500+118500*r())*LY;
  return{
    id, name:'Galaxy '+id.slice(-15), kind:'galaxy', p, radius, stars, profile, ageGyr, metallicity, upperMass, massBudgetSolar, meanMass, expectedCensusMassSolar:stars*meanMass, populationModel:'main-sequence-cohort-v1', provenance:'assigned synthetic single-age cohort; not full stellar census'
  }
}
function stellarProperties(id, p, g){
  let r=rng(id+'/stellar-v1'), m=sampleMass(r, g.upperMass), lum=m**3.5, rs=m**.8, temp=5772*(lum/rs**2)**.25, color=temp<3500?0xff9b69:temp<5000?0xffce91:temp<6500?0xffefd1:temp<9000?0xdce9ff:0xa9c8ff;
  return{
    id, name:'Star '+id.slice(-15), kind:'star', p, mass:m*1.98847e30, radius:rs*696340000, color, massSolar:m, luminositySolar:lum, temperatureK:temp, ageGyr:g.ageGyr, metallicity:g.metallicity, stellarCategory:'main-sequence proxy', propertyModel:'toy-ms-scaling-v1', lifetimeProxyGyr:10*m**-2.5
  }
}
function density(p, r, kind, profile){
  let[x, y, z]=p.map(v=>v/r);
  if(kind==='galaxy'){
    if(profile==='spheroid')return .002+8*Math.exp(-Math.hypot(x, y, z)*7);
    if(profile==='irregular')return .01+4*Math.exp(-((x-.25)**2+(y+.15)**2+z*z)*18)+3*Math.exp(-((x+.3)**2+(y-.2)**2+(z-.12)**2)*23)+Math.exp(-(x*x+y*y+z*z)*5);
    let d=Math.hypot(x, y), a=Math.atan2(y, x);
    return .002+Math.exp(-Math.abs(z)*35-d*2)*(.15+3*(.5+.5*Math.cos(a*4-d*23))**5)+8*Math.exp(-(x*x+y*y+z*z)*65)
  }let a=Math.sin(x*13+Math.sin(z*7)*1.7), b=Math.sin(y*15+Math.cos(x*8)*1.6), c=Math.sin(z*12+Math.sin(y*9)*1.8);
  return .02+Math.exp(-Math.min(a*a+b*b, b*b+c*c, a*a+c*c)*12)*5
}
function valid(n, r){
  for(let i=0;
  i<80;
  i++){
    let p=n.c.map(x=>x+(r()*2-1)*n.h);
    if(inside(p, n.r))return p
  }let q=n.c.map(x=>Math.sign(x)*Math.max(0, Math.abs(x)-n.h));
  for(let i=0;
  i<50;
  i++){
    let f=.5**(i+2), p=q.map((x, k)=>x+(n.c[k]-x)*f);
    if(inside(p, n.r))return p
  }return q
}function rep(n, kind, salt='rep'){
  let r=rng(n.id+'/'+salt), best=null, w=-1;
  for(let j=0;
  j<7;
  j++){
    let p=valid(n, r), v=density(p, n.r, kind, n.profile)*(.5+r());
    if(v>w){
      best=p;
      w=v
    }
  }return best
}
function split(n, kind){
  if(cache.has(n.id)){
    let a=cache.get(n.id);
    cache.delete(n.id);
    cache.set(n.id, a);
    return a
  }let r=rng(n.id), h=n.h/2, a=[];
  for(let i=0;
  i<8;
  i++){
    let c=[n.c[0]+(i&1?h:-h), n.c[1]+(i&2?h:-h), n.c[2]+(i&4?h:-h)];
    if(Math.hypot(...c.map(x=>Math.max(0, Math.abs(x)-h)))>=n.r)continue;
    let s=0;
    for(let j=0;
    j<12;
    j++){
      let p=c.map(x=>x+(r()*2-1)*h);
      if(inside(p, n.r))s+=density(p, n.r, kind, n.profile)
    }a.push({
      id:n.id+'/'+i, c, h, r:n.r, depth:n.depth+1, w:Math.max(1e-12, s/12), ...(n.profile?{
        profile:n.profile
      }:{
      })
    })
  }let sum=a.reduce((s, c)=>s+c.w, 0);
  for(let c of a)c.count=Math.floor(n.count*c.w/sum);
  let rem=n.count-a.reduce((s, c)=>s+c.count, 0), order=a.slice().sort((a, b)=>(n.count*b.w/sum-b.count)-(n.count*a.w/sum-a.count));
  for(let i=0;
  i<rem;
  i++)order[i%order.length].count++;
  let out=a.filter(c=>c.count);
  if(out.reduce((s, c)=>s+c.count, 0)!==n.count)throw Error('Count conservation');
  cache.set(n.id, out);
  while(cache.size>5000)cache.delete(cache.keys().next().value);
  return out
}function leaf(n){
  return n.count<=4||n.depth>=32
}
function objects(n, kind, g){
  let a=[];
  for(let i=0;
  i<n.count;
  i++){
    let id=n.id+'#'+i, r=rng(id), p=rep(n, kind, 'body'+i);
    if(kind==='universe')a.push(isNew(id)?galaxyProperties(id, p):{
      id, name:'Galaxy '+id.slice(-15), kind:'galaxy', p, radius:(12000+r()*65000)*LY, stars:100000000000
    });
    else a.push(isNew(id)?stellarProperties(id, p, g):{
      id, name:'Star '+id.slice(-15), kind:'star', p, radius:696340000, mass:1.98847e30, color:0xffe0b8
    })
  }return a
}function mat(n, kind, g){
  return leaf(n)?objects(n, kind, g).map(b=>({
    p:b.p, count:1, body:b, node:n, owner:b.id
  })):[{
    p:rep(n, kind), count:n.count, node:n, owner:n.id
  }]
}
function resolve(n, kind, g){
  while(!leaf(n)){
    let ch=split(n, kind), v=rng(n.id+'/pick')()*n.count, s=0;
    for(let c of ch){
      s+=c.count;
      if(v<s){
        n=c;
        break
      }
    }
  }return objects(n, kind, g)[0]
}function byRank(n, kind, rank, g){
  if(!Number.isSafeInteger(rank)||rank<0||rank>=n.count)throw Error('Population index out of range');
  while(!leaf(n)){
    let found=false;
    for(let c of split(n, kind)){
      if(rank<c.count){
        n=c;
        found=true;
        break
      }rank-=c.count
    }if(!found)throw Error('Population lookup failed')
  }return objects(n, kind, g)[rank]
}
function exclude(n, kind, id, g){
  if(!(id.startsWith(n.id+'/')||id.startsWith(n.id+'#')))return mat(n, kind, g);
  if(leaf(n))return mat(n, kind, g).filter(d=>d.body.id!==id);
  return split(n, kind).flatMap(c=>exclude(c, kind, id, g))
}function bound(n, p){
  return Math.hypot(...p.map((v, k)=>Math.max(0, Math.abs(v-n.c[k])-n.h)))
}function nearest(root, p, kind, g){
  let maxR=kind==='universe'?(isNew(root.id)?120000:77000)*LY:12*696340000, q=[{
    n:root, l:bound(root, p)-maxR
  }], best=null, visits=0;
  while(q.length&&visits<260){
    q.sort((a, b)=>a.l-b.l);
    let e=q.shift();
    if(best&&e.l>=best.surface)break;
    visits++;
    if(leaf(e.n)){
      for(let b of objects(e.n, kind, g)){
        let center=Math.hypot(...b.p.map((v, k)=>v-p[k])), surface=center-b.radius;
        if(!best||surface<best.surface)best={
          body:b, center, surface
        }
      }
    }else for(let n of split(e.n, kind)){
      let l=bound(n, p)-maxR;
      if(!best||l<best.surface)q.push({
        n, l
      })
    }
  }let pending=q.length?Math.min(...q.map(e=>e.l)):Infinity;
  return{
    best, complete:!q.length||!!best&&pending>=best.surface
  }
}
function planets(star){
  let r=rng(star.id+'/planets'), a=.25*AU, out=[];
  if(!isNew(star.id)){
    for(let i=0;
    i<6;
    i++){
      a*=1.5+r()*.4;
      out.push({
        id:star.id+'/p'+i, name:'Planet '+(i+1), kind:'planet', radius:(i>3?20000+r()*40000:3000+r()*5500)*1000, a, phase:r()*6.28, color:[0x7399ad, 0xc2a778, 0x6a957b, 0xb57a63][i%4]
      })
    }return out.map(withPlanetGravity)
  }let occurrence=.25+.5*Math.min(1, star.metallicity/.02), count=r()>occurrence?0:1+Math.floor(r()*8);
  a=Math.max(.03*AU, star.radius*5, Math.sqrt(star.luminositySolar)*.1*AU);
  for(let i=0;
  i<count;
  i++){
    a*=1.6+r()*.6;
    let giant=r()<.25, radius=(giant?20000+r()*50000:2000+r()*8000)*1000;
    out.push({
      id:star.id+'/p'+i, name:'Planet '+(i+1), kind:'planet', radius, a, phase:r()*TAU, color:giant?0xb8ab8a:[0x7399ad, 0xc2a778, 0x6a957b, 0xb57a63][i%4], planetCategory:giant?'giant-size proxy':'small-body proxy', planetModel:'toy-variable-systems-v1'
    })
  }return out.map(withPlanetGravity)
}
function galaxyRoot(g){
  return rootNode(g.id+'/stars', g.radius, g.stars, g.profile)
}function addressBody(id, root, kind, g){
  if(!id.startsWith(root.id+'/'))throw Error('Invalid root');
  let m=id.slice(root.id.length+1).match(/^([0-7](?:\/[0-7]){0,31})#([0-9]+)$/);
  if(!m)throw Error('Invalid address');
  let n=root;
  for(let c of m[1].split('/')){
    if(leaf(n))throw Error('Address past leaf');
    n=split(n, kind).find(x=>x.id===n.id+'/'+c);
    if(!n)throw Error('Unpopulated address')
  }if(!leaf(n))throw Error('Not a leaf');
  let b=objects(n, kind, g).find(x=>x.id===id);
  if(!b)throw Error('Invalid index');
  return b
}
function resolveAddress(id){
  let ver=typeof id==='string'?id.split('/')[0]:'';
  if(![LEGACY, NEW].includes(ver)||id.length>1500)throw Error('Unsupported ID');
  let parts=id.split('/stars/');
  if(parts.length>2)throw Error('Invalid hierarchy');
  let g=addressBody(parts[0], rootNode(ver, R, 2000000000000), 'universe');
  if(parts.length===1)return{
    version:1, generation:ver, body:g, parents:[], verified:true
  };
  let m=parts[1].match(/^(.*?)(?:\/p([0-7]))?$/), star=addressBody(g.id+'/stars/'+m[1], galaxyRoot(g), 'galaxy', g);
  if(m[2]===undefined)return{
    version:1, generation:ver, body:star, parents:[g], verified:true
  };
  let b=planets(star)[+m[2]];
  if(!b)throw Error('No such planet');
  return{
    version:1, generation:ver, body:b, parents:[g, star], verified:true
  }
}
function test(){
  let out={
  };
  for(let ver of[LEGACY, NEW]){
    let root=rootNode(ver, R, 2000000000000), ch=split(root, 'universe'), g=byRank(root, 'universe', 12345), s=byRank(galaxyRoot(g), 'galaxy', 123, g);
    out[ver+' count']=ch.reduce((n, c)=>n+c.count, 0)===root.count;
    out[ver+' address']=JSON.stringify(resolveAddress(s.id).body)===JSON.stringify(s);
    out[ver+' support']=inside(g.p, R)&&inside(s.p, g.radius);
    out[ver+' ownership']=ch.flatMap(c=>exclude(c, 'universe', g.id)).reduce((n, d)=>n+d.count, 0)===root.count-1;
    out[ver+' determinism']=JSON.stringify(s)===JSON.stringify(byRank(galaxyRoot(g), 'galaxy', 123, g));
    out[ver+' planetIDs']=planets(s).every(p=>resolveAddress(p.id).body.id===p.id)
  }return out
}
onmessage=e=>{
  let m=e.data, start=performance.now();
  try{
    let result, g=m.galaxy;
    if(m.type==='lod'){
      let f=[m.root];
      while(f.length<m.budget-7){
        let idx=-1, best=-1;
        for(let i=0;
        i<f.length;
        i++){
          let n=f[i];
          if(leaf(n))continue;
          let d=Math.hypot(...n.c.map((v, k)=>v-m.position[k])), score=n.h/Math.max(n.h*.15, d);
          if(score>best){
            best=score;
            idx=i
          }
        }if(idx<0)break;
        f.splice(idx, 1, ...split(f[idx], m.kind))
      }let display=f.flatMap(n=>m.exclude?exclude(n, m.kind, m.exclude.id, g):mat(n, m.kind, g)), total=display.reduce((s, d)=>s+d.count, 0), expected=m.root.count-(m.exclude?1:0);
      if(total!==expected)throw Error('Ownership total');
      result={
        display, total, expected, unique:new Set(display.map(d=>d.owner)).size===display.length, outside:display.some(d=>!inside(d.p, m.root.r))
      }
    }else if(m.type==='query')result=nearest(m.root, m.position, m.kind, g);
    else if(m.type==='resolve')result=resolve(m.node, m.kind, g);
    else if(m.type==='address')result=resolveAddress(m.idString);
    else if(m.type==='planets')result=planets(m.star);
    else if(m.type==='rank')result=byRank(m.root, m.kind, m.rank, g);
    else if(m.type==='page'){
      let start=Math.max(0, Math.min(m.root.count-1, Math.floor(m.start))), items=[];
      for(let i=start;
      i<Math.min(m.root.count, start+Math.min(50, m.size||20));
      i++)items.push({
        index:i, body:byRank(m.root, m.kind, i, g)
      });
      result={
        items, total:m.root.count, start
      }
    }else if(m.type==='test')result=test();
    postMessage({
      id:m.id, result, ms:performance.now()-start
    })
  }catch(error){
    postMessage({
      id:m.id, error:error.message
    })
  }
};
