const liveUrls = new Set();

function revokeUrl(url) {
  if (!url) return;
  URL.revokeObjectURL(url);
  liveUrls.delete(url);
}

function decodeImage(blob) {
  const url = URL.createObjectURL(blob);
  liveUrls.add(url);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      revokeUrl(url);
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('decode'));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      revokeUrl(url);
      reject(new Error('decode'));
    };
    image.src = url;
  });
}

function loadKeptImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('decode'));
        return;
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error('decode'));
    image.src = url;
  });
}

export { liveUrls, revokeUrl, decodeImage, loadKeptImage };
