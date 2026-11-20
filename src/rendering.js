export function renderSize(width, height, pixelRatio, quality = 1) {
  const budget = width < 650 ? 1550000 : 2300000;
  const ratio = Math.min(pixelRatio || 1, 2, Math.sqrt(budget / (width * height))) * quality;
  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
    ratio,
  };
}

export function uploadCanvas(gl, canvas, allocation) {
  if (allocation.width !== canvas.width || allocation.height !== canvas.height) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    allocation.width = canvas.width;
    allocation.height = canvas.height;
  } else {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }
}
