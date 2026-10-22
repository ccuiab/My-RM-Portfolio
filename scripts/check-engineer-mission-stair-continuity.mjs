/** Current A-film stair contract. Run after build-engineer-mission.mjs.
 * FK is checked at 60 Hz; use --dense for CAD collision checks at 30 Hz.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {loadMissionGeometry,crossing} from './mission-geometry.mjs';

const audit=(process.env.MISSION_AUDIT_DIR??'materials/documents/derived/audits/engineer-mission').replace(/[\\\/]?$/,'/');
await mkdir(audit,{recursive:true});
const g=await loadMissionGeometry();
const trajectory=JSON.parse(await readFile('materials/models/derived/inputs/engineer-mission/trajectory.json','utf8'));
const inputPaths=['materials/models/derived/inputs/engineer-mission/trajectory.json','materials/models/derived/inputs/engineer-mission/motion.mjs','materials/models/derived/inputs/engineer-mission/grasps.json','materials/models/derived/inputs/engineer-mission/collision-geometry.glb','materials/models/derived/web/arm-parts.json','materials/models/derived/web/mission-transmitter.glb','materials/models/derived/web/mission-transmitter.json','materials/models/derived/rm2025-field/models/mission-field-context.json'];
const sources=Object.fromEntries(await Promise.all(inputPaths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const transmitter=JSON.parse(await readFile('materials/models/derived/web/mission-transmitter.json','utf8'));
const inverseStep=g.M.STEP_FRAME.clone().invert(),forward=new T.Vector3(0,0,1);
const wheelCenters=[[.226237301,-.253419985,-.052948673],[-.004848556,-.253419985,-.354620824],[-.306497032,-.253419985,-.123518642],[-.075395995,-.253419985,.178128725]].map(p=>new T.Vector3(...p));
const start=Math.ceil(g.M.publicTime(26)*60),end=Math.floor(g.M.publicTime(40)*60);
const geometryStride=process.argv.includes('--dense')?2:6;
const failures={support:[],ground:[],ores:[],self:[]},hashRows=[],stateRows=[];
let allFourUpperTime=null,firstRearLiftTime=null,maxSupportHeightError=0,maxWheelAxisVertical=0,maxRecoveryTranslation=0;
const recoveryJointPeakVelocity=Array(7).fill(0),recoveryJointPeakAcceleration=Array(7).fill(0);let previousRecovery=null,previousRecoveryVelocity=null;
const recoveryPosition=g.M.missionState(g.M.publicTime(g.M.STAIR_RECOVERY_START)).position;
const wheelJoint=g.meta.motion.joints.find(j=>j.name==='J7');
const armActors=g.actors.filter(p=>['link_2','link_3','link_4','link_5','link_6','uwb'].includes(p.userData.group)||p.name==='armmission-transmitter');
const bodyActors=g.actors.filter(p=>['chassis','j0_carrier','gimbal_context'].includes(p.userData.group)||p.userData.group.startsWith('main_')&&!p.userData.group.endsWith('tire'));

for(let i=start;i<=end;i++){
 const time=i/60,s=g.M.missionState(time),q=g.angles(time),pose=g.M.toolPose(g.meta.motion,q,s.body);
 const normal=forward.clone().applyQuaternion(pose.rotation);
 const wrist=pose.position.clone().addScaledVector(normal,-.0705).applyMatrix4(inverseStep);
 const contacts=wheelCenters.map((p,k)=>p.clone().applyMatrix4(s.wheelBody).add(new T.Vector3(0,s.wheelOffsets[k]-.059989754,0)).applyMatrix4(inverseStep));
 const allFourUpper=contacts.every(p=>p.y>=.302878-.001&&p.z>=1.108);
 hashRows.push([time,...q]);
 stateRows.push({time,story:s.storyTime,q,body:s.body.elements,wheelOffsets:s.wheelOffsets,tcp:pose.position.toArray(),rotation:pose.rotation.toArray()});
 if(s.storyTime>=29.1&&s.storyTime<g.M.STAIR_RECOVERY_START){
  if(allFourUpper&&allFourUpperTime===null)allFourUpperTime=time;
  if(Math.abs(wrist.y-.043)>.001&&firstRearLiftTime===null)firstRearLiftTime=time;
  if(!allFourUpper){
   const axis=new T.Vector3().fromArray(wheelJoint.axis).transformDirection(s.body.clone().multiply(g.M.armMatrices(g.meta.motion,q).get(wheelJoint.child_link)));
   maxSupportHeightError=Math.max(maxSupportHeightError,Math.abs(wrist.y-.043));
   maxWheelAxisVertical=Math.max(maxWheelAxisVertical,Math.abs(axis.y));
   if(Math.abs(wrist.y-.043)>.001||Math.abs(axis.y)>.01||wrist.z+.04>.637)failures.support.push({time,story:s.storyTime,wrist:wrist.toArray(),axisY:axis.y});
  }
 }
 if(s.storyTime>=g.M.STAIR_RECOVERY_START){
  maxRecoveryTranslation=Math.max(maxRecoveryTranslation,s.position.distanceTo(recoveryPosition));
  if(previousRecovery){const dt=time-previousRecovery.time,velocity=q.map((angle,k)=>(T.MathUtils.euclideanModulo(angle-previousRecovery.q[k]+180,360)-180)/dt);velocity.forEach((value,k)=>recoveryJointPeakVelocity[k]=Math.max(recoveryJointPeakVelocity[k],Math.abs(value)));if(previousRecoveryVelocity)velocity.forEach((value,k)=>recoveryJointPeakAcceleration[k]=Math.max(recoveryJointPeakAcceleration[k],Math.abs(value-previousRecoveryVelocity[k])/dt));previousRecoveryVelocity=velocity;}
  previousRecovery={time,q};
 }
 if(i%geometryStride===0){
  const ores=g.robotOres(s,q),ground=g.ground(s,q).filter(hit=>!hit.contact);
  if(ores.length)failures.ores.push({time,story:s.storyTime,hits:ores});
  if(ground.length)failures.ground.push({time,story:s.storyTime,hits:ground});
  g.setRobot(s,q);const self=[];
  for(const arm of armActors)for(const body of bodyActors)if(crossing(arm,body))self.push({actor:arm.name,other:body.name});
  if(self.length)failures.self.push({time,story:s.storyTime,hits:self});
 }
 if(i%120===0)console.log('STAIR_PROGRESS',time.toFixed(2));
}

function speedAt(story){const t=g.M.publicTime(story);return g.M.missionState(t+.001).position.distanceTo(g.M.missionState(t-.001).position)/.002;}
const readyTime=g.M.publicTime(g.M.STAIR_RECOVERY_END),ready=g.M.missionState(readyTime),readyQ=g.angles(readyTime);
const optical=new T.Vector3().fromArray(transmitter.cameraOpticalAxis.armRestAxis).transformDirection(ready.body.clone().multiply(g.M.armMatrices(g.meta.motion,readyQ).get('link_3')));
const departureTime=g.M.publicTime(40),depart=g.M.missionState(departureTime+.01).position.sub(g.M.missionState(departureTime).position).setY(0).normalize();
const cameraHeadingErrorDegrees=T.MathUtils.radToDeg(Math.acos(T.MathUtils.clamp(optical.clone().setY(0).normalize().dot(depart),-1,1)));
const continuousSpeeds=[31,31.9].map(story=>({story,speed:speedAt(story)}));
const boundaries=[26,29.1,g.M.STAIR_RECOVERY_START,40].map(story=>{
 const t=g.M.publicTime(story),a=g.M.missionState(t-.00001),b=g.M.missionState(t+.00001);
 const before=g.M.toolPose(g.meta.motion,g.angles(t-.00001),a.body),after=g.M.toolPose(g.meta.motion,g.angles(t+.00001),b.body);
 return {story,tcpDistance:before.position.distanceTo(after.position),rotationDegrees:T.MathUtils.radToDeg(before.rotation.angleTo(after.rotation))};
});
const preparationOrdered=g.M.missionRearTurn(27)>=179.99&&g.M.missionWaistTurn(27)<.01&&g.M.missionWaistTurn(27.95)>=179.99;
const recoveryBudgetSeconds=g.M.publicTime(40)-g.M.publicTime(g.M.STAIR_RECOVERY_START),activeRecoverySeconds=readyTime-g.M.publicTime(g.M.STAIR_RECOVERY_START),readyWaitSeconds=departureTime-readyTime;
const summary={samples60Hz:hashRows.length,geometryHz:60/geometryStride,preparationOrdered,allFourUpperTime,firstRearLiftTime,maxSupportHeightError,maxWheelAxisVertical,maxRecoveryTranslation,cameraHeadingErrorDegrees,recoveryBudgetSeconds,activeRecoverySeconds,readyWaitSeconds,expectedRecoveryBudgetSeconds:process.env.MISSION_RECOVERY_EXPECT_SECONDS?Number(process.env.MISSION_RECOVERY_EXPECT_SECONDS):null,recoveryJointPeakDegreesPerSecond:recoveryJointPeakVelocity,recoveryJointPeakDegreesPerSecondSquared:recoveryJointPeakAcceleration,kinematicRateBoundary:'Animation trajectory rates only; no measured hardware capability or load validation is implied.',continuousSpeeds,boundaries,contactDistance:trajectory.wheelRolling?.signedContactDistance,maxRollingSlip:trajectory.wheelRolling?.maxRollingSlip,failures:Object.fromEntries(Object.entries(failures).map(([key,rows])=>[key,rows.length]))};
const recoveryBudgetPassed=!process.env.MISSION_RECOVERY_EXPECT_SECONDS||Math.abs(recoveryBudgetSeconds-Number(process.env.MISSION_RECOVERY_EXPECT_SECONDS))<1/30;
const passed=Object.values(failures).every(rows=>!rows.length)&&preparationOrdered&&recoveryBudgetPassed&&allFourUpperTime!==null&&firstRearLiftTime!==null&&allFourUpperTime<firstRearLiftTime&&maxRecoveryTranslation<1e-8&&cameraHeadingErrorDegrees<.5&&continuousSpeeds.every(row=>row.speed>.02)&&boundaries.every(row=>row.tcpDistance<.001&&row.rotationDegrees<.2)&&Math.abs(trajectory.wheelRolling?.signedContactDistance??0)>.5;
const changedDuringAudit=[];for(const [path,hash]of Object.entries(sources))if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash)changedDuringAudit.push(path);
const snapshotPath=audit+'stair-window-states.json';
const snapshot=JSON.stringify({sources,rows:stateRows});await writeFile(snapshotPath,snapshot+'\n');
const report={scope:'Current A two-level climb: stationary preparation, continuous traverse between necessary riser events, loaded rear wheel contact until all four wheels are on the upper platform, no post-unload dragging, overlapping seven-axis recovery, camera ready before departure. Actual CAD terrain, stored ores and body tested.',passed:passed&&!changedDuringAudit.length,sources,changedDuringAudit,trajectoryWindowHash:createHash('sha256').update(JSON.stringify(hashRows)).digest('hex'),snapshot:{path:snapshotPath,sha256:createHash('sha256').update(snapshot+'\n').digest('hex')},summary,failures};
await writeFile(audit+'stair-continuity-checks.json',JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY',JSON.stringify(summary));
if(!report.passed)process.exitCode=1;
