import { beforeEach, expect, test, vi } from 'vitest';

let scene, draws;

beforeEach(async () => {
  vi.resetModules();
  draws = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    drawImage: draws, setTransform() {}, clearRect() {}, save() {}, restore() {},
    translate() {}, scale() {}, rotate() {},
  }));
  vi.stubGlobal('Image', class {
    set src(value) { queueMicrotask(() => this.onload()); }
  });
  await import('../src/wildlife.js');
  scene = new window.TDCWildlife();
  await scene.ready;
  draws.mockClear();
});

test('wildlife stays hidden above the underwater threshold', () => {
  scene.resize(1440, 900);
  scene.update(1, 0, 1);
  expect(draws).not.toHaveBeenCalled();
});

test.each([390, 844, 1440, 1920])('maintains distinct species proportions at %i pixels', width => {
  scene.resize(width, 844);
  scene.update(0, 1, 0);
  const widths = new Map();
  for (const [image, ...args] of draws.mock.calls) {
    // Recover full silhouette width from the rendered strip and its source width.
    widths.set(image, args[6] * image.width / args[2]);
  }
  const [herring, octopus, eel, rockfish] = scene.swimmers;
  expect(widths.get(octopus.image)).toBeGreaterThan(widths.get(eel.image) * 1.5);
  expect(widths.get(eel.image)).toBeGreaterThan(widths.get(rockfish.image) * 2.8);
  expect(widths.get(rockfish.image)).toBeGreaterThan(widths.get(herring.image));
  expect(herring.formation).toHaveLength(7);
});

test('zero elapsed time preserves positions and elapsed time advances the school together', () => {
  scene.resize(1440, 900);
  const school = scene.swimmers.find(swimmer => swimmer.formation.length === 7);
  const start = school.x;
  scene.update(0, 1, 0);
  expect(school.x).toBe(start);
  scene.update(1, 1, 1);
  expect(school.x).toBeGreaterThan(start);
  expect(school.formation).toHaveLength(7);
});

test('offscreen swimmers wait before reentering the scene', () => {
  scene.resize(1440, 900);
  const swimmer = scene.swimmers[0];
  swimmer.x = 1.3;
  swimmer.delay = 2;
  scene.update(1, 1, 0);
  expect(swimmer.x).toBe(1.3);
  scene.update(1.1, 1, 1);
  expect(swimmer.x).toBeGreaterThan(-.2);
  expect(swimmer.x).toBeLessThan(1.2);
});

test('a failed wildlife atlas can be loaded again successfully', async () => {
  const requests=[];
  vi.stubGlobal('Image',class {
    set src(value){requests.push(this);}
  });
  const retryScene=new window.TDCWildlife({defer:true});
  const first=retryScene.load();
  const rejected=expect(first).rejects.toThrow('Unable to load');
  requests[0].onerror();
  await rejected;
  const second=retryScene.load();
  expect(second).not.toBe(first);
  expect(requests).toHaveLength(2);
  requests[1].onload();
  await second;
  expect(retryScene.swimmers).toHaveLength(4);
});
