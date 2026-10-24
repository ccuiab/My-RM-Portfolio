/** Exact current-CAD checks for the empty-cup follow-up. By default reads the
 * isolated authoring build in tmp; --current verifies the unified build instead.
 * No source CAD or shared generated inputs are written. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {loadMissionGeometry,crossing} from './mission-geometry.mjs';
const input=process.argv.includes('--current')?'materials/models/derived/inputs/engineer-mission':'tmp/engineer-empty-validation';
const audit=resolve(process.env.MISSION_AUDIT_DIR??'materials/documents/derived/audits/engineer-mission/revision-20261022-followup');await mkdir(audit,{recursive:true});
const M=await import(pathToFileURL(resolve(input,'motion.mjs')).href+'?'+Date.now());
const tr=JSON.parse(await readFile(join(input,'trajectory.json'),'utf8')),grasps=JSON.parse(await readFile(join(input,'grasps.json'),'utf8'));
M.configureSilverGrasps(grasps);
const g=await loadMissionGeometry(),meta=g.meta,up=new T.Vector3(0,1,0);
const files=['scripts/authoring/engineer-mission/engineer-mission-empty.ts','scripts/authoring/engineer-mission/engineer-mission-motion.ts','src/scripts/lib/arm-study-motion.ts','scripts/build-engineer-mission.mjs','materials/models/derived/web/arm-parts.json','materials/models/derived/inputs/engineer-mission/collision-geometry.glb',join(input,'trajectory.json'),join(input,'motion.mjs'),join(input,'grasps.json')];
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex'),sources=Object.fromEntries(await Promise.all(files.map(async path=>[path,await hash(path)])));
function angles(time){const f=T.MathUtils.clamp(time*tr.fps,0,tr.samples.length-1),i=Math.min(Math.floor(f),tr.samples.length-2),q=tr.samples[i].map((v,k)=>T.MathUtils.lerp(v,tr.samples[i+1][k],f-i));q[0]=M.missionJ0(M.missionState(time));return q;}
const arm=g.actors.filter(a=>a.userData.kind==='arm'&&['link_2','link_3','link_4','link_5','link_6','uwb'].includes(a.userData.group));
const context=g.actors.filter(a=>a.userData.kind==='context'||a.userData.group==='j0_carrier');
const hits=[],rows=[],optical=M.VT03_ARM_REST_AXIS;
for(const [start,end]of [[0,6],[21.6,26]])for(let n=Math.ceil(M.publicTime(start)*30);n<=M.publicTime(end)*30;n++){
 const time=n/30,s=M.missionState(time),q=angles(time);g.setRobot(s,q);
 const self=[];for(const a of arm)for(const b of context)if(crossing(a,b))self.push({actor:a.name,other:b.name});
 const ground=g.ground(s,q).filter(h=>!h.contact),ore=g.robotOres(s,q);if(self.length||ground.length||ore.length)hits.push({time,story:s.storyTime,self,ground,ore});
 const actual=M.toolPose(meta.motion,q,s.body),camera=optical.clone().transformDirection(s.body.clone().multiply(M.armMatrices(meta.motion,q).get('link_3'))),normal=new T.Vector3(0,0,1).applyQuaternion(actual.rotation),moving=s.speed>1e-5;
 rows.push({time,story:s.storyTime,q,tcp:actual.position.toArray(),camera:camera.toArray(),cup:normal.toArray(),moving,frontErrorDegrees:T.MathUtils.radToDeg(normal.angleTo(new T.Vector3(Math.sin(s.heading),0,Math.cos(s.heading)))),cameraPitchDegrees:T.MathUtils.radToDeg(Math.asin(camera.y))});
 if(n%60===0)console.log('EMPTY_CAD',s.storyTime.toFixed(3),'hits',hits.length);
}
console.log('EMPTY_SWEEP_DONE',rows.length,'hits',hits.length);
const metrics=[],withDistances=process.argv.includes('--distances');
for(const story of [0,23]){
 const s=M.missionState(M.publicTime(story)),old=M.missionLevelCarryAngles(s),q=M.missionEmptyTravelAngles(meta.motion,s);
 function bounds(angles){g.setRobot(s,angles);const get=group=>{const actor=g.actors.find(a=>a.userData.group===group),b=actor.geometry.boundingBox.clone().applyMatrix4(actor.matrixWorld);return{min:b.min.y-s.position.y,max:b.max.y-s.position.y};};
  const matrices=M.armMatrices(meta.motion,angles),elbow=new T.Vector3().fromArray(meta.motion.joints.find(j=>j.name==='J3').point_m).applyMatrix4(s.body.clone().multiply(matrices.get('link_2'))),wrist=new T.Vector3().fromArray(meta.motion.joints.find(j=>j.name==='J5').point_m).applyMatrix4(s.body.clone().multiply(matrices.get('link_4'))),tool=M.toolPose(meta.motion,angles,s.body);
  return{q:angles,toolHeight_m:tool.position.y-s.position.y,elbowHeight_m:elbow.y-s.position.y,wristHeight_m:wrist.y-s.position.y,link2Height:get('link_2'),link3Height:get('link_3')};
 }
 const before=bounds(old),after=bounds(q);g.setRobot(s,q);const nearest=[];
 // The upper-arm/J0 clearance is the restricting empty-start interface; all
 // other frame and terrain pairs are swept above at the output frame rate.
 const upper=g.actors.find(a=>a.userData.group==='link_2'),carrier=g.actors.find(a=>a.userData.group==='j0_carrier');
 if(withDistances){const gap=upper.geometry.boundsTree.closestPointToGeometry(carrier.geometry,upper.matrixWorld.clone().invert().multiply(carrier.matrixWorld),{}, {},0,.05);if(gap)nearest.push({actor:upper.name,other:carrier.name,distance_m:gap.distance});}
 if(story===23&&withDistances){
  const matrices=M.armMatrices(meta.motion,q);
  for(let i=0;i<2;i++){
   const oreMatrix=s.body.clone().multiply(matrices.get('j0_carrier')).multiply(new T.Matrix4().makeTranslation(...M.STORES[i].toArray())).multiply(new T.Matrix4().makeRotationFromQuaternion(M.STORED_ORE_ROTATIONS[i]));
   for(const actor of arm.filter(a=>['link_2','uwb'].includes(a.userData.group))){const near=actor.geometry.boundsTree.closestPointToGeometry(g.ore.geometry,actor.matrixWorld.clone().invert().multiply(oreMatrix),{}, {},0,.05);if(near)nearest.push({actor:actor.name,other:'stored-silver-'+i,distance_m:near.distance});}
  }
 }
 metrics.push({story,before,after,elbowLowering_m:before.elbowHeight_m-after.elbowHeight_m,tcpLowering_m:before.toolHeight_m-after.toolHeight_m,clearances:nearest});
}
const moving=rows.filter(r=>r.moving),frontError=Math.max(0,...moving.map(r=>r.frontErrorDegrees)),changed=[];for(const [path,sha]of Object.entries(sources))if(await hash(path)!==sha)changed.push(path);
const geometryPassed=!hits.length&&frontError<.02;
const report={created:new Date().toISOString(),input,passed:geometryPassed&&!changed.length,geometryPassed,closestDistanceQueries:withDistances,scope:'Actual rendered CAD triangle intersections for empty start/arrival and silver withdrawal/sideways travel, including full context, J0 carrier, terrain and actual stored silver meshes. Samples at 30fps output times; this is a discrete sweep, not an analytic continuous guarantee. Link bounds describe visible geometry, not a measured mass centre.',sources,sourceChanges:changed,samples:rows.length,maxMovingCupFrontErrorDegrees:frontError,collisionSamples:hits.length,hits,metrics,rows};
await writeFile(join(audit,'empty-travel-cad-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,samples:rows.length,collisionSamples:hits.length,hits: hits.slice(0,8),metrics,sourceChanges:changed,report:join(audit,'empty-travel-cad-checks.json')},null,2));if(!report.passed)process.exitCode=1;
