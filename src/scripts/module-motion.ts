import * as THREE from 'three';
import type { MechanismStage } from './lib/mechanism-stage';

const TAU = Math.PI * 2;
export const CYCLE_DURATION = 6.3;
const ease = (x: number) => x * x * (3 - 2 * x);
export function explosionCycle(time: number) {
  const t = ((time % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  if (t < 1.2) return { amount: 0, phase: 'assembled' };
  if (t < 3) return { amount: ease((t - 1.2) / 1.8), phase: 'opening' };
  if (t < 4.5) return { amount: 1, phase: 'exploded' };
  return { amount: 1 - ease((t - 4.5) / 1.8), phase: 'closing' };
}
/** Invert the eased leg, so an idle resume starts at the user's current amount. */
export function cycleAtAmount(amount: number, closing: boolean) {
  let lo = 0, hi = 1;
  const value = closing ? 1 - amount : amount;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < value) lo = mid; else hi = mid;
  }
  return (closing ? 4.5 : 1.2) + 1.8 * (lo + hi) / 2;
}

/** Offset slider-crank in the measured CAD plane; the rod length is invariant. */
export function sliderCrank(angle: number, origin: THREE.Vector3, big: THREE.Vector3, small: THREE.Vector3) {
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  const a = big.clone().sub(origin).applyQuaternion(rotation).add(origin);
  const length = big.distanceTo(small);
  const dy = small.y - a.y, dz = small.z - a.z;
  const c = new THREE.Vector3(a.x + Math.sqrt(Math.max(0, length * length - dy * dy - dz * dz)), small.y, small.z);
  return { big: a, small: c, rodLength: length };
}

export function createModuleMotion(stage: MechanismStage, kind: 'pump' | 'swerve') {
  const parts: { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; axis: THREE.Vector3; offset: THREE.Vector3; motion?: string }[] = [];
  let shell: THREE.Object3D | undefined, crank: THREE.Object3D | undefined;
  stage.model.traverse(object => {
    const data = object.userData;
    if (kind === 'pump' && data.web_motor_intact) object.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        // Keep the complete motor in its CAD position, with the linkage visible
        // even when the user orbits onto the motor side.
        material.transparent = true; material.opacity = .08; material.depthWrite = false;
        material.side = THREE.FrontSide; material.needsUpdate = true;
      }
    });
    if (data.web_shell) shell = object;
    if (data.web_motion === 'crank') crank = object;
    if (!data.web_motion && !data.web_explode) return;
    parts.push({ object, position: object.position.clone(), quaternion: object.quaternion.clone(),
      axis: new THREE.Vector3().fromArray(data.web_axis ?? [0, 1, 0]).normalize(),
      offset: new THREE.Vector3().fromArray(data.web_explode ?? [0, 0, 0]), motion: data.web_motion });
    object.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const m = material as THREE.MeshStandardMaterial;
        if (data.web_transmission || data.web_motion === 'crank' || data.web_motion === 'rod') {
          m.color.lerp(stage.amber, .28); m.emissive.copy(stage.amber); m.emissiveIntensity = .06;
        }
        if (data.web_structure) {
          m.transparent = true; m.opacity = .36; m.depthWrite = false;
        }
      }
    });
  });
  if (shell) shell.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.transparent = true; material.opacity = kind === 'pump' ? .12 : .16; material.depthWrite = false;
      material.side = THREE.FrontSide;
    }
  });
  const guided = kind === 'swerve' ? parts.filter(p => p.object.userData.web_guide) : [];
  const guidePositions = new Float32Array(guided.length * 6);
  let guides: THREE.LineSegments | undefined;
  if (guided.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
    guides = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: stage.amber, transparent: true, opacity: .16, depthWrite: false }));
    guides.frustumCulled = false; stage.scene.add(guides);
  }
  const from = (key: string) => new THREE.Vector3().fromArray(crank!.userData[key]);
  const origin = crank ? from('web_crank_origin') : new THREE.Vector3();
  const big = crank ? from('web_big_end') : new THREE.Vector3();
  const small = crank ? from('web_small_end') : new THREE.Vector3();
  const rodDirection = small.clone().sub(big).normalize();
  const rod = parts.find(p => p.motion === 'rod');
  const piston = parts.find(p => p.motion === 'piston');
  stage.model.updateMatrixWorld(true);
  const localPin = (part: typeof rod, point: THREE.Vector3) => part?.object.worldToLocal(stage.model.localToWorld(point.clone()));
  const rodBig = localPin(rod, big), rodSmall = localPin(rod, small), pistonSmall = localPin(piston, small);
  // The exporter supplies measured port centres in the same centred web frame.
  const ports: THREE.Vector3[] = shell ? (shell.userData.web_ports ?? []).map((p: number[]) => new THREE.Vector3().fromArray(p)) : [];
  const portAxis = new THREE.Vector3().fromArray(shell?.userData.web_port_axis ?? [1, 0, 0]);
  if (kind === 'pump' && shell && ports.length === 2) {
    // Keep the actual CAD tube surfaces legible through the ghosted housing.
    // Reuse their triangles, rather than drawing a replacement pipe shape.
    const details: { parent: THREE.Mesh; mesh: THREE.Mesh }[] = [];
    shell.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = mesh.geometry, positions = source.attributes.position;
      const index = source.index;
      const toModel = stage.model.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
      const points = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(toModel));
      for (const port of ports) {
        const onTube = points.map(point => {
          const offset = point.clone().sub(port), axial = offset.dot(portAxis);
          // Port centres are at the tube mouths; the CAD walls extend inward.
          return axial >= -.008 && axial <= .00005 && offset.addScaledVector(portAxis, -axial).length() < .0045;
        });
        const triangles: number[] = [];
        for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
          const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
          if (ids.every(id => onTube[id])) triangles.push(...ids);
        }
        if (!triangles.length) continue;
        const geometry = source.clone(); geometry.setIndex(triangles); geometry.clearGroups();
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone();
        material.opacity = .55;
        details.push({ parent: mesh, mesh: new THREE.Mesh(geometry, material) });
      }
    });
    details.forEach(({ parent, mesh }) => parent.add(mesh));
  }
  const count = 9, positions = new Float32Array(count * 3);
  let particles: THREE.Points | undefined;
  const arrows: THREE.ArrowHelper[] = [];
  if (kind === 'pump' && ports.length === 2) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color: stage.amber, size: .0018, transparent: true, opacity: .9, depthWrite: false }));
    particles.frustumCulled = false; stage.model.add(particles);
    ports.forEach((port: THREE.Vector3, index: number) => {
      const outward = portAxis.clone();
      const arrow = new THREE.ArrowHelper(index === 0 ? outward.clone().negate() : outward,
        port.clone().addScaledVector(outward, index === 0 ? .028 : .004), .023, stage.amber, .0045, .0024);
      stage.model.add(arrow); arrows.push(arrow);
    });
  }
  const rotation = new THREE.Quaternion(), swing = new THREE.Quaternion();
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const project = (point: THREE.Vector3) => {
    const ndc = stage.model.localToWorld(point.clone()).project(stage.camera);
    return { x: (ndc.x + 1) * 50, y: (1 - ndc.y) * 50, visible: ndc.z > -1 && ndc.z < 1 };
  };
  let diagnostics = { stroke: 'intake', inletOpen: true, outletOpen: false, rodError: 0, sliderError: 0, pins: [] as number[][] };
  return {
    update(time: number, explode: number) {
      const angle = (time * 2.8) % TAU;
      const pose = sliderCrank(angle, origin, big, small);
      const next = sliderCrank(angle + .0001, origin, big, small);
      // Positive travel toward the pump head reduces chamber volume.
      const intake = next.small.x < pose.small.x;
      for (const p of parts) {
        p.object.position.copy(p.position); p.object.quaternion.copy(p.quaternion);
        if (p.object.userData.web_motor_intact) continue;
        p.object.position.addScaledVector(p.offset, explode);
        if (kind === 'swerve') {
          const value = p.motion === 'roll' ? time * 1.1 * explode : p.motion === 'steer' ? Math.sin(time * .5) * .26 * explode : 0;
          // Axes are expressed in the part parent's frame, not the mesh frame.
          if (value) p.object.quaternion.premultiply(rotation.setFromAxisAngle(p.axis, value));
        } else if (p.motion === 'crank' || p.motion === 'big-end-bearing') {
          rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          p.object.position.sub(origin).applyQuaternion(rotation).add(origin);
          p.object.quaternion.premultiply(rotation);
        } else if (p.motion === 'rod') {
          swing.setFromUnitVectors(rodDirection, pose.small.clone().sub(pose.big).normalize());
          p.object.position.sub(big).applyQuaternion(swing).add(pose.big);
          p.object.quaternion.premultiply(swing);
        } else if (p.motion === 'piston') {
          p.object.position.add(pose.small.clone().sub(small));
        }
      }
      stage.model.updateMatrixWorld(true);
      guided.forEach((p, index) => {
        a.copy(p.position); b.copy(p.object.position);
        p.object.parent?.localToWorld(a); p.object.parent?.localToWorld(b);
        a.toArray(guidePositions, index * 6); b.toArray(guidePositions, index * 6 + 3);
      });
      if (guides) { guides.visible = explode > .02; guides.geometry.attributes.position.needsUpdate = true; }
      if (particles) {
        const port = ports[intake ? 0 : 1];
        for (let i = 0; i < count; i++) {
          const t = (time * 1.4 + i / count) % 1;
          a.copy(port).addScaledVector(portAxis, .004 + .033 * (intake ? 1 - t : t));
          a.toArray(positions, i * 3);
        }
        particles.geometry.attributes.position.needsUpdate = true;
        arrows[0].visible = intake; arrows[1].visible = !intake;
      }
      const measured = (part: typeof rod, pin: THREE.Vector3 | undefined, fallback: THREE.Vector3) =>
        part && pin ? stage.model.worldToLocal(part.object.localToWorld(pin.clone())) : fallback;
      const measuredBig = measured(rod, rodBig, pose.big);
      const measuredSmall = measured(rod, rodSmall, pose.small);
      const measuredPiston = measured(piston, pistonSmall, pose.small);
      diagnostics = { stroke: intake ? 'intake' : 'exhaust', inletOpen: intake, outletOpen: !intake,
        rodError: Math.max(Math.abs(measuredBig.distanceTo(measuredSmall) - pose.rodLength), measuredBig.distanceTo(pose.big), measuredSmall.distanceTo(measuredPiston)),
        sliderError: Math.hypot(measuredPiston.y - small.y, measuredPiston.z - small.z),
        pins: [measuredBig.toArray(), measuredPiston.toArray()] };
    },
    diagnostics: () => diagnostics,
    annotations() {
      if (kind === 'pump') return ports.map((port: THREE.Vector3) => project(port.clone().addScaledVector(portAxis, .031)));
      return ['drive-input', 'drive-compound', 'drive-output', 'steering-output'].map(name => {
        const part = parts.find(p => p.object.userData.web_transmission === name);
        if (!part) return { x: 0, y: 0, visible: false };
        const ndc = new THREE.Box3().setFromObject(part.object).getCenter(new THREE.Vector3()).project(stage.camera);
        return { x: (ndc.x + 1) * 50, y: (1 - ndc.y) * 50, visible: ndc.z > -1 && ndc.z < 1 };
      });
    },
  };
}
export type ModuleMotion = ReturnType<typeof createModuleMotion>;
