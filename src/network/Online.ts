import type { Axes, Snapshot } from './Protocol';
export class Online {
  socket?:WebSocket;seat=0;code='';active=false;last=0;onStatus=(_message:string):void=>{};onStart=():void=>{};onState=(_state:Snapshot):void=>{};onEnd=(_reason:string):void=>{};
  connect(endpoint:string,code?:string):void {
    this.disconnect();this.onStatus('海につないでいます…');
    let url:URL;try{url=new URL(endpoint);if(!['ws:','wss:'].includes(url.protocol)||(location.protocol==='https:'&&url.protocol!=='wss:'))throw Error();}catch{this.onStatus('接続先を確認してください。HTTPSではwss://が必要です。');return;}
    const socket=new WebSocket(url);this.socket=socket;
    const timeout=setTimeout(()=>{if(socket.readyState===WebSocket.CONNECTING){socket.close();this.onStatus('接続できませんでした。再試行してください。');}},15000);
    socket.onopen=()=>{clearTimeout(timeout);socket.send(JSON.stringify(code?{type:'join',code:code.trim().toUpperCase()}:{type:'create'}));};
    socket.onmessage=event=>{let m;try{m=JSON.parse(event.data);}catch{return;}if(m.type==='room'){this.seat=m.seat;this.code=m.code;this.onStatus(`部屋 ${m.code} · 相手を待っています`);}if(m.type==='start'){this.active=true;this.onStart();}if(m.type==='state'){this.last=performance.now();this.onState(m);}if(m.type==='error')this.onStatus(m.message);if(m.type==='ended'){this.active=false;this.onEnd(m.reason);}};
    socket.onerror=()=>this.onStatus('接続できませんでした。サーバーの起動を確認してください。');socket.onclose=()=>{clearTimeout(timeout);if(this.active){this.active=false;this.onEnd('接続が切れました。部屋を作り直してください。');}};
  }
  send(axes:Axes):void{if(this.active&&this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({type:'input',axes}));}
  disconnect():void{this.active=false;if(this.socket){this.socket.onclose=null;this.socket.close();this.socket=undefined;}}
}
