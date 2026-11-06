import { config, normalizeRadii } from '../config';
import { clamp, radians, randomGenerator, turnToward } from './math';
import { SpatialHash } from './SpatialHash';
import type { Predator } from '../predators/Predators';

export interface Leader {
  position: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  goalDirection: { x: number; y: number; z: number };
}

export class School {
  count = 0;
  positions = new Float32Array(0);
  previous = new Float32Array(0);
  directions = new Float32Array(0);
  private nextDirections = new Float32Array(0);
  informed = new Uint8Array(0);
  contact = new Float32Array(0);
  away = new Float32Array(0);
  members = 0;
  alive = new Uint8Array(0);
  trapped = new Uint8Array(0);
  speeds = new Float32Array(0);
  regroup = new Float32Array(0);
  frightened = new Uint8Array(0);
  survivors = 0;
  fleeing = 0;
  centroid = { x: 0, y: 0, z: 0 };
  meanDirection = { x: 0, y: 0, z: 1 };
  coherence = 1;
  cachedSteering?: Float32Array;
  steeringOutput?: Float32Array;
  private environmentalForce = new Float32Array(3);
  environment?: { steer(x:number,y:number,z:number,out:Float32Array): void };
  rival?: Leader;
  allegiance = new Uint8Array(0);
  rivalContact = new Float32Array(0);
  private hash = new SpatialHash(0);
  private candidates = new Int32Array(0);
  private random = randomGenerator(config.simulation.seed);

  constructor(count = config.school.count) { this.reset(count); }

  reset(count = this.count): void {
    this.cachedSteering=undefined;
    this.count = Math.round(clamp(count, config.school.minCount, config.school.maxCount));
    config.school.count = this.count;
    this.positions = new Float32Array(this.count * 3);
    this.previous = new Float32Array(this.count * 3);
    this.directions = new Float32Array(this.count * 3);
    this.nextDirections = new Float32Array(this.count * 3);
    this.informed = new Uint8Array(this.count);
    this.allegiance = new Uint8Array(this.count); this.rivalContact = new Float32Array(this.count);
    this.contact = new Float32Array(this.count);
    this.away = new Float32Array(this.count);
    this.alive = new Uint8Array(this.count).fill(1);
    this.trapped = new Uint8Array(this.count);
    this.speeds = new Float32Array(this.count).fill(config.school.cruiseSpeed);
    this.regroup = new Float32Array(this.count);
    this.frightened = new Uint8Array(this.count);
    this.hash = new SpatialHash(this.count);
    this.candidates = new Int32Array(this.count);
    this.random = randomGenerator(config.simulation.seed);
    // Uniform volume distribution; keep average density similar when count changes.
    const scale = Math.cbrt(this.count / 1500);
    for (let i = 0; i < this.count; i++) {
      let x: number, y: number, z: number;
      do { x = this.random() * 2 - 1; y = this.random() * 2 - 1; z = this.random() * 2 - 1; }
      while (x * x + y * y + z * z > 1);
      const j = i * 3;
      this.positions[j] = x * config.school.spawnRadius * scale;
      this.positions[j + 1] = y * config.school.spawnHeight * scale - config.school.spawnDepth;
      this.positions[j + 2] = z * config.school.spawnRadius * scale;
      const spread = config.school.spawnHeadingSpread;
      const dx = (this.random() - 0.5) * spread, dy = (this.random() - 0.5) * spread;
      const length = Math.hypot(dx, dy, 1);
      this.directions[j] = dx / length; this.directions[j + 1] = dy / length; this.directions[j + 2] = 1 / length;
    }
    this.previous.set(this.positions);
    this.measure();
  }

  step(dt: number, leader: Leader, predators: readonly Predator[] = []): void {
    normalizeRadii();
    const s = config.school, info = config.informed, w = config.world;
    const p = this.positions, d = this.directions, nd = this.nextDirections;
    const rep2 = s.repulsion ** 2, align2 = s.alignment ** 2, attr2 = s.attraction ** 2;
    const viewCos = Math.cos(s.fieldOfView * 0.5 * radians);
    const contactCos = Math.cos(info.angle * radians);
    const maxTurn = s.turnRate * radians * dt;
    const noise = s.noise * radians * Math.sqrt(dt);
    this.previous.set(p);
    const expanded = predators.some(predator => predator.danger) || this.regroup.some(time => time > 0);
    if (!this.cachedSteering) this.hash.build(p, this.count, (expanded ? Math.max(s.attraction, config.predators.regroupRadius) : s.attraction) / 2, this.alive);
    for (let i = 0; i < this.count; i++) {
      if (!this.alive[i]) continue;
      const k = i * 3, x = p[k], y = p[k + 1], z = p[k + 2];
      const hx = d[k], hy = d[k + 1], hz = d[k + 2];
      let threat: Predator | undefined, nearest = Infinity;
      for (const predator of predators) {
        if (!predator.danger) continue;
        const distance2 = (x - predator.position.x) ** 2 + (y - predator.position.y) ** 2 + (z - predator.position.z) ** 2;
        if (distance2 < predator.radius ** 2 && distance2 < nearest) { nearest = distance2; threat = predator; }
      }
      this.frightened[i] = threat ? 1 : 0;
      this.regroup[i] = threat ? config.predators.regroupSeconds : Math.max(0, this.regroup[i] - dt);
      this.speeds[i] = threat ? s.maxSpeed : this.speeds[i] + (s.cruiseSpeed - this.speeds[i]) * (1 - Math.exp(-config.predators.speedRecovery * dt));
      const regrouping = this.regroup[i] > 0;
      const searchRadius = regrouping ? Math.max(s.attraction, config.predators.regroupRadius) : s.attraction;
      const px = leader.position.x - x, py = leader.position.y - y, pz = leader.position.z - z;
      const pd2 = px*px+py*py+pz*pz;
      const dot = hx*leader.direction.x+hy*leader.direction.y+hz*leader.direction.z;
      const rivalDistance2=this.rival?(this.rival.position.x-x)**2+(this.rival.position.y-y)**2+(this.rival.position.z-z)**2:Infinity;
      const rivalAligned=this.rival ? hx*this.rival.direction.x+hy*this.rival.direction.y+hz*this.rival.direction.z>=contactCos : false;
      const blueEligible=pd2<=info.radius**2&&dot>=contactCos,redEligible=rivalDistance2<=info.radius**2&&rivalAligned;
      const nearestBlue=!redEligible||pd2<rivalDistance2||(pd2===rivalDistance2&&i%2===0);
      this.contact[i] = blueEligible && nearestBlue ? this.contact[i]+dt : 0;
      if(this.contact[i]+1e-6 >= info.seconds && this.allegiance[i] !== 1){this.informed[i]=1;this.allegiance[i]=1;this.away[i]=0;this.rivalContact[i]=0;}
      if(this.rival){
        const other=this.rival, distance2=(other.position.x-x)**2+(other.position.y-y)**2+(other.position.z-z)**2;
        const otherDot=hx*other.direction.x+hy*other.direction.y+hz*other.direction.z;
        this.rivalContact[i]=distance2<=info.radius**2&&otherDot>=contactCos&&(!blueEligible||!nearestBlue) ? this.rivalContact[i]+dt : 0;
        if(this.rivalContact[i]+1e-6>=info.seconds && this.allegiance[i]!==2){this.informed[i]=1;this.allegiance[i]=2;this.away[i]=0;this.contact[i]=0;}
      }
      const guide=this.allegiance[i]===2&&this.rival?this.rival:leader;
      if(this.informed[i]){
        const distance2=(guide.position.x-x)**2+(guide.position.y-y)**2+(guide.position.z-z)**2;
        this.away[i]=distance2>info.coolRadius**2?this.away[i]+dt:0;
        if(this.away[i]+1e-6>=info.coolSeconds){this.informed[i]=0;this.allegiance[i]=0;this.contact[i]=0;this.rivalContact[i]=0;this.away[i]=0;}
      }
      let tx=hx,ty=hy,tz=hz;
      if(this.cachedSteering){tx=this.cachedSteering[k];ty=this.cachedSteering[k+1];tz=this.cachedSteering[k+2];}
      else {
      let rx = 0, ry = 0, rz = 0, repCount = 0;
      let ax = hx, ay = hy, az = hz, alignCount = 0;
      let cx = 0, cy = 0, cz = 0, attrCount = 0;
      const n = this.hash.query(x, y, z, this.candidates, searchRadius);
      // Include the player as one ordinary visible neighbor, with no extra authority.
      for (let c = 0; c <= n + (this.rival ? 1 : 0); c++) {
        const j = c >= n ? -(c-n+1) : this.candidates[c];
        const neighbor = j === -2 ? this.rival! : leader;
        if (j === i) continue;
        const q = j * 3;
        const dx = j < 0 ? neighbor.position.x-x : p[q] - x;
        const dy = j < 0 ? neighbor.position.y-y : p[q + 1] - y;
        const dz = j < 0 ? neighbor.position.z-z : p[q + 2] - z;
        const dist2 = dx * dx + dy * dy + dz * dz;
        if (dist2 > (regrouping ? searchRadius ** 2 : attr2) || dist2 < 1e-10) continue;
        const viewDot = hx * dx + hy * dy + hz * dz;
        if (viewCos <= 0) {
          if (viewDot < 0 && viewDot * viewDot > dist2 * viewCos * viewCos) continue;
        } else if (viewDot < 0 || viewDot * viewDot < dist2 * viewCos * viewCos) continue;
        if (dist2 < rep2) {
          const invDist = 1 / Math.sqrt(dist2);
          rx -= dx * invDist; ry -= dy * invDist; rz -= dz * invDist; repCount++;
        } else if (dist2 < align2) {
          ax += j < 0 ? neighbor.direction.x : d[q];
          ay += j < 0 ? neighbor.direction.y : d[q + 1];
          az += j < 0 ? neighbor.direction.z : d[q + 2];
          alignCount++;
        } else {
          const invDist = 1 / Math.sqrt(dist2);
          cx += dx * invDist; cy += dy * invDist; cz += dz * invDist; attrCount++;
        }
      }

      if (repCount) { tx = rx; ty = ry; tz = rz; }
      else {
        if (alignCount || attrCount) {
          const al = Math.hypot(ax, ay, az) || 1, cl = Math.hypot(cx, cy, cz) || 1;
          const weight = regrouping ? config.predators.regroupWeight : s.attractionWeight;
          tx = ax / al + (attrCount ? weight * cx / cl : 0);
          ty = ay / al + (attrCount ? weight * cy / cl : 0);
          tz = az / al + (attrCount ? weight * cz / cl : 0);
        }
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        if (this.informed[i]) {
          tx += info.weight * guide.goalDirection.x;
          ty += info.weight * guide.goalDirection.y;
          tz += info.weight * guide.goalDirection.z;
        }
      }
      }
      if(this.steeringOutput){this.steeringOutput[k]=tx;this.steeringOutput[k+1]=ty;this.steeringOutput[k+2]=tz;}
      if (threat) {
        // Escape takes precedence over social direction, including rear threats.
        const distance = Math.sqrt(nearest) || 1;
        tx = (x - threat.position.x) / distance * config.predators.fleeWeight + hx * config.predators.forwardWeight;
        ty = (y - threat.position.y) / distance * config.predators.fleeWeight + hy * config.predators.forwardWeight;
        tz = (z - threat.position.z) / distance * config.predators.fleeWeight + hz * config.predators.forwardWeight;
      }
      if (this.environment) { this.environment.steer(x,y,z,this.environmentalForce); tx+=this.environmentalForce[0];ty+=this.environmentalForce[1];tz+=this.environmentalForce[2]; }
      // Soft vertical confinement, without a destination or hidden horizontal steering.
      if (y > w.maxY - w.depthMargin) ty -= s.depthTurnWeight * (1 - (w.maxY - y) / w.depthMargin);
      if (y < w.minY + w.depthMargin) ty += s.depthTurnWeight * (1 - (y - w.minY) / w.depthMargin);
      tx += (this.random() - 0.5) * noise;
      ty += (this.random() - 0.5) * noise;
      tz += (this.random() - 0.5) * noise;
      turnToward(nd, k, hx, hy, hz, tx, ty, tz, maxTurn);
    }
    // Double buffering prevents iteration order from changing neighbor observations.
    this.directions = nd; this.nextDirections = d;
    for (let i = 0; i < this.count; i++) {
      if (!this.alive[i]) continue;
      const k = i * 3;
      p[k] += nd[k] * this.speeds[i] * dt;
      p[k + 1] = clamp(p[k + 1] + nd[k + 1] * this.speeds[i] * dt, w.minY, w.maxY);
      p[k + 2] += nd[k + 2] * this.speeds[i] * dt;
    }
    this.measure();
  }

  measure(): void {
    let x = 0, y = 0, z = 0, dx = 0, dy = 0, dz = 0, members = 0, survivors = 0, fleeing = 0;
    for (let i = 0; i < this.count; i++) {
      if (!this.alive[i]) continue;
      survivors++; fleeing += this.frightened[i];
      const k = i * 3;
      x += this.positions[k]; y += this.positions[k + 1]; z += this.positions[k + 2];
      dx += this.directions[k]; dy += this.directions[k + 1]; dz += this.directions[k + 2];
      members += this.informed[i] && this.allegiance[i] !== 2 ? 1 : 0;
    }
    if (survivors) this.centroid = { x: x / survivors, y: y / survivors, z: z / survivors };
    const length = Math.hypot(dx, dy, dz);
    this.coherence = survivors ? length / survivors : 0;
    this.meanDirection = length > 1e-5 ? { x: dx / length, y: dy / length, z: dz / length } : { x: 0, y: 0, z: 0 };
    this.members = members;
    this.survivors = survivors; this.fleeing = fleeing;
  }
}
