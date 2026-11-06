import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { Vector3 } from 'three';
import { config } from '../src/config';
import { School } from '../src/school/School';
import { Player } from '../src/player/Player';
import { Predator, Predators, sweptHit, isEncounter } from '../src/predators/Predators';

const defaults = structuredClone(config), dt = 1 / 30;
beforeEach(() => { for (const key of Object.keys(defaults) as (keyof typeof config)[]) Object.assign(config[key], defaults[key]); });
const leader = { position: new Vector3(10000, -22, 0), direction: new Vector3(0, 0, 1), goalDirection: new Vector3(1, 0, 0) };

test('rear predator overrides informed steering and activates maximum escape speed', () => {
  config.school.noise = 0;
  const school = new School(100);
  for (let i = 0; i < school.count; i++) { school.positions.set([i * 100, -22, 0], i * 3); school.directions.set([0, 0, 1], i * 3); }
  school.informed[0] = 1;
  const p = new Predator('bonito', 0); p.position.set(0.5, -22, -2); p.danger = true;
  school.step(dt, leader, [p]);
  assert.ok(school.directions[0] < 0, 'moves away despite +X preference and rear blind cone');
  assert.equal(school.speeds[0], config.school.maxSpeed); assert.equal(school.frightened[0], 1);
  p.danger = false;
  for (let i = 0; i < 180; i++) school.step(dt, leader, [p]);
  assert.ok(Math.abs(school.speeds[0] - config.school.cruiseSpeed) < 0.01);
  assert.equal(school.regroup[0], 0); assert.equal(school.frightened[0], 0);
});

test('swept capture detects a crossing, ignores a miss and accounts for both moving bodies', () => {
  const zero = new Vector3();
  assert.equal(sweptHit(zero, zero, new Vector3(-10, 0, 0), new Vector3(10, 0, 0), 1), true);
  assert.equal(sweptHit(zero, zero, new Vector3(-10, 2, 0), new Vector3(10, 2, 0), 1), false);
  assert.equal(sweptHit(new Vector3(-10, 0, 0), new Vector3(10, 0, 0), new Vector3(10, 0, 0), new Vector3(-10, 0, 0), 1), true);
});

test('captures exclude dead fish from membership and centroid, are idempotent and reset cleanly', () => {
  const school = new School(100), predators = new Predators(), player = new Player();
  for (let i = 0; i < school.count; i++) school.positions.set([100 + i, -22, 0], i * 3);
  school.positions.set([0, -22, 0], 0); school.previous.set(school.positions); school.informed[0] = 1;
  predators.reset('bonito', school);
  const p = predators.items[0]; p.previous.set(-5, -22, 0); p.position.set(5, -22, 0); p.canCapture = true;
  player.previous.set(0, -22, 0); player.position.copy(player.previous);
  assert.equal(predators.capture(school, player), 'bonito');
  assert.equal(school.survivors, 99); assert.equal(school.members, 0); assert.ok(school.centroid.x > 100);
  predators.capture(school, player); assert.equal(school.survivors, 99);
  school.alive.fill(0); school.measure(); assert.equal(school.survivors, 0);
  assert.ok(Number.isFinite(school.centroid.x)); assert.equal(school.coherence, 0);
  school.reset(); predators.reset('none', school);
  assert.equal(school.survivors, 100); assert.equal(school.members, 0); assert.equal(predators.items.length, 0); assert.equal(predators.elapsed, 0);
});

test('bonito gives grace and warning, then holds a straight heading through its pass', () => {
  const school = new School(100), predators = new Predators(); predators.reset('bonito', school);
  for (let i = 0; i < 150; i++) predators.step(dt, school);
  assert.equal(predators.items[0].phase, 'waiting'); assert.equal(predators.items[0].canCapture, false);
  let sawWarning = false, sawAttack = false; let heading: Vector3 | undefined;
  for (let i = 0; i < 250; i++) {
    predators.step(dt, school); const p = predators.items[0];
    if (p.phase === 'warning') { sawWarning = true; assert.equal(p.canCapture, false); }
    if (p.phase === 'attack') {
      sawAttack = true;
      if (!heading) heading = p.direction.clone(); else assert.ok(heading.distanceTo(p.direction) < 1e-8);
      assert.ok(p.position.distanceTo(p.previous) <= config.predators.bonitoSpeed * dt + 1e-6);
    }
  }
  assert.ok(sawWarning && sawAttack);
  assert.equal(isEncounter('constructor'), false); assert.equal(isEncounter('invalid'), false); assert.equal(isEncounter('birds'), true);
});

test('three dolphins surround the school and take turns attacking', () => {
  const school = new School(100), predators = new Predators(); predators.reset('dolphins', school);
  const attackers = new Set<number>(); assert.equal(predators.items.length, 3);
  for (let i = 0; i < 1200; i++) {
    predators.step(dt, school);
    const active = predators.items.filter(p => p.phase === 'attack'); assert.ok(active.length <= 1);
    active.forEach(p => attackers.add(p.id));
    for (const p of predators.items) assert.ok(p.position.toArray().every(Number.isFinite));
  }
  assert.equal(attackers.size, 3);
});

test('birds do not target deep fish, but warn and dive underwater for shallow fish', () => {
  const school = new School(100), predators = new Predators();
  for (let i = 0; i < school.count; i++) school.positions[i * 3 + 1] = -35;
  school.measure(); predators.reset('birds', school);
  for (let i = 0; i < 1000; i++) { predators.step(dt, school); assert.notEqual(predators.items[0].phase, 'attack'); }
  for (let i = 0; i < school.count; i++) school.positions[i * 3 + 1] = -5;
  school.measure(); let warned = false, underwater = false, climbed = false;
  for (let i = 0; i < 450; i++) {
    predators.step(dt, school); const p = predators.items[0];
    warned ||= p.phase === 'warning'; underwater ||= p.phase === 'attack' && p.danger; climbed ||= p.phase === 'climb';
    if (p.position.y > 0) assert.equal(p.canCapture, false);
  }
  assert.ok(warned && underwater && climbed);
});

test('diving below bird reach during its warning cancels that attack', () => {
  const school = new School(100), predators = new Predators();
  for (let i = 0; i < school.count; i++) school.positions[i * 3 + 1] = -5;
  school.measure(); predators.reset('birds', school);
  while (predators.items[0].phase !== 'warning' && predators.elapsed < 10) predators.step(dt, school);
  assert.equal(predators.items[0].phase, 'warning');
  for (let i = 0; i < school.count; i++) school.positions[i * 3 + 1] = -30;
  predators.step(dt, school);
  assert.equal(predators.items[0].phase, 'orbit'); assert.equal(predators.items[0].canCapture, false);
});

test('a head-on pass splits the school laterally, then local attraction brings it back together', () => {
  config.school.noise = 0;
  const school = new School(100), p = new Predator('bonito', 0);
  const width = (): number => {
    let sum = 0;
    for (let i = 0; i < school.count; i++) sum += (school.positions[i * 3] - school.centroid.x) ** 2 + (school.positions[i * 3 + 1] - school.centroid.y) ** 2;
    return Math.sqrt(sum / school.count);
  };
  const initial = width(); let peak = initial;
  for (let i = 0; i < 240; i++) {
    p.position.set(0, -22, 25 - i * 18 / 30); p.danger = i < 120;
    school.step(dt, leader, [p]); peak = Math.max(peak, width());
  }
  assert.ok(peak > initial * 1.5, 'escape opens the school around the attack path');
  assert.ok(width() < peak * 0.6, 'school closes after the predator passes');
  assert.equal(school.fleeing, 0); assert.equal(school.survivors, 100);
  assert.ok(school.coherence > 0.9);
});

test('the shallow moving-school encounter produces its first underwater dive within eight seconds', () => {
  const school = new School(100), player = new Player(), predators = new Predators();
  for (let i = 0; i < school.count; i++) {
    const height = (school.positions[i * 3 + 1] + config.school.spawnDepth) / config.school.spawnHeight;
    school.positions[i * 3 + 1] = -config.predators.birdStartDepth + height * config.predators.birdSchoolHalfHeight;
  }
  school.previous.set(school.positions); school.measure();
  player.position.y = -config.predators.birdStartDepth; player.previous.copy(player.position);
  predators.reset('birds', school); let dived = false;
  for (let i = 0; i < 240; i++) {
    player.step(dt, { yaw: 0, pitch: 0, boost: false });
    predators.step(dt, school); school.step(dt, player, predators.items);
    if (predators.items[0].phase === 'attack' && predators.items[0].danger) { dived = true; break; }
  }
  assert.ok(dived);
});
