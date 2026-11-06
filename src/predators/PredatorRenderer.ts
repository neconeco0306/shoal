import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Line, LineBasicMaterial,
  Mesh, MeshBasicMaterial, Points, PointsMaterial, RingGeometry,
  Vector3,
} from 'three';
import { config } from '../config';
import { animal, animateAnimal } from './Models';
import type { Predators } from './Predators';

export class PredatorRenderer {
  root = new Group();
  private actors = new Group();
  private models: Group[] = [];
  private rings: Mesh[] = [];
  private paths: Line[] = [];
  private forward = new Vector3(0, 0, 1);
  private trailPositions = new Float32Array(config.predators.trailPoints * 3).fill(1e6);
  private trailOrigins = new Float32Array(config.predators.trailPoints * 3);
  private trailBorn = new Float32Array(config.predators.trailPoints).fill(-1e6);
  private trailGeometry = new BufferGeometry();
  private cursor = 0;
  private lastEmit = 0;
  constructor() {
    this.root.add(this.actors);
    this.trailGeometry.setAttribute('position', new Float32BufferAttribute(this.trailPositions, 3));
    const bubbles = new Points(this.trailGeometry, new PointsMaterial({ color: '#cceef0', size: 0.22, transparent: true, opacity: 0.55, depthWrite: false }));
    bubbles.frustumCulled = false; this.root.add(bubbles);
  }
  reset(predators: Predators): void {
    this.actors.traverse(object => {
      if (object instanceof Mesh || object instanceof Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
    this.actors.clear(); this.models = []; this.rings = []; this.paths = [];
    this.trailBorn.fill(-1e6); this.lastEmit = 0; this.cursor = 0;
    for (const p of predators.items) {
      const actor = animal(p.kind); this.models.push(actor); this.actors.add(actor);
      const ring = new Mesh(new RingGeometry(2.5, 2.6, 48), new MeshBasicMaterial({ color: '#ffb37d', transparent: true, opacity: 0.6, side: DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; this.rings.push(ring); this.actors.add(ring);
      const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
      const path = new Line(geometry, new LineBasicMaterial({ color: '#ffc796', transparent: true, opacity: 0.28, depthWrite: false }));
      path.frustumCulled = false; this.paths.push(path); this.actors.add(path);
    }
  }
  update(predators: Predators, alpha: number): void {
    const time = predators.elapsed;
    for (let i = 0; i < predators.items.length; i++) {
      const p = predators.items[i], actor = this.models[i];
      actor.position.copy(p.previous).lerp(p.position, alpha); actor.quaternion.setFromUnitVectors(this.forward, p.direction);
      actor.visible = p.phase !== 'waiting' && !(p.kind === 'bonito' && p.phase === 'recover' && p.phaseTime > 3);
      animateAnimal(actor, time + i * 1.7, p.kind, p.phase === 'attack');
      const warning = p.phase === 'warning';
      this.rings[i].visible = warning; this.paths[i].visible = warning;
      this.rings[i].position.copy(p.target); this.rings[i].scale.setScalar(1 + Math.sin(time * 5) * 0.15);
      const line = this.paths[i].geometry.getAttribute('position');
      line.setXYZ(0, p.position.x, p.position.y, p.position.z); line.setXYZ(1, p.target.x, p.target.y, p.target.z); line.needsUpdate = true;
      if (p.kind === 'bird' && p.danger && time - this.lastEmit >= config.predators.trailInterval) {
        this.lastEmit = time;
        p.position.toArray(this.trailOrigins, this.cursor * 3); this.trailBorn[this.cursor] = time;
        this.cursor = (this.cursor + 1) % config.predators.trailPoints;
      }
    }
    const attribute = this.trailGeometry.getAttribute('position');
    for (let i = 0; i < this.trailBorn.length; i++) {
      const age = time - this.trailBorn[i], k = i * 3;
      if (age < config.predators.trailLife) attribute.setXYZ(i, this.trailOrigins[k] + Math.sin(i) * age * 0.1, this.trailOrigins[k + 1] + age * 1.5, this.trailOrigins[k + 2]);
      else attribute.setXYZ(i, 1e6, 1e6, 1e6);
    }
    attribute.needsUpdate = true;
  }
}
