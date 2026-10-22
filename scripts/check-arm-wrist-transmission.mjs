/** Mechanical CAD/kinematic checks. Rendered legibility remains a separate gate. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as T from 'three';

const out='tmp/arm-wrist-transmission-check';await mkdir(out,{recursive:true});
await build({entryPoints:['src/scripts/lib/arm-study-transmission.ts','src/scripts/lib/arm-study-motion.ts'],outdir:out,outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'node',packages:'external'});
const W=await import(pathToFileURL(resolve(out,'arm-study-transmission.mjs')).href),K=await import(pathToFileURL(resolve(out,'arm-study-motion.mjs')).href);
const meta=JSON.parse(await readFile('materials/models/derived/web/arm-parts.json','utf8')),data=JSON.parse(await readFile('materials/models/derived/web/arm-wrist-transmission.json','utf8'));
const bytes=await readFile('materials/models/derived/web/arm-parts.glb'),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const specFor=source=>meta.parts.find(p=>p.members.some(m=>m.asset==='arm'&&m.index===source));
const packedBox=key=>{const n=gltf.nodes.find(n=>n.extras?.part_key===key),box=new T.Box3();for(const p of gltf.meshes[n.mesh].primitives){const a=gltf.accessors[p.attributes.POSITION];box.union(new T.Box3(new T.Vector3().fromArray(a.min),new T.Vector3().fromArray(a.max)));}return box;};
const center=source=>packedBox(specFor(source).key).getCenter(new T.Vector3());
const checks=[];function check(name,passed,evidence){checks.push({name,passed,evidence});if(!passed)console.error('FAIL',name,JSON.stringify(evidence));}
const axis=new T.Vector3().fromArray(data.evidence.axis),q=[31,-17,23,-29,42,-28,55],next=[...q];next[6]-=.01;
const before=K.armMotionMatrices(meta.motion,q),after=K.armMotionMatrices(meta.motion,next),worldAxis=axis.clone().transformDirection(before.get('link_4'));
function matrix(source,angles){const spec=specFor(source),m=K.armMotionMatrices(meta.motion,angles).get(spec.motion_group).clone(),extra=W.wristPartMotion(data,spec.key,angles);if(extra)m.multiply(extra);return m;}
function worldAngle(source,a,b){const r=new T.Quaternion().setFromRotationMatrix(matrix(source,b)).multiply(new T.Quaternion().setFromRotationMatrix(matrix(source,a)).invert());if(r.w<0)r.set(-r.x,-r.y,-r.z,-r.w);const vector=new T.Vector3(r.x,r.y,r.z),length=vector.length();return length?2*Math.atan2(length,r.w)*180/Math.PI*vector.dot(worldAxis)/length:0;}
const increments=Object.fromEntries([507,505,762,782,766,779,781,500,696,593,684].map(source=>[source,worldAngle(source,q,next)]));
check('38T external mesh reverses and 40T branches reverse back in the actual world axis',Math.abs(increments[507]+increments[505])<1e-6&&[500,696].every(source=>Math.abs(increments[source]+increments[source===500?593:684])<1e-6),increments);
check('Both shafts and keyed couplers share one signed phase',[505,762,782,766,779,781,500,696].every(source=>Math.abs(increments[source]-increments[762])<1e-6),increments);
check('Source transverse pitch distances match the named modules/teeth',data.evidence.meshPairs.every(p=>Math.abs(p.transverseDistanceMetres-p.pitchDiameterMetres)<.0001),data.evidence.meshPairs);
check('The two source shafts are coaxial within CAD tolerance',data.evidence.shaftCenters.every(p=>p.axisLineErrorMetres<.00005),data.evidence.shaftCenters);
check('Motor bodies and bearing spacers stay attached',[512,596,767].every(source=>W.wristPartMotion(data,specFor(source).key,q)===null),[512,596,767].map(source=>({source,key:specFor(source).key})));
const pitchNext=[...q];pitchNext[5]+=.01;
const pitchIn=worldAngle(683,q,pitchNext),pitchOut=worldAngle(680,q,pitchNext);
check('Open 21T pulleys have equal signed world angular displacement',Math.abs(pitchIn-.01)<1e-6&&Math.abs(pitchOut-.01)<1e-6,{pitchIn,pitchOut});

const sourceBeltBox=packedBox(data.belt.key),rebuiltBox=new T.Box3();
for(const station of data.belt.stations){const p=data.belt.prototypes[station.prototype],box=new T.Box3().setFromPoints(p.positions.map(v=>new T.Vector3(...v)));rebuiltBox.union(box.applyMatrix4(new T.Matrix4().fromArray(station.matrix)));}
const beltBoundsError=Math.max(sourceBeltBox.min.distanceTo(rebuiltBox.min),sourceBeltBox.max.distanceTo(rebuiltBox.max));
check('Replacement belt keeps every source CAD tooth and the original assembled bounds',data.belt.stations.length===specFor(691).members.length&&beltBoundsError<1e-6,{teeth:data.belt.stations.length,boundsErrorMetres:beltBoundsError});
const scene=new T.Scene(),material=new T.MeshStandardMaterial(),belt=W.createArmStudyTransmission(data,scene,material),host={matrix:new T.Matrix4(),opacity:1,background:false};
belt.update([0,0,0,0,0,0,0],host);const instance=scene.children[0],rest=[];for(let i=0;i<instance.count;i++){const m=new T.Matrix4();instance.getMatrixAt(i,m);rest.push(m);}
belt.update([0,0,0,0,0,.1,0],host);let beltPositive=0,beltSamples=0;const prototype=data.belt.prototypes[0],localCenter=prototype.positions.reduce((s,p)=>s.add(new T.Vector3(...p)),new T.Vector3()).divideScalar(prototype.positions.length),inputCenter=center(683);
for(let i=0;i<instance.count;i++){const m=new T.Matrix4();instance.getMatrixAt(i,m);const p=localCenter.clone().applyMatrix4(rest[i]),v=localCenter.clone().applyMatrix4(m).sub(p),radial=p.clone().sub(inputCenter);radial.addScaledVector(axis,-radial.dot(axis));if(radial.length()<.025){beltSamples++;if(v.dot(new T.Vector3().crossVectors(axis,radial))>0)beltPositive++;}}
check('Source belt circulation agrees with positive input-pulley rotation',beltSamples>8&&beltPositive===beltSamples,{beltSamples,beltPositive});
belt.dispose();material.dispose();

const fromNodes=new Set(W.WRIST_POWER_GRAPH.map(e=>e.from)),root=[...fromNodes].find(node=>!W.WRIST_POWER_GRAPH.some(e=>e.to===node));
const graphConsistent=W.WRIST_POWER_GRAPH.every(e=>e.from===root||W.WRIST_POWER_GRAPH.some(p=>p.to===e.from&&p.depth<e.depth));
const branches=W.WRIST_POWER_GRAPH.filter(e=>e.from===762);
check('Power graph follows dependencies and starts both 40T branches together',graphConsistent&&branches.length===2&&branches[0].depth===branches[1].depth,{root,branches});
const traceSamples=[0,.02,.15,.25,.4,.55,.7,.85,1].map(progress=>{const trace=W.wristPowerTrace(progress,center);return {progress,segments:trace.edges.length,frontier:trace.frontier.length};});
check('Progressive trace starts empty and ends with only three endpoint markers',traceSamples[0].segments===0&&traceSamples.at(-1).segments===W.WRIST_POWER_GRAPH.length&&traceSamples.every(r=>r.frontier<=3),traceSamples);
const sources=Object.fromEntries(await Promise.all(['src/scripts/lib/arm-study-transmission.ts','src/scripts/lib/arm-study-motion.ts','src/scripts/arm-explode-scene.ts','materials/models/derived/web/arm-wrist-transmission.json','materials/models/derived/web/arm-parts.glb','materials/models/derived/web/arm-parts.json'].map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const report={created:new Date().toISOString(),passed:checks.every(c=>c.passed),visualReview:'pending; this audit does not claim rendered readability',sources,checks};
await mkdir('materials/documents/derived/audits/arm-wrist-transmission',{recursive:true});await writeFile('materials/documents/derived/audits/arm-wrist-transmission/checks.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:checks.length,failed:checks.filter(c=>!c.passed)}));if(!report.passed)process.exitCode=1;
