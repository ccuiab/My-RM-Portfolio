import type { BufferGeometry } from 'three';
import type { EdgeInput } from './scan-edges.worker';

export function buildScanEdges(geometries: BufferGeometry[], signal: AbortSignal): Promise<Float32Array[]> {
  signal.throwIfAborted();
  if (!geometries.length) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./scan-edges.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { finish(); reject(signal.reason); };
    worker.onmessage = ({ data }: MessageEvent<{ result: Float32Array[]; error?: string }>) => {
      finish();
      if (data.error) reject(new Error(data.error)); else resolve(data.result);
    };
    worker.onerror = event => { finish(); reject(new Error(event.message)); };
    worker.onmessageerror = () => { finish(); reject(new Error('Invalid edge worker response')); };
    signal.addEventListener('abort', abort, { once: true });
    try {
      const inputs: EdgeInput[] = geometries.map(geometry => {
        const position = geometry.getAttribute('position'), index = geometry.getIndex();
        const positions = new Float32Array(position.count * 3);
        for (let i = 0; i < position.count; i++) {
          positions[i * 3] = position.getX(i); positions[i * 3 + 1] = position.getY(i); positions[i * 3 + 2] = position.getZ(i);
        }
        return { positions, indices: index ? Uint32Array.from(index.array) : undefined };
      });
      const transfers = inputs.flatMap(({ positions, indices }) => indices ? [positions.buffer, indices.buffer] : [positions.buffer]);
      worker.postMessage(inputs, transfers);
    } catch (error) { finish(); reject(error); }
  });
}
