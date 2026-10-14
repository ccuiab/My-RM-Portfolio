import * as THREE from 'three';
import type { MechanismStage } from './lib/mechanism-stage';
import { setCadOpacity } from './lib/cad-opacity.ts';

const TAU = Math.PI * 2;
// Assembled hold, slow open, long exploded hold, slow close (seconds).
const HOLD_ASSEMBLED = 8, OPEN = 6, HOLD_EXPLODED = 3, CLOSE = 6;
export const CYCLE_DURATION = HOLD_ASSEMBLED + OPEN + HOLD_EXPLODED + CLOSE;
/** Cycle time at which the exploded hold begins. */
export const EXPLODED_START = HOLD_ASSEMBLED + OPEN;
const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const HOLD_SOLID = 2, FADE_OUT = 3, HOLD_GHOSTED = 4, FADE_IN = 3;
export const PUMP_CYCLE_DURATION = HOLD_SOLID + FADE_OUT + HOLD_GHOSTED + FADE_IN;
/** The pump keeps its current ghosted appearance at the transparent endpoint. */
export function pumpTransparencyCycle(time: number) {
  const t = ((time % PUMP_CYCLE_DURATION) + PUMP_CYCLE_DURATION) % PUMP_CYCLE_DURATION;
  if (t < HOLD_SOLID) return { amount: 0, phase: 'solid' };
  if (t < HOLD_SOLID + FADE_OUT) return { amount: ease((t - HOLD_SOLID) / FADE_OUT), phase: 'fading-out' };
  if (t < HOLD_SOLID + FADE_OUT + HOLD_GHOSTED) return { amount: 1, phase: 'ghosted' };
  return { amount: 1 - ease((t - HOLD_SOLID - FADE_OUT - HOLD_GHOSTED) / FADE_IN), phase: 'fading-in' };
}
const PUMP_SLOW = 7, PUMP_ACCELERATE = 1, PUMP_FAST = 2, PUMP_DECELERATE = 2;
const PUMP_BASE_SPEED = 2.8, PUMP_PEAK_MULTIPLIER = 4;
export const PUMP_DRIVE_DURATION = PUMP_SLOW + PUMP_ACCELERATE + PUMP_FAST + PUMP_DECELERATE;
// Integral of the same quintic easing curve; its value at 1 is 1/2.
const integratedEase = (x: number) => x * x * x * x * (x * x - 3 * x + 2.5);
/** Brief speed pulse on its own clock. Integrate velocity so neither changes
 * in speed nor wrapping the cycle can jump or reverse the crank angle. */
export function pumpDriveCycle(time: number) {
  const cycles = Math.floor(time / PUMP_DRIVE_DURATION);
  const t = ((time % PUMP_DRIVE_DURATION) + PUMP_DRIVE_DURATION) % PUMP_DRIVE_DURATION;
  const boost = PUMP_PEAK_MULTIPLIER - 1;
  const rampAverage = (1 + PUMP_PEAK_MULTIPLIER) / 2;
  let travel = t, speedMultiplier = 1, annotationOpacity = 1;
  let phase = 'slow';
  if (t >= PUMP_SLOW && t < PUMP_SLOW + PUMP_ACCELERATE) {
    const x = (t - PUMP_SLOW) / PUMP_ACCELERATE, amount = ease(x);
    phase = 'accelerating'; speedMultiplier = 1 + boost * amount; annotationOpacity = 1 - amount;
    travel = PUMP_SLOW + PUMP_ACCELERATE * (x + boost * integratedEase(x));
  } else if (t >= PUMP_SLOW + PUMP_ACCELERATE && t < PUMP_SLOW + PUMP_ACCELERATE + PUMP_FAST) {
    phase = 'fast'; speedMultiplier = PUMP_PEAK_MULTIPLIER; annotationOpacity = 0;
    travel = PUMP_SLOW + PUMP_ACCELERATE * rampAverage
      + (t - PUMP_SLOW - PUMP_ACCELERATE) * PUMP_PEAK_MULTIPLIER;
  } else if (t >= PUMP_SLOW + PUMP_ACCELERATE + PUMP_FAST) {
    const x = (t - PUMP_SLOW - PUMP_ACCELERATE - PUMP_FAST) / PUMP_DECELERATE, amount = ease(x);
    phase = 'decelerating'; speedMultiplier = PUMP_PEAK_MULTIPLIER - boost * amount; annotationOpacity = amount;
    travel = PUMP_SLOW + PUMP_ACCELERATE * rampAverage + PUMP_FAST * PUMP_PEAK_MULTIPLIER
      + PUMP_DECELERATE * (PUMP_PEAK_MULTIPLIER * x - boost * integratedEase(x));
  }
  const cycleTravel = PUMP_SLOW + (PUMP_ACCELERATE + PUMP_DECELERATE) * rampAverage + PUMP_FAST * PUMP_PEAK_MULTIPLIER;
  const cumulativeAngle = (cycles * cycleTravel + travel) * PUMP_BASE_SPEED;
  return { angle: ((cumulativeAngle % TAU) + TAU) % TAU, cumulativeAngle, speedMultiplier, annotationOpacity, phase };
}
export function explosionCycle(time: number) {
  const t = ((time % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  if (t < HOLD_ASSEMBLED) return { amount: 0, phase: 'assembled' };
  if (t < EXPLODED_START) return { amount: ease((t - HOLD_ASSEMBLED) / OPEN), phase: 'opening' };
  if (t < EXPLODED_START + HOLD_EXPLODED) return { amount: 1, phase: 'exploded' };
  return { amount: 1 - ease((t - EXPLODED_START - HOLD_EXPLODED) / CLOSE), phase: 'closing' };
}
export const SWERVE_PRESENTATION_DURATION = CYCLE_DURATION;
/** Smooth, compact response: fast compression, smaller rebounds, then exact rest. */
function sampleKeys(time: number, keys: readonly (readonly [number, number])[]) {
  for (let i = 1; i < keys.length; i++) {
    const [end, value] = keys[i], [start, previous] = keys[i - 1];
    if (time <= end) return THREE.MathUtils.lerp(previous, value, ease(THREE.MathUtils.clamp((time - start) / (end - start), 0, 1)));
  }
  return keys[keys.length - 1][1];
}
const impactResponse = [[0, 0], [.085, 1], [.24, .12], [.34, .32], [.49, .035], [.6, .09], [.8, 0]] as const;
/** Seeded road events vary between rounds, not between frames. This is a bounded
 * visual response, not a calibrated spring/damper or a claimed physical limit. */
export function swervePresentation(time: number) {
  const t = ((time % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  if (t >= HOLD_ASSEMBLED) return { ...explosionCycle(t),
    motionTime: (t - HOLD_ASSEMBLED) / (CYCLE_DURATION - HOLD_ASSEMBLED) * CYCLE_DURATION,
    suspension: 0, steering: 0, roll: 0, demo: false, orbitWeight: 1 };
  const round = Math.floor(time / CYCLE_DURATION);
  const noise = (index: number) => {
    const x = Math.sin(round * 127.1 + index * 311.7 + 17.3) * 43758.5453;
    return x - Math.floor(x);
  };
  let suspension = 0;
  // One pronounced bump, a short rough patch, then a final bump and long rest.
  const events = [[.7, .009], [2.1, .0045], [2.48, .005], [4.85, .01]];
  events.forEach(([start, amplitude], i) => {
    const age = t - start - (noise(i) - .5) * .18;
    const responseTime = age / (.8 + .3 * noise(i + 10));
    if (responseTime >= 0 && responseTime <= .8) suspension += amplitude * (.8 + .2 * noise(i + 5)) * sampleKeys(responseTime, impactResponse);
  });
  const direction = round % 2 ? -1 : 1;
  const steering = direction * sampleKeys(t, [[0, 0], [.3, 0], [.95, 1.15], [1.65, 1.15],
    [2.45, -.95], [3.25, -.95], [3.7, -.65], [4.4, -.65], [5.05, 1.05], [6.3, 1.05], [7.15, 0], [8, 0]]);
  // Rolling gives the direction changes a purpose. End at one full turn so
  // returning to the exploded-view pose is continuous, with no reverse snap.
  const roll = sampleKeys(t, [[0, 0], [.3, 0], [1.35, 1.25], [1.8, 1.25],
    [3, 3.1], [3.9, 3.1], [5.3, 5.4], [6.8, TAU], [8, TAU]]);
  return { amount: 0, phase: 'articulation', motionTime: 0,
    suspension, steering, roll, demo: true, orbitWeight: 1 };
}
/** Bounded, periodic demonstration: closing never unwinds accumulated turns. */
export function swerveAngles(time: number, _explode: number) {
  const phase = ((time % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION / CYCLE_DURATION * TAU;
  return { roll: Math.sin(phase) * .48, steer: Math.sin(phase) * .18 };
}
/** Steering clears first; the wheel-axis stack follows. Reverse is identical. */
export function swervePartProgress(amount: number, group?: string) {
  const interval = group === 'steering' ? [0, .32] : group === 'drive' ? [.42, .9] : [0, 1];
  return ease(THREE.MathUtils.clamp((amount - interval[0]) / (interval[1] - interval[0]), 0, 1));
}
/** Invert the eased leg, so an idle resume starts at the user's current amount. */
export function cycleAtAmount(amount: number, closing: boolean) {
  let lo = 0, hi = 1;
  const value = closing ? 1 - amount : amount;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < value) lo = mid; else hi = mid;
  }
  return (closing ? EXPLODED_START + HOLD_EXPLODED : HOLD_ASSEMBLED) + (closing ? CLOSE : OPEN) * (lo + hi) / 2;
}

/** Wobble piston in the CAD XZ plane. The head's reference centre stays on
 * the cylinder axis, while the entire piston/rod swings about the bearing. */
export function sliderCrank(angle: number, origin: THREE.Vector3, big: THREE.Vector3, small: THREE.Vector3) {
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  const a = big.clone().sub(origin).applyQuaternion(rotation).add(origin);
  const length = Math.hypot(small.x - big.x, small.z - big.z);
  const dz = small.z - a.z;
  const c = new THREE.Vector3(a.x + Math.sqrt(Math.max(0, length * length - dz * dz)), small.y, small.z);
  const rodAngle = Math.atan2(c.z - a.z, c.x - a.x);
  const referenceAngle = Math.atan2(small.z - big.z, small.x - big.x);
  return { big: a, small: c, rodLength: big.distanceTo(small), planarLength: length,
    swing: referenceAngle - rodAngle, rodAngle };
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
        // The ghosted endpoint reveals the linkage even from the motor side;
        // the complete motor remains in its original CAD position.
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
        if (data.web_sensor && data.web_sensor !== 'optical-pcb') {
          m.emissive.copy(stage.amber); m.emissiveIntensity = .08;
        }
        if (data.web_structure) {
          m.transparent = true; m.opacity = kind === 'swerve' ? .18 : .36; m.depthWrite = false; m.needsUpdate = true;
        }
      }
    });
  });
  if (shell) shell.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.transparent = true; material.opacity = kind === 'pump' ? .32 : .16; material.depthWrite = false;
      material.side = THREE.FrontSide; material.needsUpdate = true;
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
  const rod = parts.find(p => p.motion === 'rod');
  const bearingInner = parts.find(p => p.motion === 'bearing-inner');
  const bearingOuter = parts.find(p => p.motion === 'bearing-outer');
  stage.model.updateMatrixWorld(true);
  const localPin = (part: typeof rod, point: THREE.Vector3) => part?.object.worldToLocal(stage.model.localToWorld(point.clone()));
  const rodBig = localPin(rod, big), rodSmall = localPin(rod, small);
  const innerPin = localPin(bearingInner, big), outerPin = localPin(bearingOuter, big);
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
      const tubeFaces = new Set<number>();
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
          if (ids.every(id => onTube[id])) { triangles.push(...ids); tubeFaces.add(i); }
        }
        if (!triangles.length) continue;
        const geometry = source.clone(); geometry.setIndex(triangles); geometry.clearGroups();
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone();
        material.opacity = .55;
        details.push({ parent: mesh, mesh: new THREE.Mesh(geometry, material) });
      }
      if (tubeFaces.size) {
        // Material groups only: retain every original vertex and index. The
        // tubes keep their old .12 base plus .55 overlay, independently of the
        // denser head/cylinder housing around them.
        const body = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const tube = body.clone(); tube.opacity = .12;
        mesh.material = [body, tube];
        source.clearGroups();
        const length = index?.count ?? positions.count;
        let start = 0, materialIndex = tubeFaces.has(0) ? 1 : 0;
        for (let i = 3; i <= length; i += 3) {
          const next = tubeFaces.has(i) ? 1 : 0;
          if (i === length || next !== materialIndex) {
            source.addGroup(start, i - start, materialIndex);
            start = i; materialIndex = next;
          }
        }
      }
    });
    details.forEach(({ parent, mesh }) => parent.add(mesh));
  }
  const ghostedMaterials = new Map<THREE.Material, number>();
  stage.model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      // Capture only existing translucent CAD surfaces, including tube details,
      // before adding the separate illustrative airflow particles and arrows.
      if (material.transparent && material.opacity < 1) ghostedMaterials.set(material, material.opacity);
    }
  });
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
  // CAD-counted metadata, shared by the exporter and this derived GLB.
  const steeringInput = kind === 'swerve' ? parts.find(p => p.object.userData.web_transmission === 'steering-input') : undefined;
  const steeringOutput = kind === 'swerve' ? parts.find(p => p.object.userData.web_transmission === 'steering-output') : undefined;
  const steeringRatio = steeringInput && steeringOutput ? steeringOutput.object.userData.web_gear_teeth / steeringInput.object.userData.web_gear_teeth : 0;
  if (kind === 'swerve' && (!Number.isFinite(steeringRatio) || steeringRatio <= 0)) throw new Error('Missing CAD steering tooth counts');
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const project = (point: THREE.Vector3) => {
    const ndc = stage.model.localToWorld(point.clone()).project(stage.camera);
    return { x: (ndc.x + 1) * 50, y: (1 - ndc.y) * 50, visible: ndc.z > -1 && ndc.z < 1 };
  };
  let diagnostics = { stroke: 'intake', inletOpen: true, outletOpen: false, rodError: 0, sliderError: 0,
    bearingError: 0, swing: 0, rodAngle: 0, pins: [] as number[][], ghostAmount: 0, ghostPhase: 'solid',
    crankAngle: 0, speedMultiplier: 1, speedPhase: 'slow', annotationOpacity: 1 };
  return {
    update(time: number, explode: number, demonstration?: ReturnType<typeof swervePresentation>) {
      const ghost = kind === 'pump' ? pumpTransparencyCycle(time) : { amount: ease(THREE.MathUtils.clamp(explode, 0, 1)), phase: 'explosion' };
      for (const [material, opacity] of ghostedMaterials) {
        setCadOpacity(material, THREE.MathUtils.lerp(1, opacity, ghost.amount));
        material.userData.motionAppearance = { opacity: material.opacity, transparent: true, depthWrite: true, alphaHash: false };
      }
      const drive = pumpDriveCycle(time);
      const angle = kind === 'pump' ? drive.angle : (time * PUMP_BASE_SPEED) % TAU;
      const swerve = demonstration?.demo ? { roll: demonstration.roll, steer: demonstration.steering } : swerveAngles(time, explode);
      const pose = sliderCrank(angle, origin, big, small);
      const next = sliderCrank(angle + .0001, origin, big, small);
      // Positive travel toward the pump head reduces chamber volume.
      const intake = next.small.x < pose.small.x;
      for (const p of parts) {
        p.object.position.copy(p.position); p.object.quaternion.copy(p.quaternion);
        p.object.position.addScaledVector(p.offset, kind === 'swerve' ? swervePartProgress(explode, p.object.userData.web_explode_group) : explode);
        if (kind === 'swerve') {
          const id = p.object.userData.source_node_index;
          // Only parts attached to the inner steering assembly move; the
          // separate motor-side pinion also has source index 35.
          if (p.object.parent?.userData.web_motion === 'steer' &&
              ([24, 28, 29, 48, 51, 54].includes(id) || (id >= 31 && id <= 47))) {
            p.object.position.y += demonstration?.suspension ?? 0;
          }
          const value = p.motion === 'roll' ? swerve.roll : p.motion === 'steer' ? swerve.steer :
            p.motion === 'steering-pinion' ? -swerve.steer * steeringRatio : 0;
          // Axes are expressed in the part parent's frame, not the mesh frame.
          if (value) p.object.quaternion.premultiply(rotation.setFromAxisAngle(p.axis, value));
        } else if (p.motion === 'crank' || p.motion === 'bearing-inner') {
          rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
          p.object.position.sub(origin).applyQuaternion(rotation).add(origin);
          p.object.quaternion.premultiply(rotation);
        } else if (p.motion === 'rod' || p.motion === 'bearing-outer') {
          // Pure rotation in the crank plane preserves the CAD's axial bearing
          // offset; a 3D shortest-arc rotation would introduce unwanted twist.
          swing.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.swing);
          p.object.position.sub(big).applyQuaternion(swing).add(pose.big);
          p.object.quaternion.premultiply(swing);
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
      const innerCenter = measured(bearingInner, innerPin, pose.big);
      const outerCenter = measured(bearingOuter, outerPin, pose.big);
      diagnostics = { stroke: intake ? 'intake' : 'exhaust', inletOpen: intake, outletOpen: !intake,
        rodError: Math.max(Math.abs(measuredBig.distanceTo(measuredSmall) - pose.rodLength), measuredBig.distanceTo(pose.big), measuredSmall.distanceTo(pose.small)),
        sliderError: Math.hypot(measuredSmall.y - small.y, measuredSmall.z - small.z),
        bearingError: Math.max(innerCenter.distanceTo(outerCenter), innerCenter.distanceTo(measuredBig)),
        swing: pose.swing, rodAngle: pose.rodAngle,
        pins: [measuredBig.toArray(), measuredSmall.toArray(), innerCenter.toArray(), outerCenter.toArray()],
        ghostAmount: ghost.amount, ghostPhase: ghost.phase, crankAngle: angle,
        speedMultiplier: drive.speedMultiplier, speedPhase: drive.phase, annotationOpacity: drive.annotationOpacity };
    },
    diagnostics: () => diagnostics,
    annotations() {
      if (kind === 'pump') return ports.map((port: THREE.Vector3) => project(port));
      return stage.swerveAnchors();
    },
  };
}
export type ModuleMotion = ReturnType<typeof createModuleMotion>;
