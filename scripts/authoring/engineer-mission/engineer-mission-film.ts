/** Offline authoring scene. The website receives its rendered MP4, not this scene. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {armMotionMatrices,aboutAxis,type SevenAngles} from '../../../src/scripts/lib/arm-study-motion';
import {contextTransform,MAIN_WHEELS} from '../../../src/scripts/lib/arm-context-stage';
import {CANONICAL,UPPER_UPRIGHT,STORES,SILVER_CENTERS,GOLD_CENTER,SILVER_PICKUP_GRIPS,SILVER_TOP_GRIP,STORED_ORE_ROTATIONS,configureSilverGrasps,SILVER_PROP,GOLD_PROP,STATION_WORLD,STEP_FRAME,GOLD_FRAME,EXCHANGE_FRAME,missionState,missionJ0,toolPose,ease,MISSION_DURATION,publicTime} from './engineer-mission-motion';
import {createStationRig} from './engineer-station-rig';
import {createMissionCollision} from './engineer-mission-collision';
import {createMissionProjectiles} from './engineer-mission-projectiles';
import {missionFilm as copy} from '../../../src/data/content';

declare global{interface Window{missionFilm:any}}
const params=new URLSearchParams(location.search),width=Number(params.get('width')??1920),height=width*9/16,lang=params.get('lang')==='en'?'en':'zh';
const text=(value:{zh:string;en:string})=>value[lang];
const output=document.querySelector<HTMLCanvasElement>('#film')!;output.width=width;output.height=height;
const ctx=output.getContext('2d',{alpha:false})!;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setSize(width,height);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
const scene=new THREE.Scene();scene.background=new THREE.Color('#070d17');scene.fog=new THREE.FogExp2('#070d17',.025);
const camera=new THREE.PerspectiveCamera(35,16/9,.01,100);
scene.add(new THREE.HemisphereLight(0xe6efff,0x26384d,2.4));
for(const [p,color,power] of [[[2,4,3],0xffffff,3.5],[[-3,2,1],0x8cb1dc,2.0],[[1,1,-3],0xf2b53a,1.1]] as const){const light=new THREE.DirectionalLight(color,power);light.position.fromArray(p);scene.add(light);}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshBasicMaterial({color:0x090f19}));ground.rotation.x=-Math.PI/2;ground.position.y=-.004;scene.add(ground);
const grid=new THREE.GridHelper(32,160,0x25394c,0x172536);grid.position.y=-.002;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.28;scene.add(grid);
const loader=new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/materials/models/derived/web/draco/').setWorkerLimit(1));
const root='/materials/models/derived/web/';
const [meta,arm,context,trajectory,lightData,grasps,silverModel,goldModel,silverIsland,goldIsland,stationModel,transmitter]=await Promise.all([
 fetch(root+'arm-parts.json').then(r=>r.json()),loader.loadAsync(root+'arm-parts.glb').then(x=>x.scene),loader.loadAsync(root+'arm-context.glb').then(x=>x.scene),fetch('trajectory.json').then(r=>r.json()),fetch('blue-lights.json').then(r=>r.json()),
 fetch('grasps.json').then(r=>r.json()),...['ore-silver','ore-gold','silver-island','gold-island','exchange-station'].map(name=>loader.loadAsync('/materials/models/derived/rm2025-field/models/'+name+'.glb').then(x=>x.scene)),loader.loadAsync(root+'mission-transmitter.glb').then(x=>x.scene),
]);
configureSilverGrasps(grasps);
const mapImage=new Image();mapImage.src='/materials/images/derived/inputs/rm2025-field-reference/rules-p037.png';await mapImage.decode();
const metal=new Set<THREE.Material>();
for(const model of [arm,context,transmitter])model.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;mesh.castShadow=false;for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){if(metal.has(m))continue;metal.add(m);const mat=m as THREE.MeshStandardMaterial;mat.transparent=false;mat.opacity=1;mat.depthWrite=true;mat.side=THREE.FrontSide;mat.roughness=Math.max(.35,mat.roughness??.5);if(mat.color){const hsl={h:0,s:0,l:0};mat.color.getHSL(hsl);if(hsl.l<.07)mat.color.offsetHSL(0,0,.022);}}});
arm.updateMatrixWorld(true);context.updateMatrixWorld(true);
const parts:any[]=[];for(const spec of meta.parts){let node:THREE.Object3D|undefined;arm.traverse(o=>{if(o.userData.part_key===spec.key)node=o;});if(!node)throw new Error('Missing arm part '+spec.key);node!.matrixAutoUpdate=false;parts.push({node:node!,rest:node!.matrix.clone(),spec});}
transmitter.name='mission-transmitter';transmitter.matrixAutoUpdate=false;parts.push({node:transmitter,rest:new THREE.Matrix4(),spec:{key:'mission-transmitter',motion_group:'link_3'}});scene.add(transmitter);
const contextParts:any[]=[];context.traverse(o=>{if(o.userData.context_group){o.matrixAutoUpdate=false;contextParts.push({node:o,rest:o.matrix.clone(),group:o.userData.context_group});}});scene.add(arm,context);
const lightMaterial=new THREE.MeshBasicMaterial({color:0x5acaff,toneMapped:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const ledNodes=lightData.lights.map((item:any)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(item.positions.flat(),3));g.setIndex(item.indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,lightMaterial);mesh.matrixAutoUpdate=false;scene.add(mesh);return {mesh,host:item.host};});
// Surface-only light: no point lamps, bloom or blue spill on the vehicle.

function schematic(model:THREE.Object3D,removeOres=false){
 const fills:THREE.BufferGeometry[]=[],edges:THREE.BufferGeometry[]=[];model.updateMatrixWorld(true);
 model.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;let parent:THREE.Object3D|null=o;if(removeOres){while(parent){if(/ore_(silver|gold)/.test(parent.name))return;parent=parent.parent;}}
  const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);g.deleteAttribute('uv');g.deleteAttribute('tangent');const unindexed=g.index?g.toNonIndexed():g;unindexed.computeVertexNormals();for(const name of Object.keys(unindexed.attributes))if(!['position','normal'].includes(name))unindexed.deleteAttribute(name);fills.push(unindexed);edges.push(new THREE.EdgesGeometry(g,28));
 });
 const group=new THREE.Group();if(fills.length)group.add(new THREE.Mesh(mergeGeometries(fills),new THREE.MeshBasicMaterial({color:0x365376,transparent:true,opacity:.035,depthWrite:false})));if(edges.length)group.add(new THREE.LineSegments(mergeGeometries(edges),new THREE.LineBasicMaterial({color:0xf2b53a,transparent:true,opacity:.52})));return group;
}
function fieldStyle(model:THREE.Object3D,remove?:RegExp,teamLight?:number){
 const meshes:THREE.Mesh[]=[];model.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
 for(const mesh of meshes){let p:THREE.Object3D|null=mesh,ore:'gold'|'silver'|false=false,light=false,removed=false,indicator=false,lampColour:number|undefined;
  while(p){if(remove?.test(p.name))removed=true;if(/ore_gold/.test(p.name))ore='gold';if(/ore_silver/.test(p.name))ore='silver';if(/status_indicator|diffuser/i.test(p.name))indicator=true;const id=p.userData.cad_node_id;if([196,197,208,209].includes(id))lampColour=0x168dff;if([198,199,210,211].includes(id))lampColour=0xff3e3e;if([196,197,198,199,208,209,210,211,783,784,829,884].includes(id))light=true;p=p.parent;}
  if(removed){mesh.visible=false;continue;}
  const style=(original:THREE.Material)=>{const m=original as THREE.MeshPhysicalMaterial,hsl={h:0,s:0,l:0};m.color?.getHSL(hsl);const glass=m.transmission>.1||/glass/i.test(m.name),lit=light&&hsl.s>.45,whiteLamp=indicator&&hsl.l>.65,colour=teamLight??lampColour;return new THREE.MeshBasicMaterial({color:lit?(colour===0xff3e3e?0xff7375:0x5acaff):whiteLamp?0xffffff:ore==='gold'?0x77551c:ore==='silver'?0x74818d:glass?0x45637c:0x101b29,transparent:glass,opacity:glass?.12:1,depthWrite:!glass,toneMapped:!(lit||whiteLamp),side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});};
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(style):style(mesh.material);
  const lines=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,5),new THREE.LineBasicMaterial({color:0xf2b53a,transparent:true,opacity:ore?.72:.64,toneMapped:false,depthWrite:false}));mesh.add(lines);
 }
 return model;
}
// All props remain in their official field positions throughout the film.
function place(o:THREE.Object3D,m:THREE.Matrix4){o.matrixAutoUpdate=false;o.matrix.copy(m);o.matrixWorldNeedsUpdate=true;scene.add(o);}
fieldStyle(silverIsland,/ore_silver_[34]$/);silverIsland.traverse(o=>{if([5,100,112,115,130,132,594,595].includes(o.userData.cad_node_id))o.visible=false;});place(silverIsland,SILVER_PROP);
fieldStyle(goldIsland,/ore_gold_3$/);place(goldIsland,GOLD_PROP);
const field=await fetch('/materials/models/derived/rm2025-field/models/mission-field-context.json').then(r=>r.json());
const fieldRoot=new THREE.Group();scene.add(fieldRoot);
for(const item of field.meshes){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(item.positions,3));g.setIndex(item.indices);g.computeVertexNormals();
 const paint=[777,778,1293,1294].includes(item.sourceId),bands=paint||[94,96,98,101,115,774,775,1276,1278,1280,1290,1291].includes(item.sourceId);
 const blue=(item.bounds.min[0]+item.bounds.max[0])>0;
 const materials=bands?item.colors.map((rgb:number[])=>new THREE.MeshBasicMaterial({color:Math.max(...rgb)-Math.min(...rgb)>.4?(paint?0xabb8c6:blue?0x92ffff:0xffefb0):0x101b29,toneMapped:paint,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})):new THREE.MeshBasicMaterial({color:0x101b29,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 if(bands)item.triangleColorIndices.forEach((index:number,i:number)=>g.addGroup(i*3,3,index));
 const mesh=new THREE.Mesh(g,materials);mesh.userData.sourceId=item.sourceId;fieldRoot.add(mesh);
 mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,5),new THREE.LineBasicMaterial({color:0xf2b53a,transparent:true,opacity:.48,toneMapped:false,depthWrite:false})));
 if([69,71].includes(item.sourceId)){
  // The broadcast shows a narrow luminous upper rim around each base pad.
  // Follow the original CAD top edges; do not invent a rectangular outline.
  const e=new THREE.EdgesGeometry(g,20).getAttribute('position'),top=item.bounds.max[1],material=new THREE.MeshBasicMaterial({color:blue?0x92ffff:0xffefb0,toneMapped:false});
  for(let i=0;i<e.count;i+=2){const a=new THREE.Vector3().fromBufferAttribute(e,i),b=new THREE.Vector3().fromBufferAttribute(e,i+1);if(Math.abs(a.y-top)>.0002||Math.abs(b.y-top)>.0002||a.distanceTo(b)<.01)continue;a.y+=.001;b.y+=.001;scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a,b),1,.006,6,false),material));}
 }
}
const fieldLightData=await fetch('/materials/models/derived/rm2025-field/models/mission-field-lights.json').then(r=>r.json());
for(const item of fieldLightData.meshes){if([49,50,51,52,1266,1267,1268,1269,1270,1271].includes(item.sourceId))continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(item.positions,3));g.setIndex(item.indices);const blue=(item.bounds.min[0]+item.bounds.max[0])>0;scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:blue?0x92ffff:0xffefb0,toneMapped:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})));}
const [markings,bumps]=await Promise.all(['mission-field-markings','mission-bumps'].map(name=>fetch('/materials/models/derived/rm2025-field/models/'+name+'.json').then(r=>r.json())));
for(const item of markings.meshes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(item.positions,3));g.setIndex(item.indices);scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xb5bec7,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3})));}
for(const item of bumps.meshes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(item.positions,3));g.setIndex(item.indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x273342,side:THREE.DoubleSide}));mesh.userData.sourceId='bump:'+item.source;mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,15),new THREE.LineBasicMaterial({color:0xb69a60,transparent:true,opacity:.6})));fieldRoot.add(mesh);}
// The complete original two-sided buff assembly occupies its actual central
// field position. Both sides share one axis; facing either side reverses the
// apparent direction, as in rule5.6.2.1. Pillars and suspension stay fixed.
const energyResponse=await fetch('/materials/models/derived/rm2025-field/models/mission-energy.json.gz');
const energy=await new Response(energyResponse.body!.pipeThrough(new DecompressionStream('gzip'))).json();
const energyAxis=new THREE.Vector3().fromArray(energy.rotationAxis.direction),energyPivot=new THREE.Vector3().fromArray(energy.rotationAxis.point),energyRotor=new THREE.Group();energyRotor.position.copy(energyPivot);scene.add(energyRotor);
const energyLampNodes:{mesh:THREE.Mesh;arm:number;team:string;lit:boolean}[]=[];
const energyStaticGeometry:THREE.BufferGeometry[]=[];
for(const item of energy.meshes){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(item.positions,3));g.setIndex(item.indices);g.computeVertexNormals();
 const saturated=item.colors.some((c:number[])=>Math.max(...c)-Math.min(...c)>.4),lit=item.diffuser&&saturated;
 const colour=item.rotor==='blue'?0x5acaff:0xff7375;
 const material=new THREE.MeshBasicMaterial({color:lit?colour:0x101b29,side:THREE.DoubleSide,toneMapped:!lit,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 const mesh=new THREE.Mesh(g,material);mesh.userData.sourceId=item.sourceId;
 mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,12),new THREE.LineBasicMaterial({color:0xf2b53a,transparent:true,opacity:.52,toneMapped:false,depthWrite:false})));
 if(item.rotor){mesh.position.copy(energyPivot).negate();energyRotor.add(mesh);}else {scene.add(mesh);energyStaticGeometry.push(g);}
 if(lit)energyLampNodes.push({mesh,arm:item.arm,team:item.rotor,lit});
}
const energyCollider=new THREE.Mesh(mergeGeometries(energyStaticGeometry)!,new THREE.MeshBasicMaterial());energyCollider.userData.sourceId='energy-static';energyCollider.visible=false;fieldRoot.add(energyCollider);
const baseResponse=await fetch('/materials/models/derived/rm2025-field/models/mission-bases.json.gz');
const bases=await new Response(baseResponse.body!.pipeThrough(new DecompressionStream('gzip'))).json();
const baseDiffusers=new Set([1453,1471,1489,2324,2342,2360]);
for(const item of bases.meshes){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(item.positions,3));g.setIndex(item.indices);
 const lit=baseDiffusers.has(item.sourceId),blue=(item.bounds.min[0]+item.bounds.max[0])>0;
 const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:lit?(blue?0x5acaff:0xff7375):0x101b29,side:THREE.DoubleSide,toneMapped:!lit,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));
 mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g,12),new THREE.LineBasicMaterial({color:0xf2b53a,transparent:true,opacity:.42,toneMapped:false,depthWrite:false})));scene.add(mesh);
}
const ores=[schematic(silverModel),schematic(silverModel),schematic(goldModel)];ores.forEach((o,i)=>{scene.add(o);o.traverse(n=>{if((n as THREE.LineSegments).isLineSegments)((n as THREE.LineSegments).material as THREE.LineBasicMaterial).color.set(i===2?0xf2b53a:0xc7d8e9);if((n as THREE.Mesh).isMesh){const m=(n as THREE.Mesh).material as THREE.MeshBasicMaterial;m.transparent=false;m.opacity=1;m.color.set(i===2?0x735019:0x334255);m.depthWrite=true;}});});
fieldStyle(stationModel,undefined,0x168dff);
// Light construction lines explain the collector behind the station wall.
// Only housing fills are translucent; the complete original edge mesh stays.
stationModel.traverse(o=>{if([785,786,787,790].includes(o.userData.cad_node_id))o.traverse(n=>{if((n as THREE.Mesh).isMesh){const mesh=n as THREE.Mesh;for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){m.transparent=true;m.opacity=.14;m.depthWrite=false;}}});});
const stationRig=createStationRig(stationModel,STATION_WORLD);scene.add(stationModel);
let projectileSystem:ReturnType<typeof createMissionProjectiles>|null=null;
let collisionWorld:ReturnType<typeof createMissionCollision>|null=null;
const mapTrail=Array.from({length:Math.ceil(MISSION_DURATION*10)+1},(_,i)=>missionState(i/10).map);
const latest:any={};
function angles(t:number){t=THREE.MathUtils.clamp(t,0,MISSION_DURATION);const f=Math.min(t*trajectory.fps,trajectory.samples.length-1),i=Math.min(Math.floor(f),trajectory.samples.length-2),u=f-i;const q=trajectory.samples[i].map((a:number,k:number)=>THREE.MathUtils.lerp(a,trajectory.samples[i+1][k],u)) as SevenAngles;q[0]=missionJ0(missionState(t));return q;}
function oreAtTool(ore:THREE.Object3D,p:{position:THREE.Vector3;rotation:THREE.Quaternion},grip?:THREE.Quaternion){ore.position.copy(p.position).add(new THREE.Vector3(0,0,.1002).applyQuaternion(p.rotation));ore.quaternion.copy(p.rotation);if(grip)ore.quaternion.multiply(grip);}
// Integrate actual chassis motion once; frame(t) remains deterministic even when
// authoring seeks backwards. Wheel phase never uses time * instantaneous speed.
const wheelSamples:{steer:number;distance:number}[][]=[];
for(let n=0;n<=MISSION_DURATION*trajectory.fps;n++){
 const t=n/trajectory.fps,s=missionState(t),before=missionState(Math.max(0,t-.01)),after=missionState(Math.min(MISSION_DURATION,t+.01)),dt=after.time-before.time||1,velocity=after.position.clone().sub(before.position).multiplyScalar(1/dt).applyAxisAngle(new THREE.Vector3(0,1,0),-s.yaw),omega=(after.yaw-before.yaw)/dt;
 wheelSamples.push(MAIN_WHEELS.map((w,i)=>{const r=new THREE.Vector3().fromArray(w.center).applyMatrix4(CANONICAL),vel=velocity.clone();vel.x+=omega*r.z;vel.z-=omega*r.x;const old=n?wheelSamples[n-1][i]:{steer:0,distance:0},speed=Math.hypot(vel.x,vel.z),angle=THREE.MathUtils.radToDeg(Math.atan2(vel.x,vel.z)),steer=speed<.003?old.steer:old.steer+THREE.MathUtils.euclideanModulo(angle-old.steer+180,360)-180;return {steer,distance:old.distance+(n?speed/trajectory.fps:0)};}));
}
function frame(t:number){
 t=THREE.MathUtils.clamp(t,0,MISSION_DURATION);
 const state=missionState(t),s=state.storyTime,q=angles(t),matrices=armMotionMatrices(meta.motion,q),tool=toolPose(meta.motion,q,state.body),body=state.body;
 energyRotor.quaternion.setFromAxisAngle(energyAxis,t*Math.PI/3);
 for(const lamp of energyLampNodes){const selected=lamp.team==='blue'?3324:3107;(lamp.mesh.material as THREE.MeshBasicMaterial).color.set(lamp.team==='blue'?0x5acaff:0xff7375).multiplyScalar(lamp.arm===selected?1:.13);}
 for(const p of parts){p.node.matrix.copy(body).multiply(matrices.get(p.spec.motion_group)!).multiply(p.rest);p.node.matrixWorldNeedsUpdate=true;}
 const wf=Math.min(t*trajectory.fps,wheelSamples.length-1),wi=Math.min(Math.floor(wf),wheelSamples.length-2),wu=wf-wi;
 const spinWheels=MAIN_WHEELS.map((w,i)=>{const a=wheelSamples[wi][i],b=wheelSamples[wi+1][i],heading=THREE.MathUtils.lerp(a.steer,b.steer,wu),distance=THREE.MathUtils.lerp(a.distance,b.distance,wu),steer=state.wheelBody.clone().multiply(aboutAxis(w.pivot,[0,1,0],w.steer+heading));steer.elements[13]+=state.wheelOffsets[i];return {steer,roll:distance/.059989754*180/Math.PI*(i===0?1:-1)};});
 for(const p of contextParts){if(spinWheels&&p.group.startsWith('main_')){const i=Number(p.group.split('_')[1]),w=MAIN_WHEELS[i];p.node.matrix.copy(spinWheels[i].steer);if(p.group.endsWith('tire'))p.node.matrix.multiply(aboutAxis(w.center,w.axis,spinWheels[i].roll));}else p.node.matrix.copy(contextTransform(p.group,state.lift,body,state.drive,1));if(p.group==='gimbal_context')p.node.matrix.multiply(matrices.get('j0_carrier')!);p.node.matrix.multiply(p.rest);p.node.matrixWorldNeedsUpdate=true;}
 ledNodes.forEach(({mesh,host}:any)=>{mesh.matrix.copy(body);if(host==='gimbal_context')mesh.matrix.multiply(matrices.get('j0_carrier')!);mesh.matrixWorldNeedsUpdate=true;});

 for(let i=0;i<2;i++){
  const ore=ores[i],status=state.silver[i];ore.visible=status!==3;ore.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
  if(status===0)ore.position.copy(SILVER_CENTERS[i]);
  else if(status===1)oreAtTool(ore,tool,s<23?SILVER_PICKUP_GRIPS[i]:SILVER_TOP_GRIP);
  else {const upper=body.clone().multiply(matrices.get('j0_carrier')!);ore.position.copy(STORES[i]).applyMatrix4(upper);ore.quaternion.setFromRotationMatrix(upper).multiply(STORED_ORE_ROTATIONS[i]);}
 }
 const gold=ores[2];gold.visible=true;if(state.gold===0){gold.position.copy(GOLD_CENTER);gold.quaternion.setFromRotationMatrix(GOLD_PROP);}else if(state.gold===1)oreAtTool(gold,tool);
 stationRig.apply(state.stationPose);
 const grip=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
 function recovered(ore:THREE.Object3D,release:number,oreGrip?:THREE.Quaternion){
  const releaseTime=publicTime(release),dropSlot=missionState(releaseTime).slot,age=Math.max(0,t-releaseTime);ore.quaternion.setFromRotationMatrix(t<releaseTime?state.slot:dropSlot).multiply(grip);if(oreGrip)ore.quaternion.multiply(oreGrip);
  ore.position.set(0,-.0199,-.106).applyMatrix4(t<releaseTime?state.slot:dropSlot);
  if(t>=releaseTime){const normal=new THREE.Vector3(0,0,1).transformDirection(dropSlot),axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)],halfY=.1*axes.reduce((sum,axis)=>sum+Math.abs(axis.applyQuaternion(ore.quaternion).y),0),floor=.021+halfY+.001,vy=.50*normal.y,hit=(vy+Math.sqrt(vy*vy+19.62*Math.max(0,ore.position.y-floor)))/9.81,fall=Math.min(age,hit);ore.position.addScaledVector(normal,.50*fall).add(new THREE.Vector3(0,-4.905*fall*fall,0));
   // The ore comes to rest on the real rear collection-box floor.
   const local=ore.position.clone().applyMatrix4(STATION_WORLD.clone().invert());local.y=Math.max(floor,local.y);ore.position.copy(local.applyMatrix4(STATION_WORLD));}
  ore.visible=true;
 }
 if(state.gold>=2)recovered(gold,68.65);
 if(state.silver[0]===3)recovered(ores[0],77.05,SILVER_TOP_GRIP);
 projectileSystem?.frame(t);
 const shot=state.chapter;
 // A single, deterministic follow camera. Framing changes interpolate in world
 // space; the vehicle, cargo and field never reset when a chapter changes.
 const cameraKeys=[
  {t:0,o:[2.8,1.85,-3.2],h:-90,a:[0,.35,.35]},{t:5.5,o:[1.85,1.35,-2.05],h:-90,a:[0,.45,.20]},
  {t:22,o:[1.85,1.35,-2.05],h:-90,a:[0,.45,.20]},{t:25.8,o:[2.65,1.4,-.95],h:-90,a:[0,.42,0]},
  {t:39.5,o:[2.65,1.4,-.95],h:-90,a:[0,.42,0]},{t:43,o:[2.6,1.9,-2.65],h:-135,a:[0,.55,.35]},
  {t:46,o:[1.85,1.4,-1.9],h:-135,a:[0,.45,.45]},
  {t:53.5,o:[1.85,1.4,-1.9],h:-135,a:[0,.45,.45]},{t:56,o:[2.1,1.65,-2.6],h:-135,a:[0,.40,0]},
  {t:58.7,o:[2.1,1.65,-2.6],h:-135,a:[0,.40,0]},{t:62.4,o:[-2.05,1.65,-2.05],h:90,a:[0,.64,.45]},
  {t:66.4,o:[-2.05,1.65,-2.05],h:90,a:[0,.64,.45]},{t:67.9,o:[-2.4,3.3,.55],h:90,a:[0,.7,.80]},{t:68.8,o:[-2.4,3.3,.55],h:90,a:[0,.7,.80]},
  {t:70.7,o:[-2.05,1.65,-2.05],h:90,a:[0,.64,.45]},{t:74.8,o:[-2.05,1.65,-2.05],h:90,a:[0,.64,.45]},
  {t:76.3,o:[-2.4,3.3,.55],h:90,a:[0,.7,.80]},{t:77.5,o:[-2.4,3.3,.55],h:90,a:[0,.7,.80]},{t:79.5,o:[-2.05,1.65,-2.05],h:90,a:[0,.64,.45]},
  {t:80,o:[-2.05,1.65,-2.05],h:90,a:[0,.64,.45]},
 ];
 let ci=cameraKeys.findIndex(k=>k.t>=s);if(ci<=0)ci=1;const ca=cameraKeys[ci-1],cb=cameraKeys[ci],cu=ease((s-ca.t)/(cb.t-ca.t));
 const endpoint=(k:typeof ca,part:'o'|'a')=>new THREE.Vector3().fromArray(k[part]).applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(k.h));
 camera.position.copy(state.position).add(endpoint(ca,'o').lerp(endpoint(cb,'o'),cu));const aim=state.position.clone().add(endpoint(ca,'a').lerp(endpoint(cb,'a'),cu));camera.lookAt(aim);scene.updateMatrixWorld(true);
 renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0);drawHud(state,tool.position,shot);
 if(state.fade<1){ctx.fillStyle=`rgba(7,13,23,${1-state.fade})`;ctx.fillRect(0,0,width,height);}
 Object.assign(latest,{time:t,storyTime:s,shot,chapter:state.chapter,q,tool:tool.position.toArray(),silver:state.silver,gold:state.gold,position:state.position.toArray(),heading:state.heading,gimbalHeading:state.gimbalHeading,yaw:state.yaw,slot:state.slot.elements,camera:camera.position.toArray(),aim:aim.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,blueLights:lightData.lights.length});
}
const font='"Microsoft YaHei", "Arial", sans-serif';
function drawHud(state:ReturnType<typeof missionState>,tcp:THREE.Vector3,shot:number){
 const scale=width/1920;ctx.save();ctx.scale(scale,scale);
 ctx.fillStyle='#f2b53a';ctx.fillRect(60,59,4,31);ctx.font=`500 26px ${font}`;ctx.fillStyle='#e7eef6';ctx.fillText(text(copy.phases[state.chapter]),81,84);
 ctx.font=`18px ${font}`;ctx.fillStyle='#a6b6c9';ctx.fillText(text(copy.illustration),62,121);
 const note=state.chapter===1?copy.notes[0]:state.chapter===2?copy.notes[1]:state.chapter===4?copy.notes[2]:state.chapter===6?copy.notes[3]:null;
 if(note){ctx.fillStyle='rgba(7,13,23,.85)';ctx.fillRect(60,947,730,64);ctx.fillStyle='#f2b53a';ctx.fillRect(60,947,3,64);ctx.font=`24px ${font}`;ctx.fillStyle='#dbe6f2';ctx.fillText(text(note),82,988);}
 drawMap(state);
 // Quiet, literal ore inventory keeps the three-ore story legible.
 ctx.font=`17px ${font}`;ctx.fillStyle='#8fa3bb';ctx.fillText(text(copy.cargo),1460,1000);
 const inventory=[state.silver[0]===2,state.silver[1]===2,state.gold===1];
 for(let i=0;i<3;i++){ctx.strokeStyle=i===2?'#f2b53a':'#b8ccdf';ctx.lineWidth=1.5;ctx.strokeRect(1650+i*48,980,25,25);if(inventory[i]){ctx.fillStyle=i===2?'#f2b53a':'#b8ccdf';ctx.fillRect(1655+i*48,985,15,15);}}
 ctx.restore();
}
function drawMap(state:ReturnType<typeof missionState>){
 const x=1440,y=58,w=418,h=264;ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(7,13,23,.96)';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#536478';ctx.lineWidth=1;ctx.strokeRect(.5,.5,w-1,h-1);
 const fx=10,fy=36,fw=398,fh=219;
 ctx.drawImage(mapImage,mapImage.width*.18146,mapImage.height*.12611,mapImage.width*.6245,mapImage.height*.24333,fx,fy,fw,fh);
 const point=(time:number)=>{const f=THREE.MathUtils.clamp(time*10,0,mapTrail.length-1),i=Math.min(Math.floor(f),mapTrail.length-2),u=f-i,a=mapTrail[i],b=mapTrail[i+1];return [fx+fw*THREE.MathUtils.lerp(a[0],b[0],u),fy+fh*THREE.MathUtils.lerp(a[1],b[1],u)];};
 const moving=state.speed>.04||state.climb>0&&state.storyTime<38;
 // A short luminous wake preserves the actual path without burying the map
 // beneath a permanent full-mission polyline.
 for(let i=0;i<70;i++){const age=(70-i)/10,t=state.time-age;if(t<0)continue;const a=point(t),b=point(t+.1);if(Math.hypot(a[0]-b[0],a[1]-b[1])<.03)continue;ctx.strokeStyle=`rgba(94,201,255,${.08+.82*(i/70)**2})`;ctx.lineWidth=1.2+1.2*i/70;ctx.beginPath();ctx.moveTo(...a as [number,number]);ctx.lineTo(...b as [number,number]);ctx.stroke();}
 const legEnd=publicTime(state.storyTime<6?6:state.storyTime<23?23:state.storyTime<26?26:state.storyTime<40?40:state.storyTime<54?54:state.storyTime<62?62:80);
 if(moving){
  const futureEnd=Math.min(legEnd,state.time+7),path: number[][]=[];
  for(let t=state.time;t<=futureEnd;t+=.15)path.push(point(t));path.push(point(futureEnd));
  ctx.strokeStyle='rgba(244,211,141,.6)';ctx.lineWidth=1.5;ctx.setLineDash([3,5]);ctx.lineDashOffset=-state.time*10;ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<4;i++){const u=(state.time*.55+i/4)%1,p=point(state.time+(futureEnd-state.time)*u);ctx.fillStyle=`rgba(255,232,182,${.35+.65*(1-u)})`;ctx.beginPath();ctx.arc(p[0],p[1],2.1*(1-u*.4),0,Math.PI*2);ctx.fill();}
 }
 const destination=point(legEnd),pulse=(state.time*.8)%1;
 ctx.strokeStyle=`rgba(242,181,58,${.65*(1-pulse)})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(destination[0],destination[1],7+12*pulse,0,Math.PI*2);ctx.stroke();
 ctx.save();ctx.translate(destination[0],destination[1]);ctx.rotate(Math.PI/4);ctx.strokeStyle='#f2b53a';ctx.strokeRect(-3,-3,6,6);ctx.restore();
 const px=fx+fw*state.map[0],py=fy+fh*state.map[1];
 ctx.save();ctx.translate(px,py);ctx.rotate(-state.gimbalHeading+Math.PI);ctx.fillStyle='rgba(114,214,255,.16)';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,25,-Math.PI/2-.42,-Math.PI/2+.42);ctx.closePath();ctx.fill();ctx.fillStyle='#bdefff';ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(-3,-10);ctx.lineTo(3,-10);ctx.closePath();ctx.fill();ctx.restore();
 ctx.fillStyle='#138de0';ctx.beginPath();ctx.arc(px,py,7.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c8efff';ctx.lineWidth=1.5;ctx.stroke();ctx.font=`bold 11px ${font}`;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('2',px,py+4);ctx.textAlign='left';
 ctx.font=`14px ${font}`;ctx.fillStyle='#9db0c6';ctx.fillText(text(copy.map),15,23);ctx.textAlign='right';ctx.fillStyle=moving?'#bdefff':'#f2cf8a';ctx.fillText(text(copy.mapActions[state.chapter]),w-15,23);ctx.restore();
}
await document.fonts.ready;frame(0);
console.log('BAKE_PROJECTILES');
collisionWorld=createMissionCollision(meta.motion,parts,contextParts,fieldRoot,silverModel);
if(!params.has('skipProjectiles'))projectileSystem=createMissionProjectiles(scene,{update(t){collisionWorld!.update(missionState(t),angles(t));},cast(a,b){return collisionWorld!.cast(a,b);}});
console.log('PROJECTILES_READY',projectileSystem?.report.shots.length);
window.missionFilm={async exportGeometry(){const data=await new GLTFExporter().parseAsync(collisionWorld!.geometrySnapshot(),{binary:true,onlyVisible:false});const blob=new Blob([data as ArrayBuffer],{type:'model/gltf-binary'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='collision-geometry.glb';a.click();return {bytes:blob.size};},projectileReport:projectileSystem?.report,auditStation(times:number[]){return times.map(t=>{frame(t);const s=missionState(t);collisionWorld!.update(s,angles(t));return {time:t,hits:collisionWorld!.intersectionsWith(stationModel)};});},auditCollisions(times:number[]){collisionWorld??=createMissionCollision(meta.motion,parts,contextParts,fieldRoot,silverModel);return times.map(t=>collisionWorld!.audit(missionState(t),angles(t)));},ready:true,posterTime:publicTime(51.5),duration:MISSION_DURATION,frame,state:latest,canvas:output,async record(factor=1,frameCount=MISSION_DURATION*30,startSecond=0){
 if('VideoEncoder' in window){
  const config={codec:'avc1.640028',width,height,bitrate:4000000,framerate:30,hardwareAcceleration:'prefer-hardware' as const,latencyMode:'realtime' as const,avc:{format:'annexb' as const}};
  const support=await VideoEncoder.isConfigSupported(config);
  if(support.supported){
   const chunks:Uint8Array<ArrayBuffer>[]=[];let failure:Error|null=null;
   const encoder=new VideoEncoder({output(chunk){const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);chunks.push(data);},error(error){failure=error;}});encoder.configure(config);
   for(let i=0;i<frameCount;i++){
    frame(startSecond+i/30);const videoFrame=new VideoFrame(output,{timestamp:Math.round(i*1e6/30),duration:Math.round(1e6/30)});encoder.encode(videoFrame,{keyFrame:i%60===0});videoFrame.close();
    while(encoder.encodeQueueSize>3&&!failure)await new Promise(r=>setTimeout(r,0));if(failure)throw failure;
    if(i%300===0)console.log('ENCODE_PROGRESS',i,'/',frameCount);if(i%30===0)await new Promise(r=>setTimeout(r,0));
   }
   await encoder.flush();encoder.close();const blob=new Blob(chunks,{type:'video/h264'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='engineer-mission-'+lang+'.h264';a.click();return {frames:frameCount,seconds:frameCount/30,captureFactor:1,codec:'h264',bytes:blob.size};
  }
 }
 const chunks:BlobPart[]=[],stream=output.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:14000000});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const done=new Promise<Blob>(r=>recorder.onstop=()=>r(new Blob(chunks,{type:'video/webm'})));
 let start=performance.now(),frames=0;recorder.start(1000);
 await new Promise<void>((resolve,reject)=>{function tick(now:number){try{const t=THREE.MathUtils.clamp((now-start)/1000/factor,0,frameCount/30);frame(startSecond+t);frames++;if(t>=frameCount/30){recorder.stop();resolve();}else requestAnimationFrame(tick);}catch(error){recorder.stop();reject(error);}}requestAnimationFrame(tick);});
 const blob=await done;stream.getTracks().forEach(t=>t.stop());const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='engineer-mission-'+lang+'.webm';a.click();return {frames,seconds:frameCount/30,captureFactor:factor,bytes:blob.size};
}};
