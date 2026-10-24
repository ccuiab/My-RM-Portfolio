/** Fresh CAD sweep for revised travel poses and their stationary transitions. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH,SAH} from 'three-mesh-bvh';
import {loadMissionGeometry,crossing} from './mission-geometry.mjs';
import {classifyStationRobotHits} from './mission-contact-classification.mjs';

const audit=(process.env.MISSION_AUDIT_DIR??'materials/documents/derived/audits/engineer-mission/revision-20261022').replace(/[\\\/]?$/,'/');
const output=audit+'travel-cad-checks.json';
const files=['scripts/authoring/engineer-mission/engineer-mission-motion.ts','scripts/build-engineer-mission.mjs','materials/models/derived/inputs/engineer-mission/trajectory.json','materials/models/derived/inputs/engineer-mission/motion.mjs','materials/models/derived/inputs/engineer-mission/grasps.json','materials/models/derived/inputs/engineer-mission/collision-geometry.glb','materials/models/derived/web/mission-transmitter.glb','materials/models/derived/rm2025-field/models/ore-gold.glb'];
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const sources=Object.fromEntries(await Promise.all(files.map(async path=>[path,await hash(path)])));
const g=await loadMissionGeometry(),M=g.M,v=(...p)=>new T.Vector3(...p),failures=[],poses=[];
const bytes=await readFile('materials/models/derived/rm2025-field/models/ore-gold.glb');
const model=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene,geometries=[];
model.updateMatrixWorld(true);model.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);for(const key of Object.keys(geo.attributes))if(key!=='position')geo.deleteAttribute(key);if(!geo.index)geo.setIndex(Array.from({length:geo.attributes.position.count},(_,i)=>i));geo.clearGroups();geometries.push(geo);});
const gold=new T.Mesh(mergeGeometries(geometries));gold.matrixAutoUpdate=false;
gold.geometry.boundsTree=new MeshBVH(gold.geometry,{strategy:SAH,targetLeafSize:8});gold.geometry.boundingBox=gold.geometry.boundsTree.getBoundingBox(new T.Box3());
const fullGold=new T.Mesh(gold.geometry);fullGold.matrixAutoUpdate=false;
const arm=g.actors.filter(a=>['link_2','link_3','link_4','link_5','link_6','uwb'].includes(a.userData.group)||a.name==='armmission-transmitter');
const body=g.actors.filter(a=>['chassis','j0_carrier','gimbal_context'].includes(a.userData.group)||a.userData.group.startsWith('main_')&&!a.userData.group.endsWith('tire'));
const ranges=[[0,6],[21.6,26],[39.8,43],[53.2,62]],fps=process.argv.includes('--dense')?30:15;
for(const [start,end]of ranges){
 const first=M.publicTime(start),last=M.publicTime(end),count=Math.ceil((last-first)*fps);
 for(let i=0;i<=count;i++){
  const time=T.MathUtils.lerp(first,last,i/count),s=M.missionState(time),q=g.angles(time),oreHits=g.robotOres(s,q),ground=g.ground(s,q).filter(h=>!h.contact),station=classifyStationRobotHits(g,g.robotStation(s,q)).rigid;
  if(oreHits.length)failures.push({time,story:s.storyTime,type:'stored-ore',hits:oreHits});
  if(ground.length)failures.push({time,story:s.storyTime,type:'terrain',hits:ground});
  if(station.length)failures.push({time,story:s.storyTime,type:'station',hits:station});
  g.setRobot(s,q);const self=[];
  for(const a of arm)for(const b of body)if(crossing(a,b))self.push({actor:a.name,other:b.name});
  if(self.length)failures.push({time,story:s.storyTime,type:'self',hits:self});
  if(s.gold===1){
   const tool=M.toolPose(g.meta.motion,q,s.body);gold.matrixWorld.compose(tool.position.clone().add(v(0,0,.1002).applyQuaternion(tool.rotation)),tool.rotation,v(.98,.98,.98));
   const actors=g.actors.filter(a=>crossing(gold,a)).map(a=>a.name),groups=g.groups.filter(b=>crossing(gold,b.mesh)).map(b=>b.key);
   if(actors.length||groups.length)failures.push({time,story:s.storyTime,type:'held-gold',actors,station:groups});
   const upper=s.body.clone().multiply(M.armMatrices(g.meta.motion,q).get('j0_carrier'));
   fullGold.matrixWorld.copy(gold.matrixWorld).scale(v(1/.98,1/.98,1/.98));
   for(let oreIndex=0;oreIndex<2;oreIndex++)if(s.silver[oreIndex]===2){
    g.ore.matrixWorld.copy(upper).multiply(new T.Matrix4().makeTranslation(...M.STORES[oreIndex].toArray())).multiply(new T.Matrix4().makeRotationFromQuaternion(M.STORED_ORE_ROTATIONS[oreIndex]));
    if(crossing(fullGold,g.ore))failures.push({time,story:s.storyTime,type:'held-gold-vs-stored-silver',other:'stored-ore-'+oreIndex});
   }
  }
  poses.push({time,story:s.storyTime,q});
  if(i%60===0)console.log('TRAVEL_CAD',start,end,i,count,'failures',failures.length);
 }
}
const changed=[];for(const [path,sha]of Object.entries(sources))if(await hash(path)!==sha)changed.push(path);
const report={schema:2,created:new Date().toISOString(),passed:!failures.length&&!changed.length,sources,changedDuringAudit:changed,ranges,samplingHz:fps,samples:poses.length,method:'Discrete original CAD triangle BVH sweeps of arm, VT03, UWB, stored ores, carried gold, chassis, terrain and station. Uses the current actual poses, including the explicitly fixed-upper short strafe to the stairs; this audit does not impose velocity-facing on that working exception. Held-gold mesh shrunk by 2mm per face solely to distinguish suction contact; gold versus stored silver retains the full-size hull. Native ground marking contacts classified separately. No historical results are inputs.',failures,poses};
await mkdir(output.slice(0,output.lastIndexOf('/')),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,samples:poses.length,failures:failures.length,firstFailures:failures.slice(0,10),changedDuringAudit:changed,output}));
if(!report.passed)process.exitCode=1;
