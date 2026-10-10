import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnPlayer,stepPlayer,createRace,stepRace,PATHS,useItem,TRACKS} from '../public/shared.js';
test('both circuits are closed, smooth, and bots can complete three valid laps',()=>{
 for(let track=0;track<2;track++){
  const path=PATHS[track];for(let i=0;i<path.length;i++)assert.ok(Math.hypot(path[i].x-path[(i+1)%path.length].x,path[i].z-path[(i+1)%path.length].z)<5);
  const p=spawnPlayer('bot','Bot','#fff',track,0,true),r=createRace(track,[p]);for(let i=0;i<60*300&&r.phase!=='finished';i++)stepRace(r,1/60,()=>.5);
  assert.ok(p.finished>0,TRACKS[track].name+' must be drivable');assert.equal(p.lap,4);assert.equal(r.phase,'finished');
 }
});
test('reverse finish crossing cannot award repeated laps',()=>{const p=spawnPlayer('a','A','#fff',0);p.x=PATHS[0][0].x;p.z=PATHS[0][0].z;for(let i=0;i<100;i++)stepPlayer(p,{},0,1/60);assert.equal(p.lap,1);assert.equal(p.nextGate,1);});
test('drifting charges and releases a boost; grass limits speed',()=>{const p=spawnPlayer('a','A','#fff',0);p.speed=30;for(let i=0;i<50;i++){p.x=PATHS[0][0].x;p.z=PATHS[0][0].z;stepPlayer(p,{gas:true,steer:1,drift:true},0,1/60);}assert.ok(p.driftCharge>.65);stepPlayer(p,{gas:true},0,1/60);assert.ok(p.boost>0);p.x=PATHS[0][0].x;p.z=PATHS[0][0].z+25;stepPlayer(p,{gas:true},0,1/60);assert.ok(p.speed<=18);});
test('powerups consume once and shield blocks a projectile',()=>{const a=spawnPlayer('a','A','#fff',0),b=spawnPlayer('b','B','#fff',0,1),r=createRace(0,[a,b]);r.phase='racing';a.item='boost';useItem(r,a);assert.equal(a.boost,2.1);assert.equal(a.item,null);b.item='shield';useItem(r,b);r.hazards.push({type:'oil',owner:'a',x:b.x,z:b.z,ttl:5});stepRace(r,1/60);assert.equal(b.stun,0);assert.equal(r.hazards.length,0);});
test('countdown freezes the grid and finished race stops simulation',()=>{const p=spawnPlayer('a','A','#fff',0),r=createRace(0,[p]),x=p.x;p.input={gas:true};stepRace(r,1/30);assert.equal(p.x,x);r.phase='finished';stepRace(r,1/30);assert.equal(r.time,0);});
