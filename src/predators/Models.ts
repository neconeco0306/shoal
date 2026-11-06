import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { PredatorKind } from './Predators';
/** Elliptical cross sections form a continuous, smooth animal silhouette along +Z. */
function body(sections:number[][], top:string, belly:string, sides=32):BufferGeometry {
  const p:number[]=[],colors:number[]=[],indices:number[]=[],a=new Color(top),b=new Color(belly);
  for(let i=0;i<sections.length;i++){const [z,w,h,cy]=sections[i];for(let j=0;j<=sides;j++){const angle=j/sides*Math.PI*2,y=Math.sin(angle);p.push(Math.cos(angle)*w,y*h+cy,z);const color=a.clone().lerp(b,Math.pow(Math.max(0,-y),.55)*.94);colors.push(color.r,color.g,color.b);if(i<sections.length-1&&j<sides){const k=i*(sides+1)+j;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
/** Rounded, swept hydrofoil. Each span station has an elliptical, tapered thickness. */
function fin(points:number[][], vertical=false):BufferGeometry {
  const p:number[]=[],indices:number[]=[],sides=12;
  for(let i=0;i<points.length;i++){const [span,z,chord,thick]=points[i];for(let j=0;j<=sides;j++){const t=j/sides*Math.PI*2;const x=span,y=Math.sin(t)*thick,zz=z+Math.cos(t)*chord;p.push(vertical?y:x,vertical?x:y,zz);if(i<points.length-1&&j<sides){const k=i*(sides+1)+j;indices.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}}const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function animal(kind:PredatorKind):Group {
  const root=new Group();const material=new MeshStandardMaterial({vertexColors:true,roughness:.36,metalness:.1,side:DoubleSide});const finMaterial=new MeshStandardMaterial({color:kind==='bird'?'#34444e':'#648491',roughness:.4,side:DoubleSide});
  const mesh=(g:BufferGeometry,m=finMaterial):Mesh=>{const o=new Mesh(g,m);root.add(o);return o;};
  const eye=(x:number,y:number,z:number,size:number):void=>{for(const side of [-1,1]){const o=mesh(new SphereGeometry(size,14,10),new MeshStandardMaterial({color:'#081c24',roughness:.12}));o.position.set(x*side,y,z);o.scale.set(.45,1,1);const glint=mesh(new SphereGeometry(size*.23,8,6),new MeshStandardMaterial({color:'#f4ffff',emissive:'#c8eef0',emissiveIntensity:.4}));glint.position.set((x+size*.35)*side,y+size*.25,z+size*.35);}};
  if(kind==='dolphin'){
    mesh(body([[-3.15,.09,.1,0],[-2.8,.17,.19,-.02],[-2.3,.28,.31,-.02],[-1.7,.43,.48,0],[-1,.6,.63,.01],[-.2,.72,.75,.04],[.55,.72,.73,.05],[1.1,.65,.64,.04],[1.6,.53,.5,0],[1.95,.36,.35,-.08],[2.1,.24,.22,-.17],[2.35,.2,.15,-.22],[2.8,.14,.11,-.23],[3.05,.02,.02,-.23]],'#426877','#c6d9da'),material);
    const dorsal=mesh(fin([[.45,-.65,.7,.1],[.8,-.65,.5,.08],[1.15,-.8,.28,.045],[1.5,-1.12,.02,.005]],true));dorsal.position.z=.15;
    for(const s of [-1,1]){const f=mesh(fin([[.45,.7,.46,.07],[.8,.35,.38,.055],[1.25,-.15,.25,.03],[1.6,-.55,.015,.005]]));f.scale.x=s;f.rotation.z=-s*.28;f.position.y=-.38;}
    const tail=new Group();tail.name='tail';tail.position.z=-2.75;root.add(tail);
    for(const s of [-1,1]){const fluke=new Mesh(fin([[0,-.25,.22,.08],[.35,-.33,.38,.065],[.8,-.53,.33,.04],[1.25,-.86,.03,.006]]),finMaterial);fluke.scale.x=s;tail.add(fluke);}
    eye(.46,.08,1.72,.075);
    const mouth=mesh(body([[2.02,.24,.013,-.26],[2.5,.18,.01,-.27],[2.95,.06,.005,-.27]],'#28464e','#28464e',12),material);mouth.name='mouth';
  }else if(kind==='bonito'){
    mesh(body([[-2.3,.05,.12,0],[-1.8,.13,.25,0],[-1.25,.32,.55,0],[-.5,.48,.78,0],[.2,.5,.82,0],[.8,.39,.65,0],[1.35,.2,.36,0],[1.7,.01,.025,0]],'#183d59','#c1d3d3'),material);
    mesh(fin([[.45,-.2,.65,.08],[1.1,-.65,.05,.01]],true));
    const tail=new Group();tail.name='tail';tail.position.z=-2;root.add(tail);
    for(const s of [-1,1]){const f=new Mesh(fin([[0,-.2,.15,.08],[.55,-.5,.22,.04],[1.05,-.9,.015,.005]],true),finMaterial);f.scale.y=s;tail.add(f);const pec=mesh(fin([[.3,.4,.3,.04],[.8,-.2,.02,.005]]));pec.scale.x=s;pec.position.y=-.1;}
    for(let i=0;i<5;i++)for(const s of [-1,1]){const f=mesh(fin([[0,0,.12,.025],[.15,0,.02,.002]],true));f.position.set(0,s*(.4-i*.055),-1-i*.18);f.scale.y=s;}
    eye(.245,.15,1.2,.075);
  }else{
    mesh(body([[-1.1,.025,.04,0],[-.65,.2,.21,0],[0,.34,.35,0],[.5,.24,.28,.06],[.85,.18,.2,.18],[1.05,.1,.11,.17],[1.55,.006,.015,.13]],'#dce5dd','#f9f4e5',24),material);
    const wings=new Group();wings.name='wings';root.add(wings);for(const s of [-1,1]){const f=new Mesh(fin([[.15,.05,.45,.1],[.65,-.03,.5,.07],[1.25,-.27,.4,.04],[1.9,-.5,.25,.02],[2.55,-.85,.01,.002]]),finMaterial);f.scale.x=s;wings.add(f);}
    eye(.16,.23,.85,.042);
  }
  // A traveling bend animates the peduncle as well as the fluke, so the tail is attached naturally.
  root.traverse(o=>{if(!(o instanceof Mesh))return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!(m instanceof MeshStandardMaterial)||m.userData.swim)continue;m.userData.swim=true;const time={value:0};m.userData.time=time;m.onBeforeCompile=shader=>{shader.uniforms.swimTime=time;shader.vertexShader='uniform float swimTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nfloat tailWeight=pow(clamp(-position.z/3.1,0.,1.),2.); transformed.${kind==='dolphin'?'y':'x'}+=sin(swimTime*${kind==='dolphin'?'4.5':'10.'}+position.z*1.1)*tailWeight*.28;`);};m.customProgramCacheKey=()=>`shoal-animal-${kind}`;}});
  return root;
}
export function animateAnimal(root:Group,time:number,kind:PredatorKind,attack:boolean):void {
  root.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.time)m.userData.time.value=time;});
  const tail=root.getObjectByName('tail');if(tail){if(kind==='dolphin'){tail.rotation.x=Math.sin(time*4.5-2.8)*.3;tail.position.y=Math.sin(time*4.5-2.75*1.1)*Math.pow(2.75/3.1,2)*.28;}else tail.rotation.y=Math.sin(time*10-2)*.35;}
  const wings=root.getObjectByName('wings');if(wings){wings.scale.x=attack?.18:1;wings.rotation.z=Math.sin(time*7)*.08;wings.scale.y=1+Math.sin(time*7)*.3;}
}
