import type { ScanStage } from './scan-scene';

document.querySelectorAll<HTMLElement>('[data-module-media]').forEach(root => {
  const photo = root.querySelector<HTMLElement>('[data-module-photo]')!;
  const view = root.querySelector<HTMLElement>('[data-module-view]')!;
  const status = root.querySelector<HTMLElement>('[data-module-status]')!;
  const controls = root.querySelector<HTMLElement>('[data-module-controls]')!;
  const spin = root.querySelector<HTMLButtonElement>('[data-module-spin]')!;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rotating = !motion.matches, frame = 0, previous = 0, elapsed = 0;
  const syncSpin = () => { spin.textContent = rotating ? spin.dataset.pause! : spin.dataset.resume!; spin.setAttribute('aria-pressed', String(rotating)); };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; };
  const tick = (now: number) => {
    if (!stage || !visible || !rotating || document.hidden) { stop(); return; }
    const dt = previous ? Math.min((now - previous) / 1000, .1) : 0;
    elapsed += dt;
    // Rotate continuously while cycling from CAD edges to solid and back.
    const phase = elapsed % 18;
    const smooth = (x: number) => x * x * (3 - 2 * x);
    const reveal = phase < 3 ? 0 : phase < 6 ? smooth((phase - 3) / 3) : phase < 14 ? 1 : phase < 17 ? 1 - smooth((phase - 14) / 3) : 0;
    stage.setScan(reveal);
    stage.turntable.rotation.y += dt * .16;
    previous = now; stage.render(); frame = requestAnimationFrame(tick);
  };
  const run = () => { if (!frame && stage && visible && rotating && !document.hidden) frame = requestAnimationFrame(tick); };
  spin.addEventListener('click', () => { rotating = !rotating; syncSpin(); if (rotating) run(); else { stop(); stage?.setScan(1); stage?.render(); } });
  motion.addEventListener('change', () => { if (motion.matches) { rotating = false; syncSpin(); stop(); stage?.setScan(1); stage?.render(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else run(); });
  syncSpin();
  let nearby = false, visible = false, pending = false, generation = 0;
  let stage: ScanStage | undefined;
  const unload = () => {
    stop();
    elapsed = 0;
    generation++;
    stage?.dispose();
    stage = undefined;
    pending = false;
    view.replaceChildren();
    controls.hidden = true;
    root.dataset.ready = 'false';
  };
  const load = async () => {
    if (!nearby || stage || pending) return;
    const current = ++generation;
    pending = true;
    root.dataset.failedState = "false";
    status.textContent = root.dataset.loading!;
    status.hidden = false;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', photo.dataset.alt!);
    view.replaceChildren(canvas);
    try {
      const [{ loadScanStage }, THREE] = await Promise.all([import('./scan-scene'), import('three')]);
      if (current !== generation) return;
      const range: [number, number] = [1, -1];
      const next = await loadScanStage(canvas, import.meta.env.BASE_URL, root.dataset.model!, { axis: new THREE.Vector3(0, 0, 1), range });
      if (current !== generation) { next.dispose(); return; }
      stage = next;
      const sphere = new THREE.Box3().setFromObject(stage.model).getBoundingSphere(new THREE.Sphere());
      stage.model.position.sub(sphere.center);
      sphere.center.set(0, 0, 0);
      range[0] = sphere.radius * 1.02; range[1] = -range[0];
      sphere.radius *= 1.06;
      stage.frame(sphere, new THREE.Vector3(1, .65, 1.3));
      stage.setScan(rotating ? 0 : 1);
      stage.onResize(() => stage?.render());
      stage.enableInteraction();
      const pause = () => { rotating = false; syncSpin(); stop(); stage?.setScan(1); stage?.render(); };
      canvas.addEventListener('pointerdown', pause);
      canvas.addEventListener('keydown', pause);
      stage.render();
      controls.hidden = false;
      status.hidden = true;
      root.dataset.ready = 'true';
      run();
    } catch (error) {
      if (current !== generation) return;
      stage?.dispose(); stage = undefined; view.replaceChildren();
      root.dataset.failedState = "true";
      status.textContent = root.dataset.failed!;
      console.warn('Module model unavailable', root.dataset.model, error);
    } finally { if (current === generation) pending = false; }
  };
  root.querySelector('[data-module-reset]')!.addEventListener('click', () => { if (stage) { stage.turntable.rotation.y = 0; stage.resetView(); } });
  // Release GPU contexts well outside the viewport, preserving the chosen mode.
  const loadObserver = new IntersectionObserver(([entry]) => {
    nearby = entry.isIntersecting;
    if (nearby) void load(); else if (stage || pending) unload();
  }, { rootMargin: '250px' });
  loadObserver.observe(root);
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) run(); else stop(); });
  visibilityObserver.observe(root);
  window.addEventListener('pagehide', () => { loadObserver.disconnect(); visibilityObserver.disconnect(); unload(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { loadObserver.observe(root); visibilityObserver.observe(root); } });
});
