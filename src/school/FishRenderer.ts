import {
  BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute,
  InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D, Vector3,
} from 'three';
import { config } from '../config';
import type { Player } from '../player/Player';
import type { School } from './School';

/** A one-body-length spindle, a forked tail, fins and dark eyes; nose faces +Z. */
export function fishGeometry(): BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const back = new Color('#144354'), belly = new Color('#e1eeee');
  const { fishRings: rings, fishSides: sides, fishWidth, fishHeight } = config.render;
  const add = (x: number, y: number, z: number, color: Color): number => {
    positions.push(x, y, z); colors.push(color.r, color.g, color.b); return positions.length / 3 - 1;
  };
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, z = -0.34 + t * 0.84;
    const radius = Math.pow(Math.sin(Math.PI * t), 0.8) * (0.76 + t * 0.24) + 0.015;
    for (let k = 0; k <= sides; k++) {
      const angle = k / sides * Math.PI * 2, y = Math.sin(angle);
      const color = belly.clone().lerp(back, Math.max(0, y) * 0.92);
      add(Math.cos(angle) * radius * fishWidth, y * radius * fishHeight, z, color);
      if (j < rings && k < sides) {
        const a = j * (sides + 1) + k, b = a + sides + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const triangle = (points: number[][], color: Color): void => {
    const ids = points.map(([x, y, z]) => add(x, y, z, color)); indices.push(...ids);
  };
  const fin = new Color('#6b9fa8');
  triangle([[0, 0, -0.29], [0, 0.23, -0.5], [0, 0.025, -0.43]], fin);
  triangle([[0, 0, -0.29], [0, -0.025, -0.43], [0, -0.23, -0.5]], fin);
  triangle([[0, 0.12, 0.17], [0, 0.26, -0.04], [0, 0.1, -0.17]], fin);
  for (const side of [-1, 1]) {
    triangle([[side * 0.08, -0.02, 0.2], [side * 0.28, -0.08, -0.07], [side * 0.07, -0.06, 0]], fin);
    const eye = new Color('#031b27');
    const x = side * 0.069;
    triangle([[x, 0.067, 0.34], [x + side * 0.009, 0.027, 0.36], [x, 0.025, 0.31]], eye);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export class FishRenderer {
  mesh: InstancedMesh;
  private phases: InstancedBufferAttribute;
  private swims: InstancedBufferAttribute;
  private object = new Object3D();
  private forward = new Vector3(0, 0, 1);
  private direction = new Vector3();
  private silver = new Color(config.render.fishColor);
  private blue = new Color('#9bd9ff');
  private red = new Color('#f6aaa0');
  private gold = new Color(config.render.informedColor);
  private playerColor = new Color(config.render.playerColor);
  private currentGold: Float32Array;
  private color = new Color();

  constructor(capacity: number) {
    const geometry = fishGeometry();
    this.phases = new InstancedBufferAttribute(new Float32Array(capacity + 1), 1).setUsage(DynamicDrawUsage);
    this.swims = new InstancedBufferAttribute(new Float32Array(capacity + 1).fill(1), 1).setUsage(DynamicDrawUsage);
    geometry.setAttribute('aPhase', this.phases); geometry.setAttribute('aSwim', this.swims);
    this.currentGold = new Float32Array(capacity + 1);
    for (let i = 0; i <= capacity; i++) this.phases.setX(i, (i * 2.39996) % (Math.PI * 2));
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: config.render.roughness, metalness: config.render.metalness, side: DoubleSide });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTail = { value: config.render.tailAmplitude };
      shader.uniforms.uNearFade = { value: [config.render.nearFadeStart, config.render.nearFadeEnd] };
      shader.vertexShader = 'attribute float aPhase; attribute float aSwim; uniform float uTail;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float tail = 1.0 - smoothstep(-0.5, 0.3, position.z);
        transformed.x += sin(aPhase + position.z * 7.0) * tail * uTail * aSwim;
      `);
      // Screen-door fade prevents fish next to the camera from filling the view.
      shader.fragmentShader = 'uniform vec2 uNearFade;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
        #include <clipping_planes_fragment>
        float nearVisibility = smoothstep(uNearFade.x, uNearFade.y, length(vViewPosition));
        float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
        if (dither > nearVisibility) discard;
      `);
    };
    this.mesh = new InstancedMesh(geometry, material, capacity + 1);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i <= capacity; i++) this.mesh.setColorAt(i, this.silver);
    this.mesh.instanceColor!.setUsage(DynamicDrawUsage);
  }
  reset(): void { this.currentGold.fill(0); }
  update(dt: number, alpha: number, school: School, player: Player): void {
    const r = config.render;
    this.mesh.count = school.count + 1;
    for (let i = 0; i <= school.count; i++) {
      const isPlayer = i === school.count, k = i * 3;
      if (isPlayer) {
        this.object.position.copy(player.previous).lerp(player.position, alpha);
        this.direction.copy(player.direction);
      } else {
        this.object.position.set(
          school.previous[k] + (school.positions[k] - school.previous[k]) * alpha,
          school.previous[k + 1] + (school.positions[k + 1] - school.previous[k + 1]) * alpha,
          school.previous[k + 2] + (school.positions[k + 2] - school.previous[k + 2]) * alpha,
        );
        this.direction.set(school.directions[k], school.directions[k + 1], school.directions[k + 2]);
      }
      this.object.quaternion.setFromUnitVectors(this.forward, this.direction);
      this.object.scale.setScalar(isPlayer || school.alive[i] || school.trapped[i] ? r.fishLength : 0);
      this.object.updateMatrix(); this.mesh.setMatrixAt(i, this.object.matrix);
      this.currentGold[i] += ((isPlayer ? 1 : school.informed[i]) - this.currentGold[i]) * Math.min(1, dt * 3);
      this.color.copy(this.silver).lerp(isPlayer ? this.playerColor : school.rival ? (school.allegiance[i]===2?this.red:this.blue) : this.gold, this.currentGold[i]);
      this.mesh.setColorAt(i, this.color);
      const speed = isPlayer ? player.speed : school.speeds[i];
      this.phases.setX(i, (this.phases.getX(i) + dt * (r.swimFrequency + speed * r.swimSpeedFactor)) % (Math.PI * 2));
      this.swims.setX(i, 0.8 + speed / config.school.maxSpeed * 0.4);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true;
    this.phases.needsUpdate = true; this.swims.needsUpdate = true;
  }
}
