import { Vector3 } from 'three';
import { Player } from '../player/Player';
import type { School } from '../school/School';
import { components } from '../missions/Campaign';
import { clamp } from '../school/math';
export const blueBuoy=new Vector3(-85,-22,95),redBuoy=new Vector3(85,-22,95);
export function tugScore(school:School):[number,number] {
  let blue=0,red=0;
  for(const group of components(school)){let b=0,r=0;for(const i of group){const dx=school.positions[i*3];if(dx<-.5)b++;else if(dx>.5)r++;}blue=Math.max(blue,b);red=Math.max(red,r);}return[blue,red];
}
export class Tug {
  rival=new Player();elapsed=0;score:[number,number]=[0,0];finished=false;private clock=0;private target=new Vector3();
  reset(school:School):void{this.rival.reset();this.rival.position.x=3;this.rival.previous.copy(this.rival.position);school.rival=this.rival;this.elapsed=0;this.score=[0,0];this.finished=false;this.clock=0;}
  step(dt:number,school:School):void{
    let allies=0;for(let i=0;i<school.count;i++)if(school.alive[i]&&school.allegiance[i]===2)allies++;
    this.target.copy(school.centroid);const distance=this.rival.position.distanceTo(this.target);
    if(allies>=Math.min(15,school.count*.04)&&distance<20)this.target.lerp(redBuoy,.65);else this.target.addScaledVector(new Vector3().copy(school.meanDirection),3);
    this.target.sub(this.rival.position).normalize();const targetYaw=Math.atan2(this.target.x,this.target.z),delta=Math.atan2(Math.sin(targetYaw-this.rival.yaw),Math.cos(targetYaw-this.rival.yaw));
    this.rival.step(dt,{yaw:clamp(-delta*2,-1,1),pitch:clamp((Math.asin(this.target.y)-this.rival.pitch)*2,-1,1),boost:distance>18});
    this.elapsed+=dt;this.clock-=dt;if(this.clock<=0||this.elapsed>=60){this.score=tugScore(school);this.clock=.5;}this.finished=this.elapsed>=60;
  }
}
