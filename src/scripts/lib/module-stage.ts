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
      // The vehicle's slender arm leaves a lot of empty bounding-sphere space.
      // A header-specific frame fills about four fifths of the drawing height.
      sphere.radius *= .74;
      stage.frame(sphere, direction);
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
