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

// A pending GLB decode owns its slot until it finishes, even after scrolling
// away. This also bounds contexts during fast scrolls and stale async loads.
const slots = new Set<object>();
const waiting = new Set<() => void>();
const drain = () => { for (const start of [...waiting]) { if (slots.size >= 2) break; start(); } };

/** Lightweight entry point: no Three.js imports until the view intersects. */
export function mountViewportScene(options: Options) {
  const mode = window.matchMedia(options.media);
  let inView = false, pending = false, dead = false, failed = false;
  let generation = 0;
  let scene: ViewportScene | undefined;
  let loading: AbortController | undefined;
  const owner = {};
  const wanted = () => inView && mode.matches && !document.hidden && !dead;
  const release = () => {
    slots.delete(owner);
    options.root.dataset.context = 'released';
    drain();
  };
  const start = async () => {
    if (!wanted() || scene || pending || failed) { waiting.delete(start); return; }
    if (slots.size >= 2) { waiting.add(start); return; }
    waiting.delete(start);
    slots.add(owner);
    pending = true;
    const current = ++generation;
    loading = new AbortController();
    options.root.dataset.context = 'loading';
    options.loading();
    try {
      const next = await options.load(loading.signal);
      if (!next) return;
      if (current !== generation || !wanted()) { next.dispose(); return; }
      scene = next;
      options.root.dataset.context = 'active';
      options.ready();
      scene.setVisible(true);
    } catch (error) {
      if (current === generation && wanted()) { failed = true; options.failed(error); }
    } finally {
      loading = undefined;
      pending = false;
      if (!scene) { options.reset(); release(); if (wanted() && !failed) void start(); }
    }
  };
  const unload = () => {
    waiting.delete(start);
    ++generation;
    loading?.abort();
    loading = undefined;
    scene?.dispose();
    scene = undefined;
    options.reset();
    if (!pending) release();
  };
  const sync = () => {
    if (!inView || !mode.matches) { unload(); return; }
    if (document.hidden) { scene?.setVisible(false); return; }
    scene?.setVisible(true);
    void start();
  };
  const observer = new IntersectionObserver(([entry]) => {
    const entering = !inView && entry.isIntersecting;
    inView = entry.isIntersecting;
    if (entering) failed = false;
    sync();
  });
  observer.observe(options.view);
  mode.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  const pageShow = () => sync();
  window.addEventListener('pageshow', pageShow);
  const cleanup = () => {
    dead = true;
    observer.disconnect();
    mode.removeEventListener('change', sync);
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('pageshow', pageShow);
    unload();
  };
  window.addEventListener('pagehide', event => { if (event.persisted) scene?.setVisible(false); else cleanup(); });
  document.addEventListener('astro:before-swap', cleanup, { once: true });
  options.reset();
  return { cleanup };
}
