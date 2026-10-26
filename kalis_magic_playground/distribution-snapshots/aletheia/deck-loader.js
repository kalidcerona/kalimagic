// Let large decks defer image work until a slot is requested.
export function createDeckSlots(loaders, disposeImage = () => {}, { eager = true } = {}) {
  let closed = false;
  const ready = Array(loaders.length).fill(null);
  function start(index) {
    if (!ready[index]) {
      ready[index] = Promise.resolve().then(loaders[index]).then((value) => {
        if (closed) {
          disposeImage(value);
          throw new Error('closed');
        }
        return value;
      });
      // An unselected broken slot must not create an unhandled rejection.
      ready[index].catch(() => {});
    }
    return ready[index];
  }
  if (eager) loaders.forEach((_, index) => start(index));
  return {
    get(index) {
      if (closed || !Number.isInteger(index) || index < 0 || index >= ready.length) {
        return Promise.reject(new Error('closed'));
      }
      return start(index);
    },
    close() {
      if (closed) return;
      closed = true;
      for (const promise of ready) if (promise) promise.then(disposeImage, () => {});
    },
  };
}
