// gna: browser-only voxel planet foundation. No build tools required.
const errorBox = document.querySelector('#error');
function report(error) { errorBox.hidden = false; errorBox.textContent = `Unable to start gna: ${error.message || error}. Check your connection and browser WebGL support.`; }
try {
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');
  start(THREE);
} catch (error) { report(error); }
function start(T) {
  const scene = new T.Scene();
  scene.background = new T.Color(0x192d43);
  const renderer = new T.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  const camera = new T.PerspectiveCamera(75, innerWidth/innerHeight, .05, 250);
  scene.add(new T.HemisphereLight(0xddeeff, 0x6f7161, 2.3));
  const sun = new T.DirectionalLight(0xfff1d8, 2.8);
  sun.position.set(35,55,25); scene.add(sun);
  const R = 16, MAX = 25, SIZE = 2*MAX+1;
  const cells = new Map();
  const key = (x,y,z) => `${x},${y},${z}`;
  const has = (x,y,z) => cells.has(key(x,y,z));
  const neighbors = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for(let x=-R;x<=R;x++) for(let y=-R;y<=R;y++) for(let z=-R;z<=R;z++) {
    const distance = Math.hypot(x,y,z);
    const height = R + .65*Math.sin(x*.35)*Math.cos(z*.3)*Math.sin(y*.3);
    if(distance <= height) cells.set(key(x,y,z), {x,y,z,kind:distance>height-1.7?'soil':'rock'});
  }
  const geometry = new T.BoxGeometry(1,1,1);
  const material = new T.MeshStandardMaterial({roughness:1});
  let terrain, visible = [];
  const matrix = new T.Matrix4(), color = new T.Color();
  function rebuild() {
    visible = [...cells.values()].filter(c => neighbors.some(n => !has(c.x+n[0],c.y+n[1],c.z+n[2])));
    if(terrain) { scene.remove(terrain); terrain.dispose(); }
    terrain = new T.InstancedMesh(geometry, material, visible.length);
    for(let i=0;i<visible.length;i++) {
      const c=visible[i]; matrix.makeTranslation(c.x,c.y,c.z); terrain.setMatrixAt(i,matrix);
      const shade = ((c.x*13+c.y*17+c.z*23)%7)/100;
      color.set(c.kind==='soil'?0x74865a:0x777f89); color.offsetHSL(0,0,shade); terrain.setColorAt(i,color);
    }
    terrain.computeBoundingSphere(); scene.add(terrain);
  }
  rebuild();
  const position = new T.Vector3(0,R+3,0), velocity = new T.Vector3();
  const forward = new T.Vector3(0,0,-1);
  let pitch=0, grounded=false, accumulator=0, edits=0, jumpRequested=false;
  const radius=.38, eye=.65, keys=new Set();
  const overlay=document.querySelector('#overlay'), hud=document.querySelector('#hud');
  const locked=()=>document.pointerLockElement===renderer.domElement;
  document.querySelector('#play').onclick=()=>renderer.domElement.requestPointerLock();
  document.addEventListener('pointerlockchange',()=>{overlay.style.display=locked()?'none':'flex';keys.clear();jumpRequested=false;accumulator=0;});
  document.addEventListener('pointerlockerror',()=>{errorBox.hidden=false;errorBox.textContent='Mouse capture was blocked. Open the published game in its own browser tab and click Enter world.';});
  addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('keydown',e=>{
    if(!locked()) return;
    if(['Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if(e.code==='Space'&&!e.repeat)jumpRequested=true;
    if(e.code==='KeyR'){position.set(0,R+3,0);velocity.set(0,0,0);forward.set(0,0,-1);pitch=0;}
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>keys.clear());
  addEventListener('mousemove',e=>{
    if(!locked())return;
    const up=position.clone().normalize();
    forward.applyAxisAngle(up,-e.movementX*.002);
    pitch=T.MathUtils.clamp(pitch-e.movementY*.002,-1.48,1.48);
  });
  function collide() {
    let floor=false;
    for(let pass=0;pass<4;pass++) {
      let changed=false;
      const cx=Math.round(position.x),cy=Math.round(position.y),cz=Math.round(position.z);
      for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(let z=cz-1;z<=cz+1;z++) {
        if(!has(x,y,z))continue;
        const closest=new T.Vector3(T.MathUtils.clamp(position.x,x-.5,x+.5),T.MathUtils.clamp(position.y,y-.5,y+.5),T.MathUtils.clamp(position.z,z-.5,z+.5));
        const normal=position.clone().sub(closest);let d=normal.length();
        if(d>=radius)continue;
        if(d<1e-8){normal.copy(position).sub(new T.Vector3(x,y,z));if(normal.lengthSq()<1e-8)normal.set(0,1,0);normal.normalize();d=0;}
        else normal.divideScalar(d);
        position.addScaledVector(normal,radius-d+1e-5);
        const into=velocity.dot(normal);if(into<0)velocity.addScaledVector(normal,-into);
        if(normal.dot(position.clone().normalize())>.45)floor=true;
        changed=true;
      }
      if(!changed)break;
    }
    return floor;
  }
  function cameraUpdate() {
    const up=position.clone().normalize();
    forward.addScaledVector(up,-forward.dot(up));
    if(forward.lengthSq()<.001)forward.set(1,0,0).addScaledVector(up,-up.x);
    forward.normalize();
    const right=new T.Vector3().crossVectors(forward,up).normalize();
    const look=forward.clone().applyAxisAngle(right,pitch);
    camera.position.copy(position).addScaledVector(up,eye);
    camera.up.copy(up);camera.lookAt(camera.position.clone().add(look));
    camera.updateMatrixWorld();
  }
  function overlapsRobot(x,y,z) {
    // Reserve room for the collision sphere and camera mast when placing material.
    const up=position.clone().normalize();
    for(const h of [0,eye]) {
      const p=position.clone().addScaledVector(up,h);
      const q=new T.Vector3(T.MathUtils.clamp(p.x,x-.5,x+.5),T.MathUtils.clamp(p.y,y-.5,y+.5),T.MathUtils.clamp(p.z,z-.5,z+.5));
      if(p.distanceTo(q)<radius+.05)return true;
    }
    return false;
  }
  const raycaster=new T.Raycaster(); raycaster.far=6;
  addEventListener('mousedown',e=>{
    if(!locked() || ![0,2].includes(e.button))return;
    cameraUpdate();raycaster.setFromCamera(new T.Vector2(0,0),camera);
    const hit=raycaster.intersectObject(terrain)[0];if(!hit)return;
    const c=visible[hit.instanceId];
    if(e.button===0)cells.delete(key(c.x,c.y,c.z));
    else {
      const n=hit.face.normal,x=c.x+Math.round(n.x),y=c.y+Math.round(n.y),z=c.z+Math.round(n.z);
      if(Math.max(Math.abs(x),Math.abs(y),Math.abs(z))>MAX||has(x,y,z)||overlapsRobot(x,y,z))return;
      cells.set(key(x,y,z),{x,y,z,kind:'rock'});
    }
    edits++;rebuild();
  });
  function step(dt) {
    const up=position.clone().normalize();
    const f=forward.clone().addScaledVector(up,-forward.dot(up)).normalize();
    const right=new T.Vector3().crossVectors(f,up).normalize();
    const wish=new T.Vector3();
    if(keys.has('KeyW'))wish.add(f);if(keys.has('KeyS'))wish.sub(f);
    if(keys.has('KeyD'))wish.add(right);if(keys.has('KeyA'))wish.sub(right);
    if(wish.lengthSq())wish.normalize().multiplyScalar(4);
    const radial=velocity.dot(up), tangent=velocity.clone().addScaledVector(up,-radial);
    tangent.lerp(wish,1-Math.exp(-(grounded?16:2)*dt));
    velocity.copy(tangent).addScaledVector(up,radial);
    if(jumpRequested&&grounded){velocity.addScaledVector(up,5);grounded=false;}
    jumpRequested=false;
    // Fixed central mass: inverse-square field outside a uniform reference sphere;
    // linear field inside. Excavations do not yet redistribute gravitational mass.
    const distance=Math.max(position.length(),.001);
    const g=distance>=R ? 9.81*R*R/(distance*distance) : 9.81*distance/R;
    velocity.addScaledVector(up,-g*dt);
    position.addScaledVector(velocity,dt);grounded=collide();
  }
  let last=performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed=Math.min((now-last)/1000,.05);last=now;
    if(locked()){
      accumulator+=elapsed;
      while(accumulator>=1/120){step(1/120);accumulator-=1/120;}
    }
    cameraUpdate();
    hud.textContent=`gna · foundation 0.1\n${grounded?'Ground contact':'Airborne'} · speed ${velocity.length().toFixed(1)} m/s\nTerrain edits: ${edits} · reach 6 m\nWASD move · Space jump · LMB remove · RMB add\nR return to surface · Esc menu`;
    renderer.render(scene,camera);
  }
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  requestAnimationFrame(frame);
}
