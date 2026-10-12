import { Box3, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, Sphere, Vector3 } from 'three';
import { loadScanStage } from '../scan-scene';

/** Imported only in the viewport; named imports keep unused Three exports out. */
export async function loadModuleStage(canvas: HTMLCanvasElement, base: string, model: string, signal: AbortSignal, engineerHeader = false) {
  const range: [number, number] = [1, -1];
  const stage = await loadScanStage(canvas, base, model, { axis: new Vector3(0, 0, 1), range }, signal);
  try {
    const sphere = new Box3().setFromObject(stage.model).getBoundingSphere(new Sphere());
    stage.model.position.sub(sphere.center); sphere.center.set(0, 0, 0);
    range[0] = sphere.radius * 1.02; range[1] = -range[0]; sphere.radius *= 1.06;
    const direction = new Vector3(1, .65, 1.3);
    if (engineerHeader) {
      // CAD source nodes 1330/1673 are the fixed ZP-80HB storage cups.
      // Their midpoint is vehicle-rear (+.794, 0, +.608), local arm -Z.
      // Vehicle-front is the opposite side, where the arm/end cup extends.
      // Rotate the old rear three-quarter view by 180 degrees, retaining pitch.
      const azimuth = (52.54 + 22.5 + 180) * Math.PI / 180;
      direction.set(Math.sin(azimuth), .65, Math.cos(azimuth));
      // The vehicle's slender arm leaves a lot of empty bounding-sphere space.
      // A header-specific frame fills about four fifths of the drawing height.
      // Fit actual CAD vertices instead: a centred sphere put the front wheels
      // below the canvas edge. Cached yaw frames also keep the turntable whole.
      stage.model.updateMatrixWorld(true);
      const vertices: number[] = [];
      const point = new Vector3();
      stage.model.traverse(object => {
        if (!(object as Mesh).isMesh || (object.parent as Mesh)?.isMesh) return;
        const mesh = object as Mesh, positions = mesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          vertices.push(point.x, point.y, point.z);
        }
      });
      const positions = new Float32Array(vertices);
      const forward = direction.clone().normalize();
      const right = new Vector3().crossVectors(new Vector3(0, 1, 0), forward).normalize();
      const up = new Vector3().crossVectors(forward, right).normalize();
      const vertical = Math.tan(stage.camera.fov * Math.PI / 360);
      let fitAspect = 0, yaw = NaN, frames: Sphere[] = [];
      const frameAt = (angle: number) => {
        const c = Math.cos(angle), s = Math.sin(angle);
        const projected = new Float32Array(positions.length);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i] * c + positions[i + 2] * s, y = positions[i + 1], z = -positions[i] * s + positions[i + 2] * c;
          const px = x * right.x + y * right.y + z * right.z;
          const py = x * up.x + y * up.y + z * up.z;
          projected[i] = px; projected[i + 1] = py; projected[i + 2] = x * forward.x + y * forward.y + z * forward.z;
          minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        }
        let tx = (minX + maxX) / 2, ty = (minY + maxY) / 2, distance = 0;
        const horizontal = vertical * fitAspect;
        for (let pass = 0; pass < 3; pass++) {
          distance = 0;
          for (let i = 0; i < projected.length; i += 3) distance = Math.max(distance,
            projected[i + 2] + Math.abs(projected[i] - tx) / (horizontal * .79),
            projected[i + 2] + Math.abs(projected[i + 1] - ty) / (vertical * .79));
          if (pass === 2) break;
          minX = minY = Infinity; maxX = maxY = -Infinity;
          for (let i = 0; i < projected.length; i += 3) {
            const depth = distance - projected[i + 2];
            const x = (projected[i] - tx) / depth, y = (projected[i + 1] - ty) / depth;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
          tx += (minX + maxX) * distance / 2; ty += (minY + maxY) * distance / 2;
        }
        return new Sphere(right.clone().multiplyScalar(tx).addScaledVector(up, ty),
          distance * Math.sin(Math.atan(Math.min(vertical, horizontal))));
      };
      const fitTurntable = () => {
        if (fitAspect !== stage.camera.aspect) {
          fitAspect = stage.camera.aspect;
          frames = Array.from({ length: 37 }, (_, i) => frameAt(i * Math.PI / 18));
          yaw = NaN;
        }
        const nextYaw = stage.turntable.rotation.y;
        if (nextYaw === yaw) return; // Preserve a paused user's orbit/zoom.
        yaw = nextYaw;
        const value = ((yaw % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) * 18 / Math.PI;
        const index = Math.floor(value), fraction = value - index;
        const frame = frames[index].clone();
        frame.center.lerp(frames[index + 1].center, fraction);
        frame.radius += (frames[index + 1].radius - frame.radius) * fraction;
        stage.frame(frame, direction);
      };
      const render = stage.render, resetView = stage.resetView;
      stage.render = () => { fitTurntable(); render(); };
      stage.resetView = () => { stage.turntable.rotation.y = 0; yaw = NaN; fitTurntable(); resetView(); };
      fitTurntable();
      stage.renderer.toneMappingExposure = 1.45;
      stage.scene.traverse(object => {
        if (object instanceof HemisphereLight) object.intensity = 2.6;
        if (object instanceof DirectionalLight && object.color.getHex() === 0x3d8bff) {
          object.color.set(0xffffff); object.intensity = 1.8;
        }
      });
      const fill = new DirectionalLight(0xffffff, 2.1);
      fill.position.set(1.6, 1.4, 2.4); stage.scene.add(fill);
      const lifted = new Set<MeshStandardMaterial>();
      stage.model.traverse(object => {
        if (!(object as Mesh).isMesh) return;
        const mesh = object as Mesh;
        for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const material = mat as MeshStandardMaterial;
          if (lifted.has(material)) continue;
          lifted.add(material);
          if (material.color && material.color.getHSL({ h: 0, s: 0, l: 0 }).l < .16) material.color.offsetHSL(0, 0, .045);
        }
      });
    } else stage.frame(sphere, direction);
    stage.enableInteraction();
    return stage;
  } catch (error) { stage.dispose(); throw error; }
}
