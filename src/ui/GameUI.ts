import { biomeNames, missions, type Progress, type Biome } from '../missions/Campaign';
export type GameMode='campaign'|'free'|'survival'|'ai'|'online';
export class GameUI {
  menu=document.createElement('section');onPlay=(_mode:GameMode,_index:number,_biome:Biome):void=>{};onOnline=(_code?:string):void=>{};onSound=():void=>{};
  constructor(app:HTMLElement,progress:Progress){this.menu.className='home';this.menu.setAttribute('aria-label','SHOAL 海図');app.append(this.menu);this.render(progress);}
  render(progress:Progress):void{
    const next=Math.max(0,progress.stars.findIndex(s=>s===0));
    this.menu.innerHTML=`<div class="home-intro"><span class="eyebrow">A SMALL FISH. AN ENTIRE OCEAN.</span><h1>SHOAL<span>ひとつの海、千のいのち。</span></h1><p>あなたは、群れの中の1匹。<br>泳ぐ向きで仲間を増やし、<br>この広い海を、ともに渡る。</p><button class="primary" id="continue-game">${progress.stars.some(Boolean)?'回遊をつづける':'海へ入る'} <span>→</span></button><div class="home-notes">ヘッドホンで、海の中へ。<br>マウス / WASD · ゲームパッド · タッチ対応</div><button id="sound-setting" class="text-button">音 ${progress.sound?'ON':'OFF'}</button><p id="quality-note" class="small muted"></p></div><div class="chart"><div class="chart-heading"><span class="eyebrow">THE MIGRATION / 海図</span><span>${progress.stars.reduce((a,b)=>a+b,0)} / 36 ★</span></div><div class="mission-grid">${missions.map(m=>`<button class="mission-card ${progress.stars[m.id-1]?'cleared':''}" data-mission="${m.id-1}"><span class="mission-number">${String(m.id).padStart(2,'0')}</span><span><small>${biomeNames[m.biome]}</small><strong>${m.title}</strong><em>${'★'.repeat(progress.stars[m.id-1])}${'☆'.repeat(3-progress.stars[m.id-1])}</em></span><b>↗</b></button>`).join('')}</div><div class="other-seas"><button data-mode="free"><strong>自由遊泳</strong><span>目的地のない海。映画カメラと写真。</span></button><button data-mode="survival"><strong>エンドレス回遊</strong><span>天敵が増える海で、どこまで泳げる？</span></button><button data-mode="ai"><strong>群れの綱引き</strong><span>AIと60秒。青いブイへ連れ出そう。</span></button><button id="online-menu"><strong>ふたりの海</strong><span>部屋コードでつながるオンライン対戦。</span></button></div><div class="free-settings"><label>自由遊泳の海 <select id="free-biome"><option value="reef">沖縄のサンゴ礁</option><option value="current">黒潮の外洋</option><option value="night">相模湾の夜</option></select></label></div><form id="online-form" hidden><p>同じ部屋に2人そろうと、60秒の対戦が始まります。</p><div class="room-actions"><button type="button" id="create-room">部屋をつくる</button><input id="room-code" placeholder="部屋コード6文字" maxlength="6" autocomplete="off" aria-label="部屋コード"><button type="submit">参加</button></div><p id="online-status" role="status"></p><details><summary>接続先の設定</summary><label>対戦サーバー <input id="server-url" type="url" aria-label="対戦サーバーURL"></label></details></form></div>`;
    this.menu.querySelector<HTMLButtonElement>('#continue-game')!.onclick=()=>this.onPlay('campaign',next,'reef');
    this.menu.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach(b=>b.onclick=()=>this.onPlay('campaign',Number(b.dataset.mission),'reef'));
    this.menu.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>this.onPlay(b.dataset.mode as GameMode,0,this.menu.querySelector<HTMLSelectElement>('#free-biome')!.value as Biome));
    this.menu.querySelector<HTMLButtonElement>('#sound-setting')!.onclick=()=>this.onSound();
    this.menu.querySelector<HTMLButtonElement>('#online-menu')!.onclick=()=>{this.menu.querySelector<HTMLElement>('#online-form')!.hidden=false;this.menu.querySelector<HTMLElement>('#online-form')!.scrollIntoView({block:'nearest',behavior:'smooth'});};
    this.menu.querySelector<HTMLButtonElement>('#create-room')!.onclick=()=>this.onOnline();
    this.menu.querySelector<HTMLFormElement>('#online-form')!.onsubmit=e=>{e.preventDefault();this.onOnline(this.menu.querySelector<HTMLInputElement>('#room-code')!.value);};
    this.menu.querySelector<HTMLInputElement>('#server-url')!.value=import.meta.env.VITE_MULTIPLAYER_URL||'ws://127.0.0.1:8787/play';
  }
  get endpoint():string{return this.menu.querySelector<HTMLInputElement>('#server-url')!.value;}
  status(message:string):void{this.menu.querySelector<HTMLElement>('#online-status')!.textContent=message;}
  show(progress:Progress):void{this.render(progress);this.menu.hidden=false;}
  hide():void{this.menu.hidden=true;}
}
