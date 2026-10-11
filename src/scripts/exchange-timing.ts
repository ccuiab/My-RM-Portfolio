// At 25 fps, the POV exchange panel first appears at frames 45 / 294
// and is replaced by “运动中” at frames 107 / 382. These visible UI
// intervals anchor the animation; its cumulative display is normalized to the official 5.8 s result.
export const exchangeIntervals = [[1.8, 4.28], [11.76, 15.28]] as const;

export function exchangeAt(time: number) {
  const activeDuration = exchangeIntervals.reduce((sum, [start, end]) => sum + end - start, 0);
  const elapsed = exchangeIntervals.reduce((sum, [start, end]) =>
    sum + Math.max(0, Math.min(time, end) - start), 0);
  const seconds = Math.min(5.8, elapsed / activeDuration * 5.8);
  const state = time < exchangeIntervals[0][0] ? 'ready'
    : time < exchangeIntervals[0][1] ? 'first'
    : time < exchangeIntervals[1][0] ? 'between'
    : time < exchangeIntervals[1][1] ? 'second' : 'done';
  return { seconds, state };
}
