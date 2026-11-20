// Called from the active renderer, so retries stop while animation is paused or hidden.
export function retryableLoad(load, apply, signal) {
  let pending = false;
  let complete = false;
  let retryAt = 0;

  return function start() {
    if (signal?.aborted || pending || complete || performance.now() < retryAt) return;
    pending = true;
    Promise.resolve().then(load).then(result => {
      if (signal?.aborted) return;
      apply(result);
      complete = true;
    }).catch(error => {
      if (!signal?.aborted) console.warn(error);
      retryAt = performance.now() + 5000;
    }).finally(() => {
      pending = false;
    });
  };
}

export function waterBackdrop() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 2);
  gradient.addColorStop(0, '#103b4b');
  gradient.addColorStop(1, '#061925');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 2, 2);
  return canvas;
}
