import { BufferGeometry, Color, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { Biome } from '../missions/Campaign';
import type { School } from '../school/School';
import type { Player } from '../player/Player';
import { randomGenerator } from '../school/math';
function coralGeometry():BufferGeometry {
  const vertices:number[]=[],indices:number[]=[];const up=new Vector3(0,1,0),q=new Quaternion(),v=new Vector3();
  const branch=(a:Vector3,b:Vector3,r:number):void=>{const direction=b.clone().sub(a),length=direction.length();q.setFromUnitVectors(up,direction.normalize());const base=vertices.length/3;for(let ring=0;ring<4;ring++)for(let side=0;side<=8;side++){const angle=side/8*Math.PI*2,t=ring/3,radius=r*(1-t*.92);v.set(Math.cos(angle)*radius,length*t,Math.sin(angle)*radius).applyQuaternion(q).add(a);vertices.push(v.x,v.y,v.z);if(ring<3&&side<8){const k=base+ring*9+side;indices.push(k,k+1,k+9,k+1,k+10,k+9);}}};
  branch(new Vector3(),new Vector3(0,1.8,0),.16);
  for(let i=0;i<7;i++){const angle=i*2.4,base=new Vector3(0,.4+i*.15,0),tip=new Vector3(Math.cos(angle)*(.6+i*.04),1.2+i*.16,Math.sin(angle)*(.6+i*.04));branch(base,tip,.1);for(let j=0;j<2;j++){const fork=base.clone().lerp(tip,.55+j*.18),end=tip.clone().add(new Vector3(Math.cos(angle+j*2)*.35,.4,Math.sin(angle+j*2)*.35));branch(fork,end,.055);}}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export interface Rock { x: number; y: number; z: number; radius: number; }
export interface Net { min: Vector3; max: Vector3; }
/** Segment against a box also catches fast fish crossing a thin net in a single step. */
export function crossesNet(a: {x:number;y:number;z:number}, b: {x:number;y:number;z:number}, n: Net): boolean {
  let lo=0,hi=1;
  for(const axis of ['x','y','z'] as const){const v=b[axis]-a[axis];if(Math.abs(v)<1e-9){if(a[axis]<n.min[axis]||a[axis]>n.max[axis])return false;}else{let t0=(n.min[axis]-a[axis])/v,t1=(n.max[axis]-a[axis])/v;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return false;}}
  return true;
}
export class Habitat {
  root = new Group(); rocks: Rock[]=[]; nets: Net[]=[]; biome: Biome='reef'; current=new Vector3(); captured=0;
  private clock={value:0};private a=new Vector3();private b=new Vector3();private matrix=new Matrix4();
  reset(biome: Biome, mission: number, origin=new Vector3()): void {
    this.root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});this.root.clear();this.rocks=[];this.nets=[];this.captured=0;this.biome=biome;
    this.current.set(0,0,biome==='current'?(mission===6?-2.2:2.4):0);
    const rockMaterial=new MeshStandardMaterial({color:biome==='reef'?'#8eaaa0':'#294855',roughness:.92});
    const addRock=(x:number,y:number,z:number,radius:number):void=>{const rock={x:x+origin.x,y:y+origin.y,z:z+origin.z,radius};this.rocks.push(rock);const mesh=new Mesh(new IcosahedronGeometry(radius,2),rockMaterial);const pos=mesh.geometry.getAttribute('position');for(let i=0;i<pos.count;i++){const a=pos.getX(i),b=pos.getY(i),c=pos.getZ(i),s=1+.075*Math.sin(a*2+b)*Math.cos(c*1.5);pos.setXYZ(i,a*s,b*s,c*s);}mesh.geometry.computeVertexNormals();mesh.position.set(rock.x,rock.y,rock.z);this.root.add(mesh);};
    if(mission===2)addRock(0,-25,65,11);
    if(mission===6)addRock(0,-25,91,12);
    if(biome==='reef'){
      for(const [x,z,r] of [[-45,20,8],[48,65,10],[-65,110,13],[60,170,9],[-40,230,12]])addRock(x,-38,z,r);
      const floor=new Mesh(new PlaneGeometry(1400,1400,40,40),new ShaderMaterial({uniforms:{time:this.clock},vertexShader:`varying vec3 p;varying float depth; void main(){p=position; vec3 q=position;q.z+=sin(q.x*.04)*cos(q.y*.035)*1.6;vec4 mv=modelViewMatrix*vec4(q,1.);depth=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float time;varying vec3 p;varying float depth;void main(){vec2 uv=p.xy*.32;float a=abs(sin(uv.x+sin(uv.y+time*.32))*cos(uv.y+sin(uv.x-time*.25)));float c=pow(a,14.);float r=.5+.5*sin(p.x*.8+sin(p.y*.4));vec3 color=vec3(.16,.31,.27)+c*vec3(.15,.22,.13)+r*.015;color=mix(color,vec3(.007,.153,.181),1.-exp(-depth*depth*.00008));gl_FragColor=vec4(color,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));floor.rotation.x=-Math.PI/2;floor.position.set(origin.x,-42,origin.z+180);this.root.add(floor);
      const random=randomGenerator(188),coral=new InstancedMesh(coralGeometry(),new MeshStandardMaterial({roughness:.8}),180);
      const q=new Quaternion(),up=new Vector3(0,1,0),direction=new Vector3(),scale=new Vector3(),color=new Color();
      for(let i=0;i<180;i++){const cluster=Math.floor(i/3),seed=cluster*2.399;const radius=35+(cluster%8)*8;const x=Math.cos(seed)*radius,z=25+Math.sin(seed)*radius+(cluster%4)*70;direction.set((random()-.5)*.8,1,(random()-.5)*.8).normalize();q.setFromUnitVectors(up,direction);scale.set(1+random(),1+random()*1.5,1+random());this.matrix.compose(new Vector3(x+origin.x+(random()-.5)*5,-41,z+origin.z+(random()-.5)*5),q,scale);coral.setMatrixAt(i,this.matrix);color.set(['#d18c78','#bba8d7','#dfb98c','#599e9d'][cluster%4]);coral.setColorAt(i,color);}this.root.add(coral);
    }
    if(mission===4){const n={min:new Vector3(-30,-40,65).add(origin),max:new Vector3(9,-3,72).add(origin)};this.nets.push(n);const vertices:number[]=[];for(let x=n.min.x;x<=n.max.x;x+=2)vertices.push(x,n.min.y,n.min.z,x,n.max.y,n.min.z);for(let y=n.min.y;y<=n.max.y;y+=2)vertices.push(n.min.x,y,n.min.z,n.max.x,y,n.min.z);for(let z=n.min.z;z<=n.max.z;z+=2)for(const x of [n.min.x,n.max.x])vertices.push(x,n.min.y,z,x,n.max.y,z);const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));this.root.add(new LineSegments(g,new LineBasicMaterial({color:'#c8b59b',transparent:true,opacity:.65})));for(let x=n.min.x;x<=n.max.x;x+=6){const f=new Mesh(new SphereGeometry(.65,12,8),new MeshStandardMaterial({color:'#f5966e',emissive:'#8b2515',emissiveIntensity:.7}));f.position.set(x,-2,n.min.z);this.root.add(f);}}
    if(!this.rocks.length)rockMaterial.dispose();
  }
  /** Fish anticipate rock surfaces; steering is an environmental force, never a goal command. */
  steer(x:number,y:number,z:number,out:Float32Array): void {out.fill(0);for(const r of this.rocks){const dx=x-r.x,dy=y-r.y,dz=z-r.z,d=Math.hypot(dx,dy,dz);if(d<r.radius+5&&d>.001){const strength=(r.radius+5-d)/5*2;out[0]+=dx/d*strength;out[1]+=dy/d*strength;out[2]+=dz/d*strength;}}if(this.biome==='reef'&&y<-33)out[1]+=(-33-y)*.5;}
  currentAt(x:number,y:number,z:number): number {if(!this.current.z)return 0;for(const r of this.rocks){const downstream=(z-r.z)*Math.sign(this.current.z);if(downstream>0&&downstream<r.radius*3&&Math.abs(x-r.x)<r.radius&&Math.abs(y-r.y)<r.radius)return this.current.z*.08;}return this.current.z;}
  private move(p:Vector3,dt:number): void {p.z+=this.currentAt(p.x,p.y,p.z)*dt;for(const r of this.rocks){this.a.set(p.x-r.x,p.y-r.y,p.z-r.z);const d=this.a.length();if(d<r.radius+1){if(d<.001)this.a.set(1,0,0);else this.a.multiplyScalar(1/d);p.set(r.x,r.y,r.z).addScaledVector(this.a,r.radius+1);}}if(this.biome==='reef')p.y=Math.max(-39,p.y);}
  step(dt:number,school:School,player:Player,rival?:Player): boolean {
    if(rival)this.move(rival.position,dt);
    this.move(player.position,dt);let caught=false;for(const n of this.nets)if(crossesNet(player.previous,player.position,n)){caught=true;player.position.clamp(n.min,n.max);player.previous.copy(player.position);}
    for(let i=0;i<school.count;i++){if(!school.alive[i])continue;const k=i*3;this.b.fromArray(school.positions,k);this.move(this.b,dt);this.b.toArray(school.positions,k);for(const n of this.nets){this.a.fromArray(school.previous,k);if(crossesNet(this.a,this.b,n)){school.alive[i]=0;school.informed[i]=0;school.trapped[i]=1;this.b.clamp(n.min,n.max).toArray(school.positions,k);this.b.toArray(school.previous,k);this.captured++;break;}}}school.measure();return caught;
  }
  update(time:number):void {this.clock.value=time;}
}
