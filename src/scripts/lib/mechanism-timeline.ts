import { MathUtils } from 'three';

/** Numeric presentation clocks, independent of CAD nodes and scene mutation. */
export const TAU = Math.PI * 2;
// Whole vehicle → one module → whole vehicle, with continuous loop endpoints.
const HOLD_ASSEMBLED = 2.2, OPEN = 6, HOLD_EXPLODED = 3, CLOSE = 6;
const PULL_BACK = 1.3, ARTICULATE = 8, RESTORE_BODY = .5;
export const ARTICULATION_START = HOLD_ASSEMBLED + OPEN + HOLD_EXPLODED + CLOSE + PULL_BACK;
export const CYCLE_DURATION = ARTICULATION_START + ARTICULATE + RESTORE_BODY;
/** Cycle time at which the exploded hold begins. */
export const EXPLODED_START = HOLD_ASSEMBLED + OPEN;
export const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const HOLD_SOLID = 2, FADE_OUT = 3, HOLD_GHOSTED = 4, FADE_IN = 3;
export const PUMP_CYCLE_DURATION = HOLD_SOLID + FADE_OUT + HOLD_GHOSTED + FADE_IN;
/** The pump keeps its current ghosted appearance at the transparent endpoint. */
export function pumpTransparencyCycle(time: number) {
  const t = ((time % PUMP_CYCLE_DURATION) + PUMP_CYCLE_DURATION) % PUMP_CYCLE_DURATION;
  if (t < HOLD_SOLID) return { amount: 0, phase: 'solid' };
  if (t < HOLD_SOLID + FADE_OUT) return { amount: ease((t - HOLD_SOLID) / FADE_OUT), phase: 'fading-out' };
  if (t < HOLD_SOLID + FADE_OUT + HOLD_GHOSTED) return { amount: 1, phase: 'ghosted' };
  return { amount: 1 - ease((t - HOLD_SOLID - FADE_OUT - HOLD_GHOSTED) / FADE_IN), phase: 'fading-in' };
}
const PUMP_SLOW = 7, PUMP_ACCELERATE = 1, PUMP_FAST = 2, PUMP_DECELERATE = 2;
export const PUMP_BASE_SPEED = 2.8;
const PUMP_PEAK_MULTIPLIER = 4;
export const PUMP_DRIVE_DURATION = PUMP_SLOW + PUMP_ACCELERATE + PUMP_FAST + PUMP_DECELERATE;
// Integral of the same quintic easing curve; its value at 1 is 1/2.
const integratedEase = (x: number) => x * x * x * x * (x * x - 3 * x + 2.5);
/** Brief speed pulse on its own clock. Integrate velocity so neither changes
 * in speed nor wrapping the cycle can jump or reverse the crank angle. */
export function pumpDriveCycle(time: number) {
  const cycles = Math.floor(time / PUMP_DRIVE_DURATION);
  const t = ((time % PUMP_DRIVE_DURATION) + PUMP_DRIVE_DURATION) % PUMP_DRIVE_DURATION;
  const boost = PUMP_PEAK_MULTIPLIER - 1;
  const rampAverage = (1 + PUMP_PEAK_MULTIPLIER) / 2;
  let travel = t, speedMultiplier = 1, annotationOpacity = 1;
  let phase = 'slow';
  if (t >= PUMP_SLOW && t < PUMP_SLOW + PUMP_ACCELERATE) {
    const x = (t - PUMP_SLOW) / PUMP_ACCELERATE, amount = ease(x);
    phase = 'accelerating'; speedMultiplier = 1 + boost * amount; annotationOpacity = 1 - amount;
    travel = PUMP_SLOW + PUMP_ACCELERATE * (x + boost * integratedEase(x));
  } else if (t >= PUMP_SLOW + PUMP_ACCELERATE && t < PUMP_SLOW + PUMP_ACCELERATE + PUMP_FAST) {
    phase = 'fast'; speedMultiplier = PUMP_PEAK_MULTIPLIER; annotationOpacity = 0;
    travel = PUMP_SLOW + PUMP_ACCELERATE * rampAverage
      + (t - PUMP_SLOW - PUMP_ACCELERATE) * PUMP_PEAK_MULTIPLIER;
  } else if (t >= PUMP_SLOW + PUMP_ACCELERATE + PUMP_FAST) {
    const x = (t - PUMP_SLOW - PUMP_ACCELERATE - PUMP_FAST) / PUMP_DECELERATE, amount = ease(x);
    phase = 'decelerating'; speedMultiplier = PUMP_PEAK_MULTIPLIER - boost * amount; annotationOpacity = amount;
    travel = PUMP_SLOW + PUMP_ACCELERATE * rampAverage + PUMP_FAST * PUMP_PEAK_MULTIPLIER
      + PUMP_DECELERATE * (PUMP_PEAK_MULTIPLIER * x - boost * integratedEase(x));
  }
  const cycleTravel = PUMP_SLOW + (PUMP_ACCELERATE + PUMP_DECELERATE) * rampAverage + PUMP_FAST * PUMP_PEAK_MULTIPLIER;
  const cumulativeAngle = (cycles * cycleTravel + travel) * PUMP_BASE_SPEED;
  return { angle: ((cumulativeAngle % TAU) + TAU) % TAU, cumulativeAngle, speedMultiplier, annotationOpacity, phase };
}
export function explosionCycle(time: number) {
  const t = ((time % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  if (t < HOLD_ASSEMBLED) return { amount: 0, phase: 'assembled' };
  if (t < EXPLODED_START) return { amount: ease((t - HOLD_ASSEMBLED) / OPEN), phase: 'opening' };
  if (t < EXPLODED_START + HOLD_EXPLODED) return { amount: 1, phase: 'exploded' };
  const closeStart = EXPLODED_START + HOLD_EXPLODED;
  if (t < closeStart + CLOSE) return { amount: 1 - ease((t - closeStart) / CLOSE), phase: 'closing' };
  return { amount: 0, phase: t < ARTICULATION_START ? 'pullback' : t < ARTICULATION_START + ARTICULATE ? 'articulation' : 'returning' };
}
export const SWERVE_PRESENTATION_DURATION = CYCLE_DURATION;
/** Smooth, compact response: fast compression, smaller rebounds, then exact rest. */
function sampleKeys(time: number, keys: readonly (readonly [number, number])[]) {
  for (let i = 1; i < keys.length; i++) {
    const [end, value] = keys[i], [start, previous] = keys[i - 1];
    if (time <= end) return MathUtils.lerp(previous, value, ease(MathUtils.clamp((time - start) / (end - start), 0, 1)));
  }
  return keys[keys.length - 1][1];
}
const impactResponse = [[0, 0], [.085, 1], [.24, .12], [.34, .32], [.49, .035], [.6, .09], [.8, 0]] as const;
/** Seeded road events vary between rounds, not between frames. This is a bounded
 * visual response, not a calibrated spring/damper or a claimed physical limit. */
export function swervePresentation(time: number, wheel = 0) {
  const t = ((time % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  const ramp = (x: number) => ease(MathUtils.clamp(x, 0, 1));
  const focus = ramp((t - .8) / 1.4), pullback = ramp((t - ARTICULATION_START + PULL_BACK) / PULL_BACK);
  const overview = t < HOLD_ASSEMBLED ? 1 - focus : pullback;
  const bodyOpacity = t < HOLD_ASSEMBLED ? 1 - focus : t < ARTICULATION_START ? .12 * pullback
    : MathUtils.lerp(.12, 1, ramp((t - ARTICULATION_START - ARTICULATE) / RESTORE_BODY));
  const detail = t >= HOLD_ASSEMBLED && t < ARTICULATION_START - PULL_BACK;
  const demoTime = t - ARTICULATION_START;
  const articulation = demoTime >= 0 && demoTime < ARTICULATE;
  const orbitWeight = detail ? ramp((t - HOLD_ASSEMBLED) / .4) * ramp((ARTICULATION_START - PULL_BACK - t) / .4)
    : articulation ? ramp(demoTime / .4) * ramp((ARTICULATE - demoTime) / .4) : 0;
  const common = { ...explosionCycle(t), overview, bodyOpacity, otherOpacity: overview, orbitWeight,
    motionTime: MathUtils.clamp((t - HOLD_ASSEMBLED) / (OPEN + HOLD_EXPLODED + CLOSE), 0, 1) * CYCLE_DURATION };
  if (!articulation) return { ...common, phase: t < .8 ? 'overview' : t < HOLD_ASSEMBLED ? 'focus' : common.phase,
    suspension: 0, steering: 0, roll: 0, demo: !detail, alignment: 0 };
  const round = Math.floor(time / CYCLE_DURATION);
  const noise = (index: number) => {
    const x = Math.sin(round * 127.1 + index * 311.7 + 17.3) * 43758.5453;
    return x - Math.floor(x);
  };
  let suspension = 0;
  // One pronounced bump, a short rough patch, then a final bump and long rest.
  const events = [[.7, .009], [2.1, .0045], [2.48, .005], [4.85, .01]];
  events.forEach(([start, amplitude], i) => {
    const age = demoTime - start - wheel * .16 - (noise(i + wheel * 13) - .5) * .18;
    const responseTime = age / (.8 + .3 * noise(i + 10));
    if (responseTime >= 0 && responseTime <= .8) suspension += amplitude * (.8 + .2 * noise(i + 5)) * sampleKeys(responseTime, impactResponse);
  });
  const direction = round % 2 ? -1 : 1;
  const steering = direction * sampleKeys(demoTime, [[0, 0], [.3, 0], [.95, 1.15], [1.65, 1.15],
    [2.45, -.95], [3.25, -.95], [3.7, -.65], [4.4, -.65], [5.05, 1.05], [6.3, 1.05], [7.15, 0], [8, 0]]);
  // Rolling gives the direction changes a purpose. End at one full turn so
  // returning to the exploded-view pose is continuous, with no reverse snap.
  const roll = sampleKeys(demoTime, [[0, 0], [.3, 0], [1.35, 1.25], [1.8, 1.25],
    [3, 3.1], [3.9, 3.1], [5.3, 5.4], [6.8, TAU], [8, TAU]]);
  return { ...common, motionTime: 0, suspension, steering, roll, demo: true,
    alignment: ramp(demoTime / .3) * (1 - ramp((demoTime - 7.15) / .85)) };
}
/** Bounded, periodic demonstration: closing never unwinds accumulated turns. */
export function swerveAngles(time: number, _explode: number) {
  const phase = ((time % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION / CYCLE_DURATION * TAU;
  return { roll: Math.sin(phase) * .48, steer: Math.sin(phase) * .18 };
}
/** Steering clears first; the wheel-axis stack follows. Reverse is identical. */
export function swervePartProgress(amount: number, group?: string) {
  const interval = group === 'steering' ? [0, .32] : group === 'drive' ? [.42, .9] : [0, 1];
  return ease(MathUtils.clamp((amount - interval[0]) / (interval[1] - interval[0]), 0, 1));
}
/** Invert the eased leg, so an idle resume starts at the user's current amount. */
export function cycleAtAmount(amount: number, closing: boolean) {
  let lo = 0, hi = 1;
  const value = closing ? 1 - amount : amount;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < value) lo = mid; else hi = mid;
  }
  return (closing ? EXPLODED_START + HOLD_EXPLODED : HOLD_ASSEMBLED) + (closing ? CLOSE : OPEN) * (lo + hi) / 2;
}

