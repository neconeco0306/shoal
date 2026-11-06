import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function message(ws:WebSocket,type:string,timeout=15000):Promise<any>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',on);reject(Error(`timeout ${type}`));},timeout);function on(raw:any){const m=JSON.parse(raw.toString());if(m.type===type){clearTimeout(timer);ws.off('message',on);resolve(m);}}ws.on('message',on);});}
test('real server shares authoritative state, validates capacity and ends a disconnected room', {timeout:45000},async()=>{
  const port=18800+process.pid%1000,server=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']}),clients:WebSocket[]=[];
  try{
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server start timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('ready')){clearTimeout(timer);resolve();}});server.once('error',reject);});
    const connect=()=>new Promise<WebSocket>((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/play`,{origin:'http://127.0.0.1:5173'});clients.push(ws);ws.once('open',()=>resolve(ws));ws.once('error',reject);});
    const a=await connect(),created=message(a,'room');a.send(JSON.stringify({type:'create'}));const room=await created;const b=await connect(),started=message(b,'start'),sa=message(a,'state'),sb=message(b,'state');b.send(JSON.stringify({type:'join',code:room.code}));await started;const [x,y]=await Promise.all([sa,sb]);assert.deepEqual(x,y);assert.equal(x.positions.length,1500);
    a.send(JSON.stringify({type:'input',axes:{yaw:1,pitch:0,boost:true}}));await pause(500);const s=await message(a,'state');assert.ok(s.players[0].yaw<0);assert.ok(s.elapsed>=.5);
    const c=await connect(),full=message(c,'error');c.send(JSON.stringify({type:'join',code:room.code}));assert.match((await full).message,/満員/);
    const ended=message(a,'ended');b.close();assert.match((await ended).reason,/通信/);
    const rejected=await connect(),closed=new Promise<number>(resolve=>rejected.once('close',code=>resolve(code))),r=message(rejected,'room');rejected.send(JSON.stringify({type:'create'}));await r;rejected.send(JSON.stringify({type:'input',axes:{yaw:999,pitch:0,boost:true}}));assert.equal(await closed,1008);
  }finally{clients.forEach(c=>c.terminate());server.kill('SIGTERM');}
});
