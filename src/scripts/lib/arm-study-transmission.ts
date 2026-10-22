import * as THREE from 'three';
import {aboutAxis, type SevenAngles} from './arm-study-motion';
import {setStudyOpacity} from './arm-study-renderer';

type Vec = [number, number, number];
export type WristTransmissionData = {
  schema: number;
  rotors: {source: number; key: string; channel: string; ratio: number; point: Vec; axis: Vec; teeth?: number}[];
  belt: {key: string; teeth: number; advanceSign: number; prototypes: {positions: Vec[]; normals: Vec[]; indices: number[]}[]; stations: {source: number; prototype: number; matrix: number[]; center: Vec}[]};
};

/** The link_wheel and link_5 output rotations already exist in the arm FK.
 * These are only the missing upstream rigid shafts, gears and input pulley.
 */
export function wristPartMotion(data: WristTransmissionData, key: string, q: SevenAngles) {
  const rotor = data.rotors.find(item => item.key === key);
  if (!rotor) return null;
  const angle = rotor.channel === 'pitch' ? q[5] : q[5] - q[6];
  return aboutAxis(rotor.point, rotor.axis, rotor.ratio * angle);
}

export function createArmStudyTransmission(data: WristTransmissionData, scene: THREE.Scene, sourceMaterial: THREE.MeshStandardMaterial) {
  if (data.schema !== 1) throw new Error('Wrist transmission data version mismatch');
  const stations = data.belt.stations.map(item => {
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    new THREE.Matrix4().fromArray(item.matrix).decompose(position, rotation, scale);
    return {...item, position, rotation, scale};
  });
  const geometries = data.belt.prototypes.map(item => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(item.positions.flat(), 3));
    geometry.setIndex(item.indices);
    if (item.normals.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(item.normals.flat(), 3));
    else geometry.computeVertexNormals();
    return geometry;
  });
  const batches = geometries.map((geometry, prototype) => {
    const indices = stations.flatMap((item, index) => item.prototype === prototype ? [index] : []);
    const mesh = new THREE.InstancedMesh(geometry, sourceMaterial.clone(), indices.length);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return {mesh, indices};
  });
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), rotation = new THREE.Quaternion();
  return {
    beltKey: data.belt.key,
    partMotion: (key: string, q: SevenAngles) => wristPartMotion(data, key, q),
    update(q: SevenAngles, host: {matrix: THREE.Matrix4; opacity: number; background: boolean}) {
      // The 21T open belt has equal input/output angular speed. The CAD station
      // order has positive winding around the original common pulley axis.
      const shift = data.belt.advanceSign * q[5] * data.belt.teeth / 360;
      const count = stations.length;
      for (const {mesh, indices} of batches) {
        mesh.visible = host.opacity > .005;
        mesh.layers.set(host.background ? 1 : 0);
        setStudyOpacity(mesh.material, host.opacity, host.background);
        indices.forEach((index, instance) => {
          const f = THREE.MathUtils.euclideanModulo(index + shift, count), a = Math.floor(f), b = (a + 1) % count, u = f - a;
          position.lerpVectors(stations[a].position, stations[b].position, u);
          rotation.slerpQuaternions(stations[a].rotation, stations[b].rotation, u);
          matrix.compose(position, rotation, stations[a].scale).premultiply(host.matrix);
          mesh.setMatrixAt(instance, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      for (const {mesh} of batches) {scene.remove(mesh); mesh.material.dispose();}
      for (const geometry of geometries) geometry.dispose();
    },
  };
}

/** Depth is the dependency stage, so the two 40T branches start together. */
export const WRIST_POWER_GRAPH = [
  {from: 512, to: 507, depth: 0},
  {from: 507, to: 505, depth: 1},
  {from: 505, to: 762, depth: 2},
  {from: 762, to: 500, depth: 3}, {from: 762, to: 696, depth: 3},
  {from: 500, to: 593, depth: 4}, {from: 696, to: 684, depth: 4},
  {from: 593, to: 508, depth: 5}, {from: 684, to: 682, depth: 5},
  {from: 593, to: 678, depth: 5}, {from: 678, to: 679, depth: 6},
  {from: 679, to: 592, depth: 7}, {from: 592, to: 757, depth: 8},
] as const;

export function wristPowerTrace(progress: number, at: (source: number) => THREE.Vector3) {
  const u = THREE.MathUtils.clamp(progress, 0, 1), stage = u * 9;
  const edges: THREE.Vector3[][] = [], frontier: THREE.Vector3[] = [];
  for (const edge of WRIST_POWER_GRAPH) {
    const amount = THREE.MathUtils.clamp(stage - edge.depth, 0, 1);
    if (amount <= 0) continue;
    const a = at(edge.from), end = a.clone().lerp(at(edge.to), amount);
    edges.push([a, end]);
    if (amount < 1) frontier.push(end);
  }
  if (u === 1) frontier.push(...[508, 682, 757].map(at));
  return {edges, frontier, stage};
}
