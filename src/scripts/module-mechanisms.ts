import type { MechanismStage } from './lib/mechanism-stage';
import type { ModuleMotion } from './module-motion';
import { mountViewportScene } from './lib/viewport-scene';

/** Labels live outside the canvas. Pump valves share the right-hand rail;
 * sort endpoints vertically so the leaders stay readable while orbiting. */
function layoutMechanismAnnotations(root: HTMLElement, points: { x: number; y: number; visible: boolean }[], show: boolean) {
  const holder = root.querySelector<HTMLElement>('[data-mechanism-canvas]')!;
  const view = root.querySelector<HTMLElement>('[data-mechanism-view]')!;
  const items = [...root.querySelectorAll<HTMLElement>('[data-mechanism-annotation]')];
  const svg = root.querySelector<SVGSVGElement>('[data-swerve-leaders], [data-pump-leaders]')!;
  const leaders = [...svg.querySelectorAll<SVGGElement>('[data-annotation-leader]')];
  svg.toggleAttribute('hidden', !show);
  const frame = view.getBoundingClientRect(), canvas = holder.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
  const rows = points.flatMap((point, index) => {
    const item = items[index]; if (!item) return [];
    item.hidden = !show || !point.visible;
    leaders[index]?.setAttribute('hidden', '');
    if (item.hidden) return [];
    return [{ item, index, x: canvas.left - frame.left + point.x / 100 * canvas.width,
      y: canvas.top - frame.top + point.y / 100 * canvas.height }];
  }).sort((a, b) => a.x - b.x || a.index - b.index);
  // Swerve uses balanced columns; both pump valves stay on the same side.
  const middle = Math.ceil(rows.length / 2);
  const columns = root.dataset.mechanism === 'pump' ? [['right', rows]] as const
    : [['left', rows.slice(0, middle)], ['right', rows.slice(middle)]] as const;
  for (const [side, group] of columns) {
    group.sort((a, b) => a.y - b.y || a.index - b.index);
    // A shared inner lane preserves endpoint order before the final horizontal
    // legs. Different anchor depths can otherwise make diagonal leaders cross.
    const innerLane = side === 'left' ? Math.min(...group.map(row => row.x)) - 4 : Math.max(...group.map(row => row.x)) + 4;
    const heights = group.map(row => row.item.getBoundingClientRect().height);
    const gap = 8, top = 48, bottom = frame.height - 42;
    let next = top;
    group.forEach((row, index) => {
      const remaining = heights.slice(index).reduce((sum, height) => sum + height, 0) + (group.length - index - 1) * gap;
      const y = Math.max(next, Math.min(bottom - remaining, row.y - heights[index] / 2));
      const width = row.item.getBoundingClientRect().width;
      const x = side === 'left' ? 12 : frame.width - 12 - width;
      row.item.dataset.side = side; row.item.style.left = `${x}px`; row.item.style.top = `${y}px`;
      const edge = side === 'left' ? x + width : x;
      const elbow = side === 'left' ? canvas.left - frame.left - 4 : canvas.right - frame.left + 4;
      const center = y + heights[index] / 2;
      const leader = leaders[row.index];
      leader?.removeAttribute('hidden');
      leader?.querySelector('path')?.setAttribute('d', `M ${edge} ${center} H ${elbow} L ${innerLane} ${row.y} H ${row.x}`);
      const dot = leader?.querySelector('circle'); dot?.setAttribute('cx', String(row.x)); dot?.setAttribute('cy', String(row.y));
      next = y + heights[index] + gap;
    });
  }
}

export function layoutSwerveAnnotations(root: HTMLElement, stage: MechanismStage, amount: number, phase: string) {
  const detail = stage.isInspecting('optical-pcb');
  const points = stage.swerveAnchors().map((point, index) => ({ ...point,
    visible: point.visible && (detail || (index < 2 || index >= 7 ? amount > .12 : index < 4 ? amount > .3 : amount > .48)) }));
  layoutMechanismAnnotations(root, points, detail || amount > .02);
}

export function layoutPumpAnnotations(root: HTMLElement, motion: ModuleMotion) {
  layoutMechanismAnnotations(root, motion.annotations(), true);
}

document.querySelectorAll<HTMLElement>('[data-mechanism]').forEach(root => {
  const holder = root.querySelector<HTMLElement>('[data-mechanism-canvas]')!;
  const controls = root.querySelector<HTMLElement>('[data-mechanism-controls]')!;
  const status = root.querySelector<HTMLElement>('[data-mechanism-status]')!;
  const label = root.querySelector<HTMLElement>('[data-part-name]')!;
  const play = root.querySelector<HTMLButtonElement>('[data-mechanism-play]')!;
  const slider = root.querySelector<HTMLInputElement>('[data-explode-amount]');
  const output = root.querySelector<HTMLOutputElement>('[data-explode-output]');
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-explode-to]')];
  const detail = root.querySelector<HTMLButtonElement>('[data-steering-detail]');
  const sensorDetail = root.querySelector<HTMLButtonElement>('[data-sensor-detail]');
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
    const presentation = cycle?.swervePresentation(phaseTime);
    const isSwerve = root.dataset.mechanism === 'swerve';
    motion.update(isSwerve ? presentation!.motionTime : elapsed, explode, isSwerve && explode < .0001 ? presentation : undefined);
    if (isSwerve) {
      root.dataset.suspensionOffset = String(explode < .0001 ? presentation!.suspension : 0);
      root.dataset.steeringDemoAngle = String(explode < .0001 ? presentation!.steering : 0);
      root.dataset.presentationTime = String(phaseTime);
    }
    root.dataset.motionTime = elapsed.toFixed(3);
    if (root.dataset.mechanism === 'pump') {
      const info = motion.diagnostics();
      root.dataset.crankAngle = info.crankAngle.toFixed(3);
      root.dataset.pumpSpeedMultiplier = info.speedMultiplier.toFixed(3); root.dataset.pumpSpeedPhase = info.speedPhase;
      root.style.setProperty('--pump-annotation-opacity', info.annotationOpacity.toFixed(4));
      root.dataset.pumpStroke = info.stroke;
      root.dataset.pumpGhostAmount = info.ghostAmount.toFixed(3); root.dataset.pumpGhostPhase = info.ghostPhase;
      root.dataset.inletOpen = String(info.inletOpen); root.dataset.outletOpen = String(info.outletOpen);
      root.dataset.rodError = String(info.rodError); root.dataset.sliderError = String(info.sliderError);
      root.dataset.bearingError = String(info.bearingError); root.dataset.pistonSwing = String(info.swing);
      root.dataset.pins = JSON.stringify(info.pins);
      annotations.forEach((item, index) => {
        const open = index === 0 ? info.inletOpen : info.outletOpen;
        item.dataset.open = String(open);
        item.textContent = open ? item.dataset.openText! : item.dataset.closedText!;
      });
    }
    stage.render();
    detail?.setAttribute('aria-pressed', String(stage.isInspecting('steering-input')));
    sensorDetail?.setAttribute('aria-pressed', String(stage.isInspecting('optical-pcb')));
    root.dataset.inspection = stage.isInspecting('optical-pcb') ? 'optical-pcb' : stage.isInspecting('steering-input') ? 'steering-input' : 'none';
    root.dataset.cameraPosition = JSON.stringify(stage.camera.position.toArray());
    root.dataset.orbitTarget = JSON.stringify(stage.controls.target.toArray());
    root.dataset.screenBounds = JSON.stringify(stage.screenBounds());
  };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; root.dataset.rendering = 'false'; };
  const tick = (now: number) => {
    frame = 0;
    if (!visible || !stage || !cycle) return;
    const dt = previous ? Math.min((now - previous) / 1000, .1) : 0;
    previous = now;
    const previousExplode = explode;
    const automatic = playing && !holding && now - lastInteraction >= 5000;
    root.dataset.autoState = automatic ? 'playing' : playing ? 'interaction' : 'paused';
    if (automatic) {
      if (reconnect) {
        phaseTime = explode < .0001 ? 0 : explode > .9999 ? cycle.EXPLODED_START : cycle.cycleAtAmount(explode, phase === 'closing');
        reconnect = false; blend = 0;
      }
      blend = Math.min(1, blend + dt);
      const weight = blend * blend * (3 - 2 * blend);
      elapsed += dt * weight;
      if (root.dataset.mechanism === 'swerve') {
        phaseTime += dt * weight;
        const sample = cycle.swervePresentation(phaseTime);
        explode = sample.amount; target = explode; phase = sample.phase;
        stage.autoOrbit(dt, elapsed, weight * sample.orbitWeight);
      }
      if (root.dataset.mechanism !== 'swerve') stage.autoOrbit(dt, elapsed, weight);
    } else {
      const difference = target - explode;
      if (Math.abs(difference) >= .001) phase = difference > 0 ? 'opening' : 'closing';
      else if (explode < .001) phase = 'assembled';
      else if (explode > .999) phase = 'exploded';
      explode = Math.abs(difference) < .001 ? target : explode + difference * (1 - Math.exp(-dt * 8));
    }
    sync();
    if (automatic || explode !== previousExplode || dt === 0) { draw(); root.dataset.rendering = 'true'; }
    else root.dataset.rendering = 'false';
    if (playing || explode !== target) frame = requestAnimationFrame(tick);
  };
  const run = () => {
    // A paused viewer has no ticking clock. Do not turn idle time into a large
    // first animation step when the user next moves the slider or a button.
    if (!frame && visible && stage) { previous = 0; frame = requestAnimationFrame(tick); }
  };
  buttons.forEach(b => b.addEventListener('click', () => { interaction(); target = Number(b.dataset.explodeTo); sync(); run(); }));
  detail?.addEventListener('click', () => { interaction(); target = 1; stage?.inspect(['steering-input', 'steering-output']); draw(); run(); });
  sensorDetail?.addEventListener('click', () => {
    interaction();
    if (stage?.isInspecting('optical-pcb')) stage.resetView();
    else stage?.inspect(['optical-pcb', 'slip-ring', 'optical-target']);
    draw(); run();
  });
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
      try {
        stage = next; motion = module.createModuleMotion(stage, root.dataset.mechanism as 'pump' | 'swerve');
        if (root.dataset.mechanism === 'swerve') stage.reserveSwerveView((time, amount) => motion!.update(time, amount, amount === 0 ? module.swervePresentation(time) : undefined), module.CYCLE_DURATION);
        if (root.dataset.mechanism === 'swerve') stage.onSwerveViewChange(() => layoutSwerveAnnotations(root, next, explode, phase));
        else stage.onPumpViewChange(() => { if (motion) layoutPumpAnnotations(root, motion); });
      }
      catch (error) { next.dispose(); stage = undefined; throw error; }
      return {
        setVisible(value) { visible = value; if (value) { draw(); run(); } else stop(); },
        dispose() { visible = false; stop(); next.dispose(); stage = undefined; motion = undefined; },
      };
    },
    loading() { delete root.dataset.failedState; status.hidden = false; status.textContent = root.dataset.loading!; },
    ready() { root.dataset.ready = 'true'; controls.hidden = false; controls.inert = false; status.hidden = true; },
    reset() { holder.replaceChildren(); controls.hidden = true; controls.inert = true; label.hidden = true; annotations.forEach(a => a.hidden = true); root.querySelector('[data-swerve-leaders], [data-pump-leaders]')?.setAttribute('hidden', ''); root.dataset.ready = 'false'; status.hidden = root.dataset.failedState !== 'true'; },
    failed(error) { root.dataset.failedState = 'true'; status.hidden = false; status.textContent = root.dataset.failed!; console.warn('Mechanism unavailable', error); },
  });
  sync();
});
