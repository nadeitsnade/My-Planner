const SB = window.supabase.createClient(
  "https://wizndbnlojjpcaeudizx.supabase.co",
  "sb_publishable_xkAfsN5vGx_GdMJLx-yMEA_HrDcQvdf"
);

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function btn(text, cls, fn) { const b = el("button", cls, text); b.onclick = fn; return b; }
function delBtn(fn) { return btn("✕", "del", fn); }
function showStatus(t, bad) {
  let s = $("sync");
  if (!s) { s = el("div", "sync"); s.id = "sync"; document.body.append(s); }
  s.textContent = t;
  s.classList.toggle("bad", !!bad);
}
window.onerror = (m, s, l) => showStatus("Error: " + m + " (line " + l + ")", true);

const load = (k) => JSON.parse(localStorage.getItem(k) || "[]");
let tasks = load("tasks"), notes = load("notes"), todos = load("todos"), money = load("money");
let rate = parseFloat(localStorage.getItem("vndIdrRate")) || 0.68;
let rateNote = localStorage.getItem("vndIdrRate") ? "saved rate" : "default rate";
let calY = new Date().getFullYear(), calM = new Date().getMonth();
let selDay = null, editMoney = null, editNote = null;

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => y + "-" + pad(m + 1) + "-" + pad(d);
const todayStr = () => { const d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); };
const parseD = (s) => { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
const byDue = (a, b) => a.due.localeCompare(b.due);
const fmt = (n) => Math.round(n).toLocaleString("vi-VN") + " ₫";
const fmtIDR = (n) => "Rp " + Math.round(n * rate).toLocaleString("id-ID");

function fixMoney() {
  money.forEach((m, i) => {
    if (!m.id) m.id = Date.now() + i;
    if (!m.pay) m.pay = "cash";
    if (m.paid === undefined) m.paid = 0;
    if (m.person === undefined) m.person = "";
  });
}

/* ---------- Cloud sync ---------- */
function storeLocal() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("notes", JSON.stringify(notes));
  localStorage.setItem("todos", JSON.stringify(todos));
  localStorage.setItem("money", JSON.stringify(money));
}

async function save() {
  storeLocal();
  const stamp = new Date().toISOString();
  const rows = [["tasks", tasks], ["notes", notes], ["todos", todos], ["money", money]]
    .map(([id, content]) => ({ id, category: id, content, updated_at: stamp }));
  try {
    const r = await SB.from("planner_data").upsert(rows);
    if (r.error) showStatus("Save failed: " + r.error.message, true);
    else showStatus("Synced ✓ " + new Date().toLocaleTimeString());
  } catch (e) { showStatus("Save failed: " + e.message, true); }
}

async function pull() {
  try {
    const r = await SB.from("planner_data").select("*");
    if (r.error) return showStatus("Load failed: " + r.error.message, true);
    if (!r.data.length) return save();
    r.data.forEach((row) => {
      const c = row.content || [];
      if (row.id === "tasks") tasks = c;
      if (row.id === "notes") notes = c;
      if (row.id === "todos") todos = c;
      if (row.id === "money") money = c;
    });
    fixMoney();
    storeLocal();
    render();
    showStatus("Synced ✓ " + new Date().toLocaleTimeString());
  } catch (e) { showStatus("Load failed: " + e.message, true); }
}

function commit() { save(); render(); }

/* ---------- Tabs & clock ---------- */
document.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  $("page-" + b.dataset.page).classList.remove("hidden");
  render();
});

function tickClock() {
  const n = new Date();
  $("clock").textContent =
    n.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    " - " + n.toLocaleTimeString();
}

function leftText(t) {
  if (t.done) return "Done ✓";
  const d = new Date(t.due) - new Date();
  if (d <= 0) return "Overdue";
  const m = Math.floor(d / 60000);
  return Math.floor(m / 1440) + "d " + Math.floor((m % 1440) / 60) + "h " + (m % 60) + "m left";
}
function leftEl(t) { const e = el("div", "left", leftText(t)); e._t = t; return e; }

/* ---------- Home ---------- */
const TIERS = [
  [1, "😎", "Untouched wallet. Pristine.", "#c8f0c8"],
  [500000, "🙂", "Looking healthy and under control.", "#fff3a8"],
  [2000000, "😬", "Uhh... expenses are piling up.", "#ffd6a5"],
  [5000000, "😰", "STOP SWIPING! Wallet is sweating!", "#ffb98a"],
  [Infinity, "💀", "FINANCIAL RUIN. SEND HELP.", "#ff9b8a"]
];

function renderHome() {
  $("today").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const next = $("next");
  next.innerHTML = "";
  const now = new Date();
  const up = tasks.filter((t) => !t.done && new Date(t.due) > now).sort(byDue).slice(0, 3);
  if (!up.length) next.textContent = "Nothing coming up.";
  up.forEach((t) => {
    const r = el("div", "mini");
    r.append(el("strong", null, t.title), el("div", "when", new Date(t.due).toLocaleString()), leftEl(t));
    next.append(r);
  });

  $("stats").textContent =
    "Schedule: " + tasks.filter((t) => t.done).length + " of " + tasks.length + " done | " +
    "To-do: " + todos.filter((t) => t.done).length + " of " + todos.length + " done";

  const month = todayStr().slice(0, 7);
  let spent = 0;
  const by = {};
  money.filter((m) => m.date.slice(0, 7) === month && m.type === "expense" && m.pay !== "loan")
    .forEach((m) => { spent += m.amount; by[m.cat] = (by[m.cat] || 0) + m.amount; });
  const tier = TIERS.find((x) => spent < x[0]);
  $("moodFace").textContent = tier[1];
  $("moodMsg").textContent = tier[2];
  $("moodCard").style.background = tier[3];
  $("moodTotal").textContent = "Spent: " + fmt(spent);

  const top = $("topCats");
  top.innerHTML = "";
  const cats = Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 3);
  if (!cats.length) top.textContent = "No expenses this month.";
  cats.forEach((c, i) => {
    const r = el("div", "top-row");
    r.append(el("span", null, (i + 1) + ". " + c), el("span", "minus", fmt(by[c])));
    top.append(r);
  });
}

function renderReminder() {
  const now = new Date(), lim = new Date(now.getTime() + 3 * 86400000);
  const soon = tasks.filter((t) => !t.done && new Date(t.due) >= now && new Date(t.due) <= lim).sort(byDue);
  ["page-home", "page-schedule"].forEach((id) => {
    const page = $(id);
    let b = page.querySelector(".reminder");
    if (!b) { b = el("div", "reminder"); page.prepend(b); }
    b.innerHTML = "";
    b.classList.toggle("hidden", !soon.length);
    if (!soon.length) return;
    b.append(el("strong", null, "⏰ Coming up in the next 3 days"));
    soon.forEach((t) => b.append(el("div", null, t.title + " · " + new Date(t.due).toLocaleString(undefined,
      { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))));
  });
}

/* ---------- Schedule ---------- */
function taskCard(t, cls, full) {
  const c = el("div", cls + (t.done ? " done" : ""));
  const box = el("input");
  box.type = "checkbox";
  box.checked = t.done;
  box.onchange = () => { t.done = box.checked; commit(); };
  const info = el("div", "info");
  info.append(el("strong", null, t.title),
    el("div", "when", full ? new Date(t.due).toLocaleString() : t.due.slice(11, 16)));
  if (t.notes) info.append(el("div", "notes", t.notes));
  info.append(leftEl(t));
  c.append(box, info, delBtn(() => {
    if (!confirm("Delete this schedule?")) return;
    tasks = tasks.filter((x) => x !== t);
    commit();
  }));
  return c;
}

function renderTasks() {
  const l = $("list");
  l.innerHTML = "";
  tasks.slice().sort(byDue).forEach((t) => l.append(taskCard(t, "task", true)));
}

$("addTask").onclick = () => {
  const title = $("taskTitle").value.trim(), due = $("taskDue").value;
  if (!title || !due) return alert("Please enter a title and pick a date and time.");
  tasks.push({ title, due, notes: $("taskNotes").value, done: false });
  ["taskTitle", "taskDue", "taskNotes"].forEach((i) => $(i).value = "");
  commit();
};

function renderCalendar() {
  const g = $("calGrid");
  g.innerHTML = "";
  $("calTitle").textContent = new Date(calY, calM, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  "MTWTFSS".split("").forEach((d) => g.append(el("div", "cal-dow", d)));
  for (let i = 0; i < (new Date(calY, calM, 1).getDay() + 6) % 7; i++) g.append(el("div"));

  const n = new Date(calY, calM + 1, 0).getDate();
  const now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let d = 1; d <= n; d++) {
    const key = ymd(calY, calM, d);
    const day = tasks.filter((t) => t.due.slice(0, 10) === key).sort(byDue);
    const open = day.filter((t) => !t.done);
    const diff = Math.round((new Date(calY, calM, d) - t0) / 86400000);
    const c = el("div", "cal-cell");
    if (diff === 0) c.classList.add("today");
    if (key === selDay) c.classList.add("selected");
    if (open.length) c.classList.add(diff < 0 ? "heat-past" : diff === 0 ? "heat-0" :
      diff === 1 ? "heat-1" : diff <= 3 ? "heat-2" : diff <= 7 ? "heat-3" : "heat-4");
    const top = el("div", "cal-top");
    top.append(el("span", null, d), el("span", open.length ? "mark warn" : "mark ok",
      open.length ? "!" : day.length ? "✓" : ""));
    c.append(top);
    day.slice(0, 2).forEach((t, i) => c.append(el("div", "sticky s" + (i % 3) + (t.done ? " done" : ""), t.title)));
    if (day.length > 2) c.append(el("div", "cal-more", "+" + (day.length - 2)));
    c.onclick = () => {
      selDay = key;
      renderCalendar();
      $("dayPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    g.append(c);
  }
  renderDay();
}

function renderDay() {
  const p = $("dayPanel");
  p.innerHTML = "";
  p.classList.toggle("hidden", !selDay);
  if (!selDay) return;

  const head = el("div", "cal-head");
  head.append(el("h3", null, parseD(selDay).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })),
    delBtn(() => { selDay = null; renderCalendar(); }));
  p.append(head);

  const day = tasks.filter((t) => t.due.slice(0, 10) === selDay).sort(byDue);
  if (!day.length) p.append(el("div", null, "Nothing scheduled yet."));
  day.forEach((t, i) => p.append(taskCard(t, "note-row s" + (i % 3), false)));

  const f = el("div", "form plain");
  const ti = el("input"); ti.placeholder = "Add a schedule to this day";
  const tm = el("input"); tm.type = "time"; tm.value = "09:00";
  const no = el("textarea"); no.placeholder = "Notes";
  f.append(ti, tm, no, btn("Add to this day", "", () => {
    if (!ti.value.trim() || !tm.value) return alert("Please enter a title and a time.");
    tasks.push({ title: ti.value.trim(), due: selDay + "T" + tm.value, notes: no.value, done: false });
    commit();
  }));
  p.append(f);
}

$("calPrev").onclick = () => { if (--calM < 0) { calM = 11; calY--; } renderCalendar(); };
$("calNext").onclick = () => { if (++calM > 11) { calM = 0; calY++; } renderCalendar(); };

/* ---------- Notes ---------- */
function renderNotes() {
  const g = $("noteList");
  g.innerHTML = "";
  notes.slice().reverse().forEach((n) => {
    const c = el("div", "sticky-note"), h = el("div", "sn-head"), acts = el("div");
    acts.append(btn("✏️", "small-edit", () => openNote(n)),
      delBtn(() => { notes = notes.filter((x) => x !== n); commit(); }));
    h.append(el("strong", null, n.title), acts);
    c.append(h, el("div", "sn-body", n.text), el("div", "sn-foot", n.date || ""));
    g.append(c);
  });
}

function openNote(n) {
  editNote = n || null;
  $("noteModalTitle").textContent = n ? "Edit Note" : "New Note";
  $("noteTitle").value = n ? n.title : "";
  $("noteText").value = n ? n.text : "";
  $("noteModal").classList.remove("hidden");
}
$("openNote").onclick = () => openNote(null);
$("closeNote").onclick = () => $("noteModal").classList.add("hidden");
$("saveNote").onclick = () => {
  const title = $("noteTitle").value.trim(), text = $("noteText").value;
  if (!title && !text.trim()) return alert("Write a title or some text first.");
  if (editNote) { editNote.title = title || "Untitled"; editNote.text = text; }
  else notes.push({ id: Date.now(), title: title || "Untitled", text, date: todayStr() });
  $("noteModal").classList.add("hidden");
  commit();
};

/* ---------- To-do ---------- */
function renderTodos() {
  const l = $("todoList");
  l.innerHTML = "";
  todos.forEach((t) => {
    const c = el("div", "task" + (t.done ? " done" : ""));
    const box = el("input");
    box.type = "checkbox";
    box.checked = t.done;
    box.onchange = () => { t.done = box.checked; commit(); };
    const info = el("div", "info");
    info.append(el("span", null, t.text));
    c.append(box, info, delBtn(() => { todos = todos.filter((x) => x !== t); commit(); }));
    l.append(c);
  });
}
$("addTodo").onclick = () => {
  const v = $("todoText").value.trim();
  if (!v) return;
  todos.push({ text: v, done: false });
  $("todoText").value = "";
  commit();
};

/* ---------- Money ---------- */
function moneyRow(label, v, cls) {
  const row = el("div", "money-row"), b = el("div");
  b.style.textAlign = "right";
  b.append(el("div", cls, fmt(v)), el("div", "idr", "≈ " + fmtIDR(v)));
  row.append(el("span", null, label), b);
  return row;
}
function fill(id, rows) {
  const b = $(id);
  b.innerHTML = "";
  rows.forEach((r) => b.append(moneyRow(r[0], r[1], r[2])));
}
const sign = (n) => (n >= 0 ? "plus" : "minus");

function renderMoney() {
  let cash = 0, card = 0, inc = 0, sp = 0, spCash = 0, spCard = 0, lent = 0, rem = 0;
  const month = todayStr().slice(0, 7), owed = {}, dayNet = {};

  money.forEach((m) => {
    if (m.pay === "loan") {
      const left = Math.max(0, m.amount - (m.paid || 0));
      lent += m.amount;
      rem += left;
      const k = m.person.trim().toLowerCase();
      (owed[k] = owed[k] || { name: m.person.trim(), left: 0 }).left += left;
      return;
    }
    const s = m.type === "income" ? m.amount : -m.amount;
    if (m.pay === "cashless") card += s; else cash += s;
    dayNet[m.date] = (dayNet[m.date] || 0) + s;
    if (m.date.slice(0, 7) === month) {
      if (m.type === "income") inc += m.amount;
      else { sp += m.amount; if (m.pay === "cashless") spCard += m.amount; else spCash += m.amount; }
    }
  });

  fill("balanceBox", [["Cash", cash, sign(cash)], ["Cashless", card, sign(card)], ["Total", cash + card, sign(cash + card)]]);
  fill("moneySummary", [["Income", inc, "plus"], ["Spent", sp, "minus"], ["Net", inc - sp, sign(inc - sp)],
    ["Spent in cash", spCash, ""], ["Spent cashless", spCard, ""]]);
  $("moneySummary").append(el("div", "note", "1 ₫ = " + rate.toFixed(4) + " Rp (" + rateNote + ")"));

  const owedList = Object.values(owed);
  if (!owedList.length) $("loanSummary").textContent = "No loans yet.";
  else fill("loanSummary", [["Total lent", lent, ""], ["Remaining", rem, ""]]
    .concat(owedList.filter((o) => o.left > 0).map((o) => ["→ " + o.name, o.left, ""])));

  const list = $("moneyList");
  list.innerHTML = "";
  let last = null;
  money.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).forEach((m) => {
    if (m.date !== last) {
      last = m.date;
      const n = dayNet[m.date] || 0, h = el("div", "day-head");
      h.append(el("span", null, parseD(m.date).toLocaleDateString(undefined,
        { weekday: "short", day: "numeric", month: "short", year: "numeric" })),
        el("span", null, (n >= 0 ? "+" : "-") + fmt(Math.abs(n))));
      list.append(h);
    }
    const loan = m.pay === "loan", left = Math.max(0, m.amount - (m.paid || 0));
    const c = el("div", "task pay-" + m.pay), info = el("div", "info"), acts = el("div", "actions");
    info.append(el("strong", null, m.title),
      el("div", "when", m.cat + " · " + (loan ? "Loan to " + m.person : m.pay === "cashless" ? "Card" : "Cash")),
      el("div", loan ? "" : m.type === "income" ? "plus" : "minus",
        loan ? "Lent: " + fmt(m.amount) : (m.type === "income" ? "+" : "-") + fmt(m.amount)),
      el("div", "idr", "≈ " + fmtIDR(m.amount)));
    if (loan) info.append(el("div", "when", "Paid back: " + fmt(m.paid || 0)),
      el("div", left ? "minus" : "plus", left ? "Remaining: " + fmt(left) : "Fully paid back ✓"));
    acts.append(btn("Edit", "small-btn", () => startEdit(m)));
    if (loan && left) acts.append(btn("Repay", "small-btn", () => repay(m)));
    acts.append(delBtn(() => {
      if (!confirm("Delete this entry?")) return;
      money = money.filter((x) => x !== m);
      commit();
    }));
    c.append(info, acts);
    list.append(c);
  });
}

function repay(m) {
  const left = m.amount - (m.paid || 0);
  const a = prompt("How much did " + m.person + " pay back? (in VND)\nStill owed: " + fmt(left));
  const x = parseFloat(a);
  if (!x || x <= 0) return;
  m.paid = Math.min(m.amount, (m.paid || 0) + x);
  commit();
}

function setPay(v) {
  $("moneyPay").value = v;
  document.querySelectorAll(".pay-option").forEach((b) => b.classList.toggle("active", b.dataset.value === v));
  $("moneyPerson").classList.toggle("hidden", v !== "loan");
  $("moneyType").classList.toggle("hidden", v === "loan");
}
document.querySelectorAll(".pay-option").forEach((b) => b.onclick = () => setPay(b.dataset.value));

function resetMoney() {
  editMoney = null;
  ["moneyTitle", "moneyAmount", "moneyPerson"].forEach((i) => $(i).value = "");
  $("moneyType").value = "expense";
  $("moneyDate").value = todayStr();
  $("addMoney").textContent = "Add";
  $("cancelMoney").classList.add("hidden");
  setPay("cash");
}
$("cancelMoney").onclick = resetMoney;

function startEdit(m) {
  editMoney = m;
  $("moneyTitle").value = m.title;
  $("moneyAmount").value = m.amount;
  $("moneyType").value = m.type;
  $("moneyCat").value = m.cat;
  $("moneyDate").value = m.date;
  $("moneyPerson").value = m.person || "";
  setPay(m.pay);
  $("addMoney").textContent = "Save changes";
  $("cancelMoney").classList.remove("hidden");
  $("moneyForm").scrollIntoView({ behavior: "smooth" });
}

$("addMoney").onclick = () => {
  const amount = parseFloat($("moneyAmount").value), pay = $("moneyPay").value;
  const person = $("moneyPerson").value.trim(), cat = $("moneyCat").value;
  if (!amount || amount <= 0) return alert("Please enter an amount above 0.");
  if (pay === "loan" && !person) return alert("Please write who this loan is to.");
  const e = {
    title: $("moneyTitle").value.trim() || (pay === "loan" ? "Loan" : cat),
    amount, type: $("moneyType").value, cat,
    date: $("moneyDate").value || todayStr(), pay,
    person: pay === "loan" ? person : ""
  };
  if (editMoney) Object.assign(editMoney, e, { paid: pay === "loan" ? Math.min(editMoney.paid || 0, amount) : 0 });
  else money.push(Object.assign({ id: Date.now(), paid: 0 }, e));
  resetMoney();
  commit();
};

function fetchRate() {
  fetch("https://open.er-api.com/v6/latest/VND").then((r) => r.json()).then((d) => {
    if (d && d.rates && d.rates.IDR) {
      rate = d.rates.IDR;
      rateNote = "live rate";
      localStorage.setItem("vndIdrRate", String(rate));
      render();
    }
  }).catch(() => {});
}

/* ---------- Start ---------- */
function render() {
  renderHome();
  renderCalendar();
  renderTasks();
  renderNotes();
  renderTodos();
  renderMoney();
  renderReminder();
}

fixMoney();
resetMoney();
tickClock();
render();
fetchRate();
pull();
setInterval(tickClock, 1000);
setInterval(() => document.querySelectorAll(".left").forEach((e) => e.textContent = leftText(e._t)), 1000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
