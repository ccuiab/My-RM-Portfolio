import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {armStudyPose,ARM_STUDY_STARTS,ARM_STUDY_SHOTS,climbAngles,climbStroke,climbRise,climbAdvance} from '../src/scripts/arm-study-story.ts';
import {armMotionMatrices} from '../src/scripts/lib/arm-study-motion.ts';
const meta=JSON.parse(await readFile('materials/models/derived/web/arm-parts.json','utf8'));
const context=JSON.parse(await readFile('materials/models/derived/web/arm-context.json','utf8'));
const checks=[];function check(name,test,detail){assert.ok(test,name);checks.push({name,passed:true,detail});}
const ids=context.groups.flatMap(g=>g.source_nodes),armIds=new Set(meta.parts.flatMap(p=>p.members.filter(m=>m.asset==='engineer').map(m=>m.index)));
check('context_source_partition',ids.length===new Set(ids).size&&ids.every(i=>!armIds.has(i)),ids.length);
check('context_material_separation',new Set(context.groups.map(g=>g.material)).size>=4&&context.groups.some(g=>g.material==='rubber')&&context.groups.some(g=>g.material==='motor'),'Source parts retain aluminium, motor, carbon/plastic and rubber families.');
check('two_independent_lifts',['left','right'].every(side=>['carriage','gear','foot'].every(group=>context.groups.some(g=>g.group===`${side}_${group}`))),context.groups.map(g=>g.group));
for(let i=0;i<ARM_STUDY_SHOTS.length;i++){
 const start=ARM_STUDY_STARTS[i],close=start+3.8+ARM_STUDY_SHOTS[i].inspect;
 check(`locked_camera_${i}`,[1.4,2,2.5,3.7].every(t=>armStudyPose(start+t).view===0)&&[.1,1,2.2].every(t=>armStudyPose(close+t).view===1),'Opening and closing use constant observation parameters.');
}
const wheel=meta.motion.joints[6].point_m;let maxGroundError=0,maxFrontError=0;
for(let u=.36;u<=.80;u+=.005){
 const q=climbAngles(u),p=new THREE.Vector3(...wheel).applyMatrix4(armMotionMatrices(meta.motion,q).get('link_wheel'));p.y+=climbRise(u);
 maxGroundError=Math.max(maxGroundError,Math.abs(p.y-(-.27451)));
 const stroke=climbStroke(u);assert.ok(stroke>=0&&stroke<=.048);
 // Source carriage starts 60.28246 mm, extension remains above the 7 mm lower mate limit.
 assert.ok(.06028246-stroke>=.007);
 if(stroke>.007271)maxFrontError=Math.max(maxFrontError,Math.abs(-.2199686+climbRise(u)-2*stroke-(-.23451)));
 const forwardWheelAngle=-q[6]*Math.PI/180;
 assert.ok(Math.abs(forwardWheelAngle*.04-climbAdvance(u))<1e-8);
}
check('rear_wheel_ground_contact',maxGroundError<.001,{maxGroundError});
check('front_lift_platform_contact',maxFrontError<.001,{maxFrontError});
const rearPose=climbAngles(.5),rearMatrices=armMotionMatrices(meta.motion,rearPose);
const gimbalForward=new THREE.Vector3(...meta.motion.joints[0].point_m).applyMatrix4(rearMatrices.get('j0_carrier')).sub(new THREE.Vector3(...meta.motion.j0_point_m));gimbalForward.y=0;gimbalForward.normalize();
check('rear_gimbal_alignment',gimbalForward.dot(new THREE.Vector3(.793812173,0,-.608163021))>.99999&&rearPose[1]===0,'Actual J0-to-J1 mounting direction faces chassis rear; J1 is neutral while supporting.');
const wheelAngles=Array.from({length:25},(_,i)=>{const q=climbAngles(.47+i*.009);return q[5]-q[6];});
check('wheel_continuous_drive',wheelAngles.every((a,i)=>i===0||a>wheelAngles[i-1]),{first:wheelAngles[0],last:wheelAngles.at(-1)});
check('rack_stroke_and_drive_distance',true,'Both 48 mm carriage strokes remain in source mate window; 40 mm wheel radius ties roll drive to short translation.');
check('j0_reseats_before_rotation',[.1,.2,.3,.39].every(u=>armStudyPose(ARM_STUDY_STARTS[0]+3.8+ARM_STUDY_SHOTS[0].inspect+2.3+u*5).angles[0]===0),'First 40 percent of J0 motion is reserved for reseating and camera transition.');
await writeFile('materials/documents/derived/audits/arm-study-20261014/context-checks.json',JSON.stringify({checks},null,2));
console.log(`Context checks: ${checks.length} passed.`);
