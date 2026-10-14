/** Source-frame rigid-body kinematics for baked CAD meshes. Display angles only. */
import * as THREE from 'three';
export type SevenAngles = [number,number,number,number,number,number,number];
export type MotionContract = {
  joints: {name:string;parent_link:string;child_link:string;point_m:number[];axis:number[]}[];
  j0_point_m:number[];j0_input_point_m:number[];j1_input_point_m:number[];uwb_point_m:number[];
};
export function aboutAxis(point:number[],axis:number[],degrees:number) {
  const p=new THREE.Vector3().fromArray(point),rotation=new THREE.Matrix4().makeRotationAxis(new THREE.Vector3().fromArray(axis).normalize(),THREE.MathUtils.degToRad(degrees));
  return rotation.setPosition(p.clone().sub(p.clone().applyMatrix4(rotation)));
}
export function armMotionMatrices(contract:MotionContract,q:SevenAngles) {
  const identity=new THREE.Matrix4(),carrier=aboutAxis(contract.j0_point_m,[0,1,0],q[0]);
  const matrices=new Map<string,THREE.Matrix4>([['j0_fixed',identity],['j0_carrier',carrier],['link_base',carrier]]);
  for(const joint of contract.joints){
    const index=Number(joint.name.slice(1)),angle=index===7?q[5]-q[6]:q[index];
    const parent=matrices.get(joint.parent_link);if(!parent)throw new Error(`Missing parent ${joint.parent_link}`);
    matrices.set(joint.child_link,parent.clone().multiply(aboutAxis(joint.point_m,joint.axis,angle)));
  }
  matrices.set('j0_drive',carrier.clone().multiply(aboutAxis(contract.j0_input_point_m,[0,1,0],-q[0])));
  matrices.set('j1_drive',carrier.clone().multiply(aboutAxis(contract.j1_input_point_m,[0,1,0],q[1])));
  matrices.set('uwb',matrices.get('link_2')!.clone().multiply(aboutAxis(contract.uwb_point_m,[1,0,0],-q[2])));
  return matrices;
}
