/** Geometry checks on the delivered GLBs, independent of the authoring scene. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

globalThis.self = globalThis;
const directory = resolve('materials/models/derived/rm2025-field');
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
const loader = new GLTFLoader();
const scenes = new Map();
const measurements = [];
for (const asset of manifest.assets) {
  const bytes = await readFile(resolve(directory, asset.file));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0, meshes = 0;
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.side = THREE.DoubleSide;
  });
  const box = new THREE.Box3().setFromObject(gltf.scene, true);
  const size = box.getSize(new THREE.Vector3());
  measurements.push({ id: asset.id, bytes: bytes.length, triangles, meshes, dimensions_mm: size.toArray().map(value => +(value * 1000).toFixed(4)), bounds_m: [box.min.toArray(), box.max.toArray()] });
  scenes.set(asset.id, gltf.scene);
}
const slot = scenes.get('exchange-slot');
const ray = new THREE.Raycaster();
ray.near = 0; ray.far = .045;
function frameAt(x, y) {
  ray.set(new THREE.Vector3(x, y, .03), new THREE.Vector3(0, 0, -1));
  return ray.intersectObject(slot, true).length > 0;
}
function boundary(axis, sign) {
  let low = 0, high = .1445;
  for (let i = 0; i < 28; i++) {
    const mid = (low + high) / 2;
    const hit = frameAt(axis === 0 ? mid * sign : 0, axis === 1 ? mid * sign : 0);
    if (hit) high = mid; else low = mid;
  }
  return (low + high) / 2 * sign;
}
const aperture = { left: boundary(0, -1), right: boundary(0, 1), bottom: boundary(1, -1), top: boundary(1, 1) };
const apertureMm = { width: +(1000 * (aperture.right - aperture.left)).toFixed(4), height: +(1000 * (aperture.top - aperture.bottom)).toFixed(4) };

// Exact triangle/AABB separating-axis test. A 0.3 mm tolerance distinguishes
// contact/print relief from penetration in the nominal 200 mm ore envelope.
const triangles = [];
slot.traverse(object => {
  if (!object.isMesh) return;
  const geometry = object.geometry, positions = geometry.attributes.position, index = geometry.index;
  const count = index?.count ?? positions.count;
  for (let i = 0; i < count; i += 3) {
    const points = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j).applyMatrix4(object.matrixWorld).toArray());
    triangles.push({ points, cad_node_id: object.userData.cad_node_id });
  }
});
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const half = [.0999, .0999, .0999];
function triangleOverlaps(points, center) {
  const p = points.map(v => subtract(v, center));
  for (let k = 0; k < 3; k++) if (Math.min(...p.map(v => v[k])) > half[k] || Math.max(...p.map(v => v[k])) < -half[k]) return false;
  const edges = [subtract(p[1], p[0]), subtract(p[2], p[1]), subtract(p[0], p[2])];
  const axes = [cross(edges[0], edges[1])];
  for (const edge of edges) for (const unit of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) axes.push(cross(edge, unit));
  for (const axis of axes) {
    const range = p.map(v => dot(v, axis)), radius = half.reduce((sum, h, i) => sum + h * Math.abs(axis[i]), 0);
    if (Math.min(...range) > radius || Math.max(...range) < -radius) return false;
  }
  return true;
}
const collisions = [];
for (let i = 0; i <= 50; i++) {
  const progress = i / 50, settle = THREE.MathUtils.smoothstep(progress, .85, 1);
  const center = [0, -.0199 * settle, THREE.MathUtils.lerp(.4, -.106, progress)];
  const hits = triangles.filter(triangle => triangleOverlaps(triangle.points, center));
  if (hits.length) collisions.push({ progress, triangles: hits.length, cad_node_ids: [...new Set(hits.map(hit => hit.cad_node_id))] });
}
const presets = [
  { x: -220, y: 0, z: 760, theta: 0, phi: 60, alpha: 0 },
  { x: -220, y: 0, z: 760, theta: 0, phi: 60, alpha: 30 },
  { x: -220, y: 40, z: 760, theta: 70, phi: 60, alpha: 30 },
  { x: -220, y: 0, z: 750, theta: -95, phi: 45, alpha: -35 },
];
const poseChecks = presets.map(pose => {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(pose.theta));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(pose.phi - 90)));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(pose.alpha)));
  const clone = slot.clone(true); clone.position.set(pose.y / 1000, pose.z / 1000, pose.x / 1000); clone.quaternion.copy(q); clone.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(clone, true);
  return { ...pose, sphere_valid: pose.x ** 2 + pose.y ** 2 + (pose.z - 600) ** 2 <= 90000, front_plane_clearance_mm: +(-b.max.z * 1000).toFixed(4) };
});
const crossing = scenes.get('highland-crossing');
ray.far = 3;
const crossingProfile = [.5, .3, .15, 0, -.15, -.3, -.5, -.8, -1].map(z => {
  ray.set(new THREE.Vector3(0, 2, z), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObject(crossing, true);
  return { z_m: z, height_mm: hits.length ? +(hits[0].point.y * 1000).toFixed(4) : null };
});
const report = { measurements, aperture_mm: apertureMm, insertion: { samples: 51, nominal_ore_mm: 200, tolerance_mm: .3, conservative_box_half_mm: half.map(v => v * 1000), collisions }, pose_checks: poseChecks, crossing_profile: crossingProfile };
await writeFile(resolve('materials/documents/derived/audits/rm2025-field/geometry-verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (Math.abs(apertureMm.width - 240) > 1 || Math.abs(apertureMm.height - 240) > 1 || collisions.length || poseChecks.some(p => !p.sphere_valid || p.front_plane_clearance_mm < -.1)) process.exitCode = 1;
