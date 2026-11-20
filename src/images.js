const IMAGE_TIMEOUT_MS = 15000;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (error) {
        image.removeAttribute?.('src');
        reject(error);
      } else {
        resolve(image);
      }
    }
    const timeout = setTimeout(() => finish(new Error(`Image loading timed out: ${src}`)), IMAGE_TIMEOUT_MS);
    image.onload = () => finish();
    image.onerror = () => finish(new Error(`Unable to load ${src}`));
    image.src = src;
  });
}
