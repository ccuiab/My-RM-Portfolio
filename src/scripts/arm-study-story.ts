import type {SevenAngles} from './lib/arm-study-motion';
/** Presentation choreography. Display offsets/angles are not hardware limits. */
export const ARM_STUDY_ORDER=[0,1,8,2,6,3,4] as const;
export const ARM_STUDY_INTRO=7;
export const ARM_STUDY_RETURN=2.2;
export const ARM_STUDY_FINALE=28;
export const ARM_STUDY_SHOTS=[
  {id:0,inspect:4.8,motion:5}, {id:1,inspect:3.4,motion:3},
  {id:8,inspect:4.4,motion:3}, {id:2,inspect:4.4,motion:3},
  {id:6,inspect:5.4,motion:6}, {id:3,inspect:5.4,motion:3},
  {id:4,inspect:12,motion:5.7},
].map(s=>({...s,duration:3.8+s.inspect+2.3+s.motion}));
export const ARM_STUDY_STARTS=ARM_STUDY_SHOTS.map((_,i)=>ARM_STUDY_INTRO+ARM_STUDY_SHOTS.slice(0,i).reduce((n,s)=>n+s.duration,0));
export const ARM_STUDY_CLIMB_DURATION=28;
export const ARM_STUDY_CLIMB_START=ARM_STUDY_INTRO+ARM_STUDY_SHOTS.reduce((n,s)=>n+s.duration,0);
export const ARM_STUDY_FINALE_START=ARM_STUDY_CLIMB_START;
export const ARM_STUDY_DURATION=ARM_STUDY_FINALE_START+ARM_STUDY_FINALE+2;
export type StudyPhase='assembled'|'approach'|'covers'|'shafts'|'inspect'|'close'|'motion'|'return'|'finale'|'extract'|'climb';
export type StudyPose={id:number|null;previous:number|null;step:number;progress:number;focus:number;view:number;phase:StudyPhase;angles:SevenAngles;finale:number;motionU:number;extract:number;context:number;climb:number;restoreWeight?:number};
export const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return Math.max(0,Math.min(1,t*t*t*(t*(t*6-15)+10)));};
const zeros=():SevenAngles=>[0,0,0,0,0,0,0];
const keyMotion=(values:number[],u:number)=>{const f=Math.max(0,Math.min(1,u))*(values.length-1),i=Math.min(values.length-2,Math.floor(f));return values[i]+(values[i+1]-values[i])*smooth(f-i);};
export function jointDemo(id:number,u:number):SevenAngles{
 const q=zeros();
 if(id===0)q[0]=keyMotion([0,18,-12,0],Math.max(0,(u-.4)/.6));
 if(id===1)q[1]=keyMotion([0,22,-14,0],u);
 if(id===8)q[2]=keyMotion([0,18,0],u);
 if(id===2)q[3]=keyMotion([0,-24,0],u);
 if(id===3)q[4]=keyMotion([0,24,-18,0],u);
 if(id===6){q[2]=keyMotion([0,18,18,-12,-12,0],u);q[3]=keyMotion([0,-12,-12,12,12,0],u);}
 if(id===4){q[5]=keyMotion([0,-28,-12,22,0],u);q[6]=keyMotion([0,0,55,-40,0],u);}
 return q;
}
// The finale is the same continuous one-step choreography, never a second scene.
export function finaleAngles(u:number):SevenAngles{return climbAngles(u);}
export function armStudyPose(time:number):StudyPose{
 const t=Math.max(0,Math.min(ARM_STUDY_DURATION,time));
 const home:StudyPose={id:null,previous:null,step:-1,progress:0,focus:1,view:0,phase:'assembled',angles:zeros(),finale:0,motionU:0,extract:0,context:0,climb:0};
 if(t<ARM_STUDY_INTRO)return {...home,phase:'extract',extract:.28*smooth((t-2)/3),context:1-.98*smooth((t-2)/5),view:smooth((t-5)/2)};
 if(t<ARM_STUDY_CLIMB_START&&t>=ARM_STUDY_INTRO)home.extract=t<ARM_STUDY_STARTS[0]+ARM_STUDY_SHOTS[0].duration?.28:0;
 if(t>=ARM_STUDY_CLIMB_START&&t<ARM_STUDY_CLIMB_START+ARM_STUDY_CLIMB_DURATION){const u=(t-ARM_STUDY_CLIMB_START)/ARM_STUDY_CLIMB_DURATION;return {...home,phase:'climb',step:7,climb:u,context:smooth(u/.12),angles:climbAngles(u)};}
 if(t>=ARM_STUDY_CLIMB_START+ARM_STUDY_CLIMB_DURATION)return {...home,climb:1,context:1,phase:'assembled',finale:1,focus:smooth((t-ARM_STUDY_CLIMB_START-ARM_STUDY_CLIMB_DURATION)/2)};
 let step=ARM_STUDY_STARTS.findIndex((start,i)=>t>=start&&t<start+ARM_STUDY_SHOTS[i].duration);if(step<0)step=6;
 const shot=ARM_STUDY_SHOTS[step],local=t-ARM_STUDY_STARTS[step];
 const pose:StudyPose={...home,id:shot.id,previous:step?ARM_STUDY_ORDER[step-1]:null,step,phase:'approach'};
 if(local<1.3)return {...pose,context:pose.previous===0?.42*(1-smooth(local/1.3)):0,focus:smooth(local/1.3)};
 if(local<2.4)return {...pose,progress:.4*smooth((local-1.3)/1.1),view:0,phase:'covers'};
 if(local<3.8)return {...pose,progress:.4+.6*smooth((local-2.4)/1.4),view:0,phase:'shafts'};
 const closeAt=3.8+shot.inspect;
 if(local<closeAt)return {...pose,progress:1,view:smooth((local-4.3)/(shot.inspect-.5)),phase:'inspect'};
 if(local<closeAt+2.3){const c=local-closeAt;return {...pose,progress:c<1.3?1-.6*smooth(c/1.3):.4*(1-smooth((c-1.3)/1)),view:1,phase:'close'};}
 return {...pose,extract:shot.id===0?.28*(1-smooth((local-closeAt-2.3)/1.5)):0,context:shot.id===0?.42*smooth((local-closeAt-2.3)/1.3):0,progress:0,view:1,phase:'motion',motionU:(local-closeAt-2.3)/shot.motion,angles:jointDemo(shot.id,(local-closeAt-2.3)/shot.motion)};
}
export function armDetailStage(progress:number,stage:number){return stage===1?smooth(progress/.4):smooth((progress-.4)/.6);}

// Source-frame two-link IK keeps the rear wheel axle at ground + 40 mm.
export function climbAngles(u:number):SevenAngles {
 const deploy=smooth((u-.22)/.14),recover=1-smooth((u-.80)/.10),weight=deploy*recover;
 const rear=smooth((u-.07)/.15)*(1-smooth((u-.88)/.12));
 const bell=(a:number,b:number)=>u<=a||u>=b?0:Math.sin(Math.PI*(u-a)/(b-a))**2;
 const flourish=bell(.07,.36)*(1-deploy)+bell(.80,.90)*(1-recover);
 const rise=climbRise(u),r=.58,y=-.27451-rise-(-.00643354);
 const l1=.38,l2=Math.hypot(-.0745668,.41405066);
 const bend=-Math.acos(Math.max(-1,Math.min(1,(r*r+y*y-l1*l1-l2*l2)/(2*l1*l2))));
 const alpha=Math.atan2(y,r)-Math.atan2(l2*Math.sin(bend),l1+l2*Math.cos(bend));
 const q2=(Math.atan2(.17335899,-.33815183)-alpha)*180/Math.PI;
 const q3=(Math.atan2(-.0745668,.41405066)-alpha-bend)*180/Math.PI-q2;
 return [127.46*rear,-12*flourish,q2*weight+10*flourish,q3*weight-18*flourish,18*flourish,-110*weight,-climbAdvance(u)/.04*180/Math.PI];
}
export const climbStroke=(u:number)=>.048*smooth((u-.36)/.10)*(1-smooth((u-.72)/.08));
export const climbRise=(u:number)=>Math.max(0,2*climbStroke(u)-.0145414);
export const climbAdvance=(u:number)=>.24*smooth((u-.46)/.24)*(1-smooth((u-.80)/.10));
