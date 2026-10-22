/** Contact-driven wheel motion for A's authored trajectory. No extra joint is
 * introduced: the actual differential remains J7 = q5 - q6. While the empty
 * wrist supports the vehicle, J6 turns the cup around its own normal and drives
 * the two coaxial 80 mm wheels through that differential. */
import * as THREE from 'three';
import {armMotionMatrices,type MotionContract,type SevenAngles} from './arm-study-motion';

type WheelState={body:THREE.Matrix4;climb:number};
type WheelSample={time:number;center:THREE.Vector3;axis:THREE.Vector3;rotation:THREE.Quaternion;contact:boolean};
const radius=.04,ground=.003,up=new THREE.Vector3(0,1,0),settleSeconds=.65;
const smooth=(u:number)=>{u=THREE.MathUtils.clamp(u,0,1);return u*u*u*(u*(u*6-15)+10);};

export function applyMissionWheelRoll(contract:MotionContract,source:number[][],fps:number,stateAt:(time:number)=>WheelState){
 const joint=contract.joints.find(j=>j.name==='J7');
 if(!joint)throw new Error('A mission needs the CAD J7 wheel axis');
 let previous:WheelSample|undefined,offset=0,release:{time:number;from:number;to:number}|undefined;
 const contacts:{time:number;center:number[];axis:number[];angleDegrees:number;distance:number;slip:number;lateral:number}[]=[];
 const samples=source.map((angles,index)=>{
  const time=index/fps,state=stateAt(time),q=[...angles] as SevenAngles,matrices=armMotionMatrices(contract,q);
  const parent=state.body.clone().multiply(matrices.get(joint.parent_link)!);
  const world=state.body.clone().multiply(matrices.get(joint.child_link)!);
  const center=new THREE.Vector3().fromArray(joint.point_m).applyMatrix4(parent);
  const axis=new THREE.Vector3().fromArray(joint.axis).transformDirection(parent);
  // A's rear wheels support the original floor while the chassis climbs both
  // risers. Height and actual axle orientation determine contact, not a phase
  // timestamp, so the support trajectory can be retimed or moved freely.
  const bottom=center.y-radius*Math.sqrt(Math.max(0,1-axis.y*axis.y));
  const contact=state.climb>0&&Math.abs(bottom-ground)<.0015&&Math.abs(axis.y)<.02;
  const current={time,center,axis,rotation:new THREE.Quaternion().setFromRotationMatrix(world),contact};
  if(contact){
   release=undefined;
   if(previous?.contact){
    const axle=previous.axis.clone().add(axis).normalize(),tangent=axle.clone().cross(up).normalize();
    const delta=center.clone().sub(previous.center),distance=delta.dot(tangent);
    const change=current.rotation.clone().multiply(previous.rotation.clone().invert());
    if(change.w<0)change.set(-change.x,-change.y,-change.z,-change.w);
    const baseAngle=2*Math.atan2(new THREE.Vector3(change.x,change.y,change.z).dot(axle),change.w);
    const roll=distance/radius,oldOffset=offset;
    offset+=roll-baseAngle;
    const effective=baseAngle+offset-oldOffset;
    contacts.push({time,center:center.toArray(),axis:axis.toArray(),angleDegrees:angles[5]-angles[6]+THREE.MathUtils.radToDeg(offset),distance,slip:distance-effective*radius,lateral:delta.clone().addScaledVector(tangent,-distance).setY(0).length()});
   }
  }else{
   if(previous?.contact)release={time,from:offset,to:Math.round(offset/(2*Math.PI))*2*Math.PI};
   if(release)offset=THREE.MathUtils.lerp(release.from,release.to,smooth((time-release.time)/settleSeconds));
  }
  // Changing J6 also changes J7 by exactly the opposite angle. Keeping complete
  // turns unwrapped avoids a jump at release; settling to the nearest full turn
  // restores the original cup orientation before the next pickup.
  q[6]-=THREE.MathUtils.radToDeg(offset);
  previous=current;
  return q.map(x=>+x.toFixed(6));
 });
 const report={radius,ground,settleSeconds,coupling:'J7 = q5 - q6',contactSamples:contacts.length,firstContact:contacts[0]?.time??null,lastContact:contacts.at(-1)?.time??null,signedContactDistance:contacts.reduce((sum,c)=>sum+c.distance,0),maxRollingSlip:Math.max(0,...contacts.map(c=>Math.abs(c.slip))),maxLateralContactTravel:Math.max(0,...contacts.map(c=>c.lateral)),finalCupPhaseErrorDegrees:THREE.MathUtils.radToDeg(offset-Math.round(offset/(2*Math.PI))*2*Math.PI),contacts};
 return {samples,report};
}
