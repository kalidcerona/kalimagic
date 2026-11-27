// ---------- OnceGate ----------

export class OnceGate {
  constructor(windowMs = 3000, clock = () => Date.now()) { this.windowMs = windowMs; this.clock = clock; this.lastFired = null; }
  tryFire() {
    const now = this.clock();
    if (this.lastFired !== null && now - this.lastFired < this.windowMs) return false;
    this.lastFired = now;
    return true;
  }
  reset() { this.lastFired = null; }
}
