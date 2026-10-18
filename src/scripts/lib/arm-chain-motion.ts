import * as THREE from 'three';
import {setStudyOpacity} from './arm-study-renderer';
import {stationAdvance} from './arm-chain-direction';
export type ChainData={prototypes:{positions:number[][];normals:number[][];indices:number[][]}[];loops:{part:string;motion_group:string;drive:number;teeth:number;advance_sign:number;stations:{prototype:number;matrix:number[]}[]}[]};
/** Original CAD link prototypes circulate between ordered source stations. */
export function createChains(data:ChainData,scene:THREE.Scene){
 const geometries=data.prototypes.map(p=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.positions.flat(),3));g.setAttribute('normal',new THREE.Float32BufferAttribute(p.normals.flat(),3));g.setIndex(p.indices.flat());return g;});
 const material=new THREE.MeshStandardMaterial({color:0x77818c,metalness:.7,roughness:.42,transparent:true,depthWrite:false});
 const loops=data.loops.map(l=>{
  const stations=l.stations.map(s=>{const matrix=new THREE.Matrix4().fromArray(s.matrix),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(p,q,scale);return {p,q,scale,prototype:s.prototype};});
  const batches=[...new Set(stations.map(s=>s.prototype))].map(k=>{const indices=stations.flatMap((s,i)=>s.prototype===k?[i]:[]),m=new THREE.InstancedMesh(geometries[k],material.clone(),indices.length);m.frustumCulled=false;scene.add(m);return {m,indices};});
  return {...l,stations,batches};
 });
 const matrix=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion();
 return {update(angles:number[],get:(key:string)=>{matrix:THREE.Matrix4;opacity:number;background?:boolean}){
  for(const l of loops){const host=get(l.part),n=l.stations.length,shift=stationAdvance(l,angles);
   for(const {m,indices} of l.batches){m.visible=host.opacity>.005;m.layers.set(host.background?1:0);setStudyOpacity(m.material,host.opacity,host.background);
    indices.forEach((index,i)=>{const f=((index+shift)%n+n)%n,a=Math.floor(f),b=(a+1)%n,t=f-a,A=l.stations[a],B=l.stations[b];
     p.lerpVectors(A.p,B.p,t);q.slerpQuaternions(A.q,B.q,t);matrix.compose(p,q,A.scale).premultiply(host.matrix);m.setMatrixAt(i,matrix);
    });m.instanceMatrix.needsUpdate=true;
   }
  }
 },dispose(){for(const l of loops)for(const {m} of l.batches){m.material.dispose();scene.remove(m);}geometries.forEach(g=>g.dispose());material.dispose();}};
}
