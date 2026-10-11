// Part-level CAD view. Model units and axes match arm.glb; motors never separate.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap';

type Part = {
  key: string;
  node_name: string;
  link: string;
  motor: boolean;
  explode_offset_m: [number, number, number];
};
type Metadata = { parts: Part[] };
export type ArmExplodeScene = {
  setVisible: (visible: boolean) => void;
  dispose: () => void;
};

export async function loadArmExplodeScene(root: HTMLElement, base: string): Promise<ArmExplodeScene> {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const slider = root.querySelector<HTMLInputElement>('[data-explode-range]')!;
  const output = root.querySelector<HTMLOutputElement>('[data-progress]')!;
  const hud = root.querySelector<HTMLElement>('[data-part-hud]')!;
  const hudName = hud.querySelector<HTMLElement>('[data-part-name]')!;
  const hudJoint = hud.querySelector<HTMLElement>('[data-part-joint]')!;
  const rotate = root.querySelector<HTMLButtonElement>('[data-rotate]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-explode-to]')];
  const abort = new AbortController();
  const events = { signal: abort.signal };
  const draco = new DRACOLoader().setDecoderPath(`${base}models/draco/`).setWorkerLimit(1);
  let model: THREE.Group;
  let meta: Metadata;
  try {
    [meta, model] = await Promise.all([
      fetch(`${base}models/arm-parts.json`).then(response => {
        if (!response.ok) throw new Error('Arm part metadata unavailable');
        return response.json() as Promise<Metadata>;
      }),
      new GLTFLoader().setDRACOLoader(draco).loadAsync(`${base}models/arm-parts.glb`).then(gltf => gltf.scene),
    ]);
  } finally {
    draco.dispose();
  }
  const nodes = new Map<string, THREE.Object3D>();
  model.traverse(node => { if (node.userData.part_key) nodes.set(node.userData.part_key, node); });
  const parts = meta.parts.map(part => {
    const node = nodes.get(part.key);
    if (!node || node.userData.node_name !== part.node_name) throw new Error(`Arm part mismatch: ${part.key}`);
    return { part, node, rest: node.position.clone(), offset: new THREE.Vector3(...part.explode_offset_m) };
  });
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  // A modest drawing buffer, one Draco worker, no shadows/postprocessing, no idle loop.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.add(model);
  scene.add(new THREE.HemisphereLight(0xdde7f5, 0x0b1424, 2));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-1.6, 2.4, 1.8);
  scene.add(key);
  const amber = new THREE.Color(getComputedStyle(root).getPropertyValue('--amber').trim());
  const rim = new THREE.DirectionalLight(amber, 1.7);
  rim.position.set(1.8, .6, -1.6);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xdde7f5, 1.2);
  fill.position.set(0, -1, 1.5);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(32, 1, .01, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = false;
  controls.minPolarAngle = .08;
  controls.maxPolarAngle = Math.PI - .08;
  controls.rotateSpeed = .7;
  controls.zoomSpeed = .6;
  const direction = new THREE.Vector3(1, .45, .8).normalize();
  let fitDistance = 0;
  let visible = false;
  let disposed = false;
  let frame = 0;
  let spinning = false;
  let lastSpin = 0;
  let frames = 0;
  let progress = { value: 0 };
  let tween: gsap.core.Tween | undefined;
  let selected: THREE.Object3D | undefined;
  const meshes: THREE.Mesh[] = [];
  const materials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const highlights = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  model.traverse(node => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      meshes.push(mesh);
      materials.set(mesh, mesh.material);
    }
  });
  const corners = meshes.flatMap(mesh => {
    mesh.geometry.computeBoundingBox();
    const { min, max } = mesh.geometry.boundingBox!;
    const points: THREE.Vector3[] = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) points.push(new THREE.Vector3(x, y, z));
    return points.map(point => ({ mesh, point }));
  });
  // Fit occupied part bounds, rather than an empty sphere around the entire sweep.
  // Refitting during the eased separation keeps the assembled arm readable too.
  const refit = (reset = false) => {
    model.updateMatrixWorld(true);
    const view = reset || !fitDistance ? direction : camera.position.clone().sub(controls.target).normalize();
    const zoom = reset || !fitDistance ? 1 : camera.position.distanceTo(controls.target) / fitDistance;
    const points = corners.map(({ mesh, point }) => point.clone().applyMatrix4(mesh.matrixWorld));
    const center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(camera.up, view).normalize();
    const up = new THREE.Vector3().crossVectors(view, right).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    fitDistance = .1;
    for (const point of points) {
      point.sub(center);
      const depth = point.dot(view);
      fitDistance = Math.max(fitDistance, depth + Math.abs(point.dot(right)) / (tanH * .84), depth + Math.abs(point.dot(up)) / (tanV * .78));
    }
    controls.minDistance = fitDistance * .65;
    controls.maxDistance = fitDistance * 1.65;
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(view, fitDistance * THREE.MathUtils.clamp(zoom, .65, 1.65));
    controls.update();
  };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoverPoint: THREE.Vector2 | undefined;

  const select = (node?: THREE.Object3D) => {
    if (node === selected) return;
    if (selected) selected.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (materials.has(mesh)) mesh.material = materials.get(mesh)!;
    });
    selected = node;
    if (node) {
      node.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!materials.has(mesh)) return;
        if (!highlights.has(mesh)) {
          const highlight = (original: THREE.Material) => {
            const material = original.clone() as THREE.MeshStandardMaterial;
            material.color.lerp(amber, .55);
            material.emissive.copy(amber);
            material.emissiveIntensity = .45;
            return material;
          };
          const original = materials.get(mesh)!;
          highlights.set(mesh, Array.isArray(original) ? original.map(highlight) : highlight(original));
        }
        mesh.material = highlights.get(mesh)!;
      });
      // This exact string is also the node name in the GLB; no translated guesswork.
      hudName.textContent = node.userData.node_name;
      const link = node.userData.link as string;
      hudJoint.textContent = link === 'link_base' ? hud.dataset.mount! : `J${link === 'link_wheel' ? '7' : link.replace('link_', '')} · ${link}`;
      root.dataset.hoverPart = node.userData.part_key;
    } else {
      hudName.textContent = hud.dataset.idle!;
      hudJoint.textContent = '';
      delete root.dataset.hoverPart;
    }
  };
  const hitTest = () => {
    if (!hoverPoint) return;
    pointer.set(hoverPoint.x / canvas.clientWidth * 2 - 1, -hoverPoint.y / canvas.clientHeight * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    let node: THREE.Object3D | null | undefined = raycaster.intersectObjects(meshes, false)[0]?.object;
    while (node && !node.userData.part_key) node = node.parent;
    select(node ?? undefined);
  };
  const requestDraw = () => {
    if (!visible || disposed || frame) return;
    frame = requestAnimationFrame(draw);
  };
  const draw = (now: number) => {
    frame = 0;
    if (!visible || disposed) return;
    if (spinning && now - lastSpin >= 1000 / 30) {
      const angle = Math.min((now - lastSpin) / 1000, .05) * .22;
      camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(controls.target);
      controls.update();
      lastSpin = now;
    } else if (spinning) {
      requestDraw();
      return;
    }
    model.updateMatrixWorld(true);
    hitTest();
    renderer.render(scene, camera);
    root.dataset.frames = String(++frames);
    root.dataset.drawCalls = String(renderer.info.render.calls);
    root.dataset.triangles = String(renderer.info.render.triangles);
    if (spinning) requestDraw();
  };
  const applyProgress = () => {
    for (const { node, rest, offset } of parts) node.position.copy(rest).addScaledVector(offset, progress.value);
    refit();
    const percentage = Math.round(progress.value * 100);
    slider.value = String(percentage);
    output.value = `${percentage}%`;
    root.dataset.progress = progress.value.toFixed(3);
    root.dataset.state = percentage === 0 ? 'assembled' : percentage === 100 ? 'exploded' : 'partial';
    buttons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.explodeTo) === progress.value)));
    requestDraw();
  };
  const transition = (target: number) => {
    tween?.kill();
    select();
    tween = gsap.to(progress, { value: target, duration: Math.max(.12, .9 * Math.abs(target - progress.value)), ease: 'power2.inOut', onUpdate: applyProgress });
    if (!visible) tween.pause();
  };
  const stopRotation = () => {
    spinning = false;
    rotate.setAttribute('aria-pressed', 'false');
    rotate.textContent = rotate.dataset.play!;
    requestDraw();
  };
  const reset = () => {
    stopRotation();
    refit(true);
    hoverPoint = undefined;
    select();
    requestDraw();
  };
  const resize = () => {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    refit();
    requestDraw();
  };
  controls.addEventListener('change', requestDraw);
  controls.addEventListener('start', () => { stopRotation(); hoverPoint = undefined; select(); });
  buttons.forEach(button => button.addEventListener('click', () => transition(Number(button.dataset.explodeTo)), events));
  slider.addEventListener('input', () => transition(Number(slider.value) / 100), events);
  rotate.addEventListener('click', () => {
    spinning = !spinning;
    rotate.setAttribute('aria-pressed', String(spinning));
    rotate.textContent = spinning ? rotate.dataset.pause! : rotate.dataset.play!;
    lastSpin = performance.now();
    requestDraw();
  }, events);
  root.querySelector('[data-reset-view]')!.addEventListener('click', reset, events);
  canvas.addEventListener('pointermove', event => {
    if (event.buttons) return;
    const rect = canvas.getBoundingClientRect();
    hoverPoint = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);
    requestDraw();
  }, events);
  canvas.addEventListener('pointerleave', () => { hoverPoint = undefined; select(); requestDraw(); }, events);
  canvas.addEventListener('keydown', event => {
    const movements: Record<string, [number, number]> = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] };
    if (!movements[event.key]) return;
    event.preventDefault();
    stopRotation();
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    spherical.theta += movements[event.key][0];
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + movements[event.key][1], .08, Math.PI - .08);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    requestDraw();
  }, events);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  reset();
  applyProgress();
  root.dataset.parts = String(parts.length);
  return {
    setVisible(value) {
      visible = value;
      root.dataset.rendering = String(value);
      if (value) { tween?.resume(); lastSpin = performance.now(); requestDraw(); }
      else { tween?.pause(); cancelAnimationFrame(frame); frame = 0; hoverPoint = undefined; select(); }
    },
    dispose() {
      disposed = true;
      delete root.dataset.hoverPart;
      hudName.textContent = hud.dataset.idle!;
      hudJoint.textContent = '';
      tween?.kill();
      cancelAnimationFrame(frame);
      abort.abort();
      resizeObserver.disconnect();
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const allMaterials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      meshes.forEach(mesh => geometries.add(mesh.geometry));
      for (const material of [...materials.values(), ...highlights.values()]) {
        for (const item of Array.isArray(material) ? material : [material]) {
          allMaterials.add(item);
          Object.values(item).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
        }
      }
      geometries.forEach(geometry => geometry.dispose());
      allMaterials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
