import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {WebSocketServer} from 'ws';
import {COLORS,spawnPlayer,createRace,stepRace} from './public/shared.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
export function createGameServer(){
  const rooms=new Map();
  const server=http.createServer(async(req,res)=>{
    if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"status":"ok"}');}
    try{
      const url=new URL(req.url,'http://localhost');
      const files={'/vendor/three.module.js':'node_modules/three/build/three.module.js','/vendor/three.core.js':'node_modules/three/build/three.core.js'};
      const relative=files[url.pathname]||'public'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname));
      const filename=path.resolve(root,relative);
      if(!filename.startsWith(path.join(root,'public')+path.sep)&&!Object.values(files).some(f=>path.resolve(root,f)===filename))throw Error('Forbidden');
      const data=await readFile(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(data);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  const wss=new WebSocketServer({server,path:'/ws',maxPayload:2048});
  const send=(ws,data)=>{if(ws.readyState===1&&ws.bufferedAmount<256000)ws.send(JSON.stringify(data));};
  const broadcast=(r,data)=>{for(const c of r.clients.values())send(c.ws,data);};
  const lobby=r=>broadcast(r,{type:'lobby',code:r.code,host:r.host,track:r.track,players:[...r.clients.values()].map(c=>({id:c.id,name:c.name,color:c.color})),phase:r.race?.phase||'lobby'});
  const leave=ws=>{const r=rooms.get(ws.room);if(!r)return;r.clients.delete(ws.id);if(r.race)r.race.players=r.race.players.filter(p=>p.id!==ws.id);if(!r.clients.size)rooms.delete(r.code);else{if(r.host===ws.id)r.host=r.clients.keys().next().value;lobby(r);}ws.room=null;};
  wss.on('connection',(ws,req)=>{
    if(wss.clients.size>200){ws.close(1013,'Server full');return;}
    ws.id=randomBytes(8).toString('hex');ws.alive=true;ws.budget=0;ws.window=Date.now();
    ws.on('pong',()=>ws.alive=true);send(ws,{type:'hello',id:ws.id});
    ws.on('message',raw=>{
      if(Date.now()-ws.window>1000){ws.window=Date.now();ws.budget=0;}
      if(++ws.budget>80)return ws.close(1008,'Too many messages');
      let m;try{m=JSON.parse(raw);}catch{return;}if(!m||typeof m!=='object')return;
      const error=message=>send(ws,{type:'error',message});
      if(m.type==='create'||m.type==='join'){
        if(ws.room)return error('Leave your current room first.');
        let r;
        if(m.type==='create'){
          if(rooms.size>=50)return error('All rooms are busy. Try again shortly.');
          let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
          r={code,host:ws.id,track:m.track===1?1:0,clients:new Map(),race:null};rooms.set(code,r);
        }else{r=rooms.get(String(m.code||'').toUpperCase());if(!r)return error('Room not found. Check the code with your friend.');if(r.race&&r.race.phase!=='finished')return error('This race has already started. Join after it finishes.');if(r.clients.size>=8)return error('This room is full (8 racers).');}
        const used=[...r.clients.values()].map(p=>p.color),preferred=COLORS.includes(m.color)?m.color:COLORS[0],color=used.includes(preferred)?COLORS.find(c=>!used.includes(c)):preferred;
        r.clients.set(ws.id,{id:ws.id,ws,name:String(m.name||'Racer').replace(/[<>\x00-\x1f]/g,'').slice(0,16)||'Racer',color});ws.room=r.code;lobby(r);return;
      }
      if(m.type==='leave'){leave(ws);return;}
      const r=rooms.get(ws.room);if(!r)return;
      if(m.type==='track'&&r.host===ws.id&&(!r.race||r.race.phase==='finished')){r.track=m.track===1?1:0;lobby(r);}
      if(m.type==='start'&&r.host===ws.id&&(!r.race||r.race.phase==='finished')){
        r.race=createRace(r.track,[...r.clients.values()].map((c,i)=>spawnPlayer(c.id,c.name,c.color,r.track,i)));
        broadcast(r,{type:'race',race:r.race});
      }
      if(m.type==='input'&&r.race){const p=r.race.players.find(p=>p.id===ws.id);if(p){p.input={gas:m.gas===true,brake:m.brake===true,drift:m.drift===true,steer:Math.max(-1,Math.min(1,Number(m.steer)||0)),use:p.input.use||m.use===true};p.lastInput=Date.now();}}
    });
    ws.on('close',()=>leave(ws));ws.on('error',()=>leave(ws));
  });
  let ticks=0,last=performance.now(),acc=0;
  const timer=setInterval(()=>{const now=performance.now();acc+=Math.min((now-last)/1000,.15);last=now;
    while(acc>=1/30){for(const r of rooms.values())if(r.race){for(const p of r.race.players)if(Date.now()-p.lastInput>500)p.input={};stepRace(r.race,1/30);}acc-=1/30;ticks++;
      if(ticks%2===0)for(const r of rooms.values())if(r.race)broadcast(r,{type:'state',race:r.race});}
  },1000/60);
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);
  return {server,rooms,close:()=>new Promise(resolve=>{clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close(()=>server.close(resolve));})};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {server}=createGameServer();server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Chaos Karts ready: http://localhost:${process.env.PORT||3000}`));
}
