const app = document.getElementById("app");
const promptText = document.getElementById("promptText");
const stepNumber = document.getElementById("stepNumber");
const controlArea = document.getElementById("controlArea");
const traceList = document.getElementById("traceList");

const calendarGrid = document.getElementById("calendarGrid");
const calendarState = document.getElementById("calendarState");
const calendarMonth = document.getElementById("calendarMonth");
const dateSlotValue = document.getElementById("dateSlotValue");
const restartButton = document.getElementById("restartButton");

const state = {
  step: "experience",
  stepCount: 1,
  experience: "",
  selectedDate: null,
  outputType: null,
  progress: 0,
  calendarMode: "neutral",
  viewYear: 2026,
  viewMonth: 8
};

const flow = {
  experience: {
    prompt: "Describe one personal experience.",
    type: "text",
    next: "specificDate",
    state: "UNRESOLVED",
    progress: 0
  },

  specificDate: {
    prompt: "Does this experience have a specific date?",
    type: "binary",
    yes: "dateRepresents",
    no: "momentOrPeriod",
    state: "SEARCHING FOR A DAY",
    progress: 1
  },

  dateRepresents: {
    prompt: "Can that date represent the whole experience?",
    type: "binary",
    yes: "pickExact",
    no: "periodRepresentMoment",
    state: "TESTING ONE DAY",
    progress: 2
  },

  momentOrPeriod: {
    prompt: "Is it closer to a single moment or a period of time?",
    type: "choice",
    options: [
      { label: "A SINGLE MOMENT", next: "approximateMoment" },
      { label: "A PERIOD OF TIME", next: "periodRepresentMoment" }
    ],
    state: "CLASSIFYING TIME",
    progress: 2
  },

  approximateMoment: {
    prompt: "Can you approximately remember when it happened?",
    type: "binary",
    yes: "identifyDay",
    no: "outputCannot",
    state: "NARROWING THE FIELD",
    progress: 3
  },

  identifyDay: {
    prompt: "Can you identify one specific day?",
    type: "binary",
    yes: "pickExact",
    no: "pickRepresentative",
    state: "ONE DAY REQUIRED",
    progress: 4
  },

  periodRepresentMoment: {
    prompt: "Can one moment stand in for this whole period?",
    type: "binary",
    yes: "pickRepresentative",
    no: "outputCannot",
    state: "PERIOD → ONE DAY?",
    progress: 3,
    mode: "period"
  },

  pickExact: {
    prompt: "Choose the exact date.",
    type: "date",
    selectMode: "exact",
    next: "outputExact",
    state: "SELECT ONE EXACT DAY",
    progress: 5
  },

  pickRepresentative: {
    prompt: "Choose one date to represent it.",
    type: "date",
    selectMode: "selected",
    next: "outputSelected",
    state: "REDUCE TO ONE DAY",
    progress: 5,
    mode: "period"
  },

  outputExact: {
    prompt: "Exact Date",
    type: "output",
    outputType: "exact",
    outputLabel: "EXACT DATE",
    state: "PROCESSABLE",
    progress: 5
  },

  outputSelected: {
    prompt: "Selected Date",
    type: "output",
    outputType: "selected",
    outputLabel: "SELECTED DATE",
    state: "PROCESSABLE",
    progress: 5
  },

  outputCannot: {
    prompt: "Cannot Be Represented",
    type: "output",
    outputType: "cannot",
    outputLabel: "CANNOT BE REPRESENTED",
    state: "NO VALID DATE",
    progress: 5,
    mode: "crossed"
  }
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).toUpperCase();
}

function shortDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).toUpperCase();
}

function addTrace(question, answer) {
  const item = document.createElement("div");
  item.className = "trace-item";

  const q = document.createElement("div");
  q.className = "trace-question";
  q.textContent = question;

  const a = document.createElement("div");
  a.className = "trace-answer";
  a.textContent = answer;

  item.appendChild(q);
  item.appendChild(a);
  traceList.appendChild(item);
  traceList.scrollTop = traceList.scrollHeight;
}

function setStep(stepName) {
  state.step = stepName;
  state.stepCount += 1;
  render();
}

function render() {
  const step = flow[state.step];

  stepNumber.textContent = pad(state.stepCount);
  promptText.textContent = step.prompt;
  controlArea.innerHTML = "";

  state.progress = step.progress ?? state.progress;
  state.calendarMode = step.mode || "neutral";
  app.dataset.progress = String(state.progress);
  calendarState.textContent = step.state;

  if (step.type === "text") renderText(step);
  if (step.type === "binary") renderBinary(step);
  if (step.type === "choice") renderChoice(step);
  if (step.type === "date") renderDate(step);
  if (step.type === "output") renderOutput(step);

  renderCalendar();
}

function renderText(step) {
  const wrap = document.createElement("div");
  wrap.className = "experience-input";

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Example: I gradually started to feel that New York was becoming home.";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "submit";
  button.textContent = "ENTER";

  button.addEventListener("click", () => {
    const value = textarea.value.trim();
    if (!value) return;

    state.experience = value;
    addTrace(step.prompt, value);
    setStep(step.next);
  });

  wrap.appendChild(textarea);
  wrap.appendChild(button);
  controlArea.appendChild(wrap);
  textarea.focus();
}

function renderBinary(step) {
  const actions = document.createElement("div");
  actions.className = "actions";

  ["YES", "NO"].forEach(label => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = label;

    button.addEventListener("click", () => {
      addTrace(step.prompt, label);

      // brief visual transformation before moving on
      if (state.step === "specificDate" && label === "NO") {
        state.calendarMode = "period";
        renderCalendar();
      }

      setTimeout(() => {
        setStep(label === "YES" ? step.yes : step.no);
      }, 140);
    });

    actions.appendChild(button);
  });

  controlArea.appendChild(actions);
}

function renderChoice(step) {
  const actions = document.createElement("div");
  actions.className = "actions";

  step.options.forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = option.label;

    button.addEventListener("click", () => {
      addTrace(step.prompt, option.label);

      if (option.label.includes("PERIOD")) {
        state.calendarMode = "period";
        renderCalendar();
      }

      setTimeout(() => {
        setStep(option.next);
      }, 140);
    });

    actions.appendChild(button);
  });

  controlArea.appendChild(actions);
}

function renderDate(step) {
  const wrap = document.createElement("div");
  wrap.className = "date-selectors";

  const monthSelect = document.createElement("select");
  const daySelect = document.createElement("select");
  const yearSelect = document.createElement("select");

  const months = [
    "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
    "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"
  ];

  months.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = m;
    if (i === state.viewMonth) opt.selected = true;
    monthSelect.appendChild(opt);
  });

  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = String(d).padStart(2, "0");
    daySelect.appendChild(opt);
  }

  for (let y = 2020; y <= 2030; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === state.viewYear) opt.selected = true;
    yearSelect.appendChild(opt);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "confirm-date";
  button.textContent = "CONFIRM";

  function syncPreview() {
    const y = Number(yearSelect.value);
    const m = Number(monthSelect.value);
    const d = Number(daySelect.value);

    state.viewYear = y;
    state.viewMonth = m;
    state.selectedDate = new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()));
    renderCalendar();
  }

  monthSelect.addEventListener("change", syncPreview);
  daySelect.addEventListener("change", syncPreview);
  yearSelect.addEventListener("change", syncPreview);

  syncPreview();

  button.addEventListener("click", () => {
    const date = state.selectedDate;
    if (!date) return;

    dateSlotValue.textContent = shortDate(date);
    addTrace(step.prompt, formatDate(date));
    setStep(step.next);
  });

  wrap.appendChild(monthSelect);
  wrap.appendChild(daySelect);
  wrap.appendChild(yearSelect);
  wrap.appendChild(button);
  controlArea.appendChild(wrap);
}

function renderOutput(step) {
  state.outputType = step.outputType;

  const kicker = document.createElement("div");
  kicker.className = "output-kicker";
  kicker.textContent = "SYSTEM OUTPUT";

  const title = document.createElement("h2");
  title.className = `output-title ${step.outputType}`;
  title.textContent = step.outputLabel;

  controlArea.appendChild(kicker);
  controlArea.appendChild(title);

  if (state.selectedDate && step.outputType !== "cannot") {
    const date = document.createElement("div");
    date.className = "output-date";
    date.textContent = formatDate(state.selectedDate);
    controlArea.appendChild(date);
    dateSlotValue.textContent = shortDate(state.selectedDate);
  }

  if (step.outputType === "cannot") {
    dateSlotValue.textContent = "EMPTY";
  }

  restartButton.classList.remove("hidden");
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const year = state.viewYear;
  const month = state.viewMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  calendarMonth.textContent = new Date(year, month, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();

  for (let i = 0; i < 42; i++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";

    const day = i - firstDay + 1;

    if (i < firstDay || day > daysInMonth) {
      cell.classList.add("empty");
      calendarGrid.appendChild(cell);
      continue;
    }

    const number = document.createElement("div");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    if (state.calendarMode === "period") {
      cell.classList.add("period");
    }

    if (state.calendarMode === "crossed") {
      cell.classList.add("crossed");
    }

    const isSelected =
      state.selectedDate &&
      state.selectedDate.getFullYear() === year &&
      state.selectedDate.getMonth() === month &&
      state.selectedDate.getDate() === day;

    if (isSelected) {
      if (state.outputType === "exact" || state.step === "pickExact") {
        cell.classList.add("exact");
      } else {
        cell.classList.add("selected");
      }
    } else if (state.selectedDate && (state.step === "outputExact" || state.step === "outputSelected")) {
      cell.classList.add("dim");
    }

    calendarGrid.appendChild(cell);
  }
}

restartButton.addEventListener("click", () => location.reload());

render();
