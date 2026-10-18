import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {stationAdvance} from '../src/scripts/lib/arm-chain-direction.ts';
const data=JSON.parse(readFileSync(process.env.ARM_CHAIN_DATA??'materials/models/derived/web/arm-chains.json'));
const {motion}=JSON.parse(readFileSync('materials/models/derived/web/arm-parts.json'));
const axes=[[0,-1,0],[0,1,0],[-1,0,0]];
const pairs=[[motion.j0_input_point_m,motion.j0_point_m],[motion.j1_input_point_m,motion.joints[0].point_m],[motion.joints[1].point_m,motion.uwb_point_m]];
for(const loop of data.loops){
 const sign=stationAdvance({...loop,advance_sign:loop.advance_sign??(loop.drive===2?-1:1)},[1,1,1,0,0,0,0]);
 const centers=loop.stations.map(s=>new THREE.Vector3(...s.center));
 for(const end of [0,1]){
  const hub=new THREE.Vector3(...pairs[loop.drive][end]),other=new THREE.Vector3(...pairs[loop.drive][1-end]),out=hub.clone().sub(other).normalize();
  const index=centers.reduce((best,p,i)=>p.clone().sub(hub).dot(out)>centers[best].clone().sub(hub).dot(out)?i:best,0),n=centers.length;
  const actual=centers[(index+1)%n].clone().sub(centers[(index+n-1)%n]).multiplyScalar(sign).normalize();
  const expected=new THREE.Vector3(...axes[loop.drive]).cross(centers[index].clone().sub(hub)).normalize(),dot=actual.dot(expected);
  assert.ok(dot>.98,`J${loop.drive} chain moves against sprocket ${end}: tangent dot=${dot}`);
 }
}
console.log('Chain directions: all three loops match both sprocket tangents.');
