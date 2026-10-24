import assert from 'node:assert/strict';
import test from 'node:test';
import * as timeline from '../../src/scripts/lib/mechanism-timeline.ts';
import * as motion from '../../src/scripts/module-motion.ts';

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (tolerance ${tolerance})`);
};

test('the scene entry point preserves every existing timeline export', () => {
  for (const name of ['ARTICULATION_START', 'CYCLE_DURATION', 'EXPLODED_START',
    'PUMP_CYCLE_DURATION', 'PUMP_DRIVE_DURATION', 'SWERVE_PRESENTATION_DURATION',
    'pumpTransparencyCycle', 'pumpDriveCycle', 'explosionCycle', 'swervePresentation',
    'swerveAngles', 'swervePartProgress', 'cycleAtAmount']) {
    assert.equal(motion[name], timeline[name], name);
  }
});

test('appearance and bounded wheel motion repeat across positive and negative clocks', () => {
  for (let i = -512; i <= 512; i++) {
    const time = i / 16;
    const pump = timeline.pumpTransparencyCycle(time);
    const nextPump = timeline.pumpTransparencyCycle(time + timeline.PUMP_CYCLE_DURATION);
    close(pump.amount, nextPump.amount);
    assert.equal(pump.phase, nextPump.phase);
    const explosion = timeline.explosionCycle(time);
    const nextExplosion = timeline.explosionCycle(time + timeline.CYCLE_DURATION);
    close(explosion.amount, nextExplosion.amount);
    assert.equal(explosion.phase, nextExplosion.phase);
    const angles = timeline.swerveAngles(time, .5);
    const nextAngles = timeline.swerveAngles(time + timeline.CYCLE_DURATION, .5);
    close(angles.roll, nextAngles.roll);
    close(angles.steer, nextAngles.steer);
  }
});

test('pump and explosion appearance remain continuous at phase boundaries', () => {
  const epsilon = 1e-7;
  for (const time of [0, 2, 5, 9, timeline.PUMP_CYCLE_DURATION]) {
    close(timeline.pumpTransparencyCycle(time - epsilon).amount,
      timeline.pumpTransparencyCycle(time + epsilon).amount);
  }
  for (const time of [0, 2.2, timeline.EXPLODED_START, timeline.EXPLODED_START + 3,
    timeline.ARTICULATION_START - 1.3, timeline.ARTICULATION_START,
    timeline.ARTICULATION_START + 8, timeline.CYCLE_DURATION]) {
    close(timeline.explosionCycle(time - epsilon).amount,
      timeline.explosionCycle(time + epsilon).amount);
  }
});

test('resuming either eased explosion leg recovers the requested amount', () => {
  for (const closing of [false, true]) {
    for (let i = 0; i <= 2048; i++) {
      const amount = i / 2048;
      const time = timeline.cycleAtAmount(amount, closing);
      close(timeline.explosionCycle(time).amount, amount, 6e-8);
    }
  }
});

test('pump drive stays continuous, strictly advances, and integrates the advertised speed', () => {
  let previous = -Infinity;
  for (let i = -3072; i <= 15360; i++) {
    const time = i / 128;
    const drive = timeline.pumpDriveCycle(time);
    assert.ok(drive.cumulativeAngle > previous, `crank reversed or stopped at ${time}`);
    assert.ok(drive.angle >= 0 && drive.angle < 2 * Math.PI);
    assert.ok(drive.speedMultiplier >= 1 && drive.speedMultiplier <= 4);
    assert.ok(drive.annotationOpacity >= 0 && drive.annotationOpacity <= 1);
    previous = drive.cumulativeAngle;
  }
  for (const time of [0, 7, 8, 10, timeline.PUMP_DRIVE_DURATION]) {
    const epsilon = 1e-6;
    const before = timeline.pumpDriveCycle(time - epsilon);
    const after = timeline.pumpDriveCycle(time + epsilon);
    close(before.cumulativeAngle, after.cumulativeAngle, 3e-5);
    close(before.speedMultiplier, after.speedMultiplier);
    close(before.annotationOpacity, after.annotationOpacity);
    close((after.cumulativeAngle - before.cumulativeAngle) / (2 * epsilon),
      2.8 * timeline.pumpDriveCycle(time).speedMultiplier, 1e-7);
  }
  for (const time of [-17.5, -1, 0, 7.5, 9, 11, 29]) {
    const drive = timeline.pumpDriveCycle(time);
    const next = timeline.pumpDriveCycle(time + timeline.PUMP_DRIVE_DURATION);
    close(next.cumulativeAngle - drive.cumulativeAngle, 63);
    close(next.speedMultiplier, drive.speedMultiplier);
    close(next.annotationOpacity, drive.annotationOpacity);
    assert.equal(next.phase, drive.phase);
  }
});

test('swerve loop boundaries preserve pose and alternating rounds reverse steering', () => {
  const epsilon = 1e-7;
  for (let round = -2; round <= 2; round++) {
    for (const offset of [0, .8, 2.2, timeline.EXPLODED_START,
      timeline.EXPLODED_START + 3, timeline.ARTICULATION_START - 1.3,
      timeline.ARTICULATION_START, timeline.ARTICULATION_START + 8,
      timeline.CYCLE_DURATION]) {
      const time = round * timeline.CYCLE_DURATION + offset;
      for (let wheel = 0; wheel < 4; wheel++) {
        const before = timeline.swervePresentation(time - epsilon, wheel);
        const after = timeline.swervePresentation(time + epsilon, wheel);
        for (const field of ['amount', 'overview', 'bodyOpacity', 'otherOpacity',
          'orbitWeight', 'suspension', 'steering', 'alignment']) {
          close(before[field], after[field]);
        }
        // One full roll returns to the same orientation at the end of the demo.
        close(Math.sin(before.roll), Math.sin(after.roll));
        close(Math.cos(before.roll), Math.cos(after.roll));
      }
    }
  }
  const time = timeline.ARTICULATION_START + 1.2;
  const first = timeline.swervePresentation(time);
  const second = timeline.swervePresentation(time + timeline.CYCLE_DURATION);
  assert.notEqual(first.steering, 0);
  close(first.steering, -second.steering);
  close(first.roll, second.roll);
});

test('steering separates before the drive stack and part progress remains bounded', () => {
  for (let i = -100; i <= 1100; i++) {
    const amount = i / 1000;
    for (const group of [undefined, 'steering', 'drive']) {
      const progress = timeline.swervePartProgress(amount, group);
      assert.ok(progress >= 0 && progress <= 1);
    }
  }
  assert.equal(timeline.swervePartProgress(.32, 'steering'), 1);
  assert.equal(timeline.swervePartProgress(.42, 'drive'), 0);
  assert.equal(timeline.swervePartProgress(.9, 'drive'), 1);
});
