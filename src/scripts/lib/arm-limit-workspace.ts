import * as THREE from 'three';
import {armMotionMatrices,type MotionContract,type SevenAngles} from './arm-study-motion';
import {study,profileClearance} from './arm-linked-limit';

const smooth=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const unwrap=(angle:number,reference:number)=>reference+THREE.MathUtils.euclideanModulo(angle-reference+180,360)-180;

/** One fixed-other-axes wrist section. The moving skeleton and leading dot use
 * actual source-CAD FK; this is not a second full-robot workspace envelope. */
export function buildLimitWorkspace(motion:MotionContract){
 const shoulder=new THREE.Vector3().fromArray(motion.joints[1].point_m),elbow=new THREE.Vector3().fromArray(motion.joints[2].point_m),wrist=new THREE.Vector3().fromArray(motion.joints[4].point_m);
 const a=elbow.clone().sub(shoulder),b=wrist.clone().sub(elbow),l1=Math.hypot(a.y,a.z),l2=Math.hypot(b.y,b.z),alpha=Math.atan2(a.z,a.y),beta=Math.atan2(b.z,b.y);
 function solve(point:THREE.Vector3,seed:SevenAngles):{q:SevenAngles;clearance:number;wrist:THREE.Vector3;elbow:THREE.Vector3}{
  const y=point.y-shoulder.y,z=point.z-shoulder.z,cosine=THREE.MathUtils.clamp((y*y+z*z-l1*l1-l2*l2)/(2*l1*l2),-1,1);
  const candidates=[-1,1].map(sign=>{
   const bend=sign*Math.acos(cosine),q:SevenAngles=[0,0,unwrap(THREE.MathUtils.radToDeg(Math.atan2(z,y)-alpha-Math.atan2(l2*Math.sin(bend),l1+l2*Math.cos(bend))),seed[2]),unwrap(THREE.MathUtils.radToDeg(bend-beta+alpha),seed[3]),0,0,0];
   const matrices=armMotionMatrices(motion,q),roller=new THREE.Vector3(...study.roller_source.center_m).applyMatrix4(matrices.get('link_3')!).applyMatrix4(matrices.get('uwb')!.clone().invert());
   return {q,clearance:profileClearance(roller.y,roller.z).clearance,wrist:wrist.clone().applyMatrix4(matrices.get('link_4')!),elbow:elbow.clone().applyMatrix4(matrices.get('link_2')!)};
  });
  const valid=candidates.filter(c=>c.clearance>=-.00002);
  return (valid.length?valid:candidates).sort((a,b)=>Math.hypot(a.q[2]-seed[2],a.q[3]-seed[3])-Math.hypot(b.q[2]-seed[2],b.q[3]-seed[3]))[0];
 }
 const ring=study.regions.limited[0].outer.slice(0,-1).map(p=>new THREE.Vector3(wrist.x,p[0],p[1]));
 const first=ring.reduce((best,p,i)=>p.distanceToSquared(wrist)<ring[best].distanceToSquared(wrist)?i:best,0),points:THREE.Vector3[]=[];
 for(let n=0;n<ring.length;n++){const a=ring[(n+first)%ring.length],b=ring[(n+first+1)%ring.length],count=Math.max(1,Math.ceil(a.distanceTo(b)/.008));for(let i=0;i<count;i++)points.push(a.clone().lerp(b,i/count));}
 points.push(points[0].clone());
 let seed:SevenAngles=[0,0,0,0,0,0,0];
 const poses=points.map(point=>{const p=solve(point,seed);seed=p.q;return p;}),lengths=[0];
 for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distanceTo(points[i-1]));
 function sample(progress:number){
  const distance=THREE.MathUtils.clamp(progress,0,1)*lengths.at(-1)!;let i=lengths.findIndex(d=>d>=distance);if(i<=0)i=1;
  const u=(distance-lengths[i-1])/(lengths[i]-lengths[i-1]||1),target=points[i-1].clone().lerp(points[i],u),q=poses[i-1].q.map((a,k)=>THREE.MathUtils.lerp(a,poses[i].q[k],u)) as SevenAngles;
  return {...solve(target,q),index:i,progress};
 }
 return {shoulder,wrist,points,poses,lengths,sample,enter(progress:number){const u=smooth(progress),target=wrist.clone().lerp(points[0],u),q=poses[0].q.map(a=>a*u) as SevenAngles;return solve(target,q);}};
}

export function createLimitWorkspace(scene:THREE.Scene,motion:MotionContract,color:THREE.Color){
 const data=buildLimitWorkspace(motion),group=new THREE.Group();scene.add(group);
 const lineMaterial=new THREE.LineBasicMaterial({color,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false});
 const skeletonMaterial=lineMaterial.clone(),dotMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false});
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((data.points.length+1)*3),3));
 const boundary=new THREE.Line(geometry,lineMaterial);boundary.renderOrder=5;group.add(boundary);
 const skeletonGeometry=new THREE.BufferGeometry().setFromPoints([data.shoulder,data.shoulder,data.shoulder,data.shoulder]);
 const skeleton=new THREE.LineSegments(skeletonGeometry,skeletonMaterial);skeleton.renderOrder=6;group.add(skeleton);
 const dotGeometry=new THREE.SphereGeometry(.008,12,8),dot=new THREE.Mesh(dotGeometry,dotMaterial);dot.renderOrder=7;group.add(dot);
 const write=(g:THREE.BufferGeometry,points:THREE.Vector3[])=>{const a=g.getAttribute('position') as THREE.BufferAttribute;points.forEach((p,i)=>a.setXYZ(i,p.x,p.y,p.z));a.needsUpdate=true;g.setDrawRange(0,points.length);};
 return {data,update(u:number,visible:boolean){
  if(!visible){group.visible=false;return {progress:0,opacity:0,point:data.wrist.toArray(),clearance:0};}
  const opacity=smooth((u-.68)/.09)*(1-smooth((u-.975)/.025)),progress=smooth((u-.77)/.2);group.visible=visible&&opacity>.001;
  const p=u<.77?{...data.enter((u-.7)/.07),index:0}:data.sample(progress);
  if(group.visible){
   lineMaterial.opacity=.9*opacity;skeletonMaterial.opacity=.72*opacity;dotMaterial.opacity=opacity;
   const prefix=u<.77?[]:[...data.points.slice(0,p.index),p.wrist];write(geometry,prefix);
   write(skeletonGeometry,[data.shoulder,p.elbow,p.elbow,p.wrist]);dot.position.copy(p.wrist);
  }
  return {progress,opacity,point:p.wrist.toArray(),clearance:p.clearance};
 },dispose(){scene.remove(group);geometry.dispose();skeletonGeometry.dispose();dotGeometry.dispose();lineMaterial.dispose();skeletonMaterial.dispose();dotMaterial.dispose();}};
}
