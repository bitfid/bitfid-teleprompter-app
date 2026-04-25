const sampleScript = `Good morning, and welcome to the Bitfid Teleprompter test.

This version runs locally from a small Python server.

The screen uses high contrast text and a quiet black and gray palette.

When Voice Follow is on, the app listens through your microphone.

As you read, it tries to match your spoken words to the closest script line.

You can still use manual scrolling whenever you want.`;

const state = {
  lines: [],
  activeLine: 0,
  scrolling: false,
  voiceFollow: false,
  recognition: null,
  scrollTimer: null,
};

const els = {
  scriptInput: document.querySelector("#scriptInput"),
  loadPrompt: document.querySelector("#loadPrompt"),
  resetPrompt: document.querySelector("#resetPrompt"),
  samplePrompt: document.querySelector("#samplePrompt"),
  fontSize: document.querySelector("#fontSize"),
  speed: document.querySelector("#speed"),
  lineGap: document.querySelector("#lineGap"),
  voiceFollow: document.querySelector("#voiceFollow"),
  mirrorMode: document.querySelector("#mirrorMode"),
  status: document.querySelector("#status"),
  playPause: document.querySelector("#playPause"),
  backLine: document.querySelector("#backLine"),
  nextLine: document.querySelector("#nextLine"),
  fullscreen: document.querySelector("#fullscreen"),
  viewport: document.querySelector("#promptViewport"),
  promptText: document.querySelector("#promptText"),
};

function splitLines(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function scoreLine(spoken, line) {
  const spokenWords = normalizeWords(spoken);
  const lineWords = new Set(normalizeWords(line));
  if (!spokenWords.length || !lineWords.size) return 0;
  const hits = spokenWords.filter((word) => lineWords.has(word)).length;
  return hits / Math.max(lineWords.size, spokenWords.length);
}

function bestLineForSpeech(spoken) {
  const start = Math.max(0, state.activeLine - 2);
  const end = Math.min(state.lines.length, state.activeLine + 5);
  let best = { index: state.activeLine, score: 0 };

  for (let index = start; index < end; index += 1) {
    const score = scoreLine(spoken, state.lines[index]);
    if (score > best.score) best = { index, score };
  }

  return best.score >= 0.18 ? best.index : state.activeLine;
}

function renderPrompt() {
  els.promptText.innerHTML = "";
  state.lines.forEach((line, index) => {
    const p = document.createElement("p");
    p.className = "prompt-line";
    p.dataset.index = String(index);
    p.textContent = line;
    els.promptText.appendChild(p);
  });
  setActiveLine(0, false);
}

function setActiveLine(index, shouldScroll = true) {
  state.activeLine = Math.max(0, Math.min(index, state.lines.length - 1));
  document.querySelectorAll(".prompt-line").forEach((line) => {
    const lineIndex = Number(line.dataset.index);
    line.classList.toggle("active", lineIndex === state.activeLine);
    line.classList.toggle("past", lineIndex < state.activeLine);
  });

  if (shouldScroll) {
    const active = document.querySelector(`.prompt-line[data-index="${state.activeLine}"]`);
    active?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function setStatus(message) {
  els.status.textContent = message;
}

function loadPrompt() {
  state.lines = splitLines(els.scriptInput.value);
  if (!state.lines.length) {
    setStatus("Add a script first.");
    return;
  }
  renderPrompt();
  setStatus(`${state.lines.length} lines loaded.`);
  els.viewport.focus();
}

function startScroll() {
  if (state.scrolling) return;
  state.scrolling = true;
  els.playPause.textContent = "Pause";
  els.playPause.setAttribute("aria-pressed", "true");
  const tick = () => {
    const pxPerTick = Number(els.speed.value) / 14;
    els.viewport.scrollBy({ top: pxPerTick, behavior: "auto" });
    state.scrollTimer = window.setTimeout(tick, 80);
  };
  tick();
}

function stopScroll() {
  state.scrolling = false;
  els.playPause.textContent = "Scroll";
  els.playPause.setAttribute("aria-pressed", "false");
  window.clearTimeout(state.scrollTimer);
}

function toggleScroll() {
  state.scrolling ? stopScroll() : startScroll();
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("Voice Follow is not supported in this browser. Try Safari or Chrome.");
    els.voiceFollow.checked = false;
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  recognition.onresult = (event) => {
    const latest = Array.from(event.results)
      .slice(-2)
      .map((result) => result[0]?.transcript || "")
      .join(" ");
    const matched = bestLineForSpeech(latest);
    if (matched !== state.activeLine) {
      const previousLine = state.activeLine;
      setActiveLine(matched);
      const distance = Math.abs(matched - previousLine);
      els.speed.value = String(Math.max(20, Math.min(120, Number(els.speed.value) + distance * 4)));
    }
    setStatus(`Listening: ${latest.trim() || "speak when ready"}`);
  };

  recognition.onerror = (event) => {
    setStatus(`Voice Follow stopped: ${event.error}`);
    els.voiceFollow.checked = false;
    state.voiceFollow = false;
  };

  recognition.onend = () => {
    if (state.voiceFollow) recognition.start();
  };

  return recognition;
}

function toggleVoiceFollow() {
  if (els.voiceFollow.checked) {
    if (!state.lines.length) loadPrompt();
    state.recognition = state.recognition || setupSpeechRecognition();
    if (!state.recognition) return;
    state.voiceFollow = true;
    state.recognition.start();
    stopScroll();
    setStatus("Voice Follow is listening.");
  } else {
    state.voiceFollow = false;
    state.recognition?.stop();
    setStatus("Voice Follow off.");
  }
}

function updateTypography() {
  els.promptText.style.fontSize = `${els.fontSize.value}px`;
  els.promptText.style.lineHeight = els.lineGap.value;
}

els.loadPrompt.addEventListener("click", loadPrompt);
els.resetPrompt.addEventListener("click", () => {
  stopScroll();
  setActiveLine(0);
  els.viewport.scrollTo({ top: 0, behavior: "smooth" });
  setStatus("Reset to start.");
});
els.samplePrompt.addEventListener("click", () => {
  els.scriptInput.value = sampleScript;
  loadPrompt();
});
els.playPause.addEventListener("click", toggleScroll);
els.backLine.addEventListener("click", () => setActiveLine(state.activeLine - 1));
els.nextLine.addEventListener("click", () => setActiveLine(state.activeLine + 1));
els.fullscreen.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    els.viewport.requestFullscreen();
  }
});
els.voiceFollow.addEventListener("change", toggleVoiceFollow);
els.mirrorMode.addEventListener("change", () => {
  els.promptText.classList.toggle("mirror", els.mirrorMode.checked);
});
els.fontSize.addEventListener("input", updateTypography);
els.lineGap.addEventListener("input", updateTypography);
els.viewport.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    toggleScroll();
  }
  if (event.key === "ArrowDown") setActiveLine(state.activeLine + 1);
  if (event.key === "ArrowUp") setActiveLine(state.activeLine - 1);
});

updateTypography();
loadPrompt();
