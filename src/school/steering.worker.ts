import { config } from '../config';
import { School } from './School';
import type { SteeringRequest } from './SteeringWorker';
let school:School|undefined;
self.onmessage=(event:MessageEvent<SteeringRequest>)=>{
  const r=event.data;if(!school||school.count!==r.count)school=new School(r.count);
  Object.assign(config.school,r.settings.school);Object.assign(config.informed,r.settings.informed);Object.assign(config.predators,r.settings.predators);
  school.positions.set(r.positions);school.directions.set(r.directions);school.alive.set(r.alive);school.informed.set(r.informed);school.allegiance.set(r.allegiance);school.regroup.set(r.regroup);school.rival=r.rival;
  school.steeringOutput=new Float32Array(r.count*3);
  // dt=0 computes social targets only. Recruitment, flee priority, turn bounds and movement run on the main thread at 30Hz.
  school.step(0,r.leader);
  self.postMessage({generation:r.generation,steering:school.steeringOutput},{transfer:[school.steeringOutput.buffer]});
};
