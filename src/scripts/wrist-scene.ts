// Complete L4 and distal wrist exploded view on the shared stage.
// public/models/l4.glb: groups `ex_<key>`, origin at the J5/J6 axis intersection.
// public/models/l4.json: per-group explode_dir / explode_dist_m / order / callout_anchor.
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
  onInteraction: (cb: () => void) => void;
  resetView: () => void;
};

export async function loadWristScene(canvas: HTMLCanvasElement, base: string): Promise<WristScene> {
  const meta: WristMeta = await fetch(`${base}models/l4.json`).then((r) => { if (!r.ok) throw new Error('L4 metadata unavailable'); return r.json(); });
  // no scan for this one: keep everything solid (range puts the plane far behind)
  const stage = await loadScanStage(canvas, base, 'l4.glb', { axis: new THREE.Vector3(0, 0, 1), range: [-5, -5], solidOnly: true });
  stage.setScan(1);
  const { model, turntable, camera } = stage;

  const nodes = meta.groups.map((g) => {
    const node = model.getObjectByName(`ex_${g.key}`);
    if (!node) throw new Error(`l4.glb is missing ex_${g.key}`);
    return { g, node, rest: node.position.clone(), dir: new THREE.Vector3(...g.explode_dir).normalize(), anchor: new THREE.Vector3(...g.callout_anchor) };
  });

  // centre the exploded envelope in view; arm runs along -Z from the wrist
  model.position.set(0, -0.02, 0.09);
  // Every group's path is a straight segment between rest and full explosion.
  // The union of both endpoint bounds contains every intermediate assembly pose,
  // and framing its sphere keeps all parts visible from any orbit direction.
  const envelope = new THREE.Box3().setFromObject(model);
  for (const n of nodes) n.node.position.copy(n.rest).addScaledVector(n.dir, n.g.explode_dist_m);
  envelope.union(new THREE.Box3().setFromObject(model));
  for (const n of nodes) n.node.position.copy(n.rest);
  // Centre the model on the union sphere so story yaw rotates it around the
  // same pivot as the camera. All group anchors follow the model transform.
  const sphere = envelope.getBoundingSphere(new THREE.Sphere());
  model.position.sub(sphere.center);
  sphere.center.set(0, 0, 0);
  sphere.radius *= 1.04;
  stage.frame(sphere, new THREE.Vector3(1, 0.55, 0.85));

  const { stagger_fraction: sf, max_order: mo } = meta.animation;
  const v = new THREE.Vector3();
  const ndc = new THREE.Vector3();

  stage.enableInteraction();

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
    onInteraction: stage.enableInteraction,
    resetView: stage.resetView,
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
