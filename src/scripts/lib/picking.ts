import type { Mesh } from 'three';
import { acceleratedRaycast, type SerializedBVH } from 'three-mesh-bvh';
import { attachPickingTree, copyPickingGeometry } from './picking-geometry';

/** Called on first hover only. Copy buffers so the live model can keep rendering. */
export async function acceleratePicking(meshes: Mesh[], signal: AbortSignal) {
  signal.throwIfAborted();
  const geometries = [...new Set(meshes.map(mesh => mesh.geometry))].filter(geometry =>
    (geometry.index?.count ?? geometry.getAttribute('position').count) > 768);
  if (!geometries.length) return;
  const trees = await new Promise<SerializedBVH[]>((resolve, reject) => {
    const worker = new Worker(new URL('./picking.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { finish(); reject(signal.reason); };
    worker.onmessage = ({ data }: MessageEvent<{ trees: SerializedBVH[]; error?: string }>) => {
      finish(); if (data.error) reject(new Error(data.error)); else resolve(data.trees);
    };
    worker.onerror = event => { finish(); reject(new Error(event.message)); };
    worker.onmessageerror = () => { finish(); reject(new Error('Invalid picking worker response')); };
    signal.addEventListener('abort', abort, { once: true });
    try {
      const inputs = geometries.map(copyPickingGeometry);
      worker.postMessage(inputs, inputs.flatMap(input => input.indices ? [input.positions.buffer, input.indices.buffer] : [input.positions.buffer]));
    } catch (error) { finish(); reject(error); }
  });
  signal.throwIfAborted();
  geometries.forEach((geometry, i) => attachPickingTree(geometry, trees[i]));
  meshes.forEach(mesh => { if (mesh.geometry.boundsTree) mesh.raycast = acceleratedRaycast; });
}
