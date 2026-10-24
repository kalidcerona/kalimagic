// Entropy supplies the drawing; the approved lie reaction begins only at 75%.
function buildHeartbeat({durationMs, seed, verdict = "TRUE"}) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const smooth = x => x * x * (3 - 2 * x);
  const points = [[0, 62]], beats = [];
  let beat = 180, variation = 0, untilLong = 2, previousHeightVariation = 0;
  while (beat < durationMs * 1.5) {
    // Keep complete impulses clear of the shared 75% decision boundary.
    if (beat > durationMs * .75 - 100 && beat < durationMs * .75 + 60) beat = durationMs * .75 + 60;
    const progress = Math.min(1, beat / durationMs);
    const rise = progress < .5 ? smooth(progress / .5) : 1 - smooth((progress - .5) / .5);
    variation = variation * .5 + (random() - .5) * .03;
    const impulsePeriod = 22500 / (62 + 34 * rise) * (1 + variation);
    // Medium-medium-long-medium, with seeded group lengths and no repeated loop.
    const longGap = untilLong-- === 0;
    if (longGap) untilLong = 2 + Math.floor(random() * 3);
    const period = impulsePeriod * (longGap ? 2.18 : 1.65) * (1 + (random() - .5) * .08);
    const width = impulsePeriod * (1 + (random() - .5) * .06);
    // Compensate the 16ms pen response and denser impulses; render stays within the roll.
    let heightVariation = (random() - .5) * .24;
    if (Math.abs(heightVariation - previousHeightVariation) < .04) heightVariation = previousHeightVariation > 0 ? -.08 - random() * .04 : .08 + random() * .04;
    previousHeightVariation = heightVariation;
    const heightPx = (18 + 22 * rise) * (1 + heightVariation);
    const height = heightPx * 124 / 162.4 * 8.8;
    beats.push({at: beat, period, width, height, heightPx, rise});
    // One narrow engraved impulse; all inter-beat segments are straight.
    points.push([beat, 62], [beat + width * .025, 108.8], [beat + width * .06, 62 - height], [beat + width * .095, 124.4], [beat + width * .13, 62]);
    beat += period;
  }
  points.push([durationMs, 62]);
  const raw = points.filter(([t]) => t <= durationMs);
  const boundary = heartbeatValue({points: raw}, durationMs * .75);
  const transformed = raw.filter(([t]) => t < durationMs * .75);
  transformed.push([durationMs * .75, boundary]);
  if (verdict === "LIE") {
    const boundaryMs = durationMs * .75;
    // Compress complete normal impulses, including the next scheduled beat.
    // Height changes only the R tip; there is no separate recovery hump.
    const latePoints = points.slice(0, -1).filter(([t]) => t > boundaryMs);
    for (const [t, y] of latePoints) {
      const at = boundaryMs + (t - boundaryMs) * .72;
      transformed.push([at, y < 50 ? 62 + (y - 62) * 1.65 : y]);
    }
    if (!transformed.some(([t,y]) => t > boundaryMs && t <= durationMs && y < 50)) {
      // Very short tests still receive one complete, narrow normal-shaped beat.
      while (transformed.length && transformed[transformed.length-1][0] > boundaryMs) transformed.pop();
      const period = Math.min(beats[0].period * .72, durationMs * 1.2);
      const at = boundaryMs + durationMs * .025;
      const height = beats[0].height * 1.65;
      transformed.push([boundaryMs+2,62],[at,62],[at+period*.025,108.8],[at+period*.06,62-height],
        [at+period*.095,124.4],[at+period*.13,62]);
    }
    transformed.sort((a,b) => a[0] - b[0]);
    const end = heartbeatValue({points: transformed}, durationMs);
    while (transformed.length && transformed[transformed.length-1][0] > durationMs) transformed.pop();
    transformed.push([durationMs,end]);
  } else {
    transformed.push(...raw.filter(([t]) => t > durationMs * .75));
  }
  transformed.sort((a,b) => a[0] - b[0]);
  // The rise envelope and compressed impulse widths both attenuate late R peaks.
  // Calibrate input R tips against the same fixed-step pen response, before drawing.
  // No output clamp: the early waveform, pen state and monotone path stay intact.
  const boundaryMs = durationMs * .75;
  if (!transformed.some(([t,y]) => t > boundaryMs && t < durationMs && y < 50)) {
    const period = Math.min(beats[0].period, durationMs * .7);
    const at = boundaryMs + durationMs * .025;
    while (transformed.length && transformed[transformed.length-1][0] > boundaryMs) transformed.pop();
    transformed.push([boundaryMs+2,62],[at,62],[at+period*.025,108.8],[at+period*.06,62-beats[0].height],
      [at+period*.095,124.4],[at+period*.13,62],[durationMs,62]);
  }
  const allTips = transformed.map(([t,y],i) => y < 50 && t < durationMs ? i : -1).filter(i => i >= 0);
  const tips = allTips.filter(i => transformed[i][0] > boundaryMs);
  const original = tips.map(i => transformed[i][1]);
  const response = () => {
    let position = 62, velocity = 0, cursor = 1, region = 0;
    const heights = allTips.map(() => 0), times = allTips.map(() => 0), samples = [[0,0]];
    const omega = 1 / 16, decay = Math.exp(-omega * 2);
    for (let t = 2; t <= durationMs; t += 2) {
      while (cursor < transformed.length - 1 && transformed[cursor][0] < t) cursor++;
      const [a,b] = transformed[cursor-1], [at,y] = transformed[cursor];
      const u = Math.max(0, Math.min(1, (t-a)/(at-a || 1)));
      const target = b + (y-b)*u*u*(3-2*u);
      const delta = position-target, c = velocity+omega*delta;
      position = target+(delta+c*2)*decay;
      velocity = (velocity-omega*c*2)*decay;
      samples.push([t,62-position]);
      while (region < allTips.length-1 && t > (transformed[allTips[region]][0]+transformed[allTips[region+1]][0])/2) region++;
      if (62-position > heights[region]) { heights[region] = 62-position; times[region] = t; }
    }
    const early = samples.filter(([t,h],i) => t >= durationMs * 16 / 344 && t <= boundaryMs && i > 0 && i < samples.length-1 && h > 2 && h > samples[i-1][1] && h >= samples[i+1][1]).map(([,h]) => h);
    return {heights,times,early,samples};
  };
  // Calibrate the average of rendered R peaks, rather than the largest peak.
  // Early tips are untouched. Late tip gains preserve widths and timing.
  const unit = response();
  const early = unit.early;
  const average = early.reduce((a,b) => a+b,0) / early.length;
  const earlyMax = Math.max(...early);
  const weights = tips.map((i,k) => 1 + .12 * Math.sin((seed >>> 0) * .017 + k * 2.4));
  const meanWeight = weights.reduce((a,b) => a+b,0) / weights.length;
  const targetMean = average * (verdict === "LIE" ? 1.5 : 1);
  // When feasible, every late lie R clears the tallest early R. This is input
  // calibration, never a rendered clamp or a compression against paper edges.
  const spread = verdict === "LIE" ? Math.max(0, Math.min(1, (targetMean-earlyMax-.25)/(targetMean*.24))) : 1;
  const targets = weights.map(w => targetMean * (1 + (w/meanWeight-1)*spread));
  const gains = tips.map(() => 1);
  const setGains = () => tips.forEach((i,k) => { transformed[i][1] = 62+(original[k]-62)*gains[k]; });
  tips.forEach(i => { transformed[i][1] = 62; });
  const zero = response();
  setGains();
  tips.forEach((tip,k) => {
    const region = allTips.indexOf(tip);
    const left = region ? (transformed[allTips[region-1]][0]+transformed[tip][0])/2 : 0;
    const right = region < allTips.length-1 ? (transformed[tip][0]+transformed[allTips[region+1]][0])/2 : durationMs;
    let gain = Infinity;
    unit.samples.forEach(([t,h],j) => {
      const base = zero.samples[j][1], contribution = h-base;
      if (t >= transformed[tip][0] && t > left && t <= right && contribution > 1e-9) gain = Math.min(gain,(targets[k]-base)/contribution);
    });
    gains[k] = gain;
  });
  setGains();
  return {durationMs, seed, beats: beats.filter(b => b.at < durationMs), points: transformed};
}
function heartbeatValue(model, elapsedMs) {
  const end = Math.max(0, elapsedMs);
  for (let i = 1; i < model.points.length; i++) {
    const [t,y] = model.points[i], [a,b] = model.points[i-1];
    if (end <= t) { const u = Math.max(0, Math.min(1, (end-a)/(t-a || 1))); return b + (y-b)*u*u*(3-2*u); }
  }
  return model.points[model.points.length-1][1];
}
function heartbeatPath(model, elapsedMs) {
  let path = '';
  for(let t=0; t<=elapsedMs; t+=4) path += `${t ? 'L' : 'M'}${(8+344*t/model.durationMs).toFixed(2)} ${heartbeatValue(model,t).toFixed(2)}`;
  return path;
}

export { buildHeartbeat, heartbeatValue };
