(() => {
  "use strict";

  // ---------- Parameters & state ----------
  const ENVIRONMENTS = {
    vacuum: 0, air: 0.05, water: 1.5, oil: 4.0, honey: 8.0,
  };

  const params = {
    m: 1,
    c: 0.05,
    x0: 1, v0: 0,
    spring1: { k: 10, L: 1.0 },
    spring2: { enabled: false, k: 10, L: 1.0 },
    driveEnabled: false, F0: 2, wd: 3,
    orientation: "horizontal",
    environment: "air",
    g: 9.81,
  };

  const kEff = () => params.spring1.k + (params.spring2.enabled ? params.spring2.k : 0);

  const state = { t: 0, x: params.x0, v: params.v0, running: true };

  // Trace buffers
  const MAX_T = 1200, PHASE_MAX = 800;
  const trace = { t: [], x: [], v: [], E: [] };
  const phaseTrace = { x: [], v: [] };

  let needResonanceRedraw = true;

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  const setNested = (path, val) => {
    const parts = path.split(".");
    let o = params;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  };
  const getNested = (path) => {
    const parts = path.split(".");
    let o = params;
    for (const p of parts) o = o[p];
    return o;
  };

  const bindNumeric = (rangeId, numId, outId, path, fmt, onChange) => {
    const range = $(rangeId);
    const num = $(numId);
    const out = outId ? $(outId) : null;
    const apply = (v, src) => {
      if (!Number.isFinite(v)) return;
      setNested(path, v);
      if (src !== "range") range.value = String(v);
      if (src !== "num") num.value = String(v);
      if (out) out.textContent = fmt(v);
      needResonanceRedraw = true;
      if (onChange) onChange(v);
    };
    range.addEventListener("input", () => apply(parseFloat(range.value), "range"));
    num.addEventListener("input", () => apply(parseFloat(num.value), "num"));
    apply(parseFloat(num.value || range.value), null);
    return { set: (v) => apply(v, null), range, num };
  };

  // ---------- Control bindings ----------
  const mCtrl  = bindNumeric("mRange",  "mNum",  "mOut",  "m",  v => v.toFixed(2) + " kg");
  const x0Ctrl = bindNumeric("x0Range", "x0Num", "x0Out", "x0", v => v.toFixed(2) + " m");
  const v0Ctrl = bindNumeric("v0Range", "v0Num", "v0Out", "v0", v => v.toFixed(2) + " m/s");
  const gCtrl  = bindNumeric("gRange",  "gNum",  "gOut",  "g",  v => v.toFixed(2) + " m/s²");
  const k1Ctrl = bindNumeric("k1Range", "k1Num", "k1Out", "spring1.k", v => v.toFixed(1) + " N/m");
  const L1Ctrl = bindNumeric("L1Range", "L1Num", "L1Out", "spring1.L", v => v.toFixed(2) + " m");
  const k2Ctrl = bindNumeric("k2Range", "k2Num", "k2Out", "spring2.k", v => v.toFixed(1) + " N/m");
  const L2Ctrl = bindNumeric("L2Range", "L2Num", "L2Out", "spring2.L", v => v.toFixed(2) + " m");
  const cCtrl  = bindNumeric("cRange",  "cNum",  "cOut",  "c",  v => v.toFixed(2) + " N·s/m");
  const F0Ctrl = bindNumeric("F0Range", "F0Num", "F0Out", "F0", v => v.toFixed(2) + " N");
  const wdCtrl = bindNumeric("wdRange", "wdNum", "wdOut", "wd", v => v.toFixed(2) + " rad/s");

  $("driveEnabled").addEventListener("change", e => {
    params.driveEnabled = e.target.checked;
    needResonanceRedraw = true;
  });

  $("spring2Enabled").addEventListener("change", e => {
    params.spring2.enabled = e.target.checked;
    $("spring2Controls").classList.toggle("hidden", !e.target.checked);
    needResonanceRedraw = true;
  });

  const updateOrientationLabels = () => {
    const vertical = params.orientation === "vertical";
    $("spring1Title").textContent = "Spring 1 (" + (vertical ? "Ceiling" : "Left wall") + ")";
    $("spring2LocLabel").textContent = vertical ? "floor" : "right wall";
    $("gravityRow").style.opacity = vertical ? 1 : 0.5;
    gCtrl.range.disabled = !vertical;
    gCtrl.num.disabled = !vertical;
    $("rDeltaWrap").hidden = !vertical;
  };

  document.querySelectorAll("#orientation button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#orientation button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      params.orientation = btn.dataset.value;
      updateOrientationLabels();
    });
  });
  updateOrientationLabels();

  const envSel = $("environment");
  const applyEnvironment = () => {
    params.environment = envSel.value;
    const isCustom = params.environment === "custom";
    cCtrl.range.disabled = !isCustom;
    cCtrl.num.disabled = !isCustom;
    if (!isCustom) cCtrl.set(ENVIRONMENTS[params.environment]);
    needResonanceRedraw = true;
  };
  envSel.addEventListener("change", applyEnvironment);
  applyEnvironment();

  $("playBtn").addEventListener("click", e => {
    state.running = !state.running;
    e.target.textContent = state.running ? "Pause" : "Play";
  });
  $("resetBtn").addEventListener("click", () => {
    state.t = 0;
    state.x = params.x0;
    state.v = params.v0;
    trace.t.length = trace.x.length = trace.v.length = trace.E.length = 0;
    phaseTrace.x.length = phaseTrace.v.length = 0;
  });
  $("clearTraceBtn").addEventListener("click", () => {
    trace.t.length = trace.x.length = trace.v.length = trace.E.length = 0;
    phaseTrace.x.length = phaseTrace.v.length = 0;
  });

  // ---------- Physics ----------
  const force = (x, v, t) => {
    const spring = -kEff() * x;
    const damp = -params.c * v;
    const drive = params.driveEnabled ? params.F0 * Math.cos(params.wd * t) : 0;
    return (spring + damp + drive) / params.m;
  };

  const rk4Step = (dt) => {
    const { x, v, t } = state;
    const k1x = v;
    const k1v = force(x, v, t);
    const k2x = v + 0.5 * dt * k1v;
    const k2v = force(x + 0.5 * dt * k1x, v + 0.5 * dt * k1v, t + 0.5 * dt);
    const k3x = v + 0.5 * dt * k2v;
    const k3v = force(x + 0.5 * dt * k2x, v + 0.5 * dt * k2v, t + 0.5 * dt);
    const k4x = v + dt * k3v;
    const k4v = force(x + dt * k3x, v + dt * k3v, t + dt);
    state.x += (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    state.v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    state.t += dt;
  };

  // ---------- Canvas helpers ----------
  const fitCanvas = (canvas) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.floor(rect.width * dpr) ||
        canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      needResonanceRedraw = true;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  };

  const drawSpring = (ctx, x1, y1, x2, y2, coils, color) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const amp = 10;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    // short straight lead-in/out
    const leadFrac = 0.08;
    const ls = leadFrac, le = 1 - leadFrac;
    const zx1 = x1 + ls * dx, zy1 = y1 + ls * dy;
    const zx2 = x1 + le * dx, zy2 = y1 + le * dy;
    ctx.lineTo(zx1, zy1);
    const segs = Math.max(6, coils);
    for (let i = 1; i < segs; i++) {
      const f = i / segs;
      const cx = zx1 + f * (zx2 - zx1);
      const cy = zy1 + f * (zy2 - zy1);
      const side = (i % 2 === 0) ? -1 : 1;
      ctx.lineTo(cx + side * nx * amp, cy + side * ny * amp);
    }
    ctx.lineTo(zx2, zy2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  // ---------- System renderer ----------
  const simCanvas = $("sim");
  const MASS_PX = 48;

  const drawHatchedBlock = (ctx, x, y, w, h, vertical) => {
    ctx.fillStyle = "#2a3547";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#3d4c64";
    ctx.lineWidth = 1;
    const step = 10;
    if (vertical) {
      for (let i = 0; i <= h + w; i += step) {
        ctx.beginPath();
        ctx.moveTo(x, y + i);
        ctx.lineTo(x + Math.min(w, i), y + Math.max(0, i - w));
        ctx.stroke();
      }
    } else {
      for (let i = 0; i <= w + h; i += step) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + Math.max(0, i - h), y + Math.min(h, i));
        ctx.stroke();
      }
    }
  };

  const drawHorizontal = (ctx, w, h) => {
    const L1 = params.spring1.L;
    const L2 = params.spring2.L;
    const totalSpanM = L1 + (params.spring2.enabled ? L2 : L1 + 2);
    const leftPad = 40, rightPad = 40;
    const pxPerM = Math.min((w - leftPad - rightPad - MASS_PX) / totalSpanM, 160);
    const baseY = h / 2;
    const leftWallX = leftPad;
    const rightWallX = params.spring2.enabled
      ? leftWallX + (L1 + L2) * pxPerM + MASS_PX
      : w - rightPad;

    // Equilibrium mass position (x = 0)
    const eqX = leftWallX + L1 * pxPerM + MASS_PX / 2;
    const massCX = eqX + state.x * pxPerM;

    // Walls
    drawHatchedBlock(ctx, leftWallX - 18, baseY - 80, 18, 160, false);
    if (params.spring2.enabled) {
      drawHatchedBlock(ctx, rightWallX, baseY - 80, 18, 160, false);
    }

    // Floor
    ctx.strokeStyle = "#2a3547";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, baseY + MASS_PX / 2 + 2);
    ctx.lineTo(w, baseY + MASS_PX / 2 + 2);
    ctx.stroke();

    // Equilibrium marker
    ctx.strokeStyle = "#3d4c64";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(eqX, baseY - 40);
    ctx.lineTo(eqX, baseY + 40);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#8b97a8";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("x = 0", eqX, baseY + 55);

    // Springs
    drawSpring(ctx, leftWallX, baseY, massCX - MASS_PX / 2, baseY, 14, "#6dd0ff");
    if (params.spring2.enabled) {
      drawSpring(ctx, massCX + MASS_PX / 2, baseY, rightWallX, baseY, 14, "#6dd0ff");
    }

    // Mass
    ctx.fillStyle = "#4cc2ff";
    ctx.strokeStyle = "#6dd0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(massCX - MASS_PX / 2, baseY - MASS_PX / 2, MASS_PX, MASS_PX, 6);
    ctx.fill(); ctx.stroke();

    // Velocity arrow
    if (Math.abs(state.v) > 0.05) {
      const len = Math.sign(state.v) * Math.min(80, Math.abs(state.v) * 20);
      ctx.strokeStyle = ctx.fillStyle = "#ffb454";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(massCX, baseY);
      ctx.lineTo(massCX + len, baseY);
      ctx.stroke();
      const head = 6 * Math.sign(state.v);
      ctx.beginPath();
      ctx.moveTo(massCX + len, baseY);
      ctx.lineTo(massCX + len - head, baseY - 4);
      ctx.lineTo(massCX + len - head, baseY + 4);
      ctx.closePath(); ctx.fill();
    }

    // Position label
    ctx.fillStyle = "#e6edf3";
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(state.x.toFixed(2) + " m", massCX, baseY - MASS_PX / 2 - 8);
  };

  const drawVertical = (ctx, w, h) => {
    const L1 = params.spring1.L;
    const L2 = params.spring2.L;
    const hasB = params.spring2.enabled;
    const totalSpanM = hasB ? L1 + L2 : L1 + 1.5;
    const topPad = 30, bottomPad = 40;
    const pxPerM = Math.min((h - topPad - bottomPad - MASS_PX) / totalSpanM, 100);
    const cx = w / 2;
    const ceilingY = topPad;
    const floorY = hasB ? ceilingY + (L1 + L2) * pxPerM + MASS_PX : h - bottomPad;

    // Equilibrium (gravity-shifted): Δ = mg / k_eff, downward
    const delta = params.m * params.g / Math.max(0.001, kEff());
    // Mass equilibrium center y (no-gravity) = ceilingY + L1*pxPerM + MASS_PX/2
    const eqYNoG = ceilingY + L1 * pxPerM + MASS_PX / 2;
    const eqY = eqYNoG + delta * pxPerM;
    const massCY = eqY + state.x * pxPerM; // +x = downward

    // Ceiling
    drawHatchedBlock(ctx, cx - 90, ceilingY - 18, 180, 18, true);
    if (hasB) drawHatchedBlock(ctx, cx - 90, floorY, 180, 18, true);

    // Equilibrium marker
    ctx.strokeStyle = "#3d4c64";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - 70, eqY);
    ctx.lineTo(cx + 70, eqY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#8b97a8";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("x = 0", cx + 75, eqY + 3);

    // Springs
    drawSpring(ctx, cx, ceilingY, cx, massCY - MASS_PX / 2, 14, "#6dd0ff");
    if (hasB) drawSpring(ctx, cx, massCY + MASS_PX / 2, cx, floorY, 14, "#6dd0ff");

    // Mass
    ctx.fillStyle = "#4cc2ff";
    ctx.strokeStyle = "#6dd0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - MASS_PX / 2, massCY - MASS_PX / 2, MASS_PX, MASS_PX, 6);
    ctx.fill(); ctx.stroke();

    // Velocity arrow (vertical)
    if (Math.abs(state.v) > 0.05) {
      const len = Math.sign(state.v) * Math.min(80, Math.abs(state.v) * 20);
      ctx.strokeStyle = ctx.fillStyle = "#ffb454";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, massCY);
      ctx.lineTo(cx, massCY + len);
      ctx.stroke();
      const head = 6 * Math.sign(state.v);
      ctx.beginPath();
      ctx.moveTo(cx, massCY + len);
      ctx.lineTo(cx - 4, massCY + len - head);
      ctx.lineTo(cx + 4, massCY + len - head);
      ctx.closePath(); ctx.fill();
    }

    // Gravity arrow (small)
    ctx.strokeStyle = "#ff6b6b";
    ctx.fillStyle = "#ff6b6b";
    ctx.lineWidth = 1.5;
    const gx = w - 40, gy0 = h / 2 - 18, gy1 = h / 2 + 18;
    ctx.beginPath();
    ctx.moveTo(gx, gy0); ctx.lineTo(gx, gy1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx, gy1); ctx.lineTo(gx - 4, gy1 - 6); ctx.lineTo(gx + 4, gy1 - 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff6b6b";
    ctx.textAlign = "center";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText("g", gx, gy0 - 4);

    // Position label
    ctx.fillStyle = "#e6edf3";
    ctx.textAlign = "left";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(state.x.toFixed(2) + " m", cx + MASS_PX / 2 + 8, massCY + 4);
  };

  const drawSim = () => {
    const { ctx, w, h } = fitCanvas(simCanvas);
    ctx.clearRect(0, 0, w, h);
    if (params.orientation === "horizontal") drawHorizontal(ctx, w, h);
    else drawVertical(ctx, w, h);
  };

  // ---------- Time series with envelope ----------
  const graphCanvas = $("graph");

  const drawGraph = () => {
    const { ctx, w, h } = fitCanvas(graphCanvas);
    ctx.clearRect(0, 0, w, h);
    if (trace.t.length < 2) return;

    const pad = { l: 44, r: 12, t: 10, b: 22 };
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
    const t0 = trace.t[0], t1 = trace.t[trace.t.length - 1];
    const tRange = Math.max(0.5, t1 - t0);

    let maxVal = 0.1;
    for (let i = 0; i < trace.x.length; i++) {
      maxVal = Math.max(maxVal, Math.abs(trace.x[i]), Math.abs(trace.v[i]) / 3);
    }
    // Include envelope extent
    const w0 = Math.sqrt(kEff() / params.m);
    const zeta = params.c / (2 * Math.sqrt(params.m * kEff()));
    if (zeta > 0 && zeta < 1 && !params.driveEnabled) {
      maxVal = Math.max(maxVal, Math.abs(params.x0));
    }
    maxVal *= 1.1;

    // Grid
    ctx.strokeStyle = "#2a3547";
    ctx.lineWidth = 1;
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "#8b97a8";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = -2; i <= 2; i++) {
      const y = pad.t + plotH / 2 - (i / 2) * (plotH / 2);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
      ctx.fillText((i / 2 * maxVal).toFixed(2), pad.l - 4, y);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i = 0; i <= 4; i++) {
      const x = pad.l + (i / 4) * plotW;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
      ctx.fillText((t0 + (i / 4) * tRange).toFixed(1) + "s", x, pad.t + plotH + 4);
    }

    const toY = (v) => pad.t + plotH / 2 - (v / maxVal) * (plotH / 2);
    const toX = (t) => pad.l + ((t - t0) / tRange) * plotW;

    // Envelope (only undriven, underdamped)
    if (zeta > 0 && zeta < 1 && !params.driveEnabled) {
      ctx.strokeStyle = "rgba(255,107,107,0.6)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      const A = Math.abs(params.x0);
      for (const sign of [1, -1]) {
        ctx.beginPath();
        const N = 100;
        for (let i = 0; i <= N; i++) {
          const tt = t0 + (i / N) * tRange;
          const env = sign * A * Math.exp(-zeta * w0 * tt);
          const x = toX(tt), y = toY(env);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Position
    ctx.strokeStyle = "#4cc2ff"; ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < trace.t.length; i++) {
      const x = toX(trace.t[i]), y = toY(trace.x[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Velocity (÷3)
    ctx.strokeStyle = "#ffb454"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < trace.t.length; i++) {
      const x = toX(trace.t[i]), y = toY(trace.v[i] / 3);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // ---------- Phase space ----------
  const phaseCanvas = $("phase");
  const drawPhase = () => {
    const { ctx, w, h } = fitCanvas(phaseCanvas);
    ctx.clearRect(0, 0, w, h);
    if (phaseTrace.x.length < 2) return;
    const pad = 24;
    let maxX = 0.1, maxV = 0.1;
    for (let i = 0; i < phaseTrace.x.length; i++) {
      maxX = Math.max(maxX, Math.abs(phaseTrace.x[i]));
      maxV = Math.max(maxV, Math.abs(phaseTrace.v[i]));
    }
    maxX *= 1.15; maxV *= 1.15;
    const cx = w / 2, cy = h / 2;
    const sx = (w / 2 - pad) / maxX, sy = (h / 2 - pad) / maxV;

    ctx.strokeStyle = "#2a3547"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, cy); ctx.lineTo(w - pad, cy);
    ctx.moveTo(cx, pad); ctx.lineTo(cx, h - pad);
    ctx.stroke();

    ctx.fillStyle = "#8b97a8";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillText("x →", w - pad, cy + 3);
    ctx.textAlign = "left";
    ctx.fillText("ẋ ↑", cx + 3, pad);

    const n = phaseTrace.x.length;
    for (let i = 1; i < n; i++) {
      const a = (i / n) * 0.9 + 0.1;
      ctx.strokeStyle = `rgba(180,124,255,${a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + phaseTrace.x[i - 1] * sx, cy - phaseTrace.v[i - 1] * sy);
      ctx.lineTo(cx + phaseTrace.x[i] * sx, cy - phaseTrace.v[i] * sy);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx + state.x * sx, cy - state.v * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  };

  // ---------- Energy ----------
  const energyCanvas = $("energy");
  const drawEnergy = () => {
    const { ctx, w, h } = fitCanvas(energyCanvas);
    ctx.clearRect(0, 0, w, h);
    if (trace.E.length < 2) return;
    const pad = { l: 48, r: 12, t: 10, b: 22 };
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
    const t0 = trace.t[0], t1 = trace.t[trace.t.length - 1];
    const tRange = Math.max(0.5, t1 - t0);
    let maxE = 0.01;
    for (const e of trace.E) maxE = Math.max(maxE, e);
    maxE *= 1.1;

    ctx.strokeStyle = "#2a3547"; ctx.lineWidth = 1;
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "#8b97a8";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + plotH - (i / 4) * plotH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
      ctx.fillText((i / 4 * maxE).toFixed(2) + " J", pad.l - 4, y);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i = 0; i <= 4; i++) {
      const x = pad.l + (i / 4) * plotW;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
      ctx.fillText((t0 + (i / 4) * tRange).toFixed(1) + "s", x, pad.t + plotH + 4);
    }

    const toX = (t) => pad.l + ((t - t0) / tRange) * plotW;
    const toY = (e) => pad.t + plotH - (e / maxE) * plotH;

    ctx.strokeStyle = "#7bd88f"; ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < trace.E.length; i++) {
      const x = toX(trace.t[i]), y = toY(trace.E[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // ---------- Resonance curve (log-y) ----------
  const resCanvas = $("resonance");
  const drawResonance = () => {
    const { ctx, w, h } = fitCanvas(resCanvas);
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 58, r: 12, t: 10, b: 28 };
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;

    const keff = kEff();
    const w0 = Math.sqrt(keff / params.m);
    const zeta = params.c / (2 * Math.sqrt(params.m * keff));
    const wMin = 0.05 * w0, wMax = 3 * w0;
    const F0 = Math.max(0.001, params.F0);
    const c = Math.max(1e-6, params.c);
    const N = 240;
    const ampAt = (om) => F0 / Math.sqrt(Math.pow(keff - params.m * om * om, 2) + Math.pow(c * om, 2));

    // Samples
    const samples = new Array(N + 1);
    let maxA = 0, minA = Infinity;
    for (let i = 0; i <= N; i++) {
      const om = wMin + (i / N) * (wMax - wMin);
      const A = ampAt(om);
      samples[i] = { om, A };
      if (A > maxA) maxA = A;
      if (A > 0 && A < minA) minA = A;
    }
    // Log-scale bounds: show at most 3 decades below peak
    const logMax = Math.log10(Math.max(maxA, 1e-6) * 1.3);
    const logMin = Math.max(Math.log10(Math.max(minA, 1e-9)), logMax - 3);
    const logSpan = Math.max(1e-6, logMax - logMin);

    const toX = (om) => pad.l + ((om - wMin) / (wMax - wMin)) * plotW;
    const toY = (A) => {
      const la = Math.log10(Math.max(A, Math.pow(10, logMin)));
      return pad.t + plotH - ((la - logMin) / logSpan) * plotH;
    };

    // Grid (log decades)
    ctx.strokeStyle = "#2a3547"; ctx.lineWidth = 1;
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "#8b97a8";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const firstDecade = Math.ceil(logMin);
    const lastDecade = Math.floor(logMax);
    for (let d = firstDecade; d <= lastDecade; d++) {
      // Decade line + label
      const y = toY(Math.pow(10, d));
      ctx.strokeStyle = "#2a3547";
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke();
      ctx.fillStyle = "#8b97a8";
      ctx.fillText("10^" + d + " m", pad.l - 4, y);
      // Minor gridlines at 2,3,...,9
      for (let m = 2; m <= 9; m++) {
        const a = m * Math.pow(10, d);
        if (Math.log10(a) < logMin || Math.log10(a) > logMax) continue;
        const ym = toY(a);
        ctx.strokeStyle = "#1e2838";
        ctx.beginPath(); ctx.moveTo(pad.l, ym); ctx.lineTo(pad.l + plotW, ym); ctx.stroke();
      }
    }
    // X grid
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i = 0; i <= 5; i++) {
      const om = wMin + (i / 5) * (wMax - wMin);
      const x = pad.l + (i / 5) * plotW;
      ctx.strokeStyle = "#2a3547";
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + plotH); ctx.stroke();
      ctx.fillStyle = "#8b97a8";
      ctx.fillText(om.toFixed(1), x, pad.t + plotH + 4);
    }
    ctx.textAlign = "right";
    ctx.fillText("ω (rad/s)", pad.l + plotW, pad.t + plotH + 16);

    // ω₀ dashed
    ctx.strokeStyle = "#4cc2ff"; ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(w0), pad.t); ctx.lineTo(toX(w0), pad.t + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#4cc2ff";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("ω₀=" + w0.toFixed(2), toX(w0) + 3, pad.t + 2);

    // Current driver frequency
    if (params.driveEnabled && params.wd >= wMin && params.wd <= wMax) {
      ctx.strokeStyle = "#ffb454"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toX(params.wd), pad.t); ctx.lineTo(toX(params.wd), pad.t + plotH);
      ctx.stroke();
      ctx.fillStyle = "#ffb454";
      ctx.fillText("ω_d", toX(params.wd) + 3, pad.t + 14);
    }

    // Curve
    ctx.strokeStyle = "#ff9ad5"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = toX(samples[i].om), y = toY(samples[i].A);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Peak marker: ω_peak = ω₀·√(1 − 2ζ²), exists when ζ < 1/√2
    if (zeta < 1 / Math.SQRT2) {
      const wPeak = w0 * Math.sqrt(Math.max(0, 1 - 2 * zeta * zeta));
      if (wPeak >= wMin && wPeak <= wMax) {
        const aPeak = ampAt(wPeak);
        const px = toX(wPeak), py = toY(aPeak);
        ctx.fillStyle = "#ff9ad5";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ff9ad5";
        ctx.textAlign = "left"; ctx.textBaseline = "bottom";
        ctx.fillText("peak " + wPeak.toFixed(2) + ", " + aPeak.toFixed(2) + " m", px + 7, py - 4);
      }
    }
  };

  // ---------- Readouts ----------
  const elTime = $("rTime"), elX = $("rX"), elV = $("rV"), elE = $("rE");
  const elKeff = $("rKeff"), elW0 = $("rW0"), elT = $("rT");
  const elZeta = $("rZeta"), elWd = $("rWd"), elRegime = $("rRegime"), elDelta = $("rDelta");
  const elFormula = $("dampingFormula");

  const regimeOf = (z) => {
    if (z === 0) return { cls: "undamped", label: "Undamped" };
    if (z < 1) return { cls: "under", label: "Underdamped" };
    if (Math.abs(z - 1) < 0.02) return { cls: "critical", label: "Critical" };
    return { cls: "over", label: "Overdamped" };
  };

  const updateReadouts = () => {
    const k = kEff();
    const w0 = Math.sqrt(k / params.m);
    const T = (2 * Math.PI) / w0;
    const E = 0.5 * params.m * state.v * state.v + 0.5 * k * state.x * state.x;
    const zeta = params.c / (2 * Math.sqrt(params.m * k));
    const wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : NaN;
    const delta = params.m * params.g / k;

    elTime.textContent = state.t.toFixed(2) + " s";
    elX.textContent = state.x.toFixed(3) + " m";
    elV.textContent = state.v.toFixed(3) + " m/s";
    elE.textContent = E.toFixed(3) + " J";
    elKeff.textContent = k.toFixed(2) + " N/m";
    elW0.textContent = w0.toFixed(3) + " rad/s";
    elT.textContent = T.toFixed(3) + " s";
    elZeta.textContent = zeta.toFixed(3);
    elWd.textContent = isNaN(wd) ? "—" : wd.toFixed(3) + " rad/s";
    elDelta.textContent = delta.toFixed(3) + " m";

    const r = regimeOf(zeta);
    elRegime.className = "badge " + r.cls;
    elRegime.textContent = r.label;

    elFormula.textContent = "ζ = c / (2√(m·k_eff)) = "
      + params.c.toFixed(2) + " / (2·√(" + params.m.toFixed(2) + "·" + k.toFixed(2) + ")) = "
      + zeta.toFixed(3);
  };

  // ---------- Main loop ----------
  let lastFrame = performance.now();
  let sampleAccum = 0;
  const SAMPLE_INTERVAL = 1 / 120;

  const frame = (now) => {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (state.running) {
      const subs = Math.max(4, Math.ceil(dt / 0.002));
      const h = dt / subs;
      for (let i = 0; i < subs; i++) rk4Step(h);

      sampleAccum += dt;
      while (sampleAccum >= SAMPLE_INTERVAL) {
        sampleAccum -= SAMPLE_INTERVAL;
        const k = kEff();
        const E = 0.5 * params.m * state.v * state.v + 0.5 * k * state.x * state.x;
        trace.t.push(state.t); trace.x.push(state.x); trace.v.push(state.v); trace.E.push(E);
        if (trace.t.length > MAX_T) {
          trace.t.shift(); trace.x.shift(); trace.v.shift(); trace.E.shift();
        }
        phaseTrace.x.push(state.x); phaseTrace.v.push(state.v);
        if (phaseTrace.x.length > PHASE_MAX) {
          phaseTrace.x.shift(); phaseTrace.v.shift();
        }
      }
    }

    drawSim();
    drawGraph();
    drawPhase();
    drawEnergy();
    if (needResonanceRedraw) {
      drawResonance();
      needResonanceRedraw = false;
    }
    updateReadouts();
    requestAnimationFrame(frame);
  };

  // roundRect polyfill
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  // Repaint resonance on window resize
  window.addEventListener("resize", () => { needResonanceRedraw = true; });

  requestAnimationFrame(frame);
})();
