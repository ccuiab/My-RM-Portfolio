export type ViewportScene = { setVisible: (visible: boolean) => void; dispose: () => void };
type Options = {
  root: HTMLElement;
  view: HTMLElement;
  media: string;
  load: (signal: AbortSignal) => Promise<ViewportScene | undefined>;
  loading: () => void;
  ready: () => void;
  reset: () => void;
  failed: (error: unknown) => void;
};
type Candidate = {
  measure: (top: number) => void;
  ratio: number;
  area: number;
  warmSince: number | null;
  supported: () => boolean;
  eligible: () => boolean;
  busy: () => boolean;
  start: () => void;
  unload: () => void;
  retain: () => void;
};

const limit = 2;
const retentionMs = 8000;
const candidates = new Set<Candidate>();
// An aborted decode keeps its slot until its loader has disposed the renderer.
// This bounds live contexts even while stale asynchronous work is settling.
const slots = new Set<Candidate>();
let frame = 0;
let navigation: HTMLElement | null = null;
let navigationObserver: ResizeObserver | undefined;
const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(reconcile); };
const reconcile = () => {
  frame = 0;
  const rect = navigation?.getBoundingClientRect();
  const top = rect && rect.top <= 0 ? Math.max(0, rect.bottom) : 0;
  for (const candidate of candidates) candidate.measure(top);
  const now = Date.now();
  // Timers can be frozen in the back-forward cache. Check the same deadline
  // before resuming so pageshow cannot revive an expired retained scene.
  for (const candidate of candidates) {
    if (!candidate.supported() || candidate.warmSince !== null && now - candidate.warmSince >= retentionMs) candidate.unload();
  }
  if (document.hidden) {
    for (const candidate of candidates) candidate.retain();
    return;
  }
  const ranked = [...candidates].filter(candidate => candidate.eligible()).sort((a, b) =>
    b.ratio - a.ratio || b.area - a.area || Number(slots.has(b)) - Number(slots.has(a)));
  const selected = new Set(ranked.slice(0, limit));
  // Retained scenes still own their slot, but always yield to a visible view.
  // In-flight loads never enter this cache: retain() aborts them immediately.
  for (const candidate of candidates) if (!selected.has(candidate)) candidate.retain();
  for (const candidate of selected) {
    if (!slots.has(candidate) && slots.size >= limit) {
      const oldest = [...slots].filter(owner => !selected.has(owner) && owner.warmSince !== null)
        .sort((a, b) => a.warmSince! - b.warmSince!)[0];
      oldest?.unload();
    }
    if (slots.has(candidate) || slots.size < limit) candidate.start();
    // Decode/first-render the main view before spending CPU on the fringe view.
    if (candidate.busy()) break;
  }
};
const visibilityChanged = () => {
  if (document.hidden) {
    // Hidden documents may not run rAF. Cancel pending work and stop scenes
    // synchronously instead of waiting for a frame that might never arrive.
    cancelAnimationFrame(frame); frame = 0;
    reconcile();
  } else schedule();
};
const listen = () => {
  navigation = document.querySelector<HTMLElement>('.topbar');
  navigationObserver = new ResizeObserver(schedule);
  if (navigation) navigationObserver.observe(navigation);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', visibilityChanged);
  document.addEventListener('visibilitychange', visibilityChanged);
};
const unlisten = () => {
  cancelAnimationFrame(frame); frame = 0;
  navigationObserver?.disconnect(); navigationObserver = undefined; navigation = null;
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  window.removeEventListener('pageshow', visibilityChanged);
  document.removeEventListener('visibilitychange', visibilityChanged);
};

/** No Three.js imports until this view wins one of the two viewport slots. */
export function mountViewportScene(options: Options) {
  const mode = window.matchMedia(options.media);
  let pending = false, dead = false, failed = false, generation = 0;
  let scene: ViewportScene | undefined;
  let loading: AbortController | undefined;
  let retentionTimer = 0;
  const candidate: Candidate = {
    ratio: 0, area: 0, warmSince: null,
    measure(top) {
      const rect = options.view.getBoundingClientRect();
      const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, top));
      const area = width * height;
      if (!candidate.area && area) failed = false;
      candidate.area = area;
      candidate.ratio = rect.width * rect.height > 0 ? area / (rect.width * rect.height) : 0;
    },
    supported: () => mode.matches && !dead && !failed,
    eligible: () => candidate.area > 0 && candidate.supported(),
    busy: () => pending,
    start: () => {
      if (scene) {
        clearRetention();
        options.root.dataset.context = 'active';
        scene.setVisible(true);
      } else void start();
    },
    unload: () => unload(),
    retain: () => {
      if (pending || !candidate.supported()) { unload(); return; }
      if (!scene) return;
      scene.setVisible(false);
      if (candidate.warmSince !== null) return;
      candidate.warmSince = Date.now();
      options.root.dataset.context = 'warm';
      retentionTimer = window.setTimeout(unload, retentionMs);
    },
  };
  const clearRetention = () => {
    clearTimeout(retentionTimer); retentionTimer = 0;
    candidate.warmSince = null;
  };
  const release = () => {
    clearRetention();
    slots.delete(candidate);
    options.root.dataset.context = 'released';
    if (candidates.size) schedule();
  };
  const start = async () => {
    if (!candidate.eligible() || document.hidden || scene || pending || slots.size >= limit) return;
    slots.add(candidate);
    pending = true;
    const current = ++generation;
    const controller = new AbortController();
    loading = controller;
    options.root.dataset.context = 'loading';
    options.loading();
    try {
      const next = await options.load(controller.signal);
      if (!next) return;
      if (current !== generation || !candidate.eligible() || controller.signal.aborted) { next.dispose(); return; }
      scene = next;
      options.root.dataset.context = 'active';
      options.ready();
      scene.setVisible(!document.hidden);
    } catch (error) {
      if (current === generation && candidate.eligible() && !controller.signal.aborted) { failed = true; options.failed(error); }
    } finally {
      loading = undefined;
      pending = false;
      if (!scene) { options.reset(); release(); }
      // Controls can change layout in other components. Re-measure all views.
      if (candidates.size) schedule();
    }
  };
  const unload = () => {
    clearRetention();
    if (!scene && !pending) return;
    if (loading?.signal.aborted) return;
    ++generation;
    loading?.abort();
    scene?.dispose(); scene = undefined;
    options.reset();
    if (!pending) release();
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(options.view);
  if (!candidates.size) listen();
  candidates.add(candidate);
  const modeChanged = () => { if (!mode.matches) unload(); schedule(); };
  mode.addEventListener('change', modeChanged);
  const pageHide = (event: PageTransitionEvent) => { if (event.persisted) candidate.retain(); else cleanup(); };
  const cleanup = () => {
    if (dead) return;
    dead = true;
    observer.disconnect();
    mode.removeEventListener('change', modeChanged);
    window.removeEventListener('pagehide', pageHide);
    document.removeEventListener('astro:before-swap', cleanup);
    candidates.delete(candidate);
    unload();
    if (!candidates.size) unlisten(); else schedule();
  };
  window.addEventListener('pagehide', pageHide);
  document.addEventListener('astro:before-swap', cleanup, { once: true });
  options.reset();
  options.root.dataset.context = 'released';
  schedule();
  return { cleanup };
}
