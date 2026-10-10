// Shared Three.js stage: loads a Draco glTF, gives every mesh an amber wireframe twin,
// and sweeps a clipping plane so the model turns from wireframe into solid.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export type ScanStage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  model: THREE.Object3D;
  /** yaw group around the model */
  turntable: THREE.Group;
  /** frame the camera on a world-space sphere, looking along `dir` (from target to camera) */
  frame: (sphere: THREE.Sphere, dir: THREE.Vector3) => void;
  /** 0 = all wireframe, 1 = all solid; sweeps along world `axis` across `range` */
  setScan: (s: number) => void;
  render: () => void;
  /** called after the canvas resizes (the drawing buffer is cleared then) */
  onResize: (cb: () => void) => void;
  /** Pointer drag rotates the camera; wheel scrolling remains native. No continuous render loop. */
  enableInteraction: (onChange?: () => void) => void;
  /** Restore the most recent frame() direction, retaining the current model pose. */
  resetView: () => void;
  dispose: () => void;
};

export async function loadScanStage(
  canvas: HTMLCanvasElement,
  base: string,
  file: string,
  scan: { axis: THREE.Vector3; range: [number, number]; solidOnly?: boolean },
): Promise<ScanStage> {
  // preserveDrawingBuffer keeps the last frame visible between scroll-driven redraws
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 30);
  scene.add(new THREE.HemisphereLight(0xdde7f5, 0x0b1424, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-1.6, 2.4, 1.8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf2b53a, 2.6);
  rim.position.set(1.8, 0.6, -1.6);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x3d8bff, 0.8);
  fill.position.set(0, -1, 1.5);
  scene.add(fill);

  const draco = new DRACOLoader().setDecoderPath(`${base}models/draco/`);
  let gltf;
  try {
    gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(`${base}models/${file}`);
  } catch (error) {
    renderer.dispose();
    throw error;
  } finally { draco.dispose(); }
  const model = gltf.scene;
  const turntable = new THREE.Group();
  turntable.add(model);
  scene.add(turntable);

  // With u = axis·p and threshold t: solid where u >= t, outline where u <= t.
  // setScan moves t from range[0] (s=0) to range[1] (s=1).
  const axis = scan.axis.clone().normalize();
  const solidClip = new THREE.Plane(axis.clone(), 0);
  const wireClip = new THREE.Plane(axis.clone().negate(), 0);
  // feature-edge outlines read as a drawing; a full triangle wireframe turns into a blob
  const wireMat = new THREE.LineBasicMaterial({
    color: 0xf2b53a, transparent: true, opacity: 0.32, depthWrite: false, clippingPlanes: [wireClip],
  });
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const hsl = { h: 0, s: 0, l: 0 };
  const seen = new Set<THREE.Material>();
  for (const m of meshes) {
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      mat.clippingPlanes = scan.solidOnly ? [] : [solidClip];
      // lift the near-black anodised parts a little so they read on the navy ground
      const std = mat as THREE.MeshStandardMaterial;
      if (std.color && std.color.getHSL(hsl).l < 0.08) std.color.offsetHSL(0, 0, 0.06);
    }
    if (!scan.solidOnly) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), wireMat));
  }

  let framed: { sphere: THREE.Sphere; dir: THREE.Vector3 } | null = null;
  const viewDirection = new THREE.Vector3();
  let interactionEnabled = false;
  let interactionChange: (() => void) | undefined;
  const redrawInteraction = () => {
    applyFrame();
    if (interactionChange) interactionChange();
    else renderer.render(scene, camera);
  };
  const applyFrame = () => {
    if (!framed) return;
    const { sphere } = framed;
    const vFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const hFov = Math.atan(Math.tan(vFov) * camera.aspect);
    const dist = sphere.radius / Math.sin(Math.min(vFov, hFov));
    camera.position.copy(sphere.center).addScaledVector(viewDirection, dist);
    camera.lookAt(sphere.center);
  };

  let onResize: (() => void) | null = null;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyFrame();
    onResize?.();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  return {
    renderer, scene, camera, model, turntable,
    frame(sphere, dir) {
      framed = { sphere: sphere.clone(), dir: dir.clone().normalize() };
      viewDirection.copy(framed.dir);
      applyFrame();
    },
    setScan(s) {
      const t = THREE.MathUtils.lerp(scan.range[0], scan.range[1], s);
      solidClip.constant = -t;
      wireClip.constant = t;
    },
    render() {
      renderer.render(scene, camera);
    },
    onResize(cb) {
      onResize = cb;
    },
    enableInteraction(onChange) {
      interactionChange = onChange;
      if (interactionEnabled) return;
      interactionEnabled = true;
      canvas.tabIndex = 0;
      canvas.style.cursor = 'grab';
      let pointer: { id: number; x: number; y: number } | null = null;
      const spherical = new THREE.Spherical();
      const rotate = (dx: number, dy: number) => {
        if (!framed) return;
        spherical.setFromVector3(viewDirection);
        // A viewport-relative speed keeps a small wrist stage as easy to turn as the hero.
        const speed = Math.PI * 2 / Math.max(canvas.clientHeight, 250);
        spherical.theta -= dx * speed;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi - dy * speed, 0.08, Math.PI - 0.08);
        viewDirection.setFromSpherical(spherical).normalize();
        redrawInteraction();
      };
      canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0 || pointer) return;
        event.preventDefault();
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
      });
      canvas.addEventListener('pointermove', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
        pointer.x = event.clientX; pointer.y = event.clientY;
        if (dx || dy) rotate(dx, dy);
      });
      const end = (event: PointerEvent) => {
        if (pointer?.id !== event.pointerId) return;
        pointer = null;
        canvas.style.cursor = 'grab';
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('lostpointercapture', end);
      canvas.addEventListener('keydown', event => {
        const movement: Record<string, [number, number]> = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
        if (!movement[event.key]) return;
        event.preventDefault();
        rotate(...movement[event.key]);
      });
    },
    resetView() {
      if (!framed) return;
      viewDirection.copy(framed.dir);
      redrawInteraction();
    },
    dispose() {
      resizeObserver.disconnect();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>([wireMat]);
      const textures = new Set<THREE.Texture>();
      model.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
