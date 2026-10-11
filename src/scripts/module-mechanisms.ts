import type { MechanismStage } from './lib/mechanism-stage';
import type { ModuleMotion } from './module-motion';
import { gsap } from 'gsap';

const staticMode = window.matchMedia('(max-width: 900px), (pointer: coarse), (prefers-reduced-motion: reduce)');
document.querySelectorAll<HTMLElement>('[data-mechanism]').forEach(root => {
  const view = root.querySelector<HTMLElement>('[data-mechanism-view]')!;
  const holder = root.querySelector<HTMLElement>('[data-mechanism-canvas]')!;
  const controls = root.querySelector<HTMLElement>('[data-mechanism-controls]')!;
  const status = root.querySelector<HTMLElement>('[data-mechanism-status]')!;
  const label = root.querySelector<HTMLElement>('[data-part-name]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-mechanism-play]')!;
  const slider = root.querySelector<HTMLInputElement>('[data-explode-amount]');
  const output = root.querySelector<HTMLOutputElement>('[data-explode-output]');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-explode-to]')];
  const state = { explode: 0 };
  let stage: MechanismStage | undefined, motion: ModuleMotion | undefined;
  let visible = false, pending = false, playing = true, disposed = false;
  let generation = 0, frame = 0, previous = 0, elapsed = 0, target = 0;
  let tween: gsap.core.Tween | undefined;
  const canRender = () => visible && !staticMode.matches && !document.hidden && !disposed;
  const sync = () => {
    root.dataset.explode = state.explode.toFixed(3);
    if (slider) slider.value = String(Math.round(state.explode * 100));
    if (output) output.value = `${Math.round(state.explode * 100)}%`;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.explodeTo) === target)));
    play.textContent = playing ? play.dataset.pause! : play.dataset.play!;
    play.setAttribute('aria-pressed', String(playing));
  };
  const draw = () => {
    if (!canRender() || !stage || !motion) return;
    motion.update(elapsed, state.explode);
    root.dataset.motionTime = elapsed.toFixed(3);
    root.dataset.crankAngle = root.dataset.mechanism === 'pump' ? ((elapsed * 2.8) % (Math.PI * 2)).toFixed(3) : '';
    stage.render();
  };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; root.dataset.rendering = 'false'; };
  const run = () => {
    if (frame || !canRender() || !stage || !playing) return;
    const tick = (now: number) => {
      if (staticMode.matches) { refresh(); return; }
      if (!canRender() || !stage || !playing) { stop(); return; }
      if (previous) elapsed += Math.min((now - previous) / 1000, .05);
      previous = now; draw(); root.dataset.rendering = 'true'; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  const transition = (to: number) => {
    target = to; tween?.kill(); sync();
    if (!canRender() || !stage) { state.explode = to; sync(); return; }
    tween = gsap.to(state, { explode: to, duration: .75, ease: 'power2.inOut', onUpdate: () => { sync(); draw(); } });
  };
  const unload = () => {
    stop(); tween?.kill(); state.explode = target; sync(); generation++; pending = false;
    const previousStage = stage;
    stage = undefined; motion = undefined; holder.replaceChildren();
    controls.hidden = true; label.hidden = true; root.dataset.ready = 'false';
    previousStage?.dispose();
  };
  const load = async () => {
    if (!canRender() || stage || pending) return;
    pending = true; const current = ++generation;
    status.hidden = false; status.textContent = root.dataset.loading!;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', root.querySelector<HTMLImageElement>('img')!.alt);
    canvas.setAttribute('role', 'img'); holder.replaceChildren(canvas);
    try {
      const [{ loadMechanismStage }, { createModuleMotion }] = await Promise.all([import('./lib/mechanism-stage'), import('./module-motion')]);
      if (current !== generation) return;
      const next = await loadMechanismStage(canvas, import.meta.env.BASE_URL, root.dataset.model!, label, () => current === generation && canRender());
      if (current !== generation || !canRender()) { next.dispose(); return; }
      stage = next; motion = createModuleMotion(stage, root.dataset.mechanism as 'pump' | 'swerve');
      root.dataset.ready = 'true'; status.hidden = true; controls.hidden = false;
      draw(); run();
    } catch (error) {
      if (current !== generation) return;
      stage?.dispose(); stage = undefined; motion = undefined; holder.replaceChildren();
      status.textContent = root.dataset.failed!; status.hidden = false;
      console.warn('Mechanism model unavailable', root.dataset.model, error);
    } finally { if (current === generation) pending = false; }
  };
  const refresh = () => {
    if (staticMode.matches) { unload(); status.textContent = root.dataset.static!; status.hidden = false; }
    else if (visible && !document.hidden) { status.hidden = true; void load(); tween?.resume(); draw(); run(); }
    else { stop(); tween?.pause(); }
  };
  buttons.forEach(b => b.addEventListener('click', () => transition(Number(b.dataset.explodeTo))));
  slider?.addEventListener('input', () => transition(Number(slider.value) / 100));
  play.addEventListener('click', () => { playing = !playing; sync(); if (playing) run(); else { stop(); draw(); } });
  root.querySelector('[data-mechanism-reset]')!.addEventListener('click', () => stage?.resetView());
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) { unload(); status.hidden = true; } else refresh();
  });
  observer.observe(view);
  staticMode.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pagehide', () => { disposed = true; observer.disconnect(); unload(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; observer.observe(view); refresh(); } });
  sync(); refresh();
});
