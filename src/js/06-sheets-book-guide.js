/* =====================================================================
   SHEETS, THE PATTERN BOOK, KEYS, THE GUIDE, AND OPENING STATE
   ===================================================================== */
function opsOfSteps(steps) {
  const all = []; steps.forEach(s => s.ops.forEach(o => all.push(...o)));
  return new Float32Array(all);
}
const uFor = (sheet = {}) => {
  const paper = sheet.paper ?? 0;
  return { ...M.U, spanish: 0, drag: 0, ...sheet, paper, paperCol: PAPERS[paper].col, seed: 0.37 };
};

/* ---------- Laying down a sheet ---------- */
let laying = false;
function layDown() {
  if (!M || laying) return;
  stopPlayer(true); finishAuto(); M.commitView(); updateHistory(true);
  if (!M.count) { toast("The bath is clean. Throw some colour before laying down a sheet."); return; }
  const el = $("#sheetAnim");
  const finish = () => {
    laying = false;
    const thumb = M.snapshot(360, 240, 1).toDataURL("image/jpeg", 0.86);
    const sheet = {
      id: "s" + Date.now(), no: S.plateNo, name: S.plateName || "Your own plate",
      when: new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
      thumb, ops: M.ops.toArray(), marks: M.marks.slice(), caps: M.caps.slice(),
      U: { paper: M.U.paper, alum: M.U.alum, spanish: M.U.spanish, drag: M.U.drag, air: M.U.air, age: M.U.age, burnish: M.U.burnish, rim: M.U.rim, grain: M.U.grain, seed: M.U.seed }
    };
    S.sheets.unshift(sheet);
    if (S.sheets.length > 14) S.sheets.length = 14;
    persistSheets(); renderSheets();
    S.plateNo++; store.set("plateNo", S.plateNo);
    caption("Pulled. A bath gives one good print; skim it before the next plate.");
    toast(`Plate ${roman(sheet.no)} is hung on the drying line${S.studio ? " below the trough" : ""}. Open it to see it bound or to save it.`);
    tourNotify("sheet");
  };
  laying = true;
  if (reduceMotion()) { setView(1); finish(); return; }
  caption("Laying the sheet down by one corner, then the rest in a single movement.");
  el.style.transition = "none";
  el.style.opacity = "1"; el.style.transform = "translateY(-104%) rotate(-4deg)";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transition = "transform .75s cubic-bezier(.3,.7,.3,1)";
    el.style.transform = "translateY(0) rotate(0)";
    setTimeout(() => {
      setView(1);
      caption("Lifting the sheet from the bath.");
      el.style.transition = "transform .7s ease-in, opacity .7s ease-in";
      el.style.transform = "perspective(900px) rotateY(-70deg) translateX(-8%)"; el.style.opacity = "0";
      setTimeout(finish, 400);
    }, 1000);
  }));
}
$("#layBtn").addEventListener("click", layDown);
function persistSheets() {
  let list = S.sheets.slice();
  while (list.length && !store.set("sheets", list)) list = list.slice(0, -1);
}
function renderSheets() {
  const box = $("#sheets"); box.innerHTML = "";
  if (!S.sheets.length) { box.innerHTML = '<p class="empty">Pulled sheets hang here to dry. Lay down a sheet to take your first print.</p>'; return; }
  S.sheets.forEach(sh => {
    const b = document.createElement("button"); b.type = "button"; b.className = "sheet-thumb";
    b.setAttribute("aria-label", `Plate ${roman(sh.no)}, ${sh.name}`);
    const img = new Image(); img.src = sh.thumb; img.alt = "";
    const s = document.createElement("span"); s.textContent = `${roman(sh.no)} · ${sh.name}`;
    b.append(img, s); b.addEventListener("click", () => openSpecimen(sh));
    box.appendChild(b);
  });
}

/* ---------- Specimen: the sheet, bound ---------- */
let SPEC = null, downloads = null;
// outside a Claude artifact (opened as a plain file or on GitHub Pages) an ordinary download link works
const standalone = !window.claude;
function sheetU(sh) { return { ...M.U, ...sh.U, paperCol: PAPERS[sh.U.paper || 0].col }; }
function openSpecimen(sh) {
  if (!M) return;
  SPEC = sh;
  const big = M.renderList(sh.ops, 1200, 800, sheetU(sh), 1).toDataURL("image/jpeg", 0.92);
  $("#specImg").src = big;
  $("#specBoard").style.backgroundImage = `url(${big})`;
  $("#specTitle").textContent = `Plate ${roman(sh.no)}: ${sh.name}`;
  $("#specLabel").textContent = sh.name;
  $("#specMeta").textContent = `Pulled ${sh.when} on ${PAPERS[sh.U.paper || 0].name}, ${(sh.marks || []).length || 1} passes and ${Math.round(sh.ops.length / OPF)} strokes on the bath.`;
  $("#specDownload").hidden = !(downloads || standalone);
  $("#specimen").hidden = false;
  $("#specClose").focus();
  tourNotify("specimen");
}
function closeSpecimen() { $("#specimen").hidden = true; SPEC = null; }
$("#specClose").addEventListener("click", closeSpecimen);
$("#specimen").addEventListener("click", e => { if (e.target.id === "specimen") closeSpecimen(); });
$("#specRemove").addEventListener("click", () => {
  if (!SPEC) return;
  S.sheets = S.sheets.filter(s => s.id !== SPEC.id); persistSheets(); renderSheets(); closeSpecimen();
  toast("Taken down from the line.");
});
$("#specRestore").addEventListener("click", () => {
  if (!SPEC || !M) return;
  stopPlayer(false);
  M.load(new Float32Array(SPEC.ops), SPEC.marks, SPEC.caps);
  applySheet(SPEC.U); ["rim", "grain"].forEach(k => { if (k in SPEC.U) { M.U[k] = SPEC.U[k]; R[k].set(SPEC.U[k]); } });
  setPlate(SPEC.name, "The bath is restored as it stood when this sheet was pulled. The history slider runs back through every pass.");
  setView(0); closeSpecimen(); updateHistory(true);
});
$("#specDownload").addEventListener("click", async () => {
  if (!SPEC || !(downloads || standalone)) return;
  const btn = $("#specDownload"); btn.disabled = true; btn.textContent = "Rendering at full size…";
  await new Promise(r => setTimeout(r, 30));
  try {
    const c = M.renderList(SPEC.ops, 2400, 1600, sheetU(SPEC), 1);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    const slug = SPEC.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plate";
    const filename = `marbled-plate-${roman(SPEC.no).toLowerCase()}-${slug}.png`;
    if (downloads) await downloads.save({ filename, data: blob });
    else {
      const a = document.createElement("a"), url = URL.createObjectURL(blob);
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    toast("Saved.");
  } catch (err) {
    toast(err && err.code === "declined" ? "Not saved." : "The sheet could not be saved here.");
  } finally { btn.disabled = false; btn.textContent = "Save the sheet as PNG"; }
});
(async () => {
  try { downloads = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { downloads = null; }
})();

/* ---------- The pattern book ---------- */
const thumbs = {};
function recipeCard(rec, user) {
  const wrap = document.createElement("div");
  const b = document.createElement("button");
  b.type = "button"; b.className = "recipe"; b.dataset.id = rec.id; b.setAttribute("aria-current", "false");
  const sw = document.createElement("span"); sw.className = "sw"; if (thumbs[rec.id]) sw.style.backgroundImage = `url(${thumbs[rec.id]})`;
  const tx = document.createElement("span"); tx.className = "rt";
  tx.innerHTML = `<span class="rn"></span><span class="ra"></span><span class="rd"></span>`;
  tx.querySelector(".rn").textContent = rec.name;
  tx.querySelector(".ra").textContent = [rec.aka, rec.origin, rec.date].filter(Boolean).join(" · ");
  tx.querySelector(".rd").textContent = rec.note;
  b.append(sw, tx);
  b.addEventListener("click", () => user ? workUserRecipe(rec) : workRecipe(rec));
  wrap.appendChild(b);
  if (user) {
    const del = document.createElement("button"); del.type = "button"; del.className = "btn ink small rdel"; del.textContent = "Remove from the book";
    del.addEventListener("click", () => { S.userRecipes = S.userRecipes.filter(r => r.id !== rec.id); store.set("recipes", S.userRecipes); renderBook(); });
    wrap.appendChild(del);
  }
  return wrap;
}
function renderBook() {
  const box = $("#recipes"); box.innerHTML = "";
  const groups = S.trad === "all" ? ["japan", "ottoman", "europe", "yours"] : [S.trad];
  groups.forEach(g => {
    const list = g === "yours" ? S.userRecipes : RECIPES.filter(r => r.trad === g);
    if (!list.length && S.trad === "all") return;
    const h = document.createElement("p"); h.className = "trad-label"; h.textContent = TRAD_LABEL[g]; box.appendChild(h);
    if (!list.length) { const p = document.createElement("p"); p.className = "lede"; p.textContent = "Nothing entered yet. Work the bath your own way, name it below and enter it in the book."; box.appendChild(p); return; }
    list.forEach(r => box.appendChild(recipeCard(r, g === "yours")));
  });
  queueThumbs();
}
$$("#tradSeg button").forEach(b => b.addEventListener("click", () => {
  S.trad = b.dataset.trad;
  $$("#tradSeg button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  renderBook();
}));
$("#ownColoursChk").addEventListener("change", e => S.ownColours = e.target.checked);
let thumbQ = [], thumbBusy = false;
function queueThumbs() {
  if (!M) return;
  thumbQ = [...RECIPES, ...S.userRecipes].filter(r => !thumbs[r.id]);
  if (!thumbBusy) { thumbBusy = true; setTimeout(nextThumb, 160); }
}
function nextThumb() {
  // let the bath draw first while someone is working it
  if (G.down || P.active || G.auto) { setTimeout(nextThumb, 250); return; }
  const rec = thumbQ.shift(); if (!rec) { thumbBusy = false; return; }
  try {
    let data, U;
    if (rec.ops) { data = new Float32Array(rec.ops); U = uFor(rec.U || {}); }
    else { const h = new Hand(suitePal(rec.suite), strSeed(rec.id), { gall: 1, size: 1 }); rec.build(h); data = opsOfSteps(h.steps); U = uFor(rec.sheet); }
    U.age = 0; U.air = 0.05; U.alum = 0.95;
    thumbs[rec.id] = M.renderList(data, 228, 152, U, 1).toDataURL("image/jpeg", 0.85);
    $$(`.recipe[data-id="${rec.id}"] .sw`).forEach(s => s.style.backgroundImage = `url(${thumbs[rec.id]})`);
  } catch (e) { console.warn(e); }
  setTimeout(nextThumb, 40);
}
function workUserRecipe(rec) {
  if (!M) return;
  stopPlayer(false);
  applySheet(rec.U || {});
  setView(0);
  $$(".recipe").forEach(b => b.setAttribute("aria-current", b.dataset.id === rec.id ? "true" : "false"));
  S.last = null;
  replayOps(rec.ops, rec.marks || [0], rec.caps || [], rec.name);
}
$("#saveBtn").addEventListener("click", () => {
  if (!M) return;
  stopPlayer(true); M.commitView(); updateHistory(true);
  if (!M.count) { toast("The bath is clean. Work a pattern before entering it in the book."); return; }
  const name = $("#saveName").value.trim() || `Your plate ${roman(S.userRecipes.length + 1)}`;
  const rec = {
    id: "u" + Date.now(), trad: "yours", name, aka: "your own recipe", origin: "this atelier",
    date: new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" }),
    note: `${M.passes} passes and ${M.count} strokes on the bath. Click to watch it worked again.`,
    ops: M.ops.toArray(), marks: M.marks.slice(), caps: M.caps.slice(),
    U: { paper: M.U.paper, alum: M.U.alum, spanish: M.U.spanish, drag: M.U.drag, air: M.U.air, age: M.U.age, burnish: M.U.burnish }
  };
  S.userRecipes.unshift(rec);
  let list = S.userRecipes.slice();
  while (list.length && !store.set("recipes", list)) list = list.slice(0, -1);
  $("#saveName").value = "";
  S.trad = "yours";
  $$("#tradSeg button").forEach(x => x.setAttribute("aria-pressed", x.dataset.trad === "yours" ? "true" : "false"));
  renderBook();
  toast(`“${name}” is entered in the pattern book.`);
});

/* ---------- Keyboard ---------- */
const TOOL_KEYS = { d: "drop", w: "whisk", s: "stylus", c: "comb", r: "curl", b: "breath", t: "turps" };
const ARROW_DIRS = { ArrowDown: "down", ArrowUp: "up", ArrowLeft: "left", ArrowRight: "right" };
window.addEventListener("keydown", e => {
  const k = e.key, mod = e.metaKey || e.ctrlKey;
  if (k === "Escape") {
    if (!$("#specimen").hidden) { closeSpecimen(); return; }
    if (S.studio) { setStudio(false); return; }
    return;
  }
  if (mod && k.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
  if (mod || e.altKey) return;
  const tgt = e.target;
  if (tgt.closest && tgt.closest("input, select, textarea, [contenteditable]")) return;
  if (!$("#specimen").hidden) return;
  const lk = k.toLowerCase();
  if (TOOL_KEYS[lk]) { setTool(TOOL_KEYS[lk]); return; }
  if (/^[0-9]$/.test(k)) {
    const i = k === "0" ? S.pots.findIndex(p => p.clear) : +k - 1;
    if (i >= 0 && i < S.pots.length && !S.pots[i].metal && (k === "0" || !S.pots[i].clear)) selectPot(i);
    return;
  }
  if (ARROW_DIRS[k] && S.tool === "comb" && !(tgt.closest && tgt.closest("button"))) { e.preventDefault(); setCombDir(ARROW_DIRS[k]); caption(`The comb will pull ${ARROW_DIRS[k]}.`); return; }
  if (k === "[") { undo(); return; }
  if (k === "]") { redo(); return; }
  if (lk === "p") { setView(M && M.mode === 1 ? 0 : 1); return; }
  if (lk === "f") { setStudio(!S.studio); return; }
  if (lk === "l") { layDown(); return; }
  if (k === "?") { const d = $("#keysBox"); d.open = !d.open; if (d.open) d.scrollIntoView({ block: "nearest" }); }
});

/* ---------- The guided first plate ---------- */
const TOUR = [
  { title: "Throw three colours", target: "#potStrip",
    text: "The whisk is in your hand. Pick a colour from the strip beside the bath, then click or drag across the bath to throw it. Throw three different colours, one after another.",
    setup() { skim(); setTool("whisk"); selectPot(0, false); }, done: st => st.colours.size >= 3 },
  { title: "Draw the stylus back and forth", target: "#toolOpts",
    text: "This is gel-git, the first drawing of the colours. Press “Gel-git across”, or drag the stylus back and forth through the bath yourself.",
    setup() { setTool("stylus"); }, done: st => st.stylus },
  { title: "Pull the nonpareil comb", target: "#bath",
    text: "The 3 mm nonpareil comb is on the rack, set to pull down. The dashed comb shows where it will stop. Click anywhere on the bath and watch it go through.",
    setup() { setTool("comb"); selectComb("nonpareil"); setCombDir("down"); }, done: st => st.comb },
  { title: "Lay down a sheet", target: "#layBtn",
    text: "Press “Lay down a sheet”, or the L key. The paper takes up the whole pattern in one print, and the view turns to the proof.",
    setup() { }, done: st => st.sheet },
  { title: "See it bound", target: "#sheets",
    text: "Your sheet is hanging on the drying line under the trough. Open it to see it bound as the boards of a half-leather book.",
    setup() { if (S.studio) setStudio(false); }, done: st => st.specimen }
];
const T = { on: false, i: 0, st: null, targetEl: null, timer: 0 };
function tourStart() {
  store.set("invited", true); $("#invite").hidden = true;
  Object.assign(T, { on: true, i: 0, st: { colours: new Set(), stylus: false, comb: false, sheet: false, specimen: false } });
  tourShow();
}
function tourShow() {
  if (T.targetEl) T.targetEl.classList.remove("tour-target");
  const step = TOUR[T.i];
  if (!step) { tourEnd(true); return; }
  step.setup();
  $("#tour").hidden = false;
  $("#tourStep").textContent = `Step ${T.i + 1} of ${TOUR.length}`;
  $$("#tourProg i").forEach((el, j) => el.classList.toggle("on", j <= T.i));
  $("#tourTitle").textContent = step.title;
  $("#tourText").textContent = step.text;
  $("#tourNext").textContent = T.i === TOUR.length - 1 ? "Finish" : "Next step";
  tourRefresh();
}
function tourRefresh() {
  if (!T.on) return;
  if (T.targetEl) T.targetEl.classList.remove("tour-target");
  const el = $(TOUR[T.i].target);
  T.targetEl = el;
  if (el) { el.classList.add("tour-target"); if (!S.studio) el.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" }); }
}
function tourNotify(kind, info) {
  if (!T.on) return;
  if (kind === "throw" && info) T.st.colours.add(info);
  if (kind === "stylus") T.st.stylus = true;
  if (kind === "comb") T.st.comb = true;
  if (kind === "sheet") T.st.sheet = true;
  if (kind === "specimen") T.st.specimen = true;
  const step = TOUR[T.i];
  if (step && kind === "throw" && T.i === 0 && T.st.colours.size < 3) {
    $("#tourText").textContent = `${T.st.colours.size} of 3 colours thrown. Pick another colour from the strip and throw it.`;
  }
  if (step && step.done(T.st)) {
    clearTimeout(T.timer);
    T.timer = setTimeout(() => { T.i++; tourShow(); }, 900);
  }
}
function tourEnd(finished) {
  clearTimeout(T.timer);
  T.on = false;
  if (T.targetEl) T.targetEl.classList.remove("tour-target");
  T.targetEl = null;
  $("#tour").hidden = true;
  if (finished) toast("That is the whole craft: throw, draw, comb, lay down, bind. The pattern book has twenty-five more to try.", 6000);
}
$("#tourNext").addEventListener("click", () => { clearTimeout(T.timer); T.i++; tourShow(); });
$("#tourSkip").addEventListener("click", () => tourEnd(false));
$("#guideBtn").addEventListener("click", () => { if (P.active) stopPlayer(true); tourStart(); });
$("#inviteYes").addEventListener("click", tourStart);
$("#inviteNo").addEventListener("click", () => { store.set("invited", true); $("#invite").hidden = true; });

/* ---------- Opening state: a plate already on the bath ---------- */
setSuite(S.suiteId);
setTool("drop");
renderSheets();
renderBook();
if (M) {
  const first = RECIPES.find(r => r.id === "bouquet");
  workRecipe(first, { animate: false, seed: 271828, doneCaption: "A Bouquet is on the bath. Pick up a tool and work into it, or choose a pattern from the book." });
  updateHistory(true);
}
if (!store.get("invited", false)) $("#invite").hidden = false;
