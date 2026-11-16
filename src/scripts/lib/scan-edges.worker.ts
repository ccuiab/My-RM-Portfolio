import { BufferAttribute, BufferGeometry, EdgesGeometry, Float32BufferAttribute } from 'three';

export type EdgeInput = { positions: Float32Array; indices?: Uint32Array };

// Use the same Three.js edge algorithm and 35-degree threshold as the viewer.
// Only copied attributes cross the worker boundary; the model stays on the main thread.
self.onmessage = (event: MessageEvent<EdgeInput[]>) => {
  try {
    const result = event.data.map(({ positions, indices }) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      if (indices) geometry.setIndex(new BufferAttribute(indices, 1));
      const edges = new EdgesGeometry(geometry, 35);
      const array = edges.getAttribute('position').array as Float32Array;
      geometry.dispose(); edges.dispose();
      return array;
    });
    self.postMessage({ result }, { transfer: result.map(array => array.buffer) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
