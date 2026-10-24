/** The unloaded opening lowers the shoulder/elbow assembly. Once rear silver
 * is stored, a higher shoulder preserves cargo clearance; that pose is not a
 * lower-centre-of-mass claim. Both keep the forearm-mounted VT03 optical axis
 * and point the cup at the vehicle front using downstream wrist axes. */
import * as THREE from 'three';
import {armMotionMatrices,type MotionContract,type SevenAngles} from '../../../src/scripts/lib/arm-study-motion';

export const EMPTY_TRAVEL_SHOULDER_DEGREES=0;
export const STORED_EMPTY_TRAVEL_SHOULDER_DEGREES=27;
export function emptyTravelAngles(contract:MotionContract,body:THREE.Matrix4,heading:number,level:SevenAngles,hasRearCargo=false):SevenAngles{
 const q=[...level] as SevenAngles,forearmPitch=q[2]+q[3];
 q[2]=hasRearCargo?STORED_EMPTY_TRAVEL_SHOULDER_DEGREES:EMPTY_TRAVEL_SHOULDER_DEGREES;q[3]=forearmPitch-q[2];q[4]=.3954;q[5]=13.6283;q[6]=0;
 const face=contract.joints.find(j=>j.name==='J6');if(!face)throw new Error('Empty travel needs the actual CAD J6 suction axis');
 const desired=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
 const normal=(angles:SevenAngles)=>new THREE.Vector3().fromArray(face.axis).transformDirection(body.clone().multiply(armMotionMatrices(contract,angles).get(face.child_link)!));
 // Two downstream wrist axes determine the cup normal. Solve from a consistent
 // nearby branch so the opening's small steering corrections never flip roll.
 for(let i=0;i<32;i++){
  const n=normal(q),error=desired.clone().sub(n);if(error.length()<1e-9)break;
  const columns=[4,5].map(j=>{const trial=[...q] as SevenAngles;trial[j]+=.01;return normal(trial).sub(n).divideScalar(.01);});
  const a=columns[0].lengthSq()+1e-10,b=columns[0].dot(columns[1]),c=columns[1].lengthSq()+1e-10,x=columns[0].dot(error),y=columns[1].dot(error),det=a*c-b*b;
  q[4]+=THREE.MathUtils.clamp((c*x-b*y)/det,-8,8);
  q[5]=THREE.MathUtils.clamp(q[5]+THREE.MathUtils.clamp((a*y-b*x)/det,-8,8),-121.371651,118.628348);
 }
 if(normal(q).distanceTo(desired)>1e-5)throw new Error('No continuous forward-facing empty-cup solution');
 return q;
}
