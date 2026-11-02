/* =====================================================================
   TOOLS: the rack, the comb rack, and working the bath by hand
   ===================================================================== */
const TINE_PATTERNS = { even: [], pairs: [0.3], threes: [0.22, 0.44], pairsingle: [0.2, 0.55] };
const COMBS = [
  { id: "nonpareil", name: "Nonpareil comb", note: "3 mm tines", spacing: 12, reach: 3.4, len: 46 },
  { id: "fine", name: "Fine comb", note: "6 mm tines", spacing: 24, reach: 5, len: 52 },
  { id: "dutch", name: "Dutch wide comb", note: "18 mm, for arches", spacing: 72, reach: 14, len: 90 },
  { id: "rake", name: "Rake", note: "30 mm, for fountains", spacing: 120, reach: 26, len: 140 },
  { id: "single", name: "Single tine", note: "one line, gel-git", spacing: 0, reach: 8, len: 70 },
  { id: "bouquet", name: "Bouquet rake", note: "16 mm, carried in waves", spacing: 64, reach: 15, len: 72, A: 20, wl: 64 },
  { id: "serpentine", name: "Serpentine comb", note: "12 mm, long waves", spacing: 46, reach: 15, len: 62, A: 26, wl: 160 },
  { id: "bird", name: "Bird-wing comb", note: "tines in pairs", spacing: 60, reach: 5, len: 60, pat: [0.22] },
  { id: "custom", name: "Your own comb", note: "set it below", custom: true }
];
const DIR_ARROWS = { down: "↓", right: "→", up: "↑", left: "←" };
function combSpec() {
  const o = S.opt.comb, c = COMBS.find(x => x.id === o.id) || COMBS[0];
  if (c.custom) { const u = o.custom; return { ...c, spacing: u.spacing, reach: u.reach, len: o.len, A: u.A, wl: u.wl, pat: TINE_PATTERNS[u.pat] || [] }; }
  return { ...c, len: o.len };
}
function combOp(spec, p, ang, z) {
  return OP.comb(p[0], p[1], ang, z, spec.reach * S.size, spec.spacing, spec.A || 0, spec.A ? 2 * Math.PI / spec.wl : 0, 0, spec.pat || []);
}
function combGlyph(c) {
  const W = 120, span = 240, sc = W / span;
  let d = `M2 2.5H${W - 2}`;
  const spacing = c.custom ? S.opt.comb.custom.spacing : c.spacing;
  const pat = c.custom ? TINE_PATTERNS[S.opt.comb.custom.pat] : (c.pat || []);
  const A = c.custom ? S.opt.comb.custom.A : c.A;
  if (!spacing) d += `M${W / 2} 2.5V14`;
  else for (let x0 = 0; x0 <= span; x0 += spacing) [0, ...pat].forEach(f => {
    const x = (x0 + f * spacing) * sc + 2; if (x <= W - 2) d += `M${x.toFixed(1)} 2.5V${A ? 9 : 14}`;
  });
  let wave = "";
  if (A) { wave = "M2 13"; for (let x = 2; x <= W - 2; x += 3) wave += `L${x} ${(12.5 + 2.6 * Math.sin(x / 7)).toFixed(1)}`; wave = `<path d="${wave}"/>`; }
  return `<svg viewBox="0 0 ${W} 16" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/>${wave}</svg>`;
}

const TOOL_INFO = {
  drop: "Click to touch the drop brush to the bath. Hold it down to let more colour run, and the drop spreads wider.",
  whisk: "Click or drag to throw a spray of drops, as when the whisk is struck against a rod.",
  stylus: "Drag the stylus through the floating colour. Its wake pulls the colours after it.",
  comb: "Choose a comb and a direction, then click the bath to pull it from there. You can also drag to pull it by hand. Arrow keys turn the comb.",
  curl: "Click a spot to turn a curl there, or press and drag sideways to twist it by hand. Drag right for clockwise.",
  breath: "Drag to blow across the bath. A broad, gentle push, as the suminagashi masters used a fan or their breath.",
  turps: "Click or drag to spatter turpentine. Each fleck opens a small hole in the floating colour."
};
const mm = v => Math.round(v / 4) + " mm";
const FMT = {
  size: mm, width: mm, spacing: mm, A: mm, wl: mm, R: mm, len: mm, pull: pct, strength: pct,
  count: v => String(v), reach: v => v.toFixed(1), twist: v => v.toFixed(1) + " rad"
};
function ctlHTML(id, label, min, max, step, val, fmt) {
  return `<div class="ctl"><label for="${id}">${label}</label><output id="${id}O">${fmt ? fmt(val) : val}</output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
}
const inHandHTML = '<p class="inhand" id="inHand"><span>Colour in hand:</span><span class="dot"></span><b class="nm"></b></p>';
function renderToolOpts() {
  const t = S.tool, o = S.opt[t], el = $("#toolOpts");
  let h = `<p class="how">${TOOL_INFO[t]}</p>`;
  if (t === "drop") h += inHandHTML + ctlHTML("o_size", "Size of drop", 6, 70, 1, o.size, mm);
  if (t === "whisk") h += inHandHTML + ctlHTML("o_width", "Width of spray", 30, 300, 5, o.width, mm) + ctlHTML("o_size", "Size of drops", 3, 34, 1, o.size, mm) + ctlHTML("o_count", "Drops per throw", 4, 70, 1, o.count, FMT.count) +
    `<div class="btnrow"><button class="btn ink small" type="button" id="o_all">Throw this colour over the whole bath</button></div>`;
  if (t === "stylus") h += ctlHTML("o_width", "Width of the pin's wake", 4, 32, 1, o.width, mm) + ctlHTML("o_pull", "Pull", 0.3, 1, 0.05, o.pull, pct) + ctlHTML("o_spacing", "Gel-git spacing", 14, 90, 1, o.spacing, mm) +
    `<div class="btnrow"><button class="btn ink small" type="button" id="o_gh">Gel-git across</button><button class="btn ink small" type="button" id="o_gv">Gel-git down</button></div>`;
  if (t === "comb") {
    const c = combSpec(), u = o.custom;
    h += `<div class="combs" role="group" aria-label="Comb rack">${COMBS.map(k => `<button type="button" class="comb-btn" data-comb="${k.id}" aria-pressed="${k.id === o.id}">${combGlyph(k)}<span>${k.name}</span><small>${k.note}</small></button>`).join("")}</div>`;
    h += `<div class="dirs" role="group" aria-label="Direction of pull"><span>Pull</span>${Object.keys(DIR_ARROWS).map(d => `<button type="button" data-dir="${d}" aria-pressed="${d === o.dir}" aria-label="Pull ${d}">${DIR_ARROWS[d]}</button>`).join("")}</div>`;
    h += ctlHTML("o_len", "Length of pull", 10, 260, 2, o.len, mm);
    h += `<div class="btnrow"><button class="btn ink small" type="button" id="o_through">Pull through the whole bath</button></div>`;
    h += `<details class="custom" ${c.custom ? "open" : ""}><summary>Your own comb</summary><div class="grid">` +
      ctlHTML("c_spacing", "Tine spacing", 6, 140, 1, u.spacing, mm) + ctlHTML("c_reach", "Reach of each tine", 1.5, 30, 0.5, u.reach, FMT.reach) +
      ctlHTML("c_A", "Carry it in waves", 0, 44, 1, u.A, v => v ? mm(v) + " high" : "straight") + ctlHTML("c_wl", "Length of each wave", 30, 260, 2, u.wl, mm) +
      `<label class="selrow" for="c_pat">Set the tines<select id="c_pat">${[["even", "Evenly"], ["pairs", "In pairs"], ["threes", "In threes"], ["pairsingle", "A pair and a single"]].map(([v, l]) => `<option value="${v}" ${u.pat === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>` +
      `</div></details>`;
  }
  if (t === "curl") h += ctlHTML("o_R", "Size of curl", 16, 130, 1, o.R, mm) + ctlHTML("o_twist", "Twist", 0.5, 14, 0.25, o.twist, FMT.twist) +
    `<div class="btnrow"><button class="btn ink small" type="button" id="o_rows">Curl the whole bath in rows</button><button class="btn ink small" type="button" id="o_nests">Wind nightingale's nests</button></div>`;
  if (t === "breath") h += ctlHTML("o_width", "Width of breath", 60, 320, 5, o.width, mm) + ctlHTML("o_strength", "Strength", 0.1, 0.6, 0.02, o.strength, pct);
  if (t === "turps") h += ctlHTML("o_width", "Width of spatter", 20, 320, 5, o.width, mm) + ctlHTML("o_size", "Size of flecks", 1.5, 9, 0.5, o.size, v => v.toFixed(1)) + ctlHTML("o_count", "Flecks per spatter", 10, 220, 5, o.count, FMT.count) +
    `<div class="btnrow"><button class="btn ink small" type="button" id="o_all">Spatter the whole bath</button></div>`;
  el.innerHTML = h;
  updateInHand();

  el.querySelectorAll("input[type=range]").forEach(r => {
    const custom = r.id.startsWith("c_"), key = r.id.slice(2), out = $("#" + r.id + "O");
    r.addEventListener("input", () => {
      const v = parseFloat(r.value);
      if (custom) { o.custom[key] = v; if (o.id !== "custom") selectComb("custom", false); refreshCombGlyph(); }
      else o[key] = v;
      out.textContent = key === "A" && custom ? (v ? mm(v) + " high" : "straight") : (t === "turps" && key === "size" ? v.toFixed(1) : (FMT[key] || String)(v));
      drawOverlay();
    });
  });
  const pat = $("#c_pat");
  if (pat) pat.addEventListener("change", () => { o.custom.pat = pat.value; if (o.id !== "custom") selectComb("custom", false); refreshCombGlyph(); drawOverlay(); });
  el.querySelectorAll("[data-comb]").forEach(b => b.addEventListener("click", () => selectComb(b.dataset.comb)));
  el.querySelectorAll("[data-dir]").forEach(b => b.addEventListener("click", () => setCombDir(b.dataset.dir)));
  const through = $("#o_through");
  if (through) through.addEventListener("click", () => {
    const c = combSpec();
    runSteps(h2 => h2.comb(o.dir, c.spacing || 0, c.len, c.reach, `Pulling the ${c.name.toLowerCase()} ${o.dir === "left" || o.dir === "right" ? "across" : o.dir} the whole bath`, c.A ? { A: c.A, wl: c.wl } : null, c.pat),
      () => { caption("The comb is through."); tourNotify("comb"); });
  });
  const all = $("#o_all");
  if (all) all.addEventListener("click", () => {
    if (t === "whisk") {
      const p = pot(), avg = o.size * 1.3;
      runSteps(h2 => {
        h2.step(`Throwing ${p.name.toLowerCase()} over the whole bath`, "seq", 10);
        h2.scatter(p, Math.round(0.28 * AREA / (Math.PI * avg * avg * S.gall * S.gall)), o.size * 0.8, o.size * 1.6, { shell: S.oil });
      }, () => { caption(`${p.name} is thrown.`); tourNotify("throw", p.name); nextPot(); });
    } else {
      runSteps(h2 => h2.turps(Math.round(o.count * 9), o.size * 0.5, o.size * 1.4), () => caption("The turpentine has opened the colour."));
    }
  });
  [["#o_gh", "h"], ["#o_gv", "v"]].forEach(([id, ax]) => {
    const btn = $(id); if (!btn) return;
    btn.addEventListener("click", () => runSteps(h2 => h2.gelgit(ax, o.spacing, o.spacing * 1.3, o.spacing * 0.26),
      () => { caption("Gel-git: the stylus has gone back and forth."); tourNotify("stylus"); }));
  });
  const rows = $("#o_rows"), nests = $("#o_nests");
  rows && rows.addEventListener("click", () => runSteps(h2 => h2.curls(o.R * 2.05, o.R, o.twist, "Turning the whole bath in rows of curls"), () => caption("Every row is curled.")));
  nests && nests.addEventListener("click", () => runSteps(h2 => h2.curls(o.R * 3.2, o.R * 1.55, 11, "Winding nests from the rim inwards"), () => caption("Bülbül yuvası: nightingale's nests.")));
}
function refreshCombGlyph() {
  const b = document.querySelector('[data-comb="custom"]');
  if (b) b.querySelector("svg").outerHTML = combGlyph(COMBS.find(c => c.id === "custom"));
}
function selectComb(id, rerender = true) {
  const o = S.opt.comb, c = COMBS.find(x => x.id === id); if (!c) return;
  o.id = id; if (!c.custom) o.len = c.len; else o.len = o.custom.len;
  if (S.tool !== "comb") { setTool("comb"); return; }
  if (rerender) renderToolOpts();
  else $$("[data-comb]").forEach(b => b.setAttribute("aria-pressed", b.dataset.comb === id ? "true" : "false"));
  drawOverlay();
}
function setCombDir(d) {
  S.opt.comb.dir = d;
  $$("[data-dir]").forEach(b => b.setAttribute("aria-pressed", b.dataset.dir === d ? "true" : "false"));
  drawOverlay();
}
function setTool(t) {
  S.tool = t;
  $$(".tool").forEach(b => b.setAttribute("aria-pressed", b.dataset.tool === t ? "true" : "false"));
  $("#bath").className = "bath tool-" + t;
  renderToolOpts(); drawOverlay();
}
$$(".tool").forEach(b => b.addEventListener("click", () => setTool(b.dataset.tool)));

/* ---------- Working the bath by hand ---------- */
const bath = $("#bath"), overlay = $("#overlay");
const G = { down: false, start: null, last: null, hover: null, idx: -1, t0: 0, r0: 0, moved: 0, mode: "", auto: null, spec: null, sx: 0, sy: 0 };
function trayPt(e) {
  const r = bath.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * TW, (e.clientY - r.top) / r.height * TH];
}
function sprayDrops(p, width, count, rmin, rmax, clear) {
  const c = pot();
  for (let k = 0; k < count; k++) {
    const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * width * 0.5;
    const r = rmin + (rmax - rmin) * Math.pow(Math.random(), 1.6);
    M.add(clear ? OP.drop(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, r, CLEAR.rgb, { clear: true })
      : OP.drop(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, r * S.gall, c.rgb, { metal: c.metal, clear: c.clear, shell: S.oil }));
  }
}
function pushPath(a, b, sigma, strength) {
  const step = sigma * 0.3, L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) return;
  const n = Math.ceil(L / step), dx = (b[0] - a[0]) / n, dy = (b[1] - a[1]) / n;
  for (let k = 0; k < n; k++) M.add(OP.push(a[0] + dx * (k + 0.5), a[1] + dy * (k + 0.5), sigma, dx * strength, dy * strength));
}
function finishAuto() {
  if (!G.auto) return;
  M.set(G.auto.idx, G.auto.k, G.auto.to);
  const kind = G.auto.kind; G.auto = null; M.setInteracting(false);
  if (kind === "comb") { caption("The comb is through."); tourNotify("comb"); }
  else caption("The curl is turned.");
}
bath.addEventListener("pointerdown", e => {
  if (!M || e.button > 0) return;
  e.preventDefault();
  if (P.active) stopPlayer(true);
  finishAuto();
  bath.setPointerCapture(e.pointerId);
  const p = trayPt(e), t = S.tool, o = S.opt[t];
  Object.assign(G, { down: true, start: p, last: p, hover: p, moved: 0, idx: -1, mode: "", sx: e.clientX, sy: e.clientY });
  M.setInteracting(true);
  if (!S.plateName || S.plateName === "A fresh bath") setPlate("Your own plate", "");
  const c = pot();
  if (t === "drop") {
    mark(`Dropping ${c.name.toLowerCase()}`);
    G.r0 = o.size * S.gall; G.t0 = performance.now();
    G.idx = M.add(OP.drop(p[0], p[1], G.r0, c.rgb, { metal: c.metal, clear: c.clear, shell: S.oil }));
    caption(`Dropping ${c.name.toLowerCase()}. Hold to let more colour run.`);
  } else if (t === "whisk") {
    mark(`Throwing ${c.name.toLowerCase()}`);
    sprayDrops(p, o.width, o.count, o.size * 0.4, o.size * 1.15);
    caption(`Throwing ${c.name.toLowerCase()} from the whisk.`);
  } else if (t === "turps") {
    mark("Spattering turpentine");
    sprayDrops(p, o.width, o.count, o.size * 0.45, o.size * 1.3, true);
    caption("Spattering turpentine.");
  } else if (t === "stylus" || t === "breath") {
    mark(t === "stylus" ? "Drawing the stylus" : "Breathing across the bath");
    caption(t === "stylus" ? "Drawing the stylus through the colour." : "Breathing across the bath.");
  } else if (t === "comb") {
    G.spec = combSpec();
    mark(`Pulling the ${G.spec.name.toLowerCase()} ${o.dir === "left" || o.dir === "right" ? "across" : o.dir}`);
    G.idx = M.add(combOp(G.spec, p, DIRS[o.dir], 0));
    G.mode = "pending";
    caption("Release to pull the comb, or drag to pull it by hand.");
  } else if (t === "curl") {
    mark("Turning a curl");
    G.idx = M.add(OP.swirl(p[0], p[1], 0, o.R));
    G.mode = "pending";
  }
  drawOverlay();
});
bath.addEventListener("pointermove", e => {
  if (!M) return;
  const p = trayPt(e); G.hover = p;
  if (!G.down) { drawOverlay(); return; }
  const t = S.tool, o = S.opt[t];
  const dx = p[0] - G.last[0], dy = p[1] - G.last[1], step = Math.hypot(dx, dy);
  const screenMoved = Math.hypot(e.clientX - G.sx, e.clientY - G.sy);
  G.moved += step;
  if (t === "stylus") { pushPath(G.last, p, o.width, o.pull); G.last = p; }
  else if (t === "breath") { if (step > o.width * 0.15) { pushPath(G.last, p, o.width, o.strength); G.last = p; } }
  else if (t === "whisk" && G.moved > o.width * 0.45) { sprayDrops(p, o.width, Math.ceil(o.count * 0.6), o.size * 0.4, o.size * 1.15); G.moved = 0; G.last = p; }
  else if (t === "turps" && G.moved > o.width * 0.4) { sprayDrops(p, o.width, Math.ceil(o.count * 0.6), o.size * 0.45, o.size * 1.3, true); G.moved = 0; G.last = p; }
  else if (t === "comb" && (G.mode === "drag" || screenMoved > 8)) {
    G.mode = "drag";
    let vx = p[0] - G.start[0], vy = p[1] - G.start[1];
    if (!e.shiftKey) {
      if (Math.abs(vx) > Math.abs(vy)) { vy = 0; setCombDir(vx >= 0 ? "right" : "left"); }
      else { vx = 0; setCombDir(vy >= 0 ? "down" : "up"); }
    }
    const L = Math.hypot(vx, vy);
    if (L > 1) { M.set(G.idx, 3, Math.atan2(vy, vx)); M.set(G.idx, 4, L); }
    caption(`Pulling by hand, ${mm(L)}. Hold Shift to pull at an angle.`);
  } else if (t === "curl" && (G.mode === "drag" || screenMoved > 8)) {
    G.mode = "drag";
    const tw = (p[0] - G.start[0]) / Math.max(20, o.R) * (o.twist / 2.2);
    M.set(G.idx, 3, Math.max(-o.twist * 2, Math.min(o.twist * 2, tw)));
  }
  drawOverlay();
});
function endStroke() {
  if (!G.down) return;
  G.down = false;
  const t = S.tool;
  let keepInteracting = false;
  if (t === "drop") { caption(`${pot().name} has spread.`); tourNotify("throw", pot().name); nextPot(); }
  if (t === "whisk") { caption(`${pot().name} is thrown.`); tourNotify("throw", pot().name); nextPot(); }
  if (t === "comb") {
    if (G.mode === "pending") {
      G.auto = { idx: G.idx, k: 4, to: S.opt.comb.len, t0: performance.now(), dur: 650, kind: "comb" }; keepInteracting = true;
      caption(`Pulling the ${G.spec.name.toLowerCase()}.`);
    } else if (M.ops.get(G.idx, 4) < 2) { M.popPass(); caption("Drag further to pull the comb."); }
    else { caption("The comb is through."); tourNotify("comb"); }
  }
  if (t === "curl") {
    if (G.mode === "pending") { G.auto = { idx: G.idx, k: 3, to: S.opt.curl.twist, t0: performance.now(), dur: 700, kind: "curl" }; keepInteracting = true; }
    else caption("The curl is turned.");
  }
  if (t === "stylus" || t === "breath") {
    if (M.passes && M.marks[M.passes - 1] === M.count) M.popPass();
    else if (t === "stylus") tourNotify("stylus");
  }
  if (!keepInteracting) M.setInteracting(false);
  G.idx = -1; drawOverlay();
}
bath.addEventListener("pointerup", endStroke);
bath.addEventListener("pointercancel", endStroke);
bath.addEventListener("pointerleave", () => { if (!G.down) { G.hover = null; drawOverlay(); } });

if (M) M.onFrame = () => {
  advancePlayer();
  if (G.auto) {
    const t = Math.min(1, (performance.now() - G.auto.t0) / G.auto.dur);
    M.set(G.auto.idx, G.auto.k, G.auto.to * (1 - Math.pow(1 - t, 2.2)));
    if (t >= 1) finishAuto();
  }
  if (G.down && S.tool === "drop" && G.idx >= 0) {
    const k = Math.min(1, (performance.now() - G.t0) / 1600);
    M.set(G.idx, 3, G.r0 * (1 + 1.3 * k * k));
    drawOverlay();
  }
  updateHistory();
};

/* ---------- Overlay: the tool's shadow on the bath ---------- */
function drawOverlay() {
  const c = overlay, dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext("2d"); x.clearRect(0, 0, w, h);
  const p = G.hover; if (!p || !M) return;
  const sx = w / TW, sy = h / TH, t = S.tool, o = S.opt[t];
  const X = p[0] * sx, Y = p[1] * sy;
  x.lineWidth = 1.2 * dpr; x.strokeStyle = "rgba(255,240,200,.88)"; x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 3 * dpr;
  const ring = (r, dash) => { x.setLineDash(dash ? [4 * dpr, 4 * dpr] : []); x.beginPath(); x.arc(X, Y, Math.max(2, r * sx), 0, 6.283); x.stroke(); };
  if (t === "drop") ring(G.down && G.idx >= 0 ? M.ops.get(G.idx, 3) : o.size * S.gall, !G.down);
  else if (t === "whisk" || t === "turps") ring(o.width / 2, true);
  else if (t === "stylus") { ring(o.width * 0.6); x.fillStyle = "rgba(255,240,200,.9)"; x.beginPath(); x.arc(X, Y, 1.6 * dpr, 0, 6.283); x.fill(); }
  else if (t === "breath") ring(o.width * 0.7, true);
  else if (t === "curl") {
    const cx = G.down ? G.start[0] * sx : X, cy = G.down ? G.start[1] * sy : Y;
    x.setLineDash([3 * dpr, 4 * dpr]); x.beginPath(); x.arc(cx, cy, o.R * sx, 0, 6.283); x.stroke();
    x.setLineDash([]); x.beginPath();
    for (let a = 0; a < 9.5; a += 0.12) { const r = o.R * sx * (1 - a / 11); const px = cx + Math.cos(a) * r * 0.85, py = cy + Math.sin(a) * r * 0.85; a ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.globalAlpha = 0.4; x.stroke(); x.globalAlpha = 1;
  } else if (t === "comb") drawCombPreview(x, dpr, sx, sy);
}
function drawCombHead(x, dpr, sx, sy, hx, hy, m, n, spec, solid) {
  const len = 1600;
  x.setLineDash(solid ? [] : [5 * dpr, 5 * dpr]);
  x.lineWidth = (solid ? 3 : 1.5) * dpr; x.strokeStyle = solid ? "rgba(60,38,20,.8)" : "rgba(255,240,200,.6)";
  x.beginPath(); x.moveTo((hx - n[0] * len) * sx, (hy - n[1] * len) * sy); x.lineTo((hx + n[0] * len) * sx, (hy + n[1] * len) * sy); x.stroke();
  x.lineWidth = 1.2 * dpr; x.strokeStyle = solid ? "rgba(255,240,200,.9)" : "rgba(255,240,200,.55)";
  x.beginPath();
  const tick = (bx, by) => {
    if (bx < -50 || bx > TW + 50 || by < -50 || by > TH + 50) return;
    x.moveTo(bx * sx, by * sy); x.lineTo((bx + m[0] * 16) * sx, (by + m[1] * 16) * sy);
  };
  if (!spec.spacing) tick(hx, hy);
  else {
    const K = Math.ceil(1600 / spec.spacing);
    for (let k = -K; k <= K; k++) [0, ...(spec.pat || [])].forEach(f => tick(hx + n[0] * (k + f) * spec.spacing, hy + n[1] * (k + f) * spec.spacing));
  }
  x.stroke();
}
function drawCombPreview(x, dpr, sx, sy) {
  const o = S.opt.comb, spec = G.down && G.spec ? G.spec : combSpec();
  const origin = G.down ? G.start : G.hover;
  let a = DIRS[o.dir];
  if (G.down && G.idx >= 0) a = M.ops.get(G.idx, 3);
  const m = [Math.cos(a), Math.sin(a)], n = [-m[1], m[0]];
  const pulled = G.down && G.idx >= 0 ? M.ops.get(G.idx, 4) : 0;
  const reach = G.down && G.mode === "drag" ? pulled : o.len;
  // where the comb will travel: an arrow and, for waved combs, the path of a tine
  x.setLineDash([3 * dpr, 4 * dpr]); x.lineWidth = 1.4 * dpr; x.strokeStyle = "rgba(255,240,200,.9)";
  x.beginPath();
  for (let s = 0; s <= reach; s += 3) {
    const off = spec.A ? spec.A * Math.sin(2 * Math.PI / spec.wl * s) : 0;
    const px = (origin[0] + m[0] * s + n[0] * off) * sx, py = (origin[1] + m[1] * s + n[1] * off) * sy;
    s ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.stroke();
  const ex = (origin[0] + m[0] * reach) * sx, ey = (origin[1] + m[1] * reach) * sy;
  x.setLineDash([]); x.fillStyle = "rgba(255,240,200,.95)";
  x.beginPath(); x.moveTo(ex + m[0] * 9 * dpr, ey + m[1] * 9 * dpr);
  x.lineTo(ex - m[0] * 4 * dpr + n[0] * 6 * dpr, ey - m[1] * 4 * dpr + n[1] * 6 * dpr);
  x.lineTo(ex - m[0] * 4 * dpr - n[0] * 6 * dpr, ey - m[1] * 4 * dpr - n[1] * 6 * dpr); x.closePath(); x.fill();
  // the comb where it starts (solid) and where it will stop (dashed)
  if (!G.down) drawCombHead(x, dpr, sx, sy, origin[0] + m[0] * reach, origin[1] + m[1] * reach, m, n, spec, false);
  drawCombHead(x, dpr, sx, sy, origin[0] + m[0] * pulled, origin[1] + m[1] * pulled, m, n, spec, true);
  if (!G.down) {
    x.font = `italic ${13 * dpr}px "EB Garamond", Georgia, serif`; x.fillStyle = "rgba(255,240,200,.95)";
    x.fillText(`${spec.name}: click to pull ${mm(o.len)}`, origin[0] * sx + 12 * dpr, origin[1] * sy - 12 * dpr);
  }
}
