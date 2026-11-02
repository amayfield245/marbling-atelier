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
  tool: "drop", suiteId: "florentine", pots: [], potIdx: 0, customPots: [], plateSuite: null,
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
function toast(msg, ms = 3800) {
  toastEl.textContent = msg; toastEl.hidden = false;
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

/* ---------- Colour pots: the bench grid and the strip beside the bath ---------- */
const suiteSel = $("#suiteSel");
function fillSuiteSelect() {
  suiteSel.innerHTML = "";
  if (S.plateSuite) suiteSel.add(new Option("Colours of this plate", "plate"));
  SUITES.forEach(s => suiteSel.add(new Option(s.name, s.id)));
  suiteSel.value = S.suiteId;
}
function setSuite(id, pal) {
  if (id === "plate") S.plateSuite = pal || S.plateSuite;
  S.suiteId = id;
  fillSuiteSelect();
  const base = id === "plate" ? S.plateSuite : suitePal(id);
  S.pots = [...base, ...S.customPots, CLEAR, BRONZE];
  S.potIdx = 0;
  renderPots();
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
    const b = document.createElement("button");
    b.type = "button"; b.className = "pot" + (p.clear ? " clear" : "");
    b.setAttribute("aria-pressed", on);
    const w = document.createElement("span"); w.className = "well"; w.style.background = wellBg(p);
    const n = document.createElement("span"); n.className = "pname"; n.textContent = p.name;
    b.append(w, n);
    b.addEventListener("click", () => selectPot(i));
    g.appendChild(b);

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
  const n = S.pots.length - 2; // cycle through the pigments, not the clear water or bronze
  if (S.potIdx < n) { S.potIdx = (S.potIdx + 1) % Math.max(1, n); renderPots(); }
}
const potsPal = () => S.pots.filter(p => !p.clear && !p.metal);
suiteSel.addEventListener("change", () => setSuite(suiteSel.value));
$("#grindBtn").addEventListener("click", () => {
  const hex = $("#grindColor").value;
  const p = { name: "Your colour " + roman(S.customPots.length + 1), hex, rgb: hex2rgb(hex) };
  S.customPots.push(p);
  const at = S.pots.length - 2;
  S.pots.splice(at, 0, p); S.potIdx = at; renderPots();
  toast(`${p.name} is ground and in its pot.`);
});
$("#cycleChk").addEventListener("change", e => S.cycle = e.target.checked);

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
