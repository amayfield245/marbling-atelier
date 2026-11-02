/* =====================================================================
   COLOURS AND THE PATTERN BOOK
   ===================================================================== */
const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const rgb2hex = c => "#" + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const strSeed = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

const SUITES = [
  { id: "ottoman", name: "Ottoman kitre", colours: [["Lahore indigo", "#24386a"], ["Turkish red", "#a3302a"], ["Orpiment", "#d6a335"], ["Verdigris", "#3f6a4a"], ["Lamp black", "#2a2421"], ["Ivory", "#ece2c9"]] },
  { id: "dutch", name: "Dutch combed, c. 1700", colours: [["Prussian blue", "#1f3f73"], ["Carmine", "#a71f2c"], ["Weld yellow", "#ddb03a"], ["Sap green", "#4b7340"], ["Chalk white", "#f1ead8"]] },
  { id: "victorian", name: "Victorian library", colours: [["Oxblood", "#6c1f1b"], ["Slate blue", "#4a5f7d"], ["Burnt umber", "#5e3f26"], ["Sage", "#8d9a6b"], ["Buff", "#d8c08f"], ["Ivory black", "#211d1b"]] },
  { id: "florentine", name: "Florentine", colours: [["Lapis", "#204d93"], ["Coral", "#d26a4c"], ["Saffron", "#e3a42e"], ["Lichen", "#86964a"], ["Rose madder", "#c77b86"], ["Cream", "#f2e8cf"]] },
  { id: "sumi", name: "Sumi and indigo", colours: [["Sumi", "#1c1b20"], ["Ai indigo", "#2b416f"], ["Beni red", "#a8342d"]] },
  { id: "peacock", name: "Peacock", colours: [["Teal", "#1d6b68"], ["Verdigris", "#58a08c"], ["Ultramarine", "#2b3c91"], ["Gamboge", "#d39b25"], ["Tyrian plum", "#5c2a4b"], ["Pearl", "#efe9da"]] },
  { id: "morris", name: "Arts and Crafts", colours: [["Madder", "#a3432f"], ["Woad", "#3e6079"], ["Weld", "#c8a63e"], ["Indigo", "#22314d"], ["Olive", "#6d6c35"]] },
  { id: "abri", name: "Persian abrī", colours: [["Lapis", "#1f4b8f"], ["Rose", "#d48a8a"], ["Pistachio", "#a4b36b"], ["Gold ochre", "#c9952f"], ["Aubergine", "#4b2440"]] }
];
const CLEAR = { name: "Clear water", hex: "#dfe5e0", rgb: [0.87, 0.9, 0.88], clear: true };
const BRONZE = { name: "Bronze", hex: "#b08a3e", rgb: hex2rgb("#b08a3e"), metal: true };
const suitePal = id => (SUITES.find(s => s.id === id) || SUITES[0]).colours.map(([name, hex]) => ({ name, hex, rgb: hex2rgb(hex) }));

const DIRS = { right: 0, left: Math.PI, down: Math.PI / 2, up: -Math.PI / 2 };
const AREA = (TW + 80) * (TH + 80);

/* The marbler's hand: builds a recipe as a list of captioned steps of strokes. */
class Hand {
  constructor(pal, seed, cond = { gall: 1, size: 1 }) {
    this.pal = pal; this.rng = mulberry(seed); this.G = cond.gall; this.V = cond.size; this.steps = []; this.cur = null;
  }
  step(caption, kind = "seq", rate) { this.cur = { caption, kind, rate, ops: [] }; this.steps.push(this.cur); return this; }
  op(o) { this.cur.ops.push(o); }
  r(a = 1, b) { return b === undefined ? this.rng() * a : a + this.rng() * (b - a); }
  col(i) { return typeof i === "object" ? i : this.pal[((i % this.pal.length) + this.pal.length) % this.pal.length]; }
  drop(x, y, r, ci, o = {}) {
    const c = this.col(ci);
    this.op(OP.drop(x, y, r * this.G, c.rgb, { metal: c.metal, clear: c.clear, shell: o.shell || 0, seed: this.rng() }));
  }
  scatter(ci, n, rmin, rmax, o = {}) {
    const m = o.margin ?? 60;
    for (let k = 0; k < n; k++) {
      const x = -m + this.rng() * (TW + 2 * m), y = -m + this.rng() * (TH + 2 * m);
      this.drop(x, y, rmin + (rmax - rmin) * Math.pow(this.rng(), 1.4), ci, o);
    }
  }
  /* Turkish stone: each colour thrown in turn, later colours spreading wider */
  stone(cols, o = {}) {
    const cover = o.cover ?? 1.25, r0 = o.r0 ?? 14, r1 = o.r1 ?? 34, N = cols.length;
    cols.forEach((ci, j) => {
      const c = this.col(ci);
      this.step(o.caption ? o.caption(c, j) : `Throwing ${c.name.toLowerCase()} from the whisk`, "seq", o.rate || 9);
      const rmin = r0 + (r1 - r0) * (N > 1 ? j / (N - 1) : 0), rmax = rmin * 1.8, avg = rmin * 1.3;
      const share = (o.weights ? o.weights[j] : 1 / N) * cover;
      const n = Math.max(6, Math.round(share * AREA / (Math.PI * avg * avg * this.G * this.G)));
      this.scatter(ci, n, rmin, rmax, { margin: o.margin, shell: j === N - 1 ? (o.lastShell || 0) : (o.shell || 0) });
    });
  }
  /* stylus drawn back and forth in parallel lines (gel-git) */
  gelgit(axis, spacing, z, lam, caption) {
    this.step(caption || (axis === "h" ? "Drawing the stylus back and forth across the bath" : "Drawing the stylus up and down the bath"), "grow", 5);
    const off = this.r(spacing);
    if (axis === "h") for (let y = off - spacing, k = 0; y < TH + spacing; y += spacing, k++) this.op(OP.comb(0, y, k % 2 ? Math.PI : 0, z, lam * this.V));
    else for (let x = off - spacing, k = 0; x < TW + spacing; x += spacing, k++) this.op(OP.comb(x, 0, k % 2 ? -Math.PI / 2 : Math.PI / 2, z, lam * this.V));
  }
  comb(dir, spacing, z, lam, caption, wave, pat) {
    this.step(caption || `Pulling a comb of ${Math.round(spacing / 4)} mm tines ${dir === "right" || dir === "left" ? "across" : (dir === "down" ? "down" : "up")} the bath`, "grow", 26);
    const A = wave ? wave.A : 0, k = wave ? 2 * Math.PI / wave.wl : 0;
    const px = spacing ? this.r(spacing) : this.r(TW * 0.3, TW * 0.7), py = spacing ? this.r(spacing) : this.r(TH * 0.3, TH * 0.7);
    this.op(OP.comb(px, py, DIRS[dir], z, lam * this.V, spacing, A, k, this.r(6.28), pat));
  }
  curls(cell, R, theta, caption, alt = 0) {
    this.step(caption || "Turning the stylus in rows of curls", "grow", 30);
    this.op(OP.swirl(this.r(cell), this.r(cell), theta, R, cell, alt));
  }
  swirl(x, y, R, theta, caption) {
    if (caption) this.step(caption, "grow", 30);
    this.op(OP.swirl(x, y, theta, R, 0, 0));
  }
  waveShear(ang, A, wl, caption) {
    this.step(caption || "Rocking the bath", "grow", 26);
    this.op(OP.wave(ang, A, 2 * Math.PI / wl, this.r(6.28)));
  }
  /* a stylus stroke along a polyline */
  stroke(pts, sigma, strength = 0.9) {
    const step = sigma * 0.3;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / step));
      const dx = (x1 - x0) / n, dy = (y1 - y0) / n;
      for (let k = 0; k < n; k++) this.op(OP.push(x0 + dx * (k + 0.5), y0 + dy * (k + 0.5), sigma, dx * strength, dy * strength));
    }
  }
  breath(n, caption) {
    this.step(caption || "Fanning the surface", "seq", 1);
    for (let i = 0; i < n; i++) {
      const x = this.r(150, TW - 150), y = this.r(120, TH - 120), a = this.r(6.28), s = this.r(120, 220);
      const v = s * 0.24;
      for (let k = 0; k < 5; k++) this.op(OP.push(x + Math.cos(a) * v * k, y + Math.sin(a) * v * k, s, Math.cos(a) * v, Math.sin(a) * v));
    }
  }
  turps(n, rmin = 2.2, rmax = 6, caption) {
    this.step(caption || "Spattering turpentine to open the lace", "seq", 40);
    for (let k = 0; k < n; k++) this.op(OP.drop(this.r(-20, TW + 20), this.r(-20, TH + 20), rmin + (rmax - rmin) * Math.pow(this.rng(), 2), CLEAR.rgb, { clear: true, seed: this.rng() }));
  }
  rings(cx, cy, cols, r, count) {
    for (let k = 0; k < count; k++) this.drop(cx, cy, r, cols[k % cols.length]);
  }
  grid(cols, rows, fn) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) fn((i + 0.5) * TW / cols, (j + 0.5) * TH / rows, i, j);
  }
}

const pale = (pal, t = 0.62) => pal.map(c => ({ name: "pale " + c.name.toLowerCase(), rgb: mixRgb(c.rgb, [0.95, 0.93, 0.87], t), hex: c.hex }));
const idx = (h, n) => Array.from({ length: n }, (_, i) => i);

/* ---- the recipes ---- */
const RECIPES = [
  { id: "suminagashi", trad: "japan", name: "Suminagashi", aka: "floating ink", origin: "Japan", date: "1112 and earlier",
    note: "Sumi and clear water touched to the bath in turn make rings within rings, which breath and a fan set drifting. No mordant, no comb.",
    suite: "sumi", sheet: { paper: 2, alum: 1, spanish: 0, drag: 0, burnish: 0 },
    build(h) {
      h.step("Touching sumi and clear water to the bath in turn", "seq", 8);
      const centres = [[h.r(250, 420), h.r(220, 360)], [h.r(760, 950), h.r(420, 580)], [h.r(520, 700), h.r(120, 260)]];
      for (let k = 0; k < 64; k++) centres.forEach(([x, y], j) => {
        const ink = k % 2 === 0;
        const c = ink ? ((k % 12 === 6 && j % 2) ? 1 : (k % 18 === 10 ? 2 : 0)) : CLEAR;
        h.drop(x + h.r(-5, 5), y + h.r(-5, 5), ink ? h.r(20, 26) : h.r(21, 29), c);
      });
      h.breath(6, "Fanning the surface so the rings drift");
      h.swirl(h.r(400, 800), h.r(250, 550), 330, 1.1, "Breathing gently through a straw");
    } },

  { id: "abri", trad: "ottoman", name: "Abrī", aka: "kāghaz-e abrī, cloud paper", origin: "Herat and Bukhara", date: "late 15th century",
    note: "The Persian cloud paper. Few colours on a thin size, loosely thrown and left to drift, give soft clouded stones.",
    suite: "abri", sheet: { paper: 1, spanish: 0, drag: 0, burnish: 0.5 },
    build(h) {
      h.stone([3, 0, 1, 2], { cover: 1.2, r0: 26, r1: 60, rate: 4 });
      h.breath(3, "Letting a draught move the colours");
    } },

  { id: "battal", trad: "ottoman", name: "Battal", aka: "Turkish stone, the ground of all ebru", origin: "Istanbul", date: "16th century",
    note: "Colours flicked from rose-stem and horsehair brushes onto gum tragacanth. Each colour crowds the last into veins.",
    suite: "ottoman", sheet: { paper: 1, spanish: 0, drag: 0, burnish: 0.55 },
    build(h) { h.stone([4, 0, 1, 2, 3], { cover: 1.3, r0: 12, r1: 34 }); } },

  { id: "gelgit", trad: "ottoman", name: "Gelgit", aka: "come and go", origin: "Istanbul", date: "16th century",
    note: "A battal drawn through with the biz, an awl, back and forth in close parallel lines.",
    suite: "ottoman", sheet: { paper: 1, spanish: 0, drag: 0, burnish: 0.55 },
    build(h) { h.stone([4, 0, 1, 2, 5], { r0: 12, r1: 30 }); h.gelgit("h", 34, 46, 9); } },

  { id: "tarakli", trad: "ottoman", name: "Taraklı", aka: "combed ebru", origin: "Istanbul", date: "17th century",
    note: "Gelgit finished with a comb (tarak) drawn the other way, setting the colours in rows of small arches.",
    suite: "ottoman", sheet: { paper: 1, spanish: 0, drag: 0, burnish: 0.55 },
    build(h) { h.stone([4, 0, 1, 2, 3, 5], { r0: 10, r1: 26 }); h.gelgit("v", 40, 50, 10); h.comb("right", 14, 60, 4.2); } },

  { id: "sal", trad: "ottoman", name: "Şal", aka: "shawl ebru", origin: "Istanbul", date: "18th century",
    note: "Gelgit crossed by gelgit, then drawn in S-curves until it reads like a woven shawl.",
    suite: "ottoman", sheet: { paper: 1, spanish: 0, drag: 0, burnish: 0.55 },
    build(h) {
      h.stone([1, 0, 2, 3, 5], { r0: 11, r1: 28 });
      h.gelgit("v", 30, 34, 8); h.gelgit("h", 30, 34, 8);
      h.comb("down", 70, 70, 16, "Drawing the comb down in S-curves", { A: 22, wl: 150 });
    } },

  { id: "bulbul", trad: "ottoman", name: "Bülbül yuvası", aka: "nightingale’s nest", origin: "Istanbul", date: "18th century",
    note: "Spirals wound with the awl over a combed ground, from the rim of each nest in to its centre.",
    suite: "ottoman", sheet: { paper: 1, spanish: 0, drag: 0, burnish: 0.55 },
    build(h) {
      h.stone([4, 0, 1, 2, 3, 5], { r0: 10, r1: 24 });
      h.gelgit("v", 36, 44, 9); h.comb("right", 14, 50, 4);
      h.curls(150, 74, 11, "Winding nests with the awl, from the rim inwards", 0);
    } },

  { id: "hatip", trad: "ottoman", name: "Hatip", aka: "the preacher’s ebru", origin: "Istanbul, after Hatip Mehmed Efendi", date: "d. 1773",
    note: "Rings of colour dropped within colour on a pale battal, then drawn into hearts with a fine wire.",
    suite: "ottoman", sheet: { paper: 1, spanish: 0, drag: 0, burnish: 0.55 },
    build(h) {
      const pal = h.pal; h.pal = pale(pal, 0.6);
      h.stone([0, 2, 3, 5], { r0: 22, r1: 46, caption: c => `Laying a pale ground of ${c.name}` });
      h.pal = pal;
      h.step("Dropping rings of colour within colour", "seq", 4);
      h.grid(5, 3, (x, y, i, j) => h.rings(x + (j % 2 ? 40 : -40), y, [1, 2, 0, 5], 16, 8));
      h.step("Drawing the wire down through each ring to make a heart", "seq", 6);
      h.grid(5, 3, (x, y, i, j) => { const cx = x + (j % 2 ? 40 : -40); h.stroke([[cx, y - 110], [cx, y + 85]], 10, 0.95); });
    } },

  { id: "cicek", trad: "ottoman", name: "Papatya", aka: "daisy ebru", origin: "Istanbul, after Mustafa Düzgünman", date: "20th century",
    note: "Flower ebru as Necmeddin Okyay and Düzgünman taught it. A white drop, petals drawn inward with the awl, a yellow heart.",
    suite: "ottoman", sheet: { paper: 1, spanish: 0, drag: 0, burnish: 0.55 },
    build(h) {
      const pal = h.pal; h.pal = pale(pal, 0.72);
      h.stone([0, 3, 2], { r0: 24, r1: 46, caption: c => `Laying a soft ground of ${c.name}` });
      h.pal = pal;
      const spots = [[260, 250], [620, 210], [960, 300], [400, 560], [800, 560]];
      h.step("Dropping white for each flower", "seq", 1);
      spots.forEach(([x, y]) => h.drop(x, y, 66, { name: "white", rgb: [0.97, 0.96, 0.92] }));
      h.step("Drawing petals inward with the awl", "seq", 8);
      spots.forEach(([x, y]) => { for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; h.stroke([[x + Math.cos(a) * 100, y + Math.sin(a) * 100], [x + Math.cos(a) * 20, y + Math.sin(a) * 20]], 8, 0.9); } });
      h.step("Setting a yellow heart in each", "seq", 1);
      spots.forEach(([x, y]) => { h.drop(x, y, 17, 2); h.drop(x, y, 7, 4); });
    } },

  { id: "turkish", trad: "europe", name: "Turkish", aka: "Stone, Spot, Agate", origin: "Europe, from Ottoman models", date: "from the mid-17th century",
    note: "The oldest Western pattern and the base of most others. Colours are thrown with a marbling brush; the first become the veins of the later.",
    suite: "dutch", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) { h.stone([0, 1, 2, 3, 4], { cover: 1.3, r0: 12, r1: 34 }); } },

  { id: "olddutch", trad: "europe", name: "Old Dutch", aka: "Wide comb, Arch", origin: "Holland and Germany", date: "17th–18th century",
    note: "A narrow comb drawn across twice, then a widely spaced comb drawn down to form arches. The common paper of the age.",
    suite: "dutch", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([0, 1, 2, 3, 4], { r0: 9, r1: 20 });
      h.comb("right", 18, 34, 5); h.comb("left", 18, 34, 5);
      h.comb("down", 72, 90, 14, "Drawing the wide comb down to raise the arches");
    } },

  { id: "nonpareil", trad: "europe", name: "Nonpareil", aka: "matchless", origin: "France and England", date: "late 17th century onward",
    note: "Colours dropped in sequence, a stylus drawn back and forth, then a fine comb of 2–3 mm tines pulled through once.",
    suite: "victorian", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) { h.stone([5, 0, 1, 4, 3], { r0: 9, r1: 22 }); h.gelgit("h", 44, 70, 12); h.comb("down", 11, 44, 3.2); } },

  { id: "bouquet", trad: "europe", name: "Bouquet", aka: "Peacock (Wolfe), Bukett", origin: "Germany and France", date: "late 18th century",
    note: "A nonpareil base with a wide two-tooth comb carried up the bath in waves, fanning the columns into sprays.",
    suite: "florentine", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([0, 1, 2, 3, 4, 5], { r0: 9, r1: 22 }); h.gelgit("h", 42, 52, 10); h.comb("down", 11, 42, 3.2);
      h.comb("up", 64, 72, 15, "Carrying the wide comb up the bath in waves", { A: 20, wl: 64 });
    } },

  { id: "peacock", trad: "europe", name: "Peacock", aka: "Pfauen", origin: "Germany", date: "19th century",
    note: "A Turkish base combed into a grid, then a comb taken through in waves so each loop opens like the eye of a feather.",
    suite: "peacock", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([0, 2, 4, 1, 3, 5], { r0: 9, r1: 22 });
      h.comb("right", 24, 40, 6); h.comb("down", 24, 40, 6);
      h.comb("up", 52, 66, 13, "Taking the comb up in waves to open the eyes", { A: 19, wl: 52 });
    } },

  { id: "frenchcurl", trad: "europe", name: "French Curl", aka: "Snail", origin: "France", date: "18th century",
    note: "Any finished base turned with a stylus or widely spaced comb into rows of curls.",
    suite: "victorian", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([5, 0, 1, 4, 3], { r0: 9, r1: 22 }); h.gelgit("h", 40, 50, 10); h.comb("down", 12, 40, 3.4);
      h.curls(96, 47, 4.6, "Turning each curl with the stylus");
    } },

  { id: "spanish", trad: "europe", name: "Spanish", aka: "Wellen, Spanish moiré", origin: "Spain and Germany", date: "early 17th century",
    note: "A Turkish base on which the sheet is rocked back and forth as it is laid, leaving shaded diagonal bands.",
    suite: "victorian", sheet: { paper: 0, spanish: 0.85, drag: 0 },
    build(h) { h.stone([5, 0, 1, 2, 4], { cover: 1.3, r0: 14, r1: 36 }); } },

  { id: "shell", trad: "europe", name: "French Shell", aka: "Vogelaugen", origin: "France", date: "c. 1800",
    note: "Like Turkish, but the last colour carries oil, so each spot dries with a white outline and a darker centre.",
    suite: "dutch", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) { h.stone([3, 1, 2, 0], { cover: 1.35, r0: 12, r1: 36, lastShell: 0.95, weights: [0.2, 0.2, 0.2, 0.4] }); } },

  { id: "stormont", trad: "europe", name: "Stormont", aka: "Neftli ebru", origin: "Dublin and France", date: "1750s–early 19th century",
    note: "The last colour is thrown with turpentine, which opens it into a lacy net of fine holes. Edhem Efendi made the Turkish neftli.",
    suite: "victorian", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([0, 1, 3, 2], { cover: 1.25, r0: 12, r1: 34, weights: [0.2, 0.2, 0.2, 0.4] });
      h.turps(2300, 2, 5.5, "Spattering the last colour with turpentine to open the lace");
    } },

  { id: "gloster", trad: "europe", name: "Gloster", aka: "often taken for Stormont", origin: "England", date: "19th century",
    note: "A combed base, twice combed, with turpentine colour sprinkled over it to leave open spots.",
    suite: "morris", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([3, 0, 1, 2], { r0: 10, r1: 26 }); h.comb("right", 20, 34, 5.5); h.comb("down", 20, 34, 5.5);
      h.turps(1300, 2.5, 6.5, "Sprinkling colour mixed with turpentine");
    } },

  { id: "italian", trad: "europe", name: "Italian", aka: "Vein, Hair Vein", origin: "Italy", date: "late 18th century",
    note: "Colours thrown on, then a fine spray of dispersant constricts them into the hair veins of polished stone.",
    suite: "victorian", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([5, 1, 3, 4], { cover: 1.25, r0: 16, r1: 40 });
      h.turps(1300, 9, 20, "Spraying a fine dispersant to draw the colours into veins");
    } },

  { id: "goldvein", trad: "europe", name: "Gold Vein", aka: "after the Le Bretons", origin: "Paris", date: "17th century",
    note: "Worked as Turkish, but the first colour is bronze, so every later colour is edged with gold.",
    suite: "victorian", sheet: { paper: 0, spanish: 0, drag: 0, burnish: 0.4 },
    build(h) { h.stone([BRONZE, 0, 1, 3], { cover: 1.3, r0: 12, r1: 34, weights: [0.22, 0.26, 0.26, 0.26] }); } },

  { id: "zebra", trad: "europe", name: "Zebra", aka: "", origin: "Germany and England", date: "late 19th century",
    note: "A Turkish base combed both ways into a grid, then splashed with large drops that push the stripes aside.",
    suite: "peacock", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([4, 2, 0, 1, 5], { r0: 9, r1: 20 }); h.comb("right", 16, 34, 4.5); h.comb("down", 16, 34, 4.5);
      h.step("Splashing on large drops", "seq", 1);
      for (let k = 0; k < 16; k++) h.drop(h.r(-30, TW + 30), h.r(-30, TH + 30), h.r(40, 90), k % 3 === 0 ? 3 : 5);
    } },

  { id: "fountain", trad: "europe", name: "Fountain", aka: "", origin: "England", date: "19th century",
    note: "A single-tooth comb drawn back and forth over a Turkish base, then pulled up so the spots gush like water.",
    suite: "dutch", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([0, 1, 2, 3, 4], { r0: 10, r1: 24, margin: 170 }); h.gelgit("v", 18, 30, 5.5);
      h.comb("up", 130, 120, 28, "Pulling the wide rake up through the bath");
    } },

  { id: "serpentine", trad: "europe", name: "Serpentine", aka: "Waved", origin: "England", date: "mid-19th century",
    note: "A Turkish base double combed into a grid, then drawn with a slightly wider comb in snake-like waves.",
    suite: "morris", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([3, 0, 1, 2, 4], { r0: 9, r1: 22 }); h.comb("right", 18, 34, 5); h.comb("down", 18, 34, 5);
      h.comb("right", 46, 62, 15, "Drawing the comb across in snaking waves", { A: 26, wl: 160 });
    } },

  { id: "schrottel", trad: "europe", name: "Schrottel", aka: "Scrotel, small shot", origin: "Germany", date: "early 18th century",
    note: "On a Turkish base, small spots of colour mixed with ox gall and oil dry dark, each in a white halo.",
    suite: "morris", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([2, 1, 4, 0], { cover: 1.3, r0: 14, r1: 34 });
      h.step("Sprinkling small spots of oiled black", "seq", 12);
      h.scatter(3, 170, 5, 12, { shell: 1 });
    } },

  { id: "antique", trad: "europe", name: "Antique Spot", aka: "Antique straight", origin: "Europe", date: "17th century",
    note: "A combed pattern finished with a fine sprinkle of white dots.",
    suite: "victorian", sheet: { paper: 0, spanish: 0, drag: 0 },
    build(h) {
      h.stone([5, 0, 1, 2, 3], { r0: 10, r1: 24 }); h.gelgit("v", 26, 34, 6); h.comb("right", 26, 40, 7);
      h.step("Sprinkling fine white", "seq", 30);
      h.scatter({ name: "white", rgb: [0.96, 0.94, 0.88] }, 650, 1.6, 4);
    } }
];

const TRAD_LABEL = { japan: "Japan", ottoman: "Persia and the Ottomans", europe: "Europe", yours: "Your recipes" };

/* ---- a random plate ---- */
function randomPalette(rng) {
  const h0 = rng() * 360, scheme = rng();
  const n = 3 + Math.floor(rng() * 3), out = [];
  for (let i = 0; i < n; i++) {
    let h = scheme < 0.4 ? h0 + i * 28 : scheme < 0.75 ? h0 + (i % 2) * 180 + i * 12 : h0 + i * (360 / n);
    h = ((h % 360) + 360) % 360;
    const s = 0.3 + rng() * 0.45, l = 0.22 + rng() * 0.4;
    out.push({ name: "colour " + (i + 1), rgb: hsl2rgb(h, s, l) });
  }
  if (rng() < 0.7) out.push({ name: "pale ground", rgb: hsl2rgb(h0, 0.2, 0.86 + rng() * 0.08) });
  out.forEach(c => c.hex = rgb2hex(c.rgb));
  return out;
}
function hsl2rgb(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const BASES = {
  stone: { label: "stone", fn: h => h.stone(idx(0, h.pal.length), { r0: 10 + h.r(8), r1: 22 + h.r(18) }) },
  fine: { label: "fine stone", fn: h => h.stone(idx(0, h.pal.length), { r0: 7, r1: 16 }) },
  rings: { label: "rings", fn: h => {
    h.step("Dropping rings at the centres", "seq", 4);
    const cs = Array.from({ length: 2 + Math.floor(h.r(4)) }, () => [h.r(100, TW - 100), h.r(80, TH - 80)]);
    for (let k = 0; k < 26; k++) cs.forEach(([x, y]) => h.drop(x, y, h.r(10, 18), k % 3 === 2 ? CLEAR : k));
  } },
  clouds: { label: "clouds", fn: h => h.stone(idx(0, h.pal.length), { r0: 24, r1: 60, rate: 4 }) }
};
const MANIPS = [
  { label: "gel-git", fn: h => h.gelgit(h.r() < 0.5 ? "h" : "v", h.r(24, 50), h.r(30, 60), h.r(6, 12)) },
  { label: "fine comb", fn: h => h.comb(["down", "right", "up", "left"][Math.floor(h.r(4))], h.r(9, 16), h.r(34, 56), h.r(3, 4.5)) },
  { label: "wide comb", fn: h => h.comb(["down", "right", "up"][Math.floor(h.r(3))], h.r(50, 110), h.r(60, 140), h.r(12, 24)) },
  { label: "waves", fn: h => h.comb(h.r() < 0.5 ? "up" : "right", h.r(44, 80), h.r(50, 80), h.r(12, 18), "Drawing a comb through in waves", { A: h.r(14, 30), wl: h.r(50, 170) }) },
  { label: "curls", fn: h => { const c = h.r(80, 150); h.curls(c, c * 0.49, h.r(3, 9)); } },
  { label: "a rocking", fn: h => h.waveShear(h.r(6.28), h.r(10, 30), h.r(120, 400)) },
  { label: "breath", fn: h => h.breath(3) }
];
const FINISHES = [
  { label: "shell spots", fn: h => { h.step("Sprinkling oiled spots", "seq", 10); h.scatter(0, 120, 8, 18, { shell: 0.9 }); } },
  { label: "turpentine lace", fn: h => h.turps(800) },
  { label: "veins", fn: h => h.turps(500, 5, 12, "Spraying dispersant into veins") },
  { label: "splashes", fn: h => { h.step("Splashing on large drops", "seq", 1); for (let k = 0; k < 12; k++) h.drop(h.r(TW), h.r(TH), h.r(40, 80), k); } }
];
function randomPlate(seed, cond, ownPal) {
  const rng = mulberry(seed);
  const pick = a => a[Math.floor(rng() * a.length)];
  const suite = rng() < 0.55 ? pick(SUITES) : null;
  const pal = ownPal || (suite ? suitePal(suite.id) : randomPalette(rng));
  const baseKey = pick(Object.keys(BASES)), base = BASES[baseKey];
  const nm = Math.floor(rng() * 3.4), manips = [];
  for (let i = 0; i < nm; i++) manips.push(pick(MANIPS));
  const finish = rng() < 0.3 ? pick(FINISHES) : null;
  const sheet = { paper: Math.floor(rng() * 4), spanish: rng() < 0.15 ? 0.7 : 0, drag: rng() < 0.08 ? 0.5 : 0 };
  const words = [base.label, ...manips.map(m => m.label)];
  if (finish) words.push(finish.label);
  const name = words.length > 1 ? words.slice(0, -1).join(", ") + " and " + words[words.length - 1] : words[0];
  return {
    id: "random-" + seed, trad: "random", name: "Fancy " + ["stone", "comb", "wave", "curl", "spot"][seed % 5] + " № " + (seed % 997),
    aka: name, origin: suite ? suite.name : "a palette of its own", date: "", sheet, palette: pal,
    note: "A plate of " + name + ".",
    build(h) { base.fn(h); manips.forEach(m => m.fn(h)); if (finish) finish.fn(h); }
  };
}
