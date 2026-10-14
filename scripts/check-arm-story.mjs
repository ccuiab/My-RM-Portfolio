import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {armStudyPose,armDetailStage,ARM_STUDY_ORDER,ARM_STUDY_STARTS,ARM_STUDY_SHOTS,ARM_STUDY_DURATION,ARM_STUDY_FINALE_START,ARM_STUDY_FINALE,finaleAngles} from '../src/scripts/arm-study-story.ts';
import {armMotionMatrices} from '../src/scripts/lib/arm-study-motion.ts';
const meta=JSON.parse(await readFile(new URL('../materials/models/derived/web/arm-parts.json',import.meta.url),'utf8'));
const checks=[];
const check=(name,condition,detail)=>{assert.ok(condition,`${name}: ${JSON.stringify(detail)}`);checks.push({name,passed:true,detail});};
const near=(a,b,e=1e-8)=>Math.abs(a-b)<e;
for(let i=0;i<ARM_STUDY_ORDER.length;i++){
 const s=ARM_STUDY_SHOTS[i],start=ARM_STUDY_STARTS[i],closeAt=3.8+s.inspect;
 const cover=armStudyPose(start+1.8),shaft=armStudyPose(start+3),hold=armStudyPose(start+4.5),close=armStudyPose(start+closeAt+1.5),end=armStudyPose(start+s.duration-1e-6);
 check(`shot_${i}_staging`,cover.progress>0&&cover.progress<.4&&shaft.progress>.4&&hold.progress===1&&close.progress<.4&&end.progress<1e-8,{id:s.id});
 check(`shot_${i}_camera_locked_open`,cover.view===0&&shaft.view===0,'No camera-path advance during separation.');
 check(`shot_${i}_cover_first`,armDetailStage(cover.progress,2)===0&&armDetailStage(shaft.progress,1)===1,'Shaft stacks wait for covers.');
 check(`shot_${i}_neutral_end`,end.angles.every(a=>Math.abs(a)<1e-7),'Every local motion returns to the CAD reference before the next shot.');
 if(s.motion){const demo=armStudyPose(start+closeAt+2.3+s.motion*.6);check(`shot_${i}_motion_after_reassembly`,demo.progress===0&&demo.angles.some(a=>Math.abs(a)>.1),demo.angles);}
}
check('distinct_j1_j2_one_wrist',JSON.stringify(ARM_STUDY_ORDER)===JSON.stringify([0,1,8,2,6,3,4]),ARM_STUDY_ORDER);
const identity=new THREE.Matrix4(),zero=armMotionMatrices(meta.motion,[0,0,0,0,0,0,0]);
check('zero_pose_identity',[...zero.values()].every(m=>m.elements.every((v,i)=>near(v,identity.elements[i]))),'Every baked part returns to its exact source coordinate frame.');
const activeAxes=new Set();let samples=0;
for(let t=0;t<=ARM_STUDY_DURATION;t+=1/30){
 const p=armStudyPose(t);assert.ok(p.angles.every(Number.isFinite));assert.ok(p.progress>=0&&p.progress<=1);
 if(p.progress>1e-8)assert.ok(p.angles.every(a=>Math.abs(a)<1e-8),'Never rotate a disassembled assembly.');
 const matrices=armMotionMatrices(meta.motion,p.angles);
 for(const part of meta.parts){assert.ok(matrices.has(part.motion_group),`Unknown motion group ${part.motion_group}`);assert.ok(near(matrices.get(part.motion_group).determinant(),1));if(part.motor)assert.ok(part.detail_offset_m.every(v=>v===0));}
 assert.ok(matrices.get('j0_fixed').equals(identity));
 if(p.phase==='climb')p.angles.forEach((a,i)=>{if(Math.abs(a)>1)activeAxes.add(i);});samples++;
}
check('rigid_motion_and_no_open_joint_motion',true,{sampleRate:30,samples});
check('all_seven_axes_in_finale',activeAxes.size===7,[...activeAxes]);
const q=[14,17,28,-22,16,-18,32],m=armMotionMatrices(meta.motion,q);
const uwbRotation=new THREE.Matrix4().extractRotation(m.get('uwb')),baseRotation=new THREE.Matrix4().extractRotation(m.get('link_1'));
check('uwb_preserves_shoulder_reference',uwbRotation.elements.every((v,i)=>near(v,baseRotation.elements[i])),'UWB counter-rotates q2 about its own offset axis.');
const anchor=new THREE.Vector3(...meta.motion.uwb_point_m),a=anchor.clone().applyMatrix4(m.get('uwb')),b=anchor.clone().applyMatrix4(m.get('link_2'));
check('uwb_pivot_stays_connected',a.distanceTo(b)<1e-9,a.toArray());
const wheelRelative=m.get('link_4').clone().invert().multiply(m.get('link_wheel'));const angle=new THREE.Quaternion().setFromRotationMatrix(wheelRelative).angleTo(new THREE.Quaternion());
check('wheel_is_dependent_branch',near(angle,THREE.MathUtils.degToRad(Math.abs(q[5]-q[6]))),'q7=q5-q6; not an independent eighth axis.');
const drive=new THREE.Matrix4().extractRotation(m.get('j0_drive'));
check('j0_stationary_central_gear_and_input_compensation',drive.elements.every((v,i)=>near(v,identity.elements[i])),'J0 input adapter orbits with the carrier and counter-rotates relative to it.');
check('finale_closes_at_reference',finaleAngles(0).every(a=>a===0)&&finaleAngles(1).every(a=>a===0)&&armStudyPose(ARM_STUDY_DURATION).angles.every(a=>a===0),'The whole coordinated sequence returns to the original pose.');
await writeFile(new URL('../materials/documents/derived/audits/arm-study-20261014/story-checks.json',import.meta.url),JSON.stringify({duration:ARM_STUDY_DURATION,finaleStart:ARM_STUDY_FINALE_START,finaleDuration:ARM_STUDY_FINALE,checks},null,2)+'\n');
console.log(`Story / motion checks: ${checks.length} passed; ${ARM_STUDY_DURATION.toFixed(1)} seconds.`);
