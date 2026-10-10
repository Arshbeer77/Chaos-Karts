import * as THREE from 'three';
import {PATHS,TRACKS,nearest,angleDiff} from './shared.js';

export function makeScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,700);
  scene.add(new THREE.HemisphereLight(0xfff4d7,0x66828c,2.6));const sun=new THREE.DirectionalLight(0xffe8cc,2.2);sun.position.set(-80,140,60);scene.add(sun);
  let world=new THREE.Group();scene.add(world);let track=0,boxMeshes=[],hazardMeshes=[],kartMeshes=new Map(),menuKarts=[];
  const mats=new Map();const material=(color)=>{if(!mats.has(color))mats.set(color,new THREE.MeshLambertMaterial({color,flatShading:true}));return mats.get(color);};
  const cubeGeo=new THREE.BoxGeometry(1,1,1),coneGeo=new THREE.ConeGeometry(1,1,6),cylGeo=new THREE.CylinderGeometry(1,1,1,10),sphereGeo=new THREE.IcosahedronGeometry(1,1);
  function mesh(geo,color,x,y,z,sx=1,sy=1,sz=1,parent=world){const m=new THREE.Mesh(geo,material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  function box(c,x,y,z,sx,sy,sz,parent=world){return mesh(cubeGeo,c,x,y,z,sx,sy,sz,parent);}
  const shadowGeo=new THREE.CircleGeometry(1,16),shadowMat=new THREE.MeshBasicMaterial({color:0x243b36,transparent:true,opacity:.2,depthWrite:false});
  function shadow(parent,sx,sz){const m=new THREE.Mesh(shadowGeo,shadowMat);m.rotation.x=-Math.PI/2;m.position.y=.04;m.scale.set(sx,sz,1);parent.add(m);return m;}
  function kart(color){const g=new THREE.Group();shadow(g,1.9,2.5);box(0x253f3b,0,.55,0,2.3,.4,3.3,g);box(color,0,.9,.1,1.8,.6,2.8,g);box(color,0,1.12,1.15,1.8,.3,.75,g);box(0xf6efdb,0,1.08,1.2,.34,.32,.7,g);box(0x203634,0,1.16,-.65,1.1,.7,.55,g);box(color,0,1.5,-1.25,2.3,.18,.45,g);
    for(const x of [-1.1,1.1])for(const z of [-1,1]){const w=mesh(cylGeo,0x26302f,x,.52,z,.47,.4,.47,g);w.rotation.z=Math.PI/2;const hub=mesh(cylGeo,0xf1e7cb,x*1.19,.52,z,.24,.03,.24,g);hub.rotation.z=Math.PI/2;}
    mesh(sphereGeo,0xf5e8cf,0,1.7,-.35,.65,.68,.62,g);box(0x304d49,0,1.75,.17,.87,.24,.18,g);box(color,0,1.92,-.4,.16,.42,.94,g);
    const bubble=new THREE.Mesh(new THREE.IcosahedronGeometry(2.5,1),new THREE.MeshBasicMaterial({color:0x8de5fa,transparent:true,opacity:.2,wireframe:true}));bubble.position.y=1;bubble.visible=false;g.add(bubble);g.userData.bubble=bubble;
    const flame=mesh(coneGeo,0xc6f66c,0,.7,-2,.6,1.7,.6,g);flame.rotation.x=-Math.PI/2;flame.visible=false;g.userData.flame=flame;g.userData.bodyParts=g.children.filter(c=>c.material===material(color));return g;
  }
  function ribbon(path,width,y,color){const verts=[],indices=[];for(let i=0;i<=path.length;i++){const p=path[i%path.length],nx=Math.cos(p.angle),nz=-Math.sin(p.angle);verts.push(p.x+nx*width/2,y,p.z+nz*width/2,p.x-nx*width/2,y,p.z-nz*width/2);if(i<path.length){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();const mat=material(color);mat.side=THREE.DoubleSide;const m=new THREE.Mesh(geo,mat);world.add(m);}
  function label(text,x,y,z,angle,background='#173b32',foreground='#c6f66c',width=15,height=4){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,512,128);ctx.fillStyle=foreground;ctx.font='900 57px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);const texture=new THREE.CanvasTexture(c);const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mat);sign.position.set(x,y,z);sign.rotation.y=angle;world.add(sign);}
  function load(id){
    scene.remove(world);world.traverse(o=>{if(o.geometry&&![cubeGeo,coneGeo,cylGeo,sphereGeo,shadowGeo].includes(o.geometry))o.geometry.dispose();if(o.material?.map){o.material.map.dispose();o.material.dispose();}if(o.material?.wireframe)o.material.dispose();});world=new THREE.Group();scene.add(world);kartMeshes.clear();boxMeshes=[];menuKarts=[];hazardMeshes=[];track=id;
    const t=TRACKS[id],path=PATHS[id];scene.background=new THREE.Color(t.sky);scene.fog=new THREE.Fog(t.sky,160,470);
    box(id?0xeac59a:0x77c3d0,0,-1.7,0,900,2,900);mesh(cylGeo,t.ground,0,-1.3,0,147,2,124);ribbon(path,t.width+3,.02,id?0xead0a3:0xf5e4bc);ribbon(path,t.width,.07,t.road);
    // Painted rumble strips and broken center lines use small shared geometries.
    for(let i=0;i<path.length;i+=3){const p=path[i];for(const s of [-1,1]){const b=box(Math.floor(i/3)%2?0xf6edda:0xf6795c,p.x+Math.cos(p.angle)*t.width/2*s,.1,p.z-Math.sin(p.angle)*t.width/2*s,.65,.07,3.4);b.rotation.y=p.angle;}}
    for(let i=9;i<path.length;i+=10){const p=path[i],b=box(0xd0cbc0,p.x,.095,p.z,.19,.02,2.8);b.rotation.y=p.angle;}
    const start=path[0],startGroup=new THREE.Group();startGroup.position.set(start.x,0,start.z);startGroup.rotation.y=start.angle;world.add(startGroup);
    for(let x=0;x<10;x++)for(let z=0;z<2;z++)box((x+z)%2?0x263b35:0xf6f2e7,(x-4.5)*t.width/10,.12,z*.8,t.width/10,.05,.8,startGroup);
    for(const s of [-1,1])box(0x173b32,s*(t.width/2+1),4.1,0,.6,8.2,.6,startGroup);
    box(0xf1cc6a,0,8.2,0,t.width+3,1.8,.8,startGroup);label('CHAOS KARTS',start.x-Math.sin(start.angle)*.45,8.2,start.z-Math.cos(start.angle)*.45,start.angle+Math.PI,'#f1cc6a','#173b32',t.width+2,1.65);
    let seed=729+id;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<150;i++){const x=(rand()-.5)*275,z=(rand()-.5)*240;if(Math.hypot(x/1.17,z)>119||nearest(path,x,z).d<t.width/2+6||Math.hypot(x,z)<12)continue;const size=1.5+rand()*2.8;
      if(!id){box(0x816447,x,size*.7,z,.6,size*1.4,.6);mesh(coneGeo,i%3?0x43826b:0x6f9a67,x,size*1.8,z,size,size*2.6,size);mesh(coneGeo,0x75a477,x,size*2.7,z,size*.75,size*1.8,size*.75);}
      else if(i%3){box(0x638969,x,size,z,.9,size*2,.9);const dir=i%2?1:-1;box(0x638969,x+dir*.8,size*1.2,z,1.7,.65,.65);box(0x638969,x+dir*1.5,size*1.5,z,.6,size,.6);}
      else{mesh(sphereGeo,i%2?0xc57553:0xbd855f,x,size*.8,z,size*2,size*2.4,size*1.5);}
    }
    for(let i=0;i<15;i++){const a=i*Math.PI*2/15,x=Math.cos(a)*180,z=Math.sin(a)*170;mesh(coneGeo,id?0xbe825e:0x7dac8c,x,10,z,25+rand()*25,30+rand()*35,25+rand()*25);}
    for(let i=0;i<12;i++){const p=path[Math.floor(i*path.length/12)],g=new THREE.Group();g.position.set(p.x,2.2,p.z);const b=mesh(cubeGeo,0xc6f66c,0,0,0,1.7,1.7,1.7,g);b.rotation.set(.25,.7,.2);box(0xf7ffe6,0,0,.87,.3,1,.03,g);world.add(g);boxMeshes.push(g);}
    // Trackside bunting, grandstands and geometric waterfront details.
    for(const idx of [18,Math.floor(path.length*.48),Math.floor(path.length*.73)]){const p=path[idx];for(let j=0;j<5;j++){const x=p.x+Math.cos(p.angle)*(t.width/2+5)+Math.sin(p.angle)*j*3,z=p.z-Math.sin(p.angle)*(t.width/2+5)+Math.cos(p.angle)*j*3;const b=box(j%2?0xf1cc6a:0xf47a5c,x,1,z,2.5,2,1);b.rotation.y=p.angle;}}
    if(!id){for(let i=0;i<5;i++){box(0xeecb99,125+i*2,-.2,35,3,.5,20);box(0x816447,125+i*2,1,44,.4,2.5,.4);}for(let i=0;i<9;i++){const x=-75+i*18;box(0xe2f2e4,x,-.62,145+(i%3)*13,10,.05,.45);}}
    // Batch static scenery: hundreds of trees/curbs become a few GPU draw calls.
    const batches=new Map();for(const m of [...world.children])if(m.isMesh&&[cubeGeo,coneGeo,cylGeo,sphereGeo].includes(m.geometry)){const key=m.geometry.uuid+m.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(m);}
    for(const meshes of batches.values()){const instanced=new THREE.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);meshes.forEach((m,i)=>{m.updateMatrix();instanced.setMatrixAt(i,m.matrix);world.remove(m);});world.add(instanced);}
    for(let i=0;i<4;i++){const p=path[(path.length-9-i*4)%path.length],g=kart(['#fa654f','#c6f66c','#64c8ff','#d499ff'][i]);g.position.set(p.x,0,p.z);g.rotation.y=p.angle;world.add(g);menuKarts.push(g);}
  }
  const follow=new THREE.Vector3(),look=new THREE.Vector3();let wasRacing=false;
  function draw(race,selfId,dt,time,paint){
    for(let i=0;i<boxMeshes.length;i++){boxMeshes[i].rotation.y=time*.75;boxMeshes[i].position.y=2.1+Math.sin(time*2+i)*.3;boxMeshes[i].visible=!race||!race.boxes[i]?.cooldown;}
    if(race){for(const g of menuKarts)g.visible=false;const ids=new Set(race.players.map(p=>p.id));for(const [id,g] of kartMeshes)if(!ids.has(id)){world.remove(g);kartMeshes.delete(id);}
      for(const p of race.players){let g=kartMeshes.get(p.id);if(!g){g=kart(p.color);g.position.set(p.x,0,p.z);g.rotation.y=p.angle;world.add(g);kartMeshes.set(p.id,g);}const k=1-Math.exp(-15*dt);g.position.x+=(p.x-g.position.x)*k;g.position.z+=(p.z-g.position.z)*k;g.rotation.y+=angleDiff(p.angle,g.rotation.y)*k;g.rotation.z=p.drifting?Math.sin(time*15)*.025:0;g.userData.bubble.visible=p.shield>0;g.userData.flame.visible=p.boost>0;g.userData.flame.scale.x=.4+Math.sin(time*40)*.1;}
      for(const m of hazardMeshes)world.remove(m);hazardMeshes=[];for(const h of race.hazards){const m=mesh(h.type==='oil'?cylGeo:coneGeo,h.type==='oil'?0x283d42:0xff795b,h.x,h.type==='oil'?.17:1,h.z,h.type==='oil'?2:.6,h.type==='oil'?.12:2,h.type==='oil'?2:.6);if(h.type==='rocket'){m.rotation.x=Math.PI/2;m.rotation.z=-h.angle;}hazardMeshes.push(m);}
      const p=race.players.find(p=>p.id===selfId)||race.players[0];if(p){const g=kartMeshes.get(p.id),a=g.rotation.y;follow.set(g.position.x-Math.sin(a)*13,9,g.position.z-Math.cos(a)*13);look.set(g.position.x+Math.sin(a)*9,1,g.position.z+Math.cos(a)*9);if(!wasRacing)camera.position.copy(follow);else camera.position.lerp(follow,1-Math.exp(-5*dt));camera.lookAt(look);camera.fov+=(p.boost>0?66-camera.fov:58-camera.fov)*Math.min(1,dt*3);camera.updateProjectionMatrix();}
    }else{
      for(const g of kartMeshes.values())g.visible=false;for(const m of hazardMeshes)m.visible=false;for(let i=0;i<menuKarts.length;i++){const path=PATHS[track],p=path[(Math.floor(time*7)+i*7)%path.length],g=menuKarts[i];g.visible=true;g.position.set(p.x,0,p.z);g.rotation.y=p.angle;if(i===0)g.userData.bodyParts.forEach(c=>c.material=material(paint));}
      const a=.5+Math.sin(time*.03)*.13;camera.position.set(Math.sin(a)*185,140,Math.cos(a)*185);camera.lookAt(10,0,0);camera.fov=55;camera.updateProjectionMatrix();
    }
    wasRacing=!!race;renderer.render(scene,camera);
  }
  function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();load(0);
  return {load,draw,renderer};
}
