// One choreographed camera, one assembly. No sub-windows or simultaneous exploded groups.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { armStudyPose, armDetailStage, ARM_STUDY_DURATION, ARM_STUDY_INTRO, ARM_STUDY_STARTS, ARM_STUDY_ORDER, ARM_STUDY_FINALE_START, jointDemo, finaleAngles, type StudyPose } from './arm-study-story';

import {contextTransform,CLIMB_FORWARD,FOOT_POINTS} from './lib/arm-context-stage';
import {climbAngles,climbStroke,climbRise,climbAdvance,ARM_STUDY_CLIMB_START,ARM_STUDY_CLIMB_DURATION} from './arm-study-story';
import { armMotionMatrices, type MotionContract } from './lib/arm-study-motion';

type Vec = [number, number, number];
type Part = { key: string; node_name: string; motor: boolean; group: number; stage: number; role: string; mount_owner?: string; motion_group:string; group_offset_m: Vec; detail_offset_m: Vec; assembly_axis: Vec };
type Detail = { id: number; part_keys: string[]; route_keys: string[]; route_edges: [number, number][]; feature_keys: string[]; camera: Vec; camera_path:Vec[]; route_variants?:{keys:string[];edges:[number,number][]}[] };
type Metadata = { schema_version: number; parts: Part[]; details: Detail[]; motion:MotionContract };
type Copy = { overview: string; caption: string; names: string[]; descriptions: string[]; features: string[][]; routes: string[][]; phases: Record<string,string>; finale:string; finaleDescription:string;climb:string;climbDescription:string;climbFeatures:string[];pathNames:string[];limitBoundary:string };
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
  let meta: Metadata, model: THREE.Group, contextModel:THREE.Group;
  try {
    [meta,model,contextModel] = await Promise.all([
      fetch(`${base}models/arm-parts.json`, { signal }).then(r => { if(!r.ok) throw new Error('Arm metadata unavailable'); return r.json(); }),
      new GLTFLoader(manager).setDRACOLoader(draco).loadAsync(`${base}models/arm-parts.glb`).then(g => g.scene),
      new GLTFLoader(manager).setDRACOLoader(draco).loadAsync(`${base}models/arm-context.glb`).then(g=>g.scene),
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
        material.transparent=true; material.forceSinglePass=true; material.side=THREE.FrontSide;
        materials.add(material); surfaces.push(material); return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });
    const box = new THREE.Box3().setFromObject(node), points:THREE.Vector3[]=[];
    for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]) points.push(new THREE.Vector3(x,y,z));
    node.matrixAutoUpdate=false;
    return { spec,node,rest:node.matrix.clone(),delta:new THREE.Matrix4(),center:box.getCenter(new THREE.Vector3()),points,surfaces,offset:new THREE.Vector3() };
  });
  const byKey = new Map(parts.map(p => [p.spec.key,p]));
  const detailKeys = new Map(meta.details.map(d => [d.id,new Set(d.part_keys)]));
  const motionKeys=new Map<number,Set<string>>();
  const identity=new THREE.Matrix4();
  for(const id of ARM_STUDY_ORDER){
    const transforms=armMotionMatrices(meta.motion,jointDemo(id,.4));
    motionKeys.set(id,new Set(parts.filter(p=>detailKeys.get(id)!.has(p.spec.key)||transforms.get(p.spec.motion_group)!.elements.some((v,i)=>Math.abs(v-identity.elements[i])>1e-8)).map(p=>p.spec.key)));
  }
  const renderer = new THREE.WebGLRenderer({ canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.2;
  const scene = new THREE.Scene(); scene.add(model,contextModel,new THREE.HemisphereLight(0xe7eef6,0x12213a,2.6));
  for(const [intensity,position] of [[3.4,[-1.6,2.4,1.8]],[2.8,[1.8,1.2,-1.6]],[1.4,[0,-1,1.5]]] as const) {
    const light=new THREE.DirectionalLight(0xe7eef6,intensity); light.position.set(position[0],position[1],position[2]); scene.add(light);
  }
  contextModel.updateMatrixWorld(true);
  const contextParts:Array<{node:THREE.Object3D;group:string;rest:THREE.Matrix4;surfaces:THREE.MeshStandardMaterial[]}>=[];
  contextModel.traverse(node=>{if(!node.userData.context_group)return;const surfaces:THREE.MeshStandardMaterial[]=[];node.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;geometries.add(mesh.geometry);const old=Array.isArray(mesh.material)?mesh.material:[mesh.material];const clones=old.map(m=>{materials.add(m);const c=m.clone() as THREE.MeshStandardMaterial;c.transparent=true;surfaces.push(c);materials.add(c);return c;});mesh.material=Array.isArray(mesh.material)?clones:clones[0];});node.matrixAutoUpdate=false;contextParts.push({node,group:node.userData.context_group,rest:node.matrix.clone(),surfaces});});
  const contextBounds=new THREE.Box3().setFromObject(contextModel),contextCorners:THREE.Vector3[]=[];
  for(const x of [contextBounds.min.x,contextBounds.max.x])for(const y of [contextBounds.min.y,contextBounds.max.y])for(const z of [contextBounds.min.z,contextBounds.max.z])contextCorners.push(new THREE.Vector3(x,y,z));
  const stairMaterial=new THREE.MeshStandardMaterial({color:0x60748a,transparent:true,opacity:0,roughness:.9});materials.add(stairMaterial);
  const stairGeometry=new THREE.BoxGeometry(.95,.08,.48);geometries.add(stairGeometry);
  const stair=new THREE.Mesh(stairGeometry,stairMaterial);stair.position.copy(new THREE.Vector3(-.04,-.27451,-.088).addScaledVector(CLIMB_FORWARD,.57));stair.rotation.y=Math.atan2(CLIMB_FORWARD.x,CLIMB_FORWARD.z);scene.add(stair);
  const groundGeometry=new THREE.PlaneGeometry(1.8,1.5);geometries.add(groundGeometry);const groundMaterial=stairMaterial.clone();materials.add(groundMaterial);const ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.set(-.04,-.315,-.088);scene.add(ground);
  const camera = new THREE.PerspectiveCamera(32,1,.005,50), controls = new OrbitControls(camera,canvas);
  controls.enableDamping=false; controls.enablePan=false; controls.enableZoom=true;
  controls.minDistance=.06; controls.maxDistance=6; controls.minPolarAngle=.15; controls.maxPolarAngle=Math.PI-.15;
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
  const networks=[amber,new THREE.Color('#57cbbb'),new THREE.Color('#b19aff')].map(color=>{const material=new THREE.MeshBasicMaterial({color,transparent:true,depthTest:false});materials.add(material);const wires=new THREE.InstancedMesh(wireGeometry,material,32),dots=new THREE.InstancedMesh(dotGeometry,material,32);wires.renderOrder=4;dots.renderOrder=5;wires.frustumCulled=false;dots.frustumCulled=false;scene.add(wires,dots);return {material,wires,dots};});
  const pathLegend=root.querySelector<HTMLElement>('[data-path-legend]')!,limitCaption=root.querySelector<HTMLElement>('[data-limit-caption]')!;
  const activePath=(pose:StudyPose)=>pose.id===4?Math.min(3,Math.floor(pose.view*3.7)):pose.id===3?0:-1;
  const limitGeometry=new THREE.BufferGeometry();limitGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));geometries.add(limitGeometry);
  const limitLine=new THREE.LineSegments(limitGeometry,axisMaterial);limitLine.renderOrder=4;scene.add(limitLine);
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
    const core=members.filter(p=>(!d||closed||p.spec.stage!==1)&&(id!==6||detailKeys.get(6)!.has(p.spec.key))&&(id!=='climb'||p.spec.motion_group!=='uwb'));
    const points=core.flatMap(p=>d&&!closed?p.points.flatMap(v=>[v.clone(),v.clone().add(new THREE.Vector3(...p.spec.detail_offset_m))]):p.points.map(v=>v.clone()));
    if(id!==null&&(closed||id==='vehicle'||id==='climb')){
      for(let i=0;i<=20;i++){
        const matrices=armMotionMatrices(meta.motion,id==='climb'?climbAngles(i/20):id==='finale'?finaleAngles(i/20):jointDemo(id as number,i/20));
        for(const p of core)for(const point of p.points)points.push(point.clone().applyMatrix4(matrices.get(p.spec.motion_group)!));
      }
    }
    if(id==='vehicle'||id==='climb')points.push(...contextCorners.map(v=>v.clone()));

    const target=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    const directions:Vec[]=id==='climb'?[[.2,.75,1.7]]:id==='vehicle'?[[1.55,.8,1.5]]:id==='finale'?[[1,.65,1.7],[1.65,.85,-.25],[1.55,.5,.2],[1,.65,1.7]]:d?.camera_path??[[1,.6,1.7]];
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
    if(pose.phase==='extract')return blend(keyCamera('vehicle'),keyCamera(null),pose.view);
    if(pose.phase==='climb')return blend(keyCamera('motion:4',1),keyCamera('climb'),ease(pose.climb/.12));
    if(pose.phase==='finale')return keyCamera('finale',pose.finale);
    if(pose.phase==='assembled'&&pose.finale===1)return blend(keyCamera('climb'),keyCamera('vehicle'),pose.focus);
    if(pose.phase==='return')return blend(keyCamera('climb'),keyCamera('vehicle'),pose.focus);
    if(pose.phase==='approach')return blend(keyCamera(pose.previous===null?null:pose.previous===0?'vehicle':`motion:${pose.previous}`,1),keyCamera(pose.id,0),pose.focus);
    if(pose.id===null)return keyCamera(null);
    if(pose.phase==='motion')return blend(keyCamera(pose.id,1),keyCamera(pose.id===0?'vehicle':`motion:${pose.id}`,1),ease(pose.motionU/(pose.id===0?.4:.2)));
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
    title.textContent=pose.phase==='climb'?copy.climb:pose.phase==='finale'?copy.finale:id===null?copy.overview:copy.names[id]; const hasCovers=id!==null&&parts.some(p=>detailKeys.get(id)!.has(p.spec.key)&&p.spec.stage===1);phaseLabel.textContent=copy.phases[seekBlend?'approach':pose.phase==='covers'&&!hasCovers?'mount':pose.phase];
    const routeId=id===4?[3,4,5,5][activePath(pose)]:id;const uiKey=`${id}:${routeId}:${pose.phase}`;
    if(lastUiKey!==uiKey) {
      description.textContent=pose.phase==='climb'?copy.climbDescription:pose.phase==='finale'?copy.finaleDescription:id===null?copy.caption:copy.descriptions[id];
      const items=routeId===null?[]:copy.routes[routeId];routeList.replaceChildren(...items.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
      routeKey.hidden=items.length===0;
      featureLabels.forEach((label,i)=>{label.textContent=pose.phase==='climb'?copy.climbFeatures[i]:id===4?(routeId===3?copy.routes[3][i+5]:copy.features[routeId!][i])??'':id===null?'':copy.features[id][i]??'';}); lastUiKey=uiKey;
    }
    chapters.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===pose.step)));
    play.textContent=auto?play.dataset.stop!:play.dataset.start!;play.setAttribute('aria-pressed',String(auto));
    slider.value=String(Math.round(clock/ARM_STUDY_DURATION*1000));timeLabel.value=`${clock.toFixed(1)} s`;
  };
  const applyPose=(pose:StudyPose)=>{
    const moving=pose.phase==='motion'||pose.angles.some(a=>Math.abs(a)>1e-8);
    const normal=pose.id===null?undefined:detailKeys.get(pose.id);
    const active=pose.id===null?undefined:pose.id===6?normal:moving?motionKeys.get(pose.id):normal,previous=pose.previous===null?undefined:motionKeys.get(pose.previous);
    const transferring=pose.phase==='approach'||pose.phase==='return';
    const linePoints:THREE.Vector3[]=[];
    const transforms=armMotionMatrices(meta.motion,pose.angles);
    const translation=new THREE.Matrix4();
    const weight=pose.restoreWeight??1;const body=new THREE.Matrix4().makeTranslation(CLIMB_FORWARD.x*climbAdvance(pose.climb)*weight,climbRise(pose.climb)*weight,CLIMB_FORWARD.z*climbAdvance(pose.climb)*weight);
    for(const p of contextParts){p.node.matrix.copy(contextTransform(p.group,climbStroke(pose.climb)*weight,body,climbAdvance(pose.climb)*weight));if(p.group==='gimbal_context')p.node.matrix.multiply(new THREE.Matrix4().makeTranslation(0,pose.extract,0)).multiply(transforms.get('j0_carrier')!);p.node.matrix.multiply(p.rest);p.node.matrixWorldNeedsUpdate=true;p.node.visible=pose.context>.005;for(const m of p.surfaces){m.opacity=pose.context*(pose.phase==='climb'?1:p.group==='gimbal_context'?.7:1);m.depthWrite=m.opacity>.5;}}
    stair.visible=ground.visible=pose.phase==='climb';stairMaterial.opacity=.25*ease(pose.climb/.12)*(1-ease((pose.climb-.92)/.08));groundMaterial.opacity=.055*ease(pose.climb/.12)*(1-ease((pose.climb-.92)/.08));groundMaterial.depthWrite=false;
    const whole=body.clone().multiply(new THREE.Matrix4().makeTranslation(0,pose.extract,0));
    for(const p of parts) {
      const selected=active?.has(p.spec.key)??false;
      p.offset.fromArray(p.spec.detail_offset_m).multiplyScalar(selected?armDetailStage(pose.progress,p.spec.stage):0);
      p.delta.copy(whole).multiply(transforms.get(p.spec.motion_group)!);
      p.node.matrix.copy(p.delta).multiply(translation.makeTranslation(p.offset.x,p.offset.y,p.offset.z)).multiply(p.rest);p.node.matrixWorldNeedsUpdate=true;
      const oldOpacity=previous===undefined?1:previous.has(p.spec.key)?1:.018;
      let newOpacity=active===undefined?1:selected?1:.018;
      if(pose.phase==='climb'&&!detailKeys.get(4)!.has(p.spec.key))newOpacity=THREE.MathUtils.lerp(.018,1,ease(pose.climb/.12));
      if(pose.id===4&&pose.phase==='inspect'&&activePath(pose)===0&&meta.details[3].route_keys.slice(5).includes(p.spec.key))newOpacity=1;
      if(pose.phase==='climb'&&p.spec.motion_group==='uwb')newOpacity=.08;
      if(pose.id===6&&p.spec.motion_group==='uwb'&&!normal?.has(p.spec.key))newOpacity=.025;
      if(pose.phase==='motion'&&selected&&!normal?.has(p.spec.key)&&pose.id!==6)newOpacity=THREE.MathUtils.lerp(.018,1,ease(pose.motionU/.15));
      let opacity=transferring?THREE.MathUtils.lerp(oldOpacity,newOpacity,pose.focus):newOpacity;
      if(selected&&p.spec.stage===1)opacity*=1-.95*armDetailStage(pose.progress,1);
      p.node.visible=opacity>.005;
      for(const material of p.surfaces){material.opacity=opacity;material.depthWrite=opacity>.5;}
      if(selected&&!p.spec.mount_owner&&p.spec.stage===2&&p.offset.length()>.003) {
        const axis=new THREE.Vector3(...p.spec.assembly_axis);linePoints.push(p.center.clone().addScaledVector(axis,-.008).applyMatrix4(p.delta),p.center.clone().add(p.offset).addScaledVector(axis,.008).applyMatrix4(p.delta));
      }
    }
    const ticks:THREE.Vector3[]=[];
    for(const key of ['part_291','part_303']){const p=byKey.get(key)!;for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;for(const radius of [.024,.034])ticks.push(p.center.clone().add(new THREE.Vector3(key==='part_291'?.007:-.007,Math.cos(angle)*radius,Math.sin(angle)*radius)).applyMatrix4(p.delta));}}
    updateLines(wheelTickGeometry,ticks);wheelTicks.visible=pose.phase==='climb'&&pose.climb>.22&&pose.climb<.9;
    model.updateMatrixWorld(true);
    updateLines(axisGeometry,linePoints);axes.computeLineDistances();axes.visible=pose.progress>.01;
    const detail=pose.id===null?undefined:meta.details[pose.id];
    const variant=detail?.route_variants?.[Math.min(2,activePath(pose))];
    const route=detail?(variant?.keys??detail.route_keys).map(k=>byKey.get(k)!).map(p=>p.center.clone().add(p.offset).applyMatrix4(p.delta)):[];
    const segments=detail?(variant?.edges??detail.route_edges).flatMap(([a,b])=>[route[a],route[b]]):[];
    updateLines(pathGeometry,segments);paths.visible=segments.length>0&&pose.phase==='inspect'&&pose.id!==3&&pose.id!==4;
    const showPower=(pose.id===3||pose.id===4)&&pose.phase==='inspect';pathLegend.hidden=!showPower;
    pathLegend.querySelectorAll<HTMLElement>('span').forEach((label,i)=>{label.style.opacity=activePath(pose)===3||activePath(pose)===i?'1':'.3';});
    const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),unitY=new THREE.Vector3(0,1,0);
    networks.forEach((network,index)=>{
      network.wires.visible=network.dots.visible=showPower&&(pose.id===4||index===0);
      if(!network.wires.visible)return;
      const d=meta.details[4].route_variants![index],vertices=d.keys.map(k=>{const p=byKey.get(k)!;return p.center.clone().add(p.offset).applyMatrix4(p.delta);});
      network.material.opacity=activePath(pose)===index?1:activePath(pose)===3?.65:.13;
      const edges=pose.id===4&&index===0?d.edges.filter(([a])=>a>=5):d.edges;edges.forEach(([a,b],i)=>{const v=vertices[b].clone().sub(vertices[a]),length=v.length();rotation.setFromUnitVectors(unitY,v.clone().normalize());matrix.compose(vertices[a].clone().lerp(vertices[b],.5),rotation,new THREE.Vector3(.0013,length,.0013));network.wires.setMatrixAt(i,matrix);matrix.makeTranslation(...vertices[a].clone().lerp(vertices[b],(clock*.6+i*.17)%1).toArray());network.dots.setMatrixAt(i,matrix);});
      network.wires.count=network.dots.count=edges.length;network.wires.instanceMatrix.needsUpdate=true;network.dots.instanceMatrix.needsUpdate=true;
    });
    const showLimit=pose.id===6&&pose.phase==='motion';limitLine.visible=showLimit;limitCaption.hidden=!showLimit;
    if(showLimit){const stop=byKey.get(meta.details[6].feature_keys[2])!,sample=armMotionMatrices(meta.motion,jointDemo(6,.4)),point=stop.center.clone().applyMatrix4(sample.get('link_3')!).applyMatrix4(sample.get('uwb')!.clone().invert()).applyMatrix4(transforms.get('uwb')!).applyMatrix4(whole);updateLines(limitGeometry,[point.clone().add(new THREE.Vector3(0,-.025,.012)),point.clone().add(new THREE.Vector3(0,.025,.012))]);limitLine.computeLineDistances();}

    return route;
  };
  const labels=(pose:StudyPose,route:THREE.Vector3[])=>{
    const project=(point:THREE.Vector3)=>{const p=point.clone().project(camera);return{x:(p.x*.5+.5)*canvas.clientWidth,y:(-.5*p.y+.5)*canvas.clientHeight,z:p.z};};
    const detail=pose.id===null?undefined:meta.details[pose.id===4?[3,4,5,5][activePath(pose)]:pose.id],occupied:{x:number;y:number}[]=[];
    featureLabels.forEach((label,i)=>{
      const key=pose.id===4&&activePath(pose)===0?meta.details[3].route_keys[i+5]:detail?.feature_keys[i];label.hidden=(!key&&pose.phase!=='climb')||!['inspect','motion','climb'].includes(pose.phase)||(pose.phase==='inspect'&&pose.view<i*.08);if(label.hidden)return;
      const p=key?byKey.get(key):undefined;const point=project(p?p.center.clone().add(p.offset).applyMatrix4(p.delta):i===0?new THREE.Vector3(...FOOT_POINTS[0]).add(new THREE.Vector3(0,climbRise(pose.climb)-2*climbStroke(pose.climb),0)).addScaledVector(CLIMB_FORWARD,climbAdvance(pose.climb)):byKey.get(meta.details[5].route_keys[6])!.center.clone().applyMatrix4(byKey.get(meta.details[5].route_keys[6])!.delta).add(new THREE.Vector3(0,i===1?.14:0,0)));
      if(point.x<0||point.x>canvas.clientWidth||point.y<0||point.y>canvas.clientHeight||point.z>1){label.hidden=true;return;}
      const x=THREE.MathUtils.clamp(point.x+15,6,canvas.clientWidth-150);let y=THREE.MathUtils.clamp(point.y-25,65,canvas.clientHeight-26);
      while(occupied.some(p=>Math.abs(p.x-x)<150&&Math.abs(p.y-y)<25)&&y<canvas.clientHeight-50)y+=26;
      occupied.push({x,y});label.style.transform=`translate(${x}px,${y}px)`;
    });
    routeLabels.forEach((label,i)=>{label.hidden=true||i>=route.length||pose.phase==='approach'||pose.phase==='return';if(label.hidden)return;const p=project(route[i]);label.hidden=p.x<0||p.x>canvas.clientWidth||p.y<0||p.y>canvas.clientHeight||p.z>1;label.style.transform=`translate(${p.x-8}px,${p.y+8}px)`;});
  };
  const poseContext=(p:StudyPose)=>p.context.toFixed(5);
  const draw=(_timestamp:number)=>{
    const now=performance.now();
    frame=0;if(!visible||disposed)return;
    if(lastFrame&&now-lastFrame<1000/30){requestDraw();return;}
    const dt=Math.min(.1,lastFrame?(now-lastFrame)/1000:1/30);lastFrame=now;
    if(manualCamera&&auto&&!dragging&&now>=idleUntil&&!rejoin&&!restore&&!seekBlend)beginRejoin();
    if(auto&&!manualCamera&&!restore&&!seekBlend&&now>=idleUntil)clock=(clock+dt)%ARM_STUDY_DURATION;
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
    camera.updateMatrixWorld();renderer.render(scene,camera);labels(current,route);updateUI(current);
    root.dataset.contextOpacity=poseContext(current);root.dataset.wheelAngle=(current.angles[5]-current.angles[6]).toFixed(4);root.dataset.liftStroke=climbStroke(current.climb).toFixed(5);root.dataset.extraction=current.extract.toFixed(5);root.dataset.frames=String(++frames);root.dataset.viewports='1';root.dataset.storyTime=clock.toFixed(4);root.dataset.storyPhase=current.phase;root.dataset.detailId=current.id===null?'overview':String(current.id);root.dataset.progress=current.progress.toFixed(5);root.dataset.playing=String(auto);root.dataset.cameraDistance=camera.position.distanceTo(controls.target).toFixed(5);root.dataset.cameraPosition=camera.position.toArray().map(v=>v.toFixed(5)).join(',');root.dataset.cameraTarget=controls.target.toArray().map(v=>v.toFixed(5)).join(',');root.dataset.drawCalls=String(renderer.info.render.calls);root.dataset.triangles=String(renderer.info.render.triangles);root.dataset.manualCamera=String(manualCamera);root.dataset.jointAngles=current.angles.map(a=>a.toFixed(4)).join(',');root.dataset.cameraPath=current.view.toFixed(4);root.dataset.idleUntil=idleUntil.toFixed(2);root.dataset.interacting=String(dragging);
    const framingKeys=current.id===null?undefined:current.phase==='motion'?motionKeys.get(current.id):detailKeys.get(current.id);
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
  chapters.forEach((button,i)=>button.addEventListener('click',()=>seek(i===7?ARM_STUDY_CLIMB_START:ARM_STUDY_STARTS[i]+1.3,true),events));
  routeKey.addEventListener('toggle',()=>{activity();},events);
  canvas.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();startRestore(false);return;}
    const moves:Record<string,[number,number]>={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]};
    if(!moves[event.key])return;event.preventDefault();manualCamera=true;const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));s.theta+=moves[event.key][0];s.phi=THREE.MathUtils.clamp(s.phi+moves[event.key][1],.15,Math.PI-.15);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();activity();
  },events);
  const resize=()=>{
    if(!canvas.clientWidth||!canvas.clientHeight)return;
    renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();viewKeys.clear();viewKeys.set(null,makeViewKey(null));for(const id of ARM_STUDY_ORDER){viewKeys.set(id,makeViewKey(id));viewKeys.set(`motion:${id}`,makeViewKey(`motion:${id}`));}viewKeys.set('finale',makeViewKey('finale'));viewKeys.set('vehicle',makeViewKey('vehicle'));viewKeys.set('climb',makeViewKey('climb'));requestDraw();
  };
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  if(manualCamera&&root.dataset.cameraPosition&&root.dataset.cameraTarget){
    camera.position.fromArray(root.dataset.cameraPosition.split(',').map(Number));controls.target.fromArray(root.dataset.cameraTarget.split(',').map(Number));internal=true;controls.update();internal=false;idleUntil=performance.now()+5000;
  }
  root.dataset.parts=String(parts.length);root.dataset.storyDuration=String(ARM_STUDY_DURATION);root.dataset.viewports='1';
  return {
    setVisible(value){if(visible===value)return;visible=value;root.dataset.rendering=String(value);if(value){lastFrame=0;requestDraw();}else{cancelAnimationFrame(frame);frame=0;clearTimeout(timer);}},
    dispose(){disposed=true;root.dataset.rendering='false';root.dataset.viewports='0';cancelAnimationFrame(frame);clearTimeout(timer);abort.abort();observer.disconnect();controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());axisGeometry.dispose();pathGeometry.dispose();axisMaterial.dispose();pathMaterial.dispose();renderer.dispose();renderer.forceContextLoss();},
  };
}
