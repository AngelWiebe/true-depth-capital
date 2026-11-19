(() => {
  'use strict';

  const random = (min, max) => min + Math.random() * (max - min);
  // Atlas rows from top to bottom: wolf eel, giant Pacific octopus, China rockfish, Pacific herring.
  const regions = [[7, 20, 827, 160], [13, 215, 820, 205], [97, 424, 643, 289], [46, 723, 750, 191]];
  // Silhouette widths keep the rockfish readable beside the much larger eel and octopus.
  const species = [
    { size: .18, depth: .64, lane: .67, start: .25, speed: .030, pitch: .035, strips: 30, beat: 2.8, bend: .46, taper: 1.1 },
    { size: .28, depth: .54, lane: .83, start: .77, speed: .019, pitch: .055, strips: 20, beat: 1.7, bend: .24, taper: 1.7 },
    { size: .062, depth: .72, lane: .55, start: .78, speed: .027, pitch: .024, strips: 16, beat: 5.1, bend: .13, taper: 2.7 },
    { size: .042, depth: .34, lane: .43, start: .28, speed: .048, pitch: .018, strips: 9, beat: 7.2, bend: .19, taper: 2.2 },
  ];
  // Herring offsets relative to a fish length. Each member shares the school's heading.
  const school = [[1.55, -.15], [.65, -.52], [.61, .32], [-.26, -.13], [-.55, .69], [-1.22, -.64], [-1.57, .12]];

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function crop(image, [left, top, width, height]) {
    const sprite = document.createElement('canvas');
    sprite.width = width;
    sprite.height = height;
    sprite.getContext('2d').drawImage(image, left, top, width, height, 0, 0, width, height);
    return sprite;
  }

  function drawSwimmer(ctx, image, width, time, phase, profile) {
    const height = width * image.height / image.width;
    const sourceStep = image.width / profile.strips;
    const step = width / profile.strips;
    const beat = time * profile.beat + phase;
    for (let i = 0; i < profile.strips; i++) {
      const u = i / profile.strips;
      const tail = Math.pow(1 - u, profile.taper);
      const bend = Math.sin(beat + u * 3.8) * tail * height * profile.bend;
      // Slightly overlap strips so a bend leaves no gaps between them.
      const slice = Math.min(sourceStep + 2, image.width - i * sourceStep);
      ctx.drawImage(image, i * sourceStep, 0, slice, image.height,
        -width / 2 + i * step, -height / 2 + bend, slice * width / image.width, height);
    }
  }

  window.TDCWildlife = class {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 640;
      this.canvas.height = 420;
      this.ctx = this.canvas.getContext('2d');
      this.W = 1;
      this.H = 1;
      this.swimmers = [];
      this.ready = loadImage('assets/pacific-wildlife.png').then(image => {
        this.swimmers = species.map((profile, index) => ({
          profile,
          image: crop(image, regions[index]),
          formation: index === 3 ? school : [[0, 0]],
          x: profile.start,
          y: profile.lane,
          direction: profile.start < .5 ? 1 : -1,
          phase: random(0, 2 * Math.PI),
          delay: random(3, 8),
        })).sort((a, b) => a.profile.depth - b.profile.depth);
      });
    }

    resize(w, h) {
      this.W = w;
      this.H = h;
      const scale = Math.min(1, 1100 / w, 750 / h);
      this.canvas.width = Math.round(w * scale);
      this.canvas.height = Math.round(h * scale);
    }

    update(dt, depth, time) {
      const ctx = this.ctx;
      const scale = this.canvas.width / this.W;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      if (depth < .16) return;

      for (const swimmer of this.swimmers) {
        const { profile, image, formation, phase } = swimmer;
        if (swimmer.x < -.2 || swimmer.x > 1.2) {
          swimmer.delay -= dt;
          if (swimmer.delay > 0) continue;
          swimmer.direction = Math.random() < .5 ? -1 : 1;
          swimmer.x = swimmer.direction > 0 ? -.19 : 1.19;
          swimmer.y = profile.lane + random(-.035, .035);
          swimmer.delay = random(3, 8);
        }

        swimmer.x += dt * profile.speed * swimmer.direction;
        const width = Math.min(this.W, 1800) * profile.size * (this.W < 650 ? 1.35 : 1);
        const y = (swimmer.y + Math.sin(time * .45 + phase) * .018) * this.H;
        ctx.save();
        ctx.translate(swimmer.x * this.W, y);
        ctx.scale(swimmer.direction, 1);
        ctx.rotate(Math.sin(time * .57 + phase) * profile.pitch);
        ctx.globalAlpha = .26 + profile.depth * .56;

        formation.forEach(([across, down], index) => {
          const memberPhase = phase + index * .86;
          ctx.save();
          ctx.translate(across * width, down * width + Math.sin(time * 1.6 + memberPhase) * width * .07);
          drawSwimmer(ctx, image, width * (1 - (index % 3) * .08), time, memberPhase, profile);
          ctx.restore();
        });
        ctx.restore();
      }
    }
  };
})();
