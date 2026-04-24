# Simple Harmonic Motion Simulator

An interactive, single-page simulator for a spring-mass system — with optional viscous damping, gravity, environment presets, a second spring, and a sinusoidal driving force.

## Run it

Open `index.html` in any modern browser. No build step, no dependencies.

```
# or serve locally if you prefer
python3 -m http.server 8000
# then visit http://localhost:8000
```

Files: `index.html` (structure), `style.css` (theme), `sim.js` (physics + rendering).

## Physics

Integrates, via RK4 with adaptive substeps:

```
m·ẍ + c·ẋ + k_eff·x = F₀·cos(ω_d·t)
```

where `x` is displacement from equilibrium and `k_eff = k₁ + (k₂ if enabled)`. In vertical mode, gravity shifts the equilibrium by `Δ = m·g / k_eff`; the ODE is unchanged, so total mechanical energy `E = ½mv² + ½k_eff·x²` cleanly shows the damping loss.

## Features

- **Orientation toggle** — horizontal (spring from a left wall) or vertical (spring hanging from a ceiling). Gravity is auto-applied in vertical mode.
- **Optional second spring** — add one on the right wall (horizontal) or floor (vertical). Both springs have independently editable stiffness `k` and natural length `L`.
- **Environment presets** — Vacuum / Air / Water / Oil / Honey / Custom, which set the viscous damping coefficient `c`.
- **Manual number entry** alongside every slider (typed values can exceed slider bounds).
- **Driving force** — sinusoidal, with amplitude and angular frequency.
- **Damping diagnostics** — live readouts for damping ratio ζ = c/(2√(mk)), damped frequency ω_d = ω₀√(1−ζ²), and a regime badge (undamped / underdamped / critical / overdamped).

## Views

- **System** — live spring-mass animation with equilibrium marker, velocity arrow, and gravity arrow (in vertical mode).
- **Time series** — x(t) and ẋ(t)/3 on a scrolling plot with a dashed ±x₀·e^(−ζω₀t) envelope for undriven underdamped cases.
- **Phase space** — (x, ẋ) trajectory with fading trail.
- **Energy vs time** — ½mv² + ½k_eff·x², flat when undamped, decaying under damping.
- **Amplitude vs driving frequency** — A(ω) = F₀/√((k−mω²)² + (cω)²), with markers at ω₀ and the current driver frequency; the resonance peak sharpens as c decreases.

## Readouts

Time, position, velocity, total energy, `k_eff`, natural `ω₀`, period `T`, damping ratio `ζ`, damped `ω_d`, regime, and (in vertical mode) gravity stretch `Δ`.

## Things to try

- **Clean exam period** — type `m = 1`, `k₁ = 39.478` (≈ 4π²). The period readout should be exactly 1.00 s.
- **Vertical gravity stretch** — switch to vertical with default values. The spring visibly stretches by `Δ = mg/k₁ ≈ 0.98 m` and the Δ readout shows it.
- **Resonance** — enable driver at low `F₀`, sweep `ω_d` across `ω₀`. Drop `c` and watch the resonance peak sharpen.
- **Damping regimes** — with m = 1, k = 10, critical damping is at c = 2√(mk) ≈ 6.32. Sweep c through 3 → 6.32 → 10 to see the regime badge flip.
- **Opposing springs** — enable spring 2 with equal k. Period drops by factor √2 (k_eff doubles).
- **Environments** — switch to Water / Oil / Honey to see the phase-space spiral collapse faster.
