import { PerspectiveCamera, Vector3 } from 'three';
import { config } from '../config';
import type { Player } from './Player';
import type { School } from '../school/School';

export class Cameras {
  camera = new PerspectiveCamera(config.camera.fov, innerWidth / innerHeight, config.camera.near, config.camera.far);
  overview = false;
  cinematic = false;
  private orbitTime = 0;
  cycle(): void { if(this.cinematic){this.cinematic=false;this.overview=false;}else if(this.overview){this.overview=false;this.cinematic=true;}else this.overview=true; }
  private look = new Vector3();
  private desired = new Vector3();
  private desiredLook = new Vector3();
  private renderPlayer = new Vector3();

  update(dt: number, player: Player, school: School, alpha: number, snap = false): void {
    const c = config.camera;
    this.renderPlayer.copy(player.previous).lerp(player.position, alpha);
    this.orbitTime += dt;
    if (this.cinematic) {
      this.desiredLook.copy(school.centroid);
      const a=this.orbitTime*.065;this.desired.set(school.centroid.x+Math.sin(a)*38,Math.min(-3,school.centroid.y+12+Math.sin(a*.7)*6),school.centroid.z+Math.cos(a)*38);
    } else if (this.overview) {
      this.desiredLook.set(school.centroid.x, school.centroid.y, school.centroid.z);
      this.desired.copy(this.desiredLook).add(new Vector3(0, c.overviewHeight, -c.overviewBack));
    } else {
      this.desired.copy(this.renderPlayer).addScaledVector(player.direction, -c.followDistance);
      this.desired.y += c.followHeight;
      this.desiredLook.copy(this.renderPlayer).addScaledVector(player.direction, c.lookAhead);
    }
    // Overview is a cutaway: omit the surface so the whole shoal remains visible.
    if (this.overview) this.camera.layers.disable(1);
    else {
      this.camera.layers.enable(1);
      this.desired.y = Math.min(this.desired.y, config.world.surfaceY - 0.7);
    }
    const amount = snap ? 1 : 1 - Math.exp(-c.smoothness * dt);
    this.camera.position.lerp(this.desired, amount);
    this.look.lerp(this.desiredLook, amount);
    this.camera.lookAt(this.look);
  }
  resize(): void { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
}
