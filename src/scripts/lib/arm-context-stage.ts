import * as THREE from 'three';
import {aboutAxis} from './arm-study-motion';
export const CLIMB_FORWARD=new THREE.Vector3(-.793812173,0,.608163021);
export const LIFT_POINTS=[[-.434342559,-.136701081,-.135801579],[-.096812078,-.136701081,.304764183]];
export const FOOT_POINTS=[[-.466491952,-.204968621,-.111170977],[-.128961471,-.204968621,.329394785]];
export function contextTransform(group:string,stroke:number,world:THREE.Matrix4,advance=0){
 const side=group.startsWith('left')?0:1;
 const offset=(group.endsWith('foot')||group.endsWith('roller'))?-2*stroke:group.endsWith('carriage')||group.endsWith('gear')?-stroke:0;
 const m=world.clone().multiply(new THREE.Matrix4().makeTranslation(0,offset,0));
 if(group.endsWith('gear'))m.multiply(aboutAxis(LIFT_POINTS[side],[.608163021,0,.793812173],THREE.MathUtils.radToDeg(stroke/.018)));
 if(group.endsWith('roller'))m.multiply(aboutAxis(FOOT_POINTS[side],[.608163021,0,.793812173],THREE.MathUtils.radToDeg(advance/.015)));
 return m;
}
