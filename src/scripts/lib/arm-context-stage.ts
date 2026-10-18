import * as THREE from 'three';
import {aboutAxis} from './arm-study-motion';
export const CLIMB_FORWARD=new THREE.Vector3(-.793812173,0,.608163021);
export const LIFT_POINTS=[[-.434342559,-.136701081,-.135801579],[-.096812078,-.136701081,.304764183]];
export const FOOT_POINTS=[[-.466491952,-.204968621,-.111170977],[-.128961471,-.204968621,.329394785]];
export const MAIN_WHEELS=[
 {center:[.226237301,-.253419985,-.052948673],axis:[.976152078,0,.217087816],pivot:[.226240635,-.163433542,-.052963663],steer:-40.005161},
 {center:[-.004848556,-.253419985,-.354620824],axis:[-.555959340,0,-.831209488],pivot:[-.004861320,-.163433542,-.354612287],steer:3.679978},
 {center:[-.306497032,-.253419985,-.123518642],axis:[-.540837843,0,-.841126879],pivot:[-.306509949,-.163433542,-.123510337],steer:4.716102},
 {center:[-.075395995,-.253419985,.178128725],axis:[-.623197267,0,-.782064682],pivot:[-.075408004,-.163433542,.178138295],steer:-1.093199},
];
export function contextTransform(group:string,stroke:number,world:THREE.Matrix4,advance=0,steering=0){
 if(group.startsWith('main_')){
  const i=Number(group.split('_')[1]),w=MAIN_WHEELS[i];
  const m=world.clone().multiply(aboutAxis(w.pivot,[0,1,0],w.steer*steering));
  if(group.endsWith('tire'))m.multiply(aboutAxis(w.center,w.axis,THREE.MathUtils.radToDeg(advance/.059989754)*(i===0?1:-1)));
  return m;
 }
 const side=group.startsWith('left')?0:1;
 const offset=(group.endsWith('foot')||group.endsWith('roller'))?-2*stroke:group.endsWith('carriage')||group.endsWith('gear')?-stroke:0;
 const m=world.clone().multiply(new THREE.Matrix4().makeTranslation(0,offset,0));
 if(group.endsWith('gear'))m.multiply(aboutAxis(LIFT_POINTS[side],[.608163021,0,.793812173],THREE.MathUtils.radToDeg(stroke/.018)));
 if(group.endsWith('roller'))m.multiply(aboutAxis(FOOT_POINTS[side],[.608163021,0,.793812173],THREE.MathUtils.radToDeg(advance/.015)));
 return m;
}
