// CAD parts retain their mounting bundles; complete motors move with their link.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { cleanPartName } from './lib/part-name';

type Part = { key: string; node_name: string; link: string; motor: boolean; group: number; explode_offset_m: [number, number, number] };
type Metadata = { parts: Part[] };
export type ArmExplodeScene = { setVisible: (visible: boolean) => void; dispose: () => void };

// Round 4 timing contract shared with the swerve presentation.
const ASSEMBLED = 1.2, OPEN = 1.8, EXPLODED = 1.5, CLOSE = 1.8;
const PERIOD = ASSEMBLED + OPEN + EXPLODED + CLOSE;
const IDLE = 5000;
const ease = (t: number) => { const u = THREE.MathUtils.clamp(t, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
const inverseEase = (value: number) => {
  let low = 0, high = 1;
  for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (ease(mid) < value) low = mid; else high = mid; }
  return (low + high) / 2;
};

export async function loadArmExplodeScene(root: HTMLElement, base: string, signal: AbortSignal): Promise<ArmExplodeScene> {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const slider = root.querySelector<HTMLInputElement>('[data-explode-range]')!;
  const output = root.querySelector<HTMLOutputElement>('[data-progress]')!;
  const hud = root.querySelector<HTMLElement>('[data-part-hud]')!;
  const hudName = hud.querySelector<HTMLElement>('[data-part-name]')!;
  const hudJoint = hud.querySelector<HTMLElement>('[data-part-joint]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-cycle]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-explode-to]')];
  const abort = new AbortController();
  const events = { signal: abort.signal };
  const manager = new THREE.LoadingManager();
  const abortLoad = () => manager.abort();
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
  model.traverse(node => { if (node.userData.part_key) nodes.set(node.userData.part_key, node); });
  const parts = meta.parts.map(part => {
    const node = nodes.get(part.key);
    if (!node || node.userData.node_name !== part.node_name) throw new Error(`Arm part mismatch: ${part.key}`);
    return { part, node, rest: node.position.clone(), offset: new THREE.Vector3(...part.explode_offset_m) };
  });
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene(); scene.add(model);
  scene.add(new THREE.HemisphereLight(0xdde7f5, 0x0b1424, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(-1.6, 2.4, 1.8); scene.add(key);
  // Neutral rim light separates dark plates without colouring the CAD surface gold.
  const rim = new THREE.DirectionalLight(0xdde7f5, 2.6); rim.position.set(1.8, 1.2, -1.6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xdde7f5, 1.1); fill.position.set(0, -1, 1.5); scene.add(fill);
  const amber = new THREE.Color(getComputedStyle(root).getPropertyValue('--amber').trim());
  const camera = new THREE.PerspectiveCamera(32, 1, .01, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.enableDamping = false;
  controls.minPolarAngle = .15; controls.maxPolarAngle = Math.PI - .15;
  controls.rotateSpeed = .7; controls.zoomSpeed = .6;
  const direction = new THREE.Vector3(1, .48, 1.6).normalize();
  if (root.dataset.cameraTheta && root.dataset.cameraPhi) direction.setFromSpherical(new THREE.Spherical(1, Number(root.dataset.cameraPhi), Number(root.dataset.cameraTheta)));
  const groups = Array.from({ length: 6 }, (_, i) => ({
    members: parts.filter(p => p.part.group === i + 1),
    label: root.querySelector<HTMLElement>(`[data-link-label="${i + 1}"]`)!, box: new THREE.Box3(), progress: 0,
  }));
  // Five chain connections replace a line from every part back to its origin.
  const guidePositions = new Float32Array(5 * 6);
  const guideGeometry = new THREE.BufferGeometry();
  guideGeometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
  const guideMaterial = new THREE.LineBasicMaterial({ color: amber, transparent: true, opacity: 0, depthWrite: false });
  const guides = new THREE.LineSegments(guideGeometry, guideMaterial); guides.frustumCulled = false; scene.add(guides);
  const meshes: THREE.Mesh[] = [];
  const materials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const highlights = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  model.traverse(node => { if ((node as THREE.Mesh).isMesh) { const mesh = node as THREE.Mesh; meshes.push(mesh); materials.set(mesh, mesh.material); } });
  const corners = meshes.flatMap(mesh => {
    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox!;
    const points: THREE.Vector3[] = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) points.push(new THREE.Vector3(x, y, z));
    return points.map(point => ({ mesh, point }));
  });
  let fitDistance = 0, visible = false, disposed = false, frame = 0, timer = 0;
  let progress = Number(slider.value) / 100;
  let cycleTime = Number(root.dataset.cycleTime || 0);
  let orbitTime = Number(root.dataset.orbitTime || 0);
  let permanentPause = root.dataset.manualPaused === 'true';
  let idleUntil = 0, interacting = false, lastFrame = 0, rejoining = 1;
  let orbitPhi = Math.acos(direction.y) - Math.sin(orbitTime * Math.PI * 2 / 28) * THREE.MathUtils.degToRad(8), orbitTheta = Math.atan2(direction.x, direction.z);
  let transition: { from: number; to: number; elapsed: number; duration: number } | undefined;
  let selected: THREE.Object3D | undefined, hoverPoint: THREE.Vector2 | undefined;
  let frames = 0;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const automatic = (now: number) => !permanentPause && !interacting && now >= idleUntil;
  const syncPlay = (now: number) => {
    const active = automatic(now);
    play.setAttribute('aria-pressed', String(active));
    play.textContent = active ? play.dataset.pause! : play.dataset.play!;
    root.dataset.automation = permanentPause ? 'paused' : active ? 'playing' : 'idle';
    root.dataset.manualPaused = String(permanentPause);
  };
  const select = (node?: THREE.Object3D) => {
    if (node === selected) return;
    if (selected) selected.traverse(object => { const mesh = object as THREE.Mesh; if (materials.has(mesh)) mesh.material = materials.get(mesh)!; });
    selected = node;
    if (node) {
      node.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!materials.has(mesh)) return;
        if (!highlights.has(mesh)) {
          const highlight = (original: THREE.Material) => {
            const material = original.clone() as THREE.MeshStandardMaterial;
            material.color.lerp(amber, .25); material.emissive.copy(amber); material.emissiveIntensity = .18;
            return material;
          };
          const original = materials.get(mesh)!;
          highlights.set(mesh, Array.isArray(original) ? original.map(highlight) : highlight(original));
        }
        mesh.material = highlights.get(mesh)!;
      });
      hudName.textContent = cleanPartName(node.userData.node_name);
      const part = meta.parts.find(p => p.key === node.userData.part_key)!;
      hudJoint.textContent = part.link === 'link_base' ? hud.dataset.mount! : `L${part.group} · ${part.link}`;
      root.dataset.hoverPart = node.userData.part_key;
    } else { hudName.textContent = hud.dataset.idle!; hudJoint.textContent = ''; delete root.dataset.hoverPart; }
  };
  const requestDraw = () => { if (visible && !disposed && !frame) frame = requestAnimationFrame(draw); };
  const armIdleTimer = () => {
    clearTimeout(timer);
    if (visible && !permanentPause && !interacting && performance.now() < idleUntil) {
      timer = window.setTimeout(() => { rejoining = 0; lastFrame = performance.now(); requestDraw(); }, Math.max(1, idleUntil - performance.now()));
    }
  };
  const refit = (reset = false) => {
    model.updateMatrixWorld(true);
    const view = reset || !fitDistance ? direction : camera.position.clone().sub(controls.target).normalize();
    const zoom = reset || !fitDistance ? 1 : camera.position.distanceTo(controls.target) / fitDistance;
    const points = corners.map(({ mesh, point }) => point.clone().applyMatrix4(mesh.matrixWorld));
    const center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(camera.up, view).normalize();
    const up = new THREE.Vector3().crossVectors(view, right).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
    fitDistance = .1;
    for (const point of points) {
      point.sub(center);
      const depth = point.dot(view);
      fitDistance = Math.max(fitDistance, depth + Math.abs(point.dot(right)) / (tanH * .86), depth + Math.abs(point.dot(up)) / (tanV * .70));
    }
    // Safety margins still contain all corners at the closest allowed zoom.
    controls.minDistance = fitDistance * .95; controls.maxDistance = fitDistance * 2.2;
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(view, fitDistance * THREE.MathUtils.clamp(zoom, .95, 2.2));
    controls.update(); camera.updateMatrixWorld();
  };
  const applyProgress = () => {
    // A small stagger opens links in chain order, then closes them in reverse.
    // All members of a mounting bundle use the same link progress.
    groups.forEach((group, i) => { group.progress = ease((progress - i * .045) / .775); });
    parts.forEach(({ part, node, rest, offset }) => node.position.copy(rest).addScaledVector(offset, groups[part.group - 1].progress));
    model.updateMatrixWorld(true);
    groups.forEach(group => { group.box.makeEmpty(); group.members.forEach(p => group.box.union(new THREE.Box3().setFromObject(p.node))); });
    for (let i = 0; i < 5; i++) {
      const start = groups[i].box.getCenter(new THREE.Vector3()), end = groups[i + 1].box.getCenter(new THREE.Vector3());
      start.y = groups[i].box.max.y + .035; end.y = groups[i + 1].box.max.y + .035;
      start.toArray(guidePositions, i * 6); end.toArray(guidePositions, i * 6 + 3);
    }
    guideGeometry.attributes.position.needsUpdate = true;
    guideMaterial.opacity = .10 * Math.sin(Math.PI * progress);
    guides.visible = progress > .001 && progress < .999;
    const percentage = Math.round(progress * 100);
    slider.value = String(percentage); output.value = `${percentage}%`;
    root.dataset.progress = progress.toFixed(5);
    root.dataset.state = progress === 0 ? 'assembled' : progress === 1 ? 'exploded' : 'partial';
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.explodeTo) === progress)));
  };
  const rememberView = () => {
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    orbitTheta = spherical.theta;
    orbitPhi = spherical.phi - Math.sin(orbitTime * Math.PI * 2 / 28) * THREE.MathUtils.degToRad(8);
  };
  const activity = () => {
    transition = undefined; idleUntil = performance.now() + IDLE; rejoining = 0;
    root.dataset.idleUntil = idleUntil.toFixed(3);
    rememberView(); hoverPoint = undefined; select(); syncPlay(performance.now()); armIdleTimer(); requestDraw();
  };
  const seekFromCurrent = () => {
    cycleTime = progress <= 0 ? 0 : progress >= 1 ? ASSEMBLED + OPEN : ASSEMBLED + OPEN * inverseEase(progress);
  };
  const draw = (now: number) => {
    frame = 0;
    if (!visible || disposed) return;
    // Limit the presentation to 30 fps without changing the wall-clock contract.
    if (lastFrame && now - lastFrame < 1000 / 30 && automatic(now)) { requestDraw(); return; }
    const dt = lastFrame ? (now - lastFrame) / 1000 : 0; lastFrame = now;
    syncPlay(now);
    if (automatic(now)) {
      rejoining = Math.min(1, rejoining + dt / .9);
      const step = dt * ease(rejoining);
      cycleTime = (cycleTime + step) % PERIOD; orbitTime += step;
      let phase: string;
      if (cycleTime < ASSEMBLED) { progress = 0; phase = 'assembled'; }
      else if (cycleTime < ASSEMBLED + OPEN) { progress = ease((cycleTime - ASSEMBLED) / OPEN); phase = 'opening'; }
      else if (cycleTime < ASSEMBLED + OPEN + EXPLODED) { progress = 1; phase = 'exploded'; }
      else { progress = 1 - ease((cycleTime - ASSEMBLED - OPEN - EXPLODED) / CLOSE); phase = 'closing'; }
      root.dataset.cyclePhase = phase;
      orbitTheta += step * Math.PI * 2 / 40;
      const phi = THREE.MathUtils.clamp(orbitPhi + Math.sin(orbitTime * Math.PI * 2 / 28) * THREE.MathUtils.degToRad(8), .18, Math.PI - .18);
      const radius = camera.position.distanceTo(controls.target);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, orbitTheta)));
      controls.update();
      root.dataset.cameraTheta = orbitTheta.toFixed(5); root.dataset.cameraPhi = phi.toFixed(5);
    } else if (transition) {
      transition.elapsed += dt;
      progress = THREE.MathUtils.lerp(transition.from, transition.to, ease(transition.elapsed / transition.duration));
      seekFromCurrent();
      if (transition.elapsed >= transition.duration) transition = undefined;
      root.dataset.cyclePhase = 'manual';
    }
    applyProgress(); refit();
    const viewAngles = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    root.dataset.cameraTheta = viewAngles.theta.toFixed(5); root.dataset.cameraPhi = viewAngles.phi.toFixed(5);
    if (hoverPoint && !interacting) {
      pointer.set(hoverPoint.x / canvas.clientWidth * 2 - 1, -hoverPoint.y / canvas.clientHeight * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      let node: THREE.Object3D | null | undefined = raycaster.intersectObjects(meshes, false)[0]?.object;
      while (node && !node.userData.part_key) node = node.parent;
      select(node ?? undefined);
    }
    renderer.render(scene, camera);
    const labels: { x: number; y: number }[] = [];
    groups.forEach(group => {
      const point = group.box.getCenter(new THREE.Vector3()); point.y = group.box.max.y + .025; point.project(camera);
      const x = THREE.MathUtils.clamp((point.x * .5 + .5) * canvas.clientWidth, 24, canvas.clientWidth - 24);
      let y = THREE.MathUtils.clamp((-point.y * .5 + .5) * canvas.clientHeight, 30, canvas.clientHeight - 72);
      while (labels.some(p => Math.abs(p.x - x) < 40 && Math.abs(p.y - y) < 24) && y > 30) y -= 25;
      labels.push({ x, y });
      group.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      group.label.style.opacity = String(THREE.MathUtils.smoothstep(group.progress, .2, .65));
    });
    const boundsInside = corners.every(({ mesh, point }) => {
      const p = point.clone().applyMatrix4(mesh.matrixWorld).project(camera);
      return Math.abs(p.x) < .99 && Math.abs(p.y) < .99 && p.z > -1 && p.z < 1;
    });
    root.dataset.boundsInside = String(boundsInside);
    root.dataset.frames = String(++frames); root.dataset.drawCalls = String(renderer.info.render.calls); root.dataset.triangles = String(renderer.info.render.triangles);
    root.dataset.cycleTime = cycleTime.toFixed(5); root.dataset.orbitTime = orbitTime.toFixed(5);
    root.dataset.frameTime = now.toFixed(3);
    if (automatic(now) || transition) requestDraw(); else armIdleTimer();
  };
  const resize = () => {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); refit(); requestDraw();
  };
  controls.addEventListener('change', requestDraw);
  controls.addEventListener('start', () => { interacting = true; activity(); });
  controls.addEventListener('end', () => { interacting = false; activity(); });
  buttons.forEach(button => button.addEventListener('click', () => {
    activity(); const to = Number(button.dataset.explodeTo);
    transition = { from: progress, to, elapsed: 0, duration: Math.max(.15, OPEN * Math.abs(to - progress)) };
    lastFrame = performance.now(); requestDraw();
  }, events));
  slider.addEventListener('pointerdown', () => { interacting = true; activity(); }, events);
  window.addEventListener('pointerup', () => { if (interacting) { interacting = false; activity(); } }, events);
  slider.addEventListener('input', () => { const value = Number(slider.value) / 100; activity(); progress = value; seekFromCurrent(); root.dataset.cyclePhase = 'manual'; requestDraw(); }, events);
  play.addEventListener('click', () => {
    permanentPause = automatic(performance.now()); interacting = false; transition = undefined;
    idleUntil = 0; rejoining = 0; rememberView(); clearTimeout(timer); lastFrame = performance.now(); syncPlay(performance.now()); requestDraw();
  }, events);
  root.querySelector('[data-reset-view]')!.addEventListener('click', () => { activity(); refit(true); rememberView(); requestDraw(); }, events);
  canvas.addEventListener('pointermove', event => {
    if (event.buttons) return;
    const rect = canvas.getBoundingClientRect(); hoverPoint = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top); requestDraw();
  }, events);
  canvas.addEventListener('pointerleave', () => { hoverPoint = undefined; select(); requestDraw(); }, events);
  canvas.addEventListener('keydown', event => {
    const movements: Record<string, [number, number]> = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] };
    if (!movements[event.key]) return;
    event.preventDefault(); activity();
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    spherical.theta += movements[event.key][0]; spherical.phi = THREE.MathUtils.clamp(spherical.phi + movements[event.key][1], .15, Math.PI - .15);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical)); controls.update(); rememberView(); requestDraw();
  }, events);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  applyProgress(); resize(); refit(true); syncPlay(performance.now());
  root.dataset.parts = String(parts.length); root.dataset.guides = '5';
  return {
    setVisible(value) {
      if (visible === value) return;
      visible = value; root.dataset.rendering = String(value); clearTimeout(timer);
      if (value) { lastFrame = performance.now(); requestDraw(); }
      else { cancelAnimationFrame(frame); frame = 0; hoverPoint = undefined; select(); }
    },
    dispose() {
      disposed = true; root.dataset.rendering = 'false'; delete root.dataset.hoverPart; hudName.textContent = hud.dataset.idle!; hudJoint.textContent = '';
      clearTimeout(timer); cancelAnimationFrame(frame); abort.abort(); resizeObserver.disconnect(); controls.dispose();
      const geometries = new Set(meshes.map(mesh => mesh.geometry)), allMaterials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      for (const material of [...materials.values(), ...highlights.values()]) for (const item of Array.isArray(material) ? material : [material]) {
        allMaterials.add(item); Object.values(item).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
      }
      geometries.forEach(geometry => geometry.dispose()); allMaterials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
      guideGeometry.dispose(); guideMaterial.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
