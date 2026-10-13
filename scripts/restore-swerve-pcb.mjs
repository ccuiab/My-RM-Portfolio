// Restore the original PCB assembly from the derived CAD GLB, preserving all
// existing compressed mesh bytes and deriving placement from shared CAD nodes.
import { openSync, readSync, closeSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';

const sourcePath = 'materials/models/derived/inputs/codex/engineer_tagged.glb';
const outputPath = 'materials/models/derived/web/engineer-swerve.glb';
const readRange = (fd, start, length) => {
  const buffer = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const count = readSync(fd, buffer, read, length - read, start + read);
    if (!count) throw new Error('Unexpected end of GLB');
    read += count;
  }
  return buffer;
};
const matrices = document => {
  const result = new Map();
  const visit = (index, parent) => {
    const n = document.nodes[index];
    const local = n.matrix ? new THREE.Matrix4().fromArray(n.matrix) : new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(n.translation ?? [0, 0, 0]),
      new THREE.Quaternion().fromArray(n.rotation ?? [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(n.scale ?? [1, 1, 1]));
    const world = parent.clone().multiply(local); result.set(index, world);
    n.children?.forEach(child => visit(child, world));
  };
  document.scenes[document.scene ?? 0].nodes.forEach(index => visit(index, new THREE.Matrix4()));
  return result;
};
const fd = openSync(sourcePath, 'r');
try {
  const sourceHeader = readRange(fd, 0, 20), jsonLength = sourceHeader.readUInt32LE(12);
  const source = JSON.parse(readRange(fd, 20, jsonLength));
  const original = readFileSync(outputPath), oldJsonLength = original.readUInt32LE(12);
  const target = JSON.parse(original.subarray(20, 20 + oldJsonLength));
  const selected = [];
  const visit = index => { selected.push(index); source.nodes[index].children?.forEach(visit); };
  visit(64);
  const meshNodes = selected.filter(i => source.nodes[i].mesh !== undefined);
  const existing = new Set(target.nodes.map(n => n.extras?.source_node_index));
  const already = meshNodes.filter(i => existing.has(i));
  if (already.length) {
    if (already.length !== meshNodes.length) throw new Error('Partial PCB restoration; inspect before proceeding');
    console.log('PCB assembly already present; no geometry rewritten.');
  } else {
    const from = matrices(source), to = matrices(target);
    const find = index => target.nodes.findIndex(n => n.name === `engineer_${String(index).padStart(5, '0')}`);
    const alignment = to.get(find(63)).clone().multiply(from.get(63).clone().invert());
    let maxError = 0;
    for (const index of [24, 25, 31, 34, 35, 56, 57, 58, 59, 61, 62, 63]) {
      const expected = alignment.clone().multiply(from.get(index));
      const actual = to.get(find(index));
      maxError = Math.max(maxError, ...actual.elements.map((v, i) => Math.abs(v - expected.elements[i])));
    }
    if (maxError > 1e-5) throw new Error(`CAD frame mismatch: ${maxError}`);
    const originalBin = original.subarray(28 + oldJsonLength);
    const chunks = [originalBin]; let size = originalBin.length;
    const views = new Map(), accessors = new Map();
    const view = index => {
      if (!views.has(index)) {
        const old = source.bufferViews[index];
        if (old.buffer !== 0) throw new Error('External source buffer is unsupported');
        const padding = (-size) & 3;
        if (padding) { chunks.push(Buffer.alloc(padding)); size += padding; }
        const bytes = readRange(fd, 28 + jsonLength + (old.byteOffset ?? 0), old.byteLength);
        const next = target.bufferViews.length;
        target.bufferViews.push({ ...old, buffer: 0, byteOffset: size });
        chunks.push(bytes); size += bytes.length; views.set(index, next);
      }
      return views.get(index);
    };
    const accessor = index => {
      if (!accessors.has(index)) {
        const old = source.accessors[index];
        if (old.sparse || old.bufferView === undefined) throw new Error('Unexpected sparse source accessor');
        const next = target.accessors.length;
        target.accessors.push({ ...old, bufferView: view(old.bufferView) }); accessors.set(index, next);
      }
      return accessors.get(index);
    };
    const boardMaterial = target.materials.length;
    target.materials.push({ name: 'pcb_carbon_blue', pbrMetallicRoughness: { baseColorFactor: [.035, .065, .09, 1], metallicFactor: .05, roughnessFactor: .55 } });
    const componentMaterial = target.materials.findIndex(m => m.name === 'alu_silver');
    if (componentMaterial < 0) throw new Error('Missing existing component material');
    for (const index of meshNodes) {
      const node = source.nodes[index], mesh = structuredClone(source.meshes[node.mesh]);
      for (const primitive of mesh.primitives) {
        if (primitive.extensions) throw new Error('Unexpected source mesh extension');
        primitive.attributes = Object.fromEntries(Object.entries(primitive.attributes).map(([key, value]) => [key, accessor(value)]));
        if (primitive.indices !== undefined) primitive.indices = accessor(primitive.indices);
        primitive.material = index === 98 ? boardMaterial : componentMaterial;
      }
      const meshIndex = target.meshes.length; target.meshes.push(mesh);
      const nodeIndex = target.nodes.length;
      const pose = alignment.clone().multiply(from.get(index));
      const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
      pose.decompose(position, quaternion, scale);
      target.nodes.push({ name: node.name, mesh: meshIndex,
        translation: position.toArray(), rotation: quaternion.toArray(), scale: scale.toArray(),
        extras: { ...node.extras, web_sensor: 'optical-pcb', web_structure: false,
          web_explode: [0, 0, 0], web_explode_group: 'fixed', web_guide: false, web_motor_intact: false } });
      target.scenes[target.scene ?? 0].nodes.push(nodeIndex);
    }
    const padding = (-size) & 3; if (padding) { chunks.push(Buffer.alloc(padding)); size += padding; }
    const binary = Buffer.concat(chunks);
    if (!binary.subarray(0, originalBin.length).equals(originalBin)) throw new Error('Existing geometry changed');
    target.buffers[0].byteLength = binary.length;
    let json = Buffer.from(JSON.stringify(target)); json = Buffer.concat([json, Buffer.alloc((-json.length) & 3, 32)]);
    const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
    const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
    writeFileSync(outputPath, Buffer.concat([header, json, binHeader, binary]));
    mkdirSync('materials/documents/derived/audits', { recursive: true });
    const receipt = { source: sourcePath, subtree: 64, addedMeshNodes: meshNodes, alignment: alignment.toArray(), maxReferenceMatrixError: maxError,
      unchangedExistingMeshBytes: originalBin.length, priorMeshSha256: createHash('sha256').update(originalBin).digest('hex'),
      newPcbMeshBytes: binary.length - originalBin.length, note: 'PCB assembly identity and CNC optical-detection use supplied by user; no individual sensor package or homing angle inferred.' };
    writeFileSync('materials/documents/derived/audits/swerve-pcb-restoration.json', JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt, null, 2));
  }
} finally { closeSync(fd); }
