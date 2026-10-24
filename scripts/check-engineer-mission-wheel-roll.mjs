/** Check signed no-slip rolling and the retained J7=q5-q6 CAD differential.
 * Reads the existing mission trajectory; never rebuilds or changes it. */
import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import * as M from '../materials/models/derived/inputs/engineer-mission/motion.mjs';

const temporary=resolve('tmp');await mkdir(temporary,{recursive:true});
const bundle=resolve(temporary,'mission-wheel-roll-check.mjs');
await build({entryPoints:['scripts/authoring/engineer-mission/engineer-mission-wheel-roll.ts'],outfile:bundle,bundle:true,packages:'external',format:'esm',platform:'node'});
const {applyMissionWheelRoll}=await import(pathToFileURL(bundle).href+'?'+Date.now());
const [meta,tr]=await Promise.all(['materials/models/derived/web/arm-parts.json','materials/models/derived/inputs/engineer-mission/trajectory.json'].map(p=>readFile(p,'utf8').then(JSON.parse)));
M.configureSilverGrasps(JSON.parse(await readFile('materials/models/derived/inputs/engineer-mission/grasps.json','utf8')));
const result=applyMissionWheelRoll(meta.motion,tr.samples,tr.fps,t=>M.missionState(t));
const contact=result.report.contacts.find(c=>c.time>M.publicTime(30.5));
if(!contact)throw new Error('No horizontal 80 mm wheel contact in the climb');
const index=Math.round(contact.time*tr.fps),base=M.missionState(contact.time),q=tr.samples[index];
const axle=new T.Vector3().fromArray(contact.axis),tangent=axle.clone().cross(new T.Vector3(0,1,0)).normalize();
const cupBefore=M.toolPose(meta.motion,q,base.body),checks=[];
for(const sign of [1,-1]){
 const fps=60,length=.48,frames=61,source=Array.from({length:frames},()=>[...q]);
 const stateAt=time=>{const body=base.body.clone(),displacement=tangent.clone().multiplyScalar(sign*length*time);body.elements[12]+=displacement.x;body.elements[13]+=displacement.y;body.elements[14]+=displacement.z;return {body,climb:1};};
 const rolled=applyMissionWheelRoll(meta.motion,source,fps,stateAt),last=rolled.samples.at(-1),angles=M.armMatrices(meta.motion,last);
 const expected=sign*length/.04,actual=T.MathUtils.degToRad((last[5]-last[6])-(q[5]-q[6]));
 const cupAfter=M.toolPose(meta.motion,last,base.body),normalBefore=new T.Vector3(0,0,1).applyQuaternion(cupBefore.rotation),normalAfter=new T.Vector3(0,0,1).applyQuaternion(cupAfter.rotation);
 const row={sign,travel:sign*length,expectedWheelRadians:expected,actualWheelRadians:actual,angleError:Math.abs(actual-expected),cupNormalError:normalBefore.distanceTo(normalAfter),slip:rolled.report.maxRollingSlip};
 checks.push(row);
 if(row.angleError>1e-7||row.cupNormalError>1e-8||row.slip>1e-10)throw new Error('Wheel rolling/direction regression '+JSON.stringify(row));
}
const report={passed:true,actualClimb:{...result.report,contacts:undefined},directionChecks:checks};
if(result.report.contactSamples<100||result.report.maxRollingSlip>1e-10||Math.abs(result.report.finalCupPhaseErrorDegrees)>1e-7)throw new Error('Climb contact/phase regression '+JSON.stringify(report));
console.log(JSON.stringify(report,null,2));
