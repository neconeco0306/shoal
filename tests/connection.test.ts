import test from 'node:test';
import assert from 'node:assert/strict';
import { Online } from '../src/network/Online';

test('connection waits for a sleeping server, retries, then cancels cleanly', t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const sockets:FakeSocket[]=[];
  class FakeSocket {
    static OPEN=1;static CONNECTING=0;readyState=0;sent:string[]=[];
    onopen?:()=>void;onclose?:()=>void;onerror?:()=>void;onmessage?:(_:any)=>void;
    constructor(_url:URL){sockets.push(this);}
    send(value:string){this.sent.push(value);}
    close(){this.readyState=3;this.onclose?.();}
  }
  const oldSocket=globalThis.WebSocket,oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
  Object.defineProperty(globalThis,'WebSocket',{value:FakeSocket,configurable:true,writable:true});
  Object.defineProperty(globalThis,'location',{value:{protocol:'https:'},configurable:true});
  const online=new Online(),statuses:string[]=[];online.onStatus=s=>statuses.push(s);
  try {
    online.connect('wss://shoal.example/play');
    t.mock.timers.tick(20000);assert.equal(sockets[0].readyState,0,'must not cancel before free server wakes');
    sockets[0].close();t.mock.timers.tick(2500);assert.equal(sockets.length,2);
    sockets[1].readyState=1;sockets[1].onopen?.();assert.deepEqual(JSON.parse(sockets[1].sent[0]),{type:'create'});
    t.mock.timers.tick(90000);assert.equal(sockets[1].readyState,1,'connected rooms must not expire at the connection deadline');
    online.disconnect();online.connect('wss://shoal.example/play');sockets[2].close();online.disconnect();t.mock.timers.tick(100000);assert.equal(sockets.length,3,'cancelled retries must stay cancelled');
    online.connect('wss://shoal.example/play');t.mock.timers.tick(90000);assert.equal(sockets[3].readyState,3);assert.match(statuses.at(-1)!,/再試行/);
  }finally{online.disconnect();Object.defineProperty(globalThis,'WebSocket',{value:oldSocket,configurable:true,writable:true});if(oldLocation)Object.defineProperty(globalThis,'location',oldLocation);else Reflect.deleteProperty(globalThis,'location');}
});
