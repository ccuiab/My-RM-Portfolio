import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { cleanPartName } from './part-name';

/** Shared part viewer. Its owner decides when rendering is allowed. */
export async function loadMechanismStage(canvas: HTMLCanvasElement, base: string, file: string, label: HTMLElement, canRender: () => boolean, signal: AbortSignal) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .008, 8);
  const isPump = file === 'engineer-pump.glb';
  if (isPump) camera.up.set(0, 0, 1);
  const amber = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--amber').trim());
  scene.add(new THREE.HemisphereLight(0xe5ecf5, 0x182438, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.5);
  key.position.set(1, 2, 2); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1.6);
  fill.position.set(-2, .5, 1); scene.add(fill);
  const rim = new THREE.DirectionalLight(amber, 1.5);
  rim.position.set(1, 1, -2); scene.add(rim);
  const manager = new THREE.LoadingManager();
  let rendererDisposed = false;
  const disposeRenderer = () => {
    if (rendererDisposed) return;
    rendererDisposed = true;
    renderer.dispose(); renderer.forceContextLoss();
  };
  const abortLoad = () => { manager.abort(); disposeRenderer(); };
  signal.addEventListener('abort', abortLoad, { once: true });
  if (signal.aborted) abortLoad();
  const draco = new DRACOLoader(manager).setDecoderPath(`${base}models/draco/`).setWorkerLimit(1);
  let model: THREE.Group;
  try {
    model = (await new GLTFLoader(manager).setDRACOLoader(draco).loadAsync(`${base}models/${file}`)).scene;
  } catch (error) {
    disposeRenderer(); throw error;
  } finally { signal.removeEventListener('abort', abortLoad); draco.dispose(); }
  scene.add(model);
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = file === 'engineer-swerve.glb';
  controls.zoomSpeed = .6;
  if (controls.enableZoom) canvas.setAttribute('data-lenis-prevent-wheel', '');
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.minPolarAngle = .1;
  controls.maxPolarAngle = Math.PI - .1;
  controls.rotateSpeed = .65;
  canvas.tabIndex = 0;
  const bounds = new THREE.Box3().setFromObject(model, true);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  // View the linkage across the transparent pump head, with both ports at right.
  const initialDirection = (isPump ? new THREE.Vector3(.2, -1, .35) : new THREE.Vector3(1, .55, 1.6)).normalize();
  let radius = sphere.radius * 1.13;
  controls.target.copy(sphere.center);
  // Spherical uses Y up. Match OrbitControls' Z-up frame for the pump only.
  const pumpOrbitFrame = new THREE.Quaternion().setFromUnitVectors(camera.up, new THREE.Vector3(0, 1, 0));
  const pumpWorldFrame = pumpOrbitFrame.clone().invert();
  const orbitOffset = () => {
    const offset = camera.position.clone().sub(controls.target);
    return isPump ? offset.applyQuaternion(pumpOrbitFrame) : offset;
  };
  const placeOrbit = (s: THREE.Spherical) => {
    const offset = new THREE.Vector3().setFromSpherical(s);
    if (isPump) offset.applyQuaternion(pumpWorldFrame);
    camera.position.copy(controls.target).add(offset);
  };
  const direction = initialDirection.clone();
  let fitDistance = 0;
  const corners: { mesh: THREE.Mesh; point: THREE.Vector3 }[] = [];
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox!;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push({ mesh, point: new THREE.Vector3(x, y, z) });
  });
  const fit = (reset = false) => {
    const zoom = reset || !fitDistance ? 1 : camera.position.distanceTo(controls.target) / fitDistance;
    direction.copy(camera.position).sub(controls.target);
    if (!direction.lengthSq()) direction.copy(initialDirection);
    direction.normalize();
    model.updateMatrixWorld(true);
    const points = corners.map(({ mesh, point }) => point.clone().applyMatrix4(mesh.matrixWorld));
    const center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    controls.target.copy(center);
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    let distance = .01;
    // Use occupied part corners at the current explosion amount, rather than
    // enlarging an empty sphere and cancelling the visible separation.
    for (const point of points) {
      const p = point.sub(center).multiplyScalar(radius / sphere.radius);
      const depth = p.dot(direction);
      distance = Math.max(distance, depth + Math.abs(p.dot(right)) / (Math.tan(horizontal) * .86), depth + Math.abs(p.dot(up)) / (Math.tan(vertical) * .8));
    }
    fitDistance = distance;
    controls.minDistance = fitDistance * .65;
    controls.maxDistance = fitDistance * 1.65;
    camera.position.copy(controls.target).addScaledVector(direction, fitDistance * THREE.MathUtils.clamp(zoom, .65, 1.65));
    camera.lookAt(controls.target);
  };
  camera.position.copy(controls.target).add(initialDirection);

  const meshes: THREE.Mesh[] = [];
  model.traverse(object => {
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    // Hover changes only this part, even when the input shares materials.
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.color) {
        const hsl = { h: 0, s: 0, l: 0 };
        if (!std.name.includes('rubber') && std.color.getHSL(hsl).l < .07) std.color.offsetHSL(0, 0, .09);
        std.roughness = Math.max(std.roughness, .42);
      }
    }
    meshes.push(mesh);
  });
  const provenance = (object: THREE.Object3D) => {
    let current: THREE.Object3D | null = object;
    while (current && !current.userData.source_node_name) current = current.parent;
    return current?.userData.source_node_name as string | undefined;
  };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  let hovered: THREE.Mesh | undefined;
  let saved: { material: THREE.MeshStandardMaterial; color: THREE.Color; intensity: number }[] = [];
  let dragging = false;
  const clearHover = () => {
    saved.forEach(({ material, color, intensity }) => { material.emissive.copy(color); material.emissiveIntensity = intensity; });
    saved = []; hovered = undefined; label.hidden = true; label.textContent = '';
  };
  const updateHover = () => {
    if (dragging) return;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0]?.object as THREE.Mesh | undefined;
    if (hit === hovered) return;
    clearHover();
    if (!hit) return;
    hovered = hit;
    const source = provenance(hit);
    const partMeshes = source ? meshes.filter(mesh => provenance(mesh) === source) : [hit];
    for (const mesh of partMeshes) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const material = m as THREE.MeshStandardMaterial;
      if (!material.emissive) continue;
      saved.push({ material, color: material.emissive.clone(), intensity: material.emissiveIntensity });
      material.emissive.copy(amber); material.emissiveIntensity = .85;
    }
    label.textContent = cleanPartName(source?.split('/').pop() ?? hit.name);
    label.hidden = false;
  };
  const render = () => {
    if (!canRender()) return;
    fit();
    model.updateMatrixWorld(true);
    updateHover();
    renderer.render(scene, camera);
  };
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); fit(); render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas); resize();
  controls.addEventListener('change', render);
  const events = new AbortController();
  const options = { signal: events.signal };
  canvas.addEventListener('pointermove', event => {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
    render();
  }, options);
  canvas.addEventListener('pointerleave', () => { pointer.set(2, 2); clearHover(); render(); }, options);
  canvas.addEventListener('pointerdown', () => { dragging = true; clearHover(); }, options);
  const endDrag = () => { dragging = false; render(); };
  canvas.addEventListener('pointerup', endDrag, options);
  canvas.addEventListener('pointercancel', endDrag, options);
  canvas.addEventListener('lostpointercapture', endDrag, options);
  canvas.addEventListener('keydown', event => {
    const movement: Record<string, [number, number]> = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] };
    if (!movement[event.key]) return;
    event.preventDefault();
    const s = new THREE.Spherical().setFromVector3(orbitOffset());
    s.theta += movement[event.key][0]; s.phi = THREE.MathUtils.clamp(s.phi + movement[event.key][1], .1, Math.PI - .1);
    placeOrbit(s); controls.update(); render();
  }, options);

  return {
    scene, model, camera, controls, amber, sphere,
    render,
    screenBounds() {
      const points = corners.map(({ mesh, point }) => point.clone().applyMatrix4(mesh.matrixWorld).project(camera));
      return [Math.min(...points.map(p => p.x)), Math.max(...points.map(p => p.x)), Math.min(...points.map(p => p.y)), Math.max(...points.map(p => p.y))];
    },
    setRadius(value: number) { radius = value; fit(); },
    autoOrbit(dt: number, time: number, weight: number) {
      const s = new THREE.Spherical().setFromVector3(orbitOffset());
      s.theta += dt * Math.PI * 2 / 40 * weight;
      const goal = Math.acos(isPump ? initialDirection.z : initialDirection.y) + Math.sin(time * Math.PI * 2 / 24) * THREE.MathUtils.degToRad(8);
      s.phi += (goal - s.phi) * (1 - Math.exp(-dt * weight * 1.5));
      // Restore a complete view gradually after a user's close inspection.
      s.radius += (fitDistance - s.radius) * (1 - Math.exp(-dt * weight * 2));
      placeOrbit(s);
      camera.lookAt(controls.target);
    },
    resetView() { camera.position.copy(controls.target).add(initialDirection); fit(true); controls.update(); render(); },
    dispose() {
      events.abort(); resizeObserver.disconnect(); controls.dispose(); clearHover();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          materials.add(m);
          for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
export type MechanismStage = Awaited<ReturnType<typeof loadMechanismStage>>;
