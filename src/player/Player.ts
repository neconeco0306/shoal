import { Vector3 } from 'three';
import { config } from '../config';
import { clamp, radians } from '../school/math';

export class Player {
  position = new Vector3();
  previous = new Vector3();
  direction = new Vector3(0, 0, 1);
  goalDirection = new Vector3(0, 0, 1);
  yaw = 0;
  pitch = 0;
  stamina = 1;
  speed = config.school.cruiseSpeed;
  exhausted = false;
  private history: Vector3[] = [];
  private cursor = 0;
  private historySum = new Vector3();

  constructor() { this.reset(); }
  reset(): void {
    this.position.set(0, -config.school.spawnDepth, 0);
    this.previous.copy(this.position);
    this.direction.set(0, 0, 1); this.goalDirection.copy(this.direction);
    this.yaw = 0; this.pitch = 0; this.stamina = 1; this.exhausted = false;
    this.speed = config.school.cruiseSpeed;
    this.history = Array.from({ length: Math.max(1, Math.round(config.informed.memory * config.simulation.hz)) }, () => this.direction.clone());
    this.cursor = 0; this.historySum.set(0, 0, this.history.length);
  }
  step(dt: number, input: { yaw: number; pitch: number; boost: boolean }): void {
    const p = config.player, s = config.school;
    this.previous.copy(this.position);
    // With a +Z swimming axis, screen-right is -X in Three's right-handed space.
    this.yaw -= input.yaw * p.yawSpeed * radians * dt;
    this.pitch = clamp(this.pitch + input.pitch * p.pitchSpeed * radians * dt, -p.maxPitch * radians, p.maxPitch * radians);
    this.direction.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    if (this.stamina >= p.restartStamina) this.exhausted = false;
    const boost = input.boost && !this.exhausted && this.stamina > 0;
    this.stamina = clamp(this.stamina + (boost ? -p.staminaDrain : p.staminaRecovery) * dt, 0, 1);
    if (this.stamina === 0) this.exhausted = true;
    const targetSpeed = boost ? s.maxSpeed : s.cruiseSpeed;
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-p.acceleration * dt));
    this.position.addScaledVector(this.direction, this.speed * dt);
    this.position.y = clamp(this.position.y, config.world.minY, config.world.maxY);
    // Average actual travel directions, including the effect of a depth boundary.
    const sample = this.position.clone().sub(this.previous).normalize();
    this.historySum.sub(this.history[this.cursor]);
    this.history[this.cursor].copy(sample);
    this.historySum.add(sample);
    this.cursor = (this.cursor + 1) % this.history.length;
    if (this.historySum.lengthSq() > 1e-8) this.goalDirection.copy(this.historySum).normalize();
  }
}
