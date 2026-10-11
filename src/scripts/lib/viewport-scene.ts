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
  eligible: () => boolean;
  busy: () => boolean;
  start: () => void;
  unload: () => void;
  suspend: () => void;
};

const limit = 2;
const candidates = new Set<Candidate>();
// An aborted decode keeps its slot until its loader has disposed the renderer.
// This bounds live contexts even while stale asynchronous work is settling.
const slots = new Set<Candidate>();
let frame = 0;
let navigation: HTMLElement | null = null;
let navigationObserver: ResizeObserver | undefined;
const schedule = () => { if (!frame) frame = requestAnimationFrame(reconcile); };
const reconcile = () => {
  frame = 0;
  const rect = navigation?.getBoundingClientRect();
  const top = rect && rect.top <= 0 ? Math.max(0, rect.bottom) : 0;
  for (const candidate of candidates) candidate.measure(top);
  if (document.hidden) {
    for (const candidate of candidates) candidate.suspend();
    return;
  }
  const ranked = [...candidates].filter(candidate => candidate.eligible()).sort((a, b) =>
    b.ratio - a.ratio || b.area - a.area || Number(slots.has(b)) - Number(slots.has(a)));
  const selected = new Set(ranked.slice(0, limit));
  // Release low-visibility owners before admitting the most visible views.
  for (const candidate of candidates) if (!selected.has(candidate)) candidate.unload();
  for (const candidate of selected) {
    if (slots.has(candidate) || slots.size < limit) candidate.start();
    // Decode/first-render the main view before spending CPU on the fringe view.
    if (candidate.busy()) break;
  }
};
const listen = () => {
  navigation = document.querySelector<HTMLElement>('.topbar');
  navigationObserver = new ResizeObserver(schedule);
  if (navigation) navigationObserver.observe(navigation);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', schedule);
};
const unlisten = () => {
  cancelAnimationFrame(frame); frame = 0;
  navigationObserver?.disconnect(); navigationObserver = undefined; navigation = null;
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  window.removeEventListener('pageshow', schedule);
  document.removeEventListener('visibilitychange', schedule);
};

/** No Three.js imports until this view wins one of the two viewport slots. */
export function mountViewportScene(options: Options) {
  const mode = window.matchMedia(options.media);
  let pending = false, dead = false, failed = false, generation = 0;
  let scene: ViewportScene | undefined;
  let loading: AbortController | undefined;
  const candidate: Candidate = {
    ratio: 0, area: 0,
    measure(top) {
      const rect = options.view.getBoundingClientRect();
      const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, top));
      const area = width * height;
      if (!candidate.area && area) failed = false;
      candidate.area = area;
      candidate.ratio = rect.width * rect.height > 0 ? area / (rect.width * rect.height) : 0;
    },
    eligible: () => candidate.area > 0 && mode.matches && !dead && !failed,
    busy: () => pending,
    start: () => { scene?.setVisible(true); void start(); },
    unload: () => unload(),
    suspend: () => scene?.setVisible(false),
  };
  const release = () => {
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
  mode.addEventListener('change', schedule);
  const pageHide = (event: PageTransitionEvent) => { if (event.persisted) candidate.suspend(); else cleanup(); };
  const cleanup = () => {
    if (dead) return;
    dead = true;
    observer.disconnect();
    mode.removeEventListener('change', schedule);
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
