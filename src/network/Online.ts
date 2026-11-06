import type { Axes, Snapshot } from './Protocol';
export class Online {
  socket?:WebSocket;seat=0;code='';active=false;last=0;onStatus=(_message:string):void=>{};onStart=():void=>{};onState=(_state:Snapshot):void=>{};onEnd=(_reason:string):void=>{};
  private cancelConnection?:()=>void;
  connect(endpoint:string,code?:string):void {
    this.disconnect();this.onStatus('海につないでいます… 初回は1分ほどかかる場合があります。');
    let url:URL;try{url=new URL(endpoint);if(!['ws:','wss:'].includes(url.protocol)||(location.protocol==='https:'&&url.protocol!=='wss:'))throw Error();}catch{this.onStatus('接続先を確認してください。HTTPSではwss://が必要です。');return;}
    let cancelled=false,retry:ReturnType<typeof setTimeout>|undefined;
    const timeout=setTimeout(()=>{this.disconnect();this.onStatus('接続できませんでした。少し待って再試行してください。');},90000);
    this.cancelConnection=()=>{cancelled=true;clearTimeout(timeout);clearTimeout(retry);};
    const attempt=():void=>{
      if(cancelled)return;
      const socket=new WebSocket(url);this.socket=socket;let opened=false;
      socket.onopen=()=>{if(cancelled)return;opened=true;clearTimeout(timeout);socket.send(JSON.stringify(code?{type:'join',code:code.trim().toUpperCase()}:{type:'create'}));};
      socket.onmessage=event=>{if(cancelled)return;let m;try{m=JSON.parse(event.data);}catch{return;}if(m.type==='room'){this.seat=m.seat;this.code=m.code;this.onStatus(`部屋 ${m.code} · 相手を待っています`);}if(m.type==='start'){this.active=true;this.onStart();}if(m.type==='state'){this.last=performance.now();this.onState(m);}if(m.type==='error')this.onStatus(m.message);if(m.type==='ended'){this.active=false;this.onEnd(m.reason);}};
      socket.onerror=()=>{}; // A failed handshake closes the socket; retry while a free server wakes.
      socket.onclose=()=>{if(cancelled)return;if(!opened){retry=setTimeout(attempt,2500);return;}if(this.active){this.active=false;this.onEnd('接続が切れました。部屋を作り直してください。');}else this.onStatus('接続が閉じました。部屋を作り直してください。');};
    };
    attempt();
  }
  send(axes:Axes):void{if(this.active&&this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({type:'input',axes}));}
  disconnect():void{this.cancelConnection?.();this.cancelConnection=undefined;this.active=false;if(this.socket){this.socket.onclose=null;this.socket.close();this.socket=undefined;}}
}
