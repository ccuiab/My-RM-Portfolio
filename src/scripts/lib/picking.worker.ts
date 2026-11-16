import { buildPickingTree, type PickingGeometry } from './picking-geometry';

self.onmessage = ({ data }: MessageEvent<PickingGeometry[]>) => {
  try {
    const trees = data.map(buildPickingTree);
    const transfers = trees.flatMap(tree => [...tree.roots, tree.index?.buffer, tree.indirectBuffer?.buffer].filter(Boolean)) as ArrayBuffer[];
    self.postMessage({ trees }, { transfer: transfers });
  } catch (error) { self.postMessage({ error: String(error) }); }
};
