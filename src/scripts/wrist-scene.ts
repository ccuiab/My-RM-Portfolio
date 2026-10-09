// Wrist exploded view on top of the shared scan stage.
// public/models/wrist.glb: groups `ex_<key>`, origin at the J5/J6 axis intersection.
// public/models/wrist.json: per-group explode_dir / explode_dist_m / order / callout_anchor.
import * as THREE from 'three';
import { loadScanStage } from './scan-scene';

export type WristGroup = {
  key: string;
  label_zh: string;
  label_en: string;
  explode_dir: [number, number, number];
  explode_dist_m: number;
  order: number;
  callout_anchor: [number, number, number];
};
type WristMeta = {
  groups: WristGroup[];
  animation: { stagger_fraction: number; max_order: number };
};

export type Callout = { key: string; x: number; y: number; visible: boolean };

export type WristScene = {
  groups: WristGroup[];
  /** 0 = assembled, 1 = fully exploded */
  setExplode: (t: number) => void;
  setYaw: (deg: number) => void;
  render: () => Callout[];
  onResize: (cb: () => void) => void;
};

export async function loadWristScene(canvas: HTMLCanvasElement, base: string): Promise<WristScene> {
  const meta: WristMeta = await fetch(`${base}models/wrist.json`).then((r) => r.json());
  // no scan for this one: keep everything solid (range puts the plane far behind)
  const stage = await loadScanStage(canvas, base, 'wrist.glb', { axis: new THREE.Vector3(0, 0, 1), range: [-5, -5] });
  stage.setScan(1);
  const { model, turntable, camera } = stage;

  const nodes = meta.groups.map((g) => {
    const node = model.getObjectByName(`ex_${g.key}`);
    if (!node) throw new Error(`wrist.glb is missing ex_${g.key}`);
    return { g, node, rest: node.position.clone(), dir: new THREE.Vector3(...g.explode_dir).normalize(), anchor: new THREE.Vector3(...g.callout_anchor) };
  });

  // centre the exploded envelope in view; arm runs along -Z from the wrist
  model.position.set(0, -0.02, 0.09);
  stage.frame(new THREE.Sphere(new THREE.Vector3(-0.03, 0.01, 0), 0.26), new THREE.Vector3(1, 0.55, 0.85));

  const { stagger_fraction: sf, max_order: mo } = meta.animation;
  const v = new THREE.Vector3();
  const ndc = new THREE.Vector3();

  return {
    groups: meta.groups,
    setExplode(t) {
      for (const n of nodes) {
        const p = THREE.MathUtils.clamp((t - sf * n.g.order) / (1 - sf * mo), 0, 1);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // easeInOutCubic
        n.node.position.copy(n.rest).addScaledVector(n.dir, e * n.g.explode_dist_m);
      }
    },
    setYaw(deg) {
      turntable.rotation.y = THREE.MathUtils.degToRad(deg);
    },
    onResize: stage.onResize,
    render() {
      stage.render();
      const w = canvas.clientWidth, h = canvas.clientHeight;
      return nodes.map((n) => {
        // anchor is in the group's rest frame; follow the group as it moves
        n.node.parent!.localToWorld(v.copy(n.anchor).add(n.node.position).sub(n.rest));
        ndc.copy(v).project(camera);
        return { key: n.g.key, x: (ndc.x * 0.5 + 0.5) * w, y: (-ndc.y * 0.5 + 0.5) * h, visible: ndc.z < 1 };
      });
    },
  };
}
