import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { config } from '../src/config';
import { SpatialHash } from '../src/school/SpatialHash';
import { School } from '../src/school/School';
import { radians, randomGenerator, turnToward } from '../src/school/math';
import { Player } from '../src/player/Player';
import { Goal } from '../src/missions/Goal';

const defaults = structuredClone(config);
beforeEach(() => {
  for (const key of Object.keys(defaults) as (keyof typeof config)[]) Object.assign(config[key], defaults[key]);
});
const dt = 1 / 30;
const farLeader = { position: { x: 10000, y: -22, z: 0 }, direction: { x: 0, y: 0, z: 1 }, goalDirection: { x: 0, y: 0, z: 1 } };

function isolatedSchool(): School {
  config.school.noise = 0;
  const school = new School(100);
  for (let i = 0; i < school.count; i++) {
    school.positions.set([i * 100, -22, 0], i * 3);
    school.directions.set([0, 0, 1], i * 3);
  }
  return school;
}

test('spatial hash matches a brute force radius query, including negative cells and collisions', () => {
  const count = 1500, random = randomGenerator(71), p = new Float32Array(count * 3), result = new Int32Array(count);
  for (let i = 0; i < p.length; i++) p[i] = (random() - 0.5) * 400;
  const hash = new SpatialHash(count); hash.build(p, count, 5);
  for (let i = 0; i < count; i += 17) {
    const [x, y, z] = p.slice(i * 3, i * 3 + 3);
    const n = hash.query(x, y, z, result, 10);
    const actual = Array.from(result.slice(0, n)).filter(j => Math.hypot(p[j * 3] - x, p[j * 3 + 1] - y, p[j * 3 + 2] - z) <= 10).sort((a, b) => a - b);
    const expected = Array.from({ length: count }, (_, j) => j).filter(j => Math.hypot(p[j * 3] - x, p[j * 3 + 1] - y, p[j * 3 + 2] - z) <= 10);
    assert.deepEqual(actual, expected);
  }
});

test('recruitment requires two continuous seconds of close, aligned swimming', () => {
  const s = isolatedSchool();
  const leader = structuredClone(farLeader); leader.position.x = 0;
  const step = (): void => { leader.position.z = s.positions[2] + 3; s.step(dt, leader); };
  for (let i = 0; i < 59; i++) step();
  assert.equal(s.informed[0], 0);
  leader.direction.z = -1; step(); assert.equal(s.contact[0], 0);
  leader.direction.z = 1;
  for (let i = 0; i < 59; i++) step();
  assert.equal(s.informed[0], 0); step(); assert.equal(s.informed[0], 1);
});

test('cooldown requires ten continuous seconds beyond 25; returning resets the timer', () => {
  const s = isolatedSchool(); s.informed[0] = 1;
  for (let i = 0; i < 299; i++) s.step(dt, farLeader);
  assert.equal(s.informed[0], 1);
  s.step(dt, { ...farLeader, position: { x: 0, y: -22, z: s.positions[2] + 3 } });
  assert.equal(s.away[0], 0);
  for (let i = 0; i < 299; i++) s.step(dt, farLeader);
  assert.equal(s.informed[0], 1); s.step(dt, farLeader); assert.equal(s.informed[0], 0);
});

test('a fish in the rear blind cone does not steer the focal fish', () => {
  const s = isolatedSchool(); s.positions.set([0, -22, -2], 3); s.directions.set([1, 0, 0], 3);
  s.step(dt, farLeader);
  assert.ok(Math.abs(s.directions[0]) < 1e-6);
  const t = isolatedSchool(); t.positions.set([0, -22, 2], 3); t.directions.set([1, 0, 0], 3);
  t.step(dt, farLeader); assert.ok(t.directions[0] > 0.01);
});

test('repulsion has priority over informed steering', () => {
  const s = isolatedSchool();
  s.positions.set([0.4, -22, 0], 3); s.informed[0] = 1;
  s.step(dt, { ...farLeader, goalDirection: { x: 1, y: 0, z: 0 } });
  assert.ok(s.directions[0] < 0, 'turns away from neighbor despite +X goal');
});

test('a 180 degree turn stays normalized and respects angular speed', () => {
  const out = new Float32Array(3), angle = 200 * radians / 30;
  turnToward(out, 0, 0, 0, 1, 0, 0, -1, angle);
  assert.ok(Math.abs(Math.hypot(...out) - 1) < 1e-6);
  assert.ok(Math.abs(Math.acos(out[2]) - angle) < 1e-6);
});

test('player heading memory expires after two seconds; boost drains and cruising restores stamina', () => {
  const p = new Player(); p.yaw = Math.PI / 2;
  for (let i = 0; i < 30; i++) p.step(dt, { yaw: 0, pitch: 0, boost: true });
  assert.ok(p.goalDirection.x > 0.65 && p.goalDirection.z > 0.65);
  assert.ok(p.stamina < 0.8 && p.speed > 10);
  for (let i = 0; i < 30; i++) p.step(dt, { yaw: 0, pitch: 0, boost: false });
  assert.ok(p.goalDirection.x > 0.999 && Math.abs(p.goalDirection.z) < 1e-5);
  assert.ok(p.stamina > 0.85);
});

test('goal is based on school centroid, latches arrival time, and can reset', () => {
  const goal = new Goal();
  assert.equal(Math.hypot(config.goal.x, config.goal.z), 80);
  goal.step(2, { x: 0, y: -22, z: 0 }); assert.equal(goal.arrived, false);
  goal.step(1, { x: config.goal.x + 15, y: config.goal.y, z: config.goal.z });
  assert.equal(goal.arrived, true); assert.equal(goal.elapsed, 3);
  goal.step(4, { x: 0, y: -22, z: 0 }); assert.equal(goal.elapsed, 3);
  goal.reset(); assert.equal(goal.arrived, false); assert.equal(goal.elapsed, 0);
});

test('informed preference bends a 1500-fish school; removing preference changes the outcome', () => {
  config.school.noise = 0;
  const run = (weight: number): number => {
    config.informed.weight = weight;
    const school = new School(1500);
    // Controlled experiment: 10% informed, same seed and same 8-second trajectory.
    for (let i = 0; i < 150; i++) school.informed[i] = 1;
    const leader = { ...structuredClone(farLeader), goalDirection: { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 } };
    for (let step = 0; step < 240; step++) school.step(dt, leader);
    for (const n of school.positions) assert.ok(Number.isFinite(n));
    for (let i = 0; i < school.count; i++) assert.ok(Math.abs(Math.hypot(...school.directions.slice(i * 3, i * 3 + 3)) - 1) < 1e-5);
    return Math.atan2(school.meanDirection.x, school.meanDirection.z) / radians;
  };
  const noPreference = run(0), preference = run(0.6);
  assert.ok(preference > noPreference + 8, `turns ${preference.toFixed(1)}° versus ${noPreference.toFixed(1)}°`);
});
