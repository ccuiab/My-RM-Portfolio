import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rm2025Field as copy } from '../data/content';

type AssetId = keyof typeof copy.names;
type Lang = 'zh' | 'en';
type Asset = { id: AssetId; file: string; source_pages: number[]; triangles?: number };
type Manifest = { assets: Asset[]; source_cad_url: string; source_manual_url: string };
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
let language: Lang = 'zh';
const text = (value: { zh: string; en: string }) => value[language];
let manifest: Manifest;
let selected: AssetId | 'overview' = 'overview';
const models = new Map<AssetId, THREE.Group>();
const active = new THREE.Group();
const poseRoot = new THREE.Group();
const oreRoot = new THREE.Group();
const pose = { x: -220, y: 0, z: 760, theta: 0, phi: 60, alpha: 0, insertion: 0 };
let animation: { start: number; from: number; to: number } | null = null;
const presets = [
  { x: -220, y: 0, z: 760, theta: 0, phi: 60, alpha: 0 },
  { x: -220, y: 0, z: 760, theta: 0, phi: 60, alpha: 30 },
  { x: -220, y: 40, z: 760, theta: 70, phi: 60, alpha: 30 },
  { x: -220, y: 0, z: 750, theta: -95, phi: 45, alpha: -35 },
];
document.body.innerHTML = `<header><div><h1></h1><p id="subtitle"></p></div><button id="language"></button></header>
<main><nav aria-label="Models" id="assets"></nav><section id="stage"><canvas></canvas><div id="loading" role="status"></div><div id="stage-actions"><button id="fit"></button><button id="rotate" aria-pressed="false"></button></div><p id="gestures"></p></section>
<aside><h2 id="asset-name"></h2><p id="dimensions-label" class="caption"></p><p id="dimensions" class="value"></p><a id="download" download></a><div id="pose-panel" hidden><h3 id="pose-title"></h3><p id="pose-hint" class="caption"></p><div id="presets"></div><p id="samples-hint" class="caption"></p><div id="sliders"></div><p id="pose-status" role="status"></p><label id="insertion-label" for="insertion"></label><input id="insertion" type="range" min="0" max="1" step=".001" value="0"><button id="insert"></button><p id="clearance" class="caption"></p></div>
<div class="references"><h3 id="source-title"></h3><a id="manual" target="_blank" rel="noopener"></a><a id="cad" target="_blank" rel="noopener"></a><a href="manifest.json" id="manifest" target="_blank"></a><p id="pages" class="caption"></p><a id="reference" target="_blank" rel="noopener"><img id="reference-image" hidden><span id="reference-title"></span></a></div></aside></main>`;
const canvas = $('canvas') as HTMLCanvasElement;
$('h1').textContent = text(copy.title);
$('#subtitle').textContent = text(copy.subtitle);
$('#language').textContent = text(copy.language);
$('#fit').textContent = text(copy.home);
$('#rotate').textContent = text(copy.rotate);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0x0c1626);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, .01, 150);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .09;
controls.autoRotateSpeed = .65;
scene.add(new THREE.HemisphereLight(0xe4efff, 0x78839a, 1.35));
for (const [position, intensity] of [[new THREE.Vector3(4, 8, 6), 1.8], [new THREE.Vector3(-5, 4, -3), 1.1]] as const) {
  const light = new THREE.DirectionalLight(0xffffff, intensity); light.position.copy(position); scene.add(light);
}
const grid = new THREE.GridHelper(30, 150, 0x27405d, 0x1a2b42);
for (const material of (Array.isArray(grid.material) ? grid.material : [grid.material])) { material.transparent = true; material.opacity = .38; }
grid.position.y = -.012;
scene.add(grid, active, poseRoot);
const loader = new GLTFLoader();

function bounds(object: THREE.Object3D) { return new THREE.Box3().setFromObject(object, true); }
function fit() {
  const box = bounds(selected === 'exchange-slot' ? poseRoot : active);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = size.length() / 2;
  controls.target.copy(center);
  const direction = selected === 'exchange-slot'
    ? new THREE.Vector3(.72, .42, 1.65).normalize().applyQuaternion(poseRoot.quaternion)
    : new THREE.Vector3(1.1, .72, 1.5).normalize();
  const right = camera.up.clone().cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const tangentY = Math.tan(camera.fov * Math.PI / 360), tangentX = tangentY * camera.aspect;
  let distance = .05;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(center), depth = point.dot(direction);
    distance = Math.max(distance, depth + Math.abs(point.dot(right)) / tangentX, depth + Math.abs(point.dot(up)) / tangentY);
  }
  distance *= 1.12;
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  controls.minDistance = Math.max(radius * .25, .08); controls.maxDistance = Math.max(radius * 12, 3);
  camera.near = Math.max(distance / 2000, .002); camera.far = Math.max(distance * 30, 50); camera.updateProjectionMatrix();
  controls.update();
}

function applyPose() {
  poseRoot.position.set(pose.y / 1000, pose.z / 1000, pose.x / 1000);
  const radians = THREE.MathUtils.degToRad;
  poseRoot.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), radians(pose.theta));
  poseRoot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), radians(pose.phi - 90)));
  poseRoot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), radians(pose.alpha)));
  oreRoot.position.set(0, 0, THREE.MathUtils.lerp(.4, -.106, pose.insertion));
  oreRoot.position.y = -.0199 * THREE.MathUtils.smoothstep(pose.insertion, .85, 1);
  poseRoot.updateMatrixWorld(true);
  const slot = poseRoot.getObjectByName('preview_slot_geometry');
  const slotBounds = slot ? bounds(slot) : null;
  const sphere = pose.x ** 2 + pose.y ** 2 + (pose.z - 600) ** 2 <= 300 ** 2 + 1e-6;
  const noFrontCrossing = !slotBounds || slotBounds.max.z <= .000001;
  const valid = sphere && noFrontCrossing;
  $('#pose-status').textContent = text(valid ? copy.valid : copy.invalid);
  $('#pose-status').dataset.valid = String(valid);
  $('input#insertion').setAttribute('value', String(pose.insertion));
  ($('input#insertion') as HTMLInputElement).value = String(pose.insertion);
  document.body.dataset.poseValid = String(valid);
  document.body.dataset.insertion = pose.insertion.toFixed(4);
}

function select(id: AssetId | 'overview') {
  selected = id; animation = null;
  active.clear(); poseRoot.clear(); oreRoot.clear(); poseRoot.visible = id === 'exchange-slot';
  if (id === 'exchange-slot') {
    const slot = models.get(id)!.clone(true); slot.name = 'preview_slot_geometry';
    oreRoot.add(models.get('ore-gold')!.clone(true));
    poseRoot.add(slot, oreRoot); applyPose();
  } else if (id === 'overview') {
    const layout = { 'exchange-station': [-2.4, -2.8], 'gold-island': [-2.1, 1.7], 'silver-island': [2.3, -1.8], 'ore-gold': [1.6, .8], 'ore-silver': [2.1, .8], 'exchange-slot': [.5, -.1], 'highland-crossing': [.7, 3.4] };
    for (const asset of manifest.assets) {
      const item = models.get(asset.id)!.clone(true);
      const box = bounds(item), center = box.getCenter(new THREE.Vector3());
      const [x, z] = layout[asset.id];
      item.position.add(new THREE.Vector3(x - center.x, -box.min.y + .015, z - center.z));
      active.add(item);
    }
  } else {
    const item = models.get(id)!.clone(true); item.position.y -= bounds(item).min.y; active.add(item);
  }
  $('#pose-panel').hidden = id !== 'exchange-slot';
  $('#download').hidden = id === 'overview';
  if (id !== 'overview') ($('#download') as HTMLAnchorElement).href = manifest.assets.find(asset => asset.id === id)!.file;
  for (const button of document.querySelectorAll<HTMLButtonElement>('#assets button')) button.setAttribute('aria-pressed', String(button.dataset.asset === id));
  refreshLabels(); fit();
  document.body.dataset.asset = id;
}

function refreshLabels() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = text(copy.title);
  $('h1').textContent = text(copy.title);
  const labels = { subtitle: copy.subtitle, language: copy.language, fit: copy.home, rotate: copy.rotate, gestures: copy.drag, 'dimensions-label': copy.dimensions, download: copy.download, 'pose-title': copy.pose, 'pose-hint': copy.poseHint, 'samples-hint': copy.samplesHint, 'insertion-label': copy.inserted, insert: copy.insert, clearance: copy.clearance, 'source-title': copy.source, manual: copy.manual, cad: copy.cad, manifest: copy.allFiles };
  for (const [id, value] of Object.entries(labels)) $(`#${id}`).textContent = text(value);
  $('#asset-name').textContent = selected === 'overview' ? text(copy.overview) : text(copy.names[selected]);
  for (const button of document.querySelectorAll<HTMLButtonElement>('#assets button')) {
    const id = button.dataset.asset as AssetId | 'overview'; button.textContent = id === 'overview' ? text(copy.overview) : text(copy.names[id]);
  }
  for (const [index, button] of [...document.querySelectorAll<HTMLButtonElement>('#presets button')].entries()) button.textContent = text(copy.levels[index]);
  const target = selected === 'exchange-slot' ? models.get('exchange-slot')! : active;
  const size = bounds(target).getSize(new THREE.Vector3());
  $('#dimensions').textContent = [size.x, size.y, size.z].map(value => (value * 1000).toFixed(1)).join(' × ');
  $('#pages').textContent = selected === 'overview' ? '' : `PDF p. ${manifest.assets.find(asset => asset.id === selected)!.source_pages.join(', ')}`;
  const referencePages = { overview: 37, 'gold-island': 62, 'silver-island': 64, 'ore-gold': 73, 'ore-silver': 73, 'exchange-station': 57, 'exchange-slot': 58, 'highland-crossing': 61 };
  const reference = `references/rules-p${String(referencePages[selected]).padStart(3, '0')}.png`;
  ($<HTMLAnchorElement>('#reference')).href = reference;
  const referenceImage = $<HTMLImageElement>('#reference-image'); referenceImage.hidden = true; referenceImage.onload = () => { referenceImage.hidden = false; }; referenceImage.src = reference; referenceImage.alt = $('#asset-name').textContent ?? '';
  $('#reference-title').textContent = text(copy.reference);
  if (selected === 'exchange-slot') applyPose();
}

function sliders() {
  const parameters = [['x', -270, 0, 1, 'mm'], ['y', -255, 255, 1, 'mm'], ['z', 720, 900, 1, 'mm'], ['theta', -135, 135, 1, '°'], ['phi', 1, 90, 1, '°'], ['alpha', -45, 45, 1, '°']] as const;
  for (const [key, min, max, step, unit] of parameters) {
    const symbol = { x: 'x', y: 'y', z: 'z', theta: 'θ', phi: 'φ', alpha: 'α' }[key];
    const label = document.createElement('label'); label.htmlFor = `parameter-${key}`;
    label.innerHTML = `<span>${symbol}</span><output>${pose[key]} ${unit}</output>`;
    const input = document.createElement('input'); Object.assign(input, { id: label.htmlFor, type: 'range', min: String(min), max: String(max), step: String(step), value: String(pose[key]) });
    input.dataset.parameter = key;
    input.addEventListener('input', () => { pose[key] = Number(input.value); label.querySelector('output')!.textContent = `${pose[key]} ${unit}`; applyPose(); });
    $('#sliders').append(label, input);
  }
  presets.forEach((preset, index) => {
    const button = document.createElement('button'); button.addEventListener('click', () => {
      Object.assign(pose, preset); applyPose();
      for (const [key, , , , unit] of parameters) {
        const input = $<HTMLInputElement>(`#parameter-${key}`); input.value = String(pose[key]); input.previousElementSibling!.querySelector('output')!.textContent = `${pose[key]} ${unit}`;
      }
      fit();
    }); $('#presets').append(button);
  });
}

$('#fit').addEventListener('click', fit);
$('#rotate').addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; $('#rotate').setAttribute('aria-pressed', String(controls.autoRotate)); });
$('#language').addEventListener('click', () => { language = language === 'zh' ? 'en' : 'zh'; refreshLabels(); });
$('#insertion').addEventListener('input', event => { animation = null; pose.insertion = Number((event.target as HTMLInputElement).value); applyPose(); });
$('#insert').addEventListener('click', () => {
  const to = pose.insertion < .5 ? 1 : 0;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { pose.insertion = to; applyPose(); }
  else animation = { start: performance.now(), from: pose.insertion, to };
});
const resize = new ResizeObserver(() => { const width = $('#stage').clientWidth, height = $('#stage').clientHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); if (manifest && models.size === manifest.assets.length) fit(); });
resize.observe($('#stage'));
let sampledFrames = 0, sampledAt = performance.now();
renderer.setAnimationLoop(now => {
  if (animation) {
    const t = Math.min((now - animation.start) / 1800, 1); const eased = t * t * (3 - 2 * t);
    pose.insertion = THREE.MathUtils.lerp(animation.from, animation.to, eased); applyPose(); if (t === 1) animation = null;
  }
  controls.update(); renderer.render(scene, camera);
  document.body.dataset.triangles = String(renderer.info.render.triangles);
  document.body.dataset.drawCalls = String(renderer.info.render.calls);
  sampledFrames++;
  if (now - sampledAt >= 1500) { document.body.dataset.fps = (sampledFrames * 1000 / (now - sampledAt)).toFixed(1); sampledFrames = 0; sampledAt = now; }
});

async function load() {
  $('#loading').textContent = text(copy.loading);
  const response = await fetch('manifest.json'); if (!response.ok) throw new Error(`manifest ${response.status}`);
  manifest = await response.json();
  const overview = document.createElement('button'); overview.dataset.asset = 'overview'; overview.addEventListener('click', () => select('overview')); $('#assets').append(overview);
  for (const asset of manifest.assets) {
    const gltf = await loader.loadAsync(asset.file); const model = gltf.scene;
    model.traverse(object => { if (object instanceof THREE.Mesh) { const materials = Array.isArray(object.material) ? object.material : [object.material]; for (const material of materials) { material.side = THREE.DoubleSide; } } });
    models.set(asset.id, model);
    const button = document.createElement('button'); button.dataset.asset = asset.id; button.addEventListener('click', () => select(asset.id)); $('#assets').append(button);
  }
  ($<HTMLAnchorElement>('#manual')).href = manifest.source_manual_url;
  ($<HTMLAnchorElement>('#cad')).href = manifest.source_cad_url;
  sliders(); select('overview'); $('#loading').hidden = true; document.body.dataset.loaded = 'true';
}
load().catch(error => { console.error(error); $('#loading').textContent = text(copy.failure); document.body.dataset.loaded = 'error'; });
