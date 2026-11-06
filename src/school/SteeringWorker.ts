import { config } from '../config';
import type { School, Leader } from './School';
export interface SteeringRequest {generation:number;count:number;positions:Float32Array;directions:Float32Array;alive:Uint8Array;informed:Uint8Array;allegiance:Uint8Array;regroup:Float32Array;leader:Leader;rival?:Leader;settings:{school:typeof config.school;informed:typeof config.informed;predators:typeof config.predators};}
const snapshot=(leader:Leader):Leader=>({position:{...leader.position},direction:{...leader.direction},goalDirection:{...leader.goalDirection}});
/** One in-flight job; generation tags discard stale replies after reset. Main physics never waits. */
export class SteeringWorker {
  private worker?:Worker;private pending=false;private generation=0;private last=0;private started=0;latency=0;
  constructor(private school:School){try{this.worker=new Worker(new URL('./steering.worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=event=>{this.pending=false;if(event.data.generation!==this.generation)return;this.latency=performance.now()-this.started;this.school.cachedSteering=event.data.steering;};this.worker.onerror=()=>{this.worker?.terminate();this.worker=undefined;this.school.cachedSteering=undefined;this.pending=false;};}catch{this.worker=undefined;}}
  get active():boolean{return Boolean(this.worker&&this.school.cachedSteering);}
  reset():void{this.generation++;this.school.cachedSteering=this.worker&&this.school.count>=300?this.school.directions.slice():undefined;this.last=0;}
  update(now:number,leader:Leader):void{
    if(!this.worker||this.pending||now-this.last<1000/15||this.school.count<300)return;
    const s=this.school;this.pending=true;this.last=now;this.started=now;
    const request:SteeringRequest={generation:this.generation,count:s.count,positions:s.positions.slice(),directions:s.directions.slice(),alive:s.alive.slice(),informed:s.informed.slice(),allegiance:s.allegiance.slice(),regroup:s.regroup.slice(),leader:snapshot(leader),rival:s.rival?snapshot(s.rival):undefined,settings:{school:{...config.school},informed:{...config.informed},predators:{...config.predators}}};
    this.worker.postMessage(request,[request.positions.buffer,request.directions.buffer,request.alive.buffer,request.informed.buffer,request.allegiance.buffer,request.regroup.buffer]);
  }
}
