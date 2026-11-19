const portraitViewport = matchMedia('(max-width: 600px)');

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = src;
  });
}

export function underwaterSource() {
  return portraitViewport.matches ? 'assets/underwater-portrait.png' : 'assets/underwater-reef.png';
}

export function watchUnderwater(initialImage, onChange, signal) {
  let current = initialImage;
  const images = new Map([[initialImage.getAttribute('src'), Promise.resolve(initialImage)]]);

  async function update() {
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
      if (!signal?.aborted) console.warn(error);
    }
  }

  portraitViewport.addEventListener('change', update, { signal });
  update();
}
