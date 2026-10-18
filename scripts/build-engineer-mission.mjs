import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const out=resolve('materials/models/derived/inputs/engineer-mission');
await mkdir(out,{recursive:true});
await build({entryPoints:['src/scripts/lib/engineer-mission-motion.ts'],outfile:resolve(out,'motion.mjs'),bundle:true,format:'esm',platform:'node'});
await build({entryPoints:['src/scripts/lib/engineer-station-rig.ts'],outfile:resolve(out,'station-rig.mjs'),bundle:true,format:'esm',platform:'node'});
const motion=await import(pathToFileURL(resolve(out,'motion.mjs')).href+'?'+Date.now());
const THREE=await import('three');
const meta=JSON.parse(await readFile('materials/models/derived/web/arm-parts.json','utf8'));
const grasps=motion.deriveSilverGrasps(meta.motion);motion.configureSilverGrasps(grasps);await writeFile(resolve(out,'grasps.json'),JSON.stringify(grasps));
const samples=[],errors=[];
const transfers=Object.values(JSON.parse(await readFile('materials/models/derived/rm2025-field/models/mission-arm-transfers.json','utf8')).segments);
const fps=60,duration=motion.MISSION_DURATION;
const stateAt=t=>motion.missionState(t);
const seedAt=t=>[motion.missionJ0(stateAt(t)),0,110,-90,0,-70,0];
function solved(t,seed=seedAt(t)){const s=stateAt(t);return motion.solveTool(meta.motion,s.body,motion.missionTarget(meta.motion,s),seed).angles;}
const readyQ=solved(motion.publicTime(6),[motion.UPRIGHT_J0,0,110,-90,0,45,0]),goldQ=solved(motion.publicTime(43)),supportQ=solved(motion.publicTime(29.1),[motion.UPRIGHT_J0+180,-180,-5,-265,0,111,0]);
// A's two-riser reverse elbow keeps the upper/head yaw forward while J0 reverses.
// J3=-265deg is the +95deg elbow branch, unwrapped from its -85deg folded pose.
const foldQ=supportQ.slice(1);foldQ[0]+=180;foldQ[2]+=180;foldQ[4]-=180;
const unfoldedQ=supportQ.slice(1);unfoldedQ[0]+=180;
const stairHomeQ=readyQ.slice(1);
const carryState=stateAt(motion.publicTime(53.9)),carryQ=motion.missionLevelCarryAngles(carryState);
const approachState=stateAt(motion.publicTime(63.4)),approachQ=solved(motion.publicTime(63.401),[motion.missionJ0(approachState),3,100,-127,90,98,-80]);
const frontA=motion.missionLevelCarryAngles(stateAt(motion.publicTime(78))),frontB=frontA;
let q=[motion.UPRIGHT_J0,0,0,0,0,0,0],retract=null,silverEnd=null,carryHold=null,withdrawHold=null,clearA=null,clearB=null;
function blend(a,b,u,short=false){return a.map((x,i)=>{const delta=short&&[0,3,5].includes(i)?((b[i]-x+540)%360)-180:b[i]-x;return x+delta*motion.ease(u);});}
const flipKeys=[{t:26,q:stairHomeQ},{t:26.15,q:stairHomeQ},{t:27.05,q:foldQ},{t:29.1,q:unfoldedQ}];
for(let n=0;n<=duration*fps;n++){
 const previous=[...q];
 const physical=n/fps,state=stateAt(physical),t=state.storyTime,wanted=motion.missionTarget(meta.motion,state),j0=motion.missionJ0(state),rear=motion.missionRearTurn(t),waist=motion.missionWaistTurn(t);
 const transfer=transfers.find(p=>t>=p.start&&t<p.end);
 if(transfer){
  const points=transfer.points;
  if(transfer.times){
   // The rear ore first clears the bank, then the waist turns. The short hold
   // keeps that motion outside the station while it finishes turning to B.
   let i=transfer.times.findIndex(value=>value>=t);if(i<=0)i=1;
   q=[j0,...blend(points[i-1],points[i],(t-transfer.times[i-1])/(transfer.times[i]-transfer.times[i-1]))];
  }else{
   const lengths=points.slice(1).map((p,i)=>Math.max(...p.map((x,j)=>Math.abs(x-points[i][j]))));let d=(t-transfer.start)/(transfer.end-transfer.start)*lengths.reduce((a,b)=>a+b,0),i=0;
   while(i<lengths.length-1&&d>lengths[i])d-=lengths[i++];q=[j0,...blend(points[i],points[i+1],d/lengths[i])];
  }
 }
 else if(t<6)q=[j0,...blend([0,0,0,0,0,0],readyQ.slice(1),(t-4)/2)];
 else if(t>=23&&t<26){silverEnd??=[...q];q=[j0,...silverEnd.slice(1)];q[1]-=waist;}
 else if(t>=26&&t<29.1){let i=flipKeys.findIndex(k=>k.t>=t);if(i<=0)i=1;const a=flipKeys[i-1],b=flipKeys[i];q=[j0,...blend(a.q,b.q,(t-a.t)/(b.t-a.t))];q[1]-=waist;}
 else if(t>=36.8&&t<37.8){retract??=[...q];const aligned=retract.slice(1);aligned[0]+=180;q=[j0,...blend(aligned,stairHomeQ,(t-36.8),true)];q[1]-=waist;}
 else if(t>=37.8&&t<40){q=[j0,...stairHomeQ];q[1]-=waist;}
 else if(t>=40&&t<43)q=[j0,...blend(stairHomeQ,goldQ.slice(1),(t-40)/3)];
 else if(t>=51.8&&t<54){withdrawHold??=[...q];q=[j0,...blend(withdrawHold.slice(1),carryQ.slice(1),(t-51.8)/1.4,true)];}
 else if(t>=54&&t<motion.STATION_FIRST_READY)q=motion.missionLevelCarryAngles(state);
 else if(t>=motion.STATION_FIRST_READY&&t<63.4){const neutral=motion.missionLevelCarryAngles(state);q=[j0,...blend(neutral.slice(1),approachQ.slice(1),(t-motion.STATION_FIRST_READY)/(63.4-motion.STATION_FIRST_READY),true)];}
 else if(t>=66.2&&t<66.8){clearA??=[...q];q=[j0,...blend(clearA.slice(1),frontA.slice(1),(t-66.2)/.6,true)];}
 else if(t>=74.5&&t<75.2){clearB??=[...q];q=[j0,...blend(clearB.slice(1),frontB.slice(1),(t-74.5)/.7,true)];}
 else if(t>=75.2)q=motion.missionLevelCarryAngles(state);
 else {
  q[0]=j0;
  const result=motion.solveTool(meta.motion,state.body,wanted,q);q=result.angles;
  errors.push({t:physical,error:result.error});
 }
 for(const j of [1,4,6])q[j]=previous[j]+THREE.MathUtils.euclideanModulo(q[j]-previous[j]+180,360)-180;
 samples.push(q.map(x=>+x.toFixed(6)));
}
await writeFile(resolve(out,'trajectory.json'),JSON.stringify({fps,duration,samples,errors}));
await writeFile('materials/models/derived/rm2025-field/models/mission-timing.json',JSON.stringify({duration,chapters:motion.PHASE_TIMES,exchangeStart:motion.EXCHANGE_START,attackStart:motion.ATTACK_START,spinStart:motion.SPIN_START,spinStop:motion.SPIN_STOP,spinPeakDegreesPerSecond:motion.SPIN_PEAK_SPEED*180/Math.PI})+'\n');
console.log('IK samples',samples.length,'max error',Math.max(...errors.map(x=>x.error)),'>5mm',errors.filter(x=>x.error>.005).length);
const plugin={name:'unused-images',setup(b){b.onResolve({filter:/\.(png|jpe?g|webp|svg)$/},a=>({path:a.path,namespace:'unused',sideEffects:false}));b.onLoad({filter:/.*/,namespace:'unused'},()=>({contents:'export default "";',loader:'js'}));}};
await build({entryPoints:['src/scripts/engineer-mission-film.ts'],outfile:resolve(out,'film.js'),bundle:true,format:'esm',sourcemap:true,plugins:[plugin]});
await writeFile(resolve(out,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Engineer mission film</title><link rel="icon" href="data:,"><style>html,body{margin:0;background:#070d17}canvas{display:block;width:100vw;height:100vh;object-fit:contain}</style><canvas id="film"></canvas><script type="module" src="film.js"></script></html>');
console.log('Movie scene ready:',out);
