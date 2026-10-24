import type { ScanStage } from './scan-scene';
import { mountViewportScene } from './lib/viewport-scene';

document.querySelectorAll<HTMLElement>('[data-module-media]').forEach(root => {
  const engineerHeader = root.closest('[data-engineer-header]') !== null;
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
    stage.setScan(reveal);
    // Hold the actual front view long enough to read it, including after reset.
    if (!engineerHeader || elapsed > 1.2) stage.turntable.rotation.y += dt * .16;
    if (engineerHeader) root.dataset.turntableAngle = stage.turntable.rotation.y.toFixed(5);
    previous = now; stage.render(); frame = requestAnimationFrame(tick);
  };
  const run = () => { if (!frame && stage && visible && rotating) frame = requestAnimationFrame(tick); };
  const pause = () => { rotating = false; sync(); stop(); stage?.setScan(1); stage?.render(); };
  spin.addEventListener('click', () => { rotating = !rotating; sync(); if (rotating) run(); else pause(); });
  root.querySelector('[data-module-reset]')!.addEventListener('click', () => { if (stage) { stage.turntable.rotation.y = 0; if (engineerHeader) { elapsed = 0; root.dataset.turntableAngle = '0'; } stage.resetView(); } });
  mountViewportScene({
    root, view: root.querySelector<HTMLElement>('.media-view')!,
    media: '(min-width: 901px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    async load(signal) {
      const { loadModuleStage } = await import('./lib/module-stage');
      if (signal.aborted) return;
      const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', photo.dataset.alt!); view.replaceChildren(canvas);
      const next = await loadModuleStage(canvas, import.meta.env.BASE_URL, root.dataset.model!, signal, engineerHeader);
      try {
        stage = next;
        if (engineerHeader) elapsed = 0;
        if (engineerHeader) root.dataset.turntableAngle = '0';
        stage.setScan(!rotating ? 1 : 0);
        if (engineerHeader && next.anchor) {
          // Publish the arm-end screen position for the header HUD lock (--lock-x/y in px).
          const header = root.closest<HTMLElement>('[data-engineer-header]')!, render = next.render, local = next.anchor.clone();
          const world = local.clone();
          next.render = () => {
            render();
            world.copy(local); next.turntable.localToWorld(world); world.project(next.camera);
            const box = canvas.getBoundingClientRect(), host = header.getBoundingClientRect();
            header.style.setProperty('--lock-x', `${(box.left - host.left + (world.x + 1) / 2 * box.width).toFixed(1)}px`);
            header.style.setProperty('--lock-y', `${(box.top - host.top + (1 - world.y) / 2 * box.height).toFixed(1)}px`);
            header.dataset.lock = 'on';
            // Leader: from the reticle to the readout's nearer vertical edge, at its label line.
            const line = header.querySelector<SVGLineElement>('[data-lock-line]'), readout = header.querySelector<HTMLElement>('.lock-readout');
            if (line && readout) {
              const r = readout.getBoundingClientRect(), x = box.left - host.left + (world.x + 1) / 2 * box.width, y = box.top - host.top + (1 - world.y) / 2 * box.height;
              const left = r.left - host.left, right = r.right - host.left, ex = Math.abs(x - left) < Math.abs(x - right) ? left : right;
              line.setAttribute('x1', x.toFixed(1)); line.setAttribute('y1', y.toFixed(1));
              line.setAttribute('x2', ex.toFixed(1)); line.setAttribute('y2', (r.top - host.top + 14).toFixed(1));
            }
          };
        }
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
    reset() { const header = root.closest<HTMLElement>('[data-engineer-header]'); if (header) delete header.dataset.lock; view.replaceChildren(); controls.hidden = true; controls.inert = true; root.dataset.ready = 'false'; status.hidden = root.dataset.failedState !== 'true'; },
    failed(error) { root.dataset.failedState = 'true'; status.hidden = false; status.textContent = root.dataset.failed!; console.warn('Module unavailable', error); },
  });
  sync();
});
