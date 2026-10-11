import type { ScanStage } from './scan-scene';
import { mountViewportScene } from './lib/viewport-scene';

document.querySelectorAll<HTMLElement>('[data-module-media]').forEach(root => {
  const photo = root.querySelector<HTMLElement>('[data-module-photo]')!;
  const view = root.querySelector<HTMLElement>('[data-module-view]')!;
  const status = root.querySelector<HTMLElement>('[data-module-status]')!;
  const controls = root.querySelector<HTMLElement>('[data-module-controls]')!;
  const spin = root.querySelector<HTMLButtonElement>('[data-module-spin]')!;
  let stage: ScanStage | undefined;
  let visible = false, rotating = true, frame = 0, previous = 0, elapsed = 0;
  const sync = () => { spin.textContent = rotating ? spin.dataset.pause! : spin.dataset.resume!; spin.setAttribute('aria-pressed', String(rotating)); };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; };
  const tick = (now: number) => {
    frame = 0;
    if (!stage || !visible || !rotating) return;
    const dt = previous ? Math.min((now - previous) / 1000, .1) : 0;
    elapsed += dt;
    const phase = elapsed % 18;
    const smooth = (x: number) => x * x * (3 - 2 * x);
    const reveal = phase < 3 ? 0 : phase < 6 ? smooth((phase - 3) / 3) : phase < 14 ? 1 : phase < 17 ? 1 - smooth((phase - 14) / 3) : 0;
    stage.setScan(reveal); stage.turntable.rotation.y += dt * .16;
    previous = now; stage.render(); frame = requestAnimationFrame(tick);
  };
  const run = () => { if (!frame && stage && visible && rotating) frame = requestAnimationFrame(tick); };
  const pause = () => { rotating = false; sync(); stop(); stage?.setScan(1); stage?.render(); };
  spin.addEventListener('click', () => { rotating = !rotating; sync(); if (rotating) run(); else pause(); });
  root.querySelector('[data-module-reset]')!.addEventListener('click', () => { if (stage) { stage.turntable.rotation.y = 0; stage.resetView(); } });
  mountViewportScene({
    root, view: root.querySelector<HTMLElement>('.media-view')!,
    media: '(min-width: 901px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    async load(signal) {
      const { loadModuleStage } = await import('./lib/module-stage');
      if (signal.aborted) return;
      const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', photo.dataset.alt!); view.replaceChildren(canvas);
      const next = await loadModuleStage(canvas, import.meta.env.BASE_URL, root.dataset.model!, signal, root.closest('[data-engineer-header]') !== null);
      try {
        stage = next;
        stage.setScan(rotating ? 0 : 1);
        stage.onResize(() => { if (visible) stage?.render(); });
        canvas.addEventListener('pointerdown', pause); canvas.addEventListener('keydown', pause);
      } catch (error) { next.dispose(); stage = undefined; throw error; }
      return {
        setVisible(value) { visible = value; if (value) { next.render(); run(); } else stop(); },
        dispose() { visible = false; stop(); next.dispose(); stage = undefined; },
      };
    },
    loading() { root.dataset.failedState = 'false'; status.hidden = false; status.textContent = root.dataset.loading!; },
    ready() { root.dataset.ready = 'true'; controls.hidden = false; controls.inert = false; status.hidden = true; },
    reset() { view.replaceChildren(); controls.hidden = true; controls.inert = true; root.dataset.ready = 'false'; status.hidden = root.dataset.failedState !== 'true'; },
    failed(error) { root.dataset.failedState = 'true'; status.hidden = false; status.textContent = root.dataset.failed!; console.warn('Module unavailable', error); },
  });
  sync();
});
