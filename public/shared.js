export const COLORS = ['#fa654f','#b7f556','#64c8ff','#d499ff','#ffce52','#ff8dc6','#55dfc3','#f3eee0'];
export const ITEMS = ['boost','shield','oil','rocket'];
export const TRACKS = [
  {id:0,name:'Sunset Bay',subtitle:'Salt air. Sharp turns.',biome:'coast',width:15,sky:0xa8dce0,ground:0x8cbd77,road:0x545c65,points:[[0,62],[60,66],[99,34],[87,-26],[40,-65],[-25,-64],[-83,-32],[-94,24],[-49,58]]},
  {id:1,name:'Canyon Run',subtitle:'Dust up. Send it.',biome:'desert',width:14,sky:0xe9bea0,ground:0xd59d68,road:0x715e58,points:[[0,65],[54,74],[89,44],[66,6],[99,-40],[48,-75],[2,-52],[-45,-73],[-86,-36],[-68,17],[-92,50],[-46,72]]}
];
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function pathFor(id) {
  const pts=TRACKS[id].points, path=[];
  for(let i=0;i<pts.length;i++) for(let j=0;j<24;j++) {
    const t=j/24, p0=pts[(i+pts.length-1)%pts.length],p1=pts[i],p2=pts[(i+1)%pts.length],p3=pts[(i+2)%pts.length];
    const xy=[0,1].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t));
    path.push({x:xy[0],z:xy[1]});
  }
  for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];a.angle=Math.atan2(b.x-a.x,b.z-a.z);}
  return path;
}
export const PATHS=TRACKS.map(t=>pathFor(t.id));
export function nearest(path,x,z){let d=Infinity,idx=0;for(let i=0;i<path.length;i++){const n=(path[i].x-x)**2+(path[i].z-z)**2;if(n<d){d=n;idx=i;}}return {idx,d:Math.sqrt(d)};}
export function spawnPlayer(id,name,color,track,slot=0,bot=false){
  const path=PATHS[track],p=path[(path.length-3-Math.floor(slot/2)*3)%path.length],side=slot%2?2.8:-2.8;
  return {id,name,color,bot,x:p.x+Math.cos(p.angle)*side,z:p.z-Math.sin(p.angle)*side,angle:p.angle,vx:0,vz:0,speed:0,lap:0,nextGate:0,progress:0,item:null,boost:0,shield:0,stun:0,driftCharge:0,drifting:false,finished:0,input:{},lastInput:0};
}
export function stepPlayer(p,input,track,dt){
  dt=clamp(dt,0,1/20);const path=PATHS[track], near=nearest(path,p.x,p.z),off=near.d>TRACKS[track].width/2;
  p.boost=Math.max(0,p.boost-dt);p.shield=Math.max(0,p.shield-dt);p.stun=Math.max(0,p.stun-dt);
  const steer=clamp(Number(input.steer)||0,-1,1),throttle=input.gas?1:0,brake=input.brake?1:0;
  const drift=!!input.drift&&Math.abs(p.speed)>11&&Math.abs(steer)>.1&&!off&&!p.stun;
  if(drift)p.driftCharge=Math.min(1.8,p.driftCharge+dt);
  else if(p.drifting){if(p.driftCharge>.65)p.boost=Math.max(p.boost,p.driftCharge>.1?Math.min(1.2,p.driftCharge*.7):0);p.driftCharge=0;}
  p.drifting=drift;
  const max=off?18:p.boost?66:44;
  p.speed+=(throttle*31-brake*47-(p.speed>0?5.5:0))*dt;
  if(!throttle&&!brake)p.speed*=Math.exp(-.7*dt);
  p.speed=clamp(p.speed,-12,max);if(p.stun)p.speed*=Math.exp(-4*dt);
  p.angle+=steer*(drift?2.25:1.65)*clamp(Math.abs(p.speed)/15,0,1)*(p.speed<0?-1:1)*dt;
  const grip=1-Math.exp(-(drift?3.2:10)*dt);
  p.vx+=(Math.sin(p.angle)*p.speed-p.vx)*grip;p.vz+=(Math.cos(p.angle)*p.speed-p.vz)*grip;
  p.x+=p.vx*dt;p.z+=p.vz*dt;
  const updated=nearest(path,p.x,p.z);
  if(updated.d>TRACKS[track].width*.95){const c=path[updated.idx],dx=p.x-c.x,dz=p.z-c.z,k=TRACKS[track].width*.95/updated.d;p.x=c.x+dx*k;p.z=c.z+dz*k;p.speed*=.93;p.vx*=.85;p.vz*=.85;}
  // Eight sequential gates prevent shortcut laps or finish-line reversing exploits.
  const gate=path[Math.floor(p.nextGate*path.length/8)];
  if(Math.hypot(p.x-gate.x,p.z-gate.z)<TRACKS[track].width*.85){
    if(p.nextGate===0)p.lap++;
    p.nextGate=(p.nextGate+1)%8;
  }
  p.progress=Math.max(0,p.lap-1)+updated.idx/path.length;
}
export function botInput(p,track){const path=PATHS[track],n=nearest(path,p.x,p.z),target=path[(n.idx+7)%path.length],error=angleDiff(Math.atan2(target.x-p.x,target.z-p.z),p.angle);return {gas:true,steer:clamp(error*1.7,-1,1),brake:Math.abs(error)>1&&p.speed>25,drift:Math.abs(error)>.48&&Math.abs(error)<1.1};}
export function createRace(track,players){return {track,players,phase:'countdown',countdown:3.2,time:0,boxes:PATHS[track].filter((_,i)=>i%Math.floor(PATHS[track].length/12)===0).map((p,i)=>({id:i,x:p.x,z:p.z,cooldown:0})),hazards:[],finishOrder:[],finishTimer:0};}
export function useItem(race,p){
  if(!p.item||p.finished||race.phase!=='racing')return;
  const item=p.item;p.item=null;
  if(item==='boost')p.boost=2.1;
  if(item==='shield')p.shield=6;
  if(item==='oil')race.hazards.push({type:'oil',owner:p.id,x:p.x-Math.sin(p.angle)*4,z:p.z-Math.cos(p.angle)*4,ttl:16});
  if(item==='rocket')race.hazards.push({type:'rocket',owner:p.id,x:p.x+Math.sin(p.angle)*4,z:p.z+Math.cos(p.angle)*4,angle:p.angle,ttl:5});
}
export function stepRace(r,dt,random=Math.random){
  if(r.phase==='countdown'){r.countdown-=dt;if(r.countdown<=0)r.phase='racing';return;}
  if(r.phase!=='racing')return;r.time+=dt;
  for(const b of r.boxes)b.cooldown=Math.max(0,b.cooldown-dt);
  for(const p of r.players){
    if(p.finished)continue;
    const input=p.bot?{...botInput(p,r.track),use:!!p.item&&random()<.01}:p.input;
    if(input.use){useItem(r,p);input.use=false;}
    stepPlayer(p,input,r.track,dt);
    for(const b of r.boxes)if(!b.cooldown&&!p.item&&Math.hypot(p.x-b.x,p.z-b.z)<4){p.item=ITEMS[Math.floor(random()*ITEMS.length)];b.cooldown=4;}
    if(p.lap>3){p.finished=r.time;r.finishOrder.push(p.id);if(!r.finishTimer)r.finishTimer=25;}
  }
  for(let i=0;i<r.players.length;i++)for(let j=i+1;j<r.players.length;j++){
    const a=r.players[i],b=r.players[j];if(a.finished||b.finished)continue;const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d>0&&d<2.8){const k=(2.8-d)/2/d;a.x-=dx*k;a.z-=dz*k;b.x+=dx*k;b.z+=dz*k;a.speed*=.99;b.speed*=.99;}
  }
  for(const h of r.hazards){h.ttl-=dt;if(h.type==='rocket'){h.x+=Math.sin(h.angle)*80*dt;h.z+=Math.cos(h.angle)*80*dt;}
    for(const p of r.players)if(!p.finished&&p.id!==h.owner&&Math.hypot(p.x-h.x,p.z-h.z)<3){if(!p.shield)p.stun=1.3;h.ttl=0;break;}}
  r.hazards=r.hazards.filter(h=>h.ttl>0);
  if(r.finishTimer)r.finishTimer-=dt;
  if(r.players.every(p=>p.finished)||(r.finishOrder.length&&r.finishTimer<=0)||r.time>300)r.phase='finished';
}
export function standings(r){return [...r.players].sort((a,b)=>a.finished&&b.finished?a.finished-b.finished:a.finished?-1:b.finished?1:b.progress-a.progress);}
