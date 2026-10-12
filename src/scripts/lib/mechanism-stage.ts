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
  const isSwerve = file === 'engineer-swerve.glb';
  let swerveViewChange: (() => void) | undefined;
  let pumpViewChange: (() => void) | undefined;
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
  let zoomFactor = 1;
  let inspection: Set<THREE.Mesh> | undefined;
  let inspectionBlend = 0;
  const inspectionMaterials = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
  const corners: { mesh: THREE.Mesh; point: THREE.Vector3 }[] = [];
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox!;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push({ mesh, point: new THREE.Vector3(x, y, z) });
  });
  const fit = (reset = false) => {
    if (reset) zoomFactor = 1;
    direction.copy(camera.position).sub(controls.target);
    if (!direction.lengthSq()) direction.copy(initialDirection);
    direction.normalize();
    model.updateMatrixWorld(true);
    const points = corners.map(({ mesh, point }) => point.clone().applyMatrix4(mesh.matrixWorld));
    const center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const distanceFor = (occupied: THREE.Vector3[], origin: THREE.Vector3) => {
      let distance = .01;
      // Fit occupied corners rather than an unnecessarily large empty sphere.
      for (const point of occupied) {
        const p = point.clone().sub(origin).multiplyScalar(radius / sphere.radius);
        const depth = p.dot(direction);
        distance = Math.max(distance, depth + Math.abs(p.dot(right)) / (Math.tan(horizontal) * .86), depth + Math.abs(p.dot(up)) / (Math.tan(vertical) * .8));
      }
      return distance;
    };
    fitDistance = distanceFor(points, center);
    if (inspection && inspectionBlend > .0001) {
      const detailPoints = points.filter((_, index) => inspection!.has(corners[index].mesh));
      const detailCenter = new THREE.Box3().setFromPoints(detailPoints).getCenter(new THREE.Vector3());
      fitDistance = THREE.MathUtils.lerp(fitDistance, distanceFor(detailPoints, detailCenter), inspectionBlend);
      center.lerp(detailCenter, inspectionBlend);
    }
    controls.target.copy(center);
    controls.minDistance = fitDistance * (isSwerve ? .82 : .65);
    controls.maxDistance = fitDistance * 1.65;
    camera.position.copy(controls.target).addScaledVector(direction, fitDistance * zoomFactor);
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
  // Cache anchors in each original part's local frame. They follow both the
  // explosion and the steering parent, without moving a label onto the mesh.
  const swerveAnchors = isSwerve ? ['drive-input', 'drive-compound', 'drive-output', 'steering-input', 'steering-output', 'rail', 'gas-spring'].map(key => {
    let part: THREE.Object3D | undefined;
    model.traverse(object => {
      if (part) return;
      const data = object.userData;
      if (data.web_transmission === key || (data.web_suspension === key && data.source_node_index === (key === 'rail' ? 25 : 53))) part = object;
    });
    if (!part) return undefined;
    const point = part.worldToLocal(new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3()));
    return { part, point };
  }) : [];
  const restoreInspectionMaterials = () => {
    for (const [material, saved] of inspectionMaterials) { Object.assign(material, saved); material.needsUpdate = true; }
    inspectionMaterials.clear();
  };
  const updateInspectionMaterials = () => {
    if (inspectionBlend < .0001) { restoreInspectionMaterials(); return; }
    for (const [material, saved] of inspectionMaterials) {
      material.opacity = THREE.MathUtils.lerp(saved.opacity, .025, inspectionBlend);
      if (!material.transparent) { material.transparent = true; material.needsUpdate = true; }
      material.depthWrite = false;
    }
  };
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
    const selectable = inspection && inspectionBlend > .5 ? meshes.filter(mesh => inspection!.has(mesh)) : meshes;
    const hit = raycaster.intersectObjects(selectable, false)[0]?.object as THREE.Mesh | undefined;
    if (hit === hovered) return;
    clearHover();
    if (!hit) return;
    hovered = hit;
    const source = provenance(hit);
    const partMeshes = source ? selectable.filter(mesh => provenance(mesh) === source) : [hit];
    for (const mesh of partMeshes) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const material = m as THREE.MeshStandardMaterial;
      if (!material.emissive) continue;
      saved.push({ material, color: material.emissive.clone(), intensity: material.emissiveIntensity });
      material.emissive.copy(amber); material.emissiveIntensity = .85;
    }
    label.textContent = cleanPartName(source?.split('/').pop() ?? hit.name);
    label.hidden = false;
  };
  const render = (fitView = true) => {
    if (!canRender()) return;
    if (fitView) fit();
    updateInspectionMaterials();
    model.updateMatrixWorld(true);
    updateHover();
    renderer.render(scene, camera);
    if (isSwerve) swerveViewChange?.();
    else if (isPump) pumpViewChange?.();
  };
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); fit(); render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas); resize();
  controls.addEventListener('change', () => {
    if (fitDistance) zoomFactor = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) / fitDistance, isSwerve ? .82 : .65, 1.65);
    render();
  });
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
    render, fitView: fit,
    onSwerveViewChange(listener: () => void) { if (isSwerve) swerveViewChange = listener; },
    onPumpViewChange(listener: () => void) { if (isPump) pumpViewChange = listener; },
    swerveAnchors() {
      model.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      return swerveAnchors.map(anchor => {
        if (!anchor) return { x: 0, y: 0, visible: false };
        const point = anchor.part.localToWorld(anchor.point.clone()).project(camera);
        return { x: (point.x + 1) * 50, y: (1 - point.y) * 50, visible: point.z > -1 && point.z < 1 };
      });
    },
    /** Conservative per-mesh projected boxes, in canvas pixels, for QA. */
    swerveMeshBounds() {
      if (!isSwerve) return [];
      model.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      return meshes.filter(mesh => {
        for (let node: THREE.Object3D | null = mesh; node; node = node.parent) if (!node.visible) return false;
        return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(material => material.visible && material.opacity > 0);
      }).map(mesh => {
        const points = corners.filter(corner => corner.mesh === mesh).map(({ point }) => point.clone().applyMatrix4(mesh.matrixWorld).project(camera));
        return { name: mesh.name,
          left: (Math.min(...points.map(p => p.x)) + 1) * canvas.clientWidth / 2,
          right: (Math.max(...points.map(p => p.x)) + 1) * canvas.clientWidth / 2,
          top: (1 - Math.max(...points.map(p => p.y))) * canvas.clientHeight / 2,
          bottom: (1 - Math.min(...points.map(p => p.y))) * canvas.clientHeight / 2 };
      });
    },
    screenBounds() {
      const points = corners.map(({ mesh, point }) => point.clone().applyMatrix4(mesh.matrixWorld).project(camera));
      return [Math.min(...points.map(p => p.x)), Math.max(...points.map(p => p.x)), Math.min(...points.map(p => p.y)), Math.max(...points.map(p => p.y))];
    },
    setRadius(value: number) { radius = value; fit(); },
    inspect(transmissions: string[]) {
      clearHover(); restoreInspectionMaterials();
      const groups: THREE.Object3D[] = [];
      inspection = new Set();
      model.traverse(object => {
        if (!transmissions.includes(object.userData.web_transmission) && !(isSwerve && transmissions.includes(object.userData.web_suspension))) return;
        groups.push(object);
        object.traverse(child => { if ((child as THREE.Mesh).isMesh) inspection!.add(child as THREE.Mesh); });
      });
      if (!inspection.size) { inspection = undefined; return; }
      inspectionBlend = 1; zoomFactor = 1;
      for (const mesh of meshes) {
        if (inspection.has(mesh)) continue;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          inspectionMaterials.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
        }
      }
      groups.sort((a, b) => transmissions.indexOf(a.userData.web_transmission) - transmissions.indexOf(b.userData.web_transmission));
      if (groups.length === 2 && (!isSwerve || (transmissions.includes('steering-input') && transmissions.includes('steering-output')))) {
        // Look from the large-gear side, keeping the intact motor behind it.
        const side = groups[1].getWorldPosition(new THREE.Vector3()).sub(groups[0].getWorldPosition(new THREE.Vector3()));
        side.addScaledVector(camera.up, -side.dot(camera.up)).normalize().addScaledVector(camera.up, .8).normalize();
        camera.position.copy(controls.target).add(side);
      }
      fit(true); render();
    },
    isInspecting: () => inspectionBlend > .5,
    autoOrbit(dt: number, time: number, weight: number) {
      const s = new THREE.Spherical().setFromVector3(orbitOffset());
      s.theta += dt * Math.PI * 2 / 40 * weight;
      const goal = Math.acos(isPump ? initialDirection.z : initialDirection.y) + Math.sin(time * Math.PI * 2 / 24) * THREE.MathUtils.degToRad(8);
      s.phi += (goal - s.phi) * (1 - Math.exp(-dt * weight * 1.5));
      // Restore a complete view gradually after a user's close inspection.
      zoomFactor += (1 - zoomFactor) * (1 - Math.exp(-dt * weight * 2));
      inspectionBlend *= Math.exp(-dt * weight * 2);
      placeOrbit(s);
      camera.lookAt(controls.target);
    },
    resetView() { inspection = undefined; inspectionBlend = 0; restoreInspectionMaterials(); camera.position.copy(controls.target).add(initialDirection); fit(true); controls.update(); render(); },
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
