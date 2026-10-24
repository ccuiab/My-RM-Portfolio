/** Draws HUD corners/rulers in once and rolls readout numbers to their value.
 * Reduced motion or no IntersectionObserver: everything shows its end state. */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

function countUp(el: HTMLElement) {
  const text = el.dataset.count ?? el.textContent ?? '';
  const m = text.match(/^(\D*?)(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return;
  const [, pre, num, post] = m, target = Number(num), places = num.split('.')[1]?.length ?? 0;
  const start = performance.now(), dur = 650;
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / dur), eased = 1 - (1 - k) ** 3;
    el.textContent = pre + (target * eased).toFixed(places) + post;
    if (k < 1) requestAnimationFrame(step); else el.textContent = text;
  };
  el.dataset.count = text;
  requestAnimationFrame(step);
}

if (!reduced && 'IntersectionObserver' in window) {
  root.classList.add('hud-js');
  const io = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      io.unobserve(el);
      el.classList.add('is-in');
      el.querySelectorAll<HTMLElement>('[data-count-up]').forEach(countUp);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.hud-frame, [data-hud-reveal]').forEach(el => io.observe(el));
} else {
  document.querySelectorAll('.hud-frame, [data-hud-reveal]').forEach(el => el.classList.add('is-in'));
}
