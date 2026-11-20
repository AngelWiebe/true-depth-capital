import { expect, test, vi } from 'vitest';
import { renderSize, uploadCanvas } from '../src/rendering.js';

test.each([[390,844,3],[1440,900,2],[3840,2160,2],[7680,4320,1]])(
  'keeps %i × %i rendering within budget at device ratio %i', (width,height,dpr) => {
    const size = renderSize(width,height,dpr);
    expect(size.width*size.height).toBeLessThanOrEqual(width<650?1550000:2300000);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    expect(renderSize(width,height,dpr,.7).width).toBeLessThan(size.width);
  },
);

test('allocates texture storage only when dimensions change', () => {
  const gl = {texImage2D:vi.fn(),texSubImage2D:vi.fn()};
  const canvas = {width:640,height:420};
  const allocation = {};
  uploadCanvas(gl,canvas,allocation);
  uploadCanvas(gl,canvas,allocation);
  expect(gl.texImage2D).toHaveBeenCalledTimes(1);
  expect(gl.texSubImage2D).toHaveBeenCalledTimes(1);
  canvas.width=800;
  uploadCanvas(gl,canvas,allocation);
  expect(gl.texImage2D).toHaveBeenCalledTimes(2);
});
