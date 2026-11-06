/* =====================================================================
   THE ATELIER (v2): pots, bench tabs, views and studio mode
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const PAPERS = [
  { name: "laid paper", col: [0.95, 0.92, 0.83] },
  { name: "wove paper", col: [0.97, 0.955, 0.91] },
  { name: "kozo washi", col: [0.955, 0.94, 0.88] },
  { name: "blue sugar paper", col: [0.74, 0.79, 0.83] }
];
const roman = n => { const t = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let s = ""; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s; };
const store = {
  get(k, d) { try { const v = localStorage.getItem("marbling-atelier:" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("marbling-atelier:" + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const S = {
  tool: "drop", suiteId: "florentine", pots: [], potIdx: 0, plateSuite: null,
  cycle: true, oil: 0, gall: 1, size: 1, ownColours: true, trad: "all",
  plateNo: store.get("plateNo", 1), plateName: "", last: null, studio: false,
  sheets: store.get("sheets", []), userRecipes: store.get("recipes", []),
  opt: {
    drop: { size: 22 }, whisk: { width: 110, size: 12, count: 22 }, stylus: { width: 9, pull: 0.9, spacing: 36 },
    comb: { id: "nonpareil", dir: "down", len: 46, custom: { spacing: 30, reach: 6, len: 60, A: 0, wl: 120, pat: "even" } },
    curl: { R: 46, twist: 4.5 }, breath: { width: 170, strength: 0.35 }, turps: { width: 120, size: 4, count: 80 }
  }
};
let M = null;
const toastEl = $("#toast");
let toastTimer = 0;
function toast(msg, ms = 3800, action) {
  toastEl.textContent = msg;
  if (action) {
    const b = document.createElement("button"); b.type = "button"; b.className = "toast-act"; b.textContent = action.label;
    b.addEventListener("click", () => { toastEl.hidden = true; action.fn(); });
    toastEl.append(" ", b);
  }
  toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.hidden = true, ms);
}

/* ---------- Boot the bath ---------- */
try {
  M = new Marbler($("#gl"));
} catch (err) {
  const d = document.createElement("div"); d.className = "no-gl";
  d.textContent = "This bath needs WebGL 2, which this browser has turned off. Try a current Chrome, Firefox, Edge or Safari.";
  $("#bath").appendChild(d);
  console.error(err);
}

/* ---------- Bench tabs ---------- */
const TABS = ["colour", "bath", "sheet"];
function showTab(name, focus) {
  TABS.forEach(t => {
    const tab = $("#tab-" + t), on = t === name;
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
    $("#panel-" + t).hidden = !on;
    if (on && focus) tab.focus();
  });
}
TABS.forEach((t, i) => {
  const tab = $("#tab-" + t);
  tab.addEventListener("click", () => showTab(t));
  tab.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault(); e.stopPropagation();
      showTab(TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length], true);
    }
  });
});

/* ---------- Colour pots: palettes, the bench grid and the strip beside the bath ---------- */
/* S.work holds the pigments in hand; clear water and bronze are always on the bench after them. */
const suiteSel = $("#suiteSel");
S.palettes = store.get("palettes", []);
S.work = []; S.edited = false;
const toPot = c => { const rgb = c.rgb || hex2rgb(c.hex); return { name: c.name, rgb, hex: c.hex || rgb2hex(rgb) }; };
const userPal = id => typeof id === "string" && id.startsWith("user:") ? S.palettes.find(p => "user:" + p.id === id) : null;
function savePalettes() {
  if (!store.set("palettes", S.palettes)) toast("This browser would not keep your palettes, so they will last only until the page is closed.");
}
function suiteName(id) {
  if (id === "plate") return "Colours of this plate";
  const u = userPal(id); if (u) return u.name;
  const s = SUITES.find(x => x.id === id); return s ? s.name : "Palette";
}
function fillSuiteSelect() {
  suiteSel.innerHTML = "";
  if (S.plateSuite) suiteSel.add(new Option("Colours of this plate", "plate"));
  if (S.palettes.length) {
    const g = document.createElement("optgroup"); g.label = "Your palettes";
    S.palettes.forEach(p => g.appendChild(new Option(p.name, "user:" + p.id))); suiteSel.appendChild(g);
  }
  const g2 = document.createElement("optgroup"); g2.label = "Historical suites";
  SUITES.forEach(s => g2.appendChild(new Option(s.name, s.id))); suiteSel.appendChild(g2);
  suiteSel.value = S.suiteId;
}
function setSuite(id, pal) {
  if (id === "plate") S.plateSuite = pal || S.plateSuite;
  let base;
  if (id === "plate") base = S.plateSuite;
  else if (userPal(id)) base = userPal(id).colours;
  else { if (!SUITES.some(s => s.id === id)) id = SUITES[0].id; base = suitePal(id); }
  S.suiteId = id; S.edited = false;
  S.work = (base || []).map(toPot);
  fillSuiteSelect();
  rebuildPots(0);
}
function rebuildPots(idx) {
  S.pots = [...S.work, CLEAR, BRONZE];
  S.potIdx = Math.max(0, Math.min(idx ?? S.potIdx, S.pots.length - 1));
  renderPots(); renderPaletteBar();
}
/* after any change to the colours in hand: your own palettes keep it, the historical suites are marked as edited */
function paletteChanged() {
  const u = userPal(S.suiteId);
  if (u) { u.colours = S.work.map(c => ({ name: c.name, hex: c.hex })); savePalettes(); }
  else S.edited = true;
}
function renderPaletteBar() {
  const bar = $("#palBar"), u = userPal(S.suiteId);
  bar.innerHTML = "";
  if (u) {
    const row = document.createElement("div"); row.className = "palrow";
    if (u.thumb) { const im = new Image(); im.src = u.thumb; im.alt = "The image this palette came from"; im.className = "palthumb"; row.appendChild(im); }
    const lab = document.createElement("label"); lab.className = "sr-only"; lab.htmlFor = "palName"; lab.textContent = "Palette name";
    const inp = document.createElement("input"); inp.type = "text"; inp.id = "palName"; inp.maxLength = 40; inp.value = u.name;
    inp.addEventListener("change", () => {
      u.name = inp.value.trim() || u.name; inp.value = u.name; savePalettes(); fillSuiteSelect();
    });
    const del = document.createElement("button"); del.type = "button"; del.className = "btn ink small"; del.textContent = "Delete palette";
    del.addEventListener("click", () => deletePalette(u));
    row.append(lab, inp, del); bar.appendChild(row);
    const note = document.createElement("p"); note.className = "palnote";
    note.textContent = "Your palette. Changes are kept as you make them.";
    bar.appendChild(note);
  } else if (S.edited) {
    const row = document.createElement("div"); row.className = "palrow";
    const note = document.createElement("p"); note.className = "palnote";
    note.textContent = `You have changed ${suiteName(S.suiteId)}. Save it as your own palette to keep the changes.`;
    const save = document.createElement("button"); save.type = "button"; save.className = "btn ink small"; save.textContent = "Save as my palette";
    save.addEventListener("click", () => newPalette(`${suiteName(S.suiteId)}, my version`, S.work));
    row.append(note, save); bar.appendChild(row);
  }
  if (!S.work.length) {
    const e = document.createElement("p"); e.className = "palnote empty-pots";
    e.textContent = "No colours in this palette yet. Add one with the colour picker below, or make a palette from an image.";
    bar.appendChild(e);
  }
}
function newPalette(name, colours, thumb) {
  const p = { id: Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: name.slice(0, 40), colours: colours.map(c => ({ name: c.name, hex: c.hex || rgb2hex(c.rgb) })) };
  if (thumb) p.thumb = thumb;
  S.palettes.unshift(p); savePalettes();
  setSuite("user:" + p.id);
  return p;
}
function deletePalette(u) {
  const i = S.palettes.indexOf(u); if (i < 0) return;
  S.palettes.splice(i, 1); savePalettes();
  setSuite(SUITES[0].id);
  toast(`${u.name} is deleted.`, 6000, { label: "Undo", fn: () => { S.palettes.splice(i, 0, u); savePalettes(); setSuite("user:" + u.id); } });
}
const wellBg = p => p.metal
  ? "radial-gradient(circle at 35% 30%, #f6e2a0, #b08a3e 45%, #5e4316)"
  : `radial-gradient(circle at 35% 30%, ${rgb2hex(mixRgb(p.rgb, [1, 1, 1], 0.25))}, ${rgb2hex(p.rgb)} 55%, ${rgb2hex(mixRgb(p.rgb, [0, 0, 0], 0.35))})`;
const potKey = i => {
  const p = S.pots[i];
  if (p.clear) return "0";
  if (p.metal) return "";
  return i < 9 ? String(i + 1) : "";
};
function renderPots() {
  const g = $("#potsGrid"), strip = $("#potStrip");
  g.innerHTML = ""; strip.innerHTML = '<span class="strip-label">Colours</span>';
  S.pots.forEach((p, i) => {
    const on = i === S.potIdx ? "true" : "false";
    const wrap = document.createElement("div"); wrap.className = "potwrap";
    const b = document.createElement("button");
    b.type = "button"; b.className = "pot" + (p.clear ? " clear" : "");
    b.setAttribute("aria-pressed", on);
    const w = document.createElement("span"); w.className = "well"; w.style.background = wellBg(p);
    const n = document.createElement("span"); n.className = "pname"; n.textContent = p.name;
    b.append(w, n);
    b.addEventListener("click", () => selectPot(i));
    wrap.appendChild(b);
    if (!p.clear && !p.metal) {
      const rm = document.createElement("button"); rm.type = "button"; rm.className = "rm";
      rm.setAttribute("aria-label", `Remove ${p.name}`); rm.title = `Remove ${p.name}`; rm.textContent = "×";
      rm.addEventListener("click", () => removePot(i));
      b.addEventListener("keydown", e => { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removePot(i); } });
      wrap.appendChild(rm);
    }
    g.appendChild(wrap);

    const c = document.createElement("button");
    c.type = "button"; c.className = "chip" + (p.clear ? " clear" : "");
    c.style.background = wellBg(p); c.setAttribute("aria-pressed", on);
    c.title = p.name; c.setAttribute("aria-label", p.name);
    const k = potKey(i);
    if (k) { const s = document.createElement("span"); s.className = "key"; s.textContent = k; c.appendChild(s); }
    c.addEventListener("click", () => selectPot(i));
    strip.appendChild(c);
  });
  updateInHand();
}
function removePot(i) {
  const p = S.pots[i]; if (!p || p.clear || p.metal) return;
  S.work.splice(i, 1);
  paletteChanged();
  rebuildPots(Math.min(S.potIdx > i ? S.potIdx - 1 : S.potIdx, S.work.length ? S.work.length - 1 : 0));
  const keepId = S.suiteId;
  toast(`${p.name} is removed from the palette.`, 6000, { label: "Put it back", fn: () => {
    if (S.suiteId !== keepId) setSuite(keepId);
    S.work.splice(Math.min(i, S.work.length), 0, p); paletteChanged(); rebuildPots(i);
  } });
  const focusTo = $$("#potsGrid .pot")[Math.min(i, S.pots.length - 1)]; if (focusTo) focusTo.focus();
}
function addPot(p) {
  S.work.push(p); paletteChanged(); rebuildPots(S.work.length - 1);
}
function selectPot(i, announce = true) {
  if (i < 0 || i >= S.pots.length) return;
  S.potIdx = i; renderPots();
  if (announce) caption(`${pot().name} is in hand.`);
  if (S.tool !== "drop" && S.tool !== "whisk") setTool(pot().clear ? "drop" : "whisk");
}
function updateInHand() {
  const el = $("#inHand"); if (!el) return;
  const p = pot();
  el.querySelector(".dot").style.background = wellBg(p);
  el.querySelector(".nm").textContent = p.name;
}
const pot = () => S.pots[S.potIdx] || S.pots[0];
function nextPot() {
  if (!S.cycle) return;
  const n = S.work.length; // cycle through the pigments, not the clear water or bronze
  if (n && S.potIdx < n) { S.potIdx = (S.potIdx + 1) % n; renderPots(); }
}
/* the pigments in hand, or a historical suite when the palette is empty */
const potsPal = () => S.work.length ? S.work.slice() : suitePal(SUITES[0].id);
suiteSel.addEventListener("change", () => setSuite(suiteSel.value));

/* ---------- Naming a colour ---------- */
function rgb2hsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const HUE_NAMES = [[8, "red"], [22, "vermilion"], [34, "orange"], [52, "ochre"], [64, "yellow"], [90, "olive"], [150, "green"], [178, "teal"], [198, "turquoise"], [222, "blue"], [250, "ultramarine"], [278, "violet"], [305, "plum"], [335, "rose"], [352, "crimson"], [361, "red"]];
function nameColour(rgb, taken = []) {
  const [h, s, l] = rgb2hsl(rgb);
  let name;
  if (s < 0.12 || (l < 0.12 && s < 0.4)) name = l < 0.16 ? "Ivory black" : l < 0.35 ? "Charcoal" : l < 0.6 ? "Slate grey" : l < 0.86 ? "Dove grey" : "Chalk white";
  else {
    let hue = HUE_NAMES.find(([lim]) => h < lim)[1];
    if (hue === "orange" && l < 0.4) hue = "umber";
    if (hue === "ochre" && l < 0.38) hue = "sienna";
    if (l > 0.88) name = h >= 20 && h < 75 ? "Cream" : "Pale " + hue;
    else {
      const adj = l < 0.28 ? "Deep" : l > 0.66 ? "Pale" : s < 0.3 ? "Dusky" : "";
      name = adj ? `${adj} ${hue}` : hue[0].toUpperCase() + hue.slice(1);
    }
  }
  let out = name, n = 2;
  while (taken.includes(out)) out = `${name} ${roman(n++)}`;
  return out;
}

/* ---------- Adding colours, new palettes and palettes from an image ---------- */
$("#grindBtn").addEventListener("click", () => {
  const hex = $("#grindColor").value, rgb = hex2rgb(hex);
  const p = { name: nameColour(rgb, S.work.map(c => c.name)), hex, rgb };
  addPot(p);
  toast(`${p.name} is ground and in its pot.`);
});
$("#newPalBtn").addEventListener("click", () => {
  const n = S.palettes.length + 1;
  newPalette(`My palette ${roman(n)}`, []);
  toast("A new, empty palette. Add colours with the picker, or make one from an image.");
  const inp = $("#palName"); if (inp) { inp.focus(); inp.select(); }
});
$("#imgPalBtn").addEventListener("click", () => $("#imgFile").click());
$("#imgFile").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) paletteFromImage(f); e.target.value = ""; });
const IMG_COUNT = bindRangeLate("#imgCountR", "#imgCountO");
function bindRangeLate(id, outId) {
  const r = $(id), o = $(outId), show = () => o.textContent = r.value + " colours";
  r.addEventListener("input", show); show(); return r;
}
const potsPanel = $(".panel.pots");
["dragenter", "dragover"].forEach(t => potsPanel.addEventListener(t, e => {
  if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
  e.preventDefault(); potsPanel.classList.add("dropping");
}));
["dragleave", "drop"].forEach(t => potsPanel.addEventListener(t, e => {
  if (t === "dragleave" && potsPanel.contains(e.relatedTarget)) return;
  potsPanel.classList.remove("dropping");
}));
potsPanel.addEventListener("drop", e => {
  const f = e.dataTransfer && [...e.dataTransfer.files].find(x => x.type.startsWith("image/"));
  if (!f) return;
  e.preventDefault(); showTab("colour"); paletteFromImage(f);
});

/* OKLab makes distances between colours closer to what the eye sees */
function toOklab([r, g, b]) {
  const lin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363015719 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/* k-means in OKLab, seeded with k-means++, then near-duplicates merged */
function extractColours(pixels, k) {
  const pts = pixels.map(toOklab), N = pts.length, rng = mulberry(91);
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const cents = [pts[Math.floor(rng() * N)]];
  const dist = new Float64Array(N).fill(Infinity);
  while (cents.length < k) {
    let sum = 0;
    for (let i = 0; i < N; i++) { dist[i] = Math.min(dist[i], d2(pts[i], cents[cents.length - 1])); sum += dist[i]; }
    if (!sum) break;
    let t = rng() * sum, j = 0; while ((t -= dist[j]) > 0 && j < N - 1) j++;
    cents.push(pts[j]);
  }
  const assign = new Int32Array(N);
  for (let it = 0; it < 14; it++) {
    const acc = cents.map(() => [0, 0, 0, 0, 0, 0, 0]);
    for (let i = 0; i < N; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < cents.length; c++) { const d = d2(pts[i], cents[c]); if (d < bd) { bd = d; best = c; } }
      assign[i] = best; const a = acc[best], px = pixels[i];
      a[0] += pts[i][0]; a[1] += pts[i][1]; a[2] += pts[i][2]; a[3] += px[0]; a[4] += px[1]; a[5] += px[2]; a[6]++;
    }
    acc.forEach((a, c) => { if (a[6]) cents[c] = [a[0] / a[6], a[1] / a[6], a[2] / a[6]]; cents[c].rgb = a[6] ? [a[3] / a[6], a[4] / a[6], a[5] / a[6]] : cents[c].rgb; cents[c].n = a[6]; });
  }
  let out = cents.filter(c => c.rgb && c.n > N * 0.012).sort((a, b) => b.n - a.n);
  const kept = [];
  out.forEach(c => { if (!kept.some(k2 => d2(k2, c) < 0.0016)) kept.push(c); });
  return kept.sort((a, b) => a[0] - b[0]).map(c => c.rgb); // dark to light: the first colours become the veins
}
function paletteFromImage(file) {
  if (!file.type.startsWith("image/")) { toast("That file is not an image. Choose a JPEG, PNG, WebP or GIF."); return; }
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    try {
      const max = 140, sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, w, h);
      const data = x.getImageData(0, 0, w, h).data, px = [];
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) px.push([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]);
      if (px.length < 10) { toast("That image has too few solid pixels to take colours from."); return; }
      const rgbs = extractColours(px, +IMG_COUNT.value);
      const names = [], colours = rgbs.map(rgb => { const name = nameColour(rgb, names); names.push(name); return { name, rgb, hex: rgb2hex(rgb) }; });
      const t = document.createElement("canvas"), ts = Math.min(1, 96 / Math.max(w, h));
      t.width = Math.round(w * ts); t.height = Math.round(h * ts); t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
      const base = (file.name || "image").replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 28) || "image";
      newPalette(`From ${base}`, colours, t.toDataURL("image/jpeg", 0.8));
      toast(`${colours.length} colours taken from ${file.name || "the image"}. Remove any you don't want with ×.`);
      caption(`${pot().name} is in hand.`);
    } finally { URL.revokeObjectURL(url); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("That image could not be opened. Try a JPEG or PNG."); };
  img.src = url;
}

/* ---------- Sliders ---------- */
function bindRange(id, outId, fmt, onInput) {
  const r = $(id), o = $(outId);
  const show = () => { o.textContent = fmt(parseFloat(r.value)); };
  r.addEventListener("input", () => { show(); onInput(parseFloat(r.value)); });
  show();
  return { el: r, set(v) { r.value = v; show(); } };
}
const pct = v => Math.round(v * 100) + "%";
const amount = v => v < 0.02 ? "none" : v < 0.35 ? "a little" : v < 0.7 ? "moderate" : "heavy";
let proofHinted = false;
function liveU(k, v, proof) {
  if (!M) return;
  M.U[k] = v; M.request();
  if (proof && M.mode === 0) {
    setView(1);
    if (!proofHinted) { toast("Showing the proof, as the sheet would take it up. Press P or the tab above the trough to return to the bath."); proofHinted = true; }
  }
}
const R = {
  oil: bindRange("#oilR", "#oilO", amount, v => S.oil = v),
  gall: bindRange("#gallR", "#gallO", v => v < 0.8 ? "sparing" : v > 1.25 ? "generous" : "measured", v => S.gall = v),
  size: bindRange("#sizeR", "#sizeO", v => v < 0.8 ? "thin" : v > 1.25 ? "thick" : "middling", v => S.size = v),
  rim: bindRange("#rimR", "#rimO", pct, v => liveU("rim", v)),
  grain: bindRange("#grainR", "#grainO", pct, v => liveU("grain", v)),
  alum: bindRange("#alumR", "#alumO", v => v > 0.85 ? "well mordanted" : v > 0.5 ? "light" : "starved", v => liveU("alum", v, true)),
  spanish: bindRange("#spanR", "#spanO", amount, v => liveU("spanish", v, true)),
  drag: bindRange("#dragR", "#dragO", amount, v => liveU("drag", v, true)),
  air: bindRange("#airR", "#airO", amount, v => liveU("air", v, true)),
  age: bindRange("#ageR", "#ageO", v => v < 0.02 ? "fresh" : v < 0.4 ? "a few decades" : v < 0.75 ? "a century" : "two centuries", v => liveU("age", v, true)),
  burnish: bindRange("#burnR", "#burnO", amount, v => liveU("burnish", v, true))
};
function setPaper(i, toProof = true) {
  $$("#paperSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.paper == i ? "true" : "false"));
  if (!M) return;
  M.U.paper = i; M.U.paperCol = PAPERS[i].col; M.request();
  if (toProof) liveU("paper", i, true);
}
$$("#paperSeg button").forEach(b => b.addEventListener("click", () => setPaper(+b.dataset.paper)));
function applySheet(sh = {}) {
  const map = { alum: R.alum, spanish: R.spanish, drag: R.drag, air: R.air, age: R.age, burnish: R.burnish };
  const sheet = { spanish: 0, drag: 0, ...sh };
  for (const k in map) if (k in sheet && M) { M.U[k] = sheet[k]; map[k].set(sheet[k]); }
  if ("paper" in sheet) setPaper(sheet.paper, false);
  if (M) { M.U.seed = Math.random(); M.request(); }
}

/* ---------- Bath or proof ---------- */
function setView(m) {
  if (!M) return;
  M.mode = m; M.request();
  $("#viewBath").setAttribute("aria-pressed", m === 0 ? "true" : "false");
  $("#viewProof").setAttribute("aria-pressed", m === 1 ? "true" : "false");
}
$("#viewBath").addEventListener("click", () => setView(0));
$("#viewProof").addEventListener("click", () => setView(1));

/* ---------- Studio mode: the bath across the whole screen ---------- */
const ws = $("#workspace");
function fitStudio() {
  const tr = $("#trough");
  if (!S.studio || matchMedia("(max-width: 900px), (max-height: 520px)").matches) { tr.style.width = ""; M && M.request(); drawOverlay(); return; }
  const st = $("#stage").getBoundingClientRect(), strip = $("#potStrip").getBoundingClientRect();
  const pad = parseFloat(getComputedStyle(tr).paddingLeft) || 16;
  const availW = st.width - strip.width - 14, availH = st.height;
  const bathW = Math.max(240, Math.min(availW - 2 * pad, (availH - 2 * pad) * 1.5));
  tr.style.width = Math.floor(bathW + 2 * pad) + "px";
  M && M.request(); drawOverlay();
}
function setStudio(on, viaFullscreen) {
  if (on === S.studio) return;
  S.studio = on;
  ws.classList.toggle("studio", on);
  document.body.classList.toggle("in-studio", on);
  const b = $("#studioBtn");
  b.setAttribute("aria-pressed", on ? "true" : "false");
  b.innerHTML = on ? "Leave studio <kbd>Esc</kbd>" : "Studio <kbd>F</kbd>";
  if (on) {
    const de = document.documentElement;
    if (!viaFullscreen && de.requestFullscreen && !document.fullscreenElement) {
      try { const p = de.requestFullscreen({ navigationUI: "hide" }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* the window-filling studio still works */ }
    }
    caption("Studio mode. The whole screen is the bath; Esc leaves it.");
  } else if (document.fullscreenElement && document.exitFullscreen) {
    try { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { }
  }
  requestAnimationFrame(() => requestAnimationFrame(fitStudio));
  if (typeof tourRefresh === "function") tourRefresh();
}
$("#studioBtn").addEventListener("click", () => setStudio(!S.studio));
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && S.studio) setStudio(false, true);
  else requestAnimationFrame(fitStudio);
});
window.addEventListener("resize", () => { fitStudio(); });
