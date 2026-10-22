import * as THREE from 'three';
import {ATTACK_START,SPIN_START,GUNFIRE_END,GUNFIRE_HZ,GOLD_FRAME,missionState} from './engineer-mission-motion';

type Contact={point:THREE.Vector3;normal:THREE.Vector3;surfaceVelocity:THREE.Vector3;object:string;distance:number};
type Collision={update:(t:number)=>void;cast:(a:THREE.Vector3,b:THREE.Vector3)=>Contact|null};
type Sample={t:number;p:THREE.Vector3;v:THREE.Vector3};
type Impact={t:number;p:THREE.Vector3;n:THREE.Vector3;object:string;incoming:number;outgoing:number;incomingRelative:number;outgoingRelative:number};

/** Authored gunfire: ballistic flight with a fresh leading aim for every shot.
 * The CAD surface supplies each contact point and normal; no in-flight homing.
 * Restitution/friction are illustrative, not a measurement of competition rounds.
 */
export function createMissionProjectiles(scene:THREE.Scene,collision:Collision){
 const gravity=new THREE.Vector3(0,-9.81,0),dt=1/240,radius=.0085;
 const origin=new THREE.Vector3(2.4,.90,-2.0).applyMatrix4(GOLD_FRAME);
 let seed=20251018;
 const random=()=>{seed=(1664525*seed+1013904223)>>>0;return(seed+.5)/4294967296;};
 const gaussian=()=>Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
 const end=GUNFIRE_END,shots:{start:number;flightSeconds:number;aim:THREE.Vector3;scatter:number[];samples:Sample[];impacts:Impact[]}[]=[];
 for(let shotIndex=0;ATTACK_START+shotIndex/GUNFIRE_HZ<end;shotIndex++){
  const start=ATTACK_START+shotIndex/GUNFIRE_HZ;
  let flight=origin.distanceTo(missionState(start).position)/22;
  // A small, deterministic cluster, rather than eight identical converging paths.
  const scatter=[gaussian()*.032,gaussian()*.024,gaussian()*.032];
  const predict=()=>missionState(start+flight).position.clone().add(new THREE.Vector3(scatter[0],.18+scatter[1],scatter[2]));
  for(let j=0;j<8;j++)flight=predict().sub(origin).addScaledVector(gravity,-flight*flight/2).length()/22;
  const aim=predict();
  const velocity=aim.clone().sub(origin).divideScalar(flight).addScaledVector(gravity,-flight/2);
  shots.push({start,flightSeconds:flight,aim:aim.clone(),scatter,samples:[{t:start,p:origin.clone(),v:velocity}],impacts:[]});
 }
 const active=shots.map(()=>true);
 for(let t=ATTACK_START;t<=end+1.45;t+=dt){
  collision.update(t);
  for(let i=0;i<shots.length;i++){
   const shot=shots[i],last=shot.samples.at(-1)!;
   if(!active[i]||t<shot.start||t<last.t)continue;
   const step=Math.min(dt,t+dt-last.t);if(step<=0)continue;
   let p=last.p.clone(),v=last.v.clone(),remaining=step,elapsed=0;
   for(let attempt=0;attempt<3&&remaining>1e-6;attempt++){
    const next=p.clone().addScaledVector(v,remaining).addScaledVector(gravity,remaining*remaining/2),hit=collision.cast(p,next);
    if(!hit){p.copy(next);v.addScaledVector(gravity,remaining);remaining=0;break;}
    const fraction=THREE.MathUtils.clamp(hit.distance/Math.max(p.distanceTo(next),1e-8),0,1),spent=remaining*fraction;
    v.addScaledVector(gravity,spent);const incoming=v.length();
    const normal=hit.normal.clone(),relative=v.clone().sub(hit.surfaceVelocity),incomingRelative=relative.length(),normalSpeed=relative.dot(normal),tangent=relative.clone().addScaledVector(normal,-normalSpeed);
    relative.copy(tangent.multiplyScalar(.75)).addScaledVector(normal,-normalSpeed*.46);v.copy(relative).add(hit.surfaceVelocity);
    const impact={t:last.t+elapsed+spent,p:hit.point.clone(),n:normal,object:hit.object,incoming,outgoing:v.length(),incomingRelative,outgoingRelative:relative.length()};
    shot.impacts.push(impact);p.copy(hit.point).addScaledVector(normal,radius+.0005);remaining-=spent;elapsed+=spent;
    if(shot.impacts.length>=4){active[i]=false;remaining=0;}
   }
   shot.samples.push({t:t+dt,p,v});
   if(t-shot.start>1.35||p.y<-.1||v.length()<.15)active[i]=false;
  }
 }
 const material=new THREE.MeshBasicMaterial({color:0x9fff3d,toneMapped:false});
 const sphere=new THREE.SphereGeometry(radius,10,7);
 const actors=shots.map(()=>{
  const ball=new THREE.Mesh(sphere,material);scene.add(ball);
  const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
  const trail=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xa8ff55,transparent:true,opacity:.7,toneMapped:false}));scene.add(trail);
  return {ball,trail};
 });
 const impacts=shots.flatMap(s=>s.impacts),rings=Array.from({length:6},()=>{const ring=new THREE.Mesh(new THREE.RingGeometry(.010,.025,18),new THREE.MeshBasicMaterial({color:0xbaff73,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));scene.add(ring);return ring;});
 function frame(time:number){
  shots.forEach((shot,i)=>{const {ball,trail}=actors[i],samples=shot.samples,last=samples.at(-1)!;ball.visible=trail.visible=time>=shot.start&&time<=last.t;
   if(!ball.visible)return;
   let a=Math.min(samples.length-2,Math.max(0,Math.floor((time-shot.start)/dt)));
   while(a>0&&samples[a].t>time)a--;while(a<samples.length-2&&samples[a+1].t<time)a++;
   const before=samples[a],after=samples[a+1],u=THREE.MathUtils.clamp((time-before.t)/(after.t-before.t),0,1);
   ball.position.copy(before.p).lerp(after.p,u);
   const tail=ball.position.clone().addScaledVector(before.v,-.006);trail.geometry.setFromPoints([tail,ball.position]);
  });
  const recent=impacts.filter(i=>time>=i.t&&time<i.t+.09);
  rings.forEach((ring,i)=>{const hit=recent[i];ring.visible=!!hit;if(!hit)return;ring.position.copy(hit.p).addScaledVector(hit.n,.002);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),hit.n);const u=(time-hit.t)/.09;ring.scale.setScalar(.6+u);(ring.material as THREE.MeshBasicMaterial).opacity=.65*(1-u);});
 }
 return {frame,report:{start:ATTACK_START,spinStart:SPIN_START,end,frequencyHz:GUNFIRE_HZ,muzzleSpeed:22,gravity:9.81,radius,seed:20251018,shots:shots.map(s=>({start:s.start,flightSeconds:s.flightSeconds,aim:s.aim.toArray(),scatter:s.scatter,impacts:s.impacts.map(h=>({...h,p:h.p.toArray(),n:h.n.toArray()}))})),note:'Per-shot leading aim at30Hz until the first return-road rib contact. Existing rounds finish ballistic flight. CAD triangle contact normals, moving-surface relative reflection, restitution0.46 and tangential retention0.75.'}};
}
