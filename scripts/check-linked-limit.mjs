import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {study,profileClearance} from '../src/scripts/lib/arm-linked-limit.ts';
import {armMotionMatrices} from '../src/scripts/lib/arm-study-motion.ts';
import {jointDemo,armDetailStage} from '../src/scripts/arm-study-story.ts';
import {ARM_TOOL_FACE_OFFSET_M} from '../src/scripts/lib/arm-tool-point.ts';
const meta=JSON.parse(readFileSync('materials/models/derived/web/arm-parts.json'));
assert.equal(study.plate_index,370,'Contact must use the arch plate from report figure 19.');
assert.ok(Math.abs(study.similarity.scale-study.similarity.distal_scale)<.001,'The two linkage ratios must agree.');
const straight=study.regions.limited.flatMap(p=>p.outer.slice(1).map((b,i)=>({a:p.outer[i],b}))).filter(({a,b})=>Math.hypot(a[0]-b[0],a[1]-b[1])>.15&&Math.min(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]))<.0001);
assert.equal(straight.length,3,'Mapped reach must retain the upper, front and rear straight stop boundaries.');
assert.equal(study.tcp.offset_m,ARM_TOOL_FACE_OFFSET_M);
let minimum=Infinity,contacts=0;
for(let i=0;i<=1000;i++){
 const q=jointDemo(6,i/1000),m=armMotionMatrices(meta.motion,q),center=new THREE.Vector3(...study.roller_source.center_m).applyMatrix4(m.get('link_3')).applyMatrix4(m.get('uwb').clone().invert());
 const {clearance}=profileClearance(center.y,center.z);minimum=Math.min(minimum,clearance);if(Math.abs(clearance)<.0004)contacts++;
 assert.ok(clearance>-.00001,`Linked-stop demo penetrates recovered plate at u=${i/1000}: ${clearance}m.`);
}
assert.ok(contacts>5,'Demonstration must actually approach the real contact surface.');
for(const sample of study.boundary_poses){
 const m=armMotionMatrices(meta.motion,sample.angles),tcp=new THREE.Vector3(...study.tcp.point_m).applyMatrix4(m.get('link_6'));
 assert.ok(tcp.distanceTo(new THREE.Vector3(...sample.tcp))<1e-8);
}
assert.ok(study.scan.connected_samples<study.scan.samples);
console.log(`Linked limit: source arch, similar linkages, TCP, nonpenetrating demo and sampled section passed; minimum clearance ${minimum.toExponential(3)}m.`);
