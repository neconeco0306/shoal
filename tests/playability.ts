// Diagnostic pilot uses ordinary input; mission and fish states are not overridden after setup.
import {Vector3} from 'three';
import {School} from '../src/school/School';
import {Player} from '../src/player/Player';
import {Habitat} from '../src/world/Habitat';
import {Campaign} from '../src/missions/Campaign';
import {Predators} from '../src/predators/Predators';
import {clamp} from '../src/school/math';
for(const index of [0,1,9]){
 const s=new School(100),p=new Player(),w=new Habitat(),c=new Campaign(),pred=new Predators();c.reset(index);w.reset(c.biome,index+1);s.environment=w;
 if(index===9){for(let i=0;i<s.count;i++){s.positions[i*3]=s.positions[i*3]*.5+(i<s.count/2?-22:22);s.positions[i*3+2]*=.6;}p.position.x=-22;s.previous.set(s.positions);s.measure();}pred.reset(c.mission.encounter,s);
 const goal=new Vector3(...c.mission.goal);let time=0;
 for(;time<180&&!c.complete&&!c.failure;time+=1/30){
  const center=new Vector3().copy(s.centroid),destination=goal.clone();
  if(index===9){center.set(0,0,0);destination.set(0,0,0);for(let i=0;i<s.count;i++)(i<s.count/2?center:destination).add(new Vector3().fromArray(s.positions,i*3));center.multiplyScalar(2/s.count);destination.multiplyScalar(2/s.count).add(new Vector3(0,0,8));}
  const desired=destination.sub(center).normalize(),social=new Vector3().copy(s.meanDirection).lerp(desired,.2).normalize();const target=center.addScaledVector(social,12).sub(p.position).normalize();
  const yaw=Math.atan2(target.x,target.z),delta=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw)),pitch=Math.asin(target.y);
  p.step(1/30,time<4?{yaw:0,pitch:0,boost:false}:{yaw:clamp(-delta,-.5,.5),pitch:clamp(pitch-p.pitch,-.5,.5),boost:false});pred.step(1/30,s);s.step(1/30,p,pred.items);w.step(1/30,s,p);const killer=pred.capture(s,p);if(killer){c.failure=killer;break;}c.step(1/30,{school:s,elapsed:time,distance:new Vector3().copy(s.centroid).distanceTo(goal),captured:w.captured});
 }
 console.log(JSON.stringify({mission:index+1,complete:c.complete,time,progress:c.progress,failure:c.failure,members:s.members,centroid:s.centroid}));
}
