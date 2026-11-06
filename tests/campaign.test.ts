import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Campaign, components, missions } from '../src/missions/Campaign';
import { School } from '../src/school/School';
import { Habitat, crossesNet } from '../src/world/Habitat';
import { Player } from '../src/player/Player';
import { tugScore } from '../src/game/Tug';
import { validAxes, validRoom } from '../src/network/Protocol';
import { animal } from '../src/predators/Models';
import { Mesh } from 'three';
const state=(school:School,elapsed=20,distance=0,captured=0)=>({school,elapsed,distance,captured,sheltered:true});
function compact(s:School,x=0,y=-30,z=100):void {for(let i=0;i<s.count;i++){s.positions.set([x+(i%10)*.3,y,z+Math.floor(i/10)*.3],i*3);}s.previous.set(s.positions);s.measure();}
test('all 12 mission objectives have reachable success and three-star ratings',()=>{
  assert.equal(missions.length,12);
  for(let index=0;index<12;index++){const c=new Campaign(),s=new School(100);c.reset(index);compact(s,-25);s.members=50;const t=missions[index].par;
    if(index===11){assert.equal(c.step(.1,state(s,t)),'next-sea');assert.equal(c.biome,'current');assert.equal(c.step(.1,state(s,t)),'next-sea');assert.equal(c.biome,'night');}
    for(let i=0;i<7;i++)c.step(1,state(s,t));assert.equal(c.failure,'',`mission ${index+1}`);assert.equal(c.complete,true,`mission ${index+1}`);assert.equal(c.stars,3,`mission ${index+1}`);
  }
});
test('whole-school and no-loss objectives reject a single straggler/capture',()=>{const s=new School(100);compact(s,-25);s.positions[2]=70;const c=new Campaign();c.reset(1);c.step(1,state(s));assert.equal(c.complete,false);c.reset(3);c.step(1,state(s,20,0,1));assert.match(c.failure,/網/);assert.equal(c.complete,false);});
test('survival and time constraints fail before success on the same tick',()=>{const s=new School(100),c=new Campaign();s.alive.fill(0,0,21);s.measure();c.reset(2);c.step(1,state(s,60));assert.equal(c.complete,false);assert.ok(c.failure);c.reset(4);c.step(1,state(s,66,0));assert.equal(c.complete,false);assert.ok(c.failure);});
test('two schools need both original populations connected continuously',()=>{const s=new School(100),c=new Campaign();compact(s);for(let i=50;i<100;i++)s.positions[i*3]+=50;c.reset(9);for(let i=0;i<7;i++)c.step(1,state(s));assert.equal(c.complete,false);assert.equal(components(s).length,2);compact(s);for(let i=0;i<6;i++)c.step(1,state(s));assert.equal(c.complete,true);});
test('tug counts the largest component on each side, ties remain ties',()=>{const s=new School(100);compact(s,-30);for(let i=40;i<100;i++)s.positions[i*3]=30+(i%10)*.3;assert.deepEqual(tugScore(s),[40,60]);for(let i=40;i<70;i++)s.positions[i*3+2]+=70;assert.deepEqual(tugScore(s),[40,30]);});
test('swept nets catch crossings and ignore motion parallel outside',()=>{const n={min:new Vector3(-5,-40,5),max:new Vector3(5,-2,6)};assert.equal(crossesNet(new Vector3(0,-20,0),new Vector3(0,-20,20),n),true);assert.equal(crossesNet(new Vector3(8,-20,0),new Vector3(8,-20,20),n),false);});
test('current drift, rock shelter, physical rock and net collisions',()=>{const w=new Habitat(),s=new School(100),p=new Player();w.reset('current',6);assert.equal(w.currentAt(0,-24,70),w.current.z*.08);assert.equal(w.currentAt(40,-24,70),w.current.z);p.position.set(0,-25,91);w.step(1/30,s,p);assert.ok(p.position.distanceTo(new Vector3(0,-25,91))>=13-.001);w.reset('reef',4);s.previous.set([-10,-20,50],0);s.positions.set([-10,-20,80],0);w.step(0,s,p);assert.equal(s.alive[0],0);assert.ok(w.captured>=1);w.step(0,s,p);assert.equal(s.alive[0],0);});
test('protocol bounds reject malformed input and room codes',()=>{assert.ok(validAxes({yaw:-1,pitch:1,boost:true}));for(const v of [{yaw:NaN,pitch:0,boost:false},{yaw:2,pitch:0,boost:false},{yaw:0,pitch:0,boost:'yes'},null])assert.equal(validAxes(v),false);assert.ok(validRoom('ABCD23'));assert.equal(validRoom('<html>'),false);});
test('animal geometry is finite and models include animated anatomical parts',()=>{for(const kind of ['dolphin','bonito','bird'] as const){const model=animal(kind);let triangles=0;model.traverse(o=>{if(o instanceof Mesh){const p=o.geometry.getAttribute('position');for(const value of p.array)assert.ok(Number.isFinite(value));triangles+=(o.geometry.index?.count??p.count)/3;}});assert.ok(triangles>1000);assert.ok(model.getObjectByName(kind==='bird'?'wings':'tail'));}});
test('overlapping influence areas recruit the nearer leader on both sides',()=>{
  const s=new School(100),a=new Player(),b=new Player();s.rival=b;
  for(let i=0;i<s.count;i++){s.positions.set([i<2?(i===0?-1:1):i*100,-22,0],i*3);s.directions.set([0,0,1],i*3);}
  a.position.set(-3,-22,0);b.position.set(3,-22,0);
  for(let tick=0;tick<72;tick++){a.position.z=s.positions[2];b.position.z=s.positions[5];s.step(1/30,a);}
  assert.equal(s.allegiance[0],1);assert.equal(s.allegiance[1],2);assert.equal(s.informed[0],1);assert.equal(s.informed[1],1);
});
test('cached social targets preserve steering and keep predator escape responsive',async()=>{
  const {Predator}=await import('../src/predators/Predators');const a=new School(100),b=new School(100),worker=new School(100),p=new Player();
  worker.steeringOutput=new Float32Array(300);worker.step(0,p);b.cachedSteering=worker.steeringOutput;
  const threat=new Predator('bonito',0);threat.position.copy(p.position).add(new Vector3(0,0,-5));threat.danger=true;
  a.step(1/30,p,[threat]);b.step(1/30,p,[threat]);for(let i=0;i<a.positions.length;i++)assert.ok(Math.abs(a.positions[i]-b.positions[i])<1e-5);assert.ok(b.fleeing>0);assert.equal(a.members,b.members);
});
