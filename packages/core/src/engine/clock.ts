// Simulated time. The clock starts at a fixed instant and then runs at real speed, so audit entries
// keep their order; users can jump ahead to watch access windows end.

export class SimClock {
  private base: number;
  private startedAt: number;

  constructor(
    private readonly start: string,
    private readonly realNow: () => number = Date.now,
  ) {
    this.base = Date.parse(start);
    this.startedAt = realNow();
  }

  now(): Date {
    return new Date(this.base + (this.realNow() - this.startedAt));
  }

  advance(ms: number): Date {
    if (!Number.isFinite(ms) || ms <= 0) throw new RangeError('Time can only move forward.');
    this.base += ms;
    return this.now();
  }

  /** Jump to an exact instant, used by tests to sit on a window boundary. Never backwards. */
  set(iso: string): Date {
    const target = Date.parse(iso);
    if (Number.isNaN(target)) throw new RangeError(`Not a date: ${iso}`);
    if (target < this.now().getTime()) throw new RangeError('Time can only move forward.');
    this.base = target;
    this.startedAt = this.realNow();
    return this.now();
  }

  reset(): Date {
    this.base = Date.parse(this.start);
    this.startedAt = this.realNow();
    return this.now();
  }
}
