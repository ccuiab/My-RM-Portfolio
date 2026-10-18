import type {SevenAngles} from './lib/arm-study-motion';
import limitStudy from '../../materials/models/derived/web/arm-linked-limit.json' with {type:'json'};
/** Presentation distances are not hardware limits. Angles use the source CAD frame. */
export const ARM_STUDY_ORDER=[0,1,8,9,2,6,3,4] as const;
export const ARM_STUDY_INTRO=12;
export const ARM_STUDY_RETURN=3;
export const ARM_STUDY_FINALE=32;
export const ARM_STUDY_SHOTS=[
 {id:0,approach:3,inspect:4.8,motion:5}, {id:1,approach:2.8,inspect:2,motion:7},
 {id:8,approach:3,inspect:4.5,motion:3.5}, {id:9,approach:3,inspect:5,motion:0},
 {id:2,approach:3.4,inspect:4.5,motion:3.5}, {id:6,approach:3.2,inspect:3,motion:19},
 {id:3,approach:3.2,inspect:9,motion:3.5}, {id:4,approach:3,inspect:16,motion:6},
].map(s=>({...s,opening:s.id===1||s.id===6?0:2.5,closing:s.id===1||s.id===6?0:2.3,
 duration:s.approach+(s.id===1||s.id===6?0:4.8)+s.inspect+s.motion}));
export const ARM_STUDY_STARTS=ARM_STUDY_SHOTS.map((_,i)=>ARM_STUDY_INTRO+ARM_STUDY_SHOTS.slice(0,i).reduce((n,s)=>n+s.duration,0));
export const ARM_STUDY_CLIMB_START=ARM_STUDY_INTRO+ARM_STUDY_SHOTS.reduce((n,s)=>n+s.duration,0);
export const ARM_STUDY_CLIMB_DURATION=ARM_STUDY_FINALE;
export const ARM_STUDY_FINALE_START=ARM_STUDY_CLIMB_START;
export const ARM_STUDY_DURATION=ARM_STUDY_CLIMB_START+ARM_STUDY_CLIMB_DURATION;
export type StudyPhase='assembled'|'approach'|'fasteners'|'covers'|'shafts'|'inspect'|'close'|'motion'|'return'|'finale'|'extract'|'climb';
export type StudyPose={id:number|null;previous:number|null;step:number;progress:number;focus:number;view:number;phase:StudyPhase;angles:SevenAngles;finale:number;motionU:number;extract:number;context:number;climb:number;restoreWeight?:number};
export const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return Math.max(0,Math.min(1,t*t*t*(t*(t*6-15)+10)));};
const zeros=():SevenAngles=>[0,0,0,0,0,0,0];
const keyMotion=(values:number[],u:number)=>{const f=Math.max(0,Math.min(1,u))*(values.length-1),i=Math.min(values.length-2,Math.floor(f));return values[i]+(values[i+1]-values[i])*smooth(f-i);};
export function jointDemo(id:number,u:number):SevenAngles{
 const q=zeros();
 if(id===0)q[0]=keyMotion([0,18,-12,0],Math.max(0,(u-.4)/.6));
 if(id===1)q[1]=keyMotion([0,35,-28,25,0],u);
 if(id===8)q[2]=keyMotion([0,18,0],u);
 if(id===2)q[3]=keyMotion([0,-24,0],u);
 if(id===3)q[4]=keyMotion([0,24,-18,0],u);
 if(id===6){
  if(u<.32)q[2]=keyMotion([0,24,-18,0],u/.32);
  else if(u<.68){const v=(u-.32)/.36;q[2]=keyMotion([0,limitStudy.demo.q2_deg,limitStudy.demo.q2_deg,limitStudy.demo.q2_deg,0],v);q[3]=keyMotion([0,0,limitStudy.demo.q3_contact_deg,limitStudy.demo.q3_contact_deg,0],v);}
 }
 if(id===4){q[5]=keyMotion([0,-28,-12,22,0],u);q[6]=keyMotion([0,0,55,-40,0],u);}
 return q;
}
export function armStudyPose(time:number):StudyPose{
 const t=Math.max(0,Math.min(ARM_STUDY_DURATION,time));
 const home:StudyPose={id:null,previous:null,step:-1,progress:0,focus:1,view:0,phase:'assembled',angles:zeros(),finale:0,motionU:0,extract:0,context:0,climb:0};
 if(t<ARM_STUDY_INTRO)return {...home,phase:'extract',extract:.28*smooth((t-4)/4),context:1-smooth((t-5)/7),view:smooth((t-6)/6)};
 if(t>=ARM_STUDY_CLIMB_START){const u=Math.min(1,(t-ARM_STUDY_CLIMB_START)/ARM_STUDY_CLIMB_DURATION);return {...home,phase:'climb',step:8,climb:u,context:smooth(u/.12),angles:climbAngles(u)};}
 const step=ARM_STUDY_STARTS.findIndex((start,i)=>t>=start&&t<start+ARM_STUDY_SHOTS[i].duration);
 const shot=ARM_STUDY_SHOTS[Math.max(0,step)],local=t-ARM_STUDY_STARTS[Math.max(0,step)];
 const pose:StudyPose={...home,id:shot.id,previous:step?ARM_STUDY_ORDER[step-1]:null,step,phase:'approach',extract:shot.id===0?.28:0};
 if(local<shot.approach)return {...pose,context:pose.previous===0?.42*(1-smooth(local/shot.approach)):0,focus:smooth(local/shot.approach)};
 const openAt=shot.approach,inspectAt=openAt+shot.opening,closeAt=inspectAt+shot.inspect,motionAt=closeAt+shot.closing;
 if(local<inspectAt){const v=local-openAt;return {...pose,progress:v<.8?.22*v/.8:v<1.55?.22+.33*(v-.8)/.75:.55+.45*(v-1.55)/.95,view:0,phase:v<.8?'fasteners':v<1.55?'covers':'shafts'};}
 if(local<closeAt)return {...pose,progress:shot.opening?1:0,view:smooth((local-inspectAt-.4)/(shot.inspect-.4)),phase:'inspect'};
 if(local<motionAt){const c=local-closeAt;return {...pose,progress:c<1?1-.45*c:c<1.65?.55-.33*(c-1)/.65:.22*(1-(c-1.65)/.65),view:1,phase:'close'};}
 const u=shot.motion?(local-motionAt)/shot.motion:1;
 return {...pose,extract:shot.id===0?.28*(1-smooth((local-motionAt)/1.5)):0,context:shot.id===0?.42*smooth((local-motionAt)/1.3):0,view:1,phase:'motion',motionU:u,angles:jointDemo(shot.id,u)};
}
export function armDetailStage(progress:number,stage:number){return stage===0?smooth(progress/.14):stage===1?smooth((progress-.22)/.33):smooth((progress-.55)/.45);}
/** At full withdrawal the screws fade, before any cover moves. Reversed on close. */
export function armFastenerOpacity(progress:number){return 1-smooth((progress-.14)/.08);}
export const STEP_HEIGHT=.08;
export const GROUND_Y=-.313409739;
export const climbAdvance=(u:number)=>.78*smooth((u/.84-.35)/.34);
export const stageDescent=(u:number)=>smooth((u-.87)/.13);
export const climbStroke=(u:number)=>.052*smooth((u/.84-.26)/.09)*(1-smooth((u/.84-.72)/.09));
export const climbRise=(u:number)=>{
 const raised=.104-(-.219968621-(GROUND_Y+STEP_HEIGHT));
 return (raised*smooth((u/.84-.26)/.09)+(STEP_HEIGHT-raised)*smooth((u/.84-.72)/.09))*(1-stageDescent(u));
};
export function climbAngles(u:number):SevenAngles{
 const actualU=u;u=Math.min(1,u/.84);
 const deploy=smooth((u-.13)/.13),recover=1-smooth((u-.72)/.15),weight=deploy*recover;
 const rear=smooth((u-.07)/.10)*(1-smooth((u-.85)/.08));
 const flourish=u<=.07||u>=.23?0:Math.sin(Math.PI*smooth((u-.07)/.16))**2;
 const rise=climbRise(actualU),r=.58,y=GROUND_Y+.04-rise-(-.00643354);
 const l1=.38,l2=Math.hypot(-.0745668,.41405066);
 const bend=-Math.acos(Math.max(-1,Math.min(1,(r*r+y*y-l1*l1-l2*l2)/(2*l1*l2))));
 const alpha=Math.atan2(y,r)-Math.atan2(l2*Math.sin(bend),l1+l2*Math.cos(bend));
 const q2=(Math.atan2(.17335899,-.33815183)-alpha)*180/Math.PI;
 const q3=(Math.atan2(-.0745668,.41405066)-alpha-bend)*180/Math.PI-q2;
 const pitch=-110*weight;
 // q7 = q5-q6. Negative world wheel rotation cancels forward contact velocity.
 return [127.46*rear,-10*flourish,q2*weight+8*flourish,q3*weight-12*flourish,16*flourish,pitch,pitch+climbAdvance(actualU)/.04*180/Math.PI+(1080-.78/.04*180/Math.PI)*smooth((u-.87)/.13)];
}
export function finaleAngles(u:number):SevenAngles{return climbAngles(u);}
