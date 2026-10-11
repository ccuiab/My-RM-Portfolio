// Solid CAD pose demonstration with a fixed camera frame across the complete pose sweep.
// public/models/arm.glb (asset pipeline, see output/codex/report.md):
//   link_base > link_1 > link_2 > link_3 > link_4 > { link_5 > link_6, link_wheel }
//   every link origin sits on its joint axis; extras.web_axis is the local axis;
//   identity quaternions = the CAD export pose. Metres, +Y up, the arm reaches toward +Z.
import * as THREE from 'three';
import { loadScanStage } from './scan-scene';

const deg = THREE.MathUtils.degToRad;

export type JointName = 'J1' | 'J2' | 'J3' | 'J4' | 'J5' | 'J6';
/** Joint angles in degrees, relative to the CAD export pose. */
export type Pose = Partial<Record<JointName, number>>;

export type Marks = {
  /** screen-space points in CSS px, relative to the canvas */
  shoulder: THREE.Vector2;
  elbow: THREE.Vector2;
  wrist: THREE.Vector2;
  /** wrist centre from the shoulder axis, mm: forward (+Z) and up (+Y) */
  reachMm: number;
  heightMm: number;
};

export type ArmScene = {
  setPose: (p: Pose) => void;
  render: () => Marks;
  onResize: (cb: () => void) => void;
  onInteraction: (cb: () => void) => void;
  resetView: () => void;
};

export async function loadArmScene(canvas: HTMLCanvasElement, base: string): Promise<ArmScene> {
  // Reuse stage loading, lighting and orbit controls with solid materials throughout.
  const stage = await loadScanStage(canvas, base, 'arm.glb', { axis: new THREE.Vector3(0, 0, 1), range: [0.95, -0.6], solidOnly: true });
  const { model, turntable, camera } = stage;

  const node = (n: string) => {
    const o = model.getObjectByName(n);
    if (!o) throw new Error(`arm.glb is missing ${n}`);
    return o;
  };
  const shoulderNode = node('link_2'), elbowNode = node('link_3'), wristNode = node('link_5');

  // shoulder axis at the world origin
  model.updateMatrixWorld(true);
  model.position.sub(shoulderNode.getWorldPosition(new THREE.Vector3()));

  const joints: { node: THREE.Object3D; axis: THREE.Vector3; name: string }[] = [];
  model.traverse((o) => {
    const ud = o.userData as { joint_name?: string; web_axis?: number[] };
    if (ud.joint_name && ud.web_axis && /^J[1-6]$/.test(ud.joint_name)) {
      joints.push({ node: o, axis: new THREE.Vector3(...(ud.web_axis as [number, number, number])).normalize(), name: ud.joint_name });
    }
  });

  const q = new THREE.Quaternion();
  const applyPose = (p: Pose) => {
    for (const j of joints) j.node.quaternion.copy(q.setFromAxisAngle(j.axis, deg(p[j.name as JointName] ?? 0)));
    model.updateMatrixWorld(true);
  };
  // Union sampled mesh bounds before framing: one fixed target and radius, including
  // folded hardware and all intermediate poses. This is a display sweep, not workspace analysis.
  const swept = new THREE.Box3();
  for (let i = 0; i <= 40; i++) {
    const p = i / 40;
    applyPose({ J2: 110 * p, J3: -130 * p, J5: 40 * p });
    swept.union(new THREE.Box3().setFromObject(model, true));
  }
  applyPose({});
  const sphere = swept.getBoundingSphere(new THREE.Sphere());
  // The swept box is fitted in projection, avoiding sphere-sized empty margins.
  stage.frame(sphere, new THREE.Vector3(-1, 0.28, 0.42), swept);

  const v = new THREE.Vector3();
  const sh = new THREE.Vector3(), el = new THREE.Vector3(), wr = new THREE.Vector3();
  const toScreen = (p: THREE.Vector3) => {
    v.copy(p).project(camera);
    return new THREE.Vector2((v.x * 0.5 + 0.5) * canvas.clientWidth, (-v.y * 0.5 + 0.5) * canvas.clientHeight);
  };

  stage.enableInteraction();

  return {
    setPose(p) {
      applyPose(p);
    },
    onResize: stage.onResize,
    onInteraction: stage.enableInteraction,
    resetView: stage.resetView,
    render() {
      stage.render();
      shoulderNode.getWorldPosition(sh);
      elbowNode.getWorldPosition(el);
      wristNode.getWorldPosition(wr);
      const local = turntable.worldToLocal(wr.clone());
      return {
        shoulder: toScreen(sh),
        elbow: toScreen(el),
        wrist: toScreen(wr),
        reachMm: local.z * 1000,
        heightMm: local.y * 1000,
      };
    },
  };
}
