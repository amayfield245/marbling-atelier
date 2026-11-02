"use strict";
/* =====================================================================
   THE BATH ENGINE
   Every stroke on the bath is an exactly invertible map of the plane
   (after Lu, Jaffer et al., "Mathematical Marbling", 2012). The shader
   traces each pixel backwards through the history of strokes until it
   lands inside the drop of colour that put it there.
   ===================================================================== */
const TW = 1200, TH = 800;          // the bath, in tray units
const OPF = 16;                     // floats per stroke record
const TEXW = 1024;                  // texels per row of the stroke texture
const OPS_PER_ROW = TEXW / 4;
const MAX_ROWS = 64;
const MAX_OPS = OPS_PER_ROW * MAX_ROWS;
const LIVE_MAX = 520;               // strokes traced live before older ones are baked
const CHUNK = 280;

const OP = {
  drop(x, y, r, rgb, o = {}) {
    const kind = o.clear ? 1 : (o.metal ? 2 : 0);
    return [1, x, y, r, 0, 0, 0, 0, rgb[0], rgb[1], rgb[2], kind, o.shell || 0, o.seed ?? Math.random(), 0, 0];
  },
  // tine line(s): point on a tine, angle of travel, displacement z, falloff lam, spacing (0 = single), wave amp/k/phase
  comb(px, py, ang, z, lam, spacing = 0, A = 0, k = 0, ph = 0, pat = []) {
    const p = (pat || []).slice(0, 3);
    return [2, px, py, ang, z, lam, spacing, A, p.length, p[0] || 0, p[1] || 0, p[2] || 0, k, ph, 0, 0];
  },
  swirl(cx, cy, theta, R, cell = 0, alt = 0) {
    return [3, cx, cy, theta, R, cell, alt, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  },
  push(cx, cy, sigma, vx, vy) {
    return [4, cx, cy, sigma, vx, vy, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  },
  wave(ang, A, k, ph) {
    return [5, ang, A, k, ph, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }
};
// which float of a record carries its "strength", for animating a pull
const GROW_INDEX = { 1: 3, 2: 4, 3: 3, 5: 2 };

class OpList {
  constructor(cap = 2048) { this.data = new Float32Array(cap * OPF); this.n = 0; this.dirty = 0; }
  ensure(n) {
    if (n * OPF <= this.data.length) return;
    let c = this.data.length / OPF; while (c < n) c *= 2;
    const d = new Float32Array(c * OPF); d.set(this.data.subarray(0, this.n * OPF)); this.data = d;
  }
  push(op) {
    if (this.n >= MAX_OPS) return -1;
    this.ensure(this.n + 1); this.data.set(op, this.n * OPF);
    this.dirty = Math.min(this.dirty, this.n); return this.n++;
  }
  set(i, k, v) { this.data[i * OPF + k] = v; this.dirty = Math.min(this.dirty, i); }
  get(i, k) { return this.data[i * OPF + k]; }
  truncate(n) { if (n < this.n) { this.n = n; this.dirty = Math.min(this.dirty, n); } }
  clear() { this.n = 0; this.dirty = 0; }
  toArray() { return Array.from(this.data.subarray(0, this.n * OPF), v => Math.round(v * 1000) / 1000); }
  load(arr) {
    const n = Math.min(MAX_OPS, Math.floor(arr.length / OPF)); this.ensure(n);
    this.data.set(arr.slice(0, n * OPF)); this.n = n; this.dirty = 0;
  }
}

const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uOps; uniform sampler2D uBase;
uniform int uStart; uniform int uEnd; uniform int uHasBase; uniform int uMode; uniform int uFlip; uniform int uPaper;
uniform vec2 uRes; uniform vec3 uSizeCol; uniform vec3 uPaperCol;
uniform float uRim, uGrain, uAlum, uAge, uAir, uSpanish, uDrag, uBurnish, uSeed;
out vec4 outColor;
const vec2 TRAY = vec2(1200.0, 800.0);
const vec4 EXT = vec4(-120.0, -120.0, 1440.0, 1040.0);
vec4 opv(int i, int k){ int t = i*4 + k; return texelFetch(uOps, ivec2(t & 1023, t >> 10), 0); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + vec2(17.1, 9.7); a *= 0.5; } return s; }
vec2 rot(vec2 d, float a){ float c = cos(a), s = sin(a); return vec2(c*d.x - s*d.y, s*d.x + c*d.y); }
// the wake of a pin: a divergence-free dipole, so colour flows around it instead of piling up
vec2 pin(vec2 d, vec2 v, float s2){ float g = exp(-dot(d,d)/s2); vec2 w = vec2(v.y, -v.x); return g*(v - (2.0/s2)*dot(w,d)*vec2(-d.y, d.x)); }

vec4 walk(vec2 p, out float metal){
  metal = 0.0;
  for(int i = uEnd - 1; i >= uStart; i--){
    vec4 a = opv(i, 0);
    int type = int(a.x + 0.5);
    if(type == 1){
      vec2 d = p - a.yz; float L2 = dot(d,d); float r2 = a.w*a.w;
      if(L2 < r2){
        vec4 col = opv(i, 2); vec4 ex = opv(i, 3);
        if(col.w > 0.5 && col.w < 1.5) return vec4(0.0);
        float rr = sqrt(L2) / max(a.w, 1e-3);
        vec3 c = col.rgb;
        float g1 = vnoise(d*0.33 + ex.y*137.0);
        float g2 = vnoise(d*1.4 + ex.y*71.0);
        c *= 1.0 + uGrain*((g1-0.5)*0.18 + (g2-0.5)*0.12);
        c *= 1.0 - uRim*0.42*smoothstep(0.70, 1.0, rr);
        float sh = ex.x;
        if(sh > 0.0){
          float band = smoothstep(0.78, 0.9, rr) * (1.0 - smoothstep(0.95, 0.995, rr));
          c *= 1.0 - 0.3*sh*(1.0 - rr*rr);
          c = mix(c, vec3(0.96, 0.94, 0.88), band*sh*0.9);
        }
        if(col.w > 1.5) metal = 1.0;
        return vec4(clamp(c, 0.0, 1.0), 1.0);
      }
      p = a.yz + d*sqrt(1.0 - r2/L2);
    } else if(type == 2){
      vec4 b = opv(i, 1); vec4 w = opv(i, 3);
      vec2 m = vec2(cos(a.w), sin(a.w)); vec2 n = vec2(-m.y, m.x);
      vec2 q = p - a.yz;
      float s = dot(q, m); float t = dot(q, n);
      if(b.w != 0.0) t -= b.w*sin(w.x*s + w.y);
      float disp;
      if(b.z > 0.0){
        float u = mod(t, b.z); disp = b.x*(exp(-u/b.y) + exp(-(b.z-u)/b.y));
        vec4 tp = opv(i, 2);
        for(int j = 0; j < 3; j++){
          if(float(j) < tp.x - 0.5){
            float off = (j == 0 ? tp.y : (j == 1 ? tp.z : tp.w))*b.z;
            float uj = mod(t - off, b.z); disp += b.x*(exp(-uj/b.y) + exp(-(b.z-uj)/b.y));
          }
        }
      }
      else disp = b.x*exp(-abs(t)/b.y);
      s -= disp;
      if(b.w != 0.0) t += b.w*sin(w.x*s + w.y);
      p = a.yz + m*s + n*t;
    } else if(type == 3){
      vec4 b = opv(i, 1);
      vec2 ctr = a.yz; float sgn = 1.0;
      if(b.y > 0.0){
        vec2 cell = floor((p - a.yz)/b.y); ctr = a.yz + (cell + 0.5)*b.y;
        if(b.z > 0.5 && mod(cell.x + cell.y, 2.0) > 0.5) sgn = -1.0;
      }
      vec2 d = p - ctr; float r = length(d);
      if(r < b.x){ float f = 1.0 - (r*r)/(b.x*b.x); p = ctr + rot(d, -sgn*a.w*f*f); }
    } else if(type == 4){
      vec4 b = opv(i, 1); vec2 c = a.yz; float s2 = a.w*a.w; vec2 v = b.xy;
      vec2 d = p - c; float reach = 3.3*a.w + length(v);
      if(dot(d,d) < reach*reach){
        vec2 q = p - pin(d, v, s2);
        for(int k = 0; k < 6; k++){ q = p - pin(q - c, v, s2); }
        p = q;
      }
    } else if(type == 5){
      vec2 m = vec2(cos(a.y), sin(a.y)); vec2 n = vec2(-m.y, m.x);
      vec4 b = opv(i, 1);
      p -= n*a.z*sin(a.w*dot(p, m) + b.x);
    }
  }
  if(uHasBase == 1){
    vec2 bu = (p - EXT.xy)/EXT.zw;
    if(bu.x > 0.0 && bu.y > 0.0 && bu.x < 1.0 && bu.y < 1.0){
      vec4 bc = texture(uBase, bu);
      if(bc.a > 0.003) return vec4(bc.rgb/bc.a, bc.a);
    }
  }
  return vec4(0.0);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  if(uFlip == 0) uv.y = 1.0 - uv.y;
  vec2 p = uv*TRAY;
  float metal;
  if(uMode == 2){ vec4 c = walk(EXT.xy + uv*EXT.zw, metal); outColor = vec4(c.rgb*c.a, c.a); return; }
  vec2 pp = p;
  float sw = (p.x*0.55 + p.y)*0.085 + fbm(p*0.004)*2.6;
  if(uMode == 1){
    pp.y = mix(pp.y, 400.0 + (pp.y - 400.0)*0.45, uDrag);
    pp.x += uDrag*5.0*sin(pp.y*0.07 + fbm(pp*0.01)*3.0);
    pp.x += uSpanish*6.0*sin(sw);
    pp.y += uSpanish*4.0*cos(sw);
  }
  vec4 c = walk(pp, metal);
  vec3 col;
  if(uMode == 0){
    vec3 ground = uSizeCol*(0.95 + 0.07*fbm(p*0.004));
    col = mix(ground, c.rgb, c.a*0.97);
    float sheen = smoothstep(0.55, 0.85, fbm(p*0.0025 + vec2(3.0, 1.0)));
    col += 0.035*sheen;
    col += metal*(vnoise(p*0.9) - 0.35)*0.24;
    vec2 e = min(uv, 1.0 - uv); float edge = min(e.x*1.5, e.y);
    col *= 0.86 + 0.14*smoothstep(0.0, 0.05, edge);
  } else {
    vec3 paper = uPaperCol;
    float tex = 1.0;
    if(uPaper == 0){
      tex -= 0.018*(0.5 + 0.5*sin(p.y*1.7));
      tex -= 0.045*(1.0 - smoothstep(0.0, 1.3, abs(mod(p.x + 9.0, 64.0) - 32.0)));
      tex += 0.03*(fbm(p*0.05) - 0.5);
    } else if(uPaper == 1){
      tex += 0.045*(fbm(p*0.08) - 0.5) + 0.03*(vnoise(p*0.7) - 0.5);
    } else if(uPaper == 2){
      float f1 = vnoise(vec2(p.x*0.025 + p.y*0.01, p.y*0.5));
      float f2 = vnoise(rot(p, 1.1)*vec2(0.03, 0.55) + 7.0);
      tex -= 0.055*smoothstep(0.72, 1.0, f1) + 0.045*smoothstep(0.74, 1.0, f2);
      tex += 0.035*(fbm(p*0.04) - 0.5);
    } else {
      tex += 0.04*(fbm(p*0.07) - 0.5);
      vec2 fc = floor(p/5.0);
      if(hash(fc + 3.7) > 0.985) tex -= 0.12*(1.0 - smoothstep(0.3, 1.4, length(p - (fc + 0.5)*5.0)));
    }
    float mott = fbm(p*0.018 + 5.0);
    float take = clamp(mix(0.40, 1.0, uAlum) + (mott - 0.5)*(1.0 - uAlum)*1.2, 0.0, 1.0);
    float hole = 0.0;
    if(uAir > 0.001){
      float airN = fbm(p*0.011 + vec2(uSeed*13.0, uSeed*7.0));
      float th = 0.80 - uAir*0.2;
      hole = smoothstep(th, th + 0.012, airN);
      vec2 cell = floor(p/9.0); float h = hash(cell + uSeed*31.0);
      if(h > 1.0 - uAir*0.025){
        vec2 cp = (cell + 0.3 + 0.4*vec2(hash(cell + 1.7), hash(cell + 3.1)))*9.0;
        hole = max(hole, 1.0 - smoothstep(0.7, 2.0, length(p - cp)));
      }
    }
    float a = c.a*take*(1.0 - hole);
    vec3 pig = c.rgb;
    float band = fract(sw/6.2831853);
    pig *= 1.0 - uSpanish*0.55*pow(band, 3.0) + uSpanish*0.1*(1.0 - band);
    pig += metal*(vnoise(p*0.9) - 0.3)*0.26;
    col = mix(paper, pig, a);
    col *= tex;
    float vig = length((uv - 0.5)*vec2(1.0, 1.2));
    col = mix(col, col*vec3(1.0, 0.93, 0.78), uAge*(0.5 + 0.7*vig));
    float fox = smoothstep(0.64, 0.73, fbm(p*0.035 + 21.0))*smoothstep(0.35, 0.85, fbm(p*0.004 + 2.0));
    col = mix(col, vec3(0.55, 0.37, 0.21), fox*uAge*0.5);
    vec2 fd = floor(p/7.0);
    if(hash(fd + 9.1) > 1.0 - uAge*0.012) col = mix(col, vec3(0.5, 0.33, 0.2), uAge*0.6*(1.0 - smoothstep(0.4, 1.6, length(p - (fd + 0.5)*7.0))));
    col = mix(col, col*col*(3.0 - 2.0*col), uBurnish*0.35);
    float glare = smoothstep(0.0, 1.0, 1.0 - abs(uv.x*0.7 - uv.y*0.5 - 0.1)*2.2);
    col += uBurnish*0.06*glare;
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl; this.canvas = canvas;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.loc = {};
    ["uOps", "uBase", "uStart", "uEnd", "uHasBase", "uMode", "uFlip", "uPaper", "uRes", "uSizeCol", "uPaperCol",
     "uRim", "uGrain", "uAlum", "uAge", "uAir", "uSpanish", "uDrag", "uBurnish", "uSeed"].forEach(n => this.loc[n] = gl.getUniformLocation(prog, n));
    this.vao = gl.createVertexArray();
    this.mainOps = this.makeOpsTex();
    this.auxOps = this.makeOpsTex();
    this.dummy = this.makeTarget(1, 1).tex;
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  }
  makeOpsTex() {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TEXW, MAX_ROWS, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  uploadOps(tex, data, fromOp, n) {
    if (n <= 0 || fromOp >= n) return;
    const gl = this.gl;
    const row0 = Math.floor(fromOp / OPS_PER_ROW), row1 = Math.ceil(n / OPS_PER_ROW);
    const need = row1 * TEXW * 4;
    let src = data;
    if (data.length < need) { src = new Float32Array(need); src.set(data.subarray(0, Math.min(data.length, need))); }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, row0, TEXW, row1 - row0, gl.RGBA, gl.FLOAT, src.subarray(row0 * TEXW * 4, row1 * TEXW * 4));
  }
  makeTarget(w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  }
  freeTarget(t) { if (!t) return; this.gl.deleteTexture(t.tex); this.gl.deleteFramebuffer(t.fb); }
  draw(o) {
    const gl = this.gl, L = this.loc, U = o.U;
    gl.bindFramebuffer(gl.FRAMEBUFFER, o.target ? o.target.fb : null);
    gl.viewport(0, 0, o.w, o.h);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.ops);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, o.base ? o.base.tex : this.dummy);
    gl.uniform1i(L.uOps, 0); gl.uniform1i(L.uBase, 1);
    gl.uniform1i(L.uStart, o.start); gl.uniform1i(L.uEnd, o.end);
    gl.uniform1i(L.uHasBase, o.base ? 1 : 0);
    gl.uniform1i(L.uMode, o.mode); gl.uniform1i(L.uFlip, o.flip ? 1 : 0);
    gl.uniform1i(L.uPaper, U.paper | 0);
    gl.uniform2f(L.uRes, o.w, o.h);
    gl.uniform3fv(L.uSizeCol, U.sizeCol); gl.uniform3fv(L.uPaperCol, U.paperCol);
    gl.uniform1f(L.uRim, U.rim); gl.uniform1f(L.uGrain, U.grain); gl.uniform1f(L.uAlum, U.alum);
    gl.uniform1f(L.uAge, U.age); gl.uniform1f(L.uAir, U.air); gl.uniform1f(L.uSpanish, U.spanish);
    gl.uniform1f(L.uDrag, U.drag); gl.uniform1f(L.uBurnish, U.burnish); gl.uniform1f(L.uSeed, U.seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  read(target) {
    const gl = this.gl, { w, h } = target, px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(px.buffer), w, h), 0, 0);
    return c;
  }
  /* Render a whole stroke list off-screen, baking it in chunks so no single pass runs too long. */
  renderOffscreen(data, n, w, h, U, mode) {
    const gl = this.gl;
    this.uploadOps(this.auxOps, data, 0, n);
    // intermediate bakes cover the extended bath and never fall below a useful resolution
    const bw = Math.min(this.maxTex, Math.max(720, Math.round(w * 1.6))), bh = Math.round(bw * 1040 / 1440);
    const ch = Math.max(60, Math.min(420, Math.round(4.5e8 / (bw * bh))));
    let base = null, spare = null, idx = 0;
    while (n - idx > ch) {
      const t = spare || this.makeTarget(bw, bh);
      this.draw({ target: t, w: bw, h: bh, ops: this.auxOps, start: idx, end: idx + ch, base, mode: 2, flip: true, U });
      gl.flush();
      spare = base; base = t; idx += ch;
    }
    const out = this.makeTarget(w, h);
    this.draw({ target: out, w, h, ops: this.auxOps, start: idx, end: n, base, mode, flip: true, U });
    const canvas = this.read(out);
    this.freeTarget(out); this.freeTarget(base); this.freeTarget(spare);
    return canvas;
  }
}

class Marbler {
  constructor(canvas) {
    this.r = new Renderer(canvas);
    this.canvas = canvas;
    this.ops = new OpList();
    this.marks = [];          // op index where each pass begins
    this.caps = [];           // a caption for each pass
    this.viewEnd = null;      // when looking back through history: number of ops shown
    this.viewK = null;        // ...and which pass that is
    this.mode = 0;            // 0 bath, 1 proof
    this.interacting = false;
    this.needs = true;
    this.U = {
      sizeCol: [0.85, 0.82, 0.73], paperCol: [0.95, 0.91, 0.82], paper: 0,
      rim: 0.55, grain: 0.5, alum: 0.9, age: 0, air: 0.1, spanish: 0, drag: 0, burnish: 0.25, seed: Math.random()
    };
    const bw = Math.min(2048, this.r.maxTex);
    this.bakeT = [this.r.makeTarget(bw, Math.round(bw * 1040 / 1440)), this.r.makeTarget(bw, Math.round(bw * 1040 / 1440))];
    this.bakeCur = -1; this.bakeIdx = 0;
    this.onFrame = null;
    const tick = () => { this.frame(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  get count() { return this.ops.n; }
  get passes() { return this.marks.length; }
  // which pass the bath is showing: passes() when at the present
  get viewPassIndex() { return this.viewK === null ? this.marks.length : this.viewK; }
  request() { this.needs = true; }
  add(op) { const i = this.ops.push(op); this.needs = true; return i; }
  set(i, k, v) { this.ops.set(i, k, v); this.needs = true; }
  /* begin a new pass; working from an earlier point in history sets the later passes aside */
  mark(cap = "") {
    if (this.viewEnd !== null) this.truncatePasses(this.viewPassIndex);
    this.marks.push(this.ops.n); this.caps.push(cap);
  }
  truncatePasses(k) {
    k = Math.max(0, Math.min(k, this.marks.length));
    if (k < this.marks.length) this.ops.truncate(this.marks[k]);
    this.marks.length = k; this.caps.length = k; this.viewEnd = null; this.viewK = null; this.needs = true;
  }
  popPass() { if (this.marks.length) this.truncatePasses(this.marks.length - 1); }
  viewPass(k) {
    k = Math.max(0, k);
    const v = k >= this.marks.length ? null : this.marks[k];
    this.viewK = v === null ? null : k;
    if (v !== this.viewEnd) { this.viewEnd = v; this.needs = true; }
  }
  commitView() { if (this.viewEnd !== null) this.truncatePasses(this.viewPassIndex); }
  clear() { this.ops.clear(); this.marks = []; this.caps = []; this.viewEnd = null; this.viewK = null; this.needs = true; }
  load(arr, marks, caps) {
    this.ops.load(arr); this.marks = marks && marks.length ? marks.slice() : [0];
    this.caps = this.marks.map((_, i) => (caps && caps[i]) || ""); this.viewEnd = null; this.viewK = null; this.needs = true;
  }
  sync() {
    const n = this.ops.n, nEff = this.viewEnd === null ? n : Math.min(n, this.viewEnd);
    if (this.ops.dirty < this.bakeIdx || nEff < this.bakeIdx) { this.bakeIdx = 0; this.bakeCur = -1; }
    if (this.ops.dirty < Infinity) { this.r.uploadOps(this.r.mainOps, this.ops.data, this.ops.dirty, n); this.ops.dirty = Infinity; }
    // bake one chunk per frame while the live history is long
    const limit = this.interacting ? LIVE_MAX + 400 : LIVE_MAX;
    if (nEff - this.bakeIdx > limit) {
      const target = Math.min(nEff - 60, this.bakeIdx + CHUNK);
      const dst = this.bakeCur === 0 ? 1 : 0, t = this.bakeT[dst];
      this.r.draw({ target: t, w: t.w, h: t.h, ops: this.r.mainOps, start: this.bakeIdx, end: target,
        base: this.bakeCur >= 0 ? this.bakeT[this.bakeCur] : null, mode: 2, flip: true, U: this.U });
      this.bakeCur = dst; this.bakeIdx = target;
      return nEff - this.bakeIdx <= limit + CHUNK; // still draw if close enough
    }
    return true;
  }
  frame() {
    if (this.onFrame) this.onFrame();
    if (!this.needs) return;
    const ready = this.sync();
    if (!ready) return; // keep baking next frame
    this.needs = false;
    const c = this.canvas;
    const dpr = Math.min(2, Math.max(1.25, window.devicePixelRatio || 1));
    const scale = this.interacting ? 0.6 : 1;
    const w = Math.max(60, Math.round(c.clientWidth * dpr * scale)), h = Math.max(40, Math.round(c.clientHeight * dpr * scale));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const end = this.viewEnd === null ? this.ops.n : Math.min(this.ops.n, this.viewEnd);
    this.r.draw({ target: null, w, h, ops: this.r.mainOps, start: Math.min(this.bakeIdx, end), end,
      base: this.bakeCur >= 0 ? this.bakeT[this.bakeCur] : null, mode: this.mode, flip: false, U: this.U });
  }
  setInteracting(v) {
    this.interacting = v;
    if (!v) this.needs = true;
  }
  // a full-resolution picture of the current bath (proof or bath view)
  snapshot(w, h, mode = 1) {
    return this.r.renderOffscreen(this.ops.data, this.ops.n, w, h, this.U, mode);
  }
  renderList(arr, w, h, U, mode = 1) {
    const data = arr instanceof Float32Array ? arr : new Float32Array(arr);
    return this.r.renderOffscreen(data, Math.floor(data.length / OPF), w, h, U, mode);
  }
}
