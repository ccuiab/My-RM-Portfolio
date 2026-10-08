import * as THREE from 'three';
import { loadScanStage } from './scan-scene';

/** One camera-locked CAD reveal. The world-space scan bounds come from the loaded robot. */
export async function startHeroScene(root: HTMLElement, canvas: HTMLCanvasElement, base: string) {
  const range: [number, number] = [1, -1];
  const stage = await loadScanStage(canvas, base, 'engineer.glb', { axis: new THREE.Vector3(0, 1, 0), range });
  const bounds = new THREE.Box3().setFromObject(stage.model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.length()) || size.length() === 0) throw new Error('Empty engineer model');
  // Above every vertex -> wholly wireframe; below every vertex -> wholly PBR.
  const margin = size.y * 0.02;
  range[0] = bounds.max.y + margin;
  range[1] = bounds.min.y - margin;
  stage.camera.fov = 28;
  stage.camera.updateProjectionMatrix();
  stage.frame(bounds.getBoundingSphere(new THREE.Sphere()), new THREE.Vector3(-1.25, 0.62, 1.8));
  stage.model.traverse(object => {
    if ((object as THREE.LineSegments).isLineSegments) {
      ((object as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = 0.12;
    }
  });
  stage.renderer.toneMappingExposure = 1.35;
  stage.setScan(0);
  stage.render();
  root.dataset.modelBounds = JSON.stringify({ min: bounds.min.toArray(), max: bounds.max.toArray(), scan: range });
  root.classList.add('has-3d');
  root.classList.remove('locked');
  const values = [...root.querySelectorAll<HTMLElement>('.val')].map(el => ({ el, text: el.textContent || '0', value: Number(el.textContent), decimals: (el.textContent || '').includes('.') ? 1 : 0 }));
  const start = performance.now();
  let complete = false;
  let cancelled = false;
  let animation = 0;
  const render = () => {
    if (cancelled) return;
    const progress = Math.min(1, (performance.now() - start) / 3000);
    const eased = progress * progress * (3 - 2 * progress);
    stage.setScan(eased);
    const scanPoint = new THREE.Vector3(center.x, THREE.MathUtils.lerp(range[0], range[1], eased), center.z).project(stage.camera);
    root.style.setProperty('--scan-y', `${(1 - scanPoint.y) * 50}%`);
    root.dataset.scanProgress = String(progress);
    for (const item of values) item.el.textContent = progress === 1 ? item.text : (item.value * eased).toFixed(item.decimals);
    stage.render();
    if (progress < 1) animation = requestAnimationFrame(render);
    else { complete = true; root.classList.add('locked'); }
  };
  stage.onResize(() => { if (complete && !cancelled) stage.render(); });
  canvas.addEventListener('webglcontextlost', () => {
    cancelled = true;
    cancelAnimationFrame(animation);
    root.classList.remove('has-3d');
    root.classList.add('locked');
    values.forEach(item => item.el.textContent = item.text);
  });
  animation = requestAnimationFrame(render);
}
