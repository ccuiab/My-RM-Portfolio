import type { ScanStage } from './scan-scene';

document.querySelectorAll<HTMLElement>('[data-module-media]').forEach(root => {
  const photo = root.querySelector<HTMLElement>('[data-module-photo]')!;
  const view = root.querySelector<HTMLElement>('[data-module-view]')!;
  const status = root.querySelector<HTMLElement>('[data-module-status]')!;
  const controls = root.querySelector<HTMLElement>('[data-module-controls]')!;
  const photoButton = root.querySelector<HTMLButtonElement>('[data-show-photo]')!;
  const modelButton = root.querySelector<HTMLButtonElement>('[data-show-model]')!;
  let selected = false, nearby = true, pending = false, generation = 0;
  let stage: ScanStage | undefined;
  const unload = () => {
    generation++;
    stage?.dispose();
    stage = undefined;
    pending = false;
    view.replaceChildren();
    controls.hidden = true;
    root.dataset.ready = 'false';
  };
  const load = async () => {
    if (!selected || !nearby || stage || pending) return;
    const current = ++generation;
    pending = true;
    status.textContent = root.dataset.loading!;
    status.hidden = false;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${modelButton.textContent}: ${photo.dataset.alt}`);
    view.replaceChildren(canvas);
    try {
      const [{ loadScanStage }, THREE] = await Promise.all([import('./scan-scene'), import('three')]);
      if (current !== generation) return;
      const next = await loadScanStage(canvas, import.meta.env.BASE_URL, root.dataset.model!, { axis: new THREE.Vector3(0, 0, 1), range: [1, -1], solidOnly: true });
      if (current !== generation) { next.dispose(); return; }
      stage = next;
      const sphere = new THREE.Box3().setFromObject(stage.model).getBoundingSphere(new THREE.Sphere());
      stage.model.position.sub(sphere.center);
      sphere.center.set(0, 0, 0);
      sphere.radius *= 1.06;
      stage.frame(sphere, new THREE.Vector3(1, .65, 1.3));
      stage.onResize(() => stage?.render());
      stage.enableInteraction();
      stage.render();
      controls.hidden = false;
      status.hidden = true;
      root.dataset.ready = 'true';
    } catch (error) {
      if (current !== generation) return;
      status.textContent = root.dataset.failed!;
      console.warn('Module model unavailable', root.dataset.model, error);
    } finally { if (current === generation) pending = false; }
  };
  const select = (model: boolean) => {
    selected = model;
    photoButton.setAttribute('aria-pressed', String(!model));
    modelButton.setAttribute('aria-pressed', String(model));
    photo.hidden = model;
    view.hidden = !model;
    status.hidden = !model || !!stage;
    if (model) void load(); else unload();
  };
  photoButton.addEventListener('click', () => select(false));
  modelButton.addEventListener('click', () => select(true));
  root.querySelector('[data-module-reset]')!.addEventListener('click', () => stage?.resetView());
  // Release GPU contexts well outside the viewport, preserving the chosen mode.
  new IntersectionObserver(([entry]) => {
    nearby = entry.isIntersecting;
    if (nearby) void load(); else if (stage || pending) unload();
  }, { rootMargin: '250px' }).observe(root);
});
