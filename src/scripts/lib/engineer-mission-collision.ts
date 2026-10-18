import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH,acceleratedRaycast,CENTER} from 'three-mesh-bvh';
import {armMotionMatrices,type MotionContract,type SevenAngles} from './arm-study-motion';
import {contextTransform} from './arm-context-stage';
import {STORES,STORED_ORE_ROTATIONS,toolPose,type MissionState} from './engineer-mission-motion';

type SourcePart={node:THREE.Object3D;rest:THREE.Matrix4;spec?:{motion_group:string};group?:string};
type Actor={key:string;group:string;kind:'arm'|'context';mesh:THREE.Mesh;previous:THREE.Matrix4;contact:boolean};
const basic=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});

/** Collision copies of the rendered CAD surfaces, retaining their actual triangles. */
export function createMissionCollision(contract:MotionContract,parts:SourcePart[],context:SourcePart[],field:THREE.Group,oreModel?:THREE.Object3D){
 const buckets=new Map<string,{geometries:THREE.BufferGeometry[];group:string;kind:'arm'|'context'}>();
 function collect(p:SourcePart,kind:'arm'|'context'){
  const group=kind==='arm'?p.spec!.motion_group:p.group!,key=kind+':'+group;
  const bucket=buckets.get(key)??{geometries:[],group,kind};buckets.set(key,bucket);
  p.node.updateMatrixWorld(true);const inverse=p.node.matrixWorld.clone().invert();
  p.node.traverse(o=>{if(!(o as THREE.Mesh).isMesh)return;const mesh=o as THREE.Mesh,g=mesh.geometry.clone();
   const relative=inverse.clone().multiply(mesh.matrixWorld);g.applyMatrix4(p.rest.clone().multiply(relative));
   for(const name of Object.keys(g.attributes))if(name!=='position')g.deleteAttribute(name);
   if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));g.clearGroups();bucket.geometries.push(g);
  });
 }
 parts.forEach(p=>collect(p,'arm'));context.forEach(p=>collect(p,'context'));
 const actors:Actor[]=[];
 for(const [key,b] of buckets){const geometry=mergeGeometries(b.geometries)!;b.geometries.forEach(g=>g.dispose());
  (geometry as any).boundsTree=new MeshBVH(geometry,{strategy:CENTER,targetLeafSize:12});
  const mesh=new THREE.Mesh(geometry,basic);mesh.matrixAutoUpdate=false;mesh.raycast=acceleratedRaycast;
  actors.push({key,group:b.group,kind:b.kind,mesh,previous:new THREE.Matrix4(),contact:/_(foot|gear|carriage)$/.test(b.group)});
 }
 const fieldMeshes=field.children.filter(o=>(o as THREE.Mesh).isMesh) as THREE.Mesh[];
 for(const mesh of fieldMeshes){(mesh.geometry as any).boundsTree??=new MeshBVH(mesh.geometry,{strategy:CENTER});mesh.raycast=acceleratedRaycast;mesh.updateMatrixWorld(true);}
 let cubeGeometry:THREE.BufferGeometry;
 if(oreModel){const geometries:THREE.BufferGeometry[]=[];oreModel.updateMatrixWorld(true);oreModel.traverse(o=>{if(!(o as THREE.Mesh).isMesh)return;const mesh=o as THREE.Mesh,g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);for(const a of Object.keys(g.attributes))if(a!=='position')g.deleteAttribute(a);if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));g.clearGroups();geometries.push(g);});cubeGeometry=mergeGeometries(geometries)!;}else cubeGeometry=new THREE.BoxGeometry(.2004,.2004,.2004);
 (cubeGeometry as any).boundsTree=new MeshBVH(cubeGeometry);
 let previousTime=-1,sampleStep=0;
 function update(s:MissionState,q:SevenAngles){const matrices=armMotionMatrices(contract,q);sampleStep=s.time>previousTime&&s.time-previousTime<.02?s.time-previousTime:0;previousTime=s.time;
  for(const a of actors){a.previous.copy(a.mesh.matrixWorld);if(a.kind==='arm')a.mesh.matrix.copy(s.body).multiply(matrices.get(a.group)!);
   else {a.mesh.matrix.copy(contextTransform(a.group,s.lift,a.group.startsWith('main_')?s.wheelBody:s.body,s.drive,1));if(a.group==='gimbal_context')a.mesh.matrix.multiply(matrices.get('j0_carrier')!);}
   a.mesh.matrixWorld.copy(a.mesh.matrix);
  }
  return matrices;
 }
 function overlaps(a:THREE.Mesh,b:THREE.Mesh){if(!a.geometry.boundingBox)a.geometry.computeBoundingBox();if(!b.geometry.boundingBox)b.geometry.computeBoundingBox();if(!a.geometry.boundingBox!.clone().applyMatrix4(a.matrixWorld).intersectsBox(b.geometry.boundingBox!.clone().applyMatrix4(b.matrixWorld)))return false;const relative=a.matrixWorld.clone().invert().multiply(b.matrixWorld);return (a.geometry as any).boundsTree.bvhcast((b.geometry as any).boundsTree,relative,{intersectsTriangles(x:any,y:any){return x.getArea()>1e-10&&y.getArea()>1e-10&&x.intersectsTriangle(y);}});}
 function contactPoint(a:THREE.Mesh,b:THREE.Mesh){const relative=a.matrixWorld.clone().invert().multiply(b.matrixWorld),line=new THREE.Line3();let point:number[]|null=null;
  (a.geometry as any).boundsTree.bvhcast((b.geometry as any).boundsTree,relative,{intersectsTriangles(x:any,y:any){if(x.getArea()<1e-10||y.getArea()<1e-10||!x.intersectsTriangle(y,line))return false;point=line.getCenter(new THREE.Vector3()).applyMatrix4(a.matrixWorld).toArray();return true;}});return point;
 }
 const ray=new THREE.Raycaster();(ray as any).firstHitOnly=true;
 return {actors,update,geometrySnapshot(){const root=new THREE.Group();root.userData.missionTransmitterIncluded=parts.some(p=>p.node.name==='mission-transmitter');for(const a of actors){const mesh=new THREE.Mesh(a.mesh.geometry,basic);mesh.name=a.key;mesh.userData={group:a.group,kind:a.kind,contact:a.contact};root.add(mesh);}const ore=new THREE.Mesh(cubeGeometry,basic);ore.name='ore-silver';ore.userData={kind:'ore'};root.add(ore);return root;},
  intersectionsWith(root:THREE.Object3D){root.updateMatrixWorld(true);const targets:THREE.Mesh[]=[];root.traverse(o=>{if((o as THREE.Mesh).isMesh){const m=o as THREE.Mesh;(m.geometry as any).boundsTree??=new MeshBVH(m.geometry);targets.push(m);}});const hits:{actor:string;other:string}[]=[];
   for(const a of actors.filter(a=>a.kind==='arm'&&['link_4','link_5','link_6'].includes(a.group)))for(const b of targets)if(overlaps(b,a.mesh))hits.push({actor:a.key,other:b.name});return hits;
  },
  cast(from:THREE.Vector3,to:THREE.Vector3,includeField=true){const delta=to.clone().sub(from),length=delta.length();if(length<1e-9)return null;ray.set(from,delta.divideScalar(length));ray.near=.0001;ray.far=length;
   const targets=[...actors.filter(a=>!a.contact&&!a.group.startsWith('main_')).map(a=>a.mesh),...(includeField?fieldMeshes:[])];
   const hit=ray.intersectObjects(targets,false)[0];if(!hit?.face)return null;
   const normal=hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));if(normal.dot(delta)>0)normal.negate();
   const actor=actors.find(a=>a.mesh===hit.object),surfaceVelocity=new THREE.Vector3();
   if(actor&&sampleStep){const prior=hit.point.clone().applyMatrix4(actor.mesh.matrixWorld.clone().invert()).applyMatrix4(actor.previous);surfaceVelocity.copy(hit.point).sub(prior).divideScalar(sampleStep);}
   return {point:hit.point.clone(),normal,surfaceVelocity,object:actor?.key??'field:'+hit.object.userData.sourceId,distance:hit.distance};
  },
  audit(s:MissionState,q:SevenAngles){const matrices=update(s,q),hits:{actor:string;other:string;contact?:boolean;point?:number[]|null}[]=[];
   for(const a of actors){for(const fieldMesh of fieldMeshes)if(overlaps(fieldMesh,a.mesh))hits.push({actor:a.key,other:'field:'+fieldMesh.userData.sourceId,contact:a.contact,point:contactPoint(fieldMesh,a.mesh)});}
   const chassis=actors.filter(a=>a.kind==='context'&&a.group==='chassis');
   const arm=actors.filter(a=>a.kind==='arm'&&['link_2','link_3','link_4','link_5','link_6','uwb'].includes(a.group));
   for(const a of arm)for(const b of chassis)if(overlaps(a.mesh,b.mesh))hits.push({actor:a.key,other:b.key});
   for(let i=0;i<2;i++)if(s.silver[i]===2){const ore=new THREE.Mesh(cubeGeometry,basic);ore.matrixAutoUpdate=false;
    ore.matrixWorld.copy(s.body).multiply(matrices.get('j0_carrier')!).multiply(new THREE.Matrix4().makeTranslation(...STORES[i].toArray())).multiply(new THREE.Matrix4().makeRotationFromQuaternion(STORED_ORE_ROTATIONS[i]));
    for(const a of arm)if(overlaps(a.mesh,ore)){const point=contactPoint(a.mesh,ore),tool=toolPose(contract,q,s.body),delta=point?new THREE.Vector3().fromArray(point).sub(tool.position):new THREE.Vector3(99,99,99),normal=new THREE.Vector3(0,0,1).applyQuaternion(tool.rotation),cupContact=a.group==='link_6'&&delta.length()<.05&&Math.abs(delta.dot(normal))<.005;hits.push({actor:a.key,other:'stored-silver-'+i,point,contact:cupContact});}
   }
   return {time:s.time,hits};
  }
 };
}
