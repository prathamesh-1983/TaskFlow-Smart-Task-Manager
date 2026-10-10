const STORAGE_KEY = "taskflow.tasks.v1";
const today = localDateString(new Date());
const state = {
  tasks: loadTasks(),
  view: "today",
  query: "",
  sort: "date",
  compact: false,
  editingId: null,
  openMenuId: null,
};

const elements = {
  groups: document.querySelector("#task-groups"),
  empty: document.querySelector("#empty-state"),
  dialog: document.querySelector("#task-dialog"),
  form: document.querySelector("#task-form"),
  title: document.querySelector("#task-title"),
  notes: document.querySelector("#task-notes"),
  due: document.querySelector("#task-due"),
  priority: document.querySelector("#task-priority"),
  toast: document.querySelector("#toast"),
};

const viewConfig = {
  today: { label: "My day", heading: "Today's tasks", title: "My day", subtitle: "A little focus goes a long way." },
  upcoming: { label: "Upcoming", heading: "Coming up", title: "Look ahead", subtitle: "See what's on the horizon." },
  priority: { label: "Important", heading: "High priority", title: "The important things", subtitle: "Make space for what matters most." },
  completed: { label: "Completed", heading: "Done and dusted", title: "A good day's work", subtitle: "Look at everything you've moved forward." },
  all: { label: "All tasks", heading: "All tasks", title: "Your whole picture", subtitle: "Everything you need to keep moving." },
};

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(dateString, amount) {
  const [year, month, day] = dateString.split("-").map(Number);
  const shifted = new Date(year, month - 1, day + amount);
  return localDateString(shifted);
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return makeStarterTasks();
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter(isValidTask) : [];
  } catch {
    return [];
  }
}

function isValidTask(task) {
  return task && typeof task.id === "string" && typeof task.title === "string" &&
    typeof task.due === "string" && ["low", "medium", "high"].includes(task.priority) &&
    typeof task.completed === "boolean";
}

function makeStarterTasks() {
  const date = new Date();
  const todayDate = localDateString(date);
  return [
    { id: crypto.randomUUID(), title: "Map out the week ahead", notes: "Set aside a little time to get clear on the big picture.", due: todayDate, priority: "high", category: "Planning", completed: false, createdAt: Date.now() - 3000 },
    { id: crypto.randomUUID(), title: "Reply to the messages I've been sitting on", notes: "A quick inbox pass, then back to the good stuff.", due: todayDate, priority: "medium", category: "Personal", completed: false, createdAt: Date.now() - 2000 },
    { id: crypto.randomUUID(), title: "Take a proper lunch break", notes: "Step away from the screen for a bit.", due: todayDate, priority: "low", category: "Wellbeing", completed: false, createdAt: Date.now() - 1000 },
    { id: crypto.randomUUID(), title: "Sketch out tomorrow's first step", notes: "Leave a breadcrumb for a calmer morning.", due: shiftDate(todayDate, 1), priority: "low", category: "Planning", completed: false, createdAt: Date.now() },
  ];
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch {
    showToast("Couldn't save changes in this browser.");
  }
}

function priorityRank(priority) {
  return { high: 0, medium: 1, low: 2 }[priority] ?? 3;
}

function getViewTasks() {
  const query = state.query.trim().toLowerCase();
  const matching = state.tasks.filter((task) => {
    const textMatches = !query || `${task.title} ${task.notes || ""} ${task.category || ""}`.toLowerCase().includes(query);
    if (!textMatches) return false;
    if (state.view === "completed") return task.completed;
    if (task.completed) return state.view === "all";
    if (state.view === "today") return task.due <= today;
    if (state.view === "upcoming") return task.due > today;
    if (state.view === "priority") return task.priority === "high";
    return true;
  });

  return matching.sort((left, right) => {
    if (state.view === "completed") return (right.completedAt || 0) - (left.completedAt || 0);
    if (state.sort === "priority") return priorityRank(left.priority) - priorityRank(right.priority) || left.due.localeCompare(right.due);
    if (state.sort === "created") return right.createdAt - left.createdAt;
    return left.due.localeCompare(right.due) || priorityRank(left.priority) - priorityRank(right.priority);
  });
}

function groupTasks(tasks) {
  if (state.view === "today") {
    const overdue = tasks.filter((task) => task.due < today);
    const dueToday = tasks.filter((task) => task.due === today);
    return [
      ...(overdue.length ? [{ label: "Overdue", tasks: overdue }] : []),
      ...(dueToday.length ? [{ label: "Today", tasks: dueToday }] : []),
    ];
  }
  if (state.view === "upcoming") {
    const grouped = new Map();
    tasks.forEach((task) => {
      const label = task.due === shiftDate(today, 1) ? "Tomorrow" : formatDate(task.due, { weekday: "long", month: "short", day: "numeric" });
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(task);
    });
    return [...grouped].map(([label, items]) => ({ label, tasks: items }));
  }
  return tasks.length ? [{ label: state.view === "completed" ? "Recently finished" : "Your list", tasks }] : [];
}

function formatDate(dateString, options = { month: "short", day: "numeric" }) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
}

function makeTaskRow(task, index) {
  const row = document.createElement("article");
  row.className = `task-row${task.completed ? " is-complete" : ""}${state.compact ? " is-compact" : ""}`;
  row.style.animationDelay = `${Math.min(index, 7) * 35}ms`;
  row.dataset.taskId = task.id;

  const check = document.createElement("button");
  check.className = "task-check";
  check.type = "button";
  check.dataset.action = "toggle";
  check.setAttribute("aria-label", task.completed ? `Mark ${task.title} as incomplete` : `Complete ${task.title}`);
  check.setAttribute("aria-pressed", String(task.completed));
  check.textContent = "✓";
  row.append(check);

  const main = document.createElement("div");
  main.className = "task-main";
  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;
  main.append(title);
  if (task.notes && !task.completed) {
    const notes = document.createElement("span");
    notes.className = "task-notes";
    notes.textContent = task.notes;
    main.append(notes);
  }
  const meta = document.createElement("div");
  meta.className = "task-meta";
  const category = document.createElement("span");
  category.className = "task-tag";
  category.textContent = task.category || "General";
  meta.append(category);
  const priority = document.createElement("span");
  priority.className = `priority-tag priority-${task.priority}`;
  priority.textContent = `${task.priority[0].toUpperCase()}${task.priority.slice(1)}`;
  meta.append(priority);
  main.append(meta);
  row.append(main);

  const due = document.createElement("span");
  due.className = `due-tag${!task.completed && task.due < today ? " is-overdue" : ""}`;
  due.textContent = task.completed ? "Done" : task.due === today ? "Today" : formatDate(task.due);
  row.append(due);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const menuButton = document.createElement("button");
  menuButton.className = "task-menu-button";
  menuButton.type = "button";
  menuButton.dataset.action = "menu";
  menuButton.setAttribute("aria-label", `Actions for ${task.title}`);
  menuButton.setAttribute("aria-expanded", String(state.openMenuId === task.id));
  menuButton.textContent = "···";
  actions.append(menuButton);
  const menu = document.createElement("div");
  menu.className = "task-menu";
  menu.hidden = state.openMenuId !== task.id;
  menu.innerHTML = '<button type="button" data-action="edit">Edit task</button><button type="button" data-action="delete">Delete task</button>';
  actions.append(menu);
  row.append(actions);
  return row;
}

function render() {
  const config = viewConfig[state.view];
  document.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelector("#breadcrumb-current").textContent = config.label;
  document.querySelector("#page-title").innerHTML = `${config.title}<span class="heading-period">.</span>`;
  document.querySelector("#page-subtitle").textContent = config.subtitle;
  document.querySelector("#list-heading").textContent = config.heading;

  const activeTasks = state.tasks.filter((task) => !task.completed);
  const todayTasks = activeTasks.filter((task) => task.due <= today);
  const upcomingTasks = activeTasks.filter((task) => task.due > today);
  const completedTasks = state.tasks.filter((task) => task.completed);
  document.querySelector("#today-count").textContent = todayTasks.length;
  document.querySelector("#upcoming-count").textContent = upcomingTasks.length;
  document.querySelector("#completed-count").textContent = completedTasks.length;
  document.querySelector("#stat-open").textContent = todayTasks.length;
  document.querySelector("#stat-completed").textContent = completedTasks.length;
  document.querySelector("#stat-priority").textContent = todayTasks.filter((task) => task.priority === "high").length;

  const finishedToday = completedTasks.filter((task) => task.completedAt && localDateString(new Date(task.completedAt)) === today).length;
  const dailyTotal = todayTasks.length + finishedToday;
  const dailyPercent = dailyTotal ? Math.round((finishedToday / dailyTotal) * 100) : 0;
  document.querySelector("#daily-progress-label").textContent = `${dailyPercent}%`;
  document.querySelector("#daily-progress-bar").style.width = `${dailyPercent}%`;
  document.querySelector("#daily-progress-caption").textContent = dailyTotal === 0 ? "A fresh start. Pick one thing to begin." : dailyPercent === 100 ? "Everything you planned, done." : `${finishedToday} of ${dailyTotal} ${dailyTotal === 1 ? "task" : "tasks"} complete today`;

  const weekStart = shiftDate(today, -((new Date().getDay() + 6) % 7));
  const weekEnd = shiftDate(weekStart, 6);
  const weekTasks = state.tasks.filter((task) => task.due >= weekStart && task.due <= weekEnd);
  const weekCompleted = weekTasks.filter((task) => task.completed).length;
  const weekPercent = weekTasks.length ? Math.round((weekCompleted / weekTasks.length) * 100) : 0;
  document.querySelector("#week-progress-label").textContent = `${weekPercent}%`;
  document.querySelector("#week-progress-bar").style.width = `${weekPercent}%`;
  document.querySelector("#week-progress-note").textContent = weekTasks.length ? `${weekCompleted} of ${weekTasks.length} tasks moved forward` : "Every small step counts.";

  const tasks = getViewTasks();
  const groups = groupTasks(tasks);
  elements.groups.replaceChildren();
  let taskIndex = 0;
  for (const group of groups) {
    const section = document.createElement("section");
    section.className = "task-group";
    const heading = document.createElement("h3");
    heading.className = "group-heading";
    const label = document.createElement("span");
    label.textContent = group.label;
    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = String(group.tasks.length).padStart(2, "0");
    heading.append(label, count);
    const list = document.createElement("div");
    list.className = "task-list";
    for (const task of group.tasks) list.append(makeTaskRow(task, taskIndex++));
    section.append(heading, list);
    elements.groups.append(section);
  }
  document.querySelector("#task-total").textContent = tasks.length;
  elements.empty.hidden = tasks.length > 0;
  elements.groups.hidden = tasks.length === 0;
  document.querySelector("#list-footer").hidden = tasks.length === 0;

  const noMatches = Boolean(state.query.trim()) && tasks.length === 0;
  document.querySelector("#empty-title").textContent = noMatches ? "No matches this time." : state.view === "today" ? "A little breathing room." : "Nothing here just yet.";
  document.querySelector("#empty-copy").textContent = noMatches ? "Try another search, or clear it to see your tasks again." : state.view === "today" ? "Nothing on your plate for today. Add a task when you're ready." : "Add a task and it will find its place here.";
  document.querySelector("#empty-add-button").hidden = noMatches;
}

function openDialog(task = null) {
  state.editingId = task?.id || null;
  document.querySelector("#dialog-title").textContent = task ? "Edit task" : "New task";
  document.querySelector("#dialog-eyebrow").textContent = task ? "MAKE A CHANGE" : "MAKE IT HAPPEN";
  document.querySelector("#save-label").textContent = task ? "Save changes" : "Add task";
  elements.title.value = task?.title || "";
  elements.notes.value = task?.notes || "";
  elements.due.value = task?.due || today;
  elements.priority.value = task?.priority || "medium";
  elements.dialog.showModal();
  requestAnimationFrame(() => elements.title.focus());
}

function closeDialog() {
  elements.dialog.close();
  state.editingId = null;
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    state.openMenuId = null;
    render();
  });
});

document.querySelector("#add-task-button").addEventListener("click", () => openDialog());
document.querySelector("#empty-add-button").addEventListener("click", () => openDialog());
document.querySelector("#close-dialog").addEventListener("click", closeDialog);
document.querySelector("#cancel-dialog").addEventListener("click", closeDialog);
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDialog();
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = elements.title.value.trim();
  if (!title) {
    elements.title.focus();
    return;
  }
  const fields = {
    title,
    notes: elements.notes.value.trim(),
    due: elements.due.value || today,
    priority: elements.priority.value,
  };
  if (state.editingId) {
    const task = state.tasks.find((item) => item.id === state.editingId);
    if (task) Object.assign(task, fields);
    showToast("Task updated.");
  } else {
    state.tasks.push({ id: crypto.randomUUID(), ...fields, category: "General", completed: false, createdAt: Date.now() });
    showToast("Task added to your list.");
  }
  saveTasks();
  closeDialog();
  render();
});

elements.groups.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const row = actionButton.closest("[data-task-id]");
  const task = state.tasks.find((item) => item.id === row?.dataset.taskId);
  if (!task) return;
  const action = actionButton.dataset.action;
  if (action === "toggle") {
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    state.openMenuId = null;
    saveTasks();
    render();
    if (task.completed) showToast("Nicely done. One less thing to carry.");
  } else if (action === "menu") {
    state.openMenuId = state.openMenuId === task.id ? null : task.id;
    render();
  } else if (action === "edit") {
    state.openMenuId = null;
    openDialog(task);
  } else if (action === "delete") {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    state.openMenuId = null;
    saveTasks();
    render();
    showToast("Task deleted.");
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".task-actions") && state.openMenuId) {
    state.openMenuId = null;
    render();
  }
});

document.querySelector("#task-search").addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});
document.querySelector("#sort-tasks").addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

function setCompact(compact) {
  state.compact = compact;
  document.querySelector("#list-view-button").classList.toggle("is-selected", !compact);
  document.querySelector("#list-view-button").setAttribute("aria-pressed", String(!compact));
  document.querySelector("#compact-view-button").classList.toggle("is-selected", compact);
  document.querySelector("#compact-view-button").setAttribute("aria-pressed", String(compact));
  render();
}
document.querySelector("#list-view-button").addEventListener("click", () => setCompact(false));
document.querySelector("#compact-view-button").addEventListener("click", () => setCompact(true));

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !elements.dialog.open && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    document.querySelector("#task-search").focus();
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !elements.dialog.open) {
    event.preventDefault();
    openDialog();
  }
});

document.querySelector(".help-button").addEventListener("click", () => showToast("Your tasks stay saved in this browser."));
document.querySelector("#today-date").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
render();