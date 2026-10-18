import * as THREE from 'three';

export type SwervePlacement = { source_root: number; matrix: number[]; rest_steer: number; common_steer: number;
  steer_origin: number[]; roll_axis: number[]; part_matrices: Record<string, number[]> };

/** Share the mesh, never assume that equal CAD names imply equal part placement. */
export function placeSwerveModule(model: THREE.Group, spec: SwervePlacement) {
  let steering: THREE.Object3D | undefined;
  model.traverse(object => { if (object.userData.web_motion === 'steer') steering = object; });
  if (!steering) throw new Error('Missing swerve steering parent');
  steering.position.fromArray(spec.steer_origin); steering.quaternion.identity();
  model.updateMatrixWorld(true);
  model.traverse(object => {
    // GLTFLoader represents a multi-material CAD part as a Group with mesh
    // children. Source metadata and the assembly transform belong to the Group.
    if (object.userData.source_node_index === undefined && object.userData.web_instance !== 'steering-pinion') return;
    const key = object.userData.web_instance === 'steering-pinion' ? 'pinion' : String(object.userData.source_node_index);
    const values = spec.part_matrices[key];
    if (!values) throw new Error(`Missing source placement: ${spec.source_root}/${key}`);
    const local = object.parent!.matrixWorld.clone().invert().multiply(new THREE.Matrix4().fromArray(values));
    local.decompose(object.position, object.quaternion, object.scale);
    if (object.userData.web_motion === 'roll') object.userData = { ...object.userData, web_axis: spec.roll_axis };
  });
  model.updateMatrixWorld(true);
}
