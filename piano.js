/* Sheet Music → Piano Hands
 * Vanilla JS, no dependencies. Reads a picture of sheet music with a vision
 * model, then visualizes hand/finger placement on a keyboard, bar by bar.
 */

"use strict";

const $ = (id) => document.getElementById(id);

/* ───────────────────────── Music helpers ───────────────────────── */

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// "C4", "F#3", "Bb5" → MIDI number (C4 = 60). Returns null if unparseable.
function pitchToMidi(pitch) {
  if (typeof pitch !== "string") return null;
  const m = pitch.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) return null;
  let semi = SEMITONE[m[1].toUpperCase()];
  if (m[2] === "#") semi += 1;
  else if (m[2] === "b") semi -= 1;
  return (parseInt(m[3], 10) + 1) * 12 + semi;
}
const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const isBlackMidi = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

/* ───────────────────────── App state ───────────────────────── */

const state = {
  score: null,        // normalized score object
  keys: [],           // computed keyboard key rects
  minMidi: 48,
  maxMidi: 84,
  bar: 0,
  beat: 0,
  beatsPerBar: 4,
  playing: false,
  muted: false,
  bpm: 96,
  stepMode: "beat",   // "beat" | "bar"
  lastTick: 0,
};

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playMidi(midi, durSec) {
  if (state.muted) return;
  const ctx = ensureAudio();
  if (!ctx || midi == null) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = midiToFreq(midi);
  const d = Math.min(Math.max(durSec || 0.4, 0.15), 2.0);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + d);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + d + 0.05);
}

/* ───────────────────────── Score normalization ───────────────────────── */

// Coerce arbitrary parsed JSON into a safe, predictable shape.
function normalizeScore(raw) {
  const score = {
    title: typeof raw.title === "string" ? raw.title : "Untitled",
    timeSignature: typeof raw.timeSignature === "string" ? raw.timeSignature : "4/4",
    tempoBpm: Number.isFinite(raw.tempoBpm) ? raw.tempoBpm : 96,
    bars: [],
  };
  const bars = Array.isArray(raw.bars) ? raw.bars : [];
  score.bars = bars.map((bar, i) => {
    const parts = Array.isArray(bar.parts) ? bar.parts : [];
    return {
      index: Number.isFinite(bar.index) ? bar.index : i,
      parts: parts.map((p) => ({
        hand: p.hand === "left" ? "left" : "right",
        notes: (Array.isArray(p.notes) ? p.notes : [])
          .map((n) => ({
            pitch: String(n.pitch || ""),
            midi: pitchToMidi(n.pitch),
            finger: Number.isFinite(n.finger) ? n.finger : null,
            startBeat: Number.isFinite(n.startBeat) ? n.startBeat : 0,
            durationBeats: Number.isFinite(n.durationBeats) ? n.durationBeats : 1,
          }))
          .filter((n) => n.midi != null),
      })),
    };
  });
  return score;
}

function loadScore(raw) {
  const score = normalizeScore(raw);
  if (!score.bars.length) {
    setStatus("Couldn't find any bars in that data.", "err");
    return;
  }
  state.score = score;
  state.bpm = score.tempoBpm;
  $("tempoRange").value = $("tempoNum").value = state.bpm;
  $("tempoOut").textContent = state.bpm;
  const ts = score.timeSignature.split("/");
  state.beatsPerBar = parseInt(ts[0], 10) || 4;
  state.bar = 0;
  state.beat = 0;

  // Keyboard range = span of the song, padded to whole octaves, min one octave.
  let lo = Infinity, hi = -Infinity;
  for (const bar of score.bars)
    for (const part of bar.parts)
      for (const n of part.notes) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
  if (!Number.isFinite(lo)) { lo = 48; hi = 84; }
  lo = Math.min(lo - 2, 60); hi = Math.max(hi + 2, 60);
  while (isBlackMidi(lo)) lo--;          // start on a white key
  while (isBlackMidi(hi)) hi++;          // end on a white key
  if (hi - lo < 24) hi = lo + 24;
  state.minMidi = lo;
  state.maxMidi = hi;

  $("songBadge").textContent = score.title;
  $("songBadge").classList.remove("hidden");
  $("playBtn").textContent = "▶ Play";
  state.playing = false;

  resizeCanvas();
  render();
  setStatus(`Loaded "${score.title}" — ${score.bars.length} bars.`, "ok");
}

/* ───────────────────────── Keyboard geometry & drawing ───────────────────────── */

const canvas = $("piano");
const ctx2d = canvas.getContext("2d");

function computeKeys() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const whites = [];
  for (let m = state.minMidi; m <= state.maxMidi; m++) if (!isBlackMidi(m)) whites.push(m);
  const ww = w / whites.length;
  const bw = ww * 0.62;
  const bh = h * 0.62;
  const keys = [];
  whites.forEach((m, i) => keys.push({ midi: m, black: false, x: i * ww, w: ww, h }));
  // Black keys sit just right of their lower white neighbour (midi-1).
  for (let m = state.minMidi; m <= state.maxMidi; m++) {
    if (!isBlackMidi(m)) continue;
    const wi = whites.indexOf(m - 1);
    if (wi < 0) continue;
    keys.push({ midi: m, black: true, x: (wi + 1) * ww - bw / 2, w: bw, h: bh });
  }
  state.keys = keys;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 260;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  computeKeys();
}

// Returns {right:{midi:{finger}}, left:{...}} active at the current beat.
function activeNotesForCurrentBeat() {
  const out = { right: new Map(), left: new Map() };
  const bar = state.score?.bars[state.bar];
  if (!bar) return out;
  const b = state.beat;
  for (const part of bar.parts) {
    for (const n of part.notes) {
      const start = Math.floor(n.startBeat);
      const end = n.startBeat + n.durationBeats;
      if (start === b || (n.startBeat <= b && b < end)) {
        out[part.hand].set(n.midi, n.finger);
      }
    }
  }
  return out;
}

function render() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx2d.clearRect(0, 0, w, h);
  if (!state.keys.length) computeKeys();

  const active = activeNotesForCurrentBeat();
  const colorFor = (midi) => {
    if (active.right.has(midi)) return { fill: "#4cc2ff", finger: active.right.get(midi) };
    if (active.left.has(midi)) return { fill: "#ffb454", finger: active.left.get(midi) };
    return null;
  };

  // White keys first, then black on top.
  for (const k of state.keys.filter((k) => !k.black)) {
    const hit = colorFor(k.midi);
    ctx2d.fillStyle = hit ? hit.fill : "#f3f6fb";
    ctx2d.fillRect(k.x + 0.5, 0, k.w - 1, k.h);
    ctx2d.strokeStyle = "#0a0f16";
    ctx2d.strokeRect(k.x + 0.5, 0, k.w - 1, k.h);
    if (hit) drawFinger(k, hit.finger, "#0a0f16");
    // octave label on each C
    if (k.midi % 12 === 0) {
      ctx2d.fillStyle = "#9aa6b6";
      ctx2d.font = "10px ui-monospace, monospace";
      ctx2d.textAlign = "center";
      ctx2d.fillText("C" + (k.midi / 12 - 1), k.x + k.w / 2, k.h - 6);
    }
  }
  for (const k of state.keys.filter((k) => k.black)) {
    const hit = colorFor(k.midi);
    ctx2d.fillStyle = hit ? hit.fill : "#161d28";
    ctx2d.fillRect(k.x, 0, k.w, k.h);
    ctx2d.strokeStyle = "#0a0f16";
    ctx2d.strokeRect(k.x, 0, k.w, k.h);
    if (hit) drawFinger(k, hit.finger, "#0a0f16");
  }
}

function drawFinger(key, finger, color) {
  if (!finger) return;
  const cx = key.x + key.w / 2;
  const cy = key.black ? key.h - 14 : key.h - 26;
  ctx2d.beginPath();
  ctx2d.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx2d.fillStyle = "rgba(255,255,255,0.92)";
  ctx2d.fill();
  ctx2d.fillStyle = color;
  ctx2d.font = "bold 11px -apple-system, sans-serif";
  ctx2d.textAlign = "center";
  ctx2d.textBaseline = "middle";
  ctx2d.fillText(String(finger), cx, cy + 0.5);
  ctx2d.textBaseline = "alphabetic";
}

/* ───────────────────────── Parts panel & readout ───────────────────────── */

function renderParts() {
  const el = $("parts");
  const bar = state.score?.bars[state.bar];
  if (!bar) { el.innerHTML = '<p class="note">Load a song to see each hand\'s notes for the current bar.</p>'; return; }

  const handCard = (handName) => {
    const part = bar.parts.find((p) => p.hand === handName);
    const notes = part ? [...part.notes].sort((a, b) => a.startBeat - b.startBeat) : [];
    const chips = notes.length
      ? notes.map((n) => {
          const act = Math.floor(n.startBeat) === state.beat ||
            (n.startBeat <= state.beat && state.beat < n.startBeat + n.durationBeats);
          return `<span class="chip ${act ? "active" : ""}">
            <span>${n.pitch}</span>
            ${n.finger ? `<span class="fin">${n.finger}</span>` : ""}
            <span class="beat">b${(n.startBeat + 1).toFixed(2).replace(/\.00$/, "")}</span>
          </span>`;
        }).join("")
      : '<span class="note">rest</span>';
    return `<div class="part ${handName}">
      <div class="hand-title">${handName === "right" ? "Right hand" : "Left hand"}</div>
      <div class="chips">${chips}</div>
    </div>`;
  };

  el.innerHTML = handCard("right") + handCard("left");
}

function renderReadout() {
  const s = state.score;
  $("rTitle").textContent = s ? s.title : "—";
  $("rTime").textContent = s ? s.timeSignature : "—";
  $("rBar").textContent = s ? `${state.bar + 1} / ${s.bars.length}` : "—";
  $("rBeat").textContent = s ? `${state.beat + 1} / ${state.beatsPerBar}` : "—";
}

function refresh() { render(); renderParts(); renderReadout(); }

// Play whatever notes *start* on the current beat.
function soundCurrentBeat() {
  const bar = state.score?.bars[state.bar];
  if (!bar) return;
  const secPerBeat = 60 / state.bpm;
  for (const part of bar.parts)
    for (const n of part.notes)
      if (Math.floor(n.startBeat) === state.beat)
        playMidi(n.midi, n.durationBeats * secPerBeat);
}

/* ───────────────────────── Transport ───────────────────────── */

function advance(dir) {
  if (!state.score) return;
  const bars = state.score.bars.length;
  if (state.stepMode === "bar") {
    state.bar = Math.min(bars - 1, Math.max(0, state.bar + dir));
    state.beat = 0;
  } else {
    state.beat += dir;
    if (state.beat >= state.beatsPerBar) {
      if (state.bar < bars - 1) { state.bar++; state.beat = 0; }
      else { state.beat = state.beatsPerBar - 1; return false; } // end reached
    } else if (state.beat < 0) {
      if (state.bar > 0) { state.bar--; state.beat = state.beatsPerBar - 1; }
      else { state.beat = 0; }
    }
  }
  return true;
}

function step(dir) {
  ensureAudio();
  const moved = advance(dir);
  if (dir > 0 && moved !== false) soundCurrentBeat();
  if (dir > 0 && moved === false) soundCurrentBeat();
  refresh();
}

function setPlaying(on) {
  state.playing = on;
  $("playBtn").textContent = on ? "⏸ Pause" : "▶ Play";
  if (on) {
    ensureAudio();
    state.lastTick = performance.now();
    soundCurrentBeat();
    requestAnimationFrame(tick);
  }
}

function tick(now) {
  if (!state.playing) return;
  const secPerBeat = 60 / state.bpm;
  if (now - state.lastTick >= secPerBeat * 1000) {
    state.lastTick = now;
    const moved = advance(1);
    if (moved === false) { setPlaying(false); refresh(); return; }
    soundCurrentBeat();
    refresh();
  }
  requestAnimationFrame(tick);
}

/* ───────────────────────── Status helper ───────────────────────── */

function setStatus(msg, kind) {
  const el = $("status");
  el.className = "note" + (kind ? " " + kind : "");
  el.innerHTML = msg;
}

/* ───────────────────────── Vision OMR call ───────────────────────── */

const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    timeSignature: { type: "string" },
    tempoBpm: { type: "number" },
    bars: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          parts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                hand: { type: "string", enum: ["left", "right"] },
                notes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      pitch: { type: "string" },
                      finger: { type: ["integer", "null"] },
                      startBeat: { type: "number" },
                      durationBeats: { type: "number" },
                    },
                    required: ["pitch", "finger", "startBeat", "durationBeats"],
                  },
                },
              },
              required: ["hand", "notes"],
            },
          },
        },
        required: ["index", "parts"],
      },
    },
  },
  required: ["title", "timeSignature", "tempoBpm", "bars"],
};

const OMR_PROMPT = `You are an optical music recognition engine. Read the attached sheet-music image and transcribe it into structured JSON.

Rules:
- Split the music by staff into hands: the treble/upper staff is the "right" hand, the bass/lower staff is the "left" hand. If there is only one staff, use your best judgment per note.
- Use scientific pitch notation for every note: letter + optional # or b + octave, where middle C = "C4" (e.g. "C4", "F#3", "Bb5").
- Group notes that sound at the same time (chords) as separate note entries that share the same startBeat.
- "startBeat" is the beat offset within the bar, 0-based (first beat = 0). "durationBeats" is the note length in beats (quarter = 1, half = 2, whole = 4, eighth = 0.5).
- "finger" is a suggested fingering, 1=thumb to 5=pinky, or null if unsure. Suggest sensible, playable fingerings.
- One object per bar (measure), in order, starting at index 0.
- Estimate a reasonable tempoBpm if none is marked.
- Transcribe only what you can actually read. Do not invent bars or notes. It is fine to return fewer bars if the rest is illegible.

Return ONLY the JSON object.`;

async function analyzeImage(base64, mediaType) {
  const key = $("apiKey").value.trim();
  if (!key) { setStatus("Enter your Anthropic API key first.", "err"); return; }

  setStatus('<span class="spinner"></span>Reading the music…');
  $("analyzeBtn").disabled = true;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        output_config: { format: { type: "json_schema", schema: SCORE_SCHEMA } },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: OMR_PROMPT },
          ],
        }],
      }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try { const e = await res.json(); detail = e?.error?.message || detail; } catch (_) {}
      setStatus("API error: " + detail, "err");
      return;
    }

    const data = await res.json();
    if (data.stop_reason === "refusal") {
      setStatus("The model declined to process this image.", "err");
      return;
    }
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) { setStatus("No readable result came back.", "err"); return; }

    let parsed;
    try { parsed = JSON.parse(textBlock.text); }
    catch (_) { setStatus("Couldn't parse the result as JSON.", "err"); return; }

    $("jsonInput").value = JSON.stringify(parsed, null, 2);
    loadScore(parsed);
  } catch (err) {
    setStatus("Request failed: " + err.message + " (network/CORS?)", "err");
  } finally {
    $("analyzeBtn").disabled = false;
  }
}

/* ───────────────────────── Image input ───────────────────────── */

let pendingImage = null; // { base64, mediaType }

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("Please choose an image file.", "err");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const base64 = dataUrl.split(",")[1];
    pendingImage = { base64, mediaType: file.type };
    const prev = $("preview");
    prev.src = dataUrl;
    prev.classList.remove("hidden");
    $("analyzeBtn").disabled = false;
    setStatus('Image ready — click "Read the music".');
  };
  reader.readAsDataURL(file);
}

/* ───────────────────────── Sample song ───────────────────────── */

function sampleScore() {
  const q = (pitch, finger, startBeat, dur = 1) => ({ pitch, finger, startBeat, durationBeats: dur });
  const bar = (index, right, left) => ({ index, parts: [{ hand: "right", notes: right }, { hand: "left", notes: left }] });
  // "Twinkle, Twinkle" — melody in the right hand, simple bass in the left.
  return {
    title: "Twinkle, Twinkle (sample)",
    timeSignature: "4/4",
    tempoBpm: 96,
    bars: [
      bar(0, [q("C4", 1, 0), q("C4", 1, 1), q("G4", 5, 2), q("G4", 5, 3)],
             [q("C3", 5, 0, 4), q("E3", 3, 0, 4), q("G3", 1, 0, 4)]),
      bar(1, [q("A4", 4, 0), q("A4", 4, 1), q("G4", 5, 2, 2)],
             [q("F2", 5, 0, 4), q("F3", 1, 0, 4), q("A3", 2, 0, 4)]),
      bar(2, [q("F4", 4, 0), q("F4", 4, 1), q("E4", 3, 2), q("E4", 3, 3)],
             [q("C3", 5, 0, 4), q("G3", 1, 0, 4)]),
      bar(3, [q("D4", 2, 0), q("D4", 2, 1), q("C4", 1, 2, 2)],
             [q("G2", 5, 0, 4), q("G3", 1, 0, 4), q("B3", 2, 0, 4)]),
    ],
  };
}

/* ───────────────────────── Wire up UI ───────────────────────── */

function bindTempo() {
  const sync = (v) => {
    v = Math.min(220, Math.max(30, Math.round(v) || 96));
    state.bpm = v;
    $("tempoRange").value = v;
    $("tempoNum").value = v;
    $("tempoOut").textContent = v;
  };
  $("tempoRange").addEventListener("input", (e) => sync(+e.target.value));
  $("tempoNum").addEventListener("input", (e) => sync(+e.target.value));
}

function init() {
  // API key persistence
  const savedKey = localStorage.getItem("anthropicKey");
  if (savedKey) $("apiKey").value = savedKey;
  $("apiKey").addEventListener("change", (e) => localStorage.setItem("anthropicKey", e.target.value.trim()));

  // Dropzone
  const dz = $("dropzone"), fi = $("fileInput");
  dz.addEventListener("click", () => fi.click());
  fi.addEventListener("change", (e) => handleFile(e.target.files[0]));
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault(); dz.classList.remove("dragover");
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  $("analyzeBtn").addEventListener("click", () => {
    if (pendingImage) analyzeImage(pendingImage.base64, pendingImage.mediaType);
  });
  $("sampleBtn").addEventListener("click", () => loadScore(sampleScore()));

  // Paste JSON
  $("pasteToggle").addEventListener("click", () => {
    $("pasteWrap").classList.toggle("hidden");
  });
  $("loadJsonBtn").addEventListener("click", () => {
    try { loadScore(JSON.parse($("jsonInput").value)); }
    catch (_) { setStatus("That isn't valid JSON.", "err"); }
  });

  // Transport
  $("prevBtn").addEventListener("click", () => step(-1));
  $("nextBtn").addEventListener("click", () => step(1));
  $("playBtn").addEventListener("click", () => setPlaying(!state.playing));
  $("muteBtn").addEventListener("click", () => {
    state.muted = !state.muted;
    $("muteBtn").textContent = state.muted ? "🔇 Sound off" : "🔊 Sound on";
  });

  // Step mode segmented buttons
  $("stepMode").querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      $("stepMode").querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.stepMode = b.dataset.mode;
    });
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === " ") { e.preventDefault(); setPlaying(!state.playing); }
  });

  bindTempo();
  window.addEventListener("resize", () => { resizeCanvas(); render(); });

  resizeCanvas();
  refresh();
  setStatus('Drop in a sheet-music image and add your API key, or click "Load sample song" to try it now.');
}

document.addEventListener("DOMContentLoaded", init);
