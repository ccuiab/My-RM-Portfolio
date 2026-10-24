import * as THREE from 'three';
import returnRoute from '../../../materials/models/derived/rm2025-field/models/mission-return-route.json';
import recovery from '../../../materials/models/derived/rm2025-field/models/mission-station-recovery.json';
import armTransfers from '../../../materials/models/derived/rm2025-field/models/mission-arm-transfers.json';
import transmitter from '../../../materials/models/derived/web/mission-transmitter.json';
import {armMotionMatrices,aboutAxis,type MotionContract,type SevenAngles} from '../../../src/scripts/lib/arm-study-motion';
import {ARM_TOOL_FACE_OFFSET_M} from '../../../src/scripts/lib/arm-tool-point';
import {emptyTravelAngles} from './engineer-mission-empty';
export {EMPTY_TRAVEL_SHOULDER_DEGREES,STORED_EMPTY_TRAVEL_SHOULDER_DEGREES} from './engineer-mission-empty';
export {armMotionMatrices as armMatrices} from '../../../src/scripts/lib/arm-study-motion';
import {stationSlotMatrix,stationBlend,STATION_INITIAL,STATION_A,STATION_B,STATION_DUMP,STATION_DUMP_B,type StationParameters} from './engineer-station-rig';

// Working moves get their own time budgets; travel keeps its measured route
// speed and only gains stationary time for the arm/camera at arrival.
const storyKnots=[0,6,13,16.3,21.6,23,26,29.1,36.7,40,43,54,62,63.05,63.4,64.8,66.2,67.5,69.2,70,70.35,71,71.4,72.2,80],segmentSeconds=[returnRoute.travel.departure.duration+1,6.65,6.5,5.035,2.8,returnRoute.travel.toSteps.duration,8,10,4.5,returnRoute.travel.toGold.duration+1,8.8,returnRoute.duration,1.26,1.6,2,1.68,3.2,2.04,1.2,2.6,2.8,.48,1.6,9.36],clockKnots=[0];
segmentSeconds.forEach(n=>clockKnots.push(clockKnots.at(-1)!+n));
function clockMap(t:number,from:number[],to:number[]){let i=from.findIndex(x=>x>=t);if(i<=0)i=t<=0?1:from.length-1;return THREE.MathUtils.lerp(to[i-1],to[i],Math.max(0,Math.min(1,(t-from[i-1])/(from[i]-from[i-1]))));}
export const publicTime=(t:number)=>clockMap(t,storyKnots,clockKnots);
export const storyTime=(t:number)=>clockMap(t,clockKnots,storyKnots);
export const EXCHANGE_START=publicTime(62);
export const MISSION_DURATION=Math.ceil(publicTime(80)*30)/30;
export const ATTACK_START=publicTime(50.8),SPIN_START=publicTime(51.25),SPIN_STOP=publicTime(54)+returnRoute.tightEntry+.35;
const firstBumpSample=returnRoute.wheels.findIndex(row=>row.some(height=>height>.0001));
export const BUMP_ENTRY=publicTime(54)+firstBumpSample/returnRoute.fps;
export const GUNFIRE_END=BUMP_ENTRY;
export const GUNFIRE_HZ=30;
export const PHASE_TIMES=[0,6,26,43,50.8,54,62,79].map(publicTime);
export const GROUND=-.313409739;
export const CANONICAL=new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(52.54)).multiply(new THREE.Matrix4().makeTranslation(.0401346595,-GROUND,.0882369977));
export const UPRIGHT_J0=-52.54;
export const UPPER_UPRIGHT=CANONICAL.clone().multiply(aboutAxis([-.0401346595,-.1074335389,-.0882369977],[0,1,0],UPRIGHT_J0));
export const STORES=[new THREE.Vector3(-.207690840,.191766514,-.251693200),new THREE.Vector3(.128307918,.191766514,-.250779606)];
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const ease=(n:number)=>{n=clamp(n);return n*n*n*(n*(n*6-15)+10);};
const mix=(a:number,b:number,u:number)=>THREE.MathUtils.lerp(a,b,ease(u));
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),up=v(0,1,0),down=v(0,-1,0),forward=v(0,0,1);
const rad=THREE.MathUtils.degToRad;
const frame=(p:number[],angle:number)=>new THREE.Matrix4().makeTranslation(...p as [number,number,number]).multiply(new THREE.Matrix4().makeRotationY(rad(angle)));
// One official field coordinate frame: W=(-CAD.Z,CAD.Y,CAD.X)/1000.
export const SILVER_PROP=frame([4.305,0,0],90);
export const GOLD_PROP=frame([0,.3,0],-135);
export const STATION_WORLD=frame([12.586,0,-6.545],-90);
export const SILVER_FRAME=frame([4.935,0,1.19],-90);
export const STEP_FRAME=frame([5.105,0,0],-90);
export const GOLD_FRAME=GOLD_PROP.clone().multiply(new THREE.Matrix4().makeTranslation(0,-.3,-.9));
export const EXCHANGE_FRAME=frame([12.04,0,-6.545],90);
export const SILVER_CENTERS=[v(-.135002,.103,.630),v(.134998,.103,.630)].map(p=>p.applyMatrix4(SILVER_FRAME));
export const GOLD_CENTER=v(.040237,.652878,.900001).applyMatrix4(GOLD_FRAME);
export type MissionTarget={position:THREE.Vector3;rotation:THREE.Quaternion;normalOnly?:boolean;fixedRoll?:number};
export type MissionState={time:number;storyTime:number;gimbalHeading:number;speed:number;suspension:number[];road:number[];wheelOffsets:number[];chapter:number;body:THREE.Matrix4;wheelBody:THREE.Matrix4;position:THREE.Vector3;heading:number;yaw:number;spin:number;pitch:number;roll:number;lift:number;drive:number;target:MissionTarget|null;silver:number[];gold:number;oreMode:string;map:number[];slot:THREE.Matrix4;stationPose:StationParameters;impact:number;fade:number;climb:number};
export const COMPACT_ARM=[0,0,0,0,0,0];
const rotation=(normal:THREE.Vector3)=>new THREE.Quaternion().setFromUnitVectors(forward,normal);
const target=(p:THREE.Vector3,n=down):MissionTarget=>({position:p,rotation:rotation(n)});
function path(keys:{t:number;p:THREE.Vector3;n?:THREE.Vector3;r?:THREE.Quaternion}[],t:number){
 let i=keys.findIndex(k=>k.t>=t);if(i<=0)i=t<=keys[0].t?1:keys.length-1;
 const a=keys[i-1],b=keys[i],u=ease((t-a.t)/(b.t-a.t));
 return {position:a.p.clone().lerp(b.p,u),rotation:(a.r?.clone()??rotation(a.n??down)).slerp(b.r??rotation(b.n??down),u)};
}
function transformTarget(p:MissionTarget,m:THREE.Matrix4){return {position:p.position.clone().applyMatrix4(m),rotation:new THREE.Quaternion().setFromRotationMatrix(m).multiply(p.rotation)};}
const SILVER_LOCAL=[v(-.135002,.103,.630),v(.134998,.103,.630)];
const store=(i:number)=>STORES[i].clone().applyMatrix4(UPPER_UPRIGHT);
export const READY_SILVER=target(v(0,.52,.45));
export const READY_GOLD=target(v(.040237,.652878,.34),forward);
export const LEVEL_CARRY_ARM=[0,25,transmitter.cameraOpticalAxis.restPitchDegrees-25,0,95,0];
export const VT03_ARM_REST_AXIS=new THREE.Vector3().fromArray(transmitter.cameraOpticalAxis.armRestAxis).normalize();
// FK of the neutral joint template. The real VT03 optical axis is horizontal;
// the cup points down and holds the ore below the wrist, clear of its view.
const carryNormal=v(-.00685847089305637,-.9886594160600864,.15001840024723084);
const carryRotation=new THREE.Quaternion(.6518932509642749,-.00509796269244329,.0006696120617837698,.7582933151118387);
export const CARRY_GOLD={position:v(-.0010817087779814716,.8519171633996279,.2379182363222997),rotation:carryRotation};
export const missionCarryTarget=()=>transformTarget(CARRY_GOLD,GOLD_FRAME);
export function missionUsesLevelCarry(s:MissionState){const t=s.storyTime;return t<6||(t>=21.6&&t<26)||(t>=39.8&&t<43)||(t>=53.2&&t<STATION_FIRST_READY)||(t>=71.25&&t<71.4)||t>=75.2;}
const movingEnd=(plan:{fps:number;samples:number[][]})=>plan.samples.findLastIndex((row,i)=>i>0&&row.slice(0,3).some((x,k)=>Math.abs(x-plan.samples[i-1][k])>1e-10))/plan.fps;
export function missionTravelArrivalBlend(s:Pick<MissionState,'time'|'storyTime'>){
 const t=s.storyTime,plan=t<6?returnRoute.travel.departure:t>=40&&t<43?returnRoute.travel.toGold:null;
 if(!plan)return 0;
 const start=t<6?0:publicTime(40),end=t<6?publicTime(6):publicTime(43),stopped=start+movingEnd(plan);
 return ease((s.time-stopped)/(end-stopped));
}
function travelSample(plan:{fps:number;samples:number[][]},elapsed:number){
 const raw=THREE.MathUtils.clamp(elapsed*plan.fps,0,plan.samples.length-1),f=Math.abs(raw-Math.round(raw))<1e-7?Math.round(raw):raw,i=Math.min(Math.floor(f),plan.samples.length-2),u=f-i;
 const at=(index:number)=>new THREE.Vector3(...plan.samples[THREE.MathUtils.clamp(index,0,plan.samples.length-1)].slice(0,3) as [number,number,number]);
 const a=at(i),b=at(i+1),before=a.clone().sub(at(i-1)),delta=b.clone().sub(a),after=at(i+2).sub(b);
 // C1 interpolation retains every authored CAD-route sample. Adjacent constant
 // positions pin their tangents to zero, so parked intervals cannot overshoot.
 const tangent=(a:THREE.Vector3,b:THREE.Vector3)=>{const limit=3*Math.min(a.length(),b.length());return limit<1e-10?v():a.clone().add(b).multiplyScalar(.5).clampLength(0,limit);};
 const m0=tangent(before,delta),m1=tangent(delta,after),u2=u*u,u3=u2*u;
 return {position:a.addScaledVector(delta,-2*u3+3*u2).addScaledVector(m0,u3-2*u2+u).addScaledVector(m1,u3-u2),velocity:delta.multiplyScalar(-6*u2+6*u).addScaledVector(m0,3*u2-4*u+1).addScaledVector(m1,3*u2-2*u).multiplyScalar(plan.fps)};
}
export function missionToGoldPosition(elapsed:number){
 return travelSample(returnRoute.travel.toGold,elapsed).position.add(v(STAIR_EXIT_OFFSET*(1-ease(elapsed/1.5))));
}
export function missionToGoldHeading(elapsed:number){
 if(elapsed<=1e-8)elapsed=1e-7;
 const delta=travelSample(returnRoute.travel.toGold,elapsed).velocity,u=clamp(elapsed/1.5);
 delta.x-=STAIR_EXIT_OFFSET*30*u*u*(1-u)*(1-u)/1.5;
 return delta.lengthSq()>1e-24?Math.atan2(delta.x,delta.z):returnRoute.travel.toGold.samples.at(-1)![6];
}
function travelInitialHeading(plan:{fps:number;samples:number[][]}){const delta=travelSample(plan,1e-7).velocity;return delta.lengthSq()>1e-20?Math.atan2(delta.x,delta.z):plan.samples[0][6];}
// The narrow return bend's original position samples contain small polygonal
// corners inside an otherwise gradual turn. Averaging a short neighbourhood of
// the physical path removes those corners before its shared C1 interpolation;
// the camera follows that same path derivative. This is a millimetre-scale
// geometry correction, not a separately smoothed camera or a route time warp.
const returnTravelPlan=(()=>{
 const reference=v(9.15,.203,-5.885),points=returnRoute.samples.map(row=>new THREE.Vector3(...row.slice(0,3) as [number,number,number]));
 let centre=0;for(let i=1;i<points.length;i++)if(points[i].distanceToSquared(reference)<points[centre].distanceToSquared(reference))centre=i;
 const samples=returnRoute.samples.map((row,i)=>{
  const weight=1-ease((Math.abs(i-centre)-24)/24);if(weight<=0)return row;
  const average=v();let total=0;
  for(let j=-10;j<=10;j++){const w=Math.exp(-j*j/18);average.addScaledVector(points[THREE.MathUtils.clamp(i+j,0,points.length-1)],w);total+=w;}
  average.divideScalar(total);const p=points[i].clone().lerp(average,weight);
  return [p.x,row[1],p.z,...row.slice(3)];
 });
 return {...returnRoute,samples};
})();
const blendHeading=(a:number,b:number,u:number)=>a+THREE.MathUtils.euclideanModulo(b-a+Math.PI,Math.PI*2)*u-Math.PI*u;
export function missionLevelCamera(s:MissionState,referenceJ0Degrees?:number){
 const n=VT03_ARM_REST_AXIS,local=v(Math.sin(s.gimbalHeading),0,Math.cos(s.gimbalHeading)).transformDirection(s.body.clone().invert()),radius=Math.hypot(n.y,n.z);
 const theta=Math.atan2(n.y,n.z)-Math.asin(THREE.MathUtils.clamp(local.y/radius,-1,1)),z=n.y*Math.sin(theta)+n.z*Math.cos(theta);
 let j0Degrees=THREE.MathUtils.radToDeg(Math.atan2(local.x,local.z)-Math.atan2(n.x,z))-LEVEL_CARRY_ARM[0];
 if(referenceJ0Degrees!==undefined)j0Degrees=referenceJ0Degrees+THREE.MathUtils.euclideanModulo(j0Degrees-referenceJ0Degrees+180,360)-180;
 return{j0Degrees,sumDegrees:THREE.MathUtils.radToDeg(theta)};
}
export function missionLevelCarryAngles(s:MissionState):SevenAngles{
 const head=missionLevelCamera(s,missionJ0(s)),delta=head.sumDegrees-transmitter.cameraOpticalAxis.restPitchDegrees;
 return[head.j0Degrees,LEVEL_CARRY_ARM[0],LEVEL_CARRY_ARM[1],head.sumDegrees-LEVEL_CARRY_ARM[1],LEVEL_CARRY_ARM[3],LEVEL_CARRY_ARM[4]-delta,LEVEL_CARRY_ARM[5]];
}
/** Separate empty travel from the previously verified ore-carrying posture. */
export function missionEmptyTravelAngles(contract:MotionContract,s:MissionState):SevenAngles{
 return emptyTravelAngles(contract,s.body,s.heading,missionLevelCarryAngles(s),s.silver.some(status=>status===2));
}
export let SILVER_PICKUP_GRIPS=[new THREE.Quaternion(),new THREE.Quaternion()],STORED_ORE_ROTATIONS=[new THREE.Quaternion(),new THREE.Quaternion()];
export let SILVER_STORE_ROLLS=[0,0];
export let SILVER_PICKUP_GRIP=SILVER_PICKUP_GRIPS[0],STORED_ORE_ROTATION=STORED_ORE_ROTATIONS[0],SILVER_TOP_GRIP=new THREE.Quaternion();
export let SILVER_REGRASP={outward:v(0,0,1),rotation:new THREE.Quaternion().setFromAxisAngle(up,Math.PI)};
export function configureSilverGrasps(data:{pickupGrip:number[][];storedRotation:number[][];storeRoll:number[];retrieval:{outward:number[];rotation:number[];grip:number[]}}){SILVER_PICKUP_GRIPS=data.pickupGrip.map(q=>new THREE.Quaternion().fromArray(q));STORED_ORE_ROTATIONS=data.storedRotation.map(q=>new THREE.Quaternion().fromArray(q));SILVER_STORE_ROLLS=data.storeRoll??[0,0];SILVER_PICKUP_GRIP=SILVER_PICKUP_GRIPS[0];STORED_ORE_ROTATION=STORED_ORE_ROTATIONS[0];SILVER_TOP_GRIP=new THREE.Quaternion().fromArray(data.retrieval.grip);SILVER_REGRASP={outward:new THREE.Vector3().fromArray(data.retrieval.outward),rotation:new THREE.Quaternion().fromArray(data.retrieval.rotation)};}
const storeTool=(i:number,height=0)=>store(i).add(v(0,height+.1032,0));
const silverKeys:{t:number;p:THREE.Vector3;n?:THREE.Vector3;r?:THREE.Quaternion}[]=[
 {t:6,p:READY_SILVER.position},{t:7,p:SILVER_LOCAL[0].clone().add(v(0,.28,0))},{t:8,p:SILVER_LOCAL[0].clone().add(v(0,.1002,0))},{t:8.6,p:SILVER_LOCAL[0].clone().add(v(0,.1002,0))},
 {t:9.6,p:SILVER_LOCAL[0].clone().add(v(0,.36,0))},{t:10.5,p:v(-.32,.60,.22)},{t:11.6,p:storeTool(0,.07)},{t:12.6,p:storeTool(0)},{t:13,p:storeTool(0)},
 {t:13.8,p:storeTool(0,.07)},{t:14.3,p:v(-.32,.60,.20)},{t:15,p:SILVER_LOCAL[1].clone().add(v(0,.28,0))},{t:15.8,p:SILVER_LOCAL[1].clone().add(v(0,.1002,0))},{t:16.3,p:SILVER_LOCAL[1].clone().add(v(0,.1002,0))},
 {t:17.3,p:SILVER_LOCAL[1].clone().add(v(0,.36,0))},{t:18.3,p:v(.32,.60,.22)},{t:19.3,p:storeTool(1,.07)},{t:20.3,p:storeTool(1)},{t:20.8,p:storeTool(1)},{t:21.6,p:storeTool(1,.07)},{t:22.2,p:v(.32,.60,.22)},{t:23,p:READY_SILVER.position},
];
const routeKeys=[
 {t:0,p:v(11,0,1.6),h:-90},{t:2,p:v(9.7,0,1.4),h:-90},{t:4,p:v(7.1,0,1.4),h:-90},{t:6,p:v(4.935,.003,1.19),h:-90},{t:23,p:v(4.935,.003,1.19),h:-90},
 {t:24.4,p:v(5.014333,.003,.634667),h:-90},{t:26,p:v(5.105,0,0),h:-90},{t:40,p:v(3.505,.302878,0),h:-90},
 {t:41.4,p:v(2.25,.302878,.55),h:-115},{t:43,p:v(0,.302878,-.18).applyMatrix4(GOLD_FRAME),h:-135},
 ...returnRoute.keys.map(k=>({t:k.t,p:new THREE.Vector3().fromArray(k.p),h:k.h})),{t:80,p:v(12.04,.003,-6.545),h:-270},
];
function route(t:number){let i=routeKeys.findIndex(k=>k.t>=t);if(i<=0)i=t<=0?1:routeKeys.length-1;const a=routeKeys[i-1],b=routeKeys[i],u=ease((t-a.t)/(b.t-a.t));return {position:a.p.clone().lerp(b.p,u),heading:rad(THREE.MathUtils.lerp(a.h,b.h,u))};}
export const worldMap=(p:THREE.Vector3)=>[(10.5+773*(.5+p.x/28))/795,(11+414*(.5+p.z/15))/438];
export const MAP_ROUTE=routeKeys.map(k=>worldMap(k.p));
export function missionMapProgress(t:number){let i=routeKeys.findIndex(k=>k.t>=t);if(i<=0)i=1;return i-1+ease((t-routeKeys[i-1].t)/(routeKeys[i].t-routeKeys[i-1].t));}
const integralEase=(u:number)=>{u=clamp(u);return 2.5*u**4-3*u**5+u**6;};
const spinRise=.42,spinFall=1.4,spinDuration=SPIN_STOP-SPIN_START;
const spinTurns=Math.round(THREE.MathUtils.degToRad(430)*(spinDuration-(spinRise+spinFall)/2)/(2*Math.PI));
export const SPIN_PEAK_SPEED=spinTurns*2*Math.PI/(spinDuration-(spinRise+spinFall)/2);
function spinAngle(t:number){const s=t-SPIN_START,w=SPIN_PEAK_SPEED;if(s<=0)return 0;if(s<spinRise)return w*spinRise*integralEase(s/spinRise);if(s<spinDuration-spinFall)return w*(s-spinRise/2);if(s<spinDuration){const u=(s-spinDuration+spinFall)/spinFall;return w*(spinDuration-spinFall-spinRise/2+spinFall*(u-integralEase(u)));}return spinTurns*2*Math.PI;}
export const STAIR_UNLOAD_START=36.05,STAIR_RECOVERY_START=36.7,STAIR_RECOVERY_END=39.8;
export const STAIR_EXIT_OFFSET=.30;
// Prepare only after parking. Recovery overlaps every axis, ending before travel.
export const missionRearTurn=(t:number)=>180*ease((t-26)/1.0)*(1-ease((t-STAIR_RECOVERY_START)/(STAIR_RECOVERY_END-STAIR_RECOVERY_START)));
export const missionWaistTurn=(t:number)=>180*ease((t-27.05)/.85)*(1-ease((t-STAIR_RECOVERY_START)/2.65));
export function missionJ0(s:MissionState){const rear=missionRearTurn(s.storyTime);
 // This short omnidirectional transfer deliberately keeps the entire upper
 // assembly facing forward instead of chasing the lateral travel direction.
 if(s.storyTime>=21.6&&s.storyTime<26)return UPRIGHT_J0;
 // Keep the actual J0 carrier's projected forward vector along velocity, even
 // while its omnidirectional chassis turns or follows a banked road.
 const orientation=new THREE.Matrix4().makeRotationY(s.yaw).multiply(new THREE.Matrix4().makeRotationX(s.pitch)).multiply(new THREE.Matrix4().makeRotationZ(s.roll)),right=new THREE.Vector3(1,0,0).transformDirection(orientation),front=new THREE.Vector3(0,0,1).transformDirection(orientation),dx=Math.sin(s.gimbalHeading),dz=Math.cos(s.gimbalHeading);
 const a=right.x*dz-right.z*dx,b=front.x*dz-front.z*dx,angle=Math.atan2(-b,a);
 const normal=UPRIGHT_J0+rear+THREE.MathUtils.radToDeg(angle);
 return missionUsesLevelCarry(s)?missionLevelCamera(s,normal).j0Degrees:normal;
}
function stationPath(points:StationParameters[],u:number){
 const lengths=points.slice(1).map((p,i)=>Math.max(...Object.keys(p).map(k=>Math.abs(p[k as keyof StationParameters]-points[i][k as keyof StationParameters])))),total=lengths.reduce((a,b)=>a+b,0);let d=clamp(u)*total;
 for(let i=0;i<lengths.length;i++){if(d<=lengths[i])return stationBlend(points[i],points[i+1],ease(d/lengths[i]));d-=lengths[i];}return points.at(-1)!;
}
export const STATION_FIRST_MOVE_START=62.15,STATION_FIRST_READY=63.05;
export function stationAt(t:number):StationParameters{
 if(t<STATION_FIRST_MOVE_START)return STATION_INITIAL;
 if(t<STATION_FIRST_READY)return stationBlend(STATION_INITIAL,STATION_A,ease((t-STATION_FIRST_MOVE_START)/(STATION_FIRST_READY-STATION_FIRST_MOVE_START)));
 if(t<67)return STATION_A;
 if(t<68.6)return stationPath(recovery.segments.toDumpA,(t-67)/1.6);
 if(t<69.2)return STATION_DUMP;
 if(t<71.4)return stationPath(recovery.segments.toB,(t-69.2)/2.2);
 if(t<75.4)return STATION_B;
 if(t<77)return stationPath(recovery.segments.toDumpB,(t-75.4)/1.6);
 return STATION_DUMP_B;
}
export function missionState(time:number):MissionState{
 const physical=Math.max(0,Math.min(MISSION_DURATION,time)),t=storyTime(physical),r=route(t);let position=r.position,heading=r.heading,gimbalHeading=heading,speed=0,pitch=0,roll=0,lift=0,tool:MissionTarget|null=null,oreMode='travel',climb=0,load=[0,0,0],road=[0,0,0],wheelOffsets=[0,0,0,0];
 const chapter=t<6?0:t<26?1:t<40?2:t<50.8?3:t<54?4:t<62?5:t<79?6:7,silver=[0,0];let gold=0;
 function travel(plan:{fps:number;samples:number[][];suspension:number[][];road:number[][];wheels:number[][]},elapsed:number){const f=clamp(elapsed/((plan.samples.length-1)/plan.fps))*(plan.samples.length-1),i=Math.min(Math.floor(f),plan.samples.length-2),u=f-i,a=plan.samples[i],b=plan.samples[i+1],p=a.map((v,k)=>THREE.MathUtils.lerp(v,b[k],u));position=new THREE.Vector3(...p.slice(0,3) as [number,number,number]);pitch=p[3];roll=p[4];heading=p[5];gimbalHeading=p[6];speed=p[7];load=plan.suspension[i].map((v,k)=>THREE.MathUtils.lerp(v,plan.suspension[i+1][k],u));road=plan.road[i].map((v,k)=>THREE.MathUtils.lerp(v,plan.road[i+1][k],u));wheelOffsets=plan.wheels[i].map((v,k)=>THREE.MathUtils.lerp(v,plan.wheels[i+1][k],u));
  const smooth=travelSample(plan,elapsed);position=smooth.position;
  if(smooth.velocity.x*smooth.velocity.x+smooth.velocity.z*smooth.velocity.z>1e-24)gimbalHeading=Math.atan2(smooth.velocity.x,smooth.velocity.z);
  else if(elapsed<.001)gimbalHeading=travelInitialHeading(plan);
 }
 if(t<6)travel(returnRoute.travel.departure,physical);
 if(t>=23&&t<26){
  const plan=returnRoute.travel.toSteps,duration=publicTime(26)-publicTime(23),u=clamp((physical-publicTime(23))/duration),a=new THREE.Vector3(...plan.samples[0].slice(0,3) as [number,number,number]),b=new THREE.Vector3(...plan.samples.at(-1)!.slice(0,3) as [number,number,number]);
  speed=a.distanceTo(b)*30*u*u*(1-u)*(1-u)/duration;position=a.lerp(b,ease(u));heading=plan.samples[0][5];gimbalHeading=heading;
 }
 if(t>=40&&t<43){travel(returnRoute.travel.toGold,physical-publicTime(40));position=missionToGoldPosition(physical-publicTime(40));}
  if(t>=6&&t<23){const roll=SILVER_STORE_ROLLS[0]*ease((t-10.5)/1.1)*(1-ease((t-13)/.8))+SILVER_STORE_ROLLS[1]*ease((t-18.3)/1.0)*(1-ease((t-20.8)/.8));tool={...transformTarget(path(silverKeys,t),SILVER_FRAME),normalOnly:true,fixedRoll:roll};if(t>=21.6)tool=null;silver[0]=t<8.5?0:t<12.9?1:2;silver[1]=t<16.15?0:t<20.6?1:2;oreMode='silver';}
 if(t>=23)silver[0]=silver[1]=2;
 if(t>=26&&t<40){
  // Source carriage is at60.28246mm, with7..120mm travel. Raising it to7mm
  // raises the second rack's front support to the first200mm ledge.
  const firstUp=-.05328246,secondUp=firstUp+.05,support=firstUp+.1;
  const p=v(0,.003,0);
  lift=firstUp*ease((t-26)/1.0);p.z=.32*ease((t-27)/.8);
  if(t>=29.1){p.y=THREE.MathUtils.lerp(.003,.203,ease((t-29.1)/1.4));lift=THREE.MathUtils.lerp(firstUp,support,ease((t-29.1)/1.4));}
  if(t>=30.5){p.z=THREE.MathUtils.lerp(.32,.79,ease((t-30.5)/1.9));lift=THREE.MathUtils.lerp(support,secondUp,ease((p.z-.52)/.23));}
  if(t>=32.4){p.y=THREE.MathUtils.lerp(.203,.302878,ease((t-32.4)/1.7));lift=THREE.MathUtils.lerp(secondUp,support,ease((t-32.4)/1.7));}
  if(t>=34.1)p.z=THREE.MathUtils.lerp(.79,1.30,ease((t-34.1)/1.85));
  if(t>=STAIR_UNLOAD_START)lift=THREE.MathUtils.lerp(support,0,ease((t-STAIR_UNLOAD_START)/(STAIR_RECOVERY_START-STAIR_UNLOAD_START)));
  position=p.clone().applyMatrix4(STEP_FRAME);climb=t-26;
  // Rear rollers remain on the original flat ground until all four main tyre
  // contact points are past the second lip. Their last loaded point stays well
  // behind the first lip; the body pauses before this support is unloaded.
  if(t>=29.1&&t<STAIR_RECOVERY_START){
   const contact=v(0,.043,Math.min(p.z-.68,.535));
   if(t>=STAIR_UNLOAD_START)contact.y=THREE.MathUtils.lerp(.043,.52,ease((t-STAIR_UNLOAD_START)/(STAIR_RECOVERY_START-STAIR_UNLOAD_START)));
   const head=v(0,Math.sin(rad(20)),-Math.cos(rad(20))),r=new THREE.Quaternion().setFromAxisAngle(up,Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(v(1,0,0),rad(-20)));
   tool={...transformTarget({position:contact.clone().addScaledVector(head,.0705),rotation:r},STEP_FRAME),normalOnly:true,fixedRoll:0};
  }
  oreMode='climb';
 }
 if(t>=43&&t<54){
  position=v(0,.302878,-.18).applyMatrix4(GOLD_FRAME);heading=rad(-135);gimbalHeading=heading;
  const reach=v(.040237,.652878,.799801),raised=reach.clone().add(v(0,.045));
  tool=transformTarget(path([{t:43,p:READY_GOLD.position,n:forward},{t:45,p:v(reach.x,reach.y,.56),n:forward},{t:48,p:reach,n:forward},{t:49.2,p:reach,n:forward},{t:49.9,p:raised,n:forward},{t:51.8,p:v(reach.x,raised.y,.27),n:forward},{t:53.2,p:CARRY_GOLD.position,r:CARRY_GOLD.rotation},{t:54,p:CARRY_GOLD.position,r:CARRY_GOLD.rotation}],t),GOLD_FRAME);
  if(t>51.80001)tool=null;
  gold=t<49.15?0:1;oreMode='gold';
 }
 if(t>=54)gold=1;
 if(t>=54&&t<=62)travel(returnTravelPlan,physical-publicTime(54));
  if(t>=62){const closer=.03*ease((t-62.3)/1.1)*(1-ease((t-65.4)/1.4))+.03*ease((t-71.4)/.8)*(1-ease((t-73.7)/1.5));position.x=12.04+closer-.18*ease((t-70)/.5)*(1-ease((t-71.4)/.8));position.z=-6.545+.30*(1-ease((t-66.3)/.7))-.30*ease((t-70.6)/1.1)*(1-ease((t-74.6)/.7));}
 const stationPose=stationAt(t),slot=stationSlotMatrix(stationPose,STATION_WORLD);
 if(t>=62){
   // Both receiving poses are fixed. While the station recovers, the tool uses
  // the receiving matrix it just left, never chases the moving slot.
  const slotA=stationSlotMatrix(STATION_A,STATION_WORLD),slotB=stationSlotMatrix(STATION_B,STATION_WORLD);
  function points(m:THREE.Matrix4){const quat=new THREE.Quaternion().setFromRotationMatrix(m),n=forward.clone().applyQuaternion(quat).negate(),seated=v(0,-.0199,-.106).applyMatrix4(m),p=seated.clone().addScaledVector(n,-.1002);return {p,away:p.clone().addScaledVector(n,-.235),r:quat.multiply(new THREE.Quaternion().setFromAxisAngle(up,Math.PI))};}
  const a=points(slotA),b=points(slotB),st=store(0),w=(p:THREE.Vector3)=>p.clone().applyMatrix4(EXCHANGE_FRAME),carry=transformTarget({position:v(-.3010817087779815,.5520391633996279,.4179182363222997),rotation:carryRotation},EXCHANGE_FRAME),front=transformTarget({position:v(-.0010817087779815,.5520391633996279,.4179182363222997),rotation:carryRotation},EXCHANGE_FRAME);

   const outward=SILVER_REGRASP.outward,regrab=st.clone().addScaledVector(outward,.1002).add(v(0,.003)),topQ=new THREE.Quaternion().setFromRotationMatrix(EXCHANGE_FRAME).multiply(SILVER_REGRASP.rotation),liftQ=topQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(v(1,0,0),rad(5)));
  const keys:{t:number;p:THREE.Vector3;r?:THREE.Quaternion}[]=[{t:62,p:carry.position,r:carry.rotation},{t:STATION_FIRST_READY,p:carry.position,r:carry.rotation},{t:63.4,p:a.away,r:a.r},{t:64.8,p:a.p,r:a.r},{t:65.35,p:a.p,r:a.r},{t:66.2,p:a.away,r:a.r},{t:66.8,p:front.position,r:front.rotation},
    {t:67.5,p:w(regrab.clone().add(v(0,.08))),r:topQ},{t:68.8,p:w(regrab),r:topQ},{t:69.2,p:w(regrab),r:topQ},{t:70,p:w(regrab.clone().add(v(0,.04))),r:liftQ},{t:70.8,p:w(v(-.30,.72,.28)),r:b.r},{t:72.2,p:b.away,r:b.r},{t:73,p:b.p,r:b.r},{t:73.65,p:b.p,r:b.r},{t:74.5,p:b.away,r:b.r},{t:75.2,p:front.position,r:front.rotation},{t:78,p:front.position,r:front.rotation},{t:80,p:front.position,r:front.rotation}];
  // Downward pickup orientations must use this action's world basis too.
  const downWorld=new THREE.Quaternion().setFromRotationMatrix(EXCHANGE_FRAME).multiply(rotation(down));keys.forEach(k=>{if(!k.r)k.r=downWorld;});
  tool=path(keys,t);gold=t<65.3?1:t<69?2:3;silver[0]=t<69.1?2:t<73.6?1:3;oreMode='exchange';
  if(t<63.40001||t>=75.19999||(t>66.20001&&t<66.8)||(t>74.50001&&t<75.2)||Object.values(armTransfers.segments).some(p=>t>p.start+.00001&&t<p.end-.00001))tool=null;
 }
 // Travel follows its actual path tangent except the explicitly fixed-heading
 // lateral silver-to-stairs transfer. Arrival arm changes wait until stopped.
 if(t<6){const u=missionTravelArrivalBlend({storyTime:t,time:physical});gimbalHeading=blendHeading(gimbalHeading,heading,u);}
 if(t>=21.6&&t<26)gimbalHeading=heading;
 if(t>=STAIR_RECOVERY_START&&t<40)gimbalHeading=blendHeading(heading,missionToGoldHeading(0),ease((t-STAIR_RECOVERY_START)/(STAIR_RECOVERY_END-STAIR_RECOVERY_START)));
 if(t>=40&&t<43){const u=missionTravelArrivalBlend({storyTime:t,time:physical}),elapsed=physical-publicTime(40);gimbalHeading=blendHeading(missionToGoldHeading(elapsed),heading,u);}
 const spin=spinAngle(physical),yaw=heading+spin;
 const wheelBody=new THREE.Matrix4().makeTranslation(position.x,position.y,position.z).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationX(pitch)).multiply(new THREE.Matrix4().makeRotationZ(roll)).multiply(CANONICAL);
 const localLoad=new THREE.Vector3(load[1],0,load[2]).applyAxisAngle(up,-yaw),suspension=[load[0],THREE.MathUtils.clamp(-localLoad.z*.0045,-.025,.025),THREE.MathUtils.clamp(localLoad.x*.0045,-.025,.025)];pitch+=suspension[1]+road[1];roll+=suspension[2]+road[2];
 const body=new THREE.Matrix4().makeTranslation(position.x,position.y+suspension[0]+road[0],position.z).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationX(pitch)).multiply(new THREE.Matrix4().makeRotationZ(roll)).multiply(CANONICAL);
 const impact=0;
 return {time:physical,storyTime:t,gimbalHeading,speed,suspension,road,wheelOffsets,chapter,body,wheelBody,position,heading,yaw,spin,pitch,roll,lift,drive:climb?position.clone().applyMatrix4(STEP_FRAME.clone().invert()).z:0,target:tool,silver,gold,oreMode,map:worldMap(position),slot,stationPose,impact,climb,fade:Math.min(ease(physical/.7),1-ease((physical-publicTime(79.2))/.8))};
}
export function missionTarget(contract:MotionContract,s:MissionState):MissionTarget|null{return s.target;}

export function toolPose(contract:MotionContract,q:SevenAngles,body=new THREE.Matrix4()):MissionTarget{
 const joint=contract.joints.find(j=>j.name==='J6')!,axis=new THREE.Vector3().fromArray(joint.axis);
 const matrix=body.clone().multiply(armMotionMatrices(contract,q).get('link_6')!);
 const rotation=new THREE.Quaternion().setFromRotationMatrix(matrix).multiply(new THREE.Quaternion().setFromUnitVectors(forward,axis));
 return {position:new THREE.Vector3().fromArray(joint.point_m).addScaledVector(axis,ARM_TOOL_FACE_OFFSET_M).applyMatrix4(matrix),rotation};
}
function linearSolve(a:number[][],b:number[]){
 const m=a.map((r,i)=>[...r,b[i]]),n=b.length;
 for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;[m[i],m[pivot]]=[m[pivot],m[i]];if(Math.abs(m[i][i])<1e-12)return Array(n).fill(0);const d=m[i][i];for(let k=i;k<=n;k++)m[i][k]/=d;for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k];}}
 return m.map(r=>r[n]);
}
const error=(a:MissionTarget,b:MissionTarget,normalOnly=false)=>{
 const p=b.position.clone().sub(a.position),q=normalOnly?new THREE.Quaternion().setFromUnitVectors(forward.clone().applyQuaternion(a.rotation),forward.clone().applyQuaternion(b.rotation)):b.rotation.clone().multiply(a.rotation.clone().invert());if(q.w<0){q.x*=-1;q.y*=-1;q.z*=-1;q.w*=-1;}const k=2*.24;
 return [p.x,p.y,p.z,q.x*k,q.y*k,q.z*k];
};
export function solveTool(contract:MotionContract,body:THREE.Matrix4,wanted:MissionTarget,seed:SevenAngles):{angles:SevenAngles;error:number}{
 const q=[...seed] as SevenAngles;
 if(wanted.normalOnly)q[6]=wanted.fixedRoll??0;
 q[5]=THREE.MathUtils.clamp(THREE.MathUtils.euclideanModulo(q[5]+180,360)-180,-121.3716516466,118.6283483533);
 for(let iteration=0;iteration<65;iteration++){
  const p=toolPose(contract,q,body),e=error(p,wanted,wanted.normalOnly),norm=Math.hypot(...e);if(norm<.00025)break;
  const columns:number[][]=[];
  const count=wanted.normalOnly?5:6;
  for(let j=1;j<=count;j++){const qj=[...q] as SevenAngles;qj[j]+=.08;const d=error(p,toolPose(contract,qj,body),wanted.normalOnly);columns.push(d.map(x=>x/.08));}
  const bias=Array.from({length:count},(_,i)=>!wanted.normalOnly&&[3,5].includes(i)?1e-9*Math.exp(-(((q[5]+1.37)/20)**2)):0);
  const normal=Array.from({length:count},(_,i)=>Array.from({length:count},(_,j)=>columns[i].reduce((s,x,k)=>s+x*columns[j][k],0)+(i===j?.00000015+bias[i]:0)));
  const rhs=columns.map((c,i)=>c.reduce((s,x,k)=>s+x*e[k],0)+bias[i]*(THREE.MathUtils.euclideanModulo(-q[i+1]+180,360)-180)),delta=linearSolve(normal,rhs);
  for(let j=0;j<count;j++)q[j+1]+=Math.max(-7,Math.min(7,delta[j]));
  q[5]=THREE.MathUtils.clamp(q[5],-121.3716516466,118.6283483533);
 }
 return {angles:q,error:Math.hypot(...error(toolPose(contract,q,body),wanted,wanted.normalOnly))};
}
export function deriveSilverGrasps(contract:MotionContract){
 const body=SILVER_FRAME.clone().multiply(new THREE.Matrix4().makeTranslation(0,.003,0)).multiply(CANONICAL),upperQ=new THREE.Quaternion().setFromRotationMatrix(body.clone().multiply(armMotionMatrices(contract,[UPRIGHT_J0,0,0,0,0,0,0]).get('j0_carrier')!)),pickupGrip:THREE.Quaternion[]=[],storedRotation:THREE.Quaternion[]=[],storeRoll:number[]=[];
 for(let i=0;i<2;i++){const want=(p:THREE.Vector3)=>({...transformTarget(target(p),SILVER_FRAME),normalOnly:true,fixedRoll:0}),pick=solveTool(contract,body,want(SILVER_LOCAL[i].clone().add(v(0,.1002))),[UPRIGHT_J0,i?18:-18,96,-48,0,44,0]),placed=solveTool(contract,body,want(storeTool(i)),[UPRIGHT_J0,i?156:-156,63,-71,0,100,0]);if(pick.error>.001||placed.error>.001)throw new Error('Top storage contact has no solution');const p=toolPose(contract,pick.angles,body),s=toolPose(contract,placed.angles,body),grip=p.rotation.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(up,Math.PI));pickupGrip.push(grip);storedRotation.push(upperQ.clone().invert().multiply(s.rotation).multiply(grip));}
 for(let i=0;i<2;i++){const f=forward.clone().applyQuaternion(storedRotation[i]),yaw=Math.atan2(f.x,f.z)*180/Math.PI,aligned=Math.round(yaw/90)*90;storeRoll.push(yaw-aligned);storedRotation[i]=new THREE.Quaternion().setFromAxisAngle(up,rad(aligned));}
  // Reacquire the stored silver ore through its top face. The grip is derived
  // from its stored orientation, so changing ownership cannot rotate the ore.
  const outward=up.clone(),r=rotation(down),grip=r.clone().invert().multiply(storedRotation[0]);
 return {pickupGrip:pickupGrip.map(q=>q.toArray()),storedRotation:storedRotation.map(q=>q.toArray()),storeRoll,retrieval:{outward:outward.toArray(),rotation:r.toArray(),grip:grip.toArray()}};
}
