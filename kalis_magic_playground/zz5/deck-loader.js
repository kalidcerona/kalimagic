// Start every slot at once, but wait only for the card the performer chooses.
export function createDeckSlots(loaders, disposeImage = () => {}) {
  let closed = false;
  const ready = loaders.map((load) => Promise.resolve().then(load).then(
    (value) => {
      if (closed) {
        disposeImage(value);
        throw new Error('closed');
      }
      return value;
    },
  ));
  // An unselected broken slot must not create an unhandled rejection.
  for (const promise of ready) promise.catch(() => {});
  return {
    get(index) {
      if (closed || !Number.isInteger(index) || index < 0 || index >= ready.length) {
        return Promise.reject(new Error('closed'));
      }
      return ready[index];
    },
    close() {
      if (closed) return;
      closed = true;
      for (const promise of ready) promise.then(disposeImage, () => {});
    },
  };
}
