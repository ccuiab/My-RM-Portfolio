// CAD parts retain their mounting bundles; complete motors move with their link.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { cleanPartName } from './lib/part-name';

type Part = { key: string; node_name: string; link: string; motor: boolean; group: number; group_offset_m: [number, number, number]; local_offset_m: [number, number, number]; detail_offset_m: [number, number, number] };
type CadGroup = { id: number; node_name: string; center_m: [number, number, number]; offset_m: [number, number, number] };
type Metadata = { parts: Part[]; groups: CadGroup[] };
export type ArmExplodeScene = { setVisible: (visible: boolean) => void; dispose: () => void };

const ASSEMBLED = 2, GROUP_OPEN = 3, GROUP_HOLD = .8, LOCAL_OPEN = 2.2, EXPLODED = 3, LOCAL_CLOSE = 2.2, GROUP_CLOSE = 3;
const FULL_OPEN = ASSEMBLED + GROUP_OPEN + GROUP_HOLD + LOCAL_OPEN;
const PERIOD = FULL_OPEN + EXPLODED + LOCAL_CLOSE + GROUP_CLOSE;
const IDLE = 5000;
const ease = (t: number) => { const u = THREE.MathUtils.clamp(t, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
const inverseEase = (value: number) => {
  let low = 0, high = 1;
  for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (ease(mid) < value) low = mid; else high = mid; }
  return (low + high) / 2;
};

// A scalar follows one reversible path: [0,.5] separates groups; [.5,1] separates bundles.
// Exported for the 30 fps numeric acceptance harness to exercise the actual runtime curve.
export function explosionPose(time: number) {
  const t = THREE.MathUtils.euclideanModulo(time, PERIOD);
  if (t < ASSEMBLED) return { progress: 0, phase: 'assembled' };
  if (t < ASSEMBLED + GROUP_OPEN) return { progress: .5 * ease((t - ASSEMBLED) / GROUP_OPEN), phase: 'opening-groups' };
  if (t < ASSEMBLED + GROUP_OPEN + GROUP_HOLD) return { progress: .5, phase: 'group-hold' };
  if (t < FULL_OPEN) return { progress: .5 + .5 * ease((t - ASSEMBLED - GROUP_OPEN - GROUP_HOLD) / LOCAL_OPEN), phase: 'opening-parts' };
  if (t < FULL_OPEN + EXPLODED) return { progress: 1, phase: 'exploded' };
  if (t < FULL_OPEN + EXPLODED + LOCAL_CLOSE) return { progress: 1 - .5 * ease((t - FULL_OPEN - EXPLODED) / LOCAL_CLOSE), phase: 'closing-parts' };
  return { progress: .5 * (1 - ease((t - FULL_OPEN - EXPLODED - LOCAL_CLOSE) / GROUP_CLOSE)), phase: 'closing-groups' };
}
export const explosionPeriod = PERIOD;

// Fit actual bundle corners, rather than the mostly empty whole-arm AABB.
// Exported so acceptance can check the same perspective fit over every yaw.
export function fitArmView(points: THREE.Vector3[], view: THREE.Vector3, aspect: number) {
  const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), view).normalize();
  const up = new THREE.Vector3().crossVectors(view, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(16)), tanH = tanV * aspect;
  let distance = 1;
  for (let iteration = 0; iteration < 4; iteration++) {
    const relative = points.map(p => p.clone().sub(target));
    let low = .02;
    for (const p of relative) low = Math.max(low, p.dot(view) + .02);
    let high = 20;
    const range = (radius: number) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of relative) {
        const depth = radius - p.dot(view);
        const x = p.dot(right) / (depth * tanH), y = p.dot(up) / (depth * tanV);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      return { minX, maxX, minY, maxY };
    };
    for (let i = 0; i < 22; i++) {
      const mid = (low + high) / 2, r = range(mid);
      if (r.maxY - r.minY > 1.52 || r.maxX - r.minX > 1.78) low = mid; else high = mid;
    }
    distance = high;
    if (iteration < 3) {
      const r = range(distance);
      target.addScaledVector(right, (r.minX + r.maxX) / 2 * distance * tanH);
      target.addScaledVector(up, (r.minY + r.maxY) / 2 * distance * tanV);
    }
  }
  return { target, distance };
}

export async function loadArmExplodeScene(root: HTMLElement, base: string, signal: AbortSignal): Promise<ArmExplodeScene> {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const slider = root.querySelector<HTMLInputElement>('[data-explode-range]')!;
  const output = root.querySelector<HTMLOutputElement>('[data-progress]')!;
  const hud = root.querySelector<HTMLElement>('[data-part-hud]')!;
  const hudName = hud.querySelector<HTMLElement>('[data-part-name]')!;
  const hudJoint = hud.querySelector<HTMLElement>('[data-part-joint]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-cycle]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-explode-to]')];
  const groupButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-select-group]')];
  const detailBar = root.querySelector<HTMLElement>('[data-detail-bar]')!;
  const detailName = root.querySelector<HTMLElement>('[data-detail-name]')!;
  const backButton = root.querySelector<HTMLButtonElement>('[data-back-arm]')!;
  const abort = new AbortController(), events = { signal: abort.signal };
  const manager = new THREE.LoadingManager(), abortLoad = () => manager.abort();
  signal.addEventListener('abort', abortLoad, { once: true });
  if (signal.aborted) abortLoad();
  const draco = new DRACOLoader(manager).setDecoderPath(`${base}models/draco/`).setWorkerLimit(1);
  let model: THREE.Group, meta: Metadata;
  try {
    [meta, model] = await Promise.all([
      fetch(`${base}models/arm-parts.json`, { signal }).then(response => {
        if (!response.ok) throw new Error('Arm part metadata unavailable');
        return response.json() as Promise<Metadata>;
      }),
      new GLTFLoader(manager).setDRACOLoader(draco).loadAsync(`${base}models/arm-parts.glb`).then(gltf => gltf.scene),
    ]);
  } finally { signal.removeEventListener('abort', abortLoad); draco.dispose(); }
  const nodes = new Map<string, THREE.Object3D>();
  model.updateMatrixWorld(true);
  model.traverse(node => { if (node.userData.part_key) nodes.set(node.userData.part_key, node); });
  const allMaterials = new Set<THREE.Material>(), meshes: THREE.Mesh[] = [];
  const amber = new THREE.Color(getComputedStyle(root).getPropertyValue('--amber').trim());
  const parts = meta.parts.map(part => {
    const node = nodes.get(part.key);
    if (!node || node.userData.node_name !== part.node_name) throw new Error(`Arm part mismatch: ${part.key}`);
    const points: THREE.Vector3[] = [], surfaces: { material: THREE.MeshStandardMaterial; color: THREE.Color; emissive: THREE.Color }[] = [];
    node.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes.push(mesh); mesh.geometry.computeBoundingBox();
      const { min, max } = mesh.geometry.boundingBox!;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) points.push(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
      const clone = (original: THREE.Material) => {
        allMaterials.add(original);
        const material = original.clone() as THREE.MeshStandardMaterial;
        material.transparent = true; material.forceSinglePass = true; allMaterials.add(material);
        surfaces.push({ material, color: material.color.clone(), emissive: material.emissive.clone() });
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });
    return { part, node, rest: node.position.clone(), points, surfaces, offset: new THREE.Vector3(), groupOffset: new THREE.Vector3(...part.group_offset_m), localOffset: new THREE.Vector3(...part.local_offset_m), detailOffset: new THREE.Vector3(...part.detail_offset_m) };
  });
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene(); scene.add(model);
  scene.add(new THREE.HemisphereLight(0xdde7f5, 0x0b1424, 2.1));
  for (const [intensity, position] of [[3.2, [-1.6, 2.4, 1.8]], [2.6, [1.8, 1.2, -1.6]], [1.1, [0, -1, 1.5]]] as const) {
    const light = new THREE.DirectionalLight(0xdde7f5, intensity); light.position.set(position[0], position[1], position[2]); scene.add(light);
  }
  const camera = new THREE.PerspectiveCamera(32, 1, .005, 50), controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.enableDamping = false; controls.enableZoom = false;
  controls.minPolarAngle = .18; controls.maxPolarAngle = Math.PI - .18; controls.rotateSpeed = .7;
  const direction = new THREE.Vector3(1, .48, 1.6).normalize();
  if (root.dataset.cameraTheta && root.dataset.cameraPhi) direction.setFromSpherical(new THREE.Spherical(1, Number(root.dataset.cameraPhi), Number(root.dataset.cameraTheta)));
  const labelIds = [0, 1, 2, 4, 5];
  const groups = meta.groups.map(spec => ({ spec, members: parts.filter(p => p.part.group === spec.id), box: new THREE.Box3(), points: [] as THREE.Vector3[],
    label: labelIds.includes(spec.id) ? root.querySelector<HTMLElement>(`[data-link-label="${labelIds.indexOf(spec.id)}"]`)! : undefined,
    button: groupButtons.find(button => Number(button.dataset.selectGroup) === spec.id)!,
  }));
  const groupName = (id: number) => groups.find(g => g.spec.id === id)!.button.textContent!.trim();
  groups.forEach(g => { g.button.disabled = false; if (g.label) g.label.textContent = groupName(g.spec.id); });
  const guideGeometry = new THREE.BufferGeometry(), guidePositions = new Float32Array(30);
  guideGeometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
  const guideMaterial = new THREE.LineBasicMaterial({ color: amber, transparent: true, opacity: .16, depthWrite: false });
  const guides = new THREE.LineSegments(guideGeometry, guideMaterial); guides.frustumCulled = false; scene.add(guides);
  const fitCache = new Map<string, ReturnType<typeof fitArmView>>();
  // Cache 5-degree yaw, 6-degree pitch and 5% pose samples, then trilinearly
  // interpolate. Cache entries use actual corners; no all-yaw sphere shrinkage.
  const cachedFit = (value: number, theta: number, phi: number) => {
    const yaw = THREE.MathUtils.euclideanModulo(theta, Math.PI * 2) / (Math.PI * 2) * 72;
    const pitch = phi / Math.PI * 30, pose = value * 20;
    const result = { target: new THREE.Vector3(), distance: 0 };
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
      const yi = (Math.floor(yaw) + a) % 72, pi = Math.min(29, Math.max(1, Math.floor(pitch) + b)), si = Math.min(20, Math.floor(pose) + c);
      const weight = (a ? yaw % 1 : 1 - yaw % 1) * (b ? pitch % 1 : 1 - pitch % 1) * (c ? pose % 1 : 1 - pose % 1);
      if (!weight) continue;
      const key = `${yi}:${pi}:${si}:${camera.aspect.toFixed(4)}`;
      let fit = fitCache.get(key);
      if (!fit) {
        const gp = Math.min(1, si / 10), lp = Math.max(0, si / 10 - 1);
        const points = parts.flatMap(p => p.points.map(point => point.clone().addScaledVector(p.groupOffset, gp).addScaledVector(p.localOffset, lp)));
        fit = fitArmView(points, new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, pi / 30 * Math.PI, yi / 72 * Math.PI * 2)), camera.aspect);
        if (fitCache.size >= 1600) fitCache.delete(fitCache.keys().next().value!);
        fitCache.set(key, fit);
      }
      result.target.addScaledVector(fit.target, weight); result.distance += fit.distance * weight;
    }
    return result;
  };
  let visible = false, disposed = false, frame = 0, timer = 0, lastFrame = 0, frames = 0;
  let progress = Number(slider.value) / 100, cycleTime = Number(root.dataset.cycleTime || 0), orbitTime = Number(root.dataset.orbitTime || 0);
  let permanentPause = root.dataset.manualPaused === 'true', interacting = false, idleUntil = 0, rejoining = 1;
  let orbitTheta = Math.atan2(direction.x, direction.z), orbitPhi = Math.acos(direction.y) - Math.sin(orbitTime * Math.PI * 2 / 28) * THREE.MathUtils.degToRad(8);
  let selected: number | null = null, hover: number | null = null, detailProgress = 1, detailBlend = 0, queuedGroup: number | null = null;
  let zoom = 1, fitDistance = 1, panOffset = new THREE.Vector3(), internalView = false;
  let transition: { from: number; to: number; elapsed: number; duration: number } | undefined;
  let flight: { fromPosition: THREE.Vector3; fromTarget: THREE.Vector3; fromBlend: number; toBlend: number; elapsed: number } | undefined;
  let pointerDown: { x: number; y: number } | undefined, hoverPoint: THREE.Vector2 | undefined;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const activeProgress = () => selected === null ? progress : detailProgress;
  const automatic = (now: number) => !permanentPause && !interacting && !flight && now >= idleUntil;
  const updateControls = () => { internalView = true; controls.update(); internalView = false; camera.updateMatrixWorld(); };
  const syncPlay = (now: number) => {
    const active = automatic(now); play.setAttribute('aria-pressed', String(active)); play.textContent = active ? play.dataset.pause! : play.dataset.play!;
    root.dataset.automation = permanentPause ? 'paused' : active ? 'playing' : 'idle'; root.dataset.manualPaused = String(permanentPause);
  };
  const requestDraw = () => { if (visible && !disposed && !frame) frame = requestAnimationFrame(draw); };
  const armIdleTimer = () => {
    clearTimeout(timer);
    if (visible && !permanentPause && !interacting && performance.now() < idleUntil) timer = window.setTimeout(() => { rejoining = 0; lastFrame = performance.now(); requestDraw(); }, Math.max(1, idleUntil - performance.now()));
  };
  const rememberView = () => {
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    orbitTheta = spherical.theta; orbitPhi = spherical.phi - Math.sin(orbitTime * Math.PI * 2 / 28) * THREE.MathUtils.degToRad(8);
  };
  const activity = () => {
    transition = undefined; idleUntil = performance.now() + IDLE; rejoining = 0; rememberView();
    root.dataset.idleUntil = idleUntil.toFixed(3); syncPlay(performance.now()); armIdleTimer(); requestDraw();
  };
  const seekFromCurrent = () => {
    const value = activeProgress(), closing = root.dataset.cyclePhase?.startsWith('closing');
    if (value <= 0) cycleTime = 0;
    else if (value >= 1) cycleTime = FULL_OPEN;
    else if (closing) cycleTime = value > .5 ? FULL_OPEN + EXPLODED + LOCAL_CLOSE * inverseEase((1-value)*2) : FULL_OPEN + EXPLODED + LOCAL_CLOSE + GROUP_CLOSE * inverseEase(1-value*2);
    else cycleTime = value <= .5 ? ASSEMBLED + GROUP_OPEN * inverseEase(value*2) : ASSEMBLED + GROUP_OPEN + GROUP_HOLD + LOCAL_OPEN * inverseEase(value*2-1);
  };
  const setHover = (id: number | null) => {
    if (hover === id) return;
    hover = id; canvas.classList.toggle('is-hovering', id !== null);
    if (id === null) { delete root.dataset.hoverGroup; hudName.textContent = selected === null ? hud.dataset.idle! : groupName(selected); hudJoint.textContent = ''; }
    else { root.dataset.hoverGroup = String(id); hudName.textContent = groupName(id); hudJoint.textContent = cleanPartName(groups.find(g => g.spec.id === id)!.spec.node_name); }
  };
  const applyProgress = () => {
    const gp = Math.min(1, progress * 2), lp = Math.max(0, progress * 2 - 1);
    for (const p of parts) {
      p.offset.copy(p.groupOffset).multiplyScalar(gp).addScaledVector(p.localOffset, lp);
      if (p.part.group === selected) p.offset.addScaledVector(p.localOffset, -lp * detailBlend).addScaledVector(p.detailOffset, detailProgress * detailBlend);
      p.node.position.copy(p.rest).add(p.offset);
      const faded = selected !== null && p.part.group !== selected, highlighted = hover === p.part.group;
      p.node.visible = !faded || detailBlend < 1;
      for (const s of p.surfaces) {
        s.material.opacity = faded ? 1 - detailBlend : 1; s.material.depthWrite = s.material.opacity > .5;
        s.material.color.copy(s.color); s.material.emissive.copy(s.emissive); s.material.emissiveIntensity = 0;
        if (highlighted && !faded) { s.material.color.lerp(amber, .28); s.material.emissive.copy(amber); s.material.emissiveIntensity = .2; }
      }
    }
    model.updateMatrixWorld(true);
    for (const g of groups) { g.points = g.members.flatMap(p => p.points.map(point => point.clone().add(p.offset))); g.box.setFromPoints(g.points); }
    labelIds.forEach((id, i) => {
      const group = groups.find(g => g.spec.id === id)!;
      new THREE.Vector3(...group.spec.center_m).toArray(guidePositions, i * 6); group.box.getCenter(new THREE.Vector3()).toArray(guidePositions, i * 6 + 3);
    });
    guideGeometry.attributes.position.needsUpdate = true;
    const moving = root.dataset.cyclePhase?.startsWith('opening') || root.dataset.cyclePhase?.startsWith('closing') || !!transition;
    guideMaterial.opacity = .16 * Math.sin(Math.PI * (progress < .5 ? gp : lp)); guides.visible = selected === null && Boolean(moving) && guideMaterial.opacity > .001;
    root.dataset.visibleGuides = guides.visible ? '5' : '0'; root.dataset.groupProgress = gp.toFixed(6); root.dataset.localProgress = lp.toFixed(6);
    const value = activeProgress(), percentage = Math.round(value * 100);
    slider.value = String(percentage); output.value = `${percentage}%`; root.dataset.progress = value.toFixed(5);
    root.dataset.state = value === 0 ? 'assembled' : value === 1 ? 'exploded' : 'partial';
    root.dataset.detailBlend = detailBlend.toFixed(5); root.dataset.detailGroup = selected === null ? '' : String(selected);
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.explodeTo) === value)));
    groupButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.selectGroup) === selected)));
  };
  const startFlight = (toBlend: number) => {
    activity(); hoverPoint = undefined; setHover(null); zoom = 1; panOffset.set(0, 0, 0);
    flight = { fromPosition: camera.position.clone(), fromTarget: controls.target.clone(), fromBlend: detailBlend, toBlend, elapsed: 0 };
    controls.enabled = false; lastFrame = performance.now(); requestDraw();
  };
  const selectGroup = (id: number) => {
    if (selected === id) return;
    if (selected !== null) { queuedGroup = id; startFlight(0); return; }
    selected = id; detailProgress = 1; detailBlend = 0; seekFromCurrent();
    detailName.textContent = groupName(id); detailBar.hidden = false; startFlight(1);
  };
  const back = () => { if (selected !== null) { queuedGroup = null; startFlight(0); } };
  const pick = (x: number, y: number) => {
    pointer.set(x / canvas.clientWidth * 2 - 1, -y / canvas.clientHeight * 2 + 1); raycaster.setFromCamera(pointer, camera);
    let best: number | null = null, distance = Infinity;
    // Eight AABB intersection tests, no mesh/triangle raycasting.
    for (const group of groups) {
      if (selected !== null && group.spec.id !== selected) continue;
      const hit = raycaster.ray.intersectBox(group.box, new THREE.Vector3());
      if (hit) { const d = hit.distanceToSquared(camera.position); if (d < distance) { best = group.spec.id; distance = d; } }
    }
    root.dataset.pickTests = String(selected === null ? groups.length : 1); return best;
  };
  const draw = (now: number) => {
    frame = 0; if (!visible || disposed) return;
    if (lastFrame && now - lastFrame < 1000 / 30 && (automatic(now) || flight || transition)) { requestDraw(); return; }
    const dt = Math.min(.1, lastFrame ? (now - lastFrame) / 1000 : 0); lastFrame = now;
    syncPlay(now);
    if (automatic(now)) {
      rejoining = Math.min(1, rejoining + dt / 1.2); const step = dt * ease(rejoining);
      cycleTime = (cycleTime + step) % PERIOD; orbitTime += step;
      const pose = explosionPose(cycleTime); if (selected === null) progress = pose.progress; else detailProgress = pose.progress;
      root.dataset.cyclePhase = pose.phase; orbitTheta += step * Math.PI * 2 / 40;
      zoom = THREE.MathUtils.lerp(zoom, 1, 1 - Math.exp(-step * 3)); panOffset.multiplyScalar(Math.exp(-step * 3));
    } else if (transition) {
      transition.elapsed += dt;
      const { from, to, elapsed, duration } = transition; let value: number;
      if (selected === null && Math.min(from, to) < .5 && Math.max(from, to) > .5) {
        const first = duration * Math.abs(.5 - from) / Math.abs(to - from);
        value = elapsed < first ? THREE.MathUtils.lerp(from, .5, ease(elapsed / first)) : THREE.MathUtils.lerp(.5, to, ease((elapsed-first) / (duration-first)));
      } else value = THREE.MathUtils.lerp(from, to, ease(elapsed / duration));
      if (selected === null) progress = value; else detailProgress = value;
      seekFromCurrent(); if (elapsed >= duration) transition = undefined; root.dataset.cyclePhase = 'manual';
    }
    if (flight) { flight.elapsed += dt; detailBlend = THREE.MathUtils.lerp(flight.fromBlend, flight.toBlend, ease(flight.elapsed / 1.1)); }
    applyProgress();
    const phi = THREE.MathUtils.clamp(orbitPhi + Math.sin(orbitTime * Math.PI * 2 / 28) * THREE.MathUtils.degToRad(8), .18, Math.PI - .18);
    const view = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, phi, orbitTheta));
    const wholeFit = cachedFit(progress, orbitTheta, phi);
    const fit = selected !== null && (!flight || flight.toBlend === 1) ? fitArmView(groups.find(g => g.spec.id === selected)!.points, view, camera.aspect) : wholeFit;
    fitDistance = fit.distance; controls.minDistance = fitDistance * .18; controls.maxDistance = fitDistance * 3;
    const target = fit.target.clone().add(panOffset), position = target.clone().addScaledVector(view, fit.distance * zoom);
    if (flight) {
      const blend = ease(flight.elapsed / 1.1); controls.target.lerpVectors(flight.fromTarget, target, blend); camera.position.lerpVectors(flight.fromPosition, position, blend);
      if (flight.elapsed >= 1.1) {
        const returning = flight.toBlend === 0; flight = undefined; controls.enabled = true;
        if (returning) { const oldGroup = selected; selected = null; detailBlend = 0; detailBar.hidden = true; root.dataset.detailGroup = ''; seekFromCurrent();
          if (queuedGroup !== null) { const next = queuedGroup; queuedGroup = null; selectGroup(next); }
          else if (document.activeElement === backButton) groups.find(g => g.spec.id === oldGroup)!.button.focus();
        }
        requestDraw();
      }
    } else { controls.target.copy(target); camera.position.copy(position); }
    updateControls();
    if (hoverPoint && !interacting && !flight) setHover(pick(hoverPoint.x, hoverPoint.y));
    // Hover/focus updates materials on the same rendered frame.
    for (const p of parts) for (const s of p.surfaces) {
      s.material.color.copy(s.color); s.material.emissive.copy(s.emissive); s.material.emissiveIntensity = 0;
      if (p.part.group === hover && (selected === null || selected === hover)) { s.material.color.lerp(amber, .28); s.material.emissive.copy(amber); s.material.emissiveIntensity = .2; }
    }
    renderer.render(scene, camera);
    const labelPositions: { x: number; y: number }[] = [];
    groups.forEach(group => {
      if (!group.label) return;
      const point = group.box.getCenter(new THREE.Vector3()); point.y = group.box.max.y + .015; point.project(camera);
      const x = THREE.MathUtils.clamp((point.x * .5 + .5) * canvas.clientWidth, 90, canvas.clientWidth - 90);
      let y = THREE.MathUtils.clamp((-point.y * .5 + .5) * canvas.clientHeight, 28, canvas.clientHeight - 64);
      while (labelPositions.some(p => Math.abs(p.x-x) < 170 && Math.abs(p.y-y) < 24) && y > 30) y -= 25;
      labelPositions.push({ x, y }); group.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      group.label.style.opacity = guides.visible ? '1' : '0';
    });
    const points = selected === null ? groups.flatMap(g => g.points) : groups.find(g => g.spec.id === selected)!.points;
    let inside = true, minY = Infinity, maxY = -Infinity;
    for (const point of points) { const p = point.clone().project(camera); inside &&= Math.abs(p.x) < .99 && Math.abs(p.y) < .99 && p.z > -1 && p.z < 1; minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    root.dataset.boundsInside = String(inside); root.dataset.screenHeight = ((maxY-minY)/2).toFixed(5); root.dataset.zoomScale = zoom.toFixed(5);
    root.dataset.cameraTheta = orbitTheta.toFixed(5); root.dataset.cameraPhi = phi.toFixed(5); root.dataset.cameraDistance = camera.position.distanceTo(controls.target).toFixed(5);
    root.dataset.frames = String(++frames); root.dataset.drawCalls = String(renderer.info.render.calls); root.dataset.triangles = String(renderer.info.render.triangles);
    root.dataset.cycleTime = cycleTime.toFixed(5); root.dataset.orbitTime = orbitTime.toFixed(5); root.dataset.frameTime = now.toFixed(3); root.dataset.fitCache = String(fitCache.size);
    if (automatic(now) || flight || transition) requestDraw(); else armIdleTimer();
  };
  const resize = () => {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); fitCache.clear(); requestDraw();
  };
  controls.addEventListener('change', () => { if (!internalView) { rememberView(); requestDraw(); } });
  controls.addEventListener('start', () => { interacting = true; activity(); hoverPoint = undefined; setHover(null); });
  controls.addEventListener('end', () => { interacting = false; activity(); });
  buttons.forEach(button => button.addEventListener('click', () => {
    activity(); const to = Number(button.dataset.explodeTo); transition = { from: activeProgress(), to, elapsed: 0, duration: Math.max(.2, (GROUP_OPEN + LOCAL_OPEN) * Math.abs(to-activeProgress())) }; lastFrame = performance.now(); requestDraw();
  }, events));
  slider.addEventListener('pointerdown', () => { interacting = true; activity(); }, events);
  window.addEventListener('pointerup', () => { if (interacting) { interacting = false; activity(); } }, events);
  slider.addEventListener('input', () => { const value = Number(slider.value)/100; activity(); if (selected === null) progress = value; else detailProgress = value; seekFromCurrent(); root.dataset.cyclePhase = 'manual'; requestDraw(); }, events);
  play.addEventListener('click', () => {
    permanentPause = automatic(performance.now()); interacting = false; transition = undefined; idleUntil = 0; rejoining = 0; seekFromCurrent(); rememberView(); clearTimeout(timer); lastFrame = performance.now(); syncPlay(performance.now()); requestDraw();
  }, events);
  root.querySelector('[data-reset-view]')!.addEventListener('click', () => { activity(); zoom = 1; panOffset.set(0,0,0); orbitTheta = Math.atan2(direction.x,direction.z); orbitPhi = Math.acos(direction.y) - Math.sin(orbitTime*Math.PI*2/28)*THREE.MathUtils.degToRad(8); requestDraw(); }, events);
  groupButtons.forEach(button => {
    const id = Number(button.dataset.selectGroup);
    button.addEventListener('click', () => selectGroup(id), events);
    button.addEventListener('focus', () => { activity(); hoverPoint = undefined; setHover(id); requestDraw(); }, events);
    button.addEventListener('blur', () => { setHover(null); requestDraw(); }, events);
  });
  backButton.addEventListener('click', back, events);
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && selected !== null) { event.preventDefault(); back(); } }, events);
  canvas.addEventListener('pointerdown', event => { pointerDown = { x: event.clientX, y: event.clientY }; }, events);
  canvas.addEventListener('click', event => {
    if (!pointerDown || Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y) > 5 || flight) return;
    const rect = canvas.getBoundingClientRect(), id = pick(event.clientX-rect.left,event.clientY-rect.top); if (id !== null) selectGroup(id);
  }, events);
  canvas.addEventListener('pointermove', event => { if (!event.buttons) { const rect = canvas.getBoundingClientRect(); hoverPoint = new THREE.Vector2(event.clientX-rect.left,event.clientY-rect.top); requestDraw(); } }, events);
  canvas.addEventListener('pointerleave', () => { hoverPoint = undefined; setHover(null); requestDraw(); }, events);
  canvas.addEventListener('wheel', event => {
    event.preventDefault(); if (flight) return; activity(); hoverPoint = undefined; setHover(null);
    const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    const view = camera.position.clone().sub(controls.target).normalize(), plane = new THREE.Plane().setFromNormalAndCoplanarPoint(view,controls.target);
    raycaster.setFromCamera(pointer,camera); const before = raycaster.ray.intersectPlane(plane,new THREE.Vector3());
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    zoom = THREE.MathUtils.clamp(zoom * Math.exp(THREE.MathUtils.clamp(pixels*.0015,-.8,.8)),.18,3);
    camera.position.copy(controls.target).addScaledVector(view,fitDistance*zoom); camera.updateMatrixWorld(); raycaster.setFromCamera(pointer,camera);
    const after = raycaster.ray.intersectPlane(plane,new THREE.Vector3());
    if (before && after) { const shift = before.sub(after); panOffset.add(shift); camera.position.add(shift); controls.target.add(shift); }
    updateControls(); rememberView(); requestDraw();
  }, { ...events, passive: false });
  canvas.addEventListener('keydown', event => {
    const moves: Record<string,[number,number]> = { ArrowLeft: [-.1,0], ArrowRight: [.1,0], ArrowUp: [0,-.1], ArrowDown: [0,.1] };
    if (!moves[event.key] || flight) return; event.preventDefault(); activity(); orbitTheta += moves[event.key][0]; orbitPhi = THREE.MathUtils.clamp(orbitPhi+moves[event.key][1],.18,Math.PI-.18); requestDraw();
  }, events);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas); resize(); syncPlay(performance.now());
  root.dataset.parts = String(parts.length); root.dataset.groups = String(groups.length); root.dataset.guides = '5';
  return {
    setVisible(value) {
      if (visible === value) return; visible = value; root.dataset.rendering = String(value); clearTimeout(timer);
      if (value) { lastFrame = performance.now(); requestDraw(); } else { cancelAnimationFrame(frame); frame = 0; hoverPoint = undefined; setHover(null); }
    },
    dispose() {
      disposed = true; root.dataset.rendering = 'false'; delete root.dataset.hoverGroup; detailBar.hidden = true; hudName.textContent = hud.dataset.idle!; hudJoint.textContent = '';
      clearTimeout(timer); cancelAnimationFrame(frame); abort.abort(); resizeObserver.disconnect(); controls.dispose();
      new Set(meshes.map(mesh => mesh.geometry)).forEach(geometry => geometry.dispose());
      const textures = new Set<THREE.Texture>(); allMaterials.forEach(material => { Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); }); material.dispose(); }); textures.forEach(texture => texture.dispose());
      guideGeometry.dispose(); guideMaterial.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
