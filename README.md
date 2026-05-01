# Polar-Coordinates Sketcher

An interactive, single-page tool for building instinct around polar curves. The point isn't to draw pretty graphs — it's to train the workflow you'd actually use to sketch one of these curves by hand on an exam:

> **Plot r as a function of θ on a standard xy axis first.** Read off the zeros, maxes, mins. Then translate that into the polar plane petal-by-petal.

So the tool always shows you both views at once — the polar plot on top, the r-vs-θ side plot underneath, animating in lock-step — plus the logic and shortcuts for each curve family.

## Run it

Open `index.html` in any modern browser. No build step, no dependencies.

```
# or serve locally if you prefer
python3 -m http.server 8000
# then visit http://localhost:8000
```

Files: `index.html` (structure), `style.css` (theme), `polar.js` (curve catalog + rendering).

## Curve catalog

| Curve | Formula | Knobs |
|---|---|---|
| Circle (origin-centred) | r = a | a |
| Off-centre circle | r = 2a · cos θ (or sin) | a, variant |
| Rose | r = a · cos(kθ) (or sin) | a, k (integer), variant |
| Cardioid | r = a · (1 + cos θ) (or sin) | a, variant |
| Limaçon | r = a + b · cos θ (or sin) | a, b, variant |
| Archimedean spiral | r = a + b · θ | a, b |
| Lemniscate of Bernoulli | r² = a² · cos(2θ) (or sin) | a, variant |
| Logarithmic spiral | r = a · e^(b·θ) | a, b |

For each curve the **About** panel always shows: a one-paragraph description, fast-recognition **Shortcuts**, the **Symmetry** check (which of the three reflection tests pass), a step-by-step **Sketching recipe**, **Key features**, and **Exam tips**. The persistent **Sketching Toolkit** panel below it covers the general workflow regardless of which curve you have selected.

## Modes

- **Continuous** (default) — Play / Pause / Reset. The orange dot traces both plots in lock-step at the chosen sweep speed.
- **Step** — `◀ Step` / `Step ▶` advance θ by the curve's natural increment (e.g. quarter-petal for a rose, π/4 for a cardioid), snapping to nearby key-θ values when it can. Great for building each piece of the curve one quarter at a time.
- **Challenge** — hides the polar canvas, leaves the formula and r-vs-θ side plot visible. You sketch in your head; click **Reveal** to verify.

## Display toggles

Degrees vs radians, Cartesian-axes overlay, swept-radius line, angle arc near origin, moving dot, auto-fit scale, key-θ markers (zeros, maxes, mins), and the side plot itself.

## Things to try

- **Rose petal-count parity** — set rose, slide k from 1 to 10. Notice that odd k gives k petals (the curve closes by θ = π) and even k gives 2k petals (the negative-r half draws fresh petals between).
- **Limaçon transitions** — set limaçon, fix b = 2, slide a from 0 → 4. Watch the curve walk through inner-loop (a < b) → cardioid (a = b) → dimpled (b < a < 2b) → convex (a ≥ 2b). The shortcuts panel has the rule.
- **Lemniscate gaps** — set lemniscate. The side plot literally has *gaps* — those are the θ ranges where r² < 0, i.e. where the curve is undefined. The polar plot shows two lobes meeting at the origin.
- **Side-plot first** — turn on Challenge mode with rose, sin variant, k = 3. The side plot shows three positive bumps and three negative bumps over [0, 2π]. Predict the polar shape (six petals, oriented with one along +y), then click Reveal.
- **Step through a cardioid** — set cardioid, switch to Step mode, click `Step ▶` four times. Each click lands on a key-θ (max, zero, etc.); the curve builds in chunks rather than as one continuous sweep.
- **Spiral arm spacing** — set Archimedean, slide b. The radial gap between successive turns is exactly 2πb — measurable directly on the polar grid.

## Pedagogical core

The main thing this tool does that a generic grapher doesn't: it never lets you forget the **r-vs-θ first** workflow. The side plot animates in lock-step with the polar trace, the same θ-marker is shown on both, and key-θ values (zeros / maxes / mins) are dotted on both views with consistent colour conventions. The Symmetry line and Shortcuts on every curve teach the fast-recognition rules a student deploys in seconds on an exam.
