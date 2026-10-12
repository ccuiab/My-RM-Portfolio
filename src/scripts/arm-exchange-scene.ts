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
const DISPLAY_WINDOWS: [number, number][] = [[-300, 300], [-160, 160], [-200, 180], [-170, 170], [-121.3716516466, 118.6283483533], [-180, 180]];
// Source engineer_raw.glb node 1673, fixed ZP-80HB in gimbal_v2; inverse
// source arm-root transform, then subtract arm.glb link_base/J1 translation.
// Cup centre = (169.041,140.500,-382.542) mm; its contact plane is Y=158 mm.
// A 200 mm illustrative cube rests above that plane, with no CAD repositioning.
const STORAGE_ORE = new THREE.Vector3(.1690407641, .2579999982, -.3825417976);
const folded: Angles = [0, 0, 0, 0, 0, 0];
const unfolded: Angles = [-23.840077, 60.179677, 127.454973, 0.395407, -95.814065, 0.764780];
const pickup: Angles = [-23.840077, 63.208411, 105.017173, 0.395407, -76.405000, 0.764780];
// Numerical IK on the exact GLB pivots/web_axis. Storage remains at its CAD
// contact plane +100 mm; bay centre (-430,350,50) mm. Inward normal
// (-.9495,-.0500,+.3098); the mouth faces +X sideways and slightly rearward
// (-Z in the arm frame). Lift and approach stay on one continuous IK branch.
const transferClearance: Angles = [1.847274, 86.451674, 105.348195, 42.928703, -89.305995, 51.874820];
const approach: Angles = [27.534625, 112.723671, 83.241418, 85.461999, -82.797925, 102.984860];
const aligned: Angles = [27.534627, 120.261228, 64.095149, 87.298676, -81.982213, 91.260485];
const inserted: Angles = [88.313833, 88.508322, 75.377968, 128.375197, -26.734252, 47.749680];
// Continuation IK every 11.25 mm on a 225 mm straight insertion, constant wrist
// orientation; unwrapped joint coordinates avoid branch jumps at +/-180 degrees.
const INSERTION_PATH: Angles[] = [
  [27.534624, 120.261228, 64.095149, 87.298676, -81.982215, 91.260485],
  [34.641627, 119.784847, 64.119337, 87.196150, -74.862069, 91.198241],
  [41.262280, 119.048924, 64.205294, 87.253229, -68.215740, 90.898566],
  [47.288708, 118.082721, 64.352764, 87.536610, -62.154763, 90.340067],
  [52.682651, 116.918620, 64.561313, 88.096509, -56.724400, 89.502324],
  [57.457745, 115.588565, 64.830337, 88.966852, -51.920749, 88.369142],
  [61.659083, 114.121916, 65.159074, 90.166788, -47.710212, 86.930693],
  [65.346495, 112.544506, 65.546620, 91.702388, -44.045136, 85.184851],
  [68.583361, 110.878483, 65.991944, 93.567952, -40.874004, 83.138061],
  [71.430231, 109.142557, 66.493910, 95.746835, -38.146942, 80.805943],
  [73.941793, 107.352419, 67.051290, 98.212041, -35.818033, 78.213589],
  [76.165859, 105.521181, 67.662791, 100.926944, -33.845760, 75.395360],
  [78.143442, 103.659783, 68.327068, 103.846508, -32.192529, 72.393957],
  [79.909353, 101.777343, 69.042751, 106.919244, -30.823883, 69.258613],
  [81.492978, 99.881451, 69.808452, 110.089910, -29.707755, 66.042474],
  [82.919071, 97.978408, 70.622793, 113.302719, -28.813932, 62.799414],
  [84.208495, 96.073422, 71.484415, 116.504622, -28.113784, 59.580756],
  [85.378860, 94.170770, 72.391993, 119.648184, -27.580223, 56.432394],
  [86.445076, 92.273935, 73.344247, 122.693653, -27.187824, 53.392703],
  [87.419803, 90.385715, 74.339957, 125.610033, -26.913015, 50.491453],
  [88.313833, 88.508322, 75.377968, 128.375197, -26.734252, 47.749680],
];
const smoothProgress = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const insertionPose = (progress: number): Angles => {
  const value = THREE.MathUtils.clamp(progress, 0, 1) * (INSERTION_PATH.length - 1);
  const i = Math.min(Math.floor(value), INSERTION_PATH.length - 2), u = value - i;
  const at = (index: number) => INSERTION_PATH[THREE.MathUtils.clamp(index, 0, INSERTION_PATH.length - 1)];
  const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
  return b.map((v, j) => .5 * (2 * v + (-a[j] + c[j]) * u + (2 * a[j] - 5 * v + 4 * c[j] - d[j]) * u * u + (-a[j] + 3 * v - 3 * c[j] + d[j]) * u * u * u)) as Angles;
};
export const EXCHANGE_KEYFRAMES: Keyframe[] = [
  { time: 0, angles: folded, envelope: 0 },
  { time: .45, angles: folded, envelope: 0 },
  { time: 1.4, angles: unfolded, envelope: .55 },
  { time: 2.2, angles: pickup, envelope: .9 },
  { time: 2.55, angles: unfolded, envelope: .9 },
  { time: 2.9, angles: transferClearance, envelope: 1 },
  { time: 3.25, angles: approach, envelope: .95 },
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
  let angles = a.angles.map((angle, i) => THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(angle, b.angles[i], ease), ...DISPLAY_WINDOWS[i],
  )) as Angles;
  if (t >= 3.7 && t <= 4.8) angles = insertionPose(smoothProgress((t - 3.7) / 1.1));
  if (t >= 5.2 && t <= 5.65) angles = insertionPose(1 - smoothProgress((t - 5.2) / .45));
  return { angles, envelope: THREE.MathUtils.lerp(a.envelope, b.envelope, ease) };
}

export async function createArmExchange(root: HTMLElement, base: string, signal: AbortSignal) {
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

  let resourcesReleased = false;
  const releaseResources = () => {
    if (resourcesReleased) return;
    resourcesReleased = true;
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
  const manager = new THREE.LoadingManager();
  const abortLoad = () => { manager.abort(); releaseResources(); };
  signal.addEventListener('abort', abortLoad, { once: true });
  if (signal.aborted) abortLoad();
  const draco = new DRACOLoader(manager).setDecoderPath(`${base}models/draco/`).setWorkerLimit(1);
  let model: THREE.Group;
  try {
    const gltf = await new GLTFLoader(manager).setDRACOLoader(draco).loadAsync(`${base}models/arm.glb`);
    model = gltf.scene;
    scene.add(model);
  } catch (error) { releaseResources(); throw error; }
  finally { signal.removeEventListener('abort', abortLoad); draco.dispose(); }

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
    picked.position.copy(STORAGE_ORE);
    applyPose(inserted);
    const placed = oreTransform();
    // Open receiving slot: its tilted aperture follows the final tool orientation.
    // 270 mm clearance around the 200 mm illustrative cube; no legs or front face.
    const stationCenter = placed.position.clone().add(new THREE.Vector3(0, 0, .015).applyQuaternion(placed.rotation));
    const station = wireBox(new THREE.Vector3(.27, .27, .24), stationCenter);
    station.quaternion.copy(placed.rotation);
    station.updateMatrixWorld(true);
    const stationBounds = new THREE.Box3().setFromObject(station);
    const storageTray = wireBox(new THREE.Vector3(.24, .025, .24), picked.position.clone().add(new THREE.Vector3(0, -.1125, 0)), mutedWire);
    const storageBounds = new THREE.Box3().setFromObject(storageTray);
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
    const viewDirection = new THREE.Vector3(1.7, 1.1, 2.4).normalize();
    let autoFrame = true;
    let framing = false;
    const fitPose = (instant = false) => {
      const points = corners.map(({ mesh, point }) => point.clone().applyMatrix4(mesh.matrixWorld));
      for (const x of [stationBounds.min.x, stationBounds.max.x]) for (const y of [stationBounds.min.y, stationBounds.max.y]) for (const z of [stationBounds.min.z, stationBounds.max.z]) points.push(new THREE.Vector3(x, y, z));
      for (const x of [storageBounds.min.x, storageBounds.max.x]) for (const y of [storageBounds.min.y, storageBounds.max.y]) for (const z of [storageBounds.min.z, storageBounds.max.z]) points.push(new THREE.Vector3(x, y, z));
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
    const storageLabel = $('[data-storage-label]');
    root.dataset.storagePosition = STORAGE_ORE.toArray().map(value => value.toFixed(6)).join(',');
    root.dataset.stationPosition = stationCenter.toArray().map(value => value.toFixed(6)).join(',');
    // The receiving side is local -Z; arm-local -Z is vehicle-rear.
    root.dataset.stationMouthDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(placed.rotation).toArray().map(value => value.toFixed(6)).join(',');
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
      let back = -Infinity;
      const slotMin = new THREE.Vector3(Infinity, Infinity, Infinity);
      const slotMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const x of [-.1, .1]) for (const y of [-.1, .1]) for (const z of [-.1, .1]) {
        const corner = station.worldToLocal(new THREE.Vector3(x, y, z).applyQuaternion(ore.quaternion).add(ore.position));
        clearance = Math.min(clearance, .135 - Math.max(Math.abs(corner.x), Math.abs(corner.y)));
        depth = Math.min(depth, corner.z);
        back = Math.max(back, corner.z);
        slotMin.min(corner); slotMax.max(corner);
      }
      root.dataset.slotClearance = clearance.toFixed(5);
      root.dataset.slotDepth = depth.toFixed(5);
      root.dataset.slotBackClearance = (.12 - back).toFixed(5);
      // Clearance/depth are raw bay-local support bounds, also while ore is
      // outside the opening. Only test a wall overlap inside the bay's slab.
      const inSlab = slotMin.z <= .12 && slotMax.z >= -.12;
      const inFrame = slotMin.x <= .145 && slotMax.x >= -.145 && slotMin.y <= .145 && slotMax.y >= -.145;
      root.dataset.slotOverlap = String(inSlab && inFrame && (clearance < -.000001 || back > .120001));
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
      projectLabel(storageLabel, STORAGE_ORE, -.11);
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
