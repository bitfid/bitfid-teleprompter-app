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
  voiceFollowPaused: false,
  recognition: null,
  scrollFrame: null,
  lastScrollTime: 0,
  readLines: new Set(),
  spokenSegments: new Map(),
  lastMatchedLine: 0,
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
  pauseWatermark: document.querySelector("#pauseWatermark"),
  promptText: document.querySelector("#promptText"),
  clearReadNotes: document.querySelector("#clearReadNotes"),
  readAccuracy: document.querySelector("#readAccuracy"),
  readNotes: document.querySelector("#readNotes"),
  localSummary: document.querySelector("#localSummary"),
  app: document.querySelector(".app"),
};

function splitLines(text) {
  return text
    .replace(/\n{2,}/g, "\n")
    .split(/(?<=[.!?])\s+|\n+|;\s+/)
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
  const start = state.activeLine;
  const end = Math.min(state.lines.length, state.activeLine + 7);
  let best = { index: state.activeLine, score: 0 };

  for (let index = start; index < end; index += 1) {
    const score = scoreLine(spoken, state.lines[index]);
    if (score > best.score) best = { index, score };
  }

  return best.score >= 0.18 ? Math.max(best.index, state.activeLine) : state.activeLine;
}

function lineMatchForSpeech(spoken, index) {
  return scoreLine(spoken, state.lines[index] || "");
}

function renderPrompt() {
  els.promptText.innerHTML = "";
  state.readLines.clear();
  state.spokenSegments.clear();
  state.lastMatchedLine = 0;
  updateReadNotes();
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
    line.classList.toggle("read", state.readLines.has(lineIndex));
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
  state.lastScrollTime = performance.now();
  els.playPause.textContent = "Pause";
  els.playPause.setAttribute("aria-pressed", "true");
  els.viewport.classList.add("is-scrolling");
  state.scrollFrame = window.requestAnimationFrame(scrollStep);
}

function stopScroll() {
  state.scrolling = false;
  els.playPause.textContent = "Scroll";
  els.playPause.setAttribute("aria-pressed", "false");
  els.viewport.classList.remove("is-scrolling");
  window.cancelAnimationFrame(state.scrollFrame);
}

function scrollStep(timestamp) {
  if (!state.scrolling) return;
  const elapsed = Math.min(48, timestamp - state.lastScrollTime);
  state.lastScrollTime = timestamp;
  const pxPerSecond = Number(els.speed.value);
  els.viewport.scrollTop += (pxPerSecond * elapsed) / 1000;
  state.scrollFrame = window.requestAnimationFrame(scrollStep);
}

function toggleScroll() {
  if (state.voiceFollow) return;
  state.scrolling ? stopScroll() : startScroll();
}

function setVoiceFollowMode(isEnabled) {
  state.voiceFollow = isEnabled;
  state.voiceFollowPaused = false;
  els.app.classList.toggle("voice-following", isEnabled);
  els.playPause.hidden = isEnabled;
  els.backLine.hidden = isEnabled;
  els.nextLine.hidden = isEnabled;
  els.fullscreen.hidden = false;
  els.fullscreen.textContent = "Full";
  els.voiceFollow.checked = isEnabled;
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
    if (state.voiceFollowPaused) return;
    const latest = Array.from(event.results)
      .slice(-2)
      .map((result) => result[0]?.transcript || "")
      .join(" ");
    const matched = bestLineForSpeech(latest);
    const confidence = lineMatchForSpeech(latest, matched);
    if (matched !== state.activeLine) {
      const previousLine = state.activeLine;
      setActiveLine(matched);
      const distance = Math.abs(matched - previousLine);
      els.speed.value = String(Math.max(20, Math.min(120, Number(els.speed.value) + distance * 4)));
    }
    if (confidence >= 0.7) {
      markReadLine(matched, confidence);
    }
    rememberSpeech(event);
    setStatus(`Listening: ${latest.trim() || "speak when ready"}`);
  };

  recognition.onerror = (event) => {
    setStatus(`Voice Follow stopped: ${event.error}`);
    els.voiceFollow.checked = false;
    setVoiceFollowMode(false);
  };

  recognition.onend = () => {
    if (state.voiceFollow) recognition.start();
  };

  return recognition;
}

function markReadLine(index) {
  if (!state.lines[index] || index < state.lastMatchedLine) return;
  state.lastMatchedLine = Math.max(state.lastMatchedLine, index);
  if (state.readLines.has(index)) return;
  state.readLines.add(index);
  updateReadNotes();
  document
    .querySelector(`.prompt-line[data-index="${index}"]`)
    ?.classList.add("read");
}

function rememberSpeech(event) {
  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (!result.isFinal) continue;
    const transcript = result[0]?.transcript?.trim();
    if (transcript) state.spokenSegments.set(index, transcript);
  }
  updateReadNotes();
}

function transcriptText() {
  return [...state.spokenSegments.entries()]
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1])
    .join(" ")
    .trim();
}

function spokenSentences() {
  return splitLines(transcriptText());
}

function bestScriptScoreForSpokenSentence(sentence) {
  return state.lines.reduce(
    (best, line, index) => {
      const score = scoreLine(sentence, line);
      return score > best.score ? { index, score } : best;
    },
    { index: -1, score: 0 },
  );
}

function localReadAnalysis() {
  const readSentences = [...state.readLines]
    .sort((a, b) => a - b)
    .map((index) => state.lines[index]);
  const readCount = readSentences.length;
  const totalCount = state.lines.length;
  const coverage = totalCount ? Math.round((readCount / totalCount) * 100) : 0;
  const missed = state.lines.filter((_, index) => !state.readLines.has(index));
  const additions = spokenSentences()
    .map((sentence) => ({ sentence, match: bestScriptScoreForSpokenSentence(sentence) }))
    .filter((item) => item.match.score < 0.45)
    .map((item) => item.sentence);
  const matchedScores = [...state.readLines].map((index) => {
    const spoken = spokenSentences().find((sentence) => bestScriptScoreForSpokenSentence(sentence).index === index);
    return spoken ? bestScriptScoreForSpokenSentence(spoken).score : 0.7;
  });
  const accuracy = matchedScores.length
    ? Math.round((matchedScores.reduce((total, score) => total + score, 0) / matchedScores.length) * 100)
    : 0;

  return {
    readCount,
    totalCount,
    coverage,
    accuracy,
    missed,
    additions,
  };
}

function renderLocalSummary(analysis) {
  const missedText = analysis.missed.length
    ? analysis.missed.map((line) => `- ${line}`).join("\n")
    : "- None detected.";
  const addedText = analysis.additions.length
    ? analysis.additions.map((line) => `- ${line}`).join("\n")
    : "- None detected.";

  return [
    `Accuracy: ${analysis.accuracy}%`,
    `Coverage: ${analysis.readCount} of ${analysis.totalCount} script sentences (${analysis.coverage}%).`,
    "",
    "Missed from script:",
    missedText,
    "",
    "Added while speaking:",
    addedText,
  ].join("\n");
}

function updateReadNotes() {
  const transcript = transcriptText();
  const analysis = localReadAnalysis();
  els.readAccuracy.textContent = `${analysis.readCount} of ${analysis.totalCount} sentences matched at 70% confidence. Accuracy ${analysis.accuracy}%.`;
  els.readNotes.value = transcript;
  els.localSummary.value = renderLocalSummary(analysis);
}

function clearReadNotes() {
  state.readLines.clear();
  state.spokenSegments.clear();
  state.lastMatchedLine = state.activeLine;
  updateReadNotes();
  document.querySelectorAll(".prompt-line.read").forEach((line) => line.classList.remove("read"));
  setStatus("Read notes cleared.");
}

function toggleVoiceFollow() {
  if (els.voiceFollow.checked) {
    if (!state.lines.length) loadPrompt();
    state.recognition = state.recognition || setupSpeechRecognition();
    if (!state.recognition) return;
    stopScroll();
    setVoiceFollowMode(true);
    state.recognition.start();
    setStatus("Voice Follow is listening.");
  } else {
    setVoiceFollowMode(false);
    state.recognition?.stop();
    setStatus("Voice Follow off.");
  }
}

function toggleVoiceFollowPause() {
  if (!state.voiceFollow) return;
  state.voiceFollowPaused = !state.voiceFollowPaused;
  els.fullscreen.textContent = state.voiceFollowPaused ? "Full (Paused)" : "Full";
  setStatus(state.voiceFollowPaused ? "Voice Follow paused." : "Voice Follow resumed.");
}

function updateTypography() {
  els.promptText.style.fontSize = `${els.fontSize.value}px`;
  els.promptText.style.lineHeight = els.lineGap.value;
}

function isTypingTarget(target) {
  return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target?.tagName) || target?.isContentEditable;
}

function handlePromptKeys(event) {
  if (event.code === "Space" && !isTypingTarget(event.target)) {
    event.preventDefault();
    if (state.voiceFollow) {
      toggleVoiceFollowPause();
      return;
    }
    toggleScroll();
  }

  if (!state.voiceFollow && (document.fullscreenElement === els.viewport || document.activeElement === els.viewport)) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveLine(state.activeLine + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveLine(state.activeLine - 1);
    }
  }
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
els.clearReadNotes.addEventListener("click", clearReadNotes);
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
document.addEventListener("keydown", handlePromptKeys);

updateTypography();
loadPrompt();
