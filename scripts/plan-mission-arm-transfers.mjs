/** Rebuild the authored clear-space exchange transfers against actual CAD. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {loadMissionGeometry,crossing} from './mission-geometry.mjs';
import {classifyStationRobotHits} from './mission-contact-classification.mjs';
const g=await loadMissionGeometry(),M=process.env.MISSION_MOTION_MODULE?await import(pathToFileURL(resolve(process.env.MISSION_MOTION_MODULE)).href):g.M;
if(M!==g.M)M.configureSilverGrasps(M.deriveSilverGrasps(g.meta.motion));
const path='materials/models/derived/rm2025-field/models/mission-arm-transfers.json';
const previous=JSON.parse(await readFile(path,'utf8'));
const state=t=>M.missionState(M.publicTime(t));
const normalize=q=>q.slice(1).map((x,i)=>[0,3,5].includes(i)?T.MathUtils.euclideanModulo(x+180,360)-180:x);
function endpoint(t,seed){const s=state(t),wanted=s.target;if(!wanted)throw Error('No contact target at '+t);const result=M.solveTool(g.meta.motion,s.body,wanted,seed);if(result.error>.001)throw Error('Unreachable endpoint '+t+': '+result.error);return normalize(result.angles);}
// Solve the first retreat on the wrist branch reached by the actual approach,
// rather than replaying a stale pose from the former low carry position.
const rearA=endpoint(66.2,[M.missionJ0(state(66.2)),...previous.segments.rearApproach.points[0]]);
// Turn the arm-base J1 toward the rear bank. Keep the ordinary negative-elbow
// branch rather than reaching behind the chassis through an over-shoulder flip.
const rearSeed=[-156.46,63.34,-82.98,.40,111.46,-156.83];
const rearB=endpoint(67.5,[M.missionJ0(state(67.5)),...rearSeed]);
for(const i of [0,2,3,5])rearB[i]=rearA[i]+T.MathUtils.euclideanModulo(rearB[i]-rearA[i]+180,360)-180;
const silverA=endpoint(70,[M.missionJ0(state(70)),...rearB]);
for(const i of [0,2,3,5])silverA[i]=rearB[i]+T.MathUtils.euclideanModulo(silverA[i]-rearB[i]+180,360)-180;
const silverSeed=previous.segments.silverTransfer?.points.at(-1)??[-5.643165,109.316411,-151.899473,-83.248518,102.195352,65.867216];
const silverB=endpoint(72.2,[M.missionJ0(state(72.2)),...silverSeed]);
// Clear the rear bank with a level forearm, then yaw at a small chassis retreat.
// Lower into the neutral, horizontal-camera pose before waiting for station B.
const level=[0,45,M.LEVEL_CARRY_ARM[1]+M.LEVEL_CARRY_ARM[2]-45,0,95,0],rearLevel=[...level];rearLevel[0]=silverA[0];rearLevel[5]=silverA[5];
const withdrawA=endpoint(74.5,[M.missionJ0(state(74.5)),...previous.segments.withdrawB.points[0]]),clearState=state(74.8),bAway=state(74.5).target;
const clearTarget={position:bAway.position.clone().add(new T.Vector3(-.20,0,0)),rotation:bAway.rotation};
const clearResult=M.solveTool(g.meta.motion,clearState.body,clearTarget,[M.missionJ0(clearState),...withdrawA]);
if(clearResult.error>.001)throw Error('Unreachable second retreat '+clearResult.error);
const segments={rearApproach:{start:66.2,end:67.5,points:[rearA,rearB]},silverTransfer:{start:70,end:72.2,times:[70,70.35,71,71.25,71.4,72.2],points:[silverA,rearLevel,level,M.LEVEL_CARRY_ARM,M.LEVEL_CARRY_ARM,silverB]},withdrawB:{start:74.5,end:75.2,times:[74.5,74.8,75.2],points:[withdrawA,normalize(clearResult.angles),M.missionLevelCarryAngles(state(75.2)).slice(1)]}};
function pose(segment,t){const points=segment.points;let i,u;if(segment.times){i=segment.times.findIndex(k=>k>=t);if(i<=0)i=1;u=(t-segment.times[i-1])/(segment.times[i]-segment.times[i-1]);}else{i=1;u=(t-segment.start)/(segment.end-segment.start);}return points[i-1].map((x,k)=>T.MathUtils.lerp(x,points[i][k],M.ease(u)));}
const audit=[];
for(const [name,segment]of Object.entries(segments)){
 let checks=0;const count=Math.ceil((segment.end-segment.start)/.025);
 for(let n=0;n<=count;n++){
  const t=T.MathUtils.lerp(segment.start,segment.end,n/count),s=state(t),q=[M.missionJ0(s),...pose(segment,t)],bank=g.robotOres(s,q),station=classifyStationRobotHits(g,g.robotStation(s,q)).rigid;
  const moving=g.actors.filter(p=>['link_2','link_3','link_4','link_5','link_6','link_wheel','uwb'].includes(p.userData.group)||p.name==='armmission-transmitter'),fixed=g.actors.filter(p=>['chassis','j0_carrier','gimbal_context'].includes(p.userData.group)||p.userData.group.startsWith('main_')&&!p.userData.group.endsWith('tire')),self=[];
  for(const a of moving)for(const b of fixed)if(crossing(a,b))self.push({actor:a.name,other:b.name});
  if(bank.length||station.length||self.length)throw Error('CAD transfer collision '+JSON.stringify({name,t,bank,station,self}));
  if(name==='silverTransfer'){
   const tool=M.toolPose(g.meta.motion,q,s.body);g.ore.matrixWorld.compose(tool.position.clone().add(new T.Vector3(0,0,.1002).applyQuaternion(tool.rotation)),tool.rotation.clone().multiply(M.SILVER_TOP_GRIP),new T.Vector3(.98,.98,.98));
   const oreStation=g.groups.filter(group=>crossing(g.ore,group.mesh)).map(group=>group.key),oreRobot=g.actors.filter(actor=>crossing(g.ore,actor)).map(actor=>actor.name);
   if(oreStation.length||oreRobot.length)throw Error('Held ore collision '+JSON.stringify({name,t,oreStation,oreRobot}));
  }
  checks++;
 }
 audit.push({name,start:segment.start,end:segment.end,checks,storyStepMaximum:.025,hits:0});console.log('Validated',name,checks,'actual-CAD samples');
}
const output=process.env.MISSION_TRANSFERS_OUTPUT??path;
await writeFile(output,JSON.stringify({schema:3,source:'J1 rearward top-face silver pickup on the negative-elbow branch; five-degree post-contact wrist clearance, J1 return and clear-space retreats; exact arm/context/VT03/ore/station CAD triangles',oreContactToleranceMetres:.002,segments,audit},null,2)+'\n');
console.log('Saved',output);
