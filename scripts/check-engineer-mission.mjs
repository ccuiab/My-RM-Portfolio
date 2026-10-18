/** Current authored motion contracts. CAD sweeps and rendered review are separate gates. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createHash} from 'node:crypto';
import * as M from '../materials/models/derived/inputs/engineer-mission/motion.mjs';
import * as R from '../materials/models/derived/inputs/engineer-mission/station-rig.mjs';
const dir='materials/models/derived/inputs/engineer-mission/',base='materials/models/derived/rm2025-field/models/';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const [meta,trajectory,grasps,route,markings,bumps,transmitter]=await Promise.all([json('materials/models/derived/web/arm-parts.json'),json(dir+'trajectory.json'),json(dir+'grasps.json'),json(base+'mission-return-route.json'),json(base+'mission-field-markings.json'),json(base+'mission-bumps.json'),json('materials/models/derived/web/mission-transmitter.json')]);
M.configureSilverGrasps(grasps);
const checks=[],check=(name,condition,detail)=>{assert.ok(condition,name+': '+JSON.stringify(detail));checks.push({name,passed:true,detail});},v=(...p)=>new THREE.Vector3(...p),at=t=>M.missionState(M.publicTime(t));
function angles(t){const f=Math.min(t*trajectory.fps,trajectory.samples.length-1),i=Math.min(Math.floor(f),trajectory.samples.length-2),u=f-i,q=trajectory.samples[i].map((x,k)=>THREE.MathUtils.lerp(x,trajectory.samples[i+1][k],u));q[0]=M.missionJ0(M.missionState(t));return q;}
const qAt=t=>angles(M.publicTime(t));
let maxPosition=0,maxRotation=0,maxAt=0,maxJointSpeed=0,maxJointAt=0,maxWorldSpeed=0,maxTilt=0,maxBearing=0,maxCameraPitch=0,maxStandardCameraError=0,maxStandardJ1=0,maxCarryHeight=0,maxRoad=0,maxWheel=0,maxSpin=0,maxJ0Speed=0;
for(let n=1;n<=Math.round(M.MISSION_DURATION*120);n++){
 const t=n/120,s=M.missionState(t),q=angles(t),wanted=s.target,prev=M.missionState(t-1/120),pq=angles(t-1/120);
 assert.ok(q.every(Number.isFinite));assert.ok(q[5]>=-121.371652&&q[5]<=118.628349);
 if(wanted){const actual=M.toolPose(meta.motion,q,s.body),error=actual.position.distanceTo(wanted.position);if(error>maxPosition){maxPosition=error;maxAt=t;}const rotation=wanted.normalOnly?v(0,0,1).applyQuaternion(actual.rotation).angleTo(v(0,0,1).applyQuaternion(wanted.rotation)):actual.rotation.angleTo(wanted.rotation);maxRotation=Math.max(maxRotation,rotation);}
 for(let j=1;j<7;j++){const speed=Math.abs(q[j]-pq[j])*120;if(speed>maxJointSpeed){maxJointSpeed=speed;maxJointAt=t;}}
 maxJ0Speed=Math.max(maxJ0Speed,Math.abs(THREE.MathUtils.euclideanModulo(q[0]-pq[0]+180,360)-180)*120);
 maxWorldSpeed=Math.max(maxWorldSpeed,s.position.distanceTo(prev.position)*120);maxSpin=Math.max(maxSpin,Math.abs(s.spin-prev.spin)*120*180/Math.PI);maxRoad=Math.max(maxRoad,Math.abs(s.road[0]));maxWheel=Math.max(maxWheel,...s.wheelOffsets);
 if(s.storyTime>=26&&s.storyTime<40)maxTilt=Math.max(maxTilt,Math.abs(s.pitch),Math.abs(s.roll));
 const velocity=M.missionState(Math.min(M.MISSION_DURATION,t+.002)).position.clone().sub(M.missionState(Math.max(0,t-.002)).position);velocity.y=0;
 if(s.storyTime>=54&&s.storyTime<62){const f=v(...transmitter.cameraOpticalAxis.armRestAxis).transformDirection(s.body.clone().multiply(M.armMatrices(meta.motion,q).get('link_3')));maxCameraPitch=Math.max(maxCameraPitch,Math.abs(Math.asin(f.y)));if(velocity.length()>.001){f.y=0;maxBearing=Math.max(maxBearing,f.angleTo(velocity));}}
 if((s.storyTime>=53.2&&s.storyTime<M.STATION_FIRST_READY)||s.storyTime>=75.2){const f=v(...transmitter.cameraOpticalAxis.armRestAxis).transformDirection(s.body.clone().multiply(M.armMatrices(meta.motion,q).get('link_3')));maxStandardCameraError=Math.max(maxStandardCameraError,f.angleTo(v(Math.sin(s.gimbalHeading),0,Math.cos(s.gimbalHeading))));maxStandardJ1=Math.max(maxStandardJ1,Math.abs(THREE.MathUtils.euclideanModulo(q[1]+180,360)-180));if(s.gold===1){const p=M.toolPose(meta.motion,q,s.body);maxCarryHeight=Math.max(maxCarryHeight,p.position.clone().add(v(0,0,.1002).applyQuaternion(p.rotation)).y-s.position.y);}}
}
check('current TCP paths retain actual target face and position',maxPosition<.0035&&maxRotation<.012,{maxPosition_m:maxPosition,maxRotation_rad:maxRotation,maxAt});
check('continuous joints across all authored phase boundaries',maxJointSpeed<950,{maxJointSpeed_deg_s:maxJointSpeed,maxJointAt});
check('gimbal has no turn resets at short-travel chapter boundaries',maxJ0Speed<1400,{maxJ0Speed_deg_s:maxJ0Speed,note:'Includes continuous return pre-rotation plus gyro compensation; equivalent360-degree angle wraps are removed.'});
check('physical route with modestly faster straight travel',maxWorldSpeed<2.41&&maxWorldSpeed>2.3,{maxWorldSpeed_m_s:maxWorldSpeed});
check('both step lifts keep chassis level',maxTilt<1e-6,{maxTilt_rad:maxTilt});
check('actual VT03 lens stays horizontal and tracks velocity through spin and banked return',maxBearing<.003&&maxCameraPitch<.003,{maxBearing_rad:maxBearing,maxCameraPitch_rad:maxCameraPitch});
check('low standard carry and ending keep the actual camera forward with fixed arm J1',maxStandardCameraError<.003&&maxStandardJ1<.001&&maxCarryHeight<.60,{maxStandardCameraError_rad:maxStandardCameraError,maxStandardJ1_deg:maxStandardJ1,maxCarryHeightAboveTerrain_m:maxCarryHeight});
check('rule-position ribs drive actual wheel and sprung-body response',maxRoad>.002&&maxRoad<.008&&maxWheel>.01&&maxWheel<.014,{maxRoadHeave_m:maxRoad,maxWheelRise_m:maxWheel,height:bumps.height,width:bumps.width,period:bumps.period});
check('source gain outlines and road labels restored as paint',markings.meshes.length>=120&&[49,50,51,52,1266,1267,1268,1269,1270,1271].every(id=>markings.sourceIds.includes(id)),{meshes:markings.meshes.length,sourceIds:markings.sourceIds});
check('opening translates without gyro spin; combat escape still slows after shooting',[0,1,2,3,4,5,6].every(t=>Math.abs(at(t).spin)<1e-8)&&at(3).speed>.1&&M.GUNFIRE_END<M.SPIN_STOP&&M.SPIN_STOP-M.GUNFIRE_END>=1.39&&maxSpin>380,{openingSpin:at(3).spin,peak_deg_s:maxSpin,gunfireEnd:M.GUNFIRE_END,spinStop:M.SPIN_STOP});
for(const [t,i]of[[8.5,0],[16.15,1],[12.9,0],[20.6,1]]){
 const s=at(t),p=M.toolPose(meta.motion,qAt(t),s.body),oreP=p.position.clone().add(v(0,0,.1002).applyQuaternion(p.rotation)),oreQ=p.rotation.clone().multiply(M.SILVER_PICKUP_GRIPS[i]);
 if(t===8.5||t===16.15)check('silver source pose retained at pickup '+i,oreP.distanceTo(M.SILVER_CENTERS[i])<.001&&oreQ.angleTo(new THREE.Quaternion().setFromAxisAngle(v(0,1,0),Math.PI))<.002,{position:oreP.toArray()});
 else{const upper=s.body.clone().multiply(M.armMatrices(meta.motion,qAt(t)).get('j0_carrier')),expectedQ=new THREE.Quaternion().setFromRotationMatrix(upper).multiply(M.STORED_ORE_ROTATIONS[i]);check('ore settles on rear cup without a pose jump '+i,oreP.distanceTo(M.STORES[i].clone().applyMatrix4(upper))<.001&&oreQ.angleTo(expectedQ)<.002,{position:oreP.toArray()});}
}
for(const [t,i]of[[12.6,0],[20.3,1]]){const a=at(t-.15),b=at(t),pa=M.toolPose(meta.motion,qAt(t-.15),a.body),pb=M.toolPose(meta.motion,qAt(t),b.body),n=v(0,0,1).applyQuaternion(pb.rotation);check('stored silver is pressed vertically downward '+i,n.y<-.999&&Math.hypot(pa.position.x-pb.position.x,pa.position.z-pb.position.z)<.001&&pa.position.y>pb.position.y,{normal:n.toArray(),descent_m:pa.position.y-pb.position.y});}
const stairJ3=qAt(29.1)[3]-qAt(27.05)[3],stairJ5=qAt(29.1)[5]-qAt(27.05)[5];
check('stair flip uses opposite half turns to preserve suction direction',Math.abs(Math.abs(stairJ3)-180)<.1&&Math.abs(Math.abs(stairJ5)-180)<.1&&Math.abs(stairJ3+stairJ5)<.1,{J3_delta:stairJ3,J5_delta:stairJ5});
const supportPoses=[29.1,30.5,32.4,34.1,35.1].map(t=>{const q=qAt(t),s=at(t),mats=M.armMatrices(meta.motion,q),joint=meta.motion.joints.find(j=>j.name==='J3'),hingeAxis=v(...joint.axis).transformDirection(s.body.clone().multiply(mats.get(joint.parent_link))).transformDirection(M.STEP_FRAME.clone().invert());return{story:t,q,elbowDegrees:THREE.MathUtils.euclideanModulo(q[3]+180,360)-180,hingeAxis:hingeAxis.toArray()};});
// The user confirmed the actual rendered elbow/housing reversal. An opposite
// shoulder-elbow-wrist circle intersection is a different, unrequested pose.
check('two-step elbow and housing match the user-confirmed reversal',supportPoses.every(p=>p.hingeAxis[0]>.999&&p.elbowDegrees>10&&p.elbowDegrees<180&&Math.abs(p.q[6])<1),{reference:'User-confirmed shot-24_766667-zh.jpg, 2026-10-18',poses:supportPoses});
check('front support reaches first ledge before chassis lifts',at(27.8).position.y<.005&&.108441118-2*at(27.8).lift+at(27.8).position.y-.015>=.2029,{bodyY:at(27.8).position.y,lift:at(27.8).lift});
check('gold remains a side-hole retrieval on the original elbow branch',[45,48,49.2,49.9,51.8].every(t=>qAt(t)[3]<0&&Math.abs(qAt(t)[6])<90),[45,48,49.2,49.9,51.8].map(t=>({t,q:qAt(t)})));
for(const t of[64.8,65.2,73.1,73.5]){const s=at(t),p=M.toolPose(meta.motion,qAt(t),s.body),ore=p.position.clone().add(v(0,0,.1002).applyQuaternion(p.rotation)).applyMatrix4(s.slot.clone().invert());check('ore completely seated at story '+t,ore.distanceTo(v(0,-.0199,-.106))<.001,ore.toArray());}
check('gold then one silver and second silver retained',at(65.4).gold===2&&JSON.stringify(at(79).silver)==='[3,2]',{end:at(79).silver});
check('receiving poses stay still until arm withdrawal',at(64.8).slot.equals(at(66.2).slot)&&at(73.1).slot.equals(at(74.5).slot)&&!at(64.8).slot.equals(at(73.1).slot),{firstRecovery:67,secondRecovery:75.4});
check('station starts facing forward and waits for parking before moving',[0,50,62,M.STATION_FIRST_MOVE_START-.001].every(t=>JSON.stringify(M.stationAt(t))===JSON.stringify(R.STATION_INITIAL))&&Math.abs(R.STATION_INITIAL.yaw)<.001&&Math.abs(R.STATION_INITIAL.wristYaw)<.001&&JSON.stringify(M.stationAt(M.STATION_FIRST_READY))===JSON.stringify(R.STATION_A),{initial:R.STATION_INITIAL,moveStart:M.STATION_FIRST_MOVE_START,ready:M.STATION_FIRST_READY});
const stationMoveTime=M.publicTime(M.STATION_FIRST_MOVE_START),parkingSpeed=M.missionState(stationMoveTime+.002).position.distanceTo(M.missionState(stationMoveTime-.002).position)/.004;
check('robot has stopped when the first station target starts moving',parkingSpeed<.01,{parkingSpeed});
const initialStationAudit=await json('materials/documents/derived/audits/engineer-mission/station-initial-checks.json');
check('complete station initial-to-receiving sweep retains only native joint interfaces',initialStationAudit.samples>=241&&initialStationAudit.failures.length===0&&JSON.stringify(initialStationAudit.initial)===JSON.stringify(R.STATION_INITIAL),{samples:initialStationAudit.samples,failures:initialStationAudit.failures});
const wireCheck=await json('materials/documents/derived/audits/engineer-mission/transmitter-cable-hide-checks.json');
check('two rear transmitter leads are hidden while original housing and lens remain',transmitter.featureIdentification.includeRearLeadsFlag===false&&wireCheck.hiddenFeatureCount===2&&wireCheck.retainedTrianglePositionsBitIdentical&&wireCheck.retainedTriangleNormalsBitIdentical&&wireCheck.materialsUnchanged&&createHash('sha256').update(await readFile(transmitter.asset)).digest('hex')===wireCheck.newAssetSha256,{retainedTriangles:wireCheck.retainedTriangles,hiddenFeatures:wireCheck.hiddenFeatureCount});
const auditBase='materials/documents/derived/audits/engineer-mission/';
const stairAudit=await json(auditBase+'stair-ground-support-checks.json'),carryAudit=await json(auditBase+'carry-cad-checks.json');
check('independent detailed-CAD stair sweep includes VT03 and stored cargo',stairAudit.passed&&stairAudit.summary.oreFailures===0&&stairAudit.summary.groundFailures===0&&stairAudit.summary.selfFailures===0&&stairAudit.summary.fkFailures===0,{...stairAudit.summary,report:'stair-ground-support-checks.json',scope:stairAudit.scope});
const stairWindow=[];for(let n=Math.ceil(M.publicTime(23)*60);n<=M.publicTime(43)*60;n++)stairWindow.push([n/60,...angles(n/60)]);
check('stair evidence matches the complete current trajectory window',createHash('sha256').update(JSON.stringify(stairWindow)).digest('hex')===stairAudit.trajectoryWindowHash,{samples:stairWindow.length});
check('cloud, arm base and elbow prepare one after the other',stairAudit.summary.cloudCompleted<stairAudit.summary.armBaseStarted&&stairAudit.summary.armBaseCompleted<stairAudit.summary.elbowStarted&&stairAudit.summary.preparationShoulderRangeDegrees<40,stairAudit.summary);
check('rear wrist stays loaded on flat ground until all four main wheels reach upper ledge',stairAudit.summary.firstRearLift>=stairAudit.summary.allFourUpper&&stairAudit.summary.loadedRearWristMaxHeightError<.001&&stairAudit.summary.loadedRearWheelVerticalAxisMax<.01,{allFourUpper:stairAudit.summary.allFourUpper,firstRearLift:stairAudit.summary.firstRearLift,groundError:stairAudit.summary.loadedRearWristMaxHeightError});
check('independent actual-gold, slot, robot and rough-road carry sweep',carryAudit.collisionCount===0&&carryAudit.carrySampleCount>2000,{samples:carryAudit.sampleCount,carrySamples:carryAudit.carrySampleCount,collisions:carryAudit.collisionCount,report:'carry-cad-checks.json',scope:carryAudit.geometry});
const stableCarryPoses=carryAudit.records.filter(row=>row.story<60);
check('recorded carry poses before arrival still match the current trajectory',stableCarryPoses.every(row=>angles(row.time).every((x,j)=>Math.abs(x-row.q[j])<.0001)),{poses:stableCarryPoses.length});
check('carry geometry review uses unchanged current inputs',(await Promise.all(carryAudit.source.map(async row=>row.unchangedDuringAudit&&createHash('sha256').update(await readFile(row.path)).digest('hex')===row.sha256))).every(Boolean),{files:carryAudit.source.map(row=>row.path)});
const arrivalAudit=await json(auditBase+'return-arrival-cad-checks.json');
const arrivalContacts=arrivalAudit.wheelContactVerification;
check('arrival carry clears station with only individually verified ground-marker tyre contact',arrivalAudit.hits.length===0&&arrivalAudit.sampleCount>=500&&arrivalContacts.groundCADYRange[1]<.0051&&arrivalContacts.elevatedCollisionCount===0&&arrivalContacts.events===arrivalAudit.wheelContacts.length&&arrivalAudit.wheelContacts.every(row=>row.actor.endsWith('_tire')&&row.allOverlappingStaticCADAreGroundMarkings),{samples:arrivalAudit.sampleCount,hits:arrivalAudit.hits,groundMarkers:arrivalContacts.cadIds,groundCADYRange:arrivalContacts.groundCADYRange,events:arrivalContacts.events});
check('arrival review matches the current trajectory',arrivalAudit.rows.every(row=>angles(row.time).every((x,j)=>Math.abs(x-row.q[j])<.0001)),{poses:arrivalAudit.rows.length});
check('arrival evidence uses the final trajectory',arrivalAudit.trajectorySha256===createHash('sha256').update(await readFile(dir+'trajectory.json')).digest('hex'),{trajectorySha256:arrivalAudit.trajectorySha256});
const exchangeAudit=await json(auditBase+'exchange-cad-checks.json');
check('independent cargo-aware exchange and recovery CAD sweep',exchangeAudit.passed&&exchangeAudit.collisionCount===0&&exchangeAudit.sampleCount>=300,{samples:exchangeAudit.sampleCount,collisions:exchangeAudit.collisionCount,report:'exchange-cad-checks.json'});
check('recorded exchange poses still match the current trajectory',exchangeAudit.poses.every(row=>angles(row.time).every((x,j)=>Math.abs(x-row.q[j])<.0001)),{poses:exchangeAudit.poses.length});
check('exchange review uses unchanged current CAD and motion inputs',(await Promise.all(Object.entries(exchangeAudit.sources).map(async([path,sha])=>createHash('sha256').update(await readFile(path)).digest('hex')===sha))).every(Boolean),{files:Object.keys(exchangeAudit.sources)});
const shots=await json(auditBase+'projectiles.json'),impacts=shots.shots.flatMap(s=>s.impacts);
check('late scattered shots hit the actual robot before spin begins',shots.start===M.ATTACK_START&&shots.shots.length>=20&&Math.min(...impacts.map(h=>h.t))<M.SPIN_START&&shots.shots.every(s=>s.impacts[0]?.object.startsWith('arm:')||s.impacts[0]?.object.startsWith('context:')),{shots:shots.shots.length,firstHit:Math.min(...impacts.map(h=>h.t)),spinStart:M.SPIN_START});
check('per-shot predictive aim and dissipative surface ricochets',shots.shots.every(s=>{const expected=M.missionState(s.start+s.flightSeconds).position.add(v(s.scatter[0],.18+s.scatter[1],s.scatter[2]));return expected.distanceTo(v(...s.aim))<1e-7;})&&impacts.every(h=>h.outgoingRelative<=h.incomingRelative*.751),{shots:shots.shots.length,impacts:impacts.length});
// Actual CAD rig versus analytic contact frame, including both parallel rods and terminal yaw.
globalThis.self=globalThis;const bytes=await readFile('materials/models/derived/rm2025-field/models/exchange-station.glb');
const station=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;station.updateMatrixWorld(true);
let slotNode;station.traverse(n=>{if(n.userData.cad_node_id===884)slotNode=n;});assert.ok(slotNode);
const sourceM=slotNode.matrixWorld.clone(),mouth=v(0,1.023484542,-.080391661).applyMatrix4(sourceM.clone().invert()),out=v(0,0,1).transformDirection(sourceM.clone().invert()),rig=R.createStationRig(station,M.STATION_WORLD);
let fkPosition=0,fkNormal=0;
for(let i=0;i<=340;i++){const t=62+i/20,p=M.stationAt(t),expected=R.stationSlotMatrix(p,M.STATION_WORLD);rig.apply(p);fkPosition=Math.max(fkPosition,mouth.clone().applyMatrix4(slotNode.matrixWorld).distanceTo(v().setFromMatrixPosition(expected)));fkNormal=Math.max(fkNormal,out.clone().transformDirection(slotNode.matrixWorld).distanceTo(v(0,0,1).transformDirection(expected)));}
check('full station mesh follows the true six-axis rig',fkPosition<1e-6&&fkNormal<1e-6,{fkPosition_m:fkPosition,fkNormal});
const meshes=[];slotNode.traverse(n=>{if(n.isMesh)meshes.push(n);});const poses=[];
for(const p of [R.STATION_A,R.STATION_B]){
 rig.apply(p);const m=R.stationSlotMatrix(p,new THREE.Matrix4()),pos=v().setFromMatrixPosition(m),n=v(0,0,1).transformDirection(m),theta=Math.atan2(n.x,n.z),phi=Math.acos(n.y),base=new THREE.Quaternion().setFromAxisAngle(v(0,1,0),theta).multiply(new THREE.Quaternion().setFromAxisAngle(v(1,0,0),phi-Math.PI/2)),res=base.invert().multiply(new THREE.Quaternion().setFromRotationMatrix(m)),right=v(1,0,0).applyQuaternion(res),alpha=THREE.MathUtils.radToDeg(Math.atan2(right.y,right.x)),x=pos.z*1000,y=pos.x*1000,z=pos.y*1000,sphere=x*x+y*y+(z-600)**2;
 let clearance=Infinity;for(const mesh of meshes){const w=M.STATION_WORLD.clone().invert().multiply(mesh.matrixWorld),e=w.elements,a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++)clearance=Math.min(clearance,-(e[2]*a.getX(i)+e[6]*a.getY(i)+e[10]*a.getZ(i)+e[14]));}
 const td=THREE.MathUtils.radToDeg(theta),pd=THREE.MathUtils.radToDeg(phi);assert.ok(x>=-270&&x<=0&&Math.abs(y)<=255&&z>=720&&z<=900&&sphere<=90000&&Math.abs(td)<=135&&Math.abs(td)>90&&pd>0&&pd<=90&&Math.abs(alpha)<=45&&clearance>.01);
 poses.push({parameters:p,x,y,z,theta:td,phi:pd,alpha,sphere,clearance_m:clearance});
}
check('side-back receiving normals satisfy level-4 rules and complete slot clearance',true,poses);
// The dump pose is deliberately checked separately from the receiving range.
const dump=R.stationSlotMatrix(R.STATION_DUMP,new THREE.Matrix4()),normal=v(0,0,1).transformDirection(dump),e=v().setFromMatrixPosition(dump);
check('station physically carries the ore over the rear collection box',e.x>.52&&e.x<.7&&e.z<-1.0&&e.z>-1.3&&e.y>.7&&normal.y<-.98,{mouth:e.toArray(),normal:normal.toArray(),collector:{x:[.421,.8],z:[-1.364,-.811],rimY:.560}});
await mkdir('materials/documents/derived/audits/engineer-mission',{recursive:true});await writeFile('materials/documents/derived/audits/engineer-mission/motion-checks.json',JSON.stringify({checks,scope:'Kinematics, continuity, source terrain and receiving constraints. Rendered review and exact physical dynamics are separate.'},null,2));
console.log('Mission checks:',checks.length,'passed',JSON.stringify({maxPosition,maxRotation,maxJointSpeed,maxWorldSpeed}));
