import type { School } from '../school/School';
import type { Encounter } from '../predators/Predators';
export type Biome = 'reef' | 'current' | 'night';
export interface Mission { id: number; title: string; biome: Biome; encounter: Encounter; instruction: string; goal: [number, number, number]; par: number; limit: number; }
export const biomeNames: Record<Biome, string> = { reef: '沖縄のサンゴ礁', current: '黒潮の外洋', night: '相模湾の夜' };
export const missions: Mission[] = [
  { id: 1, title: 'はじめての群れ', biome: 'reef', encounter: 'none', instruction: '群れの中で、同じ向きに2秒。金色の仲間を20匹に。', goal: [0,-22,80], par: 20, limit: 0 },
  { id: 2, title: '向きを変えろ', biome: 'reef', encounter: 'none', instruction: '仲間を増やし、ゆっくり右へ。群れ全体を白い岩の向こうへ。', goal: [-40,-22,100], par: 65, limit: 0 },
  { id: 3, title: 'カツオが来た', biome: 'reef', encounter: 'bonito', instruction: 'オレンジの線は突進の予兆。8割の魚と60秒を生き残ろう。', goal: [0,-22,200], par: 60, limit: 0 },
  { id: 4, title: '網をよけろ', biome: 'reef', encounter: 'none', instruction: '赤い浮きの下は定置網。左の広い道を通り、1匹も捕まらずブイへ。', goal: [42,-22,120], par: 65, limit: 0 },
  { id: 5, title: '黒潮に乗れ', biome: 'current', encounter: 'none', instruction: '光の粒が流れる向きへ。65秒以内に群れとブイへ。', goal: [0,-24,280], par: 43, limit: 65 },
  { id: 6, title: '逆流', biome: 'current', encounter: 'none', instruction: '向かい風の海。仲間を保ち、岩の陰に群れを運んで5秒休もう。', goal: [0,-24,73], par: 85, limit: 0 },
  { id: 7, title: 'ベイトボール', biome: 'current', encounter: 'dolphins', instruction: '交代するイルカの隙間へ。8割をひとつの群れに保ち、包囲の外へ。', goal: [-45,-28,140], par: 70, limit: 0 },
  { id: 8, title: '空から', biome: 'current', encounter: 'birds', instruction: 'C / Sで潜る。群れの9割を深度25より深くへ連れていこう。', goal: [0,-35,100], par: 45, limit: 0 },
  { id: 9, title: '夜の群れ', biome: 'night', encounter: 'none', instruction: '青くきらめく魚を探そう。金色の仲間を40匹集める。', goal: [0,-26,100], par: 40, limit: 0 },
  { id: 10, title: '二つの群れ', biome: 'night', encounter: 'none', instruction: '俯瞰で左右の光を見つけよう。ゆっくり曲がって導き、9割以上をひとつに。', goal: [0,-26,140], par: 100, limit: 0 },
  { id: 11, title: '総力戦', biome: 'current', encounter: 'mixed', instruction: '上には海鳥、周りにはイルカ。半数以上と60秒、生き残ろう。', goal: [0,-32,200], par: 60, limit: 0 },
  { id: 12, title: '大回遊', biome: 'reef', encounter: 'none', instruction: '3つの海の光をたどる。残った群れを引き継ぎ、相模湾まで。', goal: [0,-22,160], par: 180, limit: 0 },
];
/** Largest connected shoal, not a centroid approximation. Links are local attraction distances. */
export function components(school: School, radius = 14): number[][] {
  const groups: number[][] = [], seen = new Uint8Array(school.count), cells = new Map<string, number[]>();
  const p = school.positions, key = (x:number,y:number,z:number):string => `${x},${y},${z}`;
  for (let i=0;i<school.count;i++) if(school.alive[i]) { const k=i*3, id=key(Math.floor(p[k]/radius),Math.floor(p[k+1]/radius),Math.floor(p[k+2]/radius)); const cell=cells.get(id); if(cell)cell.push(i);else cells.set(id,[i]); }
  for(let i=0;i<school.count;i++) {
    if(!school.alive[i]||seen[i])continue; const group=[i]; seen[i]=1;
    for(let cursor=0;cursor<group.length;cursor++){const k=group[cursor]*3,x=Math.floor(p[k]/radius),y=Math.floor(p[k+1]/radius),z=Math.floor(p[k+2]/radius);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const j of cells.get(key(x+dx,y+dy,z+dz))??[]){if(seen[j])continue;const q=j*3;if((p[k]-p[q])**2+(p[k+1]-p[q+1])**2+(p[k+2]-p[q+2])**2<=radius**2){seen[j]=1;group.push(j);}}
    } groups.push(group);
  }return groups.sort((a,b)=>b.length-a.length);
}
export interface MissionState { elapsed: number; distance: number; captured: number; school: School; sheltered?: boolean; }
export class Campaign {
  mission = missions[0]; leg = 0; hold = 0; progress = ''; stars = 0; complete = false; failure = ''; private checkClock = 0; private largest: number[] = [];
  reset(index: number): void { this.mission=missions[index]??missions[0];this.leg=0;this.hold=0;this.progress='';this.stars=0;this.complete=false;this.failure='';this.checkClock=0;this.largest=[]; }
  get biome(): Biome { return this.mission.id===12 ? (['reef','current','night'] as Biome[])[this.leg] : this.mission.biome; }
  step(dt: number, state: MissionState): 'next-sea' | null {
    if(this.complete||this.failure)return null;
    const {school:s,elapsed:t,distance:d,captured}=state,m=this.mission,ratio=s.survivors/s.count;
    this.checkClock-=dt;
    if(this.checkClock<=0&&(m.id===7||m.id===10)){this.largest=components(s)[0]??[];this.checkClock=.5;}
    if(m.limit&&t>m.limit)this.failure='制限時間になった。流れに乗って、もう一度。';
    if(m.id===4&&captured>0)this.failure='魚が網に入ってしまった。群れ全体に広い道を。';
    if(m.id===3&&ratio<.8)this.failure='群れの生存率が80%を下回った。';
    if((m.id===7||m.id===11||m.id===12)&&ratio<.5)this.failure='群れの半分を失ってしまった。';
    let ok=false;
    switch(m.id){
      case 1: ok=s.members>=20;this.progress=`仲間 ${s.members} / 20`;break;
      case 2:{let beyond=0;for(let i=0;i<s.count;i++)if(s.alive[i]&&s.positions[i*3+2]>82&&s.positions[i*3]<-12)beyond++;ok=beyond===s.survivors;this.progress=`岩を越えた魚 ${beyond} / ${s.survivors}`;break;}
      case 3:case 11:ok=t>=60;this.progress=`残り ${Math.max(0,Math.ceil(60-t))} 秒 · 生存 ${Math.round(ratio*100)}%`;break;
      case 4:case 5:ok=d<19;this.progress=`群れからブイ ${Math.round(d)} 体長`;break;
      case 6:this.hold=d<22&&state.sheltered?this.hold+dt:0;ok=this.hold>=5;this.progress=`岩陰で休憩 ${this.hold.toFixed(1)} / 5 秒`;break;
      case 7:ok=d<24&&this.largest.length>=s.survivors*.8;this.progress=`ひとつの群れ ${Math.round(this.largest.length/Math.max(1,s.survivors)*100)}% · ブイ ${Math.round(d)}`;break;
      case 8:{let deep=0;for(let i=0;i<s.count;i++)if(s.alive[i]&&s.positions[i*3+1]<-25)deep++;this.hold=deep>=s.survivors*.9?this.hold+dt:0;ok=this.hold>=3;this.progress=`深く潜った魚 ${deep} / ${Math.ceil(s.survivors*.9)}`;break;}
      case 9:ok=s.members>=40;this.progress=`光をつなぐ仲間 ${s.members} / 40`;break;
      case 10:{const left=this.largest.filter(i=>i<s.count/2).length,right=this.largest.length-left;this.hold=left>=s.count*.4&&right>=s.count*.4&&this.largest.length>=s.survivors*.9?this.hold+dt:0;ok=this.hold>=5;this.progress=`合流 ${Math.round(this.largest.length/s.count*100)}% · ${this.hold.toFixed(0)} / 5 秒`;break;}
      case 12:if(d<24&&this.leg<2){this.leg++;return 'next-sea';}ok=d<24&&this.leg===2;this.progress=`回遊 ${this.leg+1} / 3 · 生存 ${Math.round(ratio*100)}%`;break;
    }
    if(ok&&!this.failure){this.complete=true;this.stars=ratio>=.95&&t<=m.par?3:ratio>=.8&&t<=m.par*1.7?2:1;}
    return null;
  }
}
export interface Progress { stars: number[]; best: number[]; sound: boolean; }
export function loadProgress(): Progress { try {const p=JSON.parse(localStorage.getItem('shoal-v1')??'{}');return {stars:missions.map((_,i)=>Math.max(0,Math.min(3,Number(p.stars?.[i])||0))),best:missions.map((_,i)=>Math.max(0,Number(p.best?.[i])||0)),sound:p.sound!==false};}catch{return{stars:Array(12).fill(0),best:Array(12).fill(0),sound:true};} }
export function saveProgress(p: Progress): boolean {try{localStorage.setItem('shoal-v1',JSON.stringify(p));return true;}catch{return false;}}
