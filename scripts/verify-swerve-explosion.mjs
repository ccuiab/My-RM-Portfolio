// Run with Node 26: node scripts/verify-swerve-explosion.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createModuleMotion, swervePartProgress, swerveAngles, explosionCycle, cycleAtAmount, CYCLE_DURATION, swervePresentation, SWERVE_PRESENTATION_DURATION } from '../src/scripts/module-motion.ts';

const path = 'materials/models/derived/web/engineer-swerve.glb';
const bytes = readFileSync(path);
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
const audit = JSON.parse(readFileSync('materials/models/derived/web/engineer-modules.json')).modules.swerve;
assert.equal(audit.output_sha256, createHash('sha256').update(bytes).digest('hex'));
const objects = gltf.nodes.map(node => {
  const object = node.mesh === undefined ? new THREE.Object3D() : new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());
  object.name = node.name; object.userData = node.extras ?? {};
  if (node.translation) object.position.fromArray(node.translation);
  if (node.rotation) object.quaternion.fromArray(node.rotation);
  if (node.scale) object.scale.fromArray(node.scale);
  if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
  return object;
});
gltf.nodes.forEach((node, i) => node.children?.forEach(child => objects[i].add(objects[child])));
const model = new THREE.Group();
gltf.scenes[gltf.scene ?? 0].nodes.forEach(i => model.add(objects[i]));
const scene = new THREE.Scene(); scene.add(model);
const motion = createModuleMotion({ model, scene, amber: new THREE.Color('#efb64d'), camera: new THREE.PerspectiveCamera(), swerveAnchors: () => [] }, 'swerve');
const wheel = objects.find(o => o.userData.source_node_index === 31);
const input = objects.find(o => o.userData.web_transmission === 'steering-input');
const output = objects.find(o => o.userData.web_transmission === 'steering-output');
const motors = objects.filter(o => o.userData.web_motor_intact);
const pcb = objects.filter(o => o.userData.web_sensor === 'optical-pcb');
assert.equal(pcb.length, 22, 'original PCB assembly must be complete');
assert.ok(pcb.some(o => o.userData.source_node_index === 98), 'PCB anchor missing');
for (const key of ['slip-ring', 'optical-target']) {
  const sensor = objects.find(o => o.userData.web_sensor === key);
  assert.ok(sensor && !sensor.userData.web_structure, `missing or ghosted sensor: ${key}`);
  assert.equal(sensor.parent.userData.web_motion, 'steer', `${key} must retain its steering parent`);
}
assert.ok(pcb.every(o => o.parent === model), 'PCB must remain attached to the stationary outer assembly');
const initial = objects.map(o => ({ p: o.position.clone(), q: o.quaternion.clone() }));
const world = object => object.getWorldPosition(new THREE.Vector3());
let samples = 0;
for (let t = 0; t <= CYCLE_DURATION; t += CYCLE_DURATION / 16) {
  motion.update(t, 0);
  const assembled = objects.map(world);
  const centerDistance = world(input).distanceTo(world(output));
  const axis = new THREE.Vector3().fromArray(wheel.userData.web_axis).applyQuaternion(wheel.parent.getWorldQuaternion(new THREE.Quaternion()));
  for (const amount of [0, .16, .37, .42, .65, .9, 1]) {
    motion.update(t, amount);
    objects.forEach((object, i) => {
      const delta = world(object).sub(assembled[i]);
      if (object.userData.web_explode_group === 'drive') assert.ok(delta.clone().cross(axis).length() < 1e-7, `off wheel axis: ${object.name}`);
      if (object.userData.web_suspension || object.userData.web_sensor) assert.ok(delta.length() < 1e-9, `fixed assembly separated: ${object.name}`);
    });
    assert.ok(Math.abs(world(input).distanceTo(world(output)) - centerDistance) < 1e-7, 'steering center distance changed');
    motors.forEach(motor => {
      const expected = initial[objects.indexOf(motor)].p.clone();
      expected.addScaledVector(new THREE.Vector3().fromArray(motor.userData.web_explode), swervePartProgress(amount, motor.userData.web_explode_group));
      assert.ok(motor.position.distanceTo(expected) < 1e-10);
    });
    samples++;
  }
}
motion.update(0, 0);
objects.forEach((object, i) => {
  assert.ok(object.position.distanceTo(initial[i].p) < 1e-10, `restore position: ${object.name}`);
  assert.deepEqual(object.quaternion.toArray(), initial[i].q.toArray(), `restore rotation: ${object.name}`);
});
assert.equal(swervePartProgress(.37, 'steering'), 1);
assert.equal(swervePartProgress(.37, 'drive'), 0);
assert.equal(swervePartProgress(.9, 'drive'), 1);
assert.ok(Math.abs(swerveAngles(CYCLE_DURATION / 4, 0).steer) > .17, 'assembled steering stopped');
for (const closing of [false, true]) for (const amount of [.01, .37, .65, .99]) {
  assert.ok(Math.abs(explosionCycle(cycleAtAmount(amount, closing)).amount - amount) < 1e-6);
}
assert.equal(explosionCycle(0).amount, explosionCycle(CYCLE_DURATION).amount);
const lower = objects.find(o => o.userData.source_node_index === 48);
const driveMotor = motors.find(o => o.userData.source_node_index === 34);
const mountedDelta = driveMotor.position.clone().sub(lower.position);
for (let t = 0; t <= SWERVE_PRESENTATION_DURATION; t += .125) {
  const sample = swervePresentation(t);
  motion.update(sample.motionTime, sample.amount, sample);
  if (sample.demo) assert.ok(driveMotor.position.clone().sub(lower.position).distanceTo(mountedDelta) < 1e-9);
  for (const object of objects.filter(o => o.isMesh && o.userData.web_structure)) {
    assert.equal(object.material.opacity === 1, sample.amount === 0, 'assembly must be solid');
    assert.equal(object.material.depthWrite, true);
  }
  if (sample.demo) { assert.equal(sample.amount, 0); assert.equal(sample.orbitWeight, 1); }
  if (sample.demo && sample.suspension > .0001 && Math.abs(sample.steering) > .01) assert.equal(sample.phase, 'articulation');
}
for (const id of [42, 44]) {
  const cover = objects.find(o => o.userData.source_node_index === id);
  assert.ok(new THREE.Vector3().fromArray(cover.userData.web_explode).dot(new THREE.Vector3().fromArray(wheel.userData.web_axis)) > 0, 'cover must move away from drive motor');
}
// Project conservative CAD mesh bounds onto the wheel axis: covers must clear
// the intact motor at full expansion, not merely have the correct vector sign.
motion.update(0, 1);
const worldAxis = new THREE.Vector3().fromArray(wheel.userData.web_axis).normalize();
const axialBounds = object => {
  const node = gltf.nodes[objects.indexOf(object)];
  const values = [];
  for (const primitive of gltf.meshes[node.mesh].primitives) {
    const { min, max } = gltf.accessors[primitive.attributes.POSITION];
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      values.push(new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld).dot(worldAxis));
    }
  }
  return [Math.min(...values), Math.max(...values)];
};
const motorBounds = axialBounds(driveMotor);
const coverClearance = [42, 44].map(id => {
  const bounds = axialBounds(objects.find(o => o.userData.source_node_index === id));
  const clearance = bounds[0] - motorBounds[1];
  assert.ok(clearance > .01, `cover ${id} overlaps motor`);
  return { id, clearance };
});
console.log(JSON.stringify({ samples, wheelAxis: 'pass', suspensionPairs: 'pass', intactMotors: motors.length,
  steeringPair: 'pass', exactRestore: 'pass', reverseAndResume: 'pass', auditHash: 'pass', pcbComponents: pcb.length, sensorAssembly: 'pass',
  presentationSamples: 185, solidOnAssembly: 'pass', suspensionMounts: 'pass', coverClearance }, null, 2));

assert.equal(CYCLE_DURATION, 23);
for (const round of [0, 23, 46]) {
  for (const [time, phase] of [[0, 'articulation'], [7.9, 'articulation'], [8, 'opening'], [14, 'exploded'], [17, 'closing']]) {
    const sample = swervePresentation(round + time);
    assert.equal(sample.phase, phase);
    assert.equal(sample.orbitWeight, 1);
  }
  let rest = 0, maxSpeed = 0, previous = swervePresentation(round);
  for (let t = .002; t < 8; t += .002) {
    const sample = swervePresentation(round + t);
    assert.ok(sample.suspension >= 0 && sample.suspension <= .01001, 'bounded rail travel');
    assert.ok(Math.abs(sample.suspension - previous.suspension) < .0006, 'continuous impact response');
    if (sample.suspension === 0) rest += .002;
    maxSpeed = Math.max(maxSpeed, Math.abs(sample.steering - previous.steering) / .002);
    previous = sample;
  }
  assert.ok(rest > 3, 'visible suspension rest gaps');
  assert.ok(maxSpeed > 3 && maxSpeed < 6, 'responsive but eased steering');
  assert.equal(swervePresentation(round + 7.9).suspension, 0);
  assert.ok(Math.abs(swervePresentation(round + 7.9).steering) < 1e-12);
}
assert.notDeepEqual([.7, .8, .9, 1].map(t => swervePresentation(t).suspension), [.7, .8, .9, 1].map(t => swervePresentation(t + 23).suspension), 'vary road events between rounds');
assert.ok(swervePresentation(2).roll > 1, 'wheel rolls during assembled driving');
assert.ok(Math.abs(swervePresentation(7.9).roll - Math.PI * 2) < 1e-9, 'wheel returns to the same orientation before explosion');
const mount = objects.find(o => o.userData.source_node_index === 43);
assert.deepEqual(mount.userData.web_explode, driveMotor.userData.web_explode, 'motor and mount stay together');
console.log('23-second irregular suspension and responsive steering checks passed');
