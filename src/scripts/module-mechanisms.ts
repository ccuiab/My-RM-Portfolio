import type { MechanismStage } from './lib/mechanism-stage';
import type { ModuleMotion } from './module-motion';
import { mountViewportScene } from './lib/viewport-scene';

document.querySelectorAll<HTMLElement>('[data-mechanism]').forEach(root => {
  const holder = root.querySelector<HTMLElement>('[data-mechanism-canvas]')!;
  const controls = root.querySelector<HTMLElement>('[data-mechanism-controls]')!;
  const status = root.querySelector<HTMLElement>('[data-mechanism-status]')!;
  const label = root.querySelector<HTMLElement>('[data-part-name]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-mechanism-play]')!;
  const slider = root.querySelector<HTMLInputElement>('[data-explode-amount]');
  const output = root.querySelector<HTMLOutputElement>('[data-explode-output]');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-explode-to]')];
  let stage: MechanismStage | undefined, motion: ModuleMotion | undefined;
  let visible = false, playing = true, frame = 0, previous = 0, elapsed = 0;
  let explode = 0, target = 0;
  const sync = () => {
    root.dataset.explode = explode.toFixed(3);
    if (slider) slider.value = String(Math.round(explode * 100));
    if (output) output.value = `${Math.round(explode * 100)}%`;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.explodeTo) === target)));
    play.textContent = playing ? play.dataset.pause! : play.dataset.play!;
    play.setAttribute('aria-pressed', String(playing));
  };
  const draw = () => {
    if (!visible || !stage || !motion) return;
    motion.update(elapsed, explode);
    root.dataset.motionTime = elapsed.toFixed(3);
    root.dataset.crankAngle = root.dataset.mechanism === 'pump' ? ((elapsed * 2.8) % (Math.PI * 2)).toFixed(3) : '';
    stage.render();
  };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; root.dataset.rendering = 'false'; };
  const tick = (now: number) => {
    frame = 0;
    if (!visible || !stage) return;
    const dt = previous ? Math.min((now - previous) / 1000, .08) : 0;
    previous = now;
    if (playing) elapsed += dt;
    const difference = target - explode;
    explode = Math.abs(difference) < .001 ? target : explode + difference * (1 - Math.exp(-dt * 8));
    sync(); draw(); root.dataset.rendering = 'true';
    if (playing || explode !== target) frame = requestAnimationFrame(tick);
    else root.dataset.rendering = 'false';
  };
  const run = () => { if (!frame && visible && stage && (playing || explode !== target)) frame = requestAnimationFrame(tick); };
  buttons.forEach(b => b.addEventListener('click', () => { target = Number(b.dataset.explodeTo); sync(); run(); }));
  slider?.addEventListener('input', () => { target = Number(slider.value) / 100; sync(); run(); });
  play.addEventListener('click', () => { playing = !playing; sync(); if (playing) run(); else { stop(); draw(); if (explode !== target) run(); } });
  root.querySelector('[data-mechanism-reset]')!.addEventListener('click', () => stage?.resetView());
  mountViewportScene({
    root, view: root.querySelector<HTMLElement>('[data-mechanism-view]')!,
    media: '(min-width: 901px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    async load(signal) {
      const [{ loadMechanismStage }, { createModuleMotion }] = await Promise.all([import('./lib/mechanism-stage'), import('./module-motion')]);
      if (signal.aborted) return;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', root.querySelector<HTMLImageElement>('img')!.alt);
      canvas.setAttribute('role', 'img'); holder.replaceChildren(canvas);
      const next = await loadMechanismStage(canvas, import.meta.env.BASE_URL, root.dataset.model!, label, () => visible, signal);
      try { stage = next; motion = createModuleMotion(stage, root.dataset.mechanism as 'pump' | 'swerve'); }
      catch (error) { next.dispose(); stage = undefined; throw error; }
      return {
        setVisible(value) { visible = value; if (value) { draw(); run(); } else stop(); },
        dispose() { visible = false; stop(); next.dispose(); stage = undefined; motion = undefined; },
      };
    },
    loading() { delete root.dataset.failedState; status.hidden = false; status.textContent = root.dataset.loading!; },
    ready() { root.dataset.ready = 'true'; controls.hidden = false; controls.inert = false; status.hidden = true; },
    reset() { holder.replaceChildren(); controls.hidden = true; controls.inert = true; label.hidden = true; root.dataset.ready = 'false'; status.hidden = root.dataset.failedState !== 'true'; },
    failed(error) { root.dataset.failedState = 'true'; status.hidden = false; status.textContent = root.dataset.failed!; console.warn('Mechanism unavailable', error); },
  });
  sync();
});
