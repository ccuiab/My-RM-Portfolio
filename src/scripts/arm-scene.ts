// Arm unfold scene on top of the shared scan stage.
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
  setScan: (s: number) => void;
  setYaw: (d: number) => void;
  render: () => Marks;
};

export async function loadArmScene(canvas: HTMLCanvasElement, base: string): Promise<ArmScene> {
  // scan: solid appears at the wrist end (+Z) first and sweeps back toward the base
  const stage = await loadScanStage(canvas, base, 'arm.glb', { axis: new THREE.Vector3(0, 0, 1), range: [0.95, -0.6] });
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

  // side three-quarter view, framed on the reach envelope around the shoulder
  stage.frame(new THREE.Sphere(new THREE.Vector3(0, 0.12, 0.28), 0.62), new THREE.Vector3(-1, 0.3, 0.5));

  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sh = new THREE.Vector3(), el = new THREE.Vector3(), wr = new THREE.Vector3();
  const toScreen = (p: THREE.Vector3) => {
    v.copy(p).project(camera);
    return new THREE.Vector2((v.x * 0.5 + 0.5) * canvas.clientWidth, (-v.y * 0.5 + 0.5) * canvas.clientHeight);
  };

  return {
    setPose(p) {
      for (const j of joints) j.node.quaternion.copy(q.setFromAxisAngle(j.axis, deg(p[j.name as JointName] ?? 0)));
    },
    setScan: stage.setScan,
    setYaw(d) {
      turntable.rotation.y = deg(d);
    },
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
