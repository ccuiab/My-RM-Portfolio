/** Offline CAD collision seam shared by motion planning and dense audits. */
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH,SAH} from 'three-mesh-bvh';
import * as M from '../materials/models/derived/inputs/engineer-mission/motion.mjs';
import * as R from '../materials/models/derived/inputs/engineer-mission/station-rig.mjs';

const v=(...p)=>new T.Vector3(...p),mat=new T.MeshBasicMaterial({side:T.DoubleSide});
async function glb(path){globalThis.self=globalThis;const b=await readFile(path);return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
const MIN_TRIANGLE_AREA=1e-10;
function bvh(g,targetLeafSize=8){
 if(g.boundsTree)return g;
 // CAD exports include collinear faces. They can enlarge BVH nodes while never
 // being eligible for the exact test (and trigger false positives in the
 // library's degenerate-triangle fallback if the guard is omitted).
 // Remove only faces rejected by that same area predicate, before building the
 // tree. Position vertices and every retained CAD triangle remain unchanged.
 const p=g.attributes.position,index=g.index,kept=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3();
 const count=index?index.count:p.count;
 for(let i=0;i<count;i+=3){const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);const area=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;if(area>=MIN_TRIANGLE_AREA)kept.push(ia,ib,ic);}
 g.userData.collisionTriangles={source:count/3,retained:kept.length/3,removed:(count-kept.length)/3};
 g.setIndex(kept);g.clearGroups();
 // SAH separates the disconnected perimeter-wall faces of field:33. CENTER
 // leaves their bounds overlapping the whole arena and visits robot triangles
 // even when the robot is metres away from every wall.
 g.boundsTree=new MeshBVH(g,{strategy:SAH,targetLeafSize});
 g.boundingBox=g.boundsTree.getBoundingBox(new T.Box3());return g;
}
export function crossing(a,b){
 if(!a.geometry.boundingBox)a.geometry.computeBoundingBox();if(!b.geometry.boundingBox)b.geometry.computeBoundingBox();
 if(!a.geometry.boundingBox.clone().applyMatrix4(a.matrixWorld).intersectsBox(b.geometry.boundingBox.clone().applyMatrix4(b.matrixWorld)))return false;
 return a.geometry.boundsTree.bvhcast(b.geometry.boundsTree,a.matrixWorld.clone().invert().multiply(b.matrixWorld),{intersectsTriangles(x,y){if(x.getArea()<MIN_TRIANGLE_AREA||y.getArea()<MIN_TRIANGLE_AREA)return false;return x.intersectsTriangle(y);}});
}
export async function loadMissionGeometry(){
 M.configureSilverGrasps(JSON.parse(await readFile('materials/models/derived/inputs/engineer-mission/grasps.json','utf8')));
 const [cache,station,meta,trajectory,field]=await Promise.all([glb('materials/models/derived/inputs/engineer-mission/collision-geometry.glb'),glb('materials/models/derived/rm2025-field/models/exchange-station.glb'),readFile('materials/models/derived/web/arm-parts.json','utf8').then(JSON.parse),readFile('materials/models/derived/inputs/engineer-mission/trajectory.json','utf8').then(JSON.parse),readFile('materials/models/derived/rm2025-field/models/mission-field-context.json','utf8').then(JSON.parse)]);
 const actors=[],ore=new T.Mesh();cache.traverse(o=>{if(!o.isMesh)return;bvh(o.geometry);o.matrixAutoUpdate=false;if(o.userData.kind==='ore')ore.geometry=o.geometry;else actors.push(o);});ore.matrixAutoUpdate=false;
 let transmitterIncluded=false;cache.traverse(o=>{if(o.userData.missionTransmitterIncluded)transmitterIncluded=true;});
 if(!transmitterIncluded){const model=await glb('materials/models/derived/web/mission-transmitter.glb'),geometries=[];model.updateMatrixWorld(true);model.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);for(const key of Object.keys(g.attributes))if(key!=='position')g.deleteAttribute(key);g.clearGroups();geometries.push(g);});const actor=new T.Mesh(bvh(mergeGeometries(geometries)),mat);actor.name='armmission-transmitter';actor.userData={kind:'arm',group:'link_3'};actor.matrixAutoUpdate=false;actors.push(actor);}
 const rig=R.createStationRig(station,M.STATION_WORLD),buckets=new Map();station.updateMatrixWorld(true);
 station.traverse(o=>{if(!o.isMesh)return;let parent=o.parent;while(parent!==station&&!parent.name.startsWith('actual_'))parent=parent.parent;const key=parent===station?'static':parent.name;let bucket=buckets.get(key);if(!bucket){bucket={key,parent,geometries:[]};buckets.set(key,bucket);}const g=o.geometry.clone().applyMatrix4(parent.matrixWorld.clone().invert().multiply(o.matrixWorld));for(const key of Object.keys(g.attributes))if(key!=='position')g.deleteAttribute(key);if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));g.clearGroups();bucket.geometries.push(g);});
 const groups=[...buckets.values()].map(b=>{const mesh=new T.Mesh(bvh(mergeGeometries(b.geometries)),mat);mesh.name=b.key;mesh.matrixAutoUpdate=false;return{...b,mesh};});
 const terrain=field.meshes.map(p=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.positions,3));g.setIndex(p.indices);const mesh=new T.Mesh(bvh(g),mat);mesh.name='field:'+p.sourceId;mesh.matrixWorld.identity();return mesh;});
 const point=new T.Vector3(),normal=new T.Vector3(),line=new T.Line3();
 function setStation(p){rig.apply(p);for(const g of groups)g.mesh.matrixWorld.copy(g.parent.matrixWorld);}
 function stationHits(){const hits=[];for(let i=0;i<groups.length;i++)for(let j=0;j<i;j++)if(crossing(groups[i].mesh,groups[j].mesh))hits.push([groups[i].key,groups[j].key].sort().join('|'));return hits;}
 const zero={yaw:0,shoulder:0,forearm:0,wristYaw:0,pitch:0,roll:0};setStation(zero);const interfaces=new Set(stationHits());
 interfaces.delete('actual_end_roll|actual_slot_pitch');
 function angles(t){const f=T.MathUtils.clamp(t*trajectory.fps,0,trajectory.samples.length-1),i=Math.min(Math.floor(f),trajectory.samples.length-2),u=f-i,q=trajectory.samples[i].map((x,k)=>T.MathUtils.lerp(x,trajectory.samples[i+1][k],u));q[0]=M.missionJ0(M.missionState(t));return q;}
 const mainWheels=[{center:[.226237301,-.253419985,-.052948673],pivot:[.226240635,-.163433542,-.052963663],steer:-40.005161},{center:[-.004848556,-.253419985,-.354620824],pivot:[-.004861320,-.163433542,-.354612287],steer:3.679978},{center:[-.306497032,-.253419985,-.123518642],pivot:[-.306509949,-.163433542,-.123510337],steer:4.716102},{center:[-.075395995,-.253419985,.178128725],pivot:[-.075408004,-.163433542,.178138295],steer:-1.093199}];
 // The cache already contains each original part's rest matrix. Only actual
 // joint transforms are applied here, without an explosion/display transform.
 const about=(p,axis,deg)=>{const q=v(...p),r=new T.Matrix4().makeRotationAxis(v(...axis),deg*Math.PI/180);return r.setPosition(q.clone().sub(q.clone().applyMatrix4(r)));};
 function setRobot(s,q){const matrices=M.armMatrices(meta.motion,q),a=M.missionState(Math.max(0,s.time-.01)),b=M.missionState(Math.min(M.MISSION_DURATION,s.time+.01)),dt=b.time-a.time||1,velocity=b.position.clone().sub(a.position).divideScalar(dt).applyAxisAngle(v(0,1,0),-s.yaw),omega=(b.yaw-a.yaw)/dt;
  for(const actor of actors){const group=actor.userData.group;
   if(actor.userData.kind==='arm')actor.matrixWorld.copy(s.body).multiply(matrices.get(group));
   else if(group.startsWith('main_')){const i=Number(group.split('_')[1]),w=mainWheels[i],r=v(...w.center).applyMatrix4(M.CANONICAL),vel=velocity.clone();vel.x+=omega*r.z;vel.z-=omega*r.x;const heading=Math.hypot(vel.x,vel.z)<.003?0:Math.atan2(vel.x,vel.z)*180/Math.PI;actor.matrixWorld.copy(s.wheelBody).multiply(about(w.pivot,[0,1,0],w.steer+heading));actor.matrixWorld.elements[13]+=s.wheelOffsets[i];}
   else{const offset=/(foot|roller)$/.test(group)?-2*s.lift:/(carriage|gear)$/.test(group)?-s.lift:0;actor.matrixWorld.copy(s.body).multiply(new T.Matrix4().makeTranslation(0,offset,0));if(group==='gimbal_context')actor.matrixWorld.multiply(matrices.get('j0_carrier'));}
  }return matrices;
 }
  function robotOres(s,q){const matrices=setRobot(s,q),hits=[],tool=M.toolPose(meta.motion,q,s.body);for(let i=0;i<2;i++)if(s.silver[i]===2){ore.matrixWorld.copy(s.body).multiply(matrices.get('j0_carrier')).multiply(new T.Matrix4().makeTranslation(...M.STORES[i].toArray())).multiply(new T.Matrix4().makeRotationFromQuaternion(M.STORED_ORE_ROTATIONS[i]));
   for(const a of actors.filter(a=>a.userData.kind==='arm'&&!['j0_fixed','j0_carrier','link_base','j0_drive'].includes(a.userData.group))){if(!crossing(a,ore))continue;const d=tool.position.clone().applyMatrix4(ore.matrixWorld.clone().invert());const normal=v(0,0,1).applyQuaternion(tool.rotation);if(a.userData.group==='link_6'&&Math.abs(normal.y)>.99&&Math.abs(Math.abs(d.y)-.1002)<.005)continue;hits.push({actor:a.name,other:'stored-ore-'+i});}
  }return hits;
 }
 return {M,R,meta,actors,groups,ore,rig,station,angles,setRobot,setStation,interfaces,
  robotOres,
  robotStation(s,q){setRobot(s,q);setStation(s.stationPose);const hits=[];for(const a of actors)for(const b of groups)if(crossing(a,b.mesh))hits.push({actor:a.name,other:b.key});return hits;},
  stationSelf(p){setStation(p);return stationHits().filter(pair=>!interfaces.has(pair));},
  stationAll(p){setStation(p);return stationHits();},
  ground(s,q){setRobot(s,q);const hits=[];for(const a of actors)for(const b of terrain)if(crossing(a,b))hits.push({actor:a.name,other:b.name,contact:/(foot|roller|tire)$/.test(a.userData.group)||a.userData.group==='link_wheel'});return hits;},
 };
}
