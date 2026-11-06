import {
  AdditiveBlending, BufferGeometry, Color, DirectionalLight, DoubleSide, Float32BufferAttribute,
  FogExp2, Group, HemisphereLight, Mesh, PlaneGeometry, Points, Scene, ShaderMaterial, Vector3,
} from 'three';
import type { Biome } from '../missions/Campaign';
import type { School } from '../school/School';
import { config } from '../config';
import { randomGenerator } from '../school/math';

export class Ocean {
  scene = new Scene();
  private surface: Mesh;
  private particles: Points;
  private beams = new Group();
  private glow: Points;
  private glowPositions = new Float32Array(600*3);
  private biome: Biome = 'current';
  private flow = {value:0};
  private time = { value: 0 };
  constructor() {
    const w = config.world;
    this.scene.background = new Color(w.background);
    this.scene.fog = new FogExp2(w.fog, w.fogDensity);
    this.scene.add(new HemisphereLight('#9de9ea', '#03202e', w.ambientLight));
    const sun = new DirectionalLight('#e6f9ee', w.sunLight); sun.position.set(-20, 60, 15); this.scene.add(sun);
    const water = new ShaderMaterial({
      uniforms: { uTime: this.time, uWave: { value: w.surfaceWave } }, side: DoubleSide,
      vertexShader: `uniform float uTime; uniform float uWave; varying vec2 vUv; varying float vDepth;
        void main(){ vUv=uv; vec3 p=position; p.z+=sin(p.x*.09+uTime*.45)*cos(p.y*.08+uTime*.31)*uWave;
          vec4 mv=modelViewMatrix*vec4(p,1.); vDepth=length(mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vDepth;
        void main(){ vec2 p=vUv*130.;
          float caustic=pow(abs(sin(p.x+sin(p.y*.75+uTime*.3))*cos(p.y+sin(p.x*.7-uTime*.2))),8.);
          vec3 color=mix(vec3(.035,.26,.32),vec3(.28,.64,.64),caustic*.65+.2);
          float glow=exp(-length(vUv-vec2(.43,.52))*15.); color+=glow*vec3(.13,.28,.25);
          color=mix(color,vec3(.016,.17,.24),smoothstep(60.,230.,vDepth)); gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.surface = new Mesh(new PlaneGeometry(w.waterSize, w.waterSize, w.surfaceSegments, w.surfaceSegments), water);
    this.surface.rotation.x = -Math.PI / 2; this.surface.position.y = w.surfaceY;
    this.surface.layers.set(1);
    this.scene.add(this.surface);
    const random = randomGenerator(91), positions = new Float32Array(w.particles * 3);
    for (let i = 0; i < positions.length; i++) positions[i] = (random() - 0.5) * w.particleRadius * 2;
    const particleGeometry = new BufferGeometry(); particleGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.particles = new Points(particleGeometry, new ShaderMaterial({
      uniforms: { uTime: this.time, uFlow: this.flow, uSize: { value: w.particleSize } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
      vertexShader: `uniform float uTime; uniform float uFlow; uniform float uSize; varying float vFade;
        void main(){ vec3 p=position; p.z=mod(p.z+uTime*uFlow+75.,150.)-75.;p.x+=sin(uTime*.1+p.y)*.3; vec4 mv=modelViewMatrix*vec4(p,1.);
          vFade=1.-smoothstep(25.,75.,length(mv.xyz)); gl_PointSize=clamp(uSize*500./max(1.,-mv.z),1.,3.);
          gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vFade; void main(){ float a=1.-smoothstep(.1,.5,length(gl_PointCoord-.5)); gl_FragColor=vec4(.45,.82,.84,a*vFade*.35); }`,
    }));
    this.scene.add(this.particles);
    const beamMaterial = new ShaderMaterial({
      uniforms: { uOpacity: { value: w.beamOpacity } }, transparent: true, depthWrite: false,
      side: DoubleSide, blending: AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uOpacity; varying vec2 vUv; void main(){ float a=pow(sin(vUv.x*3.14159),3.)*sin(vUv.y*3.14159); gl_FragColor=vec4(.26,.68,.70,a*uOpacity); }`,
    });
    for (let i = 0; i < w.beamCount; i++) {
      const beam = new Mesh(new PlaneGeometry(3 + random() * 5, w.beamLength), beamMaterial);
      beam.position.set((random() - 0.5) * w.beamRadius * 2, -w.beamLength / 2, (random() - 0.5) * w.beamRadius * 2);
      beam.rotation.set(0, random() * Math.PI, -0.18); this.beams.add(beam);
    }
    this.scene.add(this.beams);
    const glowGeo=new BufferGeometry();glowGeo.setAttribute('position',new Float32BufferAttribute(this.glowPositions,3));
    this.glow=new Points(glowGeo,new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,uniforms:{time:this.time},vertexShader:`uniform float time;varying float strength;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);strength=.5+.5*sin(time*3.+position.x*4.);gl_PointSize=clamp(85./max(1.,-mv.z),1.,9.);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying float strength;void main(){float a=pow(1.-smoothstep(0.,.5,length(gl_PointCoord-.5)),2.);gl_FragColor=vec4(.1,.85,1.,a*(.3+.7*strength));}`}));this.glow.frustumCulled=false;this.scene.add(this.glow);
  }
  setBiome(biome: Biome):void {
    this.biome=biome;const colors={reef:['#146d76','#3b9591',.009],current:['#031e37','#064253',.014],night:['#010610','#031427',.028]}[biome];
    this.scene.background=new Color(colors[0] as string);this.scene.fog=new FogExp2(colors[1] as string,colors[2] as number);
    this.beams.visible=biome!=='night';this.surface.visible=biome!=='night';this.glow.visible=biome==='night';
    this.scene.traverse(o=>{if(o instanceof HemisphereLight)o.intensity=biome==='night'?.5:biome==='reef'?3:2.3;if(o instanceof DirectionalLight)o.intensity=biome==='night'?.3:biome==='reef'?4:3.3;});
  }
  update(elapsed: number, playerPosition: Vector3, school?: School, flow=0): void {
    this.flow.value=flow;
    if(this.biome==='night'&&school){const attr=this.glow.geometry.getAttribute('position');for(let i=0;i<600;i++){const j=Math.floor(i*school.count/600),k=j*3;if(school.alive[j])attr.setXYZ(i,school.positions[k]+Math.sin(i*7+elapsed)*.4,school.positions[k+1],school.positions[k+2]-Math.cos(i)*.5);else attr.setXYZ(i,1e6,1e6,1e6);}attr.needsUpdate=true;}
    this.time.value = elapsed;
    this.surface.position.x = playerPosition.x; this.surface.position.z = playerPosition.z;
    this.beams.position.set(playerPosition.x * 0.8, 0, playerPosition.z * 0.8);
    this.particles.position.copy(playerPosition);
  }
}
