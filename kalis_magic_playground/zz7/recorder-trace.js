// A single paper-local path. Only active measurement time advances this state.
// Fixed integration steps make pen response independent of RAF cadence.
export function createContinuousTrace({distance = 0, position = 0, retain = 640, responseMs = 8, integrationMs = 4, smooth = false} = {}) {
  let samples = [{distance, position}], velocity = 0, run = null, elapsed = 0;
  let committed = {distance, position, velocity}, preview = committed;
  function step(state, dt, at) {
    const target = run.target(at), omega = 1 / responseMs;
    const delta = state.position - target, c = state.velocity + omega * delta;
    const decay = Math.exp(-omega * dt);
    return {distance: run.distance + run.speed * at,
      position: target + (delta + c * dt) * decay,
      velocity: (state.velocity - omega * c * dt) * decay};
  }
  function prune() {
    const cutoff = preview.distance - retain;
    let i = 0; while (i + 1 < samples.length && samples[i + 1].distance < cutoff) i++;
    if (i) samples.splice(0, i);
    if (samples.length > 8192) throw new Error('Visible trace exceeded sample budget');
  }
  return {
    begin({duration, travel, target}) {
      // Commit the exact previous endpoint; never append a new subpath.
      if (samples[samples.length-1].distance !== preview.distance) samples.push({distance:preview.distance,position:preview.position});
      committed = {...preview}; elapsed = 0;
      run = {duration, distance: preview.distance, speed: travel / duration, target};
    },
    advance(ms, freeze = false) {
      if (!run) return preview;
      const end = Math.max(elapsed, Math.min(run.duration, ms));
      while (elapsed + integrationMs <= end + 1e-9) {
        committed = step(committed, integrationMs, elapsed + integrationMs); elapsed += integrationMs;
        samples.push({distance: committed.distance, position: committed.position});
      }
      preview = end > elapsed ? step(committed, end - elapsed, end) : committed;
      if (freeze) {
        if (end > elapsed) samples.push({distance: preview.distance, position: preview.position});
        committed = {...preview}; elapsed = end; run = null;
      }
      prune(); return {...preview};
    },
    path(map) {
      const all = samples.slice();
      if (all[all.length - 1].distance !== preview.distance) all.push(preview);
      const xy = all.map(map), fmt = p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
      if (!smooth || xy.length < 2) return xy.map((p,i)=>`${i ? 'L' : 'M'}${fmt(p)}`).join(' ');
      // Monotone Hermite tangents: smooth joints without overshooting narrow impulses.
      const slope = (i, axis) => {
        if (i === 0 || i === all.length-1) return 0;
        const a = (xy[i][axis]-xy[i-1][axis])/(all[i].distance-all[i-1].distance);
        const b = (xy[i+1][axis]-xy[i][axis])/(all[i+1].distance-all[i].distance);
        return a*b > 0 ? 2*a*b/(a+b) : 0;
      };
      let d = `M${fmt(xy[0])}`;
      for (let i=1;i<xy.length;i++) {
        const h=(all[i].distance-all[i-1].distance)/3;
        const a=xy[i-1].map((v,k)=>v+h*slope(i-1,k));
        const b=xy[i].map((v,k)=>v-h*slope(i,k));
        d += ` C${fmt(a)} ${fmt(b)} ${fmt(xy[i])}`;
      }
      return d;
    },
    rebase(amount) {
      for (const p of samples) p.distance -= amount;
      committed = {...committed, distance: committed.distance - amount};
      preview = {...preview, distance: preview.distance - amount};
      if (run) run.distance -= amount;
    },
    snapshot: () => ({...preview, samples: samples.length, elapsed, active: !!run}),
  };
}
