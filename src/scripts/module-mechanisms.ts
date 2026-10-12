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
  const annotations = [...root.querySelectorAll<HTMLElement>('[data-mechanism-annotation]')];
  const phaseLabel = root.querySelector<HTMLElement>('[data-cycle-label]');
  let stage: MechanismStage | undefined, motion: ModuleMotion | undefined;
  let cycle: typeof import('./module-motion') | undefined;
  let visible = false, playing = true, frame = 0, previous = 0, elapsed = 0;
  let explode = 0, target = 0, phaseTime = 0, phase = 'assembled';
  let lastInteraction = -Infinity, holding = false, reconnect = false, blend = 1;
  const interaction = () => { lastInteraction = performance.now(); reconnect = true; blend = 0; run(); };
  const sync = () => {
    root.dataset.explode = explode.toFixed(3);
    root.dataset.cyclePhase = phase;
    if (slider && document.activeElement !== slider) slider.value = String(Math.round(explode * 100));
    if (output) output.value = `${Math.round(explode * 100)}%`;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(Math.abs(Number(b.dataset.explodeTo) - explode) < .001)));
    play.textContent = playing ? play.dataset.pause! : play.dataset.play!;
    play.setAttribute('aria-pressed', String(playing));
    if (phaseLabel) phaseLabel.textContent = phaseLabel.dataset[phase] ?? '';
  };
  const draw = () => {
    if (!visible || !stage || !motion) return;
    motion.update(elapsed, explode);
    root.dataset.motionTime = elapsed.toFixed(3);
    if (root.dataset.mechanism === 'pump') {
      const info = motion.diagnostics();
      root.dataset.crankAngle = ((elapsed * 2.8) % (Math.PI * 2)).toFixed(3);
      root.dataset.pumpStroke = info.stroke;
      root.dataset.inletOpen = String(info.inletOpen); root.dataset.outletOpen = String(info.outletOpen);
      root.dataset.rodError = String(info.rodError); root.dataset.sliderError = String(info.sliderError);
      root.dataset.pins = JSON.stringify(info.pins);
      annotations.forEach((item, index) => {
        const open = index === 0 ? info.inletOpen : info.outletOpen;
        item.dataset.open = String(open);
        item.textContent = open ? item.dataset.openText! : item.dataset.closedText!;
      });
    }
    stage.render();
    const points = motion.annotations();
    if (root.dataset.mechanism === 'swerve') {
      let previousY = 8;
      for (const point of [...points].sort((a, b) => a.y - b.y)) {
        point.y = Math.min(90, Math.max(point.y, previousY + 8));
        previousY = point.y;
      }
    }
    points.forEach((point, index) => {
      const item = annotations[index]; if (!item) return;
      item.hidden = !point.visible || (root.dataset.mechanism === 'swerve' && explode < .4);
      item.style.left = `${point.x}%`; item.style.top = `${point.y}%`;
    });
    root.dataset.cameraPosition = JSON.stringify(stage.camera.position.toArray());
    root.dataset.screenBounds = JSON.stringify(stage.screenBounds());
  };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; root.dataset.rendering = 'false'; };
  const tick = (now: number) => {
    frame = 0;
    if (!visible || !stage || !cycle) return;
    const dt = previous ? Math.min((now - previous) / 1000, .5) : 0;
    previous = now;
    const automatic = playing && !holding && now - lastInteraction >= 5000;
    root.dataset.autoState = automatic ? 'playing' : playing ? 'interaction' : 'paused';
    if (automatic) {
      if (reconnect) {
        phaseTime = cycle.cycleAtAmount(explode, phase === 'closing');
        reconnect = false; blend = 0;
      }
      blend = Math.min(1, blend + dt);
      const weight = blend * blend * (3 - 2 * blend);
      elapsed += dt * weight;
      if (root.dataset.mechanism === 'swerve') {
        phaseTime += dt * weight;
        const sample = cycle.explosionCycle(phaseTime);
        explode = sample.amount; target = explode; phase = sample.phase;
        stage.autoOrbit(dt, elapsed, weight);
      }
    } else {
      const difference = target - explode;
      explode = Math.abs(difference) < .001 ? target : explode + difference * (1 - Math.exp(-dt * 8));
    }
    sync();
    if (automatic || explode !== target || dt === 0) { draw(); root.dataset.rendering = 'true'; }
    else root.dataset.rendering = 'false';
    if (playing || explode !== target) frame = requestAnimationFrame(tick);
  };
  const run = () => { if (!frame && visible && stage) frame = requestAnimationFrame(tick); };
  buttons.forEach(b => b.addEventListener('click', () => { interaction(); target = Number(b.dataset.explodeTo); sync(); run(); }));
  slider?.addEventListener('input', () => { interaction(); target = Number(slider.value) / 100; sync(); run(); });
  slider?.addEventListener('pointerdown', () => { holding = true; interaction(); });
  const endInteraction = () => { if (holding) { holding = false; interaction(); } };
  window.addEventListener('pointerup', endInteraction);
  window.addEventListener('pointercancel', endInteraction);
  play.addEventListener('click', () => {
    playing = !playing; target = explode; reconnect = true; blend = 0;
    if (playing) { lastInteraction = -Infinity; run(); }
    else { stop(); draw(); }
    sync();
  });
  root.querySelector('[data-mechanism-reset]')!.addEventListener('click', () => { interaction(); stage?.resetView(); draw(); });
  holder.addEventListener('pointerdown', () => { holding = true; interaction(); });
  holder.addEventListener('pointermove', event => { if (event.buttons) { interaction(); draw(); } });
  holder.addEventListener('wheel', () => { interaction(); draw(); }, { passive: true });
  holder.addEventListener('keydown', () => { interaction(); draw(); });
  document.addEventListener('astro:before-swap', () => {
    window.removeEventListener('pointerup', endInteraction); window.removeEventListener('pointercancel', endInteraction);
  }, { once: true });
  mountViewportScene({
    root, view: root.querySelector<HTMLElement>('[data-mechanism-view]')!,
    media: '(min-width: 901px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    async load(signal) {
      const [{ loadMechanismStage }, module] = await Promise.all([import('./lib/mechanism-stage'), import('./module-motion')]);
      if (signal.aborted) return;
      cycle = module;
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', root.querySelector<HTMLImageElement>('img')!.alt);
      canvas.setAttribute('role', 'img'); holder.replaceChildren(canvas);
      const next = await loadMechanismStage(canvas, import.meta.env.BASE_URL, root.dataset.model!, label, () => visible, signal);
      try { stage = next; motion = module.createModuleMotion(stage, root.dataset.mechanism as 'pump' | 'swerve'); }
      catch (error) { next.dispose(); stage = undefined; throw error; }
      return {
        setVisible(value) { visible = value; if (value) { draw(); run(); } else stop(); },
        dispose() { visible = false; stop(); next.dispose(); stage = undefined; motion = undefined; },
      };
    },
    loading() { delete root.dataset.failedState; status.hidden = false; status.textContent = root.dataset.loading!; },
    ready() { root.dataset.ready = 'true'; controls.hidden = false; controls.inert = false; status.hidden = true; },
    reset() { holder.replaceChildren(); controls.hidden = true; controls.inert = true; label.hidden = true; annotations.forEach(a => a.hidden = true); root.dataset.ready = 'false'; status.hidden = root.dataset.failedState !== 'true'; },
    failed(error) { root.dataset.failedState = 'true'; status.hidden = false; status.textContent = root.dataset.failed!; console.warn('Mechanism unavailable', error); },
  });
  sync();
});
