import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { MechanismStage } from './mechanism-stage';
import { createModuleMotion, swervePresentation } from '../module-motion';
import { setCadOpacity } from './cad-opacity';
import { placeSwerveModule, type SwervePlacement } from './swerve-placement';

type Metadata = { schema_version: number; decimated: boolean; wheels: SwervePlacement[]; arm_to_module: number[] };

/** The B-chapter vehicle source, with complete wheel subtrees replaced once.
 * Geometry is shared by all four detailed modules; moving parts/materials are not. */
export async function loadSwerveChassis(stage: MechanismStage, base: string, signal: AbortSignal) {
  const manager = new THREE.LoadingManager();
  const abort = () => manager.abort();
  signal.addEventListener('abort', abort, { once: true });
  const draco = new DRACOLoader(manager).setDecoderPath(`${base}models/draco/`).setWorkerLimit(1);
  const loader = new GLTFLoader(manager).setDRACOLoader(draco);
  let metadata: Metadata, body: THREE.Group, arm: THREE.Group;
  try {
    [metadata, body, arm] = await Promise.all([
      fetch(`${base}models/engineer-swerve-context.json`, { signal }).then(r => { if (!r.ok) throw new Error('Swerve vehicle metadata unavailable'); return r.json(); }),
      loader.loadAsync(`${base}models/engineer-swerve-context.glb`).then(g => g.scene),
      loader.loadAsync(`${base}models/arm-parts.glb`).then(g => g.scene),
    ]);
  } finally { signal.removeEventListener('abort', abort); draco.dispose(); }
  if (metadata.schema_version !== 1 || metadata.decimated || metadata.wheels.length !== 4) throw new Error('Swerve vehicle precision/assembly contract mismatch');
  const context = new THREE.Group();
  context.name = 'swerve_vehicle_context';
  const armFrame = new THREE.Group();
  armFrame.matrixAutoUpdate = false; armFrame.matrix.fromArray(metadata.arm_to_module); armFrame.add(arm);
  const fixedParts: THREE.Object3D[] = [];
  body.traverse(object => { if (Number.isInteger(object.userData.swerve_fixed_wheel)) fixedParts.push(object); });
  fixedParts.forEach(object => {
    body.remove(object);
    // The source GLB shares palette materials with the body. Wheel mounts
    // must stay solid while the isolated body pass fades to twelve percent.
    object.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
    });
  });
  context.add(body, armFrame); stage.scene.add(context);
  context.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const material = m as THREE.MeshStandardMaterial;
      material.transparent = false; material.opacity = 1; material.depthWrite = true;
      material.side = THREE.FrontSide; material.roughness = Math.max(.42, material.roughness);
    }
  });
  const otherWheels = metadata.wheels.slice(1).map((spec, index) => {
    const model = stage.model.clone(true);
    placeSwerveModule(model, spec);
    model.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
      if ((index === 0 || index === 2) && [61, 63].includes(object.userData.source_node_index)) object.visible = false;
    });
    const frame = new THREE.Group();
    frame.name = `swerve_source_${spec.source_root}`;
    frame.matrixAutoUpdate = false; frame.matrix.fromArray(spec.matrix); frame.add(model); stage.scene.add(frame);
    fixedParts.filter(object => object.userData.swerve_fixed_wheel === index + 1).forEach(object => frame.add(object));
    const motion = createModuleMotion({ ...stage, model }, 'swerve');
    const materials = new Set<THREE.Material>();
    frame.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.isMesh) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m); });
    return { frame, model, spec, motion, materials, index: index + 1 };
  });
  const pointBox = new THREE.Box3().setFromObject(context);
  pointBox.union(new THREE.Box3().setFromObject(stage.model));
  otherWheels.forEach(w => pointBox.union(new THREE.Box3().setFromObject(w.frame)));
  pointBox.expandByScalar(.012);
  // A fixed cylindrical envelope reserves every azimuth once, without zoom breathing.
  const center = pointBox.getCenter(new THREE.Vector3());
  const radius = Math.hypot(pointBox.max.x - center.x, pointBox.max.z - center.z);
  const points: THREE.Vector3[] = [];
  for (const y of [pointBox.min.y, pointBox.max.y]) for (let i = 0; i < 64; i++) {
    const angle = i * Math.PI * 2 / 64;
    points.push(new THREE.Vector3(center.x + radius * Math.cos(angle), y, center.z + radius * Math.sin(angle)));
  }
  stage.attachSwerveVehicle(context, points);
  let overview = 1, bodyOpacity = 1, otherOpacity = 1;
  return {
    update(time: number, automatic: boolean, manualDetail: boolean, resumeWeight: number) {
      const pose = swervePresentation(time);
      if (automatic) { overview = pose.overview; bodyOpacity = pose.bodyOpacity; otherOpacity = pose.otherOpacity; }
      else if (manualDetail) { overview = 0; bodyOpacity = 0; otherOpacity = 0; }
      context.visible = bodyOpacity > .00001;
      otherWheels.forEach(w => {
        const sample = swervePresentation(time, w.index);
        const steering = sample.steering + THREE.MathUtils.lerp(w.spec.rest_steer, w.spec.common_steer, sample.alignment);
        w.motion.update(0, 0, { ...sample, demo: true, steering });
        w.frame.visible = otherOpacity > .00001;
        w.materials.forEach(material => setCadOpacity(material, otherOpacity));
      });
      stage.setSwerveOverview(overview, bodyOpacity, automatic || manualDetail, resumeWeight);
      return { overview, bodyOpacity, otherOpacity,
        suspensions: [0, 1, 2, 3].map(i => swervePresentation(time, i).suspension),
        steering: metadata.wheels.map((w, i) => { const p = swervePresentation(time, i); return p.steering + THREE.MathUtils.lerp(w.rest_steer, w.common_steer, p.alignment); }) };
    },
  };
}
export type SwerveChassis = Awaited<ReturnType<typeof loadSwerveChassis>>;
