/** Deadline-based pacing avoids dropping every third refresh because of small jitter. */
export class FrameClock {
  private previous: number | undefined;
  private deadline = 0;
  private readonly interval: number;
  constructor(fps = 60) { this.interval = 1000 / fps; }
  reset() { this.previous = undefined; this.deadline = 0; }
  sample(now: number): number | undefined {
    if (this.previous !== undefined && now + .5 < this.deadline) return undefined;
    const elapsed = this.previous === undefined ? 0 : Math.min(.1, Math.max(0, (now - this.previous) / 1000));
    if (this.previous === undefined || now - this.deadline > 100) this.deadline = now + this.interval;
    else this.deadline += Math.max(1, Math.floor((now - this.deadline + .5) / this.interval) + 1) * this.interval;
    this.previous = now;
    return elapsed;
  }
}
