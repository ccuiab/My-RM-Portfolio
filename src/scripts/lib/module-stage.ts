import { Box3, Sphere, Vector3 } from 'three';
import { loadScanStage } from '../scan-scene';

/** Imported only in the viewport; named imports keep unused Three exports out. */
export async function loadModuleStage(canvas: HTMLCanvasElement, base: string, model: string) {
  const range: [number, number] = [1, -1];
  const stage = await loadScanStage(canvas, base, model, { axis: new Vector3(0, 0, 1), range });
  try {
    const sphere = new Box3().setFromObject(stage.model).getBoundingSphere(new Sphere());
    stage.model.position.sub(sphere.center); sphere.center.set(0, 0, 0);
    range[0] = sphere.radius * 1.02; range[1] = -range[0]; sphere.radius *= 1.06;
    stage.frame(sphere, new Vector3(1, .65, 1.3));
    stage.enableInteraction();
    return stage;
  } catch (error) { stage.dispose(); throw error; }
}
