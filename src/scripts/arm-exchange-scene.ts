import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Angles = [number, number, number, number, number, number];
type Keyframe = { time: number; angles: Angles; envelope: number };
export const EXCHANGE_DURATION = 7.2;

// Display poses, relative to the CAD export. J1-J3 hardware endpoints are unknown:
// these finite display windows are NOT calibrated physical limits (see arm-joints.json).
// J5 stays inside its documented export-relative interval [-121.371652, 118.628348].
const DISPLAY_WINDOWS: [number, number][] = [[-40, 40], [0, 125], [-150, 5], [-170, 170], [-110, 110], [-180, 180]];
const folded: Angles = [0, 0, 0, 0, 0, 0];
const unfolded: Angles = [-12, 60, -65, 15, -20, 10];
const pickup: Angles = [-20, 100, -125, -15, 25, -10];
// Numerical IK using the GLB pivots/web_axis: cube centre at (0.13, 0.36, z) m,
// with the tool turned 100 degrees about world Z. TCP is 70.5 mm from the wrist;
// add half the 200 mm cube to attach its rear face to the suction cup.
const aligned: Angles = [15.758, 75.5396, -76.2039, 103.4284, -19.4004, -3.9786];
const inserted: Angles = [11.1031, 111.4384, -128.4148, 147.2265, -25.443, -49.4984];
export const EXCHANGE_KEYFRAMES: Keyframe[] = [
  { time: 0, angles: folded, envelope: 0 },
  { time: .45, angles: folded, envelope: 0 },
  { time: 1.4, angles: unfolded, envelope: .55 },
  { time: 2.2, angles: pickup, envelope: .9 },
  { time: 2.55, angles: [-18, 95, -112, 0, 18, -8], envelope: .9 },
  { time: 3.7, angles: aligned, envelope: .85 },
  { time: 4.8, angles: inserted, envelope: 1 },
  { time: 5.2, angles: inserted, envelope: 1 },
  { time: 5.65, angles: aligned, envelope: .85 },
  { time: 6.5, angles: unfolded, envelope: .55 },
  { time: EXCHANGE_DURATION, angles: folded, envelope: 0 },
];

export function sampleExchange(time: number) {
  const t = THREE.MathUtils.clamp(time, 0, EXCHANGE_DURATION);
  let index = EXCHANGE_KEYFRAMES.findIndex((frame) => frame.time >= t);
  if (index <= 0) index = 1;
  const a = EXCHANGE_KEYFRAMES[index - 1], b = EXCHANGE_KEYFRAMES[index];
  const u = (t - a.time) / (b.time - a.time);
  const ease = u * u * u * (u * (u * 6 - 15) + 10);
  const angles = a.angles.map((angle, i) => THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(angle, b.angles[i], ease), ...DISPLAY_WINDOWS[i],
  )) as Angles;
  return { angles, envelope: THREE.MathUtils.lerp(a.envelope, b.envelope, ease) };
}

export async function createArmExchange(root: HTMLElement, base: string) {
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const canvas = $<HTMLCanvasElement>('[data-canvas]');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  // One solid CAD arm, no wire twins, shadows, postprocessing or per-frame bounds scans.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .01, 20);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = .65;
  controls.maxDistance = 4.5;
  controls.minPolarAngle = .1;
  controls.maxPolarAngle = Math.PI * .85;
  controls.rotateSpeed = .65;
  controls.zoomSpeed = .75;
  // OrbitControls keeps one camera independent of every joint/ore/time update.
  scene.add(new THREE.HemisphereLight(0xdde7f5, 0x070d17, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 4);
  key.position.set(-1.5, 2, 1.7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf2b53a, 2.2);
  rim.position.set(1.8, 1, -1);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xdde7f5, 1.4);
  fill.position.set(1, .5, 1.5);
  scene.add(fill);
  const edgeLight = new THREE.DirectionalLight(0xe5ecf5, 3);
  edgeLight.position.set(-1, .8, -2);
  scene.add(edgeLight);

  const releaseResources = () => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    scene.traverse((object) => {
      const drawable = object as THREE.Mesh;
      if (drawable.geometry) geometries.add(drawable.geometry);
      if (drawable.material) for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
  const draco = new DRACOLoader().setDecoderPath(`${base}models/draco/`).setWorkerLimit(1);
  let model: THREE.Group;
  try {
    const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(`${base}models/arm.glb`);
    model = gltf.scene;
    scene.add(model);
  } catch (error) { releaseResources(); throw error; }
  finally { draco.dispose(); }

  try {
    const joints = Array.from({ length: 6 }, (_, i) => {
      const node = model.getObjectByName(`link_${i + 1}`);
      const axis = node?.userData.web_axis as [number, number, number] | undefined;
      if (!node || !axis || node.userData.joint_name !== `J${i + 1}`) throw new Error(`Missing CAD joint J${i + 1}`);
      return { node, axis: new THREE.Vector3(...axis).normalize() };
    });
    const rootLink = model.getObjectByName('link_base');
    if (!rootLink) throw new Error('Missing stationary arm base');
    model.position.copy(rootLink.position).negate();
    const wheel = model.getObjectByName('link_wheel');
    const wheelAxis = wheel ? new THREE.Vector3(...wheel.userData.web_axis as [number, number, number]).normalize() : undefined;
    const seen = new Set<THREE.Material>();
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (seen.has(material)) continue;
        seen.add(material);
        const mat = material as THREE.MeshStandardMaterial;
        const hsl = { h: 0, s: 0, l: 0 };
        if (mat.color?.getHSL(hsl).l < .09) {
          mat.color.offsetHSL(0, 0, .045);
          mat.roughness = .46;
          mat.metalness = .25;
        } else mat.roughness = Math.max(mat.roughness ?? .5, .4);
      }
    });
    const applyPose = (angles: Angles) => {
      joints.forEach((joint, i) => joint.node.quaternion.setFromAxisAngle(joint.axis, THREE.MathUtils.degToRad(angles[i])));
      // Dependent wheel branch; this is a geometric coupling, not a motor command.
      if (wheel && wheelAxis) wheel.quaternion.setFromAxisAngle(wheelAxis, THREE.MathUtils.degToRad(angles[4] - angles[5]));
      model.updateMatrixWorld(true);
    };
    const amber = new THREE.Color(getComputedStyle(root).getPropertyValue('--amber').trim());
    const wireMaterial = new THREE.LineBasicMaterial({ color: amber, transparent: true, opacity: .65 });
    const mutedWire = new THREE.LineBasicMaterial({ color: 0x7b8ea8, transparent: true, opacity: .35 });
    const wireBox = (size: THREE.Vector3, position: THREE.Vector3, material = wireMaterial) => {
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      const edges = new THREE.EdgesGeometry(geometry);
      geometry.dispose();
      const lines = new THREE.LineSegments(edges, material);
      lines.position.copy(position);
      scene.add(lines);
      return lines;
    };
    // Exact 200 mm cube. Its local +Z face normal follows the calibrated GLB J6 axis.
    const ore = new THREE.Group();
    const oreGeometry = new THREE.BoxGeometry(.2, .2, .2);
    const oreMaterial = new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: .12, depthWrite: false });
    const oreWireMaterial = new THREE.LineBasicMaterial({ color: amber, transparent: true, opacity: .95 });
    ore.add(new THREE.Mesh(oreGeometry, oreMaterial));
    ore.add(new THREE.LineSegments(new THREE.EdgesGeometry(oreGeometry), oreWireMaterial));
    scene.add(ore);
    const tool = joints[5].node;
    const localOreOffset = joints[5].axis.clone().multiplyScalar(.1705);
    const toolBasis = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), joints[5].axis);
    const oreTransform = () => ({
      position: tool.localToWorld(localOreOffset.clone()),
      rotation: tool.getWorldQuaternion(new THREE.Quaternion()).multiply(toolBasis),
    });
    applyPose(pickup);
    const picked = oreTransform();
    applyPose(inserted);
    const placed = oreTransform();
    // Open receiving slot: its tilted aperture follows the final tool orientation.
    // 270 mm clearance around the 200 mm illustrative cube; no legs or front face.
    const stationCenter = placed.position.clone().add(new THREE.Vector3(0, 0, .015).applyQuaternion(placed.rotation));
    const station = wireBox(new THREE.Vector3(.27, .27, .24), stationCenter);
    station.quaternion.copy(placed.rotation);
    station.updateMatrixWorld(true);
    const stationBounds = new THREE.Box3().setFromObject(station);
    wireBox(new THREE.Vector3(.24, .025, .24), picked.position.clone().add(new THREE.Vector3(0, -.15, 0)), mutedWire);
    // Only a small grounding patch remains. Clip and fade the grid radially.
    const grid = new THREE.GridHelper(1.1, 16, 0x7b8ea8, 0x7b8ea8);
    grid.material.dispose();
    (grid as THREE.LineSegments<THREE.BufferGeometry, THREE.Material>).material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 gridXZ;void main(){gridXZ=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 gridXZ;void main(){float a=(1.0-smoothstep(0.18,0.55,length(gridXZ)))*0.18;if(a<0.005)discard;gl_FragColor=vec4(0.48,0.56,0.66,a);}',
    });
    grid.position.set(0, -.12, .12);
    scene.add(grid);
    wireBox(new THREE.Vector3(.22, .055, .22), new THREE.Vector3(0, -.085, 0), mutedWire);

    const corners: { mesh: THREE.Mesh; point: THREE.Vector3 }[] = [];
    model.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      const { min, max } = mesh.geometry.boundingBox!;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push({ mesh, point: new THREE.Vector3(x, y, z) });
    });
    const rings = joints.map(({ node, axis }) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.049, .0018, 6, 48), new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: .9, depthWrite: false, depthTest: false, toneMapped: false }));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      node.add(ring);
      return ring;
    });
    const trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(30 * 2 * 3);
    const trailColors = new Float32Array(trailPositions.length);
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
    const trail = new THREE.LineSegments(trailGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .8, depthWrite: false, depthTest: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    trail.frustumCulled = false;
    scene.add(trail);
    const history: { time: number; point: THREE.Vector3 }[] = [];
    const viewDirection = new THREE.Vector3(-2.4, .65, 1).normalize();
    let autoFrame = true;
    let framing = false;
    const fitPose = (instant = false) => {
      const points = corners.map(({ mesh, point }) => point.clone().applyMatrix4(mesh.matrixWorld));
      for (const x of [stationBounds.min.x, stationBounds.max.x]) for (const y of [stationBounds.min.y, stationBounds.max.y]) for (const z of [stationBounds.min.z, stationBounds.max.z]) points.push(new THREE.Vector3(x, y, z));
      for (const x of [-.1, .1]) for (const y of [-.1, .1]) for (const z of [-.1, .1]) points.push(new THREE.Vector3(x, y, z).applyQuaternion(ore.quaternion).add(ore.position));
      const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), viewDirection).normalize();
      const up = new THREE.Vector3().crossVectors(viewDirection, right).normalize();
      const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      let distance = 0;
      for (const point of points) {
        point.sub(target);
        distance = Math.max(distance, point.dot(viewDirection) + Math.abs(point.dot(right)) / (vertical * camera.aspect * .76), point.dot(viewDirection) + Math.abs(point.dot(up)) / (vertical * .8));
      }
      const next = target.clone().addScaledVector(viewDirection, Math.max(distance, controls.minDistance));
      controls.target.lerp(target, instant ? 1 : .18);
      camera.position.lerp(next, instant ? 1 : .18);
      framing = true;
      controls.update();
      framing = false;
    };
    const resetView = () => { autoFrame = true; fitPose(true); controls.saveState(); };
    controls.addEventListener('start', () => { autoFrame = false; });

    const slider = $<HTMLInputElement>('[data-timeline]');
    const phaseButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-keyframe]'));
    const jointOutputs = Array.from(root.querySelectorAll<HTMLElement>('[data-joint]'));
    const signals = new AbortController();
    let visible = false, playing = root.dataset.playing !== 'false', disposed = false;
    let time = Number(slider.value), raf = 0, lastTick = 0, lastDraw = 0;
    let frameCount = 0, perfStart = 0;
    let phaseIndex = -1;
    const labelPoint = new THREE.Vector3();
    const mineralLabel = $('[data-mineral-label]');
    const stationLabel = $('[data-station-label]');
    const projectLabel = (label: HTMLElement, position: THREE.Vector3, lift: number) => {
      labelPoint.copy(position).add(new THREE.Vector3(0, lift, 0)).project(camera);
      const x = THREE.MathUtils.clamp((labelPoint.x * .5 + .5) * canvas.clientWidth, 75, canvas.clientWidth - 75);
      const y = THREE.MathUtils.clamp((-labelPoint.y * .5 + .5) * canvas.clientHeight, 68, canvas.clientHeight - 30);
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    };
    const updatePose = (instant = false) => {
      const sample = sampleExchange(time);
      // Rebuild the history only on seek. Playback records one TCP per frame.
      if (instant || (history.length && time < history.at(-1)!.time)) {
        history.length = 0;
        for (let i = 0; i < 30; i++) {
          const past = Math.max(0, time - 1 + i / 30);
          applyPose(sampleExchange(past).angles);
          history.push({ time: past, point: tool.localToWorld(joints[5].axis.clone().multiplyScalar(.0705)) });
        }
      }
      applyPose(sample.angles);
      history.push({ time, point: tool.localToWorld(joints[5].axis.clone().multiplyScalar(.0705)) });
      while (history.length > 31 || history[0].time < time - 1) history.shift();
      history.slice(1).forEach((entry, i) => {
        history[i].point.toArray(trailPositions, i * 6);
        entry.point.toArray(trailPositions, i * 6 + 3);
        const color = amber.clone().multiplyScalar(Math.max(0, 1 - (time - entry.time)) ** 1.8);
        color.toArray(trailColors, i * 6); color.toArray(trailColors, i * 6 + 3);
      });
      trailGeometry.setDrawRange(0, Math.max(0, history.length - 1) * 2);
      trailGeometry.attributes.position.needsUpdate = true;
      trailGeometry.attributes.color.needsUpdate = true;
      const before = sampleExchange(Math.max(0, time - .04)).angles;
      const after = sampleExchange(Math.min(EXCHANGE_DURATION, time + .04)).angles;
      const rates = after.map((angle, i) => Math.abs(angle - before[i]));
      const activeJoint = rates.indexOf(Math.max(...rates));
      rings.forEach((ring, i) => { ring.visible = i === activeJoint && rates[i] > .001; });
      root.dataset.activeJoint = rates[activeJoint] > .001 ? `J${activeJoint + 1}` : '';
      const transform = time < 2.2 ? picked : time >= 5.2 ? placed : oreTransform();
      ore.position.copy(transform.position);
      ore.quaternion.copy(transform.rotation);
      let clearance = .135;
      let depth = Infinity;
      for (const x of [-.1, .1]) for (const y of [-.1, .1]) for (const z of [-.1, .1]) {
        const corner = station.worldToLocal(new THREE.Vector3(x, y, z).applyQuaternion(ore.quaternion).add(ore.position));
        clearance = Math.min(clearance, .135 - Math.max(Math.abs(corner.x), Math.abs(corner.y)));
        depth = Math.min(depth, corner.z);
      }
      root.dataset.slotClearance = clearance.toFixed(5);
      root.dataset.slotDepth = depth.toFixed(5);
      if (autoFrame) fitPose(instant);
      // Clear the received mineral near loop-end before the next illustrative cycle.
      const opacity = time > 6.8 ? 1 - (time - 6.8) / .4 : 1;
      oreMaterial.opacity = .12 * opacity;
      oreWireMaterial.opacity = .95 * opacity;
      root.dataset.oreState = time < 2.2 ? 'waiting' : time >= 5.2 ? 'released' : 'attached';
      root.dataset.angles = sample.angles.map((angle) => angle.toFixed(3)).join(',');
      root.dataset.orePosition = ore.position.toArray().map((value) => value.toFixed(5)).join(',');
      jointOutputs.forEach((output, i) => { output.textContent = `${Math.abs(sample.angles[i]) < .05 ? '0.0' : sample.angles[i].toFixed(1)}°`; });
      // Design-envelope indication only; CAD export bounds are not the inspection envelope.
      $('[data-envelope]').textContent = `${Math.round(THREE.MathUtils.lerp(590, 1400, sample.envelope))}`;
      $('[data-extent]').style.transform = `scaleX(${.2 + .8 * sample.envelope})`;
      slider.value = time.toFixed(3);
      slider.setAttribute('aria-valuetext', `${time.toFixed(2)} s`);
      $('[data-time]').textContent = `${time.toFixed(2)} s`;
      const nextPhase = time <= .45 ? 0 : time <= 1.4 ? 1 : time <= 2.2 ? 2 : time <= 3.7 ? 3 : time <= 4.8 ? 4 : time <= 5.2 ? 5 : 6;
      if (nextPhase !== phaseIndex) {
        phaseIndex = nextPhase;
        $('[data-phase]').textContent = phaseButtons[phaseIndex].textContent;
        phaseButtons.forEach((button, i) => i === phaseIndex ? button.setAttribute('aria-current', 'step') : button.removeAttribute('aria-current'));
      }
    };
    const render = () => {
      if (!visible || disposed || framing) return;
      renderer.render(scene, camera);
      projectLabel(stationLabel, placed.position, .22);
      projectLabel(mineralLabel, ore.position, .14);
      mineralLabel.style.visibility = time < 4.4 ? 'visible' : 'hidden';
      root.dataset.camera = camera.position.toArray().map((value) => value.toFixed(5)).join(',');
      root.dataset.cameraDistance = camera.position.distanceTo(controls.target).toFixed(5);
      root.dataset.frames = `${Number(root.dataset.frames || 0) + 1}`;
      root.dataset.drawCalls = `${renderer.info.render.calls}`;
      root.dataset.triangles = `${renderer.info.render.triangles}`;
      const now = performance.now();
      frameCount++;
      if (playing && now - perfStart >= 2000) {
        const fps = frameCount * 1000 / (now - perfStart);
        root.dataset.fps = fps.toFixed(1);
        if (import.meta.env.DEV) console.info('[arm-exchange]', { fps: +fps.toFixed(1), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio() });
        perfStart = now;
        frameCount = 0;
      }
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; lastTick = 0; };
    const tick = (now: number) => {
      raf = 0;
      if (!visible || !playing || disposed) return;
      if (lastTick) time = (time + Math.min((now - lastTick) / 1000, .1)) % EXCHANGE_DURATION;
      lastTick = now;
      // 30 rendered fps is sufficient for this eased illustration on an MX450.
      if (now - lastDraw >= 1000 / 30 - .5) {
        updatePose();
        render();
        lastDraw = now;
      }
      raf = requestAnimationFrame(tick);
    };
    const run = () => { if (visible && playing && !disposed && !raf) raf = requestAnimationFrame(tick); };
    const setPlaying = (value: boolean) => {
      playing = value;
      $('[data-toggle]').setAttribute('aria-pressed', `${value}`);
      $('[data-play-label]').textContent = value ? root.dataset.pause! : root.dataset.play!;
      $('[data-play-icon]').textContent = value ? 'Ⅱ' : '▶';
      root.dataset.playing = `${value}`;
      perfStart = performance.now(); frameCount = 0;
      if (value) run(); else stop();
    };
    $('[data-toggle]').addEventListener('click', () => setPlaying(!playing), { signal: signals.signal });
    const seek = (value: number) => {
      setPlaying(false);
      time = THREE.MathUtils.clamp(value, 0, EXCHANGE_DURATION);
      updatePose(true); render();
    };
    slider.addEventListener('pointerdown', () => setPlaying(false), { signal: signals.signal });
    slider.addEventListener('input', () => seek(Number(slider.value)), { signal: signals.signal });
    phaseButtons.forEach((button) => button.addEventListener('click', () => seek(Number(button.dataset.keyframe)), { signal: signals.signal }));
    $('[data-reset]').addEventListener('click', () => { resetView(); render(); }, { signal: signals.signal });
    controls.addEventListener('change', render);
    const resize = () => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height || disposed) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // Resizing changes projection only. Preserve the user's camera position/zoom.
      render();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize(); updatePose(true); resetView();
    $<HTMLFieldSetElement>('fieldset').disabled = false;
    setPlaying(playing);
    root.dataset.ready = 'true';
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      stop(); signals.abort(); resizeObserver.disconnect();
      controls.removeEventListener('change', render);
      releaseResources();
      $<HTMLFieldSetElement>('fieldset').disabled = true;
      delete root.dataset.ready;
    };
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      dispose();
      root.classList.remove('is-ready');
      root.classList.add('is-static', 'is-fallback');
      $('[data-status]').textContent = root.dataset.unavailable!;
    }, { signal: signals.signal });
    return {
      setVisible(value: boolean) {
        if (disposed || visible === value) return;
        visible = value;
        root.dataset.visible = `${value}`;
        if (value) {
          perfStart = performance.now(); frameCount = 0; lastDraw = 0;
          updatePose(); render(); run();
        } else stop();
      },
      dispose,
    };
  } catch (error) { releaseResources(); throw error; }
}
