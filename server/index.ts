import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../src/config';
import { School } from '../src/school/School';
import { Player } from '../src/player/Player';
import { tugScore } from '../src/game/Tug';
import { validAxes, validRoom } from '../src/network/Protocol';
import type { Axes, Snapshot } from '../src/network/Protocol';
interface Room {code:string;clients:WebSocket[];school:School;players:Player[];axes:Axes[];elapsed:number;tick:number;born:number;started:number;lastTick:number;score:[number,number];}
config.simulation.hz=15;
const rooms=new Map<string,Room>(),membership=new Map<WebSocket,Room>();
const neutral=():Axes=>({yaw:0,pitch:0,boost:false});
const http=createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(req.url==='/health'?{ok:true,rooms:rooms.size}:{error:'not found'}));});
const allowed=(process.env.ALLOWED_ORIGINS??'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173').split(',');
const wss=new WebSocketServer({server:http,path:'/play',maxPayload:1024,perMessageDeflate:false,verifyClient:({origin}:{origin:string})=>allowed.includes(origin)});
const send=(ws:WebSocket,message:unknown):void=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<250000)ws.send(JSON.stringify(message));};
function closeRoom(room:Room,reason:string):void{rooms.delete(room.code);for(const c of room.clients){membership.delete(c);send(c,{type:'ended',reason});}room.clients=[];}
wss.on('connection',ws=>{
  if(wss.clients.size>64){ws.close(1013,'busy');return;}
  let rate=0,last=Date.now(),alive=true;ws.on('pong',()=>{alive=true;});const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},15000);
  ws.on('message',raw=>{if(Date.now()-last>=1000){rate=0;last=Date.now();}if(++rate>50){ws.close(1008,'rate');return;}
    let m:any;try{m=JSON.parse(raw.toString());}catch{ws.close(1008,'json');return;}if(!m||typeof m!=='object')return;
    const joined=membership.get(ws);
    if(m.type==='input'&&joined){if(!validAxes(m.axes)){ws.close(1008,'input');return;}joined.axes[joined.clients.indexOf(ws)]=m.axes;return;}
    if(joined){send(ws,{type:'error',message:'すでに部屋に入っています。'});return;}
    let room:Room|undefined;
    if(m.type==='create'){
      if(rooms.size>=8){send(ws,{type:'error',message:'満室です。少し待ってから再試行してください。'});return;}
      const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';do{code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(rooms.has(code));
      const school=new School(500),players=[new Player(),new Player()];players[0].position.x=-3;players[1].position.x=3;players.forEach(p=>p.previous.copy(p.position));school.rival=players[1];room={code,clients:[],school,players,axes:[neutral(),neutral()],elapsed:0,tick:0,born:Date.now(),started:0,lastTick:0,score:[0,0]};rooms.set(code,room);
    }else if(m.type==='join'&&validRoom(m.code)){room=rooms.get(m.code);if(!room||room.clients.length>=2||Array.from(rooms.values()).filter(r=>r.clients.length===2&&r.elapsed<60).length>=2){send(ws,{type:'error',message:'部屋が見つからないか、すでに満員です。'});return;}}
    else{send(ws,{type:'error',message:'部屋コードは6文字です。'});return;}
    room.clients.push(ws);membership.set(ws,room);send(ws,{type:'room',code:room.code,seat:room.clients.length-1});if(room.clients.length===2){room.started=performance.now();room.lastTick=room.started;for(const c of room.clients)send(c,{type:'start'});}
  });
  ws.on('close',()=>{clearInterval(heartbeat);const r=membership.get(ws);if(r)closeRoom(r,'通信が切れたため、対戦を終了しました。');});ws.on('error',()=>{});
});
const timer=setInterval(()=>{
  for(const room of rooms.values()){
    if(Date.now()-room.born>10*60*1000){closeRoom(room,'部屋の有効時間が終了しました。');continue;}
    if(room.clients.length!==2||room.elapsed>=60)continue;
    const now=performance.now(),dt=Math.min(.1,(now-room.lastTick)/1000);room.lastTick=now;room.players.forEach((p,i)=>p.step(dt,room.axes[i]));room.school.step(dt,room.players[0]);room.elapsed=Math.min(60,(now-room.started)/1000);room.tick++;
    if(room.tick%8===0||room.elapsed>=60)room.score=tugScore(room.school);
    if(room.tick%2===0||room.elapsed>=60){const s=room.school,snapshot:Snapshot={type:'state',elapsed:room.elapsed,positions:Array.from(s.positions,v=>Math.round(v*100)/100),directions:Array.from(s.directions,v=>Math.round(v*1000)/1000),allegiance:Array.from(s.allegiance),informed:Array.from(s.informed),players:room.players.map(p=>({p:p.position.toArray(),d:p.direction.toArray(),g:p.goalDirection.toArray(),stamina:p.stamina,speed:p.speed,yaw:p.yaw,pitch:p.pitch})),score:room.score,done:room.elapsed>=60};for(const c of room.clients)send(c,snapshot);}
  }
},1000/15);
http.listen(Number(process.env.PORT??8787),'0.0.0.0',()=>console.log('SHOAL multiplayer ready'));
function shutdown():void{clearInterval(timer);for(const r of rooms.values())closeRoom(r,'サーバーが再起動します。');wss.clients.forEach(c=>c.close(1001));wss.close();http.close();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
