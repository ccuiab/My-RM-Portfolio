import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createModuleMotion, swervePresentation, CYCLE_DURATION, ARTICULATION_START } from '../src/scripts/module-motion.ts';
import { placeSwerveModule } from '../src/scripts/lib/swerve-placement.ts';

const web = 'materials/models/derived/web/';
const meta = JSON.parse(readFileSync(`${web}engineer-swerve-context.json`));
const glb = path => { const bytes = readFileSync(path); return { bytes, data: JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12))) }; };
const module = glb(`${web}engineer-swerve.glb`), context = glb(`${web}engineer-swerve-context.glb`);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(module.bytes), meta.module_sha256);
assert.equal(sha(context.bytes), meta.output_sha256);
assert.equal(sha(readFileSync(`${web}arm-parts.glb`)), meta.arm_sha256);
assert.equal(meta.decimated, false);
const sourceTriangles = meta.groups.reduce((n, g) => n + g.source_triangles, 0);
const outputTriangles = context.data.meshes.reduce((n, m) => n + m.primitives.reduce((s, p) => s + context.data.accessors[p.indices].count / 3, 0), 0);
assert.equal(outputTriangles, sourceTriangles, 'vehicle triangles must be retained');
const sourceBytes = readFileSync(meta.source);
assert.equal(sha(sourceBytes), meta.source_sha256);
const source = JSON.parse(sourceBytes.subarray(20, 20 + sourceBytes.readUInt32LE(12)));
const parents = new Map(source.nodes.flatMap((n, i) => (n.children ?? []).map(c => [c, i])));
const included = meta.groups.flatMap(g => g.source_nodes);
assert.equal(new Set(included).size, included.length);
for (const i of included) for (let node = i; node !== undefined; node = parents.get(node)) {
  assert.ok(!meta.excluded_complete_wheel_roots.includes(node) || String(i) in meta.unique_fixed_parts, 'duplicated complete wheel subtree');
}

function makeModule(spec) {
  const nodes = module.data.nodes.map(n => {
    const primitives = n.mesh === undefined ? [] : module.data.meshes[n.mesh].primitives;
    const o = !primitives.length ? new THREE.Object3D() : primitives.length === 1 ? new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial()) : new THREE.Group();
    if (primitives.length > 1) primitives.forEach(() => o.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial())));
    o.userData = n.extras ?? {}; o.name = n.name;
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  module.data.nodes.forEach((n, i) => n.children?.forEach(c => nodes[i].add(nodes[c])));
  const model = new THREE.Group(); module.data.scenes[module.data.scene ?? 0].nodes.forEach(i => model.add(nodes[i]));
  placeSwerveModule(model, spec);
  const frame = new THREE.Group(); frame.applyMatrix4(new THREE.Matrix4().fromArray(spec.matrix)); frame.add(model);
  const scene = new THREE.Scene(); scene.add(frame);
  const motion = createModuleMotion({ model, scene, amber: new THREE.Color('#efb64d'), camera: new THREE.PerspectiveCamera(), swerveAnchors: () => [] }, 'swerve');
  return { model, frame, nodes, motion, tire: nodes.find(o => o.userData.source_node_index === 31) };
}
const wheels = meta.wheels.map(makeModule);
let maxAssemblyError = 0, maxHeadingError = 0;
const update = time => wheels.map((w, i) => {
  const sample = swervePresentation(time, i), spec = meta.wheels[i];
  w.motion.update(0, 0, { ...sample, demo: true, steering: sample.steering + THREE.MathUtils.lerp(spec.rest_steer, spec.common_steer, sample.alignment) });
  w.frame.updateMatrixWorld(true);
  return w;
});
update(0).forEach((w, i) => {
  const error = w.tire.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...meta.wheels[i].source_tire_center));
  maxAssemblyError = Math.max(maxAssemblyError, error);
  assert.ok(error < 1e-6, `wheel ${i} assembly origin mismatch: ${error}`);
});
for (let t = ARTICULATION_START + .4; t < ARTICULATION_START + 7.1; t += .08) {
  const axes = update(t).map(w => new THREE.Vector3().fromArray(w.tire.userData.web_axis).applyQuaternion(w.tire.parent.getWorldQuaternion(new THREE.Quaternion())).normalize());
  for (const axis of axes) { const error = axis.distanceTo(axes[0]); maxHeadingError = Math.max(maxHeadingError, error); assert.ok(error < 1e-6, 'wheel headings differ in vehicle coordinates'); }
}
assert.equal(CYCLE_DURATION, 27);
assert.ok(CYCLE_DURATION <= 30);
assert.deepEqual(['overview', 'focus', 'opening', 'exploded', 'closing', 'pullback', 'articulation', 'returning'], [.2, 1.5, 5, 9, 14, 18, 21, 26.8].map(t => swervePresentation(t).phase));
const closeup = swervePresentation(9);
assert.equal(closeup.bodyOpacity, 0); assert.equal(closeup.otherOpacity, 0); assert.equal(closeup.overview, 0);
const finale = swervePresentation(22);
assert.equal(finale.bodyOpacity, .12); assert.equal(finale.otherOpacity, 1); assert.equal(finale.overview, 1);
const staggered = Array.from({ length: 100 }, (_, j) => [0, 1, 2, 3].map(i => swervePresentation(ARTICULATION_START + j * .08, i).suspension));
assert.ok(staggered.some(values => Math.max(...values) - Math.min(...values) > .005), 'suspensions are not staggered');
for (const t of [1, 1.6, 17.4, 17.8, 26.8]) assert.equal(swervePresentation(t).orbitWeight, 0, 'orbit must stop during camera travel');
const before = swervePresentation(CYCLE_DURATION - .00001), after = swervePresentation(CYCLE_DURATION + .00001);
for (const key of ['overview', 'bodyOpacity', 'otherOpacity', 'suspension', 'steering']) assert.ok(Math.abs(before[key] - after[key]) < 1e-8, `loop discontinuity: ${key}`);
const report = { cycle_seconds: CYCLE_DURATION, source_triangles: sourceTriangles, output_triangles: outputTriangles,
  wheel_instances: wheels.length, max_assembly_origin_error_m: maxAssemblyError, max_world_heading_error: maxHeadingError,
  closeup_background_fully_hidden: true, finale_body_opacity: finale.bodyOpacity, staggered_suspension: true, loop_continuous: true };
const dir = 'materials/documents/derived/audits/swerve-chassis-20261017'; mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/geometry-motion-checks.json`, JSON.stringify(report, null, 2) + '\n');
console.log(report);
