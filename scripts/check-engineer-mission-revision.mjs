/** Fresh checks for the October 22 motion revision. Run only after the unified
 * mission build. Reads current trajectory/CAD contracts and executes the current
 * projectile generator; historical audit reports are deliberately not inputs.
 * Exact CAD collision sweeps and rendered viewing remain separate checks. */
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from 'three';

const inputs='materials/models/derived/inputs/engineer-mission/';
const audit=(process.env.MISSION_AUDIT_DIR??'materials/documents/derived/audits/engineer-mission/revision-20261022').replace(/[\\\/]?$/,'/');
const temporary=resolve('tmp/engineer-mission-revision');
await mkdir(temporary,{recursive:true});await mkdir(audit,{recursive:true});
const sourcePaths=[
 'scripts/authoring/engineer-mission/engineer-mission-motion.ts','scripts/authoring/engineer-mission/engineer-mission-projectiles.ts',
 'scripts/authoring/engineer-mission/engineer-mission-wheel-roll.ts','scripts/authoring/engineer-mission/engineer-mission-empty.ts','src/scripts/lib/arm-study-motion.ts','scripts/build-engineer-mission.mjs',
 inputs+'trajectory.json',inputs+'motion.mjs',inputs+'grasps.json',
 'materials/models/derived/web/arm-parts.json','materials/models/derived/web/mission-transmitter.json',
 'materials/models/derived/rm2025-field/models/mission-return-route.json',
 'materials/models/derived/rm2025-field/models/mission-arm-transfers.json',
];
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const sources=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,await hash(path)])));
for(const [name,entry]of [['motion','scripts/authoring/engineer-mission/engineer-mission-motion.ts'],['projectiles','scripts/authoring/engineer-mission/engineer-mission-projectiles.ts']]){
 await build({entryPoints:[entry],outfile:resolve(temporary,name+'.mjs'),bundle:true,packages:'external',format:'esm',platform:'node'});
}
const M=await import(pathToFileURL(resolve(temporary,'motion.mjs')).href+'?'+Date.now());
const Built=await import(pathToFileURL(resolve(inputs,'motion.mjs')).href+'?'+Date.now());
const {createMissionProjectiles}=await import(pathToFileURL(resolve(temporary,'projectiles.mjs')).href+'?'+Date.now());
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const [meta,tr,grasps,transmitter]=await Promise.all([
 json('materials/models/derived/web/arm-parts.json'),json(inputs+'trajectory.json'),json(inputs+'grasps.json'),
 json('materials/models/derived/web/mission-transmitter.json'),
]);
M.configureSilverGrasps(grasps);Built.configureSilverGrasps(grasps);
const checks=[],diagnostics=[],add=(name,passed,detail)=>checks.push({name,passed:!!passed,detail});
const degrees=T.MathUtils.radToDeg,up=new T.Vector3(0,1,0);
const wrappedDegrees=(a,b=0)=>T.MathUtils.euclideanModulo(a-b+180,360)-180;
const snapshot=s=>({position:s.position.toArray(),body:s.body.elements,heading:s.heading,gimbal:s.gimbalHeading,target:s.target?{p:s.target.position.toArray(),r:s.target.rotation.toArray()}:null});
const sameStates=Array.from({length:161},(_,i)=>tr.duration*i/160).every(time=>JSON.stringify(snapshot(M.missionState(time)))===JSON.stringify(snapshot(Built.missionState(time))));
add('Unified trajectory build matches the current motion source',sameStates&&Math.abs(M.MISSION_DURATION-tr.duration)<1e-8&&tr.samples.length===Math.floor(tr.duration*tr.fps)+1,{duration:tr.duration,fps:tr.fps,samples:tr.samples.length,sourceAndBuiltStatesEqual:sameStates});
function angles(time){
 const frame=T.MathUtils.clamp(time*tr.fps,0,tr.samples.length-1),index=Math.min(Math.floor(frame),tr.samples.length-2),u=frame-index;
 const q=tr.samples[index].map((a,k)=>T.MathUtils.lerp(a,tr.samples[index+1][k],u));
 q[0]=M.missionJ0(M.missionState(time));return q;
}
function pose(time){const state=M.missionState(time),q=angles(time),matrices=M.armMatrices(meta.motion,q);return{time,state,q,matrices,tool:M.toolPose(meta.motion,q,state.body)};}
function camera(p){return new T.Vector3().fromArray(transmitter.cameraOpticalAxis.armRestAxis).transformDirection(p.state.body.clone().multiply(p.matrices.get('link_3')));}
function velocity(time){const a=Math.max(0,time-1/1200),b=Math.min(tr.duration,time+1/1200);return M.missionState(b).position.clone().sub(M.missionState(a).position).divideScalar(b-a||1);}
function cameraError(p,direction){const optical=camera(p),horizontal=optical.clone().setY(0);return{bearing:horizontal.lengthSq()>1e-12?horizontal.angleTo(direction.clone().setY(0)):Math.PI,pitch:Math.abs(Math.asin(T.MathUtils.clamp(optical.y,-1,1)))};}
const travelRanges=[[0,6],[40,43],[54,62]],cameraRows=[],cameraTolerance=.003;
for(const [start,end]of travelRanges){
 let maxBearing=0,maxPitch=0,maxEncodedFramePitch=0,maxEncodedFrameBearing=0,count=0,encodedCount=0,firstMoving=null,worst=null,pitchWorst=null;
 const physicalStart=M.publicTime(start),physicalEnd=M.publicTime(end);
 const onsetVelocity=velocity(physicalStart).setY(0);
 if(onsetVelocity.length()>1e-6)firstMoving={time:physicalStart,v:onsetVelocity.toArray()};
 for(let frame=Math.ceil(physicalStart*120);frame<physicalEnd*120;frame++){
  const time=frame/120,p=pose(time),v=velocity(time);v.y=0;
  if(v.length()<=1e-6)continue;
  const error=cameraError(p,v);count++;firstMoving??={time,v:v.toArray()};
  if(error.bearing>maxBearing){maxBearing=error.bearing;worst={time,story:p.state.storyTime,speed:v.length(),bearingDegrees:degrees(error.bearing),pitchDegrees:degrees(error.pitch)};}
  if(error.pitch>maxPitch){maxPitch=error.pitch;pitchWorst={time,story:p.state.storyTime,speed:v.length(),pitchDegrees:degrees(error.pitch)};}
  if(frame%4===0){encodedCount++;maxEncodedFramePitch=Math.max(maxEncodedFramePitch,error.pitch);maxEncodedFrameBearing=Math.max(maxEncodedFrameBearing,error.bearing);}
 }
 const before=firstMoving?pose(Math.max(0,firstMoving.time-1/tr.fps)):null;
 const ready=before?cameraError(before,new T.Vector3().fromArray(firstMoving.v)):null;
 cameraRows.push({storyRange:[start,end],movingSamples:count,encodedMovingFrames:encodedCount,maxBearingDegrees:degrees(maxBearing),maxPitchDegrees:degrees(maxPitch),maxEncodedFrameBearingDegrees:degrees(maxEncodedFrameBearing),maxEncodedFramePitchDegrees:degrees(maxEncodedFramePitch),worst,pitchWorst,firstMovingTime:firstMoving?.time??null,precedingFrameReady:ready?ready.bearing<cameraTolerance&&ready.pitch<cameraTolerance:false,precedingFrameErrorDegrees:ready?{bearing:degrees(ready.bearing),pitch:degrees(ready.pitch)}:null});
 add('Actual encoded 30fps VT03 follows ordinary travel '+start+'..'+end,encodedCount>0&&maxEncodedFrameBearing<cameraTolerance&&maxEncodedFramePitch<cameraTolerance,cameraRows.at(-1));
 diagnostics.push({name:'120Hz interpolated optical axis in ordinary travel '+start+'..'+end,passed:count>0&&maxBearing<cameraTolerance&&maxPitch<cameraTolerance,detail:cameraRows.at(-1),scope:'Subframes between the 60Hz authored poses are diagnostic. The delivered movie samples 30fps; actual encoded-frame alignment remains a required check.'});
 add('VT03 is aligned before ordinary travel begins '+start+'..'+end,!!ready&&ready.bearing<cameraTolerance&&ready.pitch<cameraTolerance,cameraRows.at(-1));
}

// The loaded, short omnidirectional transfer is a deliberate exception to
// velocity-facing: preserve the complete forward-facing upper pose instead.
const strafeA=pose(M.publicTime(23)),strafeB=pose(M.publicTime(26)),strafeDelta=strafeB.state.position.clone().sub(strafeA.state.position),strafeRows=[];
let strafeLineError=0,strafeVerticalError=0,strafeYawError=0,strafeJ0Error=0,strafeJ1Error=0,strafeGimbalError=0,strafeReverse=0,lastStrafeProgress=-1;
for(let n=0;n<=240;n++){
 const p=pose(T.MathUtils.lerp(strafeA.time,strafeB.time,n/240)),offset=p.state.position.clone().sub(strafeA.state.position),progress=offset.dot(strafeDelta)/strafeDelta.lengthSq(),line=strafeA.state.position.clone().addScaledVector(strafeDelta,progress);
 strafeLineError=Math.max(strafeLineError,p.state.position.distanceTo(line));
 strafeVerticalError=Math.max(strafeVerticalError,Math.abs(p.state.position.y-T.MathUtils.lerp(strafeA.state.position.y,strafeB.state.position.y,progress)));
 strafeYawError=Math.max(strafeYawError,Math.abs(wrappedDegrees(degrees(p.state.yaw),degrees(strafeA.state.yaw))));
 strafeJ0Error=Math.max(strafeJ0Error,Math.abs(wrappedDegrees(p.q[0],strafeA.q[0])));
 strafeJ1Error=Math.max(strafeJ1Error,Math.abs(wrappedDegrees(p.q[1],strafeA.q[1])));
 strafeGimbalError=Math.max(strafeGimbalError,Math.abs(wrappedDegrees(degrees(p.state.gimbalHeading),degrees(strafeA.state.gimbalHeading))));
 strafeReverse=Math.max(strafeReverse,lastStrafeProgress-progress);lastStrafeProgress=progress;
 strafeRows.push({time:p.time,story:p.state.storyTime,progress,q0:p.q[0],q1:p.q[1],position:p.state.position.toArray()});
}
const strafeBeforeEndSpeed=velocity(strafeB.time-1e-5).length(),prepareProbe=pose(M.publicTime(26.08)),prepareSpeed=velocity(prepareProbe.time).length();
add('Silver-to-stairs is a straight fixed-upper strafe with a deliberate camera exception',strafeLineError<1e-5&&strafeVerticalError<1e-5&&strafeYawError<.001&&strafeJ0Error<.001&&strafeJ1Error<.001&&strafeGimbalError<.001&&strafeReverse<1e-8,{storyRange:[23,26],physicalSeconds:strafeB.time-strafeA.time,distance_m:strafeDelta.length(),maxLineError_m:strafeLineError,maxVerticalError_m:strafeVerticalError,maxYawChangeDegrees:strafeYawError,maxJ0ChangeDegrees:strafeJ0Error,maxJ1ChangeDegrees:strafeJ1Error,maxGimbalHeadingChangeDegrees:strafeGimbalError,maxReverseProgress:strafeReverse,samples:strafeRows.length,cameraPolicy:'User-confirmed exception: keep upper assembly facing vehicle-front, not the lateral velocity.'});
add('The robot parks before the cloud starts stair preparation',strafeBeforeEndSpeed<.001&&prepareSpeed<1e-6&&Math.abs(wrappedDegrees(prepareProbe.q[0],strafeA.q[0]))>.1,{speedJustBeforeParking_m_s:strafeBeforeEndSpeed,earlyPreparationSpeed_m_s:prepareSpeed,preparationStory:prepareProbe.state.storyTime,q0ChangeAfterParkingDegrees:wrappedDegrees(prepareProbe.q[0],strafeA.q[0])});

const emptyRows=[];let maxEmptyNormalError=0,maxEmptyNormalY=0,maxEmptyHeightChange=-Infinity;
for(let n=0;n<M.publicTime(6)*30;n++){
 const p=pose(n/30);if(p.state.storyTime>=6||velocity(p.time).length()<.02||M.missionTravelArrivalBlend(p.state)>1e-8)continue;
 const normal=new T.Vector3(0,0,1).applyQuaternion(p.tool.rotation),desired=new T.Vector3(Math.sin(p.state.heading),0,Math.cos(p.state.heading)),old=M.toolPose(meta.motion,M.missionLevelCarryAngles(p.state),p.state.body),heightChange=p.tool.position.y-old.position.y;
 maxEmptyNormalError=Math.max(maxEmptyNormalError,normal.angleTo(desired));maxEmptyNormalY=Math.max(maxEmptyNormalY,Math.abs(normal.y));maxEmptyHeightChange=Math.max(maxEmptyHeightChange,heightChange);
 emptyRows.push({time:p.time,story:p.state.storyTime,q:p.q,tcp:p.tool.position.toArray(),heightChangeFromOldCarry_m:heightChange});
}
add('Opening empty travel uses a lower forward-facing cup while retaining the actual camera contract',emptyRows.length>10&&maxEmptyNormalError<.01&&maxEmptyNormalY<.01&&maxEmptyHeightChange<-.02,{sampledEncodedFrames:emptyRows.length,maxCupFrontErrorDegrees:degrees(maxEmptyNormalError),maxCupNormalY:maxEmptyNormalY,leastHeightReductionFromOldCarry_m:-maxEmptyHeightChange,first:emptyRows[0],last:emptyRows.at(-1),comparison:'Compare TCP to the previous unchanged loaded-carry template under the same chassis pose; does not alter the ore-carrying return posture.'});

const recoverySeconds=M.publicTime(40)-M.publicTime(M.STAIR_RECOVERY_START),recoveryPosition=M.missionState(M.publicTime(M.STAIR_RECOVERY_START)).position;
// Story 40 belongs to the next travel action. Its baked endpoint has submicron
// source-coordinate rounding, checked separately from stationary recovery.
let maxRecoveryDrive=0;for(let n=0;n<180;n++)maxRecoveryDrive=Math.max(maxRecoveryDrive,M.missionState(T.MathUtils.lerp(M.publicTime(M.STAIR_RECOVERY_START),M.publicTime(40),n/180)).position.distanceTo(recoveryPosition));
const departureEndpointDifference=M.missionState(M.publicTime(40)).position.distanceTo(recoveryPosition);
add('Seven-axis stair recovery including the ready wait fits the 4.5-second budget',Math.abs(recoverySeconds-4.5)<1/30&&maxRecoveryDrive<1e-8&&departureEndpointDifference<1e-5,{recoveryBudgetSeconds:recoverySeconds,activeRecoverySeconds:M.publicTime(M.STAIR_RECOVERY_END)-M.publicTime(M.STAIR_RECOVERY_START),readyWaitSeconds:M.publicTime(40)-M.publicTime(M.STAIR_RECOVERY_END),maxChassisTranslation_m:maxRecoveryDrive,departureEndpointDifference_m:departureEndpointDifference,scope:'The recovery interval is stationary; the separate departure endpoint allows only CAD-cache coordinate rounding. Rates and collision sweeps are checked separately; no measured hardware performance is implied.'});

let previous=pose(0),maxPosition=0,maxNormal=0,maxPositionAt=null,maxNormalAt=null,maxTCPFrameTravel=0,maxTCPFrameAt=null,maxLinkFrameTurn=0,maxLinkFrameAt=null;
const jointPeaks=Array(7).fill(0),badNumbers=[];
for(let n=1;n<=Math.round(tr.duration*120);n++){
 const p=pose(Math.min(tr.duration,n/120)),dt=p.time-previous.time;
 if(!p.q.every(Number.isFinite))badNumbers.push(p.time);
 const wanted=p.state.target;
 if(wanted){
  const error=p.tool.position.distanceTo(wanted.position);
  const orientation=wanted.normalOnly?new T.Vector3(0,0,1).applyQuaternion(p.tool.rotation).angleTo(new T.Vector3(0,0,1).applyQuaternion(wanted.rotation)):p.tool.rotation.angleTo(wanted.rotation);
  if(error>maxPosition){maxPosition=error;maxPositionAt={time:p.time,story:p.state.storyTime};}
  if(orientation>maxNormal){maxNormal=orientation;maxNormalAt={time:p.time,story:p.state.storyTime};}
 }
 const frameTravel=p.tool.position.distanceTo(previous.tool.position);
 if(frameTravel>maxTCPFrameTravel){maxTCPFrameTravel=frameTravel;maxTCPFrameAt={time:p.time,story:p.state.storyTime};}
 for(let j=0;j<7;j++){const delta=j===0?T.MathUtils.euclideanModulo(p.q[j]-previous.q[j]+180,360)-180:p.q[j]-previous.q[j];jointPeaks[j]=Math.max(jointPeaks[j],Math.abs(delta)/(dt||1));}
 for(const name of ['j0_carrier','link_1','link_2','link_3','link_4','link_5','link_6','link_wheel']){
  const a=new T.Quaternion().setFromRotationMatrix(previous.state.body.clone().multiply(previous.matrices.get(name))),b=new T.Quaternion().setFromRotationMatrix(p.state.body.clone().multiply(p.matrices.get(name)));
  const turn=a.angleTo(b);if(turn>maxLinkFrameTurn){maxLinkFrameTurn=turn;maxLinkFrameAt={time:p.time,story:p.state.storyTime,link:name};}
 }
 previous=p;
}
add('Current target TCP positions and orientations retain the actual contract',maxPosition<.0035&&maxNormal<.012,{maxPosition_m:maxPosition,maxPositionAt,maxOrientationRadians:maxNormal,maxNormalAt,positionTolerance_m:.0035,orientationTolerance_rad:.012});
add('Dense physical poses have no joint or TCP jumps',!badNumbers.length&&maxTCPFrameTravel<.05&&maxLinkFrameTurn<.20,{samplingHz:120,maxTCPFrameTravel_m:maxTCPFrameTravel,maxTCPFrameAt,maxLinkFrameTurnDegrees:degrees(maxLinkFrameTurn),maxLinkFrameAt,jointPeakDegreesPerSecond:jointPeaks,badNumbers,scope:'Detects sampled pose jumps; the numeric ceilings are authoring continuity checks, not measured hardware limits.'});
const transferPaths=await json('materials/models/derived/rm2025-field/models/mission-arm-transfers.json');
const transferTimes=Object.values(transferPaths.segments).flatMap(p=>[p.start,p.end,...(p.times??[])]);
const boundaryTimes=new Set([0,6,7,8,8.6,9.6,10.5,11.6,12.6,13,13.8,14.3,15,15.8,16.3,17.3,18.3,19.3,20.3,20.8,21.6,22.2,23,26,27.05,29.1,30.5,31,31.9,32.4,34.1,35.2,M.STAIR_UNLOAD_START,M.STAIR_RECOVERY_START,M.STAIR_RECOVERY_END,40,43,45,48,49.2,49.9,51.8,53.2,54,62,M.STATION_FIRST_READY,63.4,64.8,65.35,66.2,66.8,67.15,67.5,68.1,68.8,69.1,69.2,70,70.35,70.8,71,71.25,71.4,72.2,73,73.65,74.5,75.2,78,80,...transferTimes].filter(Number.isFinite));
let boundaryPosition=0,boundaryTurn=0;const boundaryFailures=[];
for(const story of boundaryTimes){
 const t=M.publicTime(story);if(t<=0||t>=tr.duration)continue;
 const a=pose(t-1e-5),b=pose(t+1e-5),travel=a.tool.position.distanceTo(b.tool.position);let turn=0;
 for(const name of ['j0_carrier','link_3','link_6','link_wheel'])turn=Math.max(turn,new T.Quaternion().setFromRotationMatrix(a.state.body.clone().multiply(a.matrices.get(name))).angleTo(new T.Quaternion().setFromRotationMatrix(b.state.body.clone().multiply(b.matrices.get(name)))));
 boundaryPosition=Math.max(boundaryPosition,travel);boundaryTurn=Math.max(boundaryTurn,turn);
 if(travel>.0005||turn>.001)boundaryFailures.push({story,time:t,travel,turn});
}
add('Both sides of authored action boundaries are continuous',!boundaryFailures.length,{boundaries:boundaryTimes.size,epsilonSeconds:1e-5,maxTCPDistance_m:boundaryPosition,maxLinkTurn_rad:boundaryTurn,failures:boundaryFailures});

function tcpPeak(startStory,endStory){let peak=0,at=null;const start=M.publicTime(startStory),end=M.publicTime(endStory);let p=pose(start);for(let t=start+1/240;t<=end+1e-9;t+=1/240){const next=pose(Math.min(end,t)),speed=next.tool.position.distanceTo(p.tool.position)/(next.time-p.time);if(speed>peak){peak=speed;at={time:t,story:next.state.storyTime};}p=next;}return{peak_m_s:peak,at,physicalSeconds:end-start,storyRange:[startStory,endStory]};}
const silverSpeed=tcpPeak(13,16.3),firstExchangeSpeed=tcpPeak(M.STATION_FIRST_READY,64.8);
add('Transfer between silver pickups is visibly slower than the old 2.24 m/s peak',silverSpeed.peak_m_s<2.24*.65,{...silverSpeed,oldReference_m_s:2.24,requiredReductionFraction:.35,reference:'Directly measured pre-revision FK baseline'});
add('First exchange approach is visibly slower than the old 2.35 m/s peak',firstExchangeSpeed.peak_m_s<2.35*.65,{...firstExchangeSpeed,oldReference_m_s:2.35,requiredReductionFraction:.35,reference:'Directly measured pre-revision FK baseline'});

let retrieval=null;
for(let n=Math.ceil(M.publicTime(62)*240);n<M.publicTime(74)*240;n++){const time=n/240,s=M.missionState(time);if(s.silver[0]===1){retrieval=time;break;}}
let pickupDetail={retrievalTime:retrieval},pickupPassed=false;
if(retrieval!==null){
 const last=pose(retrieval-1/240),normal=new T.Vector3(0,0,1).applyQuaternion(last.tool.rotation),upper=last.state.body.clone().multiply(last.matrices.get('j0_carrier')),ore=M.STORES[0].clone().applyMatrix4(upper),expected=ore.clone().addScaledVector(up,.1002);
 const descent=[];let found=false;
 for(let n=0;n<=720;n++){const p=pose(retrieval-1/240-n/240);if(p.state.storyTime<66.8)break;descent.push(p);if(p.tool.position.y-last.tool.position.y>=.05){found=true;break;}}
 const horizontal=Math.max(0,...descent.map(p=>Math.hypot(p.tool.position.x-last.tool.position.x,p.tool.position.z-last.tool.position.z))),maxNormalY=Math.max(...descent.map(p=>new T.Vector3(0,0,1).applyQuaternion(p.tool.rotation).y));
 let reverse=0;for(let i=1;i<descent.length;i++)reverse=Math.max(reverse,descent[i-1].tool.position.y-descent[i].tool.position.y);
 pickupDetail={retrievalTime:retrieval,retrievalStory:M.storyTime(retrieval),normal:normal.toArray(),contactError_m:last.tool.position.distanceTo(expected),verticalApproachFound:found,approachHeight_m:descent.at(-1).tool.position.y-last.tool.position.y,maxHorizontalDrift_m:horizontal,maxNormalY,largestReverseTravel_m:reverse,samples:descent.length};
 pickupPassed=found&&normal.y<-.999&&maxNormalY<-.999&&horizontal<.003&&reverse<.0005&&last.tool.position.distanceTo(expected)<.0035;
}
add('Second exchanged silver is approached vertically from above',pickupPassed,pickupDetail);

let rearJ1Error=0,minRetrievalElbow=Infinity,maxRetrievalElbow=-Infinity,retrievalJ0Error=0;
const rearBranchRows=[];
for(let n=0;n<=720;n++){
 const story=T.MathUtils.lerp(66.2,72.2,n/720),p=pose(M.publicTime(story)),elbow=wrappedDegrees(p.q[3]);
 minRetrievalElbow=Math.min(minRetrievalElbow,elbow);maxRetrievalElbow=Math.max(maxRetrievalElbow,elbow);retrievalJ0Error=Math.max(retrievalJ0Error,Math.abs(wrappedDegrees(p.q[0],M.UPRIGHT_J0)));
 if(story>=67.5&&story<=70.35){rearJ1Error=Math.max(rearJ1Error,Math.abs(wrappedDegrees(p.q[1],-156)));rearBranchRows.push({story,q1:p.q[1],q3:p.q[3],tcp:p.tool.position.toArray()});}
}
add('Stored silver uses the rear J1 branch without the old over-shoulder elbow flip',rearBranchRows.length>100&&rearJ1Error<6&&minRetrievalElbow> -175&&maxRetrievalElbow< -1&&retrievalJ0Error<.01,{workingStoryRange:[66.2,72.2],rearHoldStoryRange:[67.5,70.35],maxRearJ1ErrorFromMinus156Degrees:rearJ1Error,elbowPrincipalRangeDegrees:[minRetrievalElbow,maxRetrievalElbow],maxCloudJ0ChangeDegrees:retrievalJ0Error,rearHoldSamples:rearBranchRows.length,contact:pose(M.publicTime(69.1)).q,scope:'Tests the ordinary negative-elbow kinematic branch. Joint principal angles describe animation geometry, not calibrated hardware limits.'});

const liftStart=pose(M.publicTime(69.2)),liftEnd=pose(M.publicTime(70));let maxLiftTilt=0,maxLiftHorizontal=0;
for(let n=0;n<=160;n++){
 const p=pose(T.MathUtils.lerp(liftStart.time,liftEnd.time,n/160)),normal=new T.Vector3(0,0,1).applyQuaternion(p.tool.rotation);
 maxLiftTilt=Math.max(maxLiftTilt,degrees(Math.acos(T.MathUtils.clamp(-normal.y,-1,1))));
 maxLiftHorizontal=Math.max(maxLiftHorizontal,Math.hypot(p.tool.position.x-liftStart.tool.position.x,p.tool.position.z-liftStart.tool.position.z));
}
const pickupLift=liftEnd.tool.position.y-liftStart.tool.position.y;
add('The attached silver lifts clear with a small wrist tilt instead of a large flip',pickupLift>.03&&pickupLift<.06&&maxLiftTilt>3&&maxLiftTilt<7&&maxLiftHorizontal<.003,{storyRange:[69.2,70],toolFaceLift_m:pickupLift,maxNormalTiltFromDownDegrees:maxLiftTilt,maxToolFaceHorizontalTravel_m:maxLiftHorizontal,expectedLift_m:.04,expectedWristTiltDegrees:5,scope:'Tool-face path and actual FK normal; held-ore clearances are verified independently with CAD.'});

// Execute the real projectile generator without a collision surface. This
// isolates emission scheduling and residual flight; impact locations are checked
// separately by the renderer with actual CAD collision surfaces enabled.
const projectileScene=new T.Scene(),system=createMissionProjectiles(projectileScene,{update(){},cast(){return null;}}),shots=system.report.shots;
const intervals=shots.slice(1).map((s,i)=>s.start-shots[i].start),minInterval=Math.min(...intervals),maxInterval=Math.max(...intervals),rate=1/(intervals.reduce((a,b)=>a+b,0)/intervals.length);
const endError=Math.abs(M.GUNFIRE_END-M.BUMP_ENTRY),lastShot=shots.at(-1);
add('Gunfire is about 30 Hz and ceases at the first rough-road response',Math.abs(rate-30)<.01&&endError<1e-8&&shots.every(s=>s.start<M.GUNFIRE_END)&&M.GUNFIRE_END-lastShot.start<=1/30+1e-8,{shots:shots.length,measuredRateHz:rate,intervalSeconds:[minInterval,maxInterval],firstShot:shots[0]?.start,lastShot:lastShot?.start,gunfireEnd:M.GUNFIRE_END,bumpEntry:M.BUMP_ENTRY,endError,scope:'Emission timing from current projectile code, with collisions disabled only for this isolated scheduling check.'});
system.frame(M.GUNFIRE_END+.02);
const balls=projectileScene.children.filter(o=>o.isMesh&&o.geometry.type==='SphereGeometry');
add('Already emitted rounds remain in flight after firing stops',balls.some(ball=>ball.visible),{checkedTime:M.GUNFIRE_END+.02,visibleRounds:balls.filter(ball=>ball.visible).length});
const rolling=tr.wheelRolling;
add('Unified trajectory contains contact-driven differential wheel motion',!!rolling&&rolling.contactSamples>100&&rolling.maxRollingSlip<1e-8&&Math.abs(rolling.finalCupPhaseErrorDegrees)<1e-7,{...rolling,contacts:undefined,directionCheckCommand:'node scripts/check-engineer-mission-wheel-roll.mjs'});

const changed=[];for(const [path,sha]of Object.entries(sources))if(await hash(path)!==sha)changed.push(path);
add('Source inputs stayed unchanged during this verification',!changed.length,{changed});
const report={schema:3,created:new Date().toISOString(),passed:checks.every(c=>c.passed),sources,scope:'Fresh current FK: encoded 30fps optical-axis alignment in ordinary travel, explicit fixed-upper straight-strafe camera exception, lower forward-facing opening cup, 4.5s stair recovery, ordinary negative-elbow rear J1 silver pickup with small tilt/lift, 120Hz target/pose continuity diagnostics, wheel coupling and emission timing. No historical audit reports are used. Exact CAD collision sweeps and rendered viewing remain separate requirements.',checks,diagnostics,camera:cameraRows};
await writeFile(audit+'motion-revision-checks.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:checks.length,failures:checks.filter(c=>!c.passed),subframeDiagnostics:diagnostics.filter(c=>!c.passed),report:audit+'motion-revision-checks.json'},null,2));
if(!report.passed)process.exitCode=1;
