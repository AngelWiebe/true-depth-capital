import { loadImage } from './images.js';
export { loadImage };

const portraitViewport = matchMedia('(max-width: 600px)');

export function underwaterSource() {
  return portraitViewport.matches ? 'assets/underwater-portrait.webp' : 'assets/underwater-reef.webp';
}

export function watchUnderwater(initialImage, onChange, signal) {
  let current = initialImage;
  let retryTimer;
  const images = new Map([[initialImage.getAttribute('src'), Promise.resolve(initialImage)]]);

  async function update() {
    clearTimeout(retryTimer);
    const source = underwaterSource();
    if (signal?.aborted || source === current.getAttribute('src')) return;

    if (!images.has(source)) {
      images.set(source, loadImage(source).catch(error => {
        images.delete(source);
        throw error;
      }));
    }

    try {
      const image = await images.get(source);
      // Keep the current artwork until the requested crop is ready, and ignore stale loads.
      if (!signal?.aborted && underwaterSource() === source && image !== current) {
        onChange(image);
        current = image;
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.warn(error);
        if (underwaterSource() === source && current.getAttribute('src') !== source) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(update, 5000);
        }
      }
    }
  }

  portraitViewport.addEventListener('change', update, { signal });
  window.addEventListener('online', update, { signal });
  signal?.addEventListener('abort', () => clearTimeout(retryTimer), { once: true });
  update();
}
