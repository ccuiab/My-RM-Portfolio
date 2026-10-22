/** Check the source-CAD relation behind B's single progressive wrist section.
 * Visual readability is assessed separately from the saved browser renders. */
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
const output='materials/documents/derived/audits/arm-study-20261022/limit';
await mkdir(output,{recursive:true});await mkdir('tmp/limit-revision',{recursive:true});
await build({entryPoints:['src/scripts/lib/arm-limit-workspace.ts'],outfile:'tmp/limit-revision/workspace.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {buildLimitWorkspace,createLimitWorkspace}=await import(pathToFileURL(resolve('tmp/limit-revision/workspace.mjs')).href+'?'+Date.now());
const meta=JSON.parse(await readFile('materials/models/derived/web/arm-parts.json','utf8')),data=buildLimitWorkspace(meta.motion);
let minimumClearance=Infinity,minimumEntry=Infinity,maximumPointError=0;
for(let i=0;i<=1500;i++){
 const progress=i/1500,p=data.sample(progress),distance=progress*data.lengths.at(-1);let j=data.lengths.findIndex(x=>x>=distance);if(j<=0)j=1;
 const expected=data.points[j-1].clone().lerp(data.points[j],(distance-data.lengths[j-1])/(data.lengths[j]-data.lengths[j-1]||1));
 maximumPointError=Math.max(maximumPointError,p.wrist.distanceTo(expected));minimumClearance=Math.min(minimumClearance,p.clearance);
 if(!p.q.every(Number.isFinite))throw Error('Nonfinite source-CAD wrist section');
}
for(let i=0;i<=500;i++)minimumEntry=Math.min(minimumEntry,data.enter(i/500).clearance);
const scene=new T.Scene(),display=createLimitWorkspace(scene,meta.motion,new T.Color('#f2b53a'));
const onset=display.update(.68001,true),middle=display.update(.87,true),complete=display.update(.97,true),end=display.update(1,true);
const checks=[
 {name:'Moving point agrees with actual source wrist FK',passed:maximumPointError<1e-8,maximumPointError_m:maximumPointError},
 {name:'Section and entry respect the recovered linked-stop profile',passed:minimumClearance>-.00002&&minimumEntry>-.00002,minimumClearance_m:minimumClearance,minimumEntry_m:minimumEntry,profileTolerance_m:.00002,note:'The displayed section uses the report near-similarity construction; this is not a whole-robot collision certificate.'},
 {name:'The single contour grows after a gradual entry and fades before the next shot',passed:onset.opacity<.001&&middle.progress>0&&middle.progress<1&&complete.progress===1&&end.opacity===0,states:{onset,middle,complete,end}},
];
display.dispose();
const paths=['src/scripts/lib/arm-limit-workspace.ts','src/scripts/arm-explode-scene.ts','materials/models/derived/web/arm-parts.json','materials/models/derived/web/arm-linked-limit.json'];
const sources=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const report={created:new Date().toISOString(),passed:checks.every(x=>x.passed),sources,traceSamples:data.points.length,checks,visualReview:'pending; numerical FK and profile checks do not prove readability'};
await writeFile(output+'/workspace-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
