import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createGameServer} from '../server.js';
function inbox(ws){const queue=[],waiters=[];ws.on('message',data=>{const m=JSON.parse(data);const i=waiters.findIndex(w=>w.type===m.type);if(i>=0){const [w]=waiters.splice(i,1);clearTimeout(w.timer);w.resolve(m);}else queue.push(m);});return type=>{const i=queue.findIndex(m=>m.type===type);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={type,resolve,timer:setTimeout(()=>reject(Error('Timeout: '+type)),4000)};waiters.push(w);});};}
test('rooms synchronize racers, reject non-host starts, run and transfer host',async()=>{
 const app=createGameServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port;
 const a=new WebSocket(`ws://127.0.0.1:${port}/ws`),ra=inbox(a),b=new WebSocket(`ws://127.0.0.1:${port}/ws`),rb=inbox(b);
 try{
  const ah=await ra('hello'),bh=await rb('hello');a.send(JSON.stringify({type:'create',name:'Alpha',color:'#fa654f',track:1}));const lobby=await ra('lobby');assert.match(lobby.code,/^[A-F0-9]{6}$/);
  b.send(JSON.stringify({type:'join',name:'Beta',color:'#fa654f',code:lobby.code}));const joined=await rb('lobby');await ra('lobby');assert.equal(joined.players.length,2);assert.notEqual(joined.players[0].color,joined.players[1].color);
  b.send(JSON.stringify({type:'start'}));await new Promise(r=>setTimeout(r,80));assert.equal(app.rooms.get(lobby.code).race,null);
  a.send(JSON.stringify({type:'start'}));const ar=await ra('race'),br=await rb('race');assert.equal(ar.race.track,1);assert.deepEqual(ar.race,br.race);
  const room=app.rooms.get(lobby.code);room.race.countdown=.02;a.send(JSON.stringify({type:'input',gas:true,steer:0}));await new Promise(r=>setTimeout(r,250));assert.ok(room.race.players.find(p=>p.id===ah.id).speed>0);
  a.close();const transferred=await rb('lobby');assert.equal(transferred.host,bh.id);assert.equal(transferred.players.length,1);
  b.send(JSON.stringify({type:'leave'}));await new Promise(r=>setTimeout(r,80));assert.equal(app.rooms.size,0);
  const response=await fetch(`http://127.0.0.1:${port}/health`);assert.equal(response.status,200);
  const secret=await fetch(`http://127.0.0.1:${port}/package.json`);assert.equal(secret.status,404);
 }finally{a.terminate();b.terminate();await app.close();}
});
test('unknown room gives an actionable error',async()=>{const app=createGameServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const ws=new WebSocket(`ws://127.0.0.1:${app.server.address().port}/ws`),read=inbox(ws);try{await read('hello');ws.send(JSON.stringify({type:'join',code:'FFFFFF'}));assert.match((await read('error')).message,/Room not found/);}finally{ws.terminate();await app.close();}});
