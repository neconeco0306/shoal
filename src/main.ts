import { ACESFilmicToneMapping, Color, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { config } from './config';
import { School } from './school/School';
import { SteeringWorker } from './school/SteeringWorker';
import { FishRenderer, fishGeometry } from './school/FishRenderer';
import { Player } from './player/Player';
import { Input } from './player/Input';
import { Cameras } from './player/Cameras';
import { Ocean } from './world/Ocean';
import { Habitat } from './world/Habitat';
import { Goal } from './missions/Goal';
import { Campaign, biomeNames, loadProgress, saveProgress, type Biome } from './missions/Campaign';
import { Hud, formatTime } from './ui/Hud';
import { GameUI, type GameMode } from './ui/GameUI';
import { Predators, isEncounter, predatorNames, type Encounter } from './predators/Predators';
import { PredatorRenderer } from './predators/PredatorRenderer';
import { Soundscape } from './audio/Soundscape';
import { Tug, blueBuoy, redBuoy } from './game/Tug';
import { Online } from './network/Online';
import './ui/style.css';

function start(): void {
  const app=document.querySelector<HTMLElement>('#app')!,params=new URLSearchParams(location.search),mobile=matchMedia('(pointer: coarse)').matches;
  const requestedCount=Number(params.get('fish'));let selectedCount=mobile?500:1500;
  if(params.has('debug')&&Number.isInteger(requestedCount)&&requestedCount>=100&&requestedCount<=3000)selectedCount=requestedCount;
  config.school.count=selectedCount;
  let renderer:WebGLRenderer;
  try{renderer=new WebGLRenderer({antialias:!mobile,powerPreference:'high-performance',preserveDrawingBuffer:false});}catch{app.innerHTML='<div class="fatal"><h1>この海を描画できませんでした。</h1><p>WebGL 2対応ブラウザで開いてください。</p></div>';return;}
  let pixelRatio=Math.min(devicePixelRatio,mobile?1.25:1.5);renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=ACESFilmicToneMapping;renderer.outputColorSpace=SRGBColorSpace;renderer.domElement.className='ocean';renderer.domElement.setAttribute('aria-label','SHOALの海。WASDで方向、Shiftで加速、Vでカメラ。');app.append(renderer.domElement);
  const ocean=new Ocean(),habitat=new Habitat(),player=new Player(),school=new School(),fish=new FishRenderer(config.school.maxCount),cameras=new Cameras(),goal=new Goal(),hud=new Hud(app),input=new Input(renderer.domElement),predators=new Predators(),predatorRenderer=new PredatorRenderer(),campaign=new Campaign(),audio=new Soundscape(),tug=new Tug(),online=new Online();
  const steeringWorker=new SteeringWorker(school);
  const rivalMesh=new Mesh(fishGeometry(),new MeshStandardMaterial({vertexColors:true,color:'#f49f99',emissive:'#712a27',emissiveIntensity:.3}));rivalMesh.scale.setScalar(1.25);
  const redGoal=new Goal();redGoal.position.copy(redBuoy);redGoal.object.traverse(o=>{if(o instanceof Mesh&&o.material instanceof MeshStandardMaterial){o.material.color=new Color('#ff8e88');o.material.emissive=new Color('#e74545');}});
  ocean.scene.add(fish.mesh,goal.object,predatorRenderer.root,habitat.root,rivalMesh,redGoal.object);
  const progress=loadProgress(),ui=new GameUI(app,progress);audio.mute(progress.sound);hud.campaignMode=true;
  const tools=document.createElement('div');tools.className='game-tools';tools.innerHTML='<button id="chart-button">海図</button><button id="photo-button">写真 / H</button><button id="capture-button">撮影</button><button id="audio-button">音</button>';app.append(tools);
  const photoHelp=document.createElement('div');photoHelp.className='photo-help';photoHelp.hidden=true;photoHelp.innerHTML='<button>表示を戻す / H</button> <span>Vでカメラ</span>';photoHelp.querySelector('button')!.onclick=()=>togglePhoto();app.append(photoHelp);
  for(const id of ['result','failure-overlay','pause-overlay']){const b=document.createElement('button');b.className='home-button';b.textContent='海図に戻る';b.onclick=()=>home();hud.get(id).append(b);}
  const progressLine=document.createElement('p');progressLine.className='mission-progress small';hud.root.querySelector('.objective')!.append(progressLine);
  let mode:GameMode='campaign',index=0,biome:Biome='reef',encounter:Encounter='none',menu=true,paused=false,failure:string|null=null,finished=false,photo=false;
  let elapsed=0,accumulator=0,lastTime=performance.now(),uiElapsed=0,simMs=0,fps=60,frameSum=0,frameCount=0,previousMembers=0,previousWarning=false,survivalWave=0,networkClock=0,onlineScore:[number,number]=[0,0],snapshotAt=0;
  const step=1/config.simulation.hz;
  const select=hud.get('encounter-select') as HTMLSelectElement;
  const setGoal=(position:Vector3):void=>{goal.position.copy(position);goal.update(elapsed);};
  function setBiome(next:Biome,origin=new Vector3()):void{biome=next;ocean.setBiome(next);habitat.reset(next,mode==='campaign'?campaign.mission.id:0,origin);school.environment=habitat;audio.biome(next);hud.root.querySelector('.location')!.textContent=biomeNames[next];}
  function setupEncounter(next:Encounter):void{encounter=next;predators.reset(next,school);predatorRenderer.reset(predators);select.value=next;}
  function prepare():void{
    school.reset(mode==='online'?500:selectedCount);steeringWorker.reset();school.rival=undefined;player.reset();goal.reset();hud.reset();fish.reset();input.clear();campaign.reset(index);tug.reset(school);if(mode!=='ai'&&mode!=='online')school.rival=undefined;
    elapsed=0;accumulator=0;failure=null;finished=false;paused=false;survivalWave=0;previousMembers=0;previousWarning=false;hud.setPause(false);hud.get('again-button').textContent=mode==='campaign'?'次の海へ →':'もう一度、海へ';
    biome=mode==='campaign'?campaign.biome:biome;setBiome(biome);setGoal(new Vector3(...campaign.mission.goal));
    if(mode==='campaign'&&(campaign.mission.id===8||campaign.mission.id===11)){for(let i=0;i<school.count;i++)school.positions[i*3+1]=-13+(school.positions[i*3+1]+22)*.15;player.position.y=-13;}
    if(mode==='campaign'&&campaign.mission.id===10){for(let i=0;i<school.count;i++){const k=i*3;school.positions[k]=school.positions[k]*.5+(i<school.count/2?-22:22);school.positions[k+2]*=.6;}player.position.x=-22;}
    goal.setColor('#d5f9b9');redGoal.position.copy(redBuoy);redGoal.setColor('#ff8e88');if(mode==='ai'||mode==='online'){setGoal(blueBuoy);goal.setColor('#8bcfff');player.position.x=-3;}
    school.previous.set(school.positions);school.measure();player.previous.copy(player.position);
    setupEncounter(mode==='campaign'?campaign.mission.encounter:mode==='survival'?'bonito':mode==='free'?encounter:'none');
    select.hidden=mode!=='free';rivalMesh.visible=mode==='ai'||mode==='online';redGoal.object.visible=rivalMesh.visible;goal.object.visible=mode==='ai'||mode==='online'||(mode==='campaign'&&![1,3,8,9,10,11].includes(campaign.mission.id));hud.get('goal-marker').hidden=!goal.object.visible;(hud.root.querySelector('.objective-numbers>span:first-child') as HTMLElement).hidden=!goal.object.visible;
    hud.root.querySelector('.objective .eyebrow')!.textContent=mode==='campaign'?`${String(index+1).padStart(2,'0')} / THE MIGRATION`:mode==='free'?'JUST KEEP SWIMMING':mode==='survival'?'ENDLESS MIGRATION':'60 SECONDS / TUG OF SHOAL';
    hud.root.querySelector('.objective h1')!.textContent=mode==='campaign'?campaign.mission.title:mode==='free'?'目的地のない海。':mode==='survival'?'どこまでも、生きる。':'群れの綱引き';
    hud.root.querySelector('.objective .small')!.textContent=mode==='campaign'?campaign.mission.instruction:mode==='free'?'気の向くままに。Vを2回で映画カメラ。':mode==='survival'?'30秒ごとに変わる海の気配。生き残った魚と距離を伸ばそう。':'近くで向きをそろえ、あなたのブイへ。分かれた群れは大きい方で判定。';
    hud.get('hint').textContent=mode==='campaign'&&index<3?['金色になるまで、群れと同じ向きに。','仲間ができたら、少しずつ右へ。','光の線が見えたら、横へよけよう。'][index]:'命令は、いらない。群れのそばで、向きをそろえる。';
    cameras.update(0,player,school,1,true);updateHUD();
  }
  function play(nextMode:GameMode,nextIndex=0,nextBiome:Biome='reef'):void{online.disconnect();mode=nextMode;cameras.overview=false;cameras.cinematic=false;index=nextIndex;biome=nextBiome;encounter='none';menu=false;ui.hide();app.classList.remove('menu-open');void audio.unlock().then(()=>audio.biome(biome)).catch(()=>{});prepare();}
  function home():void{online.disconnect();menu=true;paused=false;input.clear();photo=false;app.classList.remove('photo-mode');photoHelp.hidden=true;app.classList.add('menu-open');ui.show(progress);audio.suspend(false);}
  function finish(title:string,detail:string,stars=0):void{if(finished||failure)return;finished=true;input.clear();hud.get('result').hidden=false;hud.get('result').querySelector('h2')!.textContent=title;hud.get('result').querySelector('p:not(.eyebrow)')!.textContent=detail;hud.get('result-time').innerHTML=`${stars?`<div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>`:''}${formatTime(elapsed)} · 生き残り ${school.survivors} / ${school.count}`;audio.cue('win');}
  function fail(reason:string):void{if(failure||finished)return;failure=reason;input.clear();hud.setFailure(reason,elapsed,school.survivors,school.count);audio.cue('lose');if(mode==='survival'){let record=0;try{record=Number(localStorage.getItem('shoal-survival')??0);if(elapsed>record)localStorage.setItem('shoal-survival',String(elapsed));}catch{}hud.get('failure-detail').textContent+=` · 最長 ${formatTime(Math.max(record,elapsed))}`;}}
  const reset=():void=>{if(menu)return;if(mode==='online'){home();return;}prepare();};
  const toggleCamera=():void=>{cameras.cycle();input.setMouseSteering(false);hud.setCamera(cameras.overview);if(cameras.cinematic)hud.get('camera-label').textContent='追従に戻る';app.classList.toggle('cinematic',cameras.cinematic);};
  const togglePause=():void=>{if(menu||failure||finished)return;if(mode==='online'){hud.get('hint').textContent='オンライン対戦は止まりません。海図に戻ると退出します。';return;}paused=!paused;input.clear();hud.setPause(paused);audio.suspend(paused);};
  const togglePhoto=():void=>{if(menu)return;photo=!photo;app.classList.toggle('photo-mode',photo);photoHelp.hidden=!photo;};
  input.onCamera=toggleCamera;input.onPause=togglePause;input.onReset=reset;
  hud.get('camera-button').onclick=toggleCamera;hud.get('pause-button').onclick=togglePause;hud.get('resume-button').onclick=togglePause;hud.get('reset-button').onclick=reset;hud.get('retry-button').onclick=reset;
  hud.get('again-button').onclick=()=>{if(mode==='campaign'){if(index<11)play('campaign',index+1);else home();}else reset();};
  select.onchange=()=>{if(isEncounter(select.value)){encounter=select.value;setupEncounter(encounter);select.blur();}};
  ui.onPlay=play;ui.onSound=()=>{progress.sound=!progress.sound;saveProgress(progress);audio.mute(progress.sound);ui.menu.querySelector('#sound-setting')!.textContent=`音 ${progress.sound?'ON':'OFF'}`;};
  ui.onOnline=code=>{void audio.unlock().catch(()=>{});online.connect(ui.endpoint,code);};online.onStatus=message=>ui.status(message);
  online.onStart=()=>{mode='online';snapshotAt=performance.now();cameras.overview=false;cameras.cinematic=false;menu=false;biome='current';ui.hide();app.classList.remove('menu-open');prepare();setGoal(online.seat===0?blueBuoy:redBuoy);goal.setColor(online.seat===0?'#8bcfff':'#ff8e88');redGoal.position.copy(online.seat===0?redBuoy:blueBuoy);redGoal.setColor(online.seat===0?'#ff8e88':'#8bcfff');hud.root.querySelector('.objective .small')!.textContent=`あなたは${online.seat===0?'青':'赤'}。自分の色のブイへ、群れを導こう。`;};
  online.onEnd=reason=>{if(!finished)fail(reason);};
  online.onState=state=>{if(mode!=='online'||menu)return;school.previous.set(school.positions);school.positions.set(state.positions);school.directions.set(state.directions);school.informed.set(state.informed);school.allegiance.set(state.allegiance);school.measure();school.members=state.allegiance.filter((a,i)=>a===online.seat+1&&state.informed[i]).length;for(const [local,remote] of [[player,state.players[online.seat]],[tug.rival,state.players[1-online.seat]]] as const){local.previous.copy(local.position);local.position.fromArray(remote.p);local.direction.fromArray(remote.d);local.goalDirection.fromArray(remote.g);local.stamina=remote.stamina;local.speed=remote.speed;local.yaw=remote.yaw;local.pitch=remote.pitch;}elapsed=state.elapsed;onlineScore=state.score;snapshotAt=performance.now();if(state.done){const own=state.score[online.seat],other=state.score[1-online.seat];finish(own===other?'引き分け。':own>other?'あなたの海へ。':'相手の海へ。',`青 ${state.score[0]} / 赤 ${state.score[1]} · 部屋 ${online.code}`);}};
  tools.querySelector<HTMLButtonElement>('#chart-button')!.onclick=home;tools.querySelector<HTMLButtonElement>('#photo-button')!.onclick=togglePhoto;tools.querySelector<HTMLButtonElement>('#audio-button')!.onclick=()=>{progress.sound=!progress.sound;saveProgress(progress);audio.mute(progress.sound);tools.querySelector('#audio-button')!.textContent=`音 ${progress.sound?'ON':'OFF'}`;};
  tools.querySelector<HTMLButtonElement>('#capture-button')!.onclick=()=>{renderer.render(ocean.scene,cameras.camera);renderer.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`SHOAL-${biome}-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
  window.addEventListener('keydown',e=>{if(e.code==='KeyH'&&!(e.target as HTMLElement).closest('input,select,textarea'))togglePhoto();});
  document.addEventListener('visibilitychange',()=>{input.clear();accumulator=0;lastTime=performance.now();if(document.hidden&&!menu&&!finished&&!failure&&mode!=='online'){paused=true;hud.setPause(true);audio.suspend(true);}});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('描画が停止しました。ページを再読み込みしてください。');});
  input.onMouseSteering=active=>{hud.get('mouse-mode').textContent=`マウス操作 ${active?'ON':'OFF'} · 海をクリックで切替`;};
  input.onTouch=state=>{const stick=hud.get('touch-stick');stick.hidden=!state;if(state){stick.style.left=`${state.x}px`;stick.style.top=`${state.y}px`;stick.style.setProperty('--stick-x',`${state.dx}px`);stick.style.setProperty('--stick-y',`${state.dy}px`);}};
  const boost=hud.get('touch-boost');let boostPointer:number|null=null;
  boost.onpointerdown=e=>{if(boostPointer!==null)return;e.preventDefault();boostPointer=e.pointerId;boost.setPointerCapture(e.pointerId);input.pointerBoost=true;};
  const releaseBoost=(e:PointerEvent):void=>{if(e.pointerId===boostPointer){boostPointer=null;input.pointerBoost=false;}};
  boost.onpointerup=releaseBoost;boost.onpointercancel=releaseBoost;boost.onlostpointercapture=releaseBoost;

  window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);cameras.resize();});
  function updateHUD():void{goal.elapsed=elapsed;goal.distance=player.position.distanceTo(goal.position);goal.distance=Math.hypot(school.centroid.x-goal.position.x,school.centroid.y-goal.position.y,school.centroid.z-goal.position.z);hud.update(player,school,goal,fps,simMs,cameras.overview,predators);if(encounter==='none')hud.get('encounter-status').textContent=mode==='campaign'?(index===0||index===8?'群れのそばで、向きをそろえよう。':index===9?'2つの光を、ひとつに。':'群れとの距離を保とう。'):mode==='free'?'好きな向きへ、泳いでみよう。':'青と赤、ふたつの行き先。';progressLine.textContent=mode==='campaign'?campaign.progress:mode==='ai'||mode==='online'?`残り ${Math.max(0,Math.ceil(60-elapsed))}秒 · 青 ${(mode==='ai'?tug.score:onlineScore)[0]} / 赤 ${(mode==='ai'?tug.score:onlineScore)[1]}`:mode==='survival'?`第${survivalWave+1}波 · ${formatTime(elapsed)} · 生存 ${Math.round(school.survivors/school.count*100)}%`:biomeNames[biome];}
  if(params.has('debug')){void import('./ui/DebugPanel').then(({createDebugPanel})=>createDebugPanel(()=>{selectedCount=config.school.count;reset();}));Object.defineProperty(window,'__shoal',{value:()=>({mode,index,biome,menu,count:school.count,survivors:school.survivors,members:school.members,fleeing:school.fleeing,centroid:school.centroid,coherence:school.coherence,player:player.position.toArray(),direction:player.direction.toArray(),elapsed,paused,overview:cameras.overview,cinematic:cameras.cinematic,failure,finished,progress:campaign.progress,leg:campaign.leg,stars:campaign.stars,goal:goal.position.toArray(),goalDistance:goal.distance,encounter,fps,simMs,drawCalls:renderer.info.render.calls,camera:cameras.camera.position.toArray(),cameraDirection:cameras.camera.getWorldDirection(new Vector3()).toArray(),steeringWorker:steeringWorker.active,workerLatency:steeringWorker.latency,mouseSteering:input.mouseActive,inputAxes:input.axes,stamina:player.stamina,onlineSeat:online.seat,onlineScore,predators:predators.items.map(p=>({kind:p.kind,phase:p.phase,position:p.position.toArray(),danger:p.danger}))})});}
  prepare();home();cameras.overview=true;
  // Device check happens before play; fish counts never change midway through a mission.
  if(!params.has('fish')){const cached=school.cachedSteering;school.cachedSteering=undefined;const start=performance.now();for(let i=0;i<3;i++)school.step(step,player);const cost=(performance.now()-start)/3;school.cachedSteering=cached;if(cost>18)selectedCount=mobile?300:500;else if(cost>10)selectedCount=mobile?500:1000;ui.menu.querySelector('#quality-note')!.textContent=`自動画質 · ${selectedCount.toLocaleString()}匹`;}
  function frame(now:number):void{
    const rawDt=Math.max(0,(now-lastTime)/1000);lastTime=now;const dt=Math.min(rawDt,.1);frameSum+=rawDt;frameCount++;if(frameSum>=.5){fps=frameCount/frameSum;frameSum=0;frameCount=0;}
    if(mode==='online'&&!menu&&!finished&&!failure){networkClock+=dt;if(networkClock>=1/30){online.send(input.axes);networkClock=0;}if(snapshotAt&&now-snapshotAt>5000)fail('通信が止まっています。海図から接続し直してください。');}
    else if(!paused&&!failure&&!finished){accumulator+=dt;let steps=0;while(accumulator>=step&&steps<config.simulation.maxSteps&&!failure&&!finished){
      player.step(step,menu?{yaw:0,pitch:0,boost:false}:input.axes);if(mode==='ai'&&!menu)tug.step(step,school);predators.step(step,school);const start=performance.now();school.step(step,player,predators.items);simMs+=(performance.now()-start-simMs)*.1;const netCaught=habitat.step(step,school,player,mode==='ai'?tug.rival:undefined);const killer=predators.capture(school,player);elapsed+=step;accumulator-=step;steps++;
      if(!menu){if(netCaught||killer||school.survivors===0)fail(netCaught?'定置網に入ってしまった。':killer?`${predatorNames[killer]}に捕まってしまった。`:'群れがすべて失われた。');else if(mode==='campaign'){
        const distance=new Vector3().copy(school.centroid).distanceTo(goal.position);const transition=campaign.step(step,{elapsed,distance,captured:habitat.captured,school,sheltered:Math.abs(habitat.currentAt(school.centroid.x,school.centroid.y,school.centroid.z))<.5});
        if(transition){const origin=new Vector3().copy(school.centroid);setBiome(campaign.biome,origin);setGoal(origin.clone().add(new Vector3(0,0,180)));setupEncounter(campaign.leg===1?'bonito':'none');audio.cue('checkpoint');hud.get('hint').textContent=`${biomeNames[biome]}へ。残った群れと、次の光へ。`;}
        if(campaign.failure)fail(campaign.failure);else if(campaign.complete){progress.stars[index]=Math.max(progress.stars[index],campaign.stars);progress.best[index]=progress.best[index]?Math.min(progress.best[index],elapsed):elapsed;const saved=saveProgress(progress);finish(index===11?'海は、つながっている。':'ともに、越えた。',saved?'あなたの向きが、群れの行き先になった。':'このブラウザでは進行を保存できません。',campaign.stars);}
      }else if(mode==='ai'&&tug.finished)finish(tug.score[0]===tug.score[1]?'引き分け。':tug.score[0]>tug.score[1]?'あなたの海へ。':'相手の海へ。',`青 ${tug.score[0]} / 赤 ${tug.score[1]} · 大きい群れの魚で判定`);
      else if(mode==='survival'){const wave=Math.floor(elapsed/30);if(wave>survivalWave){survivalWave=wave;setupEncounter((['bonito','birds','dolphins','mixed'] as Encounter[])[Math.min(wave,3)]);audio.cue('warning');}}
      const warning=predators.items.some(p=>p.phase==='warning');if(warning&&!previousWarning)audio.cue('warning');previousWarning=warning;if(school.members>=previousMembers+10){audio.cue('ally');previousMembers=school.members;}
      }
    }if(steps===config.simulation.maxSteps)accumulator%=step;}
    const stopped=paused||failure!==null||finished,alpha=mode==='online'?Math.min(1,(now-snapshotAt)/(1000/7.5)):stopped?1:accumulator/step;
    if(mode!=='online'&&!stopped)steeringWorker.update(now,player);
    fish.update(stopped?0:dt,alpha,school,player);cameras.update(dt,player,school,alpha);ocean.update(elapsed,player.position,school,mode==='online'?0:habitat.current.z);habitat.update(elapsed);goal.update(elapsed);redGoal.update(elapsed);predatorRenderer.update(predators,alpha);
    if(rivalMesh.visible){rivalMesh.position.copy(tug.rival.previous).lerp(tug.rival.position,alpha);rivalMesh.quaternion.setFromUnitVectors(new Vector3(0,0,1),tug.rival.direction);}
    if(frameCount===0&&elapsed>3&&fps<25&&pixelRatio>.75){pixelRatio=Math.max(.75,pixelRatio-.1);renderer.setPixelRatio(pixelRatio);}
    renderer.render(ocean.scene,cameras.camera);hud.positionMarkers(player,goal,cameras.camera);uiElapsed+=dt;if(uiElapsed>=.1){updateHUD();uiElapsed=0;}
    if(menu&&elapsed>15){prepare();cameras.overview=true;}
    // Lower pixel fill cost when the device cannot sustain its frame budget.

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
start();
