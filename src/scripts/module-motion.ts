import * as THREE from 'three';
import type { MechanismStage } from './lib/mechanism-stage';

export function createModuleMotion(stage: MechanismStage, kind: 'pump' | 'swerve') {
  const parts: { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; axis: THREE.Vector3; offset: THREE.Vector3; motion?: string }[] = [];
  let shell: THREE.Object3D | undefined;
  const rotation = new THREE.Quaternion();
  stage.model.traverse(object => {
    const data = object.userData;
    if (data.web_shell) shell = object;
    if (!data.web_motion && !data.web_explode) return;
    parts.push({ object, position: object.position.clone(), quaternion: object.quaternion.clone(),
      axis: new THREE.Vector3().fromArray(data.web_axis ?? [0, 1, 0]).normalize(),
      offset: new THREE.Vector3().fromArray(data.web_explode ?? [0, 0, 0]), motion: data.web_motion });
    if (data.web_motion === 'crank' || data.web_shell) {
      object.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const m = mat as THREE.MeshStandardMaterial;
          m.color.lerp(stage.amber, .55); m.emissive.copy(stage.amber); m.emissiveIntensity = .22;
        }
      });
    }
  });
  if (kind === 'swerve') {
    let gearboxIndex = 0;
    for (const part of parts) {
      if (part.object.userData.web_motor_intact) continue;
      part.offset.x *= 3.6;
      part.offset.y *= 2.6;
      part.offset.z *= 3.6;
      // The gearbox covers share an export vector. Stagger them along the
      // wheel axle, retaining the complete motor as the assembly anchor.
      const name = part.object.userData.source_node_name ?? '';
      if (name.includes('GEARBOX') && part.offset.lengthSq()) {
        const spacing = gearboxIndex++ * .017;
        part.offset.add(new THREE.Vector3(-.766, 0, .643).multiplyScalar(spacing));
      }
    }
  }
  if (shell) shell.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      mat.transparent = true; mat.opacity = .20; mat.depthWrite = false; mat.side = THREE.DoubleSide;
    }
  });

  // No cup exists in this selection. Keep sparse visual flow at the pump head only.
  const count = 14;
  let particles: THREE.Points | undefined;
  const ports: THREE.Vector3[] = [];
  const positions = new Float32Array(count * 3);
  if (kind === 'pump' && shell) {
    const endpoints = shell.userData.web_ports as number[][];
    endpoints.forEach(p => ports.push(new THREE.Vector3().fromArray(p)));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.ShaderMaterial({
      uniforms: { color: { value: stage.amber } },
      vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=5.0;}',
      fragmentShader: 'uniform vec3 color;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;gl_FragColor=vec4(color,(1.0-smoothstep(0.2,0.5,d))*0.85);}',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    particles = new THREE.Points(geometry, material);
    particles.frustumCulled = false;
    shell.add(particles);
  }
  let lastRadius = -1;
  return {
    update(time: number, explode: number) {
      // Hold the assembled wheel still. Movement starts smoothly as parts separate.
      const steering = Math.sin(time * .85) * .55 * explode;
      for (const p of parts) {
        p.object.position.copy(p.position).addScaledVector(p.offset, explode);
        p.object.quaternion.copy(p.quaternion);
        const angle = p.motion === 'crank' ? time * 2.8 : p.motion === 'roll' ? time * 1.5 * explode : p.motion === 'steer' ? steering : 0;
        if (angle) p.object.quaternion.multiply(rotation.setFromAxisAngle(p.axis, angle));
        if (p.motion === 'piston') p.object.position.addScaledVector(p.axis.clone().applyQuaternion(p.quaternion), Math.sin(time * 2.8) * .0035);
      }
      if (particles) {
        for (let i = 0; i < count; i++) {
          const port = ports[i % 2];
          const t = (time * .4 + i / count) % 1;
          // Opposed short paths show intake/exhaust near the lateral head openings.
          const direction = i % 2 ? 1 : -1;
          positions[i * 3] = port.x + direction * .024 * (i % 2 ? t : 1 - t);
          positions[i * 3 + 1] = port.y + Math.sin(i * 2.4) * .0015;
          positions[i * 3 + 2] = port.z + Math.cos(i * 2.4) * .0015;
        }
        particles.geometry.attributes.position.needsUpdate = true;
      }
      const radius = stage.sphere.radius * (kind === 'swerve' ? 1.04 : 1.05);
      if (Math.abs(radius - lastRadius) > .00001) { stage.setRadius(radius); lastRadius = radius; }
    },
  };
}
export type ModuleMotion = ReturnType<typeof createModuleMotion>;
