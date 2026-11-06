import { Vector3 } from 'three';
import { config } from '../config';
import type { School } from '../school/School';
import type { Player } from '../player/Player';
import { clamp } from '../school/math';

export type Encounter = 'none' | 'bonito' | 'dolphins' | 'birds' | 'mixed';
export type PredatorKind = 'bonito' | 'dolphin' | 'bird';
export type Phase = 'waiting' | 'warning' | 'attack' | 'recover' | 'orbit' | 'climb';
export const encounterNames: Record<Encounter, string> = { none: 'おだやかな海', bonito: 'カツオの突進', dolphins: 'イルカの包囲', birds: '海鳥の急降下', mixed: 'イルカと海鳥' };
export const predatorNames: Record<PredatorKind, string> = { bonito: 'カツオ', dolphin: 'イルカ', bird: '海鳥' };
export const isEncounter = (value: string | null): value is Encounter => value !== null && Object.hasOwn(encounterNames, value);

export class Predator {
  position = new Vector3();
  previous = new Vector3();
  direction = new Vector3(0, 0, 1);
  target = new Vector3();
  phase: Phase = 'waiting';
  phaseTime = 0;
  danger = false;
  canCapture = false;
  preyIndex = -1;
  radius = config.predators.fleeRadius;
  biteRadius: number;
  constructor(public kind: PredatorKind, public id: number) {
    this.biteRadius = kind === 'bonito' ? config.predators.bonitoBite : kind === 'dolphin' ? config.predators.dolphinBite : config.predators.birdBite;
  }
}

/** Relative swept-sphere test: crossing between ticks also counts as contact. */
export function sweptHit(a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3, radius: number): boolean {
  const x = a0.x - b0.x, y = a0.y - b0.y, z = a0.z - b0.z;
  const dx = a1.x - b1.x - x, dy = a1.y - b1.y - y, dz = a1.z - b1.z - z;
  const length2 = dx * dx + dy * dy + dz * dz;
  const t = length2 > 1e-10 ? clamp(-(x * dx + y * dy + z * dz) / length2, 0, 1) : 0;
  return (x + t * dx) ** 2 + (y + t * dy) ** 2 + (z + t * dz) ** 2 <= radius ** 2;
}

export class Predators {
  items: Predator[] = [];
  elapsed = 0;
  mode: Encounter = 'bonito';
  private pass = 0;
  private previousCenter = new Vector3();
  private centerDrift = new Vector3();
  private fishStart = new Vector3();
  private fishEnd = new Vector3();
  private destination = new Vector3();
  get graceSeconds(): number { return this.mode === 'birds' ? config.predators.birdGraceSeconds : config.predators.graceSeconds; }

  reset(mode: Encounter, school: School): void {
    this.mode = mode; this.elapsed = 0; this.pass = 0; this.previousCenter.copy(school.centroid);
    const kinds: PredatorKind[] = mode === 'mixed' ? [...Array(config.predators.dolphinCount).fill('dolphin'), 'bird'] : mode === 'none' ? [] : mode === 'dolphins' ? Array(config.predators.dolphinCount).fill('dolphin') : [mode === 'birds' ? 'bird' : 'bonito'];
    this.items = kinds.map((kind, id) => {
      const p = new Predator(kind, id), c = school.centroid;
      if (kind === 'dolphin') {
        const a = id / kinds.length * Math.PI * 2;
        p.position.set(c.x + Math.cos(a) * config.predators.dolphinOrbit, c.y, c.z + Math.sin(a) * config.predators.dolphinOrbit);
      } else p.position.set(c.x + config.predators.bonitoDistance, kind === 'bird' ? config.predators.birdHeight : c.y, c.z);
      p.previous.copy(p.position); p.target.copy(c); return p;
    });
  }
  step(dt: number, school: School): void {
    this.elapsed += dt;
    this.centerDrift.copy(school.centroid).sub(this.previousCenter);this.previousCenter.copy(school.centroid);
    for (const p of this.items) {
      p.previous.copy(p.position); p.phaseTime += dt;
      p.radius = config.predators.fleeRadius;
      if (this.elapsed < this.graceSeconds) continue;
      if (p.kind === 'bonito') this.bonito(p, dt, school);
      else if (p.kind === 'dolphin') { if(p.phase !== 'attack')p.position.add(this.centerDrift); this.dolphin(p, dt, school); }
      else this.bird(p, dt, school);
      p.danger = p.position.y < config.world.surfaceY && p.phase !== 'waiting';
      p.canCapture = p.phase === 'attack' && p.position.y < config.world.surfaceY;
    }
  }
  private phase(p: Predator, phase: Phase): void { p.phase = phase; p.phaseTime = 0; }
  private aim(p: Predator, target: Vector3): void {
    this.destination.copy(target).sub(p.position);
    if (this.destination.lengthSq() > 1e-8) p.direction.copy(this.destination).normalize();
  }
  private swimTo(p: Predator, target: Vector3, speed: number, dt: number): void {
    const distance = p.position.distanceTo(target); this.aim(p, target);
    p.position.addScaledVector(p.direction, Math.min(distance, speed * dt));
  }
  private bonito(p: Predator, dt: number, school: School): void {
    const c = config.predators;
    if (p.phase === 'waiting' || (p.phase === 'recover' && p.phaseTime >= c.bonitoRest)) {
      const side = this.pass++ % 2 ? -1 : 1;
      p.target.copy(school.centroid).addScaledVector(new Vector3().copy(school.meanDirection), 5);
      p.position.copy(p.target).add(new Vector3(side * c.bonitoDistance, 0, -5));
      p.previous.copy(p.position); this.aim(p, p.target); this.phase(p, 'warning');
    } else if (p.phase === 'warning') {
      p.target.copy(school.centroid).addScaledVector(new Vector3().copy(school.meanDirection), 6);
      this.aim(p, p.target);
      if (p.phaseTime >= c.bonitoWarning) this.phase(p, 'attack');
    } else {
      // Locked attack heading: the player can dodge; the predator cannot home in mid-pass.
      p.position.addScaledVector(p.direction, c.bonitoSpeed * dt);
      if (p.phase === 'attack' && p.phaseTime >= c.bonitoAttack) this.phase(p, 'recover');
    }
  }
  private dolphin(p: Predator, dt: number, school: School): void {
    const c = config.predators, t = this.elapsed - c.graceSeconds;
    const dolphinCount = this.items.filter(item => item.kind === 'dolphin').length;
    const round = Math.floor(t / c.dolphinPeriod), within = t % c.dolphinPeriod;
    const attacking = round % dolphinCount === p.id && within >= c.dolphinPeriod - c.dolphinAttack;
    if (attacking) {
      if (p.phase !== 'attack') {
        p.target.copy(school.centroid).addScaledVector(new Vector3().copy(school.meanDirection), 2);
        this.aim(p, p.target); this.phase(p, 'attack');
      }
      p.position.addScaledVector(p.direction, c.dolphinAttackSpeed * dt);
    } else {
      const warning = round % dolphinCount === p.id && within >= c.dolphinPeriod - c.dolphinAttack - 2;
      const phase = warning ? 'warning' : 'orbit';
      if (p.phase !== phase) this.phase(p, phase);
      const radius = (c.dolphinOrbit + (c.dolphinMinOrbit - c.dolphinOrbit) * Math.min(1, t / c.dolphinTightenSeconds)) * Math.max(.65,Math.cbrt(school.count/1500));
      const a = p.id / dolphinCount * Math.PI * 2 + t * c.dolphinSpeed / c.dolphinOrbit;
      p.target.set(school.centroid.x + Math.cos(a) * radius, school.centroid.y + Math.sin(a * 1.5) * 3, school.centroid.z + Math.sin(a) * radius);
      this.swimTo(p, p.target, c.dolphinSpeed, dt);
      if (warning) p.target.copy(school.centroid).addScaledVector(new Vector3().copy(school.meanDirection), 2);
    }
  }
  private bird(p: Predator, dt: number, school: School): void {
    const c = config.predators;
    if (p.phase === 'waiting' || (p.phase === 'orbit' && p.phaseTime >= c.birdPeriod)) {
      let highest = -Infinity, index = -1;
      for (let i = 0; i < school.count; i++) if (school.alive[i] && school.positions[i * 3 + 1] > highest) { highest = school.positions[i * 3 + 1]; index = i; }
      if (index >= 0 && highest >= -c.birdMaxDepth) {
        p.preyIndex = index;
        p.target.fromArray(school.positions, index * 3);
        p.target.y = Math.min(-2, p.target.y);
        p.position.copy(p.target).add(new Vector3(10, 0, -8)); p.position.y = c.birdHeight;
        p.previous.copy(p.position); this.aim(p, p.target); this.phase(p, 'warning');
      } else {
        if (p.phase !== 'orbit') this.phase(p, 'orbit');
        const a = this.elapsed * 0.4;
        p.target.set(school.centroid.x + Math.cos(a) * 20, c.birdHeight, school.centroid.z + Math.sin(a) * 20);
        this.swimTo(p, p.target, c.birdClimbSpeed, dt);
      }
    } else if (p.phase === 'warning') {
      if (!school.alive[p.preyIndex] || school.positions[p.preyIndex * 3 + 1] < -c.birdMaxDepth) {
        this.phase(p, 'orbit'); return;
      }
      p.target.fromArray(school.positions, p.preyIndex * 3);
      p.target.addScaledVector(new Vector3().fromArray(school.directions, p.preyIndex * 3), school.speeds[p.preyIndex] * 0.6);
      p.target.y = clamp(p.target.y, -c.birdMaxDepth, config.world.maxY);
      this.aim(p, p.target);
      if (p.phaseTime >= c.birdWarning) this.phase(p, 'attack');
    } else if (p.phase === 'attack') {
      p.position.addScaledVector(p.direction, c.birdSpeed * dt);
      if (p.position.y <= -c.birdMaxDepth || p.phaseTime > 2) { this.phase(p, 'climb'); p.target.copy(p.position); p.target.y = c.birdHeight; }
    } else if (p.phase === 'climb') {
      this.swimTo(p, p.target, c.birdClimbSpeed, dt);
      if (p.position.y >= c.birdHeight - 0.1) this.phase(p, 'orbit');
    } else {
      const a = this.elapsed * 0.4;
      p.target.set(school.centroid.x + Math.cos(a) * 20, c.birdHeight, school.centroid.z + Math.sin(a) * 20);
      this.swimTo(p, p.target, c.birdClimbSpeed, dt);
    }
  }
  capture(school: School, player: Pick<Player, 'position' | 'previous'>): PredatorKind | null {
    let killer: PredatorKind | null = null, changed = false;
    for (const p of this.items) {
      if (!p.canCapture) continue;
      if (sweptHit(player.previous, player.position, p.previous, p.position, p.biteRadius)) killer ??= p.kind;
      for (let i = 0; i < school.count; i++) {
        if (!school.alive[i]) continue;
        this.fishStart.fromArray(school.previous, i * 3); this.fishEnd.fromArray(school.positions, i * 3);
        if (sweptHit(this.fishStart, this.fishEnd, p.previous, p.position, p.biteRadius)) {
          school.alive[i] = 0; school.informed[i] = 0; school.contact[i] = 0; school.regroup[i] = 0; changed = true;
        }
      }
    }
    if (changed) school.measure();
    return killer;
  }
}
