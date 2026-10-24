// One choreographed camera, one assembly. No sub-windows or simultaneous exploded groups.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { armStudyPose, armDetailStage, armFastenerOpacity, ARM_STUDY_DURATION, ARM_STUDY_INTRO, ARM_STUDY_STARTS, ARM_STUDY_ORDER, ARM_STUDY_FINALE_START, jointDemo, finaleAngles, type StudyPose } from './arm-study-story';

import {contextTransform,CLIMB_FORWARD} from './lib/arm-context-stage';
import {climbAngles,climbStroke,climbRise,climbAdvance,ARM_STUDY_CLIMB_START,ARM_STUDY_CLIMB_DURATION} from './arm-study-story';
import { armMotionMatrices, type MotionContract } from './lib/arm-study-motion';
import {createChains,type ChainData} from './lib/arm-chain-motion';
import {createArmStudyTransmission,wristPowerTrace,type WristTransmissionData} from './lib/arm-study-transmission';
import {GROUND_Y,STEP_HEIGHT,smooth,stageDescent} from './arm-study-story';
import {createStudyRenderer,setStudyOpacity} from './lib/arm-study-renderer';
import {study as limitStudy,profileClearance} from './lib/arm-linked-limit';
import {createLimitWorkspace} from './lib/arm-limit-workspace';
import {finaleEntry,finaleStairReveal,finaleWideView,finaleFade,openingFade} from './lib/arm-study-finale';

type Vec = [number, number, number];
type Part = { key: string; node_name: string; motor: boolean; group: number; stage: number; role: string; mount_owner?: string; motion_group:string; group_offset_m: Vec; detail_offset_m: Vec; assembly_axis: Vec;members:{asset:string;index:number}[] };
type Detail = { id: number; part_keys: string[]; route_keys: string[]; route_edges: [number, number][]; feature_keys: string[]; camera: Vec; camera_path:Vec[]; route_variants?:{keys:string[];edges:[number,number][]}[] };
type Metadata = { schema_version: number; parts: Part[]; details: Detail[]; motion:MotionContract };
type Copy = { overview: string; caption: string; names: string[]; descriptions: string[]; features: string[][]; routes: string[][]; phases: Record<string,string>; finale:string; finaleDescription:string;climb:string;climbDescription:string;climbFeatures:string[];pathNames:string[];limitBoundary:string;workspaceBoundary:string };
type CameraPose = { position: THREE.Vector3; target: THREE.Vector3 };
type ViewKey = { target: THREE.Vector3; curve: THREE.CatmullRomCurve3; distance: number };
export type ArmExplodeScene = { setVisible: (value: boolean) => void; dispose: () => void };
const ease = (n: number) => { const t = THREE.MathUtils.clamp(n,0,1); return t*t*(3-2*t); };

export async function loadArmExplodeScene(root: HTMLElement, base: string, signal: AbortSignal): Promise<ArmExplodeScene> {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas.three')!;
  const copy: Copy = JSON.parse(root.dataset.copy!);
  const abort = new AbortController(), events = { signal: abort.signal };
  const manager = new THREE.LoadingManager(), abortLoad = () => manager.abort();
  signal.addEventListener('abort', abortLoad, { once:true });
  const draco = new DRACOLoader(manager).setDecoderPath(`${base}models/draco/`).setWorkerLimit(1);
  let meta: Metadata, model: THREE.Group, contextModel:THREE.Group,chainData:ChainData,wristData:WristTransmissionData;
  try {
    [meta,model,contextModel,chainData,wristData] = await Promise.all([
      fetch(`${base}models/arm-parts.json`, { signal }).then(r => { if(!r.ok) throw new Error('Arm metadata unavailable'); return r.json(); }),
      new GLTFLoader(manager).setDRACOLoader(draco).loadAsync(`${base}models/arm-parts.glb`).then(g => g.scene),
      new GLTFLoader(manager).setDRACOLoader(draco).loadAsync(`${base}models/arm-context.glb`).then(g=>g.scene),
      fetch(`${base}models/arm-chains.json`,{signal}).then(r=>{if(!r.ok)throw new Error('Chain stations unavailable');return r.json();}),
      fetch(`${base}models/arm-wrist-transmission.json`,{signal}).then(r=>{if(!r.ok)throw new Error('Wrist transmission unavailable');return r.json();}),
    ]);
  } finally { signal.removeEventListener('abort',abortLoad); draco.dispose(); }
  if(meta.schema_version!==6) throw new Error('Arm geometry/storyboard version mismatch');
  model.updateMatrixWorld(true);
  const nodes = new Map<string,THREE.Object3D>();
  model.traverse(n => { if(n.userData.part_key) nodes.set(n.userData.part_key,n); });
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const parts = meta.parts.map(spec => {
    const node = nodes.get(spec.key); if(!node) throw new Error(`Missing CAD part ${spec.key}`);
    const surfaces: THREE.MeshStandardMaterial[] = [];
    node.traverse(o => {
      const mesh = o as THREE.Mesh; if(!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      const clone = (original:THREE.Material) => {
        materials.add(original); const material = original.clone() as THREE.MeshStandardMaterial;
        material.transparent=false;material.depthWrite=true; material.forceSinglePass=true; material.side=THREE.FrontSide;
        materials.add(material); surfaces.push(material); return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });
    const box = new THREE.Box3().setFromObject(node), points:THREE.Vector3[]=[];
    for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]) points.push(new THREE.Vector3(x,y,z));
    node.matrixAutoUpdate=false;
    return { spec,node,rest:node.matrix.clone(),delta:new THREE.Matrix4(),center:box.getCenter(new THREE.Vector3()),points,surfaces,offset:new THREE.Vector3(),background:false };
  });
  const byKey = new Map(parts.map(p => [p.spec.key,p]));
  const sourcePart=(index:number)=>parts.find(p=>p.spec.members.some(m=>m.asset==='arm'&&m.index===index))!;
  const limitPlate=sourcePart(370);
  if(!limitPlate)throw new Error('Arch-shaped linked-stop plate unavailable');
  const detailKeys = new Map(meta.details.map(d => [d.id,new Set(d.part_keys)]));
  const motionKeys=new Map<number,Set<string>>();
  const identity=new THREE.Matrix4();
  for(const id of ARM_STUDY_ORDER){
    const transforms=armMotionMatrices(meta.motion,jointDemo(id,id===0?.65:.4));
    motionKeys.set(id,new Set(parts.filter(p=>detailKeys.get(id)!.has(p.spec.key)||transforms.get(p.spec.motion_group)!.elements.some((v,i)=>Math.abs(v-identity.elements[i])>1e-8)).map(p=>p.spec.key)));
  }
  const renderer = new THREE.WebGLRenderer({ canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.2;
  const scene = new THREE.Scene(); scene.add(model,contextModel,new THREE.HemisphereLight(0xe7eef6,0x12213a,2.6));
  const chains=createChains(chainData,scene),chainKeys=new Set(chainData.loops.map(l=>l.part));
  const transmission=createArmStudyTransmission(wristData,scene,byKey.get(wristData.belt.key)!.surfaces[0]);
  for(const [intensity,position] of [[3.4,[-1.6,2.4,1.8]],[2.8,[1.8,1.2,-1.6]],[1.4,[0,-1,1.5]]] as const) {
    const light=new THREE.DirectionalLight(0xe7eef6,intensity); light.position.set(position[0],position[1],position[2]); scene.add(light);
  }
  contextModel.updateMatrixWorld(true);
  const contextParts:Array<{node:THREE.Object3D;group:string;rest:THREE.Matrix4;surfaces:THREE.MeshStandardMaterial[]}>=[];
  contextModel.traverse(node=>{if(!node.userData.context_group)return;const surfaces:THREE.MeshStandardMaterial[]=[];node.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;geometries.add(mesh.geometry);const old=Array.isArray(mesh.material)?mesh.material:[mesh.material];const clones=old.map(m=>{materials.add(m);const c=m.clone() as THREE.MeshStandardMaterial;c.transparent=false;c.depthWrite=true;c.opacity=1;c.side=THREE.FrontSide;c.forceSinglePass=true;surfaces.push(c);materials.add(c);return c;});mesh.material=Array.isArray(mesh.material)?clones:clones[0];});node.matrixAutoUpdate=false;contextParts.push({node,group:node.userData.context_group,rest:node.matrix.clone(),surfaces});});
  const contextBounds=new THREE.Box3().setFromObject(contextModel),contextCorners:THREE.Vector3[]=[];
  for(const x of [contextBounds.min.x,contextBounds.max.x])for(const y of [contextBounds.min.y,contextBounds.max.y])for(const z of [contextBounds.min.z,contextBounds.max.z])contextCorners.push(new THREE.Vector3(x,y,z));
  const stairMaterial=new THREE.MeshStandardMaterial({color:0x101b29,transparent:true,opacity:0,roughness:.9,depthWrite:false});materials.add(stairMaterial);
  const stairGeometry=new THREE.BoxGeometry(.95,STEP_HEIGHT,1.4);geometries.add(stairGeometry);
  const stair=new THREE.Mesh(stairGeometry,stairMaterial);stair.position.copy(new THREE.Vector3(-.04,-.27451,-.088).addScaledVector(CLIMB_FORWARD,.57));stair.rotation.y=Math.atan2(CLIMB_FORWARD.x,CLIMB_FORWARD.z);scene.add(stair);
  const stairEdgeGeometry=new THREE.EdgesGeometry(stairGeometry,28);geometries.add(stairEdgeGeometry);
  const stairEdgeMaterial=new THREE.LineBasicMaterial({color:0xf2b53a,transparent:true,opacity:0,depthWrite:false});materials.add(stairEdgeMaterial);
  const stairEdges=new THREE.LineSegments(stairEdgeGeometry,stairEdgeMaterial);stairEdges.renderOrder=2;stair.add(stairEdges);
  const groundGeometry=new THREE.PlaneGeometry(5,5);geometries.add(groundGeometry);const groundMaterial=stairMaterial.clone();materials.add(groundMaterial);const ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.set(-.04,-.315,-.088);scene.add(ground);
  stair.position.copy(new THREE.Vector3(-.04,GROUND_Y+STEP_HEIGHT/2,-.088).addScaledVector(CLIMB_FORWARD,1.03));ground.position.y=GROUND_Y;
  const floorEdgeGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2.5,GROUND_Y+.0002,-2.5),new THREE.Vector3(2.5,GROUND_Y+.0002,-2.5),new THREE.Vector3(2.5,GROUND_Y+.0002,2.5),new THREE.Vector3(-2.5,GROUND_Y+.0002,2.5),new THREE.Vector3(-2.5,GROUND_Y+.0002,-2.5)]);geometries.add(floorEdgeGeometry);
  const floorEdgeMaterial=stairEdgeMaterial.clone();materials.add(floorEdgeMaterial);
  const floorEdges=new THREE.Line(floorEdgeGeometry,floorEdgeMaterial);scene.add(floorEdges);
  const camera = new THREE.PerspectiveCamera(32,1,.005,20), controls = new OrbitControls(camera,canvas);
  const presentation=createStudyRenderer(renderer,scene,camera,contextModel);
  controls.enableDamping=false; controls.enablePan=false; controls.enableZoom=true;
  controls.minDistance=.0002; controls.maxDistance=6; controls.minPolarAngle=.15; controls.maxPolarAngle=Math.PI-.15;
  controls.rotateSpeed=.65; controls.zoomSpeed=.7;
  const amber = new THREE.Color(getComputedStyle(root).getPropertyValue('--amber').trim());
  const axisMaterial = new THREE.LineDashedMaterial({color:amber,transparent:true,opacity:.28,dashSize:.007,gapSize:.005,depthTest:false});
  const pathMaterial = new THREE.LineBasicMaterial({color:amber,transparent:true,opacity:.55,depthTest:false});
  const axisGeometry=new THREE.BufferGeometry(),pathGeometry=new THREE.BufferGeometry();
  axisGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((parts.length*2+2)*3),3));
  pathGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(256*3),3));
  const axes=new THREE.LineSegments(axisGeometry,axisMaterial),paths=new THREE.LineSegments(pathGeometry,pathMaterial);
  axes.renderOrder=2; paths.renderOrder=3; scene.add(axes,paths);
  const wireGeometry=new THREE.CylinderGeometry(1,1,1,6),dotGeometry=new THREE.SphereGeometry(.003,8,6);geometries.add(wireGeometry);geometries.add(dotGeometry);
  // Four transmission paths in the amber family plus a steel tone: one accent, still separable.
  const networks=[amber,new THREE.Color('#f4e6c8'),new THREE.Color('#7fa6cf'),new THREE.Color('#b9783a')].map(color=>{const material=new THREE.MeshBasicMaterial({color,transparent:true,depthTest:false});materials.add(material);const wires=new THREE.InstancedMesh(wireGeometry,material,128),dots=new THREE.InstancedMesh(dotGeometry,material,128);wires.renderOrder=4;dots.renderOrder=5;wires.frustumCulled=false;dots.frustumCulled=false;scene.add(wires,dots);return {material,wires,dots};});
  const pathLegend=root.querySelector<HTMLElement>('[data-path-legend]')!,limitCaption=root.querySelector<HTMLElement>('[data-limit-caption]')!;
  const transition=root.querySelector<HTMLElement>('[data-study-transition]')!,watermark=root.querySelector<HTMLImageElement>('[data-rm-watermark]')!;
  const activePath=(pose:StudyPose)=>pose.phase==='motion'&&(pose.id===3||pose.id===4)?3:pose.id===4?(pose.view<.32?1:pose.view<.7?2:3):pose.id===3?(pose.view<.58?0:3):-1;
  const limitGeometry=new THREE.BufferGeometry();limitGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(2048*3),3));geometries.add(limitGeometry);
  const limitMaterial=new THREE.LineDashedMaterial({color:amber,transparent:true,opacity:.85,dashSize:.009,gapSize:.003,depthTest:false,toneMapped:false});materials.add(limitMaterial);
  const limitLine=new THREE.LineSegments(limitGeometry,limitMaterial);limitLine.renderOrder=4;scene.add(limitLine);
  const contactMaterial=new THREE.MeshBasicMaterial({color:amber,depthTest:false,transparent:true});materials.add(contactMaterial);
  const contactMarker=new THREE.Mesh(dotGeometry,contactMaterial);contactMarker.scale.setScalar(.65);contactMarker.renderOrder=5;contactMarker.visible=false;scene.add(contactMarker);
  const sectionX=limitStudy.tcp.point_m[0];
  const limitBoundaries=limitStudy.regions.limited.flatMap(p=>[p.outer,...p.holes]).map(ring=>ring.map(p=>new THREE.Vector3(sectionX,p[0],p[1])));
  const limitFrames=limitStudy.boundary_poses.map(sample=>{
    const m=armMotionMatrices(meta.motion,sample.angles as StudyPose['angles']);
    return [new THREE.Vector3(...meta.motion.joints[1].point_m),new THREE.Vector3(...meta.motion.joints[2].point_m).applyMatrix4(m.get('link_2')!),new THREE.Vector3(...meta.motion.joints[4].point_m).applyMatrix4(m.get('link_4')!),new THREE.Vector3(...sample.tcp)];
  });
  const workspace=createLimitWorkspace(scene,meta.motion,amber);
  const similarLinkages=[amber,new THREE.Color('#ffdda6')].map(color=>{
    const material=new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true});materials.add(material);
    const wires=new THREE.InstancedMesh(wireGeometry,material,3);wires.frustumCulled=false;wires.renderOrder=6;scene.add(wires);return wires;
  });
  // Small surface ticks make actual wheel rotation legible on otherwise uniform rubber.
  const wheelTickGeometry=new THREE.BufferGeometry();wheelTickGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(36),3));geometries.add(wheelTickGeometry);
  const wheelTickMaterial=new THREE.LineBasicMaterial({color:amber,transparent:true,opacity:.9});materials.add(wheelTickMaterial);
  const wheelTicks=new THREE.LineSegments(wheelTickGeometry,wheelTickMaterial);scene.add(wheelTicks);
  const updateLines=(geometry:THREE.BufferGeometry,points:THREE.Vector3[]) => {
    const attribute=geometry.getAttribute('position') as THREE.BufferAttribute;
    points.forEach((p,i)=>attribute.setXYZ(i,p.x,p.y,p.z)); attribute.needsUpdate=true; geometry.setDrawRange(0,points.length);
  };
  const title=root.querySelector<HTMLElement>('[data-shot-title]')!,phaseLabel=root.querySelector<HTMLElement>('[data-shot-phase]')!;
  const description=root.querySelector<HTMLElement>('[data-story-description]')!,play=root.querySelector<HTMLButtonElement>('[data-play]')!;
  const slider=root.querySelector<HTMLInputElement>('[data-story-range]')!,timeLabel=root.querySelector<HTMLOutputElement>('[data-story-time]')!;
  const routeKey=root.querySelector<HTMLDetailsElement>('[data-route-key]')!,routeList=root.querySelector<HTMLOListElement>('[data-route-list]')!;
  const featureLabels=[...root.querySelectorAll<HTMLElement>('[data-feature-label]')],routeLabels=[...root.querySelectorAll<HTMLElement>('[data-route-label]')];
  const chapters=[...root.querySelectorAll<HTMLButtonElement>('[data-story-step]')];
  let visible=false,disposed=false,frame=0,lastFrame=0,frames=0,clock=Number(root.dataset.storyTime||0),auto=root.dataset.playing!=='false',internal=false,dragging=false,manualCamera=root.dataset.manualCamera==='true',idleUntil=0,timer=0;
  let current=armStudyPose(clock),lastUiKey='';
  let wheelCycle=Number(root.dataset.wheelCycle||0);
  let rejoin:{position:THREE.Vector3;target:THREE.Vector3;elapsed:number}|undefined;
  let seekBlend:{position:THREE.Vector3;target:THREE.Vector3;elapsed:number}|undefined;
  let restore:{pose:StudyPose;position:THREE.Vector3;target:THREE.Vector3;elapsed:number;autoAfter:boolean}|undefined;
  const viewKeys=new Map<number|null|string,ViewKey>();
  // Reserve each complete local explosion and inspection arc once. The camera does
  // not "breathe" or chase individual parts while they move along assembly axes.
  const makeViewKey=(keyId:number|null|string):ViewKey => {
    const closed=typeof keyId==='string'&&keyId.startsWith('motion:');
    const id=closed?Number((keyId as string).slice(7)):keyId;
    const d=typeof id==='number'?meta.details[id]:undefined;
    const members=parts.filter(p=>!d||(closed?motionKeys.get(id as number)!:detailKeys.get(id as number)!).has(p.spec.key));
    const core=members.filter(p=>(id!=='limit-contact'||[limitPlate,sourcePart(311),sourcePart(369)].includes(p))&&(!d||closed||p.spec.stage!==1)&&(id!==6||closed||detailKeys.get(6)!.has(p.spec.key))&&(!(id==='climb'||id==='limit-space'||id===6&&closed)||p.spec.motion_group!=='uwb'||detailKeys.get(6)!.has(p.spec.key)));
    const points=core.flatMap(p=>d&&!closed?p.points.flatMap(v=>[v.clone(),v.clone().add(new THREE.Vector3(...p.spec.detail_offset_m))]):p.points.map(v=>v.clone()));
    if(id!==null&&(closed||id==='vehicle'||id==='climb')){
      for(let i=0;i<=20;i++){
        const matrices=armMotionMatrices(meta.motion,id==='climb'?climbAngles(i/20):id==='finale'?finaleAngles(i/20):jointDemo(id as number,id===6?i/20*.32:i/20));
        for(const p of core)for(const point of p.points)points.push(point.clone().applyMatrix4(matrices.get(p.spec.motion_group)!));
      }
    }
    if(id==='vehicle'||id==='climb')points.push(...contextCorners.map(v=>v.clone()));
    if(id==='limit-space')points.push(...limitBoundaries.flat(),...limitFrames.flat());

    const target=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    const directions:Vec[]=id==='limit-contact'?[[2,0,.12]]:id==='limit-space'?[[2,0,0]]:id==='climb'?[[.2,.75,1.7]]:id==='vehicle'?[[1.55,.8,1.5]]:id==='finale'?[[1,.65,1.7],[1.65,.85,-.25],[1.55,.5,.2],[1,.65,1.7]]:d?.camera_path??[[1,.6,1.7]];
    const path=directions.length>1?directions:[directions[0],directions[0]];
    const curve=new THREE.CatmullRomCurve3(path.map(v=>new THREE.Vector3(...v).normalize()),false,'centripetal');
    const tanV=Math.tan(THREE.MathUtils.degToRad(16)),tanH=tanV*camera.aspect;
    let distance=.1;
    const samples=id==='finale'?64:closed?1:32;
    for(let i=0;i<=samples;i++){
      const u=i/samples,view=curve.getPoint(u).normalize();
      const right=new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP,view).normalize(),up=new THREE.Vector3().crossVectors(view,right).normalize();
      let fittedPoints=points;
      if(id==='finale'){const m=armMotionMatrices(meta.motion,finaleAngles(u));fittedPoints=core.flatMap(p=>p.points.map(v=>v.clone().applyMatrix4(m.get(p.spec.motion_group)!)));}
      for(const point of fittedPoints){const p=point.clone().sub(target);distance=Math.max(distance,p.dot(view)+Math.max(Math.abs(p.dot(right))/(tanH*.84),Math.abs(p.dot(up))/(tanV*(id==='finale'?.84:.74))));}
    }
    return {target,curve,distance:distance*1.025};
  };
  const keyCamera=(id:number|null|string,u=0):CameraPose => {
    const key=viewKeys.get(id)!;const offset=new THREE.Vector3(0,id==='vehicle'||id==='climb'?0:current.extract,0);return {target:key.target.clone().add(offset),position:key.target.clone().add(offset).addScaledVector(key.curve.getPoint(THREE.MathUtils.clamp(u,0,1)).normalize(),key.distance)};
  };
  const wantedCamera=(pose:StudyPose):CameraPose => {
    const blend=(a:CameraPose,b:CameraPose,t:number)=>({position:a.position.lerp(b.position,t),target:a.target.lerp(b.target,t)});
    if(pose.phase==='extract'){
      return blend(keyCamera('vehicle'),keyCamera(null),pose.view);
    }
    if(pose.phase==='climb'){
      const shift=CLIMB_FORWARD.clone().multiplyScalar(climbAdvance(pose.climb));shift.y=climbRise(pose.climb);
      const follow=blend(keyCamera('climb'),keyCamera('vehicle'),finaleWideView(pose.finale));follow.position.add(shift);follow.target.add(shift);
      return blend(keyCamera('motion:4',1),follow,finaleEntry(pose.finale));
    }
    if(pose.phase==='finale')return keyCamera('finale',pose.finale);
    if(pose.phase==='assembled'&&pose.finale===1)return blend(keyCamera('climb'),keyCamera('vehicle'),pose.focus);
    if(pose.phase==='return')return blend(keyCamera('climb'),keyCamera('vehicle'),pose.focus);
    if(pose.phase==='approach')return blend(keyCamera(pose.previous===null?null:pose.previous===0?'vehicle':pose.previous===1?1:pose.previous===6?'limit-space':`motion:${pose.previous}`,1),keyCamera(pose.id,0),pose.focus);
    if(pose.id===null)return keyCamera(null);
    if(pose.phase==='motion'){
      if(pose.id===1)return keyCamera(1,1);
      if(pose.id===6){const u=pose.motionU,wide=keyCamera('motion:6',1),local=keyCamera('limit-contact'),m=armMotionMatrices(meta.motion,pose.angles).get('uwb')!;local.position.applyMatrix4(m);local.target.applyMatrix4(m);return u<.28?blend(keyCamera(6,1),wide,smooth(u/.12)):u<.66?blend(wide,local,smooth((u-.28)/.12)):blend(local,keyCamera('limit-space'),smooth((u-.66)/.1));}
      return blend(keyCamera(pose.id,1),keyCamera(pose.id===0?'vehicle':`motion:${pose.id}`,1),ease(pose.motionU/(pose.id===0?.4:.3)));
    }
    const open=keyCamera(pose.id,pose.view);
    return open;
  };
  const requestDraw=()=>{if(visible&&!disposed&&!frame)frame=requestAnimationFrame(draw);};
  const armTimer=()=>{
    clearTimeout(timer);
    if(auto&&visible&&!dragging&&Number.isFinite(idleUntil))timer=window.setTimeout(()=>{lastFrame=0;requestDraw();},Math.max(16,idleUntil-performance.now()+16));
  };
  const activity=()=>{idleUntil=performance.now()+5000;clearTimeout(timer);armTimer();requestDraw();};
  const beginRejoin=()=>{rejoin={position:camera.position.clone(),target:controls.target.clone(),elapsed:0};manualCamera=true;idleUntil=0;requestDraw();};
  const updateUI=(pose:StudyPose)=>{
    const id=pose.id;
    title.textContent=pose.phase==='climb'?copy.climb:pose.phase==='finale'?copy.finale:id===null?copy.overview:copy.names[id];phaseLabel.textContent='';
    const routeId=id===4?(activePath(pose)===1?4:activePath(pose)===2?5:10):id===3&&activePath(pose)===3?10:id;const uiKey=`${id}:${routeId}:${pose.phase}`;
    if(lastUiKey!==uiKey) {
      description.textContent='';
      const items=routeId===null?[]:copy.routes[routeId]??[];routeList.replaceChildren(...items.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
      routeKey.hidden=true;
      featureLabels.forEach((label,i)=>{label.textContent=pose.phase==='climb'?copy.climbFeatures[i]:(id===4||id===3&&routeId===10)?copy.features[routeId!]?.[i]??'':id===null?'':copy.features[id]?.[i]??'';}); lastUiKey=uiKey;
    }
    chapters.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===pose.step)));
    play.textContent=auto?play.dataset.stop!:play.dataset.start!;play.setAttribute('aria-pressed',String(auto));
    slider.value=String(Math.round(clock/ARM_STUDY_DURATION*1000));timeLabel.value=`${clock.toFixed(1)} s`;
  };
  const applyPose=(pose:StudyPose)=>{
    const moving=pose.phase==='motion'||pose.angles.some(a=>Math.abs(a)>1e-8);
    const normal=pose.id===null?undefined:detailKeys.get(pose.id);
    const active=pose.id===null?undefined:pose.id===6||pose.id===1?normal:moving?motionKeys.get(pose.id):normal,previous=pose.previous===null?undefined:motionKeys.get(pose.previous);
    const transferring=pose.phase==='approach'||pose.phase==='return';
    const linePoints:THREE.Vector3[]=[];
    const transforms=armMotionMatrices(meta.motion,pose.angles);
    const translation=new THREE.Matrix4();
    const weight=pose.restoreWeight??1;const body=new THREE.Matrix4().makeTranslation(CLIMB_FORWARD.x*climbAdvance(pose.climb)*weight,climbRise(pose.climb)*weight,CLIMB_FORWARD.z*climbAdvance(pose.climb)*weight);
    for(const p of contextParts){p.node.matrix.copy(contextTransform(p.group,climbStroke(pose.climb)*weight,body,climbAdvance(pose.climb)*weight+wheelCycle,smooth((pose.climb/.84-.10)/.10)*(1-smooth((pose.climb-.84)/.14))));if(p.group==='gimbal_context')p.node.matrix.multiply(new THREE.Matrix4().makeTranslation(0,pose.extract,0)).multiply(transforms.get('j0_carrier')!);p.node.matrix.multiply(p.rest);p.node.matrixWorldNeedsUpdate=true;}
    stair.visible=ground.visible=floorEdges.visible=pose.phase==='climb';stair.position.y=GROUND_Y+STEP_HEIGHT/2;
    const reveal=pose.phase==='climb'?finaleStairReveal(pose.finale):0;stairMaterial.opacity=.055*reveal;groundMaterial.opacity=.018*reveal;groundMaterial.depthWrite=false;stairEdgeMaterial.opacity=.64*reveal;floorEdgeMaterial.opacity=.18*reveal;
    watermark.hidden=pose.phase!=='climb';watermark.style.opacity=String(.32*finaleEntry(pose.finale));
    transition.style.opacity=String(pose.phase==='climb'?finaleFade(pose.finale):clock<.65?openingFade(clock):0);
    const whole=body.clone().multiply(new THREE.Matrix4().makeTranslation(0,pose.extract,0));
    for(const p of parts) {
      const selected=active?.has(p.spec.key)??false;
      p.offset.fromArray(p.spec.detail_offset_m).multiplyScalar(selected?armDetailStage(pose.progress,p.spec.stage):0);
      if((pose.id===9||pose.id===6)&&p.spec.stage!==0)p.offset.set(0,0,0);
      p.delta.copy(whole).multiply(transforms.get(p.spec.motion_group)!);
      const rotor=transmission.partMotion(p.spec.key,pose.angles);if(rotor)p.delta.multiply(rotor);
      p.node.matrix.copy(p.delta).multiply(translation.makeTranslation(p.offset.x,p.offset.y,p.offset.z)).multiply(p.rest);p.node.matrixWorldNeedsUpdate=true;
      const oldOpacity=pose.previous===6?(detailKeys.get(6)!.has(p.spec.key)?.14:p.spec.motion_group==='uwb'?.025:.338):previous===undefined?1:previous.has(p.spec.key)?1:.018;
      let newOpacity=active===undefined?1:selected?1:.018;
      if(pose.phase==='climb'&&!detailKeys.get(4)!.has(p.spec.key))newOpacity=THREE.MathUtils.lerp(.018,1,finaleEntry(pose.finale));
      if(pose.id===4&&pose.phase==='inspect'&&activePath(pose)===0&&meta.details[3].route_keys.slice(5).includes(p.spec.key))newOpacity=1;
      if(pose.phase==='climb'&&p.spec.motion_group==='uwb')newOpacity=.08+.92*smooth((pose.climb-.82)/.14);
      if(pose.id===6&&p.spec.motion_group==='uwb'&&!normal?.has(p.spec.key))newOpacity=.025;
      if(pose.id===9&&normal?.has(p.spec.key)&&p.spec.stage!==0)newOpacity=p.spec.members.some(m=>m.asset==='arm'&&m.index>=11&&m.index<=18)?1:1-.97*armDetailStage(pose.progress,1);
      if(pose.id===1&&!selected)newOpacity=.006;
      if(pose.id===6&&pose.phase==='motion'&&!normal?.has(p.spec.key)&&p.spec.motion_group!=='uwb')newOpacity=.018+.12*smooth(pose.motionU/.14)*(1-smooth((pose.motionU-.23)/.11))+.32*smooth((pose.motionU-.68)/.1);
      if(pose.phase==='motion'&&selected&&!normal?.has(p.spec.key)&&pose.id!==6)newOpacity=THREE.MathUtils.lerp(.018,1,ease(pose.motionU/(pose.id===0?.4:.15)));
      let opacity=transferring?THREE.MathUtils.lerp(oldOpacity,newOpacity,pose.focus):newOpacity;
      if(pose.id===6&&pose.phase==='motion'&&normal?.has(p.spec.key))opacity*=1-.86*smooth((pose.motionU-.68)/.1);
      if(selected&&p.spec.stage===0)opacity*=armFastenerOpacity(pose.progress);
      if(selected&&p.spec.stage===1&&pose.id!==9)opacity*=1-.95*armDetailStage(pose.progress,1);
      if(p===limitPlate&&pose.phase==='climb')opacity=0;
      p.node.visible=opacity>.005&&!chainKeys.has(p.spec.key)&&p.spec.key!==transmission.beltKey;
      const background=opacity<1&&(!selected||pose.id===6&&pose.phase==='motion'&&pose.motionU>.68||pose.previous===6&&transferring);
      if(p.background!==background){p.background=background;p.node.traverse(node=>node.layers.set(background?1:0));}
      for(const material of p.surfaces){setStudyOpacity(material,opacity,background);material.emissive.set(0);material.emissiveIntensity=0;}
      if(selected&&!p.spec.mount_owner&&p.spec.stage===2&&p.offset.length()>.003) {
        const axis=new THREE.Vector3(...p.spec.assembly_axis);linePoints.push(p.center.clone().addScaledVector(axis,-.008).applyMatrix4(p.delta),p.center.clone().add(p.offset).addScaledVector(axis,.008).applyMatrix4(p.delta));
      }
    }
    chains.update(pose.angles,key=>{const p=byKey.get(key)!;return {matrix:p.delta.clone().multiply(new THREE.Matrix4().makeTranslation(...p.offset.toArray())),opacity:p.surfaces[0]?.opacity??1,background:p.background};});
    {const p=byKey.get(transmission.beltKey)!;transmission.update(pose.angles,{matrix:p.delta.clone().multiply(new THREE.Matrix4().makeTranslation(...p.offset.toArray())),opacity:p.surfaces[0]?.opacity??1,background:p.background});}
    const selectedFasteners=parts.filter(p=>p.spec.stage===0&&active?.has(p.spec.key));
    root.dataset.fastenerCount=String(selectedFasteners.length);
    root.dataset.visibleFasteners=String(selectedFasteners.filter(p=>p.node.visible).length);
    root.dataset.fastenerOpacity=armFastenerOpacity(pose.progress).toFixed(4);
    const ticks:THREE.Vector3[]=[];
    for(const index of [508,682]){const p=sourcePart(index);for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;for(const radius of [.024,.034])ticks.push(p.center.clone().add(new THREE.Vector3(index===508?.007:-.007,Math.cos(angle)*radius,Math.sin(angle)*radius)).applyMatrix4(p.delta));}}
    updateLines(wheelTickGeometry,ticks);wheelTicks.visible=pose.phase==='climb'&&pose.climb>.22&&pose.climb<.9;
    model.updateMatrixWorld(true);
    updateLines(axisGeometry,linePoints);axes.computeLineDistances();axes.visible=pose.progress>.01;
    const detail=pose.id===null?undefined:meta.details[pose.id];
    const variant=detail?.route_variants?.[Math.min(2,activePath(pose))];
    const route=detail?(variant?.keys??detail.route_keys).map(k=>byKey.get(k)!).map(p=>p.center.clone().add(p.offset).applyMatrix4(p.delta)):[];
    const segments=detail?(variant?.edges??detail.route_edges).flatMap(([a,b])=>[route[a],route[b]]):[];
    updateLines(pathGeometry,segments);paths.visible=segments.length>0&&pose.phase==='inspect'&&pose.id!==3&&pose.id!==4;
    const closingPower=pose.phase==='climb'&&pose.finale*ARM_STUDY_CLIMB_DURATION<1.2;
    const powerIndex=closingPower?3:activePath(pose);
    const showPower=closingPower||(pose.id===3||pose.id===4)&&(pose.phase==='inspect'||pose.phase==='motion');pathLegend.hidden=true;
    pathLegend.querySelectorAll<HTMLElement>('span').forEach((label,i)=>{label.hidden=pose.id===4&&i===0||pose.id===3&&(i===1||i===2);label.style.opacity=activePath(pose)===i?'1':'.25';});
    const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),unitY=new THREE.Vector3(0,1,0);
    const at=(n:number)=>{const p=sourcePart(n);return p.center.clone().add(p.offset).applyMatrix4(p.delta);};
    networks.forEach((network,index)=>{
      network.wires.visible=network.dots.visible=showPower&&powerIndex===index;
      if(!network.wires.visible)return;
      let edges:THREE.Vector3[][]=[];let highlight:number[]=[];let powerFrontier:THREE.Vector3[]|undefined;
      if(index===0){const d=meta.details[3],v=d.route_keys.map(k=>{const p=byKey.get(k)!;return p.center.clone().add(p.offset).applyMatrix4(p.delta);});edges=d.route_edges.map(([a,b])=>[v[a],v[b]]);highlight=[300,299,268,272,348,271];}
      if(index===1){
        // Both 21T pulleys and the belt use the same axial displacement.
        const A=at(683),B=at(680),normal=new THREE.Vector3(...sourcePart(680).spec.assembly_axis).transformDirection(sourcePart(680).delta),along=B.clone().sub(A).normalize(),side=new THREE.Vector3().crossVectors(normal,along).normalize();
        const radius=.0167,points:THREE.Vector3[]=[];
        for(let i=0;i<=24;i++){const t=Math.PI*i/24;points.push(B.clone().addScaledVector(side,radius*Math.cos(t)).addScaledVector(along,radius*Math.sin(t)));}
        for(let i=0;i<=24;i++){const t=Math.PI*i/24;points.push(A.clone().addScaledVector(side,-radius*Math.cos(t)).addScaledVector(along,-radius*Math.sin(t)));}
        points.push(points[0]);edges=points.slice(1).map((p,i)=>[points[i],p]);highlight=[596,683,691,680];
      }
      if(index===2){
        const trace=wristPowerTrace((pose.view-.32)/.38,at);edges=trace.edges;powerFrontier=trace.frontier;highlight=[507,505,762,696,684,678,679,500,593];root.dataset.wristPowerStage=trace.stage.toFixed(3);
      }
      if(index===3){
        if(pose.id===3){const c=at(183),axis=new THREE.Vector3(...sourcePart(183).spec.assembly_axis).transformDirection(sourcePart(183).delta);edges=[[c.clone().addScaledVector(axis,-.075),c],[c,c.clone().addScaledVector(axis,.06)]];highlight=[183];}
        else {const a=at(689),b=at(774),c=at(688),entry=a.clone().add(new THREE.Vector3(0,.018,-.035));edges=[[entry,a],[a,b],[b,c]];highlight=[689,772,774,688];}
      }
      // Wrist power colours belong to the routes; keep carbon, metal and rubber intact.
      if((closingPower?4:pose.id)!==4)for(const n of highlight){const p=sourcePart(n);for(const m of p.surfaces){m.emissive.copy(network.material.color);m.emissiveIntensity=.45;}}
      network.material.opacity=closingPower?1-smooth(pose.finale*ARM_STUDY_CLIMB_DURATION/1.2):1;
      edges.forEach(([a,b],i)=>{const v=b.clone().sub(a),length=v.length();rotation.setFromUnitVectors(unitY,v.clone().normalize());matrix.compose(a.clone().lerp(b,.5),rotation,new THREE.Vector3(index===1?.001:index===3?.0015:.0017,length,index===1?.001:index===3?.0015:.0017));network.wires.setMatrixAt(i,matrix);if(!powerFrontier){matrix.makeTranslation(...a.clone().lerp(b,(clock*.45+i*.17)%1).toArray());network.dots.setMatrixAt(i,matrix);}});
      if(powerFrontier)powerFrontier.forEach((p,i)=>{matrix.makeTranslation(...p.toArray());network.dots.setMatrixAt(i,matrix);});
      network.wires.count=edges.length;network.dots.count=powerFrontier?.length??(index===1?0:edges.length);network.wires.instanceMatrix.needsUpdate=true;network.dots.instanceMatrix.needsUpdate=true;
    });
    const showLimit=pose.id===6&&pose.phase==='motion';limitLine.visible=showLimit;limitCaption.hidden=true;
    limitMaterial.opacity=.85*smooth(pose.motionU/.08)*(1-smooth((pose.motionU-.65)/.09));
    similarLinkages.forEach((w,i)=>{const opacity=.85*smooth(pose.motionU/.08)*(1-smooth((pose.motionU-(i?.64:.28))/(i?.1:.12)));(w.material as THREE.MeshBasicMaterial).opacity=opacity;w.visible=showLimit&&opacity>.001;});
    const sweep=workspace.update(pose.motionU,showLimit);
    root.dataset.workspaceProgress=sweep.progress.toFixed(5);root.dataset.workspaceOpacity=sweep.opacity.toFixed(5);root.dataset.workspacePoint=sweep.point.map(x=>x.toFixed(5)).join(',');
    if(showLimit){
      const points:THREE.Vector3[]=[],u=pose.motionU;
      const rollerCenter=new THREE.Vector3(...limitStudy.roller_source.center_m).applyMatrix4(sourcePart(311).delta);
      const localCenter=rollerCenter.clone().applyMatrix4(limitPlate.delta.clone().invert()),contact=profileClearance(localCenter.y,localCenter.z);
      const point=new THREE.Vector3(limitStudy.demo.contact_point_m[0],contact.nearest[0],contact.nearest[1]).applyMatrix4(limitPlate.delta);
      const triangles=[
        limitStudy.similarity.large_points.map((p,i)=>new THREE.Vector3(...p as Vec).applyMatrix4(transforms.get(['link_1','link_2','link_4'][i])!)),
        limitStudy.similarity.small_points.map((p,i)=>new THREE.Vector3(...p as Vec).applyMatrix4(transforms.get(i===0?'uwb':'link_3')!)),
      ];
      similarLinkages.forEach((w,index)=>{
        const vertices=triangles[index];
        for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3],v=b.clone().sub(a);rotation.setFromUnitVectors(unitY,v.clone().normalize());matrix.compose(a.clone().lerp(b,.5),rotation,new THREE.Vector3(index?.0013:.0025,v.length(),index?.0013:.0025));w.setMatrixAt(i,matrix);}
        w.instanceMatrix.needsUpdate=true;
      });
      if(u<.32){const center=sourcePart(369).center.clone().applyMatrix4(transforms.get('uwb')!);points.push(center.clone().add(new THREE.Vector3(-.02,0,-.08)),center.clone().add(new THREE.Vector3(-.02,0,.08)));}
      else if(u<.68){
        for(const polygon of limitStudy.profile)for(const ring of [polygon.outer])for(let i=1;i<ring.length;i++)points.push(...[ring[i-1],ring[i]].map(p=>new THREE.Vector3(limitStudy.demo.contact_point_m[0],p[0],p[1]).applyMatrix4(limitPlate.delta)));
        points.push(rollerCenter,point);
      }
      updateLines(limitGeometry,points);limitLine.computeLineDistances();
      for(const p of [limitPlate,sourcePart(311)])for(const m of p.surfaces){m.emissive.copy(amber);m.emissiveIntensity=.16*smooth((u-.3)/.06)*(1-smooth((u-.64)/.07));}
      contactMaterial.opacity=(1-smooth(Math.abs(contact.clearance)/.002))*smooth((u-.3)/.05)*(1-smooth((u-.65)/.06));
      contactMarker.visible=contactMaterial.opacity>.01;
      if(contactMarker.visible)contactMarker.position.copy(point);
      root.dataset.limitClearance=contact.clearance.toFixed(6);
    }else contactMarker.visible=false;

    return route;
  };
  const labels=(_pose:StudyPose,_route:THREE.Vector3[])=>{
    featureLabels.forEach(label=>{label.hidden=true;});
    routeLabels.forEach(label=>{label.hidden=true;});
  };
  const poseContext=(p:StudyPose)=>p.context.toFixed(5);
  const draw=(_timestamp:number)=>{
    const now=performance.now();
    frame=0;if(!visible||disposed)return;
    if(lastFrame&&now-lastFrame<1000/30){requestDraw();return;}
    const dt=Math.min(.1,lastFrame?(now-lastFrame)/1000:1/30);lastFrame=now;
    if(manualCamera&&auto&&!dragging&&now>=idleUntil&&!rejoin&&!restore&&!seekBlend)beginRejoin();
    if(auto&&!manualCamera&&!restore&&!seekBlend&&now>=idleUntil){if(clock+dt>=ARM_STUDY_DURATION){wheelCycle+=.78;root.dataset.wheelCycle=String(wheelCycle);}clock=(clock+dt)%ARM_STUDY_DURATION;}
    current=armStudyPose(clock);
    let wanted=wantedCamera(current);
    if(restore) {
      restore.elapsed+=dt;const closing=ease(restore.elapsed/2.1),returning=ease((restore.elapsed-2.1)/1.2);
      current={...restore.pose,restoreWeight:1-closing,extract:restore.pose.extract*(1-closing),previous:restore.pose.id,focus:1,progress:restore.pose.progress*(1-closing),angles:restore.pose.angles.map(a=>a*(1-closing)) as StudyPose['angles'],phase:'close'};
      if(returning>0)current={...current,id:null,previous:restore.pose.id,focus:returning,context:THREE.MathUtils.lerp(restore.pose.context,1,returning),progress:0,phase:'return'};
      const home=keyCamera('vehicle');wanted={position:restore.position.clone().lerp(home.position,returning),target:restore.target.clone().lerp(home.target,returning)};
      if(restore.elapsed>=3.3){auto=restore.autoAfter;restore=undefined;clock=0;current=armStudyPose(0);wanted=keyCamera('vehicle');}
    }
    const route=applyPose(current);
    if(seekBlend){seekBlend.elapsed+=dt;const t=ease(seekBlend.elapsed/1.1);wanted.position.lerpVectors(seekBlend.position,wanted.position,t);wanted.target.lerpVectors(seekBlend.target,wanted.target,t);if(seekBlend.elapsed>=1.1)seekBlend=undefined;}
    if(rejoin){rejoin.elapsed+=dt;const t=ease(rejoin.elapsed/1);wanted.position.lerpVectors(rejoin.position,wanted.position,t);wanted.target.lerpVectors(rejoin.target,wanted.target,t);if(rejoin.elapsed>=1){rejoin=undefined;manualCamera=false;}}
    if(!manualCamera||rejoin||restore||seekBlend){internal=true;camera.position.copy(wanted.position);controls.target.copy(wanted.target);controls.update();internal=false;}
    camera.updateMatrixWorld();presentation.render(current.context);updateUI(current);labels(current,route);
    root.dataset.bodyHeight=climbRise(current.climb).toFixed(6);root.dataset.bodyAdvance=climbAdvance(current.climb).toFixed(6);root.dataset.stageHeight=(STEP_HEIGHT*(1-stageDescent(current.climb))).toFixed(6);root.dataset.contextOpacity=poseContext(current);root.dataset.wheelAngle=(current.angles[5]-current.angles[6]).toFixed(4);root.dataset.liftStroke=climbStroke(current.climb).toFixed(5);root.dataset.extraction=current.extract.toFixed(5);root.dataset.frames=String(++frames);root.dataset.viewports='1';root.dataset.storyTime=clock.toFixed(4);root.dataset.storyPhase=current.phase;root.dataset.detailId=current.id===null?'overview':String(current.id);root.dataset.progress=current.progress.toFixed(5);root.dataset.playing=String(auto);root.dataset.cameraDistance=camera.position.distanceTo(controls.target).toFixed(5);root.dataset.cameraPosition=camera.position.toArray().map(v=>v.toFixed(5)).join(',');root.dataset.cameraTarget=controls.target.toArray().map(v=>v.toFixed(5)).join(',');root.dataset.drawCalls=String(renderer.info.render.calls);root.dataset.triangles=String(renderer.info.render.triangles);root.dataset.manualCamera=String(manualCamera);root.dataset.jointAngles=current.angles.map(a=>a.toFixed(4)).join(',');root.dataset.cameraPath=current.view.toFixed(4);root.dataset.idleUntil=idleUntil.toFixed(2);root.dataset.interacting=String(dragging);
    const framingKeys=current.id===null?undefined:current.phase==='motion'&&current.id!==1?motionKeys.get(current.id):detailKeys.get(current.id);
    const core=parts.filter(p=>(!framingKeys||framingKeys.has(p.spec.key))&&(current.phase!=='climb'||p.spec.motion_group!=='uwb')&&(current.id!==6||detailKeys.get(6)!.has(p.spec.key))&&(current.id===null||current.phase==='motion'||p.spec.stage!==1));
    root.dataset.coreInside=String(core.every(p=>p.points.every(v=>{const s=v.clone().add(p.offset).applyMatrix4(p.delta).project(camera);return Math.abs(s.x)<1&&Math.abs(s.y)<1&&s.z>-1&&s.z<1;})));
    if(restore||seekBlend||rejoin||dragging||(auto&&!manualCamera&&now>=idleUntil))requestDraw();else armTimer();
  };
  const startRestore=(autoAfter:boolean)=>{restore={pose:current,position:camera.position.clone(),target:controls.target.clone(),elapsed:0,autoAfter};auto=false;manualCamera=false;rejoin=undefined;seekBlend=undefined;idleUntil=0;clearTimeout(timer);requestDraw();};
  const seek=(time:number,chapter=false)=>{
    restore=undefined;rejoin=undefined;manualCamera=false;
    if(chapter)seekBlend={position:camera.position.clone(),target:controls.target.clone(),elapsed:0};else seekBlend=undefined;
    clock=THREE.MathUtils.clamp(time,0,ARM_STUDY_DURATION);activity();if(chapter){auto=true;idleUntil=0;}requestDraw();
  };
  controls.addEventListener('start',()=>{dragging=true;manualCamera=true;rejoin=undefined;seekBlend=undefined;restore=undefined;clearTimeout(timer);});
  controls.addEventListener('change',()=>{if(internal)return;manualCamera=true;activity();});
  controls.addEventListener('end',()=>{dragging=false;activity();});
  play.addEventListener('click',()=>{auto=!auto;if(auto){idleUntil=0;if(manualCamera)beginRejoin();}requestDraw();},events);
  root.querySelector('[data-assembly]')!.addEventListener('click',()=>startRestore(false),events);
  root.querySelector('[data-replay]')!.addEventListener('click',()=>startRestore(true),events);
  root.querySelector('[data-reset-view]')!.addEventListener('click',()=>{beginRejoin();},events);
  slider.addEventListener('input',()=>seek(Number(slider.value)/1000*ARM_STUDY_DURATION),events);
  chapters.forEach((button,i)=>button.addEventListener('click',()=>seek(i===ARM_STUDY_ORDER.length?ARM_STUDY_CLIMB_START:ARM_STUDY_STARTS[i],true),events));
  routeKey.addEventListener('toggle',()=>{activity();},events);
  canvas.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();startRestore(false);return;}
    const moves:Record<string,[number,number]>={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]};
    if(!moves[event.key])return;event.preventDefault();manualCamera=true;const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));s.theta+=moves[event.key][0];s.phi=THREE.MathUtils.clamp(s.phi+moves[event.key][1],.15,Math.PI-.15);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();activity();
  },events);
  const resize=()=>{
    if(!canvas.clientWidth||!canvas.clientHeight)return;
    renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();viewKeys.clear();viewKeys.set(null,makeViewKey(null));for(const id of ARM_STUDY_ORDER){viewKeys.set(id,makeViewKey(id));viewKeys.set(`motion:${id}`,makeViewKey(`motion:${id}`));}viewKeys.set('finale',makeViewKey('finale'));viewKeys.set('vehicle',makeViewKey('vehicle'));viewKeys.set('climb',makeViewKey('climb'));viewKeys.set('limit-space',makeViewKey('limit-space'));viewKeys.set('limit-contact',makeViewKey('limit-contact'));requestDraw();
  };
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  if(manualCamera&&root.dataset.cameraPosition&&root.dataset.cameraTarget){
    camera.position.fromArray(root.dataset.cameraPosition.split(',').map(Number));controls.target.fromArray(root.dataset.cameraTarget.split(',').map(Number));internal=true;controls.update();internal=false;idleUntil=performance.now()+5000;
  }
  root.dataset.parts=String(parts.length);root.dataset.storyDuration=String(ARM_STUDY_DURATION);root.dataset.viewports='1';
  return {
    setVisible(value){if(visible===value)return;visible=value;root.dataset.rendering=String(value);if(value){lastFrame=0;requestDraw();}else{cancelAnimationFrame(frame);frame=0;clearTimeout(timer);}},
    dispose(){disposed=true;root.dataset.rendering='false';root.dataset.viewports='0';cancelAnimationFrame(frame);clearTimeout(timer);abort.abort();observer.disconnect();controls.dispose();chains.dispose();transmission.dispose();workspace.dispose();presentation.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());axisGeometry.dispose();pathGeometry.dispose();axisMaterial.dispose();pathMaterial.dispose();renderer.dispose();renderer.forceContextLoss();},
  };
}
