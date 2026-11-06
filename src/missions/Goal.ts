import { AdditiveBlending, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { config } from '../config';

export class Goal {
  position = new Vector3(config.goal.x, config.goal.y, config.goal.z);
  object = new Group();
  arrived = false;
  elapsed = 0;
  distance = 80;
  private ring: Mesh;
  constructor() {
    const material = new MeshStandardMaterial({ color: '#e5f7c5', emissive: new Color('#c4e9a4'), emissiveIntensity: 2, roughness: 0.2 });
    const buoy = new Mesh(new SphereGeometry(config.goal.buoySize, 16, 12), material);
    this.object.add(buoy);
    this.ring = new Mesh(new TorusGeometry(2, 0.025, 8, 64), new MeshBasicMaterial({ color: '#d5f9b9', transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false }));
    this.ring.rotation.x = Math.PI / 2; this.object.add(this.ring);
    this.object.position.copy(this.position);
  }
  setColor(color:string):void {this.object.traverse(o=>{if(o instanceof Mesh&&(o.material instanceof MeshStandardMaterial||o.material instanceof MeshBasicMaterial)){o.material.color.set(color);if(o.material instanceof MeshStandardMaterial)o.material.emissive.set(color);}});}
  reset(): void { this.arrived = false; this.elapsed = 0; this.distance = 80; }
  step(dt: number, centroid: { x: number; y: number; z: number }): void {
    this.distance = Math.hypot(centroid.x - this.position.x, centroid.y - this.position.y, centroid.z - this.position.z);
    if (!this.arrived) { this.elapsed += dt; if (this.distance <= config.goal.radius) this.arrived = true; }
  }
  update(time: number): void {
    this.object.position.x = this.position.x; this.object.position.z = this.position.z;
    this.object.position.y = this.position.y + Math.sin(time * 1.3) * 0.35;
    this.ring.scale.setScalar(1 + Math.sin(time * 1.8) * 0.12);
  }
}
