import { performance } from 'node:perf_hooks';
import { School } from '../src/school/School';
import { Player } from '../src/player/Player';

// CPU-only measurement. This is not a rendering FPS claim.
for (const count of [500, 1500]) {
  const school = new School(count), player = new Player(), samples: number[] = [];
  let maxMembers = 0;
  for (let i = 0; i < 300; i++) {
    player.step(1 / 30, { yaw: 0, pitch: 0, boost: false });
    const start = performance.now(); school.step(1 / 30, player);
    if (i >= 60) samples.push(performance.now() - start);
    maxMembers = Math.max(maxMembers, school.members);
  }
  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({ count, meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
    p95Ms: samples[Math.floor(samples.length * .95)], maxMembers, membersAt10s: school.members,
    centroid: school.centroid, coherence: school.coherence }));
}
