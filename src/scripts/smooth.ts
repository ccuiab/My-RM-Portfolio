import type Lenis from 'lenis';

const mode = matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)');
let lenis: Lenis | undefined;
let frame = 0, generation = 0, dead = false;
const host = window as unknown as { __lenis?: Lenis };
const stop = () => { cancelAnimationFrame(frame); frame = 0; };
const tick = (time: number) => {
  frame = 0;
  if (!lenis || document.hidden) return;
  lenis.raf(time);
  if (lenis.isScrolling === 'smooth') frame = requestAnimationFrame(tick);
};
const wake = () => {
  if (!frame && lenis && !document.hidden) {
    // Reset the idle clock so the first wheel event cannot jump to its target.
    lenis.time = performance.now();
    frame = requestAnimationFrame(tick);
  }
};
const configure = async () => {
  const current = ++generation;
  stop(); lenis?.destroy(); lenis = undefined; delete host.__lenis;
  if (!mode.matches || dead) return;
  const { default: Lenis } = await import('lenis');
  if (current !== generation || dead || !mode.matches) return;
  lenis = new Lenis({ lerp: .11, wheelMultiplier: 1 });
  lenis.on('virtual-scroll', wake);
  // Wake programmatic scrollTo calls as well as wheel input.
  const scrollTo = lenis.scrollTo.bind(lenis);
  lenis.scrollTo = (...args) => { scrollTo(...args); wake(); };
  host.__lenis = lenis;
};
const visibility = () => { if (document.hidden) stop(); else if (lenis?.isScrolling === 'smooth') wake(); };
const cleanup = () => {
  dead = true; ++generation; stop(); lenis?.destroy(); lenis = undefined; delete host.__lenis;
  mode.removeEventListener('change', configure);
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('pageshow', visibility);
};
mode.addEventListener('change', configure);
document.addEventListener('visibilitychange', visibility);
window.addEventListener('pageshow', visibility);
window.addEventListener('pagehide', event => { if (event.persisted) stop(); else cleanup(); });
document.addEventListener('astro:before-swap', cleanup, { once: true });
void configure();
