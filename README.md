# Simple Harmonic Motion Simulator

An interactive, single-page simulator for a spring-mass system — with optional viscous damping and a sinusoidal driving force.

## Run it

Just open `index.html` in a browser. No build step, no dependencies.

```
# or serve locally if you prefer
python3 -m http.server 8000
# then visit http://localhost:8000
```

## What it does

Integrates the equation of motion

```
m·ẍ + c·ẋ + k·x = F₀·cos(ω_d·t)
```

using RK4 with adaptive substeps, and renders three live views:

- **Spring-mass animation** — the mass slides along a spring against a wall, with an equilibrium marker and a velocity arrow.
- **Time series** — position and velocity vs. time on a scrolling plot.
- **Phase space** — trajectory in (x, ẋ) with fading history, showing ellipses (undamped), inward spirals (damped), or limit cycles (driven).

## Controls

- **Mass** (m), **Spring constant** (k), **Damping** (c)
- **Initial displacement** (x₀) and **Initial velocity** (v₀)
- **Driving force**: enable/disable, amplitude F₀, angular frequency ω_d
- **Play / Pause**, **Reset**, **Clear graph**

## Readouts

Live values for time, position, velocity, total mechanical energy, the natural angular frequency ω₀ = √(k/m), and the period T = 2π/ω₀.

## Things to try

- Set damping to 0 and watch energy stay constant.
- Increase damping and see the phase-space spiral to the origin.
- Enable the driver with ω_d near ω₀ to see resonance grow the amplitude.
- Heavy damping + driver → the phase trajectory settles into a closed limit cycle.
