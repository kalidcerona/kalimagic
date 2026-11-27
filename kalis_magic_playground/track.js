(function () {
  'use strict';

  var ENDPOINT = '/.netlify/functions/track';
  var SESSION_KEY = 'kalimagic_analytics_session_v3';
  var QUEUE_KEY = 'kalimagic_analytics_queue_v3';
  var MAX_BATCH_SIZE = 20;
  var MAX_BODY_BYTES = 32 * 1024;
  var FLUSH_INTERVAL_MS = 5000;
  var CLICK_DEBOUNCE_MS = 150;
  var ALLOWED_EVENT_TYPES = {
    pageview: true,
    cta_click: true,
    share_click: true,
    invite_click: true,
    lead_submit: true
  };

  var memorySessionId = createUuid();
  // Start a new namespace so old account-linked session IDs cannot join new events.
  try {
    window.sessionStorage.removeItem('kalimagic_analytics_session_v2');
    window.localStorage.removeItem('kalimagic_analytics_queue_v2');
    window.localStorage.removeItem('kalimagic_analytics_session_v1');
    window.localStorage.removeItem('kalimagic_analytics_queue_v1');
  } catch (_error) { /* Storage can be unavailable. */ }
  var queue = loadQueue();
  persistQueue();
  var flushTimer = null;
  var flushInProgress = false;

  function createUuid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }

      var values = new Uint8Array(16);
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        window.crypto.getRandomValues(values);
      } else {
        for (var index = 0; index < values.length; index += 1) {
          values[index] = Math.floor(Math.random() * 256);
        }
      }
      values[6] = (values[6] & 0x0f) | 0x40;
      values[8] = (values[8] & 0x3f) | 0x80;
      var hex = Array.prototype.map.call(values, function (value) {
        return value.toString(16).padStart(2, '0');
      }).join('');
      return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    } catch (_error) {
      return '00000000-0000-4000-8000-000000000000';
    }
  }

  function getStorageItem(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (_error) {
      return null;
    }
  }

  function setStorageItem(key, value) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.setItem(key, value);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function getSessionId() {
    try {
      var stored = window.sessionStorage.getItem(SESSION_KEY);
      if (isUuid(stored)) return stored;
      window.sessionStorage.setItem(SESSION_KEY, memorySessionId);
    } catch (_error) { /* Use the in-memory session ID. */ }
    return memorySessionId;
  }

  function isUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  function isStoredEvent(event) {
    return Boolean(event && typeof event === 'object' && event.eventId && event.sessionId && event.eventType && event.eventName && event.page && Date.parse(event.occurredAt) >= Date.now() - 7 * 86400000 && event.meta && typeof event.meta === 'object');
  }

  function loadQueue() {
    var stored = getStorageItem(QUEUE_KEY);
    if (!stored) return [];
    try {
      var parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter(isStoredEvent) : [];
    } catch (_error) {
      return [];
    }
  }

  function persistQueue() {
    setStorageItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function currentPage() {
    try {
      var pathname = window.location && window.location.pathname;
      return typeof pathname === 'string' && pathname ? pathname.slice(0, 300) : '/';
    } catch (_error) {
      return '/';
    }
  }

  function text(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
  }

  function eventMeta(placement, destination) {
    var meta = {};
    var safePlacement = text(placement, 100);
    var safeDestination = text(destination, 300);
    if (safePlacement) meta.placement = safePlacement;
    if (safeDestination) meta.destination = safeDestination;
    return meta;
  }

  function enqueue(eventType, eventName, meta) {
    try {
      var safeType = ALLOWED_EVENT_TYPES[eventType] ? eventType : 'cta_click';
      var safeName = text(eventName, 80);
      if (!safeName) return;
      queue.push({
        eventId: createUuid(),
        sessionId: getSessionId(),
        eventType: safeType,
        eventName: safeName,
        page: currentPage(),
        occurredAt: new Date().toISOString(),
        meta: meta && typeof meta === 'object' ? meta : {}
      });
      persistQueue();
      scheduleFlush(queue.length >= MAX_BATCH_SIZE ? 0 : CLICK_DEBOUNCE_MS);
    } catch (_error) {
      // Analytics must never interrupt page behavior.
    }
  }

  function byteLength(value) {
    try {
      if (window.TextEncoder) return new window.TextEncoder().encode(value).byteLength;
    } catch (_error) {
      // Fall back to an intentionally conservative character count below.
    }
    return value.length * 2;
  }

  function nextBatch() {
    var fresh = queue.filter(isStoredEvent);
    if (fresh.length !== queue.length) {
      queue = fresh;
      persistQueue();
    }
    var batch = [];
    for (var index = 0; index < queue.length && batch.length < MAX_BATCH_SIZE; index += 1) {
      var candidate = batch.concat(queue[index]);
      if (byteLength(JSON.stringify({ events: candidate })) > MAX_BODY_BYTES) break;
      batch.push(queue[index]);
    }
    return batch;
  }

  function removeEvents(events) {
    if (!events.length) return;
    var sentIds = {};
    events.forEach(function (event) { sentIds[event.eventId] = true; });
    queue = queue.filter(function (event) { return !sentIds[event.eventId]; });
    persistQueue();
  }

  function scheduleFlush(delay) {
    try {
      if (flushTimer || flushInProgress || !queue.length) return;
      flushTimer = window.setTimeout(function () {
        flushTimer = null;
        flush();
      }, Math.max(0, delay || 0));
    } catch (_error) {
      // Timers are optional for analytics.
    }
  }

  async function postBatch(batch) {
    var body = JSON.stringify({ events: batch });
    var response = await window.fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: body,
      keepalive: true
    });
    return response.status === 202;
  }

  async function flush() {
    if (flushInProgress || !queue.length) return;
    flushInProgress = true;
    try {
      var batch = nextBatch();
      if (!batch.length) return;
      if (await postBatch(batch)) removeEvents(batch);
    } catch (_error) {
      // Keep failed events for a later retry.
    } finally {
      flushInProgress = false;
      if (queue.length) scheduleFlush(FLUSH_INTERVAL_MS);
    }
  }

  try {
    enqueue('pageview', 'pageview', {});

    document.addEventListener('click', function (event) {
      try {
        var target = event.target && event.target.closest ? event.target.closest('[data-track]') : null;
        if (!target) return;
        var eventType = target.dataset.trackType || 'cta_click';
        enqueue(eventType, target.dataset.track, eventMeta(target.dataset.trackPlacement, target.getAttribute('href') || undefined));
      } catch (_error) {
        // Analytics must never interrupt click navigation.
      }
    });

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
    });
    window.setInterval(function () { scheduleFlush(0); }, FLUSH_INTERVAL_MS);
  } catch (_error) {
    // Analytics must never prevent the page from rendering.
  }
})();
