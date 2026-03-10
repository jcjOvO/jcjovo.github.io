const STORE_KEY = "pomodoro-pulse-v1";

const state = {
  mode: "focus",
  durations: {
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
  },
  remaining: 25 * 60,
  total: 25 * 60,
  running: false,
  timerId: null,
  tasks: [],
  stats: {
    date: new Date().toISOString().slice(0, 10),
    completed: 0,
    focusMinutes: 0,
  },
};

const modeEls = Array.from(document.querySelectorAll(".mode"));
const dialEl = document.getElementById("dial");
const timeLabel = document.getElementById("timeLabel");
const startPauseBtn = document.getElementById("startPause");
const resetBtn = document.getElementById("reset");
const skipBtn = document.getElementById("skip");
const focusInput = document.getElementById("focusInput");
const shortBreakInput = document.getElementById("shortBreakInput");
const longBreakInput = document.getElementById("longBreakInput");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const doneCount = document.getElementById("doneCount");
const focusMinutes = document.getElementById("focusMinutes");

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify({
    durations: state.durations,
    tasks: state.tasks,
    stats: state.stats,
  }));
}

function load() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.durations) {
      state.durations = { ...state.durations, ...parsed.durations };
    }
    if (Array.isArray(parsed.tasks)) {
      state.tasks = parsed.tasks;
    }
    if (parsed.stats) {
      state.stats = parsed.stats;
    }
  } catch {
    localStorage.removeItem(STORE_KEY);
  }

  const today = new Date().toISOString().slice(0, 10);
  if (state.stats.date !== today) {
    state.stats = { date: today, completed: 0, focusMinutes: 0 };
  }
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function renderDial() {
  const progress = (state.total - state.remaining) / state.total;
  const deg = Math.min(360, Math.max(0, progress * 360));
  dialEl.style.background = `conic-gradient(var(--accent) ${deg}deg, var(--ring) 0deg)`;
  timeLabel.textContent = formatTime(state.remaining);
}

function renderModes() {
  modeEls.forEach((el) => {
    el.classList.toggle("active", el.dataset.mode === state.mode);
  });
}

function renderInputs() {
  focusInput.value = state.durations.focus;
  shortBreakInput.value = state.durations.shortBreak;
  longBreakInput.value = state.durations.longBreak;
}

function renderTasks() {
  taskList.innerHTML = "";
  state.tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = task.done ? "done" : "";

    const text = document.createElement("span");
    text.textContent = task.text;

    const buttons = document.createElement("div");
    buttons.className = "task-buttons";

    const doneBtn = document.createElement("button");
    doneBtn.className = "ok";
    doneBtn.type = "button";
    doneBtn.textContent = task.done ? "Undo" : "Done";
    doneBtn.addEventListener("click", () => {
      task.done = !task.done;
      save();
      renderTasks();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "del";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      save();
      renderTasks();
    });

    buttons.append(doneBtn, delBtn);
    li.append(text, buttons);
    taskList.append(li);
  });
}

function renderStats() {
  doneCount.textContent = state.stats.completed;
  focusMinutes.textContent = state.stats.focusMinutes;
}

function selectMode(mode) {
  state.mode = mode;
  state.total = state.durations[mode] * 60;
  state.remaining = state.total;
  stopTimer();
  render();
}

function tick() {
  if (!state.running) return;
  state.remaining -= 1;
  if (state.remaining <= 0) {
    state.remaining = 0;
    finishCycle();
    return;
  }
  renderDial();
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  startPauseBtn.textContent = "Pause";
  state.timerId = setInterval(tick, 1000);
}

function stopTimer() {
  state.running = false;
  startPauseBtn.textContent = "Start";
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function finishCycle() {
  stopTimer();
  const isFocus = state.mode === "focus";

  if (isFocus) {
    state.stats.completed += 1;
    state.stats.focusMinutes += state.durations.focus;
    notify("Focus complete", "Time for a short break.");
    // Every 4 focus rounds, switch to a long break.
    const nextMode = state.stats.completed % 4 === 0 ? "longBreak" : "shortBreak";
    selectMode(nextMode);
  } else {
    notify("Break complete", "Back to focus mode.");
    selectMode("focus");
  }

  save();
  renderStats();
}

function applyDurationInput(mode, value) {
  const num = Number(value);
  if (!Number.isInteger(num)) return;

  const limits = {
    focus: [1, 90],
    shortBreak: [1, 30],
    longBreak: [1, 60],
  };

  const [min, max] = limits[mode];
  const safe = Math.max(min, Math.min(max, num));
  state.durations[mode] = safe;

  if (mode === state.mode) {
    state.total = safe * 60;
    state.remaining = state.total;
    stopTimer();
  }

  save();
  render();
}

function bindEvents() {
  modeEls.forEach((btn) => {
    btn.addEventListener("click", () => selectMode(btn.dataset.mode));
  });

  startPauseBtn.addEventListener("click", () => {
    if (state.running) {
      stopTimer();
    } else {
      startTimer();
    }
  });

  resetBtn.addEventListener("click", () => {
    state.remaining = state.total;
    stopTimer();
    render();
  });

  skipBtn.addEventListener("click", finishCycle);

  focusInput.addEventListener("change", (e) => applyDurationInput("focus", e.target.value));
  shortBreakInput.addEventListener("change", (e) => applyDurationInput("shortBreak", e.target.value));
  longBreakInput.addEventListener("change", (e) => applyDurationInput("longBreak", e.target.value));

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;

    state.tasks.unshift({
      id: crypto.randomUUID(),
      text,
      done: false,
    });

    taskInput.value = "";
    save();
    renderTasks();
  });
}

function render() {
  renderModes();
  renderDial();
  renderInputs();
  renderTasks();
  renderStats();
}

async function init() {
  load();
  bindEvents();
  state.total = state.durations[state.mode] * 60;
  state.remaining = state.total;
  render();

  if ("Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // Ignore permission errors in unsupported contexts.
    }
  }
}

init();
