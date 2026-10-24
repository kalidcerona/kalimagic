/** GO/HIT handler to source.start(), plus the output latency the context reports. */
export class GoTimer {
  constructor(now, maxHistory = 50) { this.now = now; this.maxHistory = maxHistory; this.history = []; this.pending = null; this.last = null; }
  start(label, eventAgeMs = 0) { this.pending = { label, t0: this.now(), eventAgeMs: Math.max(0, eventAgeMs) }; }
  started(cueName, latency = {}) {
    const p = this.pending;
    if (!p) return null;
    this.pending = null;
    const entry = {
      label: p.label, cue: cueName, handlerMs: round(this.now() - p.t0), eventAgeMs: round(p.eventAgeMs),
      outputLatencyMs: latency.outputLatency ? round(latency.outputLatency * 1000) : null,
      baseLatencyMs: latency.baseLatency ? round(latency.baseLatency * 1000) : null
    };
    this.last = entry;
    this.history.push(entry);
    if (this.history.length > this.maxHistory) this.history.shift();
    return entry;
  }
  cancel() { this.pending = null; }
}
const round = n => Math.round(n * 100) / 100;
export function describeTiming(entry) {
  if (!entry) return '';
  const extra = [entry.outputLatencyMs !== null ? `출력 ${entry.outputLatencyMs}ms` : '', entry.baseLatencyMs !== null ? `기본 ${entry.baseLatencyMs}ms` : ''].filter(Boolean).join(', ');
  return `${entry.label} ${(entry.handlerMs + entry.eventAgeMs).toFixed(1)}ms` + (extra ? ` (${extra})` : '');
}
