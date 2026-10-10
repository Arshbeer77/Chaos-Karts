import {makeScene} from './scene.js';
import {COLORS,TRACKS,PATHS,spawnPlayer,createRace,stepRace,standings,nearest} from './shared.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let scene;try{scene=makeScene($('#world'));}catch(e){$('#loading').textContent='This browser could not start 3D graphics. Try enabling hardware acceleration or another browser.';throw e;}
let track=0,color=COLORS[0],mode='menu',race=null,selfId='you',socket=null,room=null,host=null,online=false,input={gas:false,brake:false,steer:0,drift:false,use:false},keys=new Set(),touches=new Set(),last=performance.now(),acc=0,netTime=0,resultShown=false;
const coarse=matchMedia('(pointer:coarse)').matches;
let saved;try{saved=JSON.parse(localStorage.getItem('chaos-driver'));}catch{}if(saved){$('#name').value=String(saved.name||'Rookie').slice(0,16);if(COLORS.includes(saved.color))color=saved.color;}
let toastTimer;function toast(text){$('#toast').textContent=text;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',4200);}
function save(){try{localStorage.setItem('chaos-driver',JSON.stringify({name:$('#name').value,color}));}catch{}}
function screen(name){for(const s of ['menu','lobby','hud','results'])$('#'+s).classList.toggle('hidden',s!==name);$('#topbar').classList.toggle('hidden',name==='hud');$('#vignette').classList.toggle('hidden',name==='hud');mode=name;}
for(const [i,c] of COLORS.entries()){const b=document.createElement('button');b.className='swatch'+(c===color?' active':'');b.style.background=c;b.setAttribute('aria-label',['Coral','Lime','Sky','Lilac','Sunshine','Pink','Mint','Cream'][i]);b.setAttribute('aria-pressed',c===color);b.onclick=()=>{color=c;$$('.swatch').forEach(s=>{s.classList.toggle('active',s===b);s.setAttribute('aria-pressed',s===b);});save();};$('#colors').append(b);}
function selectTrack(id){track=id;scene.load(id);$$('.track').forEach(b=>b.classList.toggle('selected',Number(b.dataset.track)===id));$('#scene-name').textContent=TRACKS[id].name;$('#scene-sub').textContent=TRACKS[id].subtitle;$('.outline-number').textContent='0'+(id+1);$('#lobby-track').value=String(id);}
$$('.track').forEach(b=>b.onclick=()=>selectTrack(Number(b.dataset.track)));
$('#help').onclick=()=>$('#instructions').showModal();$('#close-help').onclick=()=>$('#instructions').close();
let sound=false,audio,osc,gain;$('#sound').onclick=()=>{sound=!sound;if(sound&&!audio){audio=new AudioContext();osc=audio.createOscillator();gain=audio.createGain();osc.type='triangle';osc.connect(gain);gain.connect(audio.destination);gain.gain.value=0;osc.start();}audio?.resume();$('#sound').textContent=sound?'SOUND ON':'SOUND OFF';$('#sound').setAttribute('aria-label',sound?'Disable sound':'Enable sound');};
function send(message){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));}
async function connect(){
  if(socket?.readyState===WebSocket.OPEN)return;
  await new Promise((resolve,reject)=>{const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);socket=ws;let ready=false;
    const timeout=setTimeout(()=>{ws.close();reject(Error('The server is waking up. Wait a moment and try again.'));},12000);
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}if(m.type==='hello'){clearTimeout(timeout);selfId=m.id;ready=true;resolve();}else onMessage(m);};
    ws.onerror=()=>{clearTimeout(timeout);reject(Error('Could not connect. Check your connection and try again.'));};
    ws.onclose=()=>{clearTimeout(timeout);if(!ready)reject(Error('Connection closed. Please try again.'));if(socket===ws){socket=null;if(online){online=false;room=null;race=null;screen('menu');toast('Connection lost. Rejoin your friend’s room to race again.');}}};
  });
}
function onMessage(m){
  if(m.type==='error'){toast(m.message);return;}
  if(m.type==='lobby'){room=m.code;host=m.host;online=true;
    $('#copy-code').replaceChildren(document.createTextNode(m.code+' '));const icon=document.createElement('span');icon.textContent='⧉';$('#copy-code').append(icon);$('#roster').replaceChildren();
    for(const p of m.players){const row=document.createElement('div');row.className='racer';const dot=document.createElement('i');dot.style.background=p.color;const name=document.createElement('span');name.textContent=p.name;row.append(dot,name);if(p.id===host){const tag=document.createElement('small');tag.textContent='HOST';row.append(tag);}$('#roster').append(row);}
    $('#start').disabled=selfId!==host;$('#lobby-track').disabled=selfId!==host;$('#host-note').textContent=selfId===host?`${m.players.length} / 8 racers · Start whenever everyone is here.`:'Waiting for the host to start the race.';
    if(mode!=='hud'&&mode!=='results'){if(track!==m.track)selectTrack(m.track);screen('lobby');}
  }
  if(m.type==='race'){race=m.race;track=race.track;scene.load(track);resultShown=false;keys.clear();touches.clear();acc=0;screen('hud');}
  if(m.type==='state'&&mode==='hud'){race=m.race;if(race.phase==='finished'&&!resultShown)showResults();}
}
async function join(create){save();const button=create?$('#create'):$('#join-form button');button.disabled=true;try{await connect();send({type:create?'create':'join',name:$('#name').value,color,track,code:$('#code').value.trim().toUpperCase()});}catch(e){toast(e.message);}finally{button.disabled=false;}}
$('#create').onclick=()=>join(true);$('#join-form').onsubmit=e=>{e.preventDefault();join(false);};
$('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(room);toast('Room code copied. Send it to your friends!');}catch{toast('Your room code is '+room);}};
$('#lobby-track').onchange=()=>send({type:'track',track:Number($('#lobby-track').value)});$('#start').onclick=()=>send({type:'start'});
function leave(){send({type:'leave'});online=false;room=null;race=null;resultShown=false;keys.clear();touches.clear();input={};selectTrack(track);screen('menu');}
$('#leave').onclick=leave;$('#result-menu').onclick=leave;
$('#exit').onclick=()=>{if(confirm('Leave this race and return to the garage?'))leave();};
function practice(){save();online=false;selfId='you';const players=[spawnPlayer('you',$('#name').value||'Rookie',color,track,0),...['Pip','Miso','Ziggy'].map((n,i)=>spawnPlayer('bot'+i,n,COLORS.filter(c=>c!==color)[i],track,i+1,true))];race=createRace(track,players);scene.load(track);acc=0;resultShown=false;keys.clear();touches.clear();screen('hud');}
$('#practice').onclick=practice;$('#again').onclick=()=>{if(online){race=null;resultShown=false;screen('lobby');send({type:'track',track});}else practice();};
const fmt=t=>`${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`;
function showResults(){resultShown=true;const order=standings(race);$('#result-title').textContent=order[0]?.id===selfId?'Sweet, sweet victory.':'Beautiful chaos.';$('#result-list').replaceChildren();order.forEach((p,i)=>{const row=document.createElement('div');row.className='result-row';const rank=document.createElement('b');rank.textContent=String(i+1).padStart(2,'0');const dot=document.createElement('i');dot.style.background=p.color;const name=document.createElement('span');name.textContent=p.name+(p.id===selfId?' (you)':'');const time=document.createElement('span');time.textContent=p.finished?fmt(p.finished):'DNF';row.append(rank,dot,name,time);$('#result-list').append(row);});screen('results');}
addEventListener('keydown',e=>{if(mode!=='hud')return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Shift'].includes(e.key))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)input.use=true;if(e.code==='KeyR'&&!online&&race.phase==='racing'){const p=race.players[0],q=PATHS[track][nearest(PATHS[track],p.x,p.z).idx];p.x=q.x;p.z=q.z;p.angle=q.angle;p.speed=p.vx=p.vz=0;}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();touches.clear();input={};$$('[data-control]').forEach(b=>b.classList.remove('pressed'));});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();touches.clear();input={};send({type:'input'});}});
for(const b of $$('[data-control]')){const control=b.dataset.control;b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touches.add(control);b.classList.add('pressed');};const up=()=>{touches.delete(control);b.classList.remove('pressed');};b.onpointerup=up;b.onpointercancel=up;b.onlostpointercapture=up;}
$('#item').onclick=()=>input.use=true;
const itemLabels={boost:['⚡','TURBO BOOST'],shield:['◉','BUBBLE SHIELD'],oil:['●','OIL SLICK'],rocket:['➤','ROCKET']};
let lastOrder='';
function updateHud(){const p=race.players.find(p=>p.id===selfId);if(!p)return;const order=standings(race);$('#place').textContent=order.findIndex(x=>x.id===selfId)+1;$('#total').textContent='/ '+race.players.length;$('#lap').textContent=`LAP ${Math.max(1,Math.min(3,p.lap))} / 3`;$('#timer').textContent=fmt(race.time);$('#speed').textContent=Math.round(Math.abs(p.speed)*3);$('#charge').style.width=p.driftCharge/1.8*100+'%';const it=itemLabels[p.item]||['?','FIND A PICKUP'];$('#item-icon').textContent=it[0];$('#item-name').textContent=it[1];$('#item').classList.toggle('ready',!!p.item);$('#countdown').textContent=race.phase==='countdown'?Math.ceil(race.countdown):race.time<.7?'GO!':'';$('#race-message').textContent=p.finished?'FINISHED! Waiting for the gang…':p.stun?'OUCH!':p.boost?'BOOST!':'';
    const signature=order.map(p=>p.id+p.name+p.color).join('');if(lastOrder!==signature){lastOrder=signature;$('#leaders').replaceChildren();order.slice(0,8).forEach((p,i)=>{const li=document.createElement('li');li.textContent=`${i+1}  ${p.name}${p.id===selfId?'  ←':''}`;li.style.borderColor=p.color;$('#leaders').append(li);});}
    const c=$('#minimap').getContext('2d'),path=PATHS[track],sx=x=>90+x*.68,sz=z=>70+z*.68;c.clearRect(0,0,180,140);c.beginPath();path.forEach((p,i)=>i?c.lineTo(sx(p.x),sz(p.z)):c.moveTo(sx(p.x),sz(p.z)));c.closePath();c.lineWidth=9;c.strokeStyle='#f6f2e755';c.stroke();for(const p of race.players){c.beginPath();c.arc(sx(p.x),sz(p.z),p.id===selfId?4:3,0,Math.PI*2);c.fillStyle=p.color;c.fill();if(p.id===selfId){c.lineWidth=1.5;c.strokeStyle='#fff';c.stroke();}}
}
function frame(now){const dt=Math.min((now-last)/1000,.08);last=now;
  if(mode==='hud'&&race){input.gas=!document.hidden&&(coarse||keys.has('KeyW')||keys.has('ArrowUp'));input.brake=keys.has('KeyS')||keys.has('ArrowDown')||touches.has('brake');input.steer=(keys.has('KeyA')||keys.has('ArrowLeft')||touches.has('left')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')||touches.has('right')?1:0);input.drift=keys.has('ShiftLeft')||keys.has('ShiftRight')||touches.has('drift');
    if(online){netTime+=dt;if(netTime>=.05){netTime=0;send({type:'input',...input});input.use=false;}}
    else{race.players[0].input=input;acc+=dt;while(acc>=1/60){stepRace(race,1/60);acc-=1/60;}if(race.phase==='finished'&&!resultShown)showResults();}
    updateHud();
  }
  scene.draw(mode==='hud'?race:null,selfId,dt,now/1000,color);
  if(gain){const p=mode==='hud'&&race?.players.find(p=>p.id===selfId);gain.gain.setTargetAtTime(sound&&p?.speed>.5?.035:0,audio.currentTime,.1);if(p)osc.frequency.setTargetAtTime(55+Math.abs(p.speed)*4,audio.currentTime,.1);}
  requestAnimationFrame(frame);
}
$('#loading').classList.add('hidden');requestAnimationFrame(frame);
