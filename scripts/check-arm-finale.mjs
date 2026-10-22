/** Current B ending contracts; rendered framing and appearance are checked
 * separately in the browser. No source CAD or historical reports are changed. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {armStudyPose,climbAngles,climbAdvance,climbRise,climbStroke,stageDescent,ARM_STUDY_DURATION,ARM_STUDY_CLIMB_START,ARM_STUDY_CLIMB_DURATION,GROUND_Y,STEP_HEIGHT} from '../src/scripts/arm-study-story.ts';
import {finaleMotionProgress,finaleEntry,finaleStairReveal,finaleFade,openingFade} from '../src/scripts/lib/arm-study-finale.ts';
import {armMotionMatrices} from '../src/scripts/lib/arm-study-motion.ts';
const json=async p=>JSON.parse(await readFile(p,'utf8')),checks=[],check=(name,passed,detail)=>checks.push({name,passed:!!passed,detail});
const meta=await json('materials/models/derived/web/arm-parts.json'),at=s=>armStudyPose(ARM_STUDY_CLIMB_START+s);
check('Ending first pulls back and reveals the whole vehicle before motion',[0,.5,1,2,2.99,3].every(s=>at(s).climb===0&&at(s).angles.every(x=>Math.abs(x)<1e-9)&&climbAdvance(at(s).climb)===0),{entrySeconds:3,entryComplete:finaleEntry(3/39)});
check('Amber step outlines reveal gradually before the vehicle advances',finaleStairReveal(2/39)===0&&finaleStairReveal(2.75/39)>.4&&finaleStairReveal(3.5/39)===1&&climbAdvance(at(3.5).climb)===0,{startSeconds:2,completeSeconds:3.5});
let groundError=0,frontError=0,slip=0;
for(let u=.35*.84;u<=.69*.84;u+=.0025){
 const q=climbAngles(u),wheel=new T.Vector3(...meta.motion.joints.find(j=>j.name==='J7').point_m).applyMatrix4(armMotionMatrices(meta.motion,q).get('link_wheel'));wheel.y+=climbRise(u);
 groundError=Math.max(groundError,Math.abs(wheel.y-GROUND_Y-.04));
 const stroke=climbStroke(u);if(stroke>.007271)frontError=Math.max(frontError,Math.abs(-.2199686+climbRise(u)-2*stroke-(GROUND_Y+STEP_HEIGHT)));
 slip=Math.max(slip,Math.abs((q[6]-q[5])*Math.PI/180*.04-climbAdvance(u)));
}
check('Retimed ending preserves rear wheel contact and front support geometry',groundError<.001&&frontError<.001,{maxGroundError_m:groundError,maxFrontError_m:frontError});
check('Wrist wheels retain signed rolling through the real differential',slip<1e-8,{maxSignedRollingDistanceError_m:slip,coupling:'J7=q5-q6',radius_m:.04});
check('The illustrative step stays 80 mm and never sinks',STEP_HEIGHT===.08&&[0,.5,.87,.95,1].every(u=>stageDescent(u)===0)&&Math.abs(climbRise(1)-.08)<1e-9,{stepHeight:STEP_HEIGHT,endBodyHeight:climbRise(1),endAdvance:climbAdvance(1)});
check('Vehicle holds on the platform before a short fade',[35,36,37,38].every(s=>at(s).climb===1&&Math.abs(climbRise(at(s).climb)-.08)<1e-9&&finaleFade(s/39)===0),{hold:[35,38],fade:[38,39],duration:ARM_STUDY_CLIMB_DURATION});
check('The loop reset is covered at both ends',finaleFade(1)===1&&openingFade(0)===1&&openingFade(.65)===0,{lastFrame:finaleFade(1),firstFrame:openingFade(0),openingFadeSeconds:.65});
const source=await json('materials/images/derived/web/robomaster-wordmark.source.json'),logo=await readFile(source.output),pdf=await readFile(source.source_path),sha=b=>createHash('sha256').update(b).digest('hex');
check('RM watermark uses the native embedded official wordmark',sha(logo)===source.sha256&&sha(pdf)===source.source_sha256&&source.page_1_based===2&&source.pixel_dimensions[0]===122&&source.pixel_dimensions[1]===14,{source:source.source_path,page:source.page_1_based,image:source.image_name,pngSha256:sha(logo),extraction:source.method});
const report={created:new Date().toISOString(),passed:checks.every(c=>c.passed),duration:ARM_STUDY_DURATION,endingStart:ARM_STUDY_CLIMB_START,checks,renderedReview:'pending; numeric checks do not approve camera framing, line visibility or the final cut'};
const directory='materials/documents/derived/audits/arm-study-20261022';await mkdir(directory,{recursive:true});await writeFile(directory+'/finale-checks.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
