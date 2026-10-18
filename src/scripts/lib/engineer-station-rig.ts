import * as THREE from 'three';
import {aboutAxis} from './arm-study-motion';

export const STATION_PLACEMENT=new THREE.Matrix4().makeTranslation(0,0,.70).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
export type StationParameters={yaw:number;shoulder:number;forearm:number;wristYaw:number;pitch:number;roll:number};
export const STATION_INITIAL:StationParameters={yaw:0,shoulder:20,forearm:20,wristYaw:0,pitch:-5,roll:0};
export const STATION_A:StationParameters={yaw:-12,shoulder:20,forearm:20,wristYaw:115,pitch:-5,roll:20};
export const STATION_B:StationParameters={yaw:14,shoulder:22,forearm:20,wristYaw:-120,pitch:-15,roll:-20};
export const STATION_DUMP:StationParameters={yaw:45,shoulder:-18,forearm:-10,wristYaw:135,pitch:-85,roll:180};
export const STATION_DUMP_B:StationParameters={...STATION_DUMP,yaw:-45,wristYaw:-135,roll:-180};
export function stationBlend(a:StationParameters,b:StationParameters,u:number):StationParameters{return Object.fromEntries(Object.keys(a).map(k=>[k,THREE.MathUtils.lerp(a[k as keyof StationParameters],b[k as keyof StationParameters],u)])) as StationParameters;}
export function stationParameters(u:number){return stationBlend(STATION_A,STATION_B,u);}
export function stationDelta(degrees:number){const vector=new THREE.Vector3(0,.0815845418054,.755608339379);return vector.clone().applyAxisAngle(new THREE.Vector3(1,0,0),THREE.MathUtils.degToRad(degrees)).sub(vector);}
export function shoulderDelta(degrees:number){const vector=new THREE.Vector3(0,.76,0);return vector.clone().applyAxisAngle(new THREE.Vector3(1,0,0),THREE.MathUtils.degToRad(degrees)).sub(vector);}
export function stationSlotMatrix(p:StationParameters|number,placement=STATION_PLACEMENT){if(typeof p==='number')p=stationParameters(p);const d=stationDelta(p.forearm).add(shoulderDelta(p.shoulder));return placement.clone().multiply(aboutAxis([0,0,-1.390],[0,1,0],p.yaw)).multiply(new THREE.Matrix4().makeTranslation(d.x,d.y,d.z)).multiply(aboutAxis([0,1.220984542,-.329391661],[0,1,0],p.wristYaw)).multiply(aboutAxis([0,1.220984542,-.409891661],[0,0,1],p.roll)).multiply(aboutAxis([0,1.220984542,-.159391661],[1,0,0],p.pitch)).multiply(new THREE.Matrix4().makeTranslation(0,1.023484542,-.080391661));}

/** Pivots derived from actual circular CAD faces; original meshes stay intact. */
export function createStationRig(root:THREE.Object3D,placement=STATION_PLACEMENT){
 const nodes=new Map<number,THREE.Object3D>();root.updateMatrixWorld(true);root.traverse(o=>{if(typeof o.userData.cad_node_id==='number')nodes.set(o.userData.cad_node_id,o);});
 const node=(id:number)=>{const n=nodes.get(id);if(!n)throw new Error('Missing station CAD node '+id);return n;};
 function pivot(parent:THREE.Object3D,name:string,point:number[]){root.updateMatrixWorld(true);const p=root.localToWorld(new THREE.Vector3().fromArray(point)),group=new THREE.Group();group.name=name;parent.add(group);group.position.copy(parent.worldToLocal(p));group.updateMatrixWorld(true);return group;}
 const yaw=pivot(root,'actual_base_yaw',[0,0,-1.390]);
 for(const n of [...node(802).children])if(n.userData.cad_node_id!==803)yaw.attach(n);
 const shoulder=pivot(yaw,'actual_shoulder_axis',[0,.6536,-1.210]);
 for(const id of [805,822,825,828,830,832,836,986])if(nodes.has(id))shoulder.attach(node(id));
 const shoulderParallel=pivot(yaw,'actual_shoulder_parallel',[0,.7536,-1.470]);shoulderParallel.attach(node(811));
 const elbow=pivot(yaw,'actual_shoulder_terminal',[0,0,0]);elbow.attach(node(809));const elbowRest=elbow.position.clone();
 const forearm=pivot(yaw,'actual_forearm_axis',[0,1.4136,-1.210]);
 for(const id of [810,818,819,820,821,829,831,835,985])if(nodes.has(id))forearm.attach(node(id));
 const parallel=pivot(yaw,'actual_parallel_axis',[0,1.5336,-1.065]);parallel.attach(node(812));
 const forearmRest=forearm.position.clone(),parallelRest=parallel.position.clone();
 const terminal=pivot(yaw,'actual_parallel_terminal',[0,0,0]);
 for(const id of [813,841,842,971,977])if(nodes.has(id))terminal.attach(node(id));
 const terminalRest=terminal.position.clone();
 const wristYaw=pivot(terminal,'actual_wrist_yaw',[0,1.220984542,-.329391661]);
 for(const id of [841,842,971])wristYaw.attach(node(id));
 const roll=pivot(wristYaw,'actual_end_roll',[0,1.220984542,-.409891661]);
 //844 is the rear wall of the fixed turntable casing, closed by850 and the
 //856/859 ribs. It must not rotate with the roll output/U-shaped fork.
 for(const id of [847,853,862,868,876])roll.attach(node(id));
 const pitch=pivot(roll,'actual_slot_pitch',[0,1.220984542,-.159391661]);pitch.attach(node(884));
 root.matrixAutoUpdate=false;root.matrix.copy(placement);root.matrixWorldNeedsUpdate=true;
 return {root,apply(p:StationParameters|number){if(typeof p==='number')p=stationParameters(p);const ds=shoulderDelta(p.shoulder);yaw.rotation.y=THREE.MathUtils.degToRad(p.yaw);shoulder.rotation.x=shoulderParallel.rotation.x=THREE.MathUtils.degToRad(p.shoulder);elbow.position.copy(elbowRest).add(ds);forearm.position.copy(forearmRest).add(ds);parallel.position.copy(parallelRest).add(ds);forearm.rotation.x=parallel.rotation.x=THREE.MathUtils.degToRad(p.forearm);terminal.position.copy(terminalRest).add(ds).add(stationDelta(p.forearm));wristYaw.rotation.y=THREE.MathUtils.degToRad(p.wristYaw);roll.rotation.z=THREE.MathUtils.degToRad(p.roll);pitch.rotation.x=THREE.MathUtils.degToRad(p.pitch);root.updateMatrixWorld(true);}};
}
