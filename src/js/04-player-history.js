/* =====================================================================
   PLATES, THE PLAYER AND HISTORY
   ===================================================================== */
function setPlate(name, cap = "") {
  S.plateName = name;
  $("#plateNo").textContent = "Plate " + roman(S.plateNo);
  $("#plateName").textContent = name;
  $("#caption").textContent = cap;
}
const caption = t => $("#caption").textContent = t;
/* every new pass goes through here: working from an earlier point in history sets later passes aside */
function mark(cap) {
  if (!M) return;
  if (M.viewEnd !== null) {
    const k = M.viewPassIndex, dropped = M.passes - k;
    if (dropped > 0) toast(`Working on from pass ${k}. The ${dropped} later ${dropped === 1 ? "pass is" : "passes are"} set aside.`);
  }
  M.mark(cap);
}

/* ---------- The player: works a recipe stroke by stroke ---------- */
const P = { active: false, steps: [], si: 0, oi: 0, t: 0, gi: -1, onDone: null, started: false };
function play(steps, animate = true, onDone) {
  stopPlayer(false);
  if (!M) return;
  if (!animate || reduceMotion()) {
    steps.forEach(st => { mark(st.caption); st.ops.forEach(o => M.add(o)); });
    if (steps.length) caption(steps[steps.length - 1].caption);
    onDone && onDone(); return;
  }
  Object.assign(P, { active: true, steps, si: 0, oi: 0, t: 0, gi: -1, onDone, started: false });
  M.setInteracting(true);
}
function stopPlayer(flush = true) {
  if (!P.active) return;
  if (flush && M) {
    const st = P.steps[P.si];
    if (st) {
      if (P.gi >= 0) { const o = st.ops[P.oi]; M.set(P.gi, GROW_INDEX[o[0]], o[GROW_INDEX[o[0]]]); P.oi++; }
      if (!P.started) mark(st.caption);
      for (let k = P.oi; k < st.ops.length; k++) M.add(st.ops[k]);
      for (let s = P.si + 1; s < P.steps.length; s++) { mark(P.steps[s].caption); P.steps[s].ops.forEach(o => M.add(o)); }
    }
  }
  P.active = false; M && M.setInteracting(false);
  const cb = P.onDone; P.onDone = null; if (flush && cb) cb();
}
function advancePlayer() {
  if (!P.active) return;
  const st = P.steps[P.si];
  if (!st) { P.active = false; M.setInteracting(false); const cb = P.onDone; P.onDone = null; cb && cb(); return; }
  if (!P.started) { mark(st.caption); caption(st.caption); P.started = true; }
  if (st.kind === "grow") {
    const o = st.ops[P.oi], gk = GROW_INDEX[o[0]];
    if (gk === undefined) { M.add(o); P.oi++; }
    else {
      if (P.gi < 0) { const c = o.slice(); c[gk] = 0; P.gi = M.add(c); P.t = 0; }
      P.t += 1 / (st.rate || 20);
      const e = P.t >= 1 ? 1 : 1 - Math.pow(1 - P.t, 2.2);
      M.set(P.gi, gk, o[gk] * e);
      if (P.t >= 1) { P.gi = -1; P.oi++; }
    }
  } else {
    const n = st.rate || 8;
    for (let k = 0; k < n && P.oi < st.ops.length; k++) M.add(st.ops[P.oi++]);
  }
  if (P.oi >= st.ops.length) { P.si++; P.oi = 0; P.gi = -1; P.started = false; }
}
/* a short worked action from a tool panel button */
function runSteps(build, done, pal = []) {
  if (!M) return;
  stopPlayer(true);
  const h = new Hand(pal, (Math.random() * 1e9) | 0, condition());
  build(h);
  if (!S.plateName || S.plateName === "A fresh bath") setPlate("Your own plate", "");
  play(h.steps, true, done);
}

/* ---------- Working a pattern from the book ---------- */
const condition = () => ({ gall: S.gall, size: S.size });
function workRecipe(rec, o = {}) {
  if (!M) return;
  stopPlayer(false);
  const seed = o.seed ?? ((Math.random() * 1e9) | 0);
  let pal;
  if (rec.palette) { pal = rec.palette; setSuite("plate", pal); }
  else if (o.pal) pal = o.pal;
  else if (S.ownColours && rec.suite) { setSuite(rec.suite); pal = potsPal(); }
  else pal = potsPal();
  const h = new Hand(pal, seed, condition());
  rec.build(h);
  applySheet(rec.sheet);
  M.clear();
  setView(o.view ?? 0);
  setPlate(rec.name, "");
  S.last = { rec, seed, pal };
  $$(".recipe").forEach(b => b.setAttribute("aria-current", b.dataset.id === rec.id ? "true" : "false"));
  play(h.steps, o.animate !== false, () => caption(o.doneCaption || `${rec.name} is on the bath. Lay down a sheet to take the print.`));
}
$("#reworkBtn").addEventListener("click", () => {
  if (!S.last) { toast("Work a pattern from the book first, then rework it here."); return; }
  workRecipe(S.last.rec, { seed: S.last.seed, pal: S.last.pal, doneCaption: "Worked again in the new conditions of the bath." });
});
function replayOps(arr, marks, caps, name) {
  const steps = [];
  const total = arr.length / OPF;
  const bounds = [...marks.filter(m => m < total), total];
  if (bounds[0] !== 0) bounds.unshift(0);
  for (let s = 0; s < bounds.length - 1; s++) {
    const a = bounds[s], b = bounds[s + 1]; if (b <= a) continue;
    const ops = []; for (let i = a; i < b; i++) ops.push(Array.from(arr.slice(i * OPF, (i + 1) * OPF)));
    const t = ops[0][0];
    const cap = caps[s] || (t === 1 ? "Dropping colour" : t === 4 ? "Drawing the stylus" : t === 3 ? "Turning curls" : "Pulling the comb");
    const growable = ops.every(o => GROW_INDEX[o[0]] !== undefined && o[0] !== 1);
    steps.push({ caption: cap, kind: growable ? "grow" : "seq", rate: growable ? (ops.length > 3 ? 5 : 24) : Math.max(2, Math.ceil(ops.length / 45)), ops });
  }
  M.clear();
  setPlate(name, "");
  play(steps, true, () => caption("The working is replayed."));
}
$("#replayBtn").addEventListener("click", () => {
  if (!M || !M.count) { toast("The bath is clean. There is nothing to replay yet."); return; }
  stopPlayer(true); M.commitView();
  replayOps(M.ops.toArray(), M.marks.slice(), M.caps.slice(), S.plateName || "Your plate");
});
$("#randomBtn").addEventListener("click", () => {
  const seed = (Math.random() * 1e6) | 0;
  workRecipe(randomPlate(seed, condition()));
});

/* ---------- History: undo, redo and the slider ---------- */
const histR = $("#histR"), histO = $("#histO"), histLabel = $("#histLabel");
let histSeen = { p: -1, k: -1, n: -1 };
function updateHistory(force) {
  if (!M) return;
  const p = M.passes, k = M.viewPassIndex;
  if (!force && histSeen.p === p && histSeen.k === k && histSeen.n === M.count) return;
  histSeen = { p, k, n: M.count };
  histR.max = p; histR.value = k;
  histO.textContent = p === 0 ? "a clean bath" : `pass ${k} of ${p}`;
  const past = k < p;
  histLabel.classList.toggle("past", past);
  histLabel.textContent = k === 0 ? (p ? "Looking back at the clean bath." : "")
    : (past ? `Looking back: ${M.caps[k - 1] || "a pass"}. Work on from here, or press Redo.` : `Last pass: ${M.caps[k - 1] || ""}`);
  $("#undoBtn").disabled = k === 0;
  $("#redoBtn").disabled = !past;
}
function goPass(k) {
  if (!M) return;
  if (P.active) stopPlayer(true);
  finishAuto();
  M.viewPass(Math.max(0, Math.min(M.passes, k)));
  updateHistory(true);
}
function undo() {
  if (!M) return;
  if (P.active) stopPlayer(true);
  finishAuto();
  const k = M.viewPassIndex;
  if (k === 0) { toast("Nothing left to undo."); return; }
  goPass(k - 1);
  caption(`Undone: ${M.caps[k - 1] || "the last pass"}.`);
}
function redo() {
  if (!M) return;
  const k = M.viewPassIndex;
  if (k >= M.passes) { toast("Nothing to redo."); return; }
  goPass(k + 1);
  caption(`Redone: ${M.caps[k] || "a pass"}.`);
}
$("#undoBtn").addEventListener("click", undo);
$("#redoBtn").addEventListener("click", redo);
histR.addEventListener("input", () => { if (!M) return; M.setInteracting(true); goPass(+histR.value); });
histR.addEventListener("change", () => { M && M.setInteracting(false); });
$("#skimBtn").addEventListener("click", skim);
function skim() {
  if (!M) return;
  stopPlayer(false); M.clear();
  setView(0); setPlate("A fresh bath", "The surface is skimmed with a strip of newsprint. Throw your first colour.");
  updateHistory(true);
}
