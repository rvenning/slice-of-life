// Slice of Life — sounds, all synthesized on top of gamekit's GK.Sfx.
//
// The point of the pizza sounds is that they are TACTILE: each topping has its
// own flap, the cheese is a little rain of ticks, the oven's ding is bright and
// rising. A refusal is never a buzzer — it is a customer saying "that's not
// what I asked for", so it is low and soft and falls.

Object.assign(GK.Sfx, {
  // A topping landing on the pizza: a wet thwap and a small tone, pitched per kind.
  flap(id) {
    const f = { pepperoni: 190, sausage: 150, ham: 210, bacon: 240, chicken: 170, anchovy: 300, mushroom: 260, onion: 340, olive: 420, pepper: 320, jalapeno: 360, basil: 460, tomato: 230, pineapple: 280, spinach: 380 }[id] || 250;
    this.noise({ dur: 0.045, vol: 0.07 });
    this.tone({ freq: f, type: "triangle", dur: 0.07, vol: 0.14, slide: -f * 0.45 });
  },
  // Sauce: a slow wet drag.
  slosh() { this.noise({ dur: 0.1, vol: 0.05 }); this.tone({ freq: 140, type: "sine", dur: 0.12, vol: 0.06, slide: 30 }); },
  // Cheese: a tick of the shaker.
  shake() { this.noise({ dur: 0.03, vol: 0.05 }); this.tone({ freq: 1500 + Math.random() * 500, type: "sine", dur: 0.02, vol: 0.03 }); },
  // The bin you reached into.
  pick() { this.tone({ freq: 520, type: "triangle", dur: 0.06, vol: 0.12, slide: 130 }); },
  // The customer's bell, the door.
  doorbell() {
    this.tone({ freq: 1560, type: "sine", dur: 0.16, vol: 0.11 });
    this.tone({ freq: 2080, type: "sine", dur: 0.2, vol: 0.06, when: 0.06 });
  },
  // Taking the order: a pencil.
  order() { this.noise({ dur: 0.07, vol: 0.06 }); this.tone({ freq: 640, type: "square", dur: 0.05, vol: 0.07 }); },
  // Into the oven: the rack sliding and a whoosh.
  oven() { this.noise({ dur: 0.28, vol: 0.07 }); this.tone({ freq: 120, type: "sawtooth", dur: 0.3, vol: 0.07, slide: 80 }); },
  // Out of the oven. Bright and RISING — and different from the sad one.
  ding() {
    this.tone({ freq: 1240, type: "sine", dur: 0.34, vol: 0.18, slide: 90 });
    this.tone({ freq: 1860, type: "sine", dur: 0.26, vol: 0.08, when: 0.02 });
  },
  // The cutter: a swish then a soft thunk.
  slice() { this.noise({ dur: 0.1, vol: 0.09 }); this.tone({ freq: 210, type: "triangle", dur: 0.08, vol: 0.12, when: 0.05, slide: -60 }); },
  box() { this.tone({ freq: 170, type: "triangle", dur: 0.1, vol: 0.14, slide: -40 }); this.noise({ dur: 0.05, vol: 0.05, when: 0.05 }); },
  // The till. Louder for a big tip.
  cash(cents) {
    this.tone({ freq: 980, type: "square", dur: 0.05, vol: 0.12 });
    this.tone({ freq: 1470, type: "triangle", dur: 0.12, vol: 0.14, when: 0.05 });
    if (cents >= 200) this.tone({ freq: 1960, type: "sine", dur: 0.16, vol: 0.09, when: 0.13 });
    if (cents >= 450) this.tone({ freq: 2490, type: "sine", dur: 0.2, vol: 0.08, when: 0.2 });
  },
  // A star lands, one pitch higher each.
  star(n) {
    this.tone({ freq: 660 * Math.pow(1.25, n), type: "triangle", dur: 0.22, vol: 0.2 });
    this.tone({ freq: 990 * Math.pow(1.25, n), type: "sine", dur: 0.3, vol: 0.1, when: 0.04 });
  },
  // A refusal — warm, low, falling. Never a buzzer.
  nope() {
    this.tone({ freq: 250, type: "sine", dur: 0.1, vol: 0.13, slide: -45 });
    this.tone({ freq: 205, type: "sine", dur: 0.12, vol: 0.09, when: 0.1, slide: -25 });
  },
  // A customer gives up and leaves.
  gaveUp() { this.tone({ freq: 330, type: "sine", dur: 0.24, vol: 0.13, slide: -150 }); },
  // "What?" — a little question mark.
  what() { this.tone({ freq: 440, type: "triangle", dur: 0.12, vol: 0.1, slide: 160 }); },
  // Opening up and closing time.
  openUp() { [0, 0.1, 0.2].forEach((t, i) => this.tone({ freq: [523, 659, 784][i], type: "triangle", dur: 0.2, vol: 0.16, when: t })); },
  closeUp() { [0, 0.11, 0.22, 0.36].forEach((t, i) => this.tone({ freq: [523, 659, 784, 1047][i], type: "triangle", dur: 0.24, vol: 0.18, when: t })); },
  purchase() {
    this.tone({ freq: 880, type: "triangle", dur: 0.08, vol: 0.18 });
    this.tone({ freq: 1320, type: "triangle", dur: 0.14, vol: 0.14, when: 0.08 });
  },
  // The Pizza News Network sting.
  news() { [0, 0.08, 0.16, 0.28].forEach((t, i) => this.tone({ freq: [784, 988, 1175, 1568][i], type: "square", dur: 0.1, vol: 0.07, when: t })); },
});
