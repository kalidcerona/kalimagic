// A saved timer opens on the run screen and waits. Counting, voice, beep and vibration start only from play.
(() => {
  const PLAY_LABEL = '시작';
  const PAUSE_LABEL = '일시정지';

  function openReady(session, timer) {
    const active = session.clone(timer);
    const cfg = active.v;
    const segs = session.segments(cfg, active.skipLast);
    const total = session.total(segs);
    if (!total) return false;
    session.applyColors(active);
    session.assign({
      active, cfg, segs, total,
      offset: 0, startedAt: 0, pausedAt: 0,
      running: false, finished: false, ready: true,
      lastIdx: -1, lastWhole: -1
    });
    session.cancelLoops();
    session.showRun();
    session.setPlayLabel(PLAY_LABEL);
    session.restoreBody();
    session.paintSegments();
    session.keepAwake();
    session.paintAt(0);
    return true;
  }

  // Continue from the time on screen, including a prev or next move made while waiting.
  function beginReady(session, now) {
    if (!session.isReady()) return false;
    const held = session.elapsed();
    session.unlockAudio();
    session.assign({
      offset: held, startedAt: now, pausedAt: 0,
      running: true, finished: false, ready: false,
      lastIdx: -1, lastWhole: -1
    });
    session.setPlayLabel(PAUSE_LABEL);
    session.clearPaused();
    session.keepAwake();
    session.startLoops();
    return true;
  }

  globalThis.TabataReady = { openReady, beginReady, PLAY_LABEL };
})();
