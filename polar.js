(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  const fmtTheta = (t, useDeg) => {
    if (useDeg) return (t * 180 / Math.PI).toFixed(1) + "°";
    // try π fractions
    const q = t / Math.PI;
    if (Math.abs(q) < 1e-9) return "0";
    const denoms = [1, 2, 3, 4, 6, 8, 12];
    for (const d of denoms) {
      const n = q * d;
      if (Math.abs(n - Math.round(n)) < 1e-3) {
        const ni = Math.round(n);
        if (d === 1) return ni === 1 ? "π" : ni === -1 ? "−π" : ni + "π";
        if (ni === 1) return "π/" + d;
        if (ni === -1) return "−π/" + d;
        return ni + "π/" + d;
      }
    }
    return t.toFixed(3);
  };

  // ---------- Curve catalog ----------
  // Each curve provides:
  //   name, formulaText(variant), params (array), hasVariant
  //   thetaDefault: [tmin, tmax]
  //   f(t, p, v) → r  (primary branch)
  //   fNeg(t, p, v) → r  (optional secondary branch, e.g. lemniscate -√)
  //   period(p), closesBy(p, v)  (informational)
  //   description, shortcuts[], symmetry(p, v), sketchRecipe[], keyFeatures[], examTips[]
  //   keyThetas(p, v, [tmin, tmax]) → { zeros, maxes, mins }
  //   stepSize(p)

  const CURVES = {
    circle: {
      name: "Circle (centered at origin)",
      formulaText: () => "r = a",
      hasVariant: false,
      params: [
        { id: "a", label: "a (radius)", min: 0.1, max: 5, step: 0.1, default: 2, fmt: v => v.toFixed(2) }
      ],
      thetaDefault: () => [0, TAU],
      f: (t, p) => p.a,
      period: () => TAU,
      closesBy: () => TAU,
      description: "The simplest polar curve: r is independent of θ, so every point on the curve is the same distance from the origin. The result is a circle of radius |a| centered at the origin.",
      shortcuts: [
        "If r = constant, the curve is a circle of that radius around the origin.",
        "Negative a flips nothing visually — same circle as |a|."
      ],
      symmetry: () => ({ polarAxis: true, vertical: true, origin: true,
        note: "All three symmetries pass — every test leaves r = a unchanged." }),
      sketchRecipe: [
        "Draw a circle of radius a centered at the origin. That's it."
      ],
      keyFeatures: [
        "Constant r over all θ.",
        "Period 2π but the curve repeats trivially.",
        "Encloses area πa²."
      ],
      examTips: [
        "Watch for r = a as a sub-step inside larger problems (intersections, area between curves).",
        "Convert r = a to Cartesian: x² + y² = a²."
      ],
      keyThetas: () => ({ zeros: [], maxes: [], mins: [] }),
      stepSize: () => Math.PI / 4
    },

    offsetCircle: {
      name: "Off-centre circle",
      formulaText: v => v === "sin" ? "r = 2a · sin θ" : "r = 2a · cos θ",
      hasVariant: true,
      params: [
        { id: "a", label: "a (radius of circle)", min: 0.3, max: 4, step: 0.1, default: 1.5, fmt: v => v.toFixed(2) }
      ],
      thetaDefault: () => [0, Math.PI],
      f: (t, p, v) => 2 * p.a * (v === "sin" ? Math.sin(t) : Math.cos(t)),
      period: () => Math.PI,
      closesBy: () => Math.PI,
      description: "A circle of radius a, but centred not at the origin — instead at (a, 0) for the cos form, or (0, a) for the sin form. The curve passes through the origin once per period.",
      shortcuts: [
        "r = 2a·cos θ → circle of radius a centred at (a, 0); passes through origin at θ = π/2.",
        "r = 2a·sin θ → circle of radius a centred at (0, a); passes through origin at θ = 0, π.",
        "Whole circle is traced over θ ∈ [0, π]; [π, 2π] retraces it via negative r."
      ],
      symmetry: (p, v) => v === "sin"
        ? { polarAxis: false, vertical: true, origin: false,
            note: "sin θ passes the θ → π − θ test → symmetry about the line θ = π/2 (y-axis)." }
        : { polarAxis: true, vertical: false, origin: false,
            note: "cos θ is even → symmetry about the polar axis (x-axis)." },
      sketchRecipe: [
        "Read off the centre: cos form → (a, 0); sin form → (0, a).",
        "Mark the diameter: from origin to (2a, 0) for cos; (0, 2a) for sin.",
        "Draw the circle of radius a through both points.",
        "If you sweep θ from 0 to 2π, the curve retraces itself once — that's a clue you only need [0, π]."
      ],
      keyFeatures: [
        "The origin is on the curve (r = 0 once per period).",
        "Diameter equals 2a (the maximum value of r).",
        "Period π in θ, even though the equation contains a single cos/sin."
      ],
      examTips: [
        "If you ever see r = c·cos θ or r = c·sin θ, identify it as a circle through the origin with diameter |c|.",
        "Convert: r = 2a·cos θ → r² = 2ar·cos θ → x² + y² = 2ax → (x − a)² + y² = a²."
      ],
      keyThetas: (p, v, [tmin, tmax]) => {
        const within = t => t >= tmin - 1e-9 && t <= tmax + 1e-9;
        const all = [];
        if (v === "sin") {
          // zero: sin θ = 0; max: θ=π/2; min: θ=3π/2
          for (let n = -4; n <= 4; n++) all.push({ kind: "zero", t: n*Math.PI });
          for (let n = -4; n <= 4; n++) all.push({ kind: "max",  t: Math.PI/2 + n*TAU });
          for (let n = -4; n <= 4; n++) all.push({ kind: "min",  t: 3*Math.PI/2 + n*TAU });
        } else {
          for (let n = -4; n <= 4; n++) all.push({ kind: "zero", t: Math.PI/2 + n*Math.PI });
          for (let n = -4; n <= 4; n++) all.push({ kind: "max",  t: n*TAU });
          for (let n = -4; n <= 4; n++) all.push({ kind: "min",  t: Math.PI + n*TAU });
        }
        const zeros = all.filter(a => a.kind === "zero" && within(a.t)).map(a => a.t);
        const maxes = all.filter(a => a.kind === "max"  && within(a.t)).map(a => a.t);
        const mins  = all.filter(a => a.kind === "min"  && within(a.t)).map(a => a.t);
        return { zeros, maxes, mins };
      },
      stepSize: () => Math.PI / 4
    },

    rose: {
      name: "Rose curve",
      formulaText: v => v === "sin" ? "r = a · sin(kθ)" : "r = a · cos(kθ)",
      hasVariant: true,
      params: [
        { id: "a", label: "a (max |r|)", min: 0.5, max: 5, step: 0.1, default: 2, fmt: v => v.toFixed(2) },
        { id: "k", label: "k (petal-count factor, integer)", min: 1, max: 10, step: 1, default: 4, fmt: v => v.toFixed(0) }
      ],
      thetaDefault: () => [0, TAU],
      f: (t, p, v) => p.a * (v === "sin" ? Math.sin(p.k * t) : Math.cos(p.k * t)),
      period: (p) => TAU / p.k,
      closesBy: (p) => p.k % 2 === 0 ? TAU : Math.PI,
      description: "A flower-shape curve with a petal-count tied to k. The petal-tip distance from the origin is exactly |a|; petals get narrower as k grows. Choosing cos vs sin rotates the whole pattern.",
      shortcuts: [
        "k odd → k petals; k even → 2k petals.",
        "cos form: a petal tip lies along the +x axis at θ = 0. sin form: rotated by π/(2k), so a tip lies along +y for k = 1.",
        "Each petal sweeps through Δθ = π/k (angular width).",
        "Max |r| = a; the curve fits inside a circle of radius a."
      ],
      symmetry: (p, v) => {
        if (v === "sin") {
          // sin(kθ): θ→π−θ gives sin(kπ − kθ). For odd k = sin(kθ) (vertical sym ✓).
          // For even k it gives sin(kπ-kθ) = −sin(kθ-kπ) = sin(kθ). Hmm let's just say sin form has vertical sym.
          return { polarAxis: false, vertical: true, origin: p.k % 2 === 0,
            note: "sin(kθ) passes θ → π − θ → vertical-axis symmetry. Origin symmetry holds only when k is even." };
        } else {
          return { polarAxis: true, vertical: p.k % 2 === 0, origin: p.k % 2 === 0,
            note: "cos(kθ) is even → polar-axis symmetry. Even k also gives vertical-axis and origin symmetry." };
        }
      },
      sketchRecipe: [
        "Look at k's parity → petal count (k odd: k petals; k even: 2k petals).",
        "Plot r-vs-θ first: it's a sine wave touching ±a; mark zeros and extrema.",
        "Each max of |r| = a is a petal tip; each zero of r is a return to the origin.",
        "Draw each petal as a smooth loop from origin → tip → origin within Δθ = π/k."
      ],
      keyFeatures: [
        "Petals fit inside a circle of radius a.",
        "Period in θ of the function: 2π/k. Period of the polar shape: π (odd k) or 2π (even k).",
        "Negative-r portions of even-k roses draw the extra petals between the positive-r ones."
      ],
      examTips: [
        "Count petals first by checking k's parity — common gotcha.",
        "For odd k, integrating from 0 to π already gives the full curve once.",
        "Area of one petal: ∫½ a² cos²(kθ) dθ over its θ-window."
      ],
      keyThetas: (p, v, [tmin, tmax]) => {
        const within = t => t >= tmin - 1e-9 && t <= tmax + 1e-9;
        const zeros = [], maxes = [], mins = [];
        const phase = v === "sin" ? 0 : Math.PI / 2;
        const nMin = Math.floor(p.k * tmin / Math.PI) - 2;
        const nMax = Math.ceil(p.k * tmax / Math.PI) + 2;
        for (let n = nMin; n <= nMax; n++) {
          // zeros: kθ = nπ - phase  (for sin: kθ = nπ; for cos: kθ = π/2 + nπ)
          const tz = (n * Math.PI - (v === "sin" ? 0 : Math.PI/2)) / p.k;
          if (within(tz)) zeros.push(tz);
        }
        for (let n = nMin; n <= nMax; n++) {
          // maxes: kθ = 2nπ (sin: shift by π/2)
          const tm = v === "sin"
            ? (Math.PI/2 + 2*n*Math.PI) / p.k
            : (2*n*Math.PI) / p.k;
          if (within(tm)) maxes.push(tm);
          const tn = v === "sin"
            ? (3*Math.PI/2 + 2*n*Math.PI) / p.k
            : (Math.PI + 2*n*Math.PI) / p.k;
          if (within(tn)) mins.push(tn);
        }
        return { zeros, maxes, mins };
      },
      stepSize: (p) => Math.PI / (2 * p.k)
    },

    cardioid: {
      name: "Cardioid",
      formulaText: v => v === "sin" ? "r = a · (1 + sin θ)" : "r = a · (1 + cos θ)",
      hasVariant: true,
      params: [
        { id: "a", label: "a (size)", min: 0.3, max: 4, step: 0.1, default: 1.5, fmt: v => v.toFixed(2) }
      ],
      thetaDefault: () => [0, TAU],
      f: (t, p, v) => p.a * (1 + (v === "sin" ? Math.sin(t) : Math.cos(t))),
      period: () => TAU,
      closesBy: () => TAU,
      description: "Heart-shaped curve. The cusp sits at the origin; the far point is at distance 2a in the direction picked by the cos/sin choice.",
      shortcuts: [
        "It is a limaçon with a = b — the inner loop has shrunk to a point (the cusp).",
        "Max r = 2a (along the +x axis for cos form, +y for sin); min r = 0 at the opposite side.",
        "Always r ≥ 0 — no inner loop."
      ],
      symmetry: (_p, v) => v === "sin"
        ? { polarAxis: false, vertical: true, origin: false,
            note: "sin θ → vertical-axis symmetry only." }
        : { polarAxis: true, vertical: false, origin: false,
            note: "cos θ → polar-axis symmetry only." },
      sketchRecipe: [
        "Identify the orientation: cos → cusp on −x side, far point on +x side.",
        "Plot r-vs-θ: a smooth bump from 0 (at θ = π for cos) up to 2a (at θ = 0).",
        "Pick a few key θ (0, π/2, π, 3π/2) and compute r; plot those points.",
        "Connect with a smooth heart shape, hitting the origin at one θ only (the cusp)."
      ],
      keyFeatures: [
        "Single cusp at the origin.",
        "Bounded by 0 ≤ r ≤ 2a.",
        "Total area = (3/2)πa²."
      ],
      examTips: [
        "Cardioid arc-length integrand simplifies nicely thanks to half-angle identities.",
        "Watch for cardioid vs limaçon distinction — the cusp is the give-away."
      ],
      keyThetas: (p, v, [tmin, tmax]) => {
        const within = t => t >= tmin - 1e-9 && t <= tmax + 1e-9;
        const zeros = [], maxes = [];
        const tz0 = v === "sin" ? -Math.PI/2 : Math.PI;
        const tm0 = v === "sin" ? Math.PI/2 : 0;
        for (let n = -2; n <= 2; n++) {
          if (within(tz0 + n*TAU)) zeros.push(tz0 + n*TAU);
          if (within(tm0 + n*TAU)) maxes.push(tm0 + n*TAU);
        }
        return { zeros, maxes, mins: [] };
      },
      stepSize: () => Math.PI / 4
    },

    limacon: {
      name: "Limaçon",
      formulaText: v => v === "sin" ? "r = a + b · sin θ" : "r = a + b · cos θ",
      hasVariant: true,
      params: [
        { id: "a", label: "a (offset)", min: 0, max: 4, step: 0.1, default: 1, fmt: v => v.toFixed(2) },
        { id: "b", label: "b (oscillation)", min: 0, max: 4, step: 0.1, default: 2, fmt: v => v.toFixed(2) }
      ],
      thetaDefault: () => [0, TAU],
      f: (t, p, v) => p.a + p.b * (v === "sin" ? Math.sin(t) : Math.cos(t)),
      period: () => TAU,
      closesBy: () => TAU,
      description: "A family of curves whose shape depends entirely on the ratio a/b. As you slide a/b you walk through inner-loop, cardioid, dimpled, and convex limaçons.",
      shortcuts: [
        "a/b < 1 → inner loop (curve passes through origin twice).",
        "a/b = 1 → cardioid (the inner loop has degenerated into a cusp).",
        "1 < a/b < 2 → dimpled (concave near θ = π for cos) but no loop.",
        "a/b ≥ 2 → convex (no dimple, just a squashed circle)."
      ],
      symmetry: (_p, v) => v === "sin"
        ? { polarAxis: false, vertical: true, origin: false,
            note: "sin θ → vertical-axis symmetry only." }
        : { polarAxis: true, vertical: false, origin: false,
            note: "cos θ → polar-axis symmetry only." },
      sketchRecipe: [
        "Compute r(0), r(π/2), r(π), r(3π/2) — four values give you the shape.",
        "Compare a/b against 1 and 2 to predict loop / cardioid / dimple / convex.",
        "If a < b, find the inner-loop angles by solving cos θ = −a/b (or sin variant).",
        "Sketch the outer pass first; for a < b, add the small inner loop near the origin."
      ],
      keyFeatures: [
        "Max r = a + b; min r = a − b (negative when a < b — inner loop).",
        "Bounded by a circle of radius (a + b) around the origin.",
        "When a < b the curve self-intersects at the origin."
      ],
      examTips: [
        "Always state the type (inner-loop / cardioid / dimpled / convex) before sketching.",
        "Inner-loop area requires splitting the integral at the zero of r.",
        "Read off a/b directly from the equation — don't compute, just compare."
      ],
      keyThetas: (p, v, [tmin, tmax]) => {
        const within = t => t >= tmin - 1e-9 && t <= tmax + 1e-9;
        const zeros = [], maxes = [], mins = [];
        // zeros: cos θ = -a/b (or sin θ = -a/b)
        const ratio = -p.a / Math.max(1e-9, p.b);
        if (Math.abs(ratio) <= 1) {
          const base = Math.acos(ratio); // for cos variant
          if (v === "sin") {
            // sin θ = ratio
            const t1 = Math.asin(ratio);
            const t2 = Math.PI - t1;
            for (let n = -2; n <= 2; n++) {
              if (within(t1 + n*TAU)) zeros.push(t1 + n*TAU);
              if (within(t2 + n*TAU)) zeros.push(t2 + n*TAU);
            }
          } else {
            for (let n = -2; n <= 2; n++) {
              if (within(base + n*TAU)) zeros.push(base + n*TAU);
              if (within(-base + n*TAU)) zeros.push(-base + n*TAU);
            }
          }
        }
        const tm0 = v === "sin" ? Math.PI/2 : 0;
        const tn0 = v === "sin" ? 3*Math.PI/2 : Math.PI;
        for (let n = -2; n <= 2; n++) {
          if (within(tm0 + n*TAU)) maxes.push(tm0 + n*TAU);
          if (within(tn0 + n*TAU)) mins.push(tn0 + n*TAU);
        }
        return { zeros, maxes, mins };
      },
      stepSize: () => Math.PI / 4
    },

    archimedean: {
      name: "Archimedean spiral",
      formulaText: () => "r = a + b · θ",
      hasVariant: false,
      params: [
        { id: "a", label: "a (starting radius)", min: -2, max: 2, step: 0.1, default: 0, fmt: v => v.toFixed(2) },
        { id: "b", label: "b (radial growth per radian)", min: 0.05, max: 1, step: 0.01, default: 0.2, fmt: v => v.toFixed(2) }
      ],
      thetaDefault: () => [0, 6 * Math.PI],
      f: (t, p) => p.a + p.b * t,
      period: () => Infinity,
      closesBy: () => Infinity,
      description: "A spiral whose radius grows linearly with θ — each successive loop sits exactly 2πb further out than the previous one. The classic 'Archimedean spiral' that records players use.",
      shortcuts: [
        "Arm-to-arm gap (radially) = 2πb. Constant for every turn.",
        "If a = 0 the spiral starts at the origin; if a > 0 it starts at radius a on the +x axis.",
        "Negative a means the first part of the spiral has r < 0 (drawn opposite direction)."
      ],
      symmetry: () => ({ polarAxis: false, vertical: false, origin: false,
        note: "Generally none — r increases monotonically with θ, breaking all three reflection tests." }),
      sketchRecipe: [
        "Mark the starting point: at θ = 0, r = a.",
        "After one full turn (θ = 2π), r increases by 2πb. Mark that radius on the same +x axis.",
        "Continue: each turn adds another 2πb to the radius.",
        "Connect smoothly — the curve hugs each circle briefly then expands."
      ],
      keyFeatures: [
        "Constant radial spacing between successive turns.",
        "Length per turn grows roughly linearly with θ.",
        "Defined for all real θ; a < 0 produces 'before-origin' branches."
      ],
      examTips: [
        "Arc-length integrand √(r² + (dr/dθ)²) = √((a+bθ)² + b²) — keep going.",
        "Often paired with 'find the area between two consecutive turns' problems."
      ],
      keyThetas: (p, _v, [tmin, tmax]) => {
        const within = t => t >= tmin - 1e-9 && t <= tmax + 1e-9;
        const zeros = [];
        if (Math.abs(p.b) > 1e-9) {
          const tz = -p.a / p.b;
          if (within(tz)) zeros.push(tz);
        }
        return { zeros, maxes: [], mins: [] };
      },
      stepSize: () => Math.PI / 2
    },

    lemniscate: {
      name: "Lemniscate of Bernoulli",
      formulaText: v => v === "sin" ? "r² = a² · sin(2θ)" : "r² = a² · cos(2θ)",
      hasVariant: true,
      params: [
        { id: "a", label: "a (lobe radius)", min: 0.5, max: 4, step: 0.1, default: 2, fmt: v => v.toFixed(2) }
      ],
      thetaDefault: () => [0, TAU],
      f: (t, p, v) => {
        const arg = v === "sin" ? Math.sin(2 * t) : Math.cos(2 * t);
        return arg < 0 ? NaN : p.a * Math.sqrt(arg);
      },
      fNeg: (t, p, v) => {
        const arg = v === "sin" ? Math.sin(2 * t) : Math.cos(2 * t);
        return arg < 0 ? NaN : -p.a * Math.sqrt(arg);
      },
      period: () => Math.PI,
      closesBy: () => TAU,
      description: "The infinity sign — a figure-eight lying along an axis chosen by the cos/sin variant. Defined only where cos(2θ) (or sin(2θ)) is non-negative; elsewhere r² < 0 has no real root.",
      shortcuts: [
        "cos form: lobes along the x-axis. sin form: lobes along the diagonals (rotated 45°).",
        "Maximum |r| = a, reached at the centre of each lobe.",
        "Curve is undefined for θ where the right-hand side is negative — those gaps in r-vs-θ are real."
      ],
      symmetry: () => ({ polarAxis: true, vertical: true, origin: true,
        note: "All three: r² = a²·cos(2θ) is even in θ, even under θ → π − θ (cos(2π − 2θ) = cos(2θ)), and r → −r leaves r² unchanged." }),
      sketchRecipe: [
        "Find the θ where cos(2θ) = 0 → θ = π/4, 3π/4, 5π/4, 7π/4. The curve hits origin at all four.",
        "Find the θ where cos(2θ) = 1 → θ = 0, π. Both points have |r| = a — the lobe centres.",
        "Sketch the right lobe by sweeping θ from −π/4 to π/4 (cos positive there).",
        "Reflect through origin to get the left lobe."
      ],
      keyFeatures: [
        "Two lobes meeting at the origin.",
        "Defined only on a θ-range half the full circle.",
        "Total enclosed area = a²."
      ],
      examTips: [
        "Always state the θ range over which r² ≥ 0 before integrating area.",
        "Convert: (x² + y²)² = a²(x² − y²) for cos; (x² + y²)² = 2a²·xy for sin."
      ],
      keyThetas: (_p, v, [tmin, tmax]) => {
        const within = t => t >= tmin - 1e-9 && t <= tmax + 1e-9;
        const zeros = [], maxes = [];
        if (v === "sin") {
          // sin(2θ) = 0 at θ = nπ/2; sin(2θ) = 1 at θ = π/4 + nπ
          for (let n = -4; n <= 4; n++) {
            const tz = n * Math.PI / 2;
            if (within(tz)) zeros.push(tz);
          }
          for (let n = -4; n <= 4; n++) {
            const tm = Math.PI/4 + n*Math.PI;
            if (within(tm)) maxes.push(tm);
          }
        } else {
          // cos(2θ) = 0 at θ = π/4 + nπ/2; cos(2θ) = 1 at θ = nπ
          for (let n = -4; n <= 4; n++) {
            const tz = Math.PI/4 + n*Math.PI/2;
            if (within(tz)) zeros.push(tz);
          }
          for (let n = -4; n <= 4; n++) {
            const tm = n * Math.PI;
            if (within(tm)) maxes.push(tm);
          }
        }
        return { zeros, maxes, mins: [] };
      },
      stepSize: () => Math.PI / 8
    },

    logSpiral: {
      name: "Logarithmic spiral",
      formulaText: () => "r = a · e^(bθ)",
      hasVariant: false,
      params: [
        { id: "a", label: "a (starting radius at θ=0)", min: 0.05, max: 2, step: 0.01, default: 0.3, fmt: v => v.toFixed(2) },
        { id: "b", label: "b (growth rate)", min: -0.4, max: 0.4, step: 0.01, default: 0.15, fmt: v => v.toFixed(2) }
      ],
      thetaDefault: () => [0, 6 * Math.PI],
      f: (t, p) => p.a * Math.exp(p.b * t),
      period: () => Infinity,
      closesBy: () => Infinity,
      description: "A spiral that scales by a constant ratio per turn — the same shape at any zoom. Found in seashells, galaxies, and the famous 'golden spiral' approximation.",
      shortcuts: [
        "After one full turn, r is multiplied by e^(2πb). Independent of the starting radius.",
        "b > 0: outward spiral. b < 0: inward (asymptotic to origin). b = 0: degenerates to a circle.",
        "The angle between any radius vector and the curve is constant: arctan(1/b)."
      ],
      symmetry: () => ({ polarAxis: false, vertical: false, origin: false,
        note: "No reflection symmetries — but the curve IS self-similar under rotation + scaling, which is a different kind of symmetry." }),
      sketchRecipe: [
        "Mark r at θ = 0: that's a (the seed).",
        "Mark r at θ = 2π: a·e^(2πb). Scale factor per turn.",
        "Continue outward (b>0) or inward (b<0); plot one or two more turns by repeated multiplication.",
        "Connect smoothly; the curve never crosses itself."
      ],
      keyFeatures: [
        "Constant ratio (not constant difference) between successive turns.",
        "Infinite arc length to origin for b < 0; finite from any starting θ outward for b > 0.",
        "Self-similar under rotation."
      ],
      examTips: [
        "Distinguish from Archimedean: 'how does each turn relate to the previous one?' Linear → Archimedean; multiplicative → log spiral.",
        "Arc length integrand simplifies: √(r² + (dr/dθ)²) = r·√(1 + b²)."
      ],
      keyThetas: () => ({ zeros: [], maxes: [], mins: [] }),
      stepSize: () => Math.PI / 2
    }
  };

  // ---------- App state ----------
  const state = {
    curveId: "rose",
    variant: "cos",
    params: {},                // active params for the chosen curve, by id
    thetaMin: 0,
    thetaMax: TAU,
    speed: 1.5,                 // rad/s in continuous mode
    tCurrent: 0,                 // running θ
    playing: false,
    challenge: false,
    options: {
      degrees: false,
      cartesian: false,
      radius: true,
      arc: true,
      dot: true,
      autofit: true,
      markers: true,
      sidePlot: true
    }
  };

  // ---------- DOM helpers ----------
  const fitCanvas = (canvas) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.floor(rect.width * dpr) ||
        canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  };

  // ---------- Param UI builder ----------
  const paramHost = $("paramHost");
  const buildParamControls = () => {
    paramHost.innerHTML = "";
    state.params = {};
    const curve = CURVES[state.curveId];
    curve.params.forEach(spec => {
      const wrap = document.createElement("div");
      wrap.className = "control";
      const labelLine = document.createElement("label");
      const labelText = document.createElement("span");
      labelText.textContent = spec.label;
      const valueOut = document.createElement("span");
      valueOut.className = "value";
      labelLine.appendChild(labelText);
      labelLine.appendChild(valueOut);
      const dual = document.createElement("div");
      dual.className = "dual";
      const range = document.createElement("input");
      range.type = "range";
      range.min = spec.min; range.max = spec.max; range.step = spec.step;
      range.value = spec.default;
      const num = document.createElement("input");
      num.type = "number";
      num.step = spec.step; num.value = spec.default;
      dual.appendChild(range); dual.appendChild(num);
      wrap.appendChild(labelLine); wrap.appendChild(dual);
      paramHost.appendChild(wrap);

      state.params[spec.id] = +spec.default;
      const apply = (v, src) => {
        if (!Number.isFinite(v)) return;
        v = clamp(v, spec.min, spec.max);
        // snap to step for integer params
        if (spec.step >= 1) v = Math.round(v / spec.step) * spec.step;
        state.params[spec.id] = v;
        if (src !== "range") range.value = String(v);
        if (src !== "num") num.value = String(v);
        valueOut.textContent = spec.fmt(v);
        onParamsChanged();
      };
      range.addEventListener("input", () => apply(parseFloat(range.value), "range"));
      num.addEventListener("input", () => apply(parseFloat(num.value), "num"));
      apply(+spec.default, null);
    });
  };

  // ---------- About panel ----------
  const aboutEls = {
    name: $("aboutName"),
    formula: $("aboutFormula"),
    desc: $("aboutDesc"),
    shortcuts: $("aboutShortcuts"),
    symmetry: $("aboutSymmetry"),
    recipe: $("aboutRecipe"),
    key: $("aboutKey"),
    tips: $("aboutTips")
  };

  const renderList = (el, items) => {
    el.innerHTML = "";
    items.forEach(s => {
      const li = document.createElement("li");
      li.innerHTML = s;
      el.appendChild(li);
    });
  };

  const updateAboutPanel = () => {
    const curve = CURVES[state.curveId];
    aboutEls.name.textContent = curve.name;
    aboutEls.formula.textContent = curve.formulaText(state.variant);
    aboutEls.desc.textContent = curve.description;
    renderList(aboutEls.shortcuts, curve.shortcuts);
    renderList(aboutEls.recipe, curve.sketchRecipe);
    renderList(aboutEls.key, curve.keyFeatures);
    renderList(aboutEls.tips, curve.examTips);
    const sym = curve.symmetry(state.params, state.variant);
    const passed = [];
    if (sym.polarAxis) passed.push("polar axis");
    if (sym.vertical) passed.push("line θ = π/2");
    if (sym.origin) passed.push("origin");
    const passedStr = passed.length ? passed.join(", ") : "none of the standard tests";
    aboutEls.symmetry.innerHTML =
      `<strong>Symmetry:</strong> ${passedStr}. <br><span class="mono" style="color:var(--muted)">${sym.note}</span>`;
  };

  // ---------- Sampling & geometry ----------
  const N_SAMPLES = 1500;

  const sampleBranch = (curve, fn, [tmin, tmax], n = N_SAMPLES) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = tmin + (tmax - tmin) * i / n;
      const r = fn(t, state.params, state.variant);
      if (Number.isFinite(r)) pts.push({ t, r, x: r * Math.cos(t), y: r * Math.sin(t) });
      else pts.push(null);
    }
    return pts;
  };

  const computeRMax = (curve) => {
    let rmax = 0;
    const branches = [curve.f];
    if (curve.fNeg) branches.push(curve.fNeg);
    for (const fn of branches) {
      const pts = sampleBranch(curve, fn, [state.thetaMin, state.thetaMax], 600);
      for (const p of pts) {
        if (p && Number.isFinite(p.r)) rmax = Math.max(rmax, Math.abs(p.r));
      }
    }
    return clamp(rmax * 1.05, 0.5, 100);
  };

  // ---------- Polar canvas rendering ----------
  const polarCanvas = $("polar");

  const drawPolarGrid = (ctx, w, h, rMax) => {
    const cx = w / 2, cy = h / 2;
    const s = 0.45 * Math.min(w, h) / rMax;
    ctx.save();
    // background
    ctx.fillStyle = "#0a0f16";
    ctx.fillRect(0, 0, w, h);

    // optional cartesian cross
    if (state.options.cartesian) {
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy); ctx.lineTo(w, cy);
      ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
      ctx.stroke();
    }

    // rings
    const ringStep = rMax <= 2 ? 0.5 : rMax <= 6 ? 1 : rMax <= 15 ? 2 : 5;
    ctx.strokeStyle = "var(--grid)";
    ctx.strokeStyle = "#2a3547";
    ctx.lineWidth = 1;
    for (let r = ringStep; r <= rMax + 1e-6; r += ringStep) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * s, 0, TAU);
      ctx.stroke();
    }

    // ring labels along +x
    ctx.fillStyle = "#5a6678";
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (let r = ringStep; r <= rMax + 1e-6; r += ringStep) {
      ctx.fillText(r.toFixed(ringStep < 1 ? 1 : 0), cx + r * s + 4, cy - 7);
    }

    // spokes
    const minorStep = Math.PI / 12;  // 15°
    const majorStep = Math.PI / 6;   // 30°
    for (let a = 0; a < TAU - 1e-6; a += minorStep) {
      const isMajor = Math.abs(a / majorStep - Math.round(a / majorStep)) < 1e-6;
      ctx.strokeStyle = isMajor ? "#2f3c50" : "#202a3a";
      ctx.lineWidth = isMajor ? 1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * rMax * s, cy - Math.sin(a) * rMax * s);
      ctx.stroke();
    }

    // angle labels at outer rim
    ctx.fillStyle = "#5a6678";
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    for (let a = 0; a < TAU - 1e-6; a += majorStep) {
      const lx = cx + Math.cos(a) * (rMax * s + 14);
      const ly = cy - Math.sin(a) * (rMax * s + 14);
      ctx.fillText(fmtTheta(a, state.options.degrees), lx, ly);
    }

    ctx.restore();
    return { cx, cy, s };
  };

  const drawPolarCurve = (ctx, geom, curve, fn, color, traceUpTo) => {
    const { cx, cy, s } = geom;
    const pts = sampleBranch(curve, fn, [state.thetaMin, state.thetaMax]);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    let prev = null;
    for (const p of pts) {
      if (!p) { started = false; prev = null; continue; }
      if (p.t > traceUpTo + 1e-9) break;
      const px = cx + p.x * s;
      const py = cy - p.y * s;
      if (!started) { ctx.moveTo(px, py); started = true; }
      else {
        // discontinuity check
        const dx = p.x - prev.x, dy = p.y - prev.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 8 / s) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      prev = p;
    }
    ctx.stroke();
    ctx.restore();
  };

  const drawPolarMarkers = (ctx, geom, curve) => {
    if (!state.options.markers) return;
    const { cx, cy, s } = geom;
    const kt = curve.keyThetas(state.params, state.variant, [state.thetaMin, state.thetaMax]);
    const drawDot = (t, color, filled, size = 5) => {
      const r = curve.f(t, state.params, state.variant);
      if (!Number.isFinite(r)) return;
      const x = cx + r * Math.cos(t) * s;
      const y = cy - r * Math.sin(t) * s;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      if (filled) { ctx.fillStyle = color; ctx.fill(); }
      else { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); }
    };
    ctx.save();
    kt.zeros.forEach(t => drawDot(t, "#8b97a8", false, 4));
    kt.maxes.forEach(t => drawDot(t, "#7bd88f", true, 4));
    kt.mins.forEach(t => drawDot(t, "#b47cff", true, 4));
    ctx.restore();
  };

  const drawPolarOverlay = (ctx, geom, curve) => {
    const { cx, cy, s } = geom;
    const t = state.tCurrent;
    const r = curve.f(t, state.params, state.variant);
    if (!Number.isFinite(r)) return;
    const px = cx + r * Math.cos(t) * s;
    const py = cy - r * Math.sin(t) * s;
    ctx.save();
    if (state.options.radius) {
      ctx.strokeStyle = "rgba(255,180,84,0.55)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state.options.arc) {
      const arcR = Math.min(28, Math.abs(r) * s * 0.4);
      const start = 0;
      const end = -t; // canvas y is flipped, so positive θ is counter-clockwise
      ctx.strokeStyle = "rgba(76,194,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, Math.min(start, end), Math.max(start, end));
      ctx.stroke();
    }
    if (state.options.dot) {
      ctx.fillStyle = "#ffb454";
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#0a0f16";
      ctx.stroke();
    }
    ctx.restore();
  };

  const renderPolar = () => {
    const { ctx, w, h } = fitCanvas(polarCanvas);
    const curve = CURVES[state.curveId];
    const rMax = state.options.autofit ? computeRMax(curve) : 5;
    const geom = drawPolarGrid(ctx, w, h, rMax);
    drawPolarCurve(ctx, geom, curve, curve.f, "rgba(76,194,255,0.65)", state.tCurrent);
    if (curve.fNeg) drawPolarCurve(ctx, geom, curve, curve.fNeg, "rgba(255,154,213,0.55)", state.tCurrent);
    drawPolarMarkers(ctx, geom, curve);
    drawPolarOverlay(ctx, geom, curve);
    return { rMax };
  };

  // ---------- r-vs-θ side plot rendering ----------
  const rThetaCanvas = $("rTheta");

  const renderRTheta = (rMax) => {
    if (!state.options.sidePlot) {
      $("sidePlotPanel").classList.add("hidden");
      return;
    } else {
      $("sidePlotPanel").classList.remove("hidden");
    }
    const { ctx, w, h } = fitCanvas(rThetaCanvas);
    ctx.fillStyle = "#0a0f16";
    ctx.fillRect(0, 0, w, h);

    const padL = 38, padR = 14, padT = 14, padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const tmin = state.thetaMin, tmax = state.thetaMax;
    const rRange = Math.max(0.5, rMax);

    const xOf = t => padL + (t - tmin) / (tmax - tmin) * plotW;
    const yOf = r => padT + (1 - (r + rRange) / (2 * rRange)) * plotH;

    // grid: vertical lines at multiples of π/4 (or 30° if degrees)
    const tickStep = state.options.degrees ? Math.PI / 6 : Math.PI / 4;
    ctx.strokeStyle = "#202a3a";
    ctx.lineWidth = 1;
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.fillStyle = "#5a6678";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const startTick = Math.ceil(tmin / tickStep) * tickStep;
    for (let t = startTick; t <= tmax + 1e-9; t += tickStep) {
      const x = xOf(t);
      ctx.beginPath();
      ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.fillText(fmtTheta(t, state.options.degrees), x, padT + plotH + 4);
    }
    // r gridlines: at integer values
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const rStep = rRange <= 2 ? 0.5 : rRange <= 6 ? 1 : 2;
    for (let r = -Math.floor(rRange / rStep) * rStep; r <= rRange + 1e-9; r += rStep) {
      const y = yOf(r);
      ctx.strokeStyle = Math.abs(r) < 1e-9 ? "#3d4c64" : "#202a3a";
      ctx.lineWidth = Math.abs(r) < 1e-9 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillStyle = "#5a6678";
      ctx.fillText(r.toFixed(rStep < 1 ? 1 : 0), padL - 4, y);
    }

    // axis labels
    ctx.fillStyle = "#8b97a8";
    ctx.font = "11px ui-monospace, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("r", padL + 4, padT + 2);
    ctx.textAlign = "right";
    ctx.fillText("θ", padL + plotW - 4, padT + plotH - 14);

    // curve(s)
    const curve = CURVES[state.curveId];
    const drawSide = (fn, color) => {
      const pts = sampleBranch(curve, fn, [tmin, tmax]);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (const p of pts) {
        if (!p) { started = false; continue; }
        const x = xOf(p.t), y = yOf(p.r);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    drawSide(curve.f, "rgba(76,194,255,0.85)");
    if (curve.fNeg) drawSide(curve.fNeg, "rgba(255,154,213,0.7)");

    // key-theta markers
    if (state.options.markers) {
      const kt = curve.keyThetas(state.params, state.variant, [tmin, tmax]);
      kt.zeros.forEach(t => {
        const x = xOf(t), y = yOf(0);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU);
        ctx.strokeStyle = "#8b97a8"; ctx.lineWidth = 1.5; ctx.stroke();
      });
      kt.maxes.forEach(t => {
        const r = curve.f(t, state.params, state.variant);
        if (!Number.isFinite(r)) return;
        const x = xOf(t), y = yOf(r);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU);
        ctx.fillStyle = "#7bd88f"; ctx.fill();
      });
      kt.mins.forEach(t => {
        const r = curve.f(t, state.params, state.variant);
        if (!Number.isFinite(r)) return;
        const x = xOf(t), y = yOf(r);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU);
        ctx.fillStyle = "#b47cff"; ctx.fill();
      });
    }

    // running marker
    const t = state.tCurrent;
    if (t >= tmin - 1e-9 && t <= tmax + 1e-9) {
      const r = curve.f(t, state.params, state.variant);
      const x = xOf(t);
      ctx.strokeStyle = "rgba(255,180,84,0.5)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      if (Number.isFinite(r)) {
        const y = yOf(r);
        ctx.fillStyle = "#ffb454";
        ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#0a0f16"; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  };

  // ---------- HUD ----------
  const updateHUD = () => {
    const curve = CURVES[state.curveId];
    const t = state.tCurrent;
    const r = curve.f(t, state.params, state.variant);
    $("hudTheta").textContent = fmtTheta(t, state.options.degrees);
    $("hudR").textContent = Number.isFinite(r) ? r.toFixed(3) : "—";
    if (Number.isFinite(r)) {
      const x = r * Math.cos(t), y = r * Math.sin(t);
      $("hudXY").textContent = x.toFixed(2) + ", " + y.toFixed(2);
    } else {
      $("hudXY").textContent = "—";
    }
    const period = curve.period(state.params);
    $("hudPeriod").textContent = period === Infinity ? "∞" : fmtTheta(period, state.options.degrees);
  };

  // ---------- Variant UI ----------
  const variantRow = $("variantRow");
  const variantOut = $("variantOut");
  document.querySelectorAll("#variant button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#variant button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.variant = btn.dataset.value;
      variantOut.textContent = state.variant;
      onParamsChanged();
    });
  });

  // ---------- θ range bindings ----------
  const bindRange = (rangeId, numId, outId, key, fmt) => {
    const range = $(rangeId), num = $(numId), out = outId ? $(outId) : null;
    const apply = (v, src) => {
      if (!Number.isFinite(v)) return;
      state[key] = v;
      if (src !== "range") range.value = String(v);
      if (src !== "num") num.value = String(v);
      if (out) out.textContent = fmt(v);
      onThetaChanged();
    };
    range.addEventListener("input", () => apply(parseFloat(range.value), "range"));
    num.addEventListener("input", () => apply(parseFloat(num.value), "num"));
    return { set: (v) => apply(v, null) };
  };

  const tMinCtrl = bindRange("tMinRange", "tMinNum", "tMinOut", "thetaMin", v => fmtTheta(v, state.options.degrees));
  const tMaxCtrl = bindRange("tMaxRange", "tMaxNum", "tMaxOut", "thetaMax", v => fmtTheta(v, state.options.degrees));

  const speedRange = $("speedRange"), speedNum = $("speedNum"), speedOut = $("speedOut");
  const applySpeed = (v, src) => {
    if (!Number.isFinite(v)) return;
    state.speed = clamp(v, 0.1, 6);
    if (src !== "range") speedRange.value = String(state.speed);
    if (src !== "num") speedNum.value = String(state.speed);
    speedOut.textContent = state.speed.toFixed(2) + " rad/s";
  };
  speedRange.addEventListener("input", () => applySpeed(parseFloat(speedRange.value), "range"));
  speedNum.addEventListener("input", () => applySpeed(parseFloat(speedNum.value), "num"));
  applySpeed(parseFloat(speedNum.value), null);

  // ---------- Curve switch ----------
  const onCurveChanged = () => {
    const curve = CURVES[state.curveId];
    variantRow.classList.toggle("hidden", !curve.hasVariant);
    if (!curve.hasVariant) state.variant = "cos";
    else {
      // default to cos
      state.variant = "cos";
      document.querySelectorAll("#variant button").forEach(b => {
        b.classList.toggle("active", b.dataset.value === state.variant);
      });
      variantOut.textContent = state.variant;
    }
    buildParamControls();
    const [tmin, tmax] = curve.thetaDefault();
    tMinCtrl.set(tmin);
    tMaxCtrl.set(tmax);
    state.tCurrent = tmin;
    updateAboutPanel();
    requestRender();
  };

  $("curve").addEventListener("change", e => {
    state.curveId = e.target.value;
    onCurveChanged();
  });

  // ---------- Display options ----------
  const bindCheckbox = (id, key, onChange) => {
    const el = $(id);
    el.checked = state.options[key];
    el.addEventListener("change", () => {
      state.options[key] = el.checked;
      if (onChange) onChange();
      requestRender();
    });
  };
  bindCheckbox("optDegrees", "degrees", () => {
    // re-render the θ-range labels
    $("tMinOut").textContent = fmtTheta(state.thetaMin, state.options.degrees);
    $("tMaxOut").textContent = fmtTheta(state.thetaMax, state.options.degrees);
  });
  bindCheckbox("optCartesian", "cartesian");
  bindCheckbox("optRadius", "radius");
  bindCheckbox("optArc", "arc");
  bindCheckbox("optDot", "dot");
  bindCheckbox("optAutofit", "autofit");
  bindCheckbox("optMarkers", "markers");
  bindCheckbox("optSidePlot", "sidePlot");

  // ---------- Mode buttons ----------
  $("playBtn").addEventListener("click", () => {
    if (state.tCurrent >= state.thetaMax - 1e-9) state.tCurrent = state.thetaMin;
    state.playing = true;
  });
  $("pauseBtn").addEventListener("click", () => { state.playing = false; });
  $("resetBtn").addEventListener("click", () => {
    state.tCurrent = state.thetaMin;
    state.playing = false;
    requestRender();
  });

  const stepCurve = (dir) => {
    state.playing = false;
    const curve = CURVES[state.curveId];
    const stepBase = curve.stepSize(state.params);
    const target = clamp(state.tCurrent + dir * stepBase, state.thetaMin, state.thetaMax);
    const kt = curve.keyThetas(state.params, state.variant, [state.thetaMin, state.thetaMax]);
    const all = [...kt.zeros, ...kt.maxes, ...kt.mins];
    const snapWindow = stepBase * 0.6;
    let bestSnap = null, bestDist = Infinity;
    for (const t of all) {
      if (dir > 0 && t <= state.tCurrent + 1e-6) continue;
      if (dir < 0 && t >= state.tCurrent - 1e-6) continue;
      const d = Math.abs(t - target);
      if (d < bestDist) { bestSnap = t; bestDist = d; }
    }
    const next = (bestSnap !== null && bestDist <= snapWindow) ? bestSnap : target;
    state.tCurrent = clamp(next, state.thetaMin, state.thetaMax);
    requestRender();
  };
  $("stepFwdBtn").addEventListener("click", () => stepCurve(+1));
  $("stepBackBtn").addEventListener("click", () => stepCurve(-1));

  // ---------- Challenge mode ----------
  const challengeBtn = $("challengeBtn");
  const challengeOverlay = $("challengeOverlay");
  challengeBtn.addEventListener("click", () => {
    state.challenge = !state.challenge;
    challengeBtn.classList.toggle("active", state.challenge);
    challengeOverlay.classList.toggle("hidden", !state.challenge);
    if (state.challenge) {
      state.playing = false;
      state.tCurrent = state.thetaMin;
    }
    requestRender();
  });
  $("revealBtn").addEventListener("click", () => {
    state.challenge = false;
    challengeBtn.classList.remove("active");
    challengeOverlay.classList.add("hidden");
    state.tCurrent = state.thetaMin;
    state.playing = true;
  });

  // ---------- Render orchestration ----------
  let pendingRender = false;
  const requestRender = () => {
    if (pendingRender) return;
    pendingRender = true;
    requestAnimationFrame(() => {
      pendingRender = false;
      doRender();
    });
  };

  const doRender = () => {
    const { rMax } = renderPolar();
    renderRTheta(rMax);
    updateHUD();
  };

  const onParamsChanged = () => requestRender();
  const onThetaChanged = () => {
    // clamp tCurrent into range if user shrunk it
    if (state.tCurrent < state.thetaMin) state.tCurrent = state.thetaMin;
    if (state.tCurrent > state.thetaMax) state.tCurrent = state.thetaMax;
    requestRender();
  };

  // ---------- Animation loop ----------
  let lastTs = null;
  const loop = (ts) => {
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (state.playing && !state.challenge) {
      state.tCurrent += state.speed * dt;
      if (state.tCurrent >= state.thetaMax) {
        state.tCurrent = state.thetaMin;
      }
      doRender();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // ---------- Init ----------
  window.addEventListener("resize", requestRender);
  onCurveChanged();   // builds params, renders About, kicks first render
})();
