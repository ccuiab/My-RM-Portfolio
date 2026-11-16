import { BufferAttribute, BufferGeometry } from 'three';
import { MeshBVH, type SerializedBVH } from 'three-mesh-bvh';

export type PickingGeometry = {
  positions: Float32Array;
  indices?: Uint32Array;
  groups: BufferGeometry['groups'];
  drawRange: { start: number; count: number };
};

export function copyPickingGeometry(geometry: BufferGeometry): PickingGeometry {
  const position = geometry.getAttribute('position'), index = geometry.getIndex();
  const positions = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    positions[i * 3] = position.getX(i); positions[i * 3 + 1] = position.getY(i); positions[i * 3 + 2] = position.getZ(i);
  }
  return { positions, indices: index ? Uint32Array.from(index.array) : undefined,
    groups: geometry.groups.map(group => ({ ...group })), drawRange: { ...geometry.drawRange } };
}

/** Indirect trees keep CAD triangle order and material groups unchanged. */
export function buildPickingTree(input: PickingGeometry): SerializedBVH {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(input.positions, 3));
  if (input.indices) geometry.setIndex(new BufferAttribute(input.indices, 1));
  geometry.groups = input.groups;
  geometry.setDrawRange(input.drawRange.start, input.drawRange.count);
  const tree = new MeshBVH(geometry, { indirect: true });
  const serialized = MeshBVH.serialize(tree, { cloneBuffers: false });
  geometry.dispose();
  return serialized;
}

export function attachPickingTree(geometry: BufferGeometry, serialized: SerializedBVH) {
  geometry.boundsTree = MeshBVH.deserialize(serialized, geometry, { setIndex: false });
}
