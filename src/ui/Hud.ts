import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { config } from '../config';
import { clamp, radians } from '../school/math';
import type { Player } from '../player/Player';
import type { School } from '../school/School';
import type { Goal } from '../missions/Goal';
import { encounterNames } from '../predators/Predators';
import type { Predators } from '../predators/Predators';

export const formatTime = (seconds: number): string => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export class Hud {
  root = document.createElement('div');
  private projection = new Vector3();
  private goalOffset = new Vector3();
  private radar: CanvasRenderingContext2D;
  private members: HTMLElement;
  private total: HTMLElement;
  private angle: HTMLElement;
  private distance: HTMLElement;
  private timer: HTMLElement;
  private stamina: HTMLElement;
  private speed: HTMLElement;
  private depth: HTMLElement;
  private hint: HTMLElement;
  private fps: HTMLElement;
  private marker: HTMLElement;
  private playerMarker: HTMLElement;
  private result: HTMLElement;
  private shownArrival = false;
  campaignMode = false;

  constructor(app: HTMLElement) {
    this.root.className = 'hud';
    this.root.innerHTML = `
      <header class="topbar">
        <a class="wordmark" href="./" aria-label="SHOAL ホーム">SHOAL<span>ひとつの海、千のいのち。</span></a>
        <div class="location"><span class="live-dot"></span> 黒潮の外洋 <span class="location-en">KUROSHIO / OPEN OCEAN</span></div>
        <nav><button id="camera-button" title="Vで切替"><span class="button-icon">◉</span> <span id="camera-label">群れを見渡す</span><kbd>V</kbd></button><button id="pause-button" aria-label="一時停止" title="Pで一時停止">Ⅱ</button><button id="reset-button" aria-label="やり直す" title="Rでやり直す">↺</button></nav>
      </header>
      <div class="encounter-bar"><label for="encounter-select">海の気配</label><select id="encounter-select" aria-label="天敵を選んで再開始"><option value="bonito">カツオの突進</option><option value="dolphins">イルカの包囲</option><option value="birds">海鳥の急降下</option><option value="mixed">イルカと海鳥</option><option value="none">おだやかな海</option></select><span id="encounter-status" role="status">群れのそばへ。</span></div>
      <section class="school-stats" aria-label="群れの状態">
        <p class="eyebrow">YOUR INFLUENCE</p>
        <p class="member-label"><span class="gold-dot"></span>仲間</p>
        <div class="member-count"><strong id="members">0</strong><span> / <span id="total">1,500</span></span></div>
        <p class="muted small">あなたと同じ海を、目指す魚たち。</p>
        <div class="stat-divider"></div>
        <div class="heading-stat"><span>群れとの向きのずれ</span><strong><span id="heading-angle">0</span><small>°</small></strong></div>
        <p class="small muted" id="coherence-note">向きをそろえて、そばを泳ごう。</p>
        <p class="survivors">生き残り <strong id="survivors">1500</strong><span id="lost-count"></span></p>
      </section>
      <section class="objective" aria-label="目標">
        <p class="eyebrow">01 / FOLLOW THE LIGHT</p><h1>光のブイへ、群れと。</h1>
        <p class="small muted">群れの中心を、ブイの15体長以内へ。</p>
        <div class="objective-numbers"><span><strong id="distance">80</strong><small>体長 · 群れから</small></span><span id="timer">00:00</span></div>
      </section>
      <div id="goal-marker" class="goal-marker"><span class="target-diamond"></span><span>光のブイ <b id="goal-bearing">↗</b></span></div>
      <div id="player-marker" class="player-marker"><span>あなた</span><i></i></div>
      <div class="crosshair" aria-hidden="true"></div>
      <div class="hint" id="hint">命令は、いらない。<span>近くで同じ向きに2秒泳ぐと、魚はほんのり金色に。</span></div>
      <footer class="bottom-bar">
        <section class="vitals" aria-label="プレイヤーの状態"><div class="eyebrow">ENERGY <span id="speed">4.0 BL/S</span></div><div class="energy-track"><div id="stamina-fill"></div></div><div class="vital-details"><span>深度 <b id="depth">22</b> m相当</span><span id="fps">計測中</span></div></section>
        <section class="controls" aria-label="操作方法"><p><kbd>A</kbd><kbd>D</kbd> 左右 <i>／</i> マウスで向き <i>／</i> <kbd>W</kbd><kbd>S</kbd> 上下</p><p><kbd>Shift</kbd> / 左クリック 加速 <i>·</i> <kbd>Space</kbd><kbd>C</kbd> 上下 <i>·</i> <kbd>R</kbd> やり直し</p></section>
        <section class="radar-panel" aria-label="周囲の地図"><div class="radar-title"><span>周囲 100体長</span><span>N ↑</span></div><canvas id="radar" width="320" height="320"></canvas><div class="radar-legend"><span>● 群れ</span><span class="gold">● あなた</span><span class="mint">◇ ブイ</span></div></section>
      </footer>
      <div class="touch-controls"><div class="touch-depth" id="touch-depth">上下 ↕</div><div id="touch-pad" aria-label="ドラッグで向きを操作"><span>方向</span><i></i></div><button id="touch-boost">加速</button></div>
      <section id="result" class="result" hidden aria-live="polite"><p class="eyebrow">A LITTLE FISH. A SHARED DIRECTION.</p><h2>到達。</h2><p>あなたの向きが、群れの行き先になった。</p><div class="result-time" id="result-time"></div><button id="again-button">もう一度、海へ <kbd>R</kbd></button></section>
      <div id="pause-overlay" class="pause-overlay" hidden><p class="eyebrow">TAKE A BREATH</p><h2>ひと休み。</h2><button id="resume-button">泳ぎつづける <kbd>P</kbd></button></div>
      <section id="failure-overlay" class="result failure" hidden role="dialog" aria-label="ミッション失敗" aria-live="polite"><p class="eyebrow">THE OCEAN GOES ON</p><h2>海に、のまれた。</h2><p id="failure-reason"></p><div class="result-time" id="failure-detail"></div><button id="retry-button">もう一度、泳ぐ <kbd>R</kbd></button></section>
    `;
    app.append(this.root);
    this.members = this.get('members'); this.total = this.get('total'); this.angle = this.get('heading-angle');
    this.distance = this.get('distance'); this.timer = this.get('timer'); this.stamina = this.get('stamina-fill');
    this.speed = this.get('speed'); this.depth = this.get('depth'); this.hint = this.get('hint'); this.fps = this.get('fps');
    this.marker = this.get('goal-marker'); this.playerMarker = this.get('player-marker'); this.result = this.get('result');
    this.radar = (this.get('radar') as HTMLCanvasElement).getContext('2d')!;
    this.radar.scale(2, 2);
  }
  get(id: string): HTMLElement { return this.root.querySelector<HTMLElement>(`#${id}`)!; }
  reset(): void {
    this.shownArrival = false; this.result.hidden = true;
    this.get('failure-overlay').hidden = true;
    this.hint.innerHTML = '命令は、いらない。<span>近くで同じ向きに2秒泳ぐと、魚はほんのり金色に。</span>';
  }
  setFailure(reason: string, elapsed: number, survivors: number, total: number): void {
    this.get('failure-overlay').hidden = false; this.result.hidden = true;
    this.get('failure-reason').textContent = reason;
    this.get('failure-detail').textContent = `${formatTime(elapsed)} / 生き残り ${survivors} / ${total}匹`;
  }
  setCamera(overview: boolean): void { this.get('camera-label').textContent = overview ? '魚の目線に戻る' : '群れを見渡す'; }
  setPause(paused: boolean): void {
    this.get('pause-overlay').hidden = !paused;
    this.get('pause-button').textContent = paused ? '▷' : 'Ⅱ';
    this.get('pause-button').setAttribute('aria-label', paused ? '再開する' : '一時停止');
  }
  update(player: Player, school: School, goal: Goal, fps: number, simMs: number, overview: boolean, predators: Predators): void {
    this.members.textContent = school.members.toLocaleString(); this.total.textContent = school.survivors.toLocaleString();
    this.get('survivors').textContent = `${school.survivors.toLocaleString()} / ${school.count.toLocaleString()}`;
    this.get('lost-count').textContent = school.count > school.survivors ? ` −${school.count - school.survivors}` : '';
    const warning = predators.items.some(p => p.phase === 'warning');
    const danger = predators.items.some(p => p.danger);
    const status = this.get('encounter-status');
    status.classList.toggle('warning', warning || school.fleeing > 0);
    status.textContent = predators.mode === 'none' ? '群れと、光のブイへ。' : predators.elapsed < predators.graceSeconds
      ? `${Math.ceil(predators.graceSeconds - predators.elapsed)}秒後、${encounterNames[predators.mode]}。`
      : warning ? (predators.mode === 'birds' ? '上空に海鳥。深く潜ろう。' : '突進の予兆。光の線から離れよう。')
      : school.fleeing > 0 ? `${school.fleeing}匹が逃避中 · 群れの外から合流を。`
      : danger ? '天敵に注意。群れとの距離を保とう。' : predators.mode === 'birds' ? '深い場所では、海鳥の届かない海へ。' : '群れの向きを、もう一度そろえる。';
    const dot = player.direction.dot(school.meanDirection);
    this.angle.textContent = school.coherence < 0.05 ? '—' : Math.round(Math.acos(clamp(dot, -1, 1)) / radians).toString();
    this.distance.textContent = Math.round(goal.distance).toString(); this.timer.textContent = formatTime(goal.elapsed);
    this.stamina.style.width = `${player.stamina * 100}%`;
    this.stamina.classList.toggle('low', player.stamina < 0.2);
    this.speed.textContent = `${player.speed.toFixed(1)} BL/S`;
    this.depth.textContent = (-player.position.y).toFixed(0);
    this.fps.textContent = `${Math.round(fps)} FPS`;
    this.fps.title = `群れ計算 ${simMs.toFixed(2)} ms / step · ${school.count}匹`;
    this.hint.classList.toggle('subtle', goal.elapsed > 12);
    if (goal.elapsed > 12 && !this.campaignMode) {
      this.hint.innerHTML = school.members === 0 ? '群れのそばで、向きをそろえる。<span>加速しすぎず、金色の仲間が増えるのを待とう。</span>' : `小さな向きが、大きな流れになる。<span>${school.members}匹の仲間と、ゆっくりブイの方へ。</span>`;
    }
    this.root.classList.toggle('overview', overview);
    this.drawRadar(player, school, goal, predators);
    if (goal.arrived && !this.shownArrival && !this.campaignMode) {
      this.shownArrival = true; this.result.hidden = false;
      this.get('result-time').textContent = `${formatTime(goal.elapsed)} / 仲間 ${school.members.toLocaleString()}匹`;
    }
  }
  positionMarkers(player: Player, goal: Goal, camera: PerspectiveCamera): void {
    this.projection.copy(goal.position).project(camera);
    this.goalOffset.copy(goal.position).sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
    const behind = this.goalOffset.z > 0;
    let nx = this.projection.x, ny = this.projection.y;
    if (behind) { nx = -nx; ny = -ny; }
    const offscreen = behind || Math.abs(nx) > 0.85 || Math.abs(ny) > 0.75;
    if (offscreen) {
      const scale = Math.max(Math.abs(nx) / 0.85, Math.abs(ny) / 0.75, 1e-5);
      nx /= scale; ny /= scale;
      if (Math.abs(nx) + Math.abs(ny) < 0.01) nx = 0.85;
    }
    const x = clamp((nx + 1) * innerWidth / 2, 65, innerWidth - 65);
    let y = clamp((1 - ny) * innerHeight / 2, 140, innerHeight - 180);
    if (offscreen && x < (innerWidth > 760 ? 280 : 180)) {
      y = Math.min(innerHeight - 150, Math.max(y, innerWidth > 760 ? 460 : 350));
    }
    this.marker.style.transform = `translate(${x}px, ${y}px)`;
    this.get('goal-bearing').textContent = offscreen ? (nx > 0 ? '→' : '←') : '';
    this.marker.classList.toggle('offscreen', offscreen);
    this.projection.copy(player.position).project(camera);
    this.playerMarker.style.transform = `translate(${(this.projection.x + 1) * innerWidth / 2}px, ${(1 - this.projection.y) * innerHeight / 2}px)`;
    this.playerMarker.hidden = Math.abs(this.projection.x) > 1 || Math.abs(this.projection.y) > 1 || this.projection.z > 1;
  }
  private drawRadar(player: Player, school: School, goal: Goal, predators: Predators): void {
    const ctx = this.radar, size = config.ui.radarSize, mid = size / 2, radius = mid - 8;
    const scale = radius / config.ui.radarRange;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(161,214,214,.18)'; ctx.lineWidth = 0.7;
    for (const r of [radius / 2, radius]) { ctx.beginPath(); ctx.arc(mid, mid, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(mid, 8); ctx.lineTo(mid, size - 8); ctx.moveTo(8, mid); ctx.lineTo(size - 8, mid); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(mid, mid, radius, 0, Math.PI * 2); ctx.clip();
    for (let i = 0; i < school.count; i += 3) {
      if (!school.alive[i]) continue;
      const x = mid - (school.positions[i * 3] - player.position.x) * scale;
      const y = mid - (school.positions[i * 3 + 2] - player.position.z) * scale;
      ctx.fillStyle = school.informed[i] ? '#e4cf8a' : 'rgba(167,218,223,.48)'; ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = '#ffa97c';
    for (const p of predators.items) {
      if (p.phase === 'waiting') continue;
      const x = mid - (p.position.x - player.position.x) * scale, y = mid - (p.position.z - player.position.z) * scale;
      ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x - 4, y + 3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const gx = -(goal.position.x - player.position.x) * scale, gy = -(goal.position.z - player.position.z) * scale;
    const factor = Math.min(1, (radius - 4) / (Math.hypot(gx, gy) || 1));
    const x = mid + gx * factor, y = mid + gy * factor;
    ctx.strokeStyle = '#d7f4b7'; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.stroke();
    ctx.save(); ctx.translate(mid, mid); ctx.rotate(-player.yaw);
    ctx.fillStyle = '#f8dfa4'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3, 4); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  }
}
