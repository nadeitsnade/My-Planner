const FALLBACK_RATE = 0.68; // 1 VND is about 0.68 IDR

let rate = parseFloat(localStorage.getItem("vndIdrRate")) || FALLBACK_RATE;
let rateStatus = localStorage.getItem("vndIdrRate") ? "saved rate" : "default rate";

let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
let notes = JSON.parse(localStorage.getItem("notes") || "[]");
let todos = JSON.parse(localStorage.getItem("todos") || "[]");
let money = JSON.parse(localStorage.getItem("money") || "[]");
let editingId = null;

var calYear = new Date().getFullYear();
var calMonth = new Date().getMonth();
var selectedDay = null;

/* Give older money entries the new fields */
money.forEach(function (m, i) {
  if (!m.id) m.id = Date.now() + i;
  if (!m.pay) m.pay = "cash";
  if (m.paid === undefined) m.paid = 0;
  if (m.person === undefined) m.person = "";
});

function saveAll() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  localStorage.setItem("notes", JSON.stringify(notes));
  localStorage.setItem("todos", JSON.stringify(todos));
  localStorage.setItem("money", JSON.stringify(money));
}

function makeDelete(onClick) {
  const del = document.createElement("button");
  del.className = "del";
  del.textContent = "✕";
  del.onclick = onClick;
  return del;
}

function makeLeft(t) {
  const left = document.createElement("div");
  left.className = "left";
  left.dataset.due = t.due;
  left.dataset.done = t.done;
  return left;
}

function todayStr() {
  const d = new Date();
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function parseDate(str) {
  const p = str.split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function ymd(y, m, d) {
  return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

/* ---------- Currency ---------- */
function fmt(n) {
  return Math.round(n).toLocaleString("vi-VN") + " ₫";
}

function fmtIDR(n) {
  return "Rp " + Math.round(n * rate).toLocaleString("id-ID");
}

function fetchRate() {
  fetch("https://open.er-api.com/v6/latest/VND")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.rates && data.rates.IDR) {
        rate = data.rates.IDR;
        rateStatus = "live rate";
        localStorage.setItem("vndIdrRate", String(rate));
        renderAll();
      }
    })
    .catch(function () {});
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach(function (btn) {
  btn.onclick = function () {
    document.querySelectorAll(".tab").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    document.querySelectorAll(".page").forEach(function (p) {
      p.classList.add("hidden");
    });
    document.getElementById("page-" + btn.dataset.page).classList.remove("hidden");
    renderAll();
  };
});

/* ---------- Live Clock ---------- */
function updateLiveClock() {
  const clockEl = document.getElementById("liveClock");
  if (!clockEl) return;
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  const dateString = now.toLocaleDateString(undefined, { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
  clockEl.textContent = dateString + " - " + timeString;
}

/* ---------- Home ---------- */
function renderHome() {
  const todayEl = document.getElementById("today");
  if (todayEl) {
    todayEl.textContent = new Date().toLocaleDateString(
      undefined,
      { weekday: "long", month: "long", day: "numeric" }
    );
  }

  const next = document.getElementById("next");
  if (next) {
    next.innerHTML = "";
    const now = new Date();
    const upcoming = tasks
      .filter(function (t) { return !t.done && new Date(t.due) > now; })
      .sort(function (a, b) { return new Date(a.due) - new Date(b.due); })
      .slice(0, 3);

    if (upcoming.length === 0) {
      next.textContent = "Nothing coming up.";
    }
    upcoming.forEach(function (t) {
      const row = document.createElement("div");
      row.className = "mini";
      const title = document.createElement("strong");
      title.textContent = t.title;
      const when = document.createElement("div");
      when.className = "when";
      when.textContent = new Date(t.due).toLocaleString();
      row.append(title, when, makeLeft(t));
      next.append(row);
    });
  }

  const stats = document.getElementById("stats");
  if (stats) {
    const doneTasks = tasks.filter(function (t) { return t.done; }).length;
    const doneTodos = todos.filter(function (t) { return t.done; }).length;
    stats.textContent =
      "Schedule: " + doneTasks + " of " + tasks.length + " done  |  " +
      "To-do: " + doneTodos + " of " + todos.length + " done";
  }

  renderSpendingMood();
}

function renderSpendingMood() {
  const card = document.getElementById("spendingMoodCard");
  if (!card) return;

  const month = todayStr().slice(0, 7);
  const thisMonth = money.filter(function (m) {
    return m.date.slice(0, 7) === month && m.type === "expense" && m.pay !== "loan";
  });

  let totalSpent = 0;
  const byCat = {};
  thisMonth.forEach(function (m) {
    totalSpent += m.amount;
    byCat[m.cat] = (byCat[m.cat] || 0) + m.amount;
  });

  const totalDisplay = document.getElementById("monthlyTotalDisplay");
  if (totalDisplay) totalDisplay.textContent = "Spent: " + fmt(totalSpent);

  const avatar = document.getElementById("moodAvatar");
  const msg = document.getElementById("moodMessage");

  if (avatar && msg) {
    if (totalSpent === 0) {
      avatar.textContent = "😎";
      avatar.style.transform = "rotate(0deg)";
      msg.textContent = "Untouched wallet. Pristine.";
      card.style.background = "#c8f0c8";
    } else if (totalSpent < 500000) {
      avatar.textContent = "🙂";
      avatar.style.transform = "rotate(0deg)";
      msg.textContent = "Looking healthy and under control.";
      card.style.background = "#fff3a8";
    } else if (totalSpent < 2000000) {
      avatar.textContent = "😬";
      avatar.style.transform = "rotate(-3deg)";
      msg.textContent = "Uhh... expenses are piling up.";
      card.style.background = "#ffd6a5";
    } else if (totalSpent < 5000000) {
      avatar.textContent = "😰";
      avatar.style.transform = "rotate(3deg)";
      msg.textContent = "STOP SWIPING! Wallet is sweating!";
      card.style.background = "#ffb98a";
    } else {
      avatar.textContent = "💀";
      avatar.style.transform = "rotate(6deg) scale(1.1)";
      msg.textContent = "ABSOLUTE FINANCIAL RUIN. SEND HELP.";
      card.style.background = "#ff9b8a";
    }
  }

  const topList = document.getElementById("topCategoriesList");
  if (topList) {
    topList.innerHTML = "";
    
    const sortedCats = Object.keys(byCat)
      .sort(function (a, b) { return byCat[b] - byCat[a]; })
      .slice(0, 3);

    if (sortedCats.length === 0) {
      const empty = document.createElement("div");
      empty.style.textAlign = "center";
      empty.style.color = "#4a5a6a";
      empty.textContent = "No expenses recorded this month.";
      topList.append(empty);
    } else {
      sortedCats.forEach(function (cat, index) {
        const row = document.createElement("div");
        row.className = "top-cat-row";
        const name = document.createElement("span");
        name.textContent = (index + 1) + ". " + cat;
        const amt = document.createElement("span");
        amt.textContent = fmt(byCat[cat]);
        amt.className = "minus";
        row.append(name, amt);
        topList.append(row);
      });
    }
  }
}

/* ---------- Schedule ---------- */
function renderSchedule() {
  const list = document.getElementById("list");
  if (!list) return;
  list.innerHTML = "";
  tasks.sort(function (a, b) { return new Date(a.due) - new Date(b.due); });

  tasks.forEach(function (t) {
    const card = document.createElement("div");
    card.className = "task" + (t.done ? " done" : "");

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = t.done;
    box.onchange = function () {
      t.done = box.checked;
      saveAll();
      renderAll();
    };

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("strong");
    title.textContent = t.title;
    const when = document.createElement("div");
    when.className = "when";
    when.textContent = new Date(t.due).toLocaleString();
    const noteText = document.createElement("div");
    noteText.className = "notes";
    noteText.textContent = t.notes;
    info.append(title, when, noteText, makeLeft(t));

    const del = makeDelete(function () {
      tasks = tasks.filter(function (x) { return x !== t; });
      saveAll();
      renderAll();
    });

    card.append(box, info, del);
    list.append(card);
  });
}

const addTaskBtn = document.getElementById("addTask");
if (addTaskBtn) {
  addTaskBtn.onclick = function () {
    const title = document.getElementById("taskTitle").value.trim();
    const due = document.getElementById("taskDue").value;
    const taskNotes = document.getElementById("taskNotes").value;

    if (!title || !due) {
      alert("Please enter a title and pick a date and time.");
      return;
    }
    tasks.push({ title: title, due: due, notes: taskNotes, done: false });
    saveAll();
    renderAll();
    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDue").value = "";
    document.getElementById("taskNotes").value = "";
  };
}

/* ---------- Notes (Grid View, Dates & Edit) ---------- */
let editingNoteId = null;

function renderNotes() {
  const list = document.getElementById("noteList");
  if (!list) return;
  list.innerHTML = "";

  notes.slice().reverse().forEach(function (n) {
    if (!n.id) n.id = Date.now() + Math.random();
    if (!n.date) n.date = todayStr();

    const card = document.createElement("div");
    card.className = "sticky-note";

    const header = document.createElement("div");
    header.className = "sticky-header";
    const title = document.createElement("strong");
    title.textContent = n.title;

    const actionGroup = document.createElement("div");
    actionGroup.className = "sticky-actions-group";

    const editBtn = document.createElement("button");
    editBtn.className = "small-edit-btn";
    editBtn.textContent = "✏️";
    editBtn.title = "Edit note";
    editBtn.onclick = function () { startEditNote(n); };

    const del = makeDelete(function () {
      notes = notes.filter(function (x) { return x.id !== n.id; });
      saveAll();
      renderAll();
    });

    actionGroup.append(editBtn, del);
    header.append(title, actionGroup);

    const text = document.createElement("div");
    text.className = "sticky-body";
    text.textContent = n.text;

    const footer = document.createElement("div");
    footer.className = "sticky-footer";
    const dateSpan = document.createElement("span");
    dateSpan.textContent = n.date;
    footer.append(dateSpan);

    card.append(header, text, footer);
    list.append(card);
  });
}

const noteModal = document.getElementById("noteModal");
const openNoteModalBtn = document.getElementById("openNoteModalBtn");
const closeNoteModalBtn = document.getElementById("closeNoteModal");
const noteModalTitle = document.getElementById("noteModalTitle");

if (openNoteModalBtn) {
  openNoteModalBtn.onclick = function () {
    editingNoteId = null;
    if (noteModalTitle) noteModalTitle.textContent = "New Note";
    document.getElementById("noteTitle").value = "";
    document.getElementById("noteText").value = "";
    if (noteModal) noteModal.classList.remove("hidden");
  };
}

if (closeNoteModalBtn) {
  closeNoteModalBtn.onclick = function () {
    if (noteModal) noteModal.classList.add("hidden");
  };
}

function startEditNote(n) {
  editingNoteId = n.id;
  if (noteModalTitle) noteModalTitle.textContent = "Edit Note";
  document.getElementById("noteTitle").value = n.title;
  document.getElementById("noteText").value = n.text;
  if (noteModal) noteModal.classList.remove("hidden");
}

const addNoteBtn = document.getElementById("addNote");
if (addNoteBtn) {
  addNoteBtn.onclick = function () {
    const title = document.getElementById("noteTitle").value.trim();
    const text = document.getElementById("noteText").value;
    if (!title && !text.trim()) {
      alert("Write a title or some text first.");
      return;
    }

    if (editingNoteId) {
      const existing = notes.find(function (x) { return x.id === editingNoteId; });
      if (existing) {
        existing.title = title || "Untitled";
        existing.text = text;
      }
    } else {
      notes.push({
        id: Date.now(),
        title: title || "Untitled",
        text: text,
        date: todayStr()
      });
    }

    saveAll();
    renderAll();
    if (noteModal) noteModal.classList.add("hidden");
  };
}

/* ---------- To-do ---------- */
function renderTodos() {
  const list = document.getElementById("todoList");
  if (!list) return;
  list.innerHTML = "";

  todos.forEach(function (t) {
    const card = document.createElement("div");
    card.className = "task" + (t.done ? " done" : "");

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = t.done;
    box.onchange = function () {
      t.done = box.checked;
      saveAll();
      renderAll();
    };

    const info = document.createElement("div");
    info.className = "info";
    const text = document.createElement("span");
    text.textContent = t.text;
    info.append(text);

    const del = makeDelete(function () {
      todos = todos.filter(function (x) { return x !== t; });
      saveAll();
      renderAll();
    });

    card.append(box, info, del);
    list.append(card);
  });
}

const addTodoBtn = document.getElementById("addTodo");
if (addTodoBtn) {
  addTodoBtn.onclick = function () {
    const text = document.getElementById("todoText").value.trim();
    if (!text) return;
    todos.push({ text: text, done: false });
    saveAll();
    renderAll();
    document.getElementById("todoText").value = "";
  };
}

/* ---------- Money ---------- */
function moneyRow(label, value, cls) {
  const row = document.createElement("div");
  row.className = "money-row";

  const a = document.createElement("span");
  a.textContent = label;

  const b = document.createElement("div");
  b.style.textAlign = "right";
  const vnd = document.createElement("div");
  vnd.textContent = fmt(value);
  if (cls) vnd.className = cls;
  const idr = document.createElement("div");
  idr.className = "idr";
  idr.textContent = "≈ " + fmtIDR(value);
  b.append(vnd, idr);

  row.append(a, b);
  return row;
}

function payLabel(m) {
  if (m.pay === "loan") return "Loan to " + m.person;
  return m.pay === "cashless" ? "Card" : "Cash";
}

function renderMoney() {
  const month = todayStr().slice(0, 7);
  const thisMonth = money.filter(function (m) {
    return m.date.slice(0, 7) === month && m.pay !== "loan";
  });

  let income = 0;
  let spent = 0;
  let cashSpent = 0;
  let cashlessSpent = 0;
  const byCat = {};
  thisMonth.forEach(function (m) {
    if (m.type === "income") {
      income += m.amount;
    } else {
      spent += m.amount;
      byCat[m.cat] = (byCat[m.cat] || 0) + m.amount;
      if (m.pay === "cashless") {
        cashlessSpent += m.amount;
      } else {
        cashSpent += m.amount;
      }
    }
  });

  const summary = document.getElementById("moneySummary");
  if (summary) {
    summary.innerHTML = "";
    summary.append(
      moneyRow("Income", income, "plus"),
      moneyRow("Spent", spent, "minus"),
      moneyRow("Balance", income - spent, income - spent >= 0 ? "plus" : "minus"),
      moneyRow("Spent in cash", cashSpent, ""),
      moneyRow("Spent cashless", cashlessSpent, "")
    );

    const note = document.createElement("div");
    note.className = "rate-note";
    note.textContent = "1 ₫ = " + rate.toFixed(4) + " Rp (" + rateStatus + ")";
    summary.append(note);
  }

  const bars = document.getElementById("moneyBars");
  if (bars) {
    bars.innerHTML = "";
    Object.keys(byCat)
      .sort(function (a, b) { return byCat[b] - byCat[a]; })
      .forEach(function (cat) {
        const wrap = document.createElement("div");
        wrap.className = "bar-wrap";

        const label = document.createElement("div");
        label.className = "bar-label";
        const name = document.createElement("span");
        name.textContent = cat;
        const amt = document.createElement("span");
        amt.textContent = fmt(byCat[cat]) + " (" + Math.round((byCat[cat] / spent) * 100) + "%)";
        label.append(name, amt);

        const bg = document.createElement("div");
        bg.className = "bar-bg";
        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = (byCat[cat] / spent) * 100 + "%";
        bg.append(fill);

        wrap.append(label, bg);
        bars.append(wrap);
      });
  }

  renderLoans();
  renderMoneyList();
}

function renderLoans() {
  const box = document.getElementById("loanSummary");
  if (!box) return;
  box.innerHTML = "";

  const loans = money.filter(function (m) { return m.pay === "loan"; });
  if (loans.length === 0) {
    box.textContent = "No loans yet.";
    return;
  }

  let lent = 0;
  let remaining = 0;
  const byPerson = {};
  loans.forEach(function (m) {
    const left = Math.max(0, m.amount - (m.paid || 0));
    lent += m.amount;
    remaining += left;
    const key = m.person.trim().toLowerCase();
    if (!byPerson[key]) byPerson[key] = { name: m.person.trim(), left: 0 };
    byPerson[key].left += left;
  });

  box.append(moneyRow("Total lent", lent, ""));
  box.append(moneyRow("Remaining", remaining, ""));

  const owing = Object.keys(byPerson).filter(function (k) {
    return byPerson[k].left > 0;
  });
  if (owing.length > 0) {
    const head = document.createElement("div");
    head.className = "sub-title";
    head.textContent = "Still owed to you";
    box.append(head);
    owing.forEach(function (k) {
      box.append(moneyRow(byPerson[k].name, byPerson[k].left, ""));
    });
  } else {
    const done = document.createElement("div");
    done.className = "sub-title";
    done.textContent = "Everyone has paid you back ✓";
    box.append(done);
  }
}

function renderMoneyList() {
  const list = document.getElementById("moneyList");
  if (!list) return;
  list.innerHTML = "";

  const dayNet = {};
  money.forEach(function (m) {
    if (m.pay === "loan") return;
    dayNet[m.date] = (dayNet[m.date] || 0) + (m.type === "income" ? m.amount : -m.amount);
  });

  const sorted = money.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date) || b.id - a.id;
  });

  let lastDate = null;
  sorted.forEach(function (m) {
    if (m.date !== lastDate) {
      lastDate = m.date;
      const head = document.createElement("div");
      head.className = "day-head";
      const dateText = document.createElement("span");
      dateText.textContent = parseDate(m.date).toLocaleDateString(undefined, {
        weekday: "short", day: "numeric", month: "short", year: "numeric"
      });
      const net = document.createElement("span");
      const n = dayNet[m.date] || 0;
      net.textContent = (n >= 0 ? "+" : "-") + fmt(Math.abs(n));
      head.append(dateText, net);
      list.append(head);
    }

    const card = document.createElement("div");
    card.className = "task pay-" + m.pay;

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("strong");
    title.textContent = m.title;
    const when = document.createElement("div");
    when.className = "when";
    when.textContent = m.cat + " · " + payLabel(m);

    const amount = document.createElement("div");
    if (m.pay === "loan") {
      amount.textContent = "Lent: " + fmt(m.amount);
    } else {
      amount.className = m.type === "income" ? "plus" : "minus";
      amount.textContent = (m.type === "income" ? "+" : "-") + fmt(m.amount);
    }
    const idr = document.createElement("div");
    idr.className = "idr";
    idr.textContent = "≈ " + fmtIDR(m.amount);
    info.append(title, when, amount, idr);

    const left = Math.max(0, m.amount - (m.paid || 0));
    if (m.pay === "loan") {
      const paid = document.createElement("div");
      paid.className = "when";
      paid.textContent = "Paid back: " + fmt(m.paid || 0);
      const rem = document.createElement("div");
      rem.className = left > 0 ? "minus" : "plus";
      rem.textContent = left > 0 ? "Remaining: " + fmt(left) : "Fully paid back ✓";
      info.append(paid, rem);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const edit = document.createElement("button");
    edit.className = "small-btn";
    edit.textContent = "Edit";
    edit.onclick = function () { startEdit(m); };
    actions.append(edit);

    if (m.pay === "loan" && left > 0) {
      const repayBtn = document.createElement("button");
      repayBtn.className = "small-btn";
      repayBtn.textContent = "Repay";
      repayBtn.onclick = function () { repay(m); };
      actions.append(repayBtn);
    }

    actions.append(makeDelete(function () {
      if (!confirm("Delete this entry?")) return;
      money = money.filter(function (x) { return x !== m; });
      saveAll();
      renderAll();
    }));

    card.append(info, actions);
    list.append(card);
  });
}

function repay(m) {
  const left = m.amount - (m.paid || 0);
  const answer = prompt(
    "How much did " + m.person + " pay back? (in VND)\nStill owed: " + fmt(left)
  );
  if (answer === null) return;
  const x = parseFloat(answer);
  if (!x || x <= 0) return;
  m.paid = Math.min(m.amount, (m.paid || 0) + x);
  saveAll();
  renderAll();
}

function updatePayFields() {
  const payInput = document.getElementById("moneyPay");
  const personInput = document.getElementById("moneyPerson");
  const typeInput = document.getElementById("moneyType");
  if (!payInput || !personInput || !typeInput) return;
  const isLoan = payInput.value === "loan";
  personInput.classList.toggle("hidden", !isLoan);
  typeInput.classList.toggle("hidden", isLoan);
}

document.querySelectorAll(".pay-option").forEach(function (btn) {
  btn.onclick = function () {
    document.querySelectorAll(".pay-option").forEach(function (b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    const payInput = document.getElementById("moneyPay");
    if (payInput) payInput.value = btn.dataset.value;
    updatePayFields();
  };
});

function resetMoneyForm() {
  editingId = null;
  const mTitle = document.getElementById("moneyTitle");
  const mAmount = document.getElementById("moneyAmount");
  const mPay = document.getElementById("moneyPay");
  const mPerson = document.getElementById("moneyPerson");
  const mType = document.getElementById("moneyType");
  const mDate = document.getElementById("moneyDate");
  const addBtn = document.getElementById("addMoney");
  const cancelBtn = document.getElementById("cancelMoney");

  if (mTitle) mTitle.value = "";
  if (mAmount) mAmount.value = "";
  document.querySelectorAll(".pay-option").forEach(function (b) {
    b.classList.toggle("active", b.dataset.value === "cash");
  });
  if (mPay) mPay.value = "cash";
  if (mPerson) mPerson.value = "";
  if (mType) mType.value = "expense";
  if (mDate) mDate.value = todayStr();
  if (addBtn) addBtn.textContent = "Add";
  if (cancelBtn) cancelBtn.classList.add("hidden");
  updatePayFields();
}

function startEdit(m) {
  editingId = m.id;
  document.getElementById("moneyTitle").value = m.title;
  document.getElementById("moneyAmount").value = m.amount;
  document.querySelectorAll(".pay-option").forEach(function (b) {
    b.classList.toggle("active", b.dataset.value === m.pay);
  });
  document.getElementById("moneyPay").value = m.pay;
  document.getElementById("moneyPerson").value = m.person || "";
  document.getElementById("moneyType").value = m.type;
  document.getElementById("moneyCat").value = m.cat;
  document.getElementById("moneyDate").value = m.date;
  document.getElementById("addMoney").textContent = "Save changes";
  document.getElementById("cancelMoney").classList.remove("hidden");
  updatePayFields();
  document.getElementById("moneyForm").scrollIntoView({ behavior: "smooth" });
}

const cancelMoneyBtn = document.getElementById("cancelMoney");
if (cancelMoneyBtn) cancelMoneyBtn.onclick = resetMoneyForm;

const addMoneyBtn = document.getElementById("addMoney");
if (addMoneyBtn) {
  addMoneyBtn.onclick = function () {
    const amount = parseFloat(document.getElementById("moneyAmount").value);
    const pay = document.getElementById("moneyPay").value;
    const person = document.getElementById("moneyPerson").value.trim();
    const cat = document.getElementById("moneyCat").value;
    const type = document.getElementById("moneyType").value;
    const title = document.getElementById("moneyTitle").value.trim();
    const date = document.getElementById("moneyDate").value || todayStr();

    if (!amount || amount <= 0) {
      alert("Please enter an amount above 0.");
      return;
    }
    if (pay === "loan" && !person) {
      alert("Please write who this loan is to.");
      return;
    }

    const finalTitle = title || (pay === "loan" ? "Loan" : cat);

    if (editingId) {
      const m = money.find(function (x) { return x.id === editingId; });
      if (m) {
        m.title = finalTitle;
        m.amount = amount;
        m.type = type;
        m.cat = cat;
        m.date = date;
        m.pay = pay;
        m.person = pay === "loan" ? person : "";
        m.paid = pay === "loan" ? Math.min(m.paid || 0, amount) : 0;
      }
    } else {
      money.push({
        id: Date.now(),
        title: finalTitle,
        amount: amount,
        type: type,
        cat: cat,
        date: date,
        pay: pay,
        person: pay === "loan" ? person : "",
        paid: 0
      });
    }

    saveAll();
    resetMoneyForm();
    renderAll();
  };
}

/* ---------- Countdown ---------- */
function updateTimes() {
  document.querySelectorAll(".left").forEach(function (left) {
    if (left.dataset.done === "true") {
      left.textContent = "Done ✓";
      return;
    }
    const diff = new Date(left.dataset.due) - new Date();
    if (diff <= 0) {
      left.textContent = "Overdue";
      return;
    }
    const mins = Math.floor(diff / 60000);
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    left.textContent = d + "d " + h + "h " + m + "m left";
  });
}

function renderBalance() {
  let cash = 0;
  let cashless = 0;

  money.forEach(function (m) {
    if (m.pay === "loan") return;
    const amount = m.type === "income" ? m.amount : -m.amount;
    if (m.pay === "cashless") {
      cashless += amount;
    } else {
      cash += amount;
    }
  });

  const box = document.getElementById("balanceBox");
  if (!box) return;
  box.innerHTML = "";
  box.append(
    moneyRow("Cash", cash, cash >= 0 ? "plus" : "minus"),
    moneyRow("Cashless", cashless, cashless >= 0 ? "plus" : "minus"),
    moneyRow("Total", cash + cashless, cash + cashless >= 0 ? "plus" : "minus")
  );
}

/* ---------- Calendar & Reminders ---------- */
function renderCalendar() {
  const grid = document.getElementById("calGrid");
  if (!grid) return;
  grid.innerHTML = "";
  document.getElementById("calTitle").textContent = new Date(calYear, calMonth, 1)
    .toLocaleDateString(undefined, { month: "long", year: "numeric" });

  ["M", "T", "W", "T", "F", "S", "S"].forEach(function (d) {
    const h = document.createElement("div");
    h.className = "cal-dow";
    h.textContent = d;
    grid.append(h);
  });

  const offset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) {
    grid.append(document.createElement("div"));
  }

  const days = new Date(calYear, calMonth + 1, 0).getDate();
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let d = 1; d <= days; d++) {
    const key = ymd(calYear, calMonth, d);
    const dayTasks = tasks
      .filter(function (t) { return t.due.slice(0, 10) === key; })
      .sort(function (a, b) { return a.due.localeCompare(b.due); });
    const open = dayTasks.filter(function (t) { return !t.done; });
    const diff = Math.round((new Date(calYear, calMonth, d) - todayMid) / 86400000);

    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (diff === 0) cell.classList.add("today");
    if (key === selectedDay) cell.classList.add("selected");
    if (open.length > 0) {
      let heat = "heat-4";
      if (diff < 0) heat = "heat-past";
      else if (diff === 0) heat = "heat-0";
      else if (diff === 1) heat = "heat-1";
      else if (diff <= 3) heat = "heat-2";
      else if (diff <= 7) heat = "heat-3";
      cell.classList.add(heat);
    }

    const top = document.createElement("div");
    top.className = "cal-top";
    const num = document.createElement("span");
    num.textContent = d;
    const mark = document.createElement("span");
    mark.className = open.length > 0 ? "cal-mark warn" : "cal-mark ok";
    mark.textContent = open.length > 0 ? "!" : dayTasks.length > 0 ? "✓" : "";
    top.append(num, mark);
    cell.append(top);

    dayTasks.slice(0, 2).forEach(function (t, i) {
      const s = document.createElement("div");
      s.className = "sticky s" + (i % 3) + (t.done ? " done" : "");
      s.textContent = t.title;
      cell.append(s);
    });
    if (dayTasks.length > 2) {
      const more = document.createElement("div");
      more.className = "cal-more";
      more.textContent = "+" + (dayTasks.length - 2);
      cell.append(more);
    }

    cell.onclick = function () {
      selectedDay = key;
      renderCalendar();
      document.getElementById("dayPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    grid.append(cell);
  }

  renderDayPanel();
}

function renderDayPanel() {
  const gridEl = document.getElementById("calGrid");
  if (!gridEl) return;
  const card = gridEl.parentElement;
  let panel = document.getElementById("dayPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "dayPanel";
    panel.className = "card day-panel";
    card.after(panel);
  }
  panel.innerHTML = "";
  panel.classList.toggle("hidden", !selectedDay);
  if (!selectedDay) return;

  const head = document.createElement("div");
  head.className = "cal-head";
  const title = document.createElement("h3");
  title.textContent = parseDate(selectedDay).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long"
  });
  const close = makeDelete(function () {
    selectedDay = null;
    renderCalendar();
  });
  head.append(title, close);
  panel.append(head);

  const dayTasks = tasks
    .filter(function (t) { return t.due.slice(0, 10) === selectedDay; })
    .sort(function (a, b) { return a.due.localeCompare(b.due); });

  if (dayTasks.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "Nothing scheduled yet.";
    panel.append(empty);
  }

  dayTasks.forEach(function (t, i) {
    const row = document.createElement("div");
    row.className = "note-row s" + (i % 3) + (t.done ? " done" : "");

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = t.done;
    box.onchange = function () {
      t.done = box.checked;
      saveAll();
      renderAll();
    };

    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("strong");
    name.textContent = t.due.slice(11, 16) + "  " + t.title;
    info.append(name);
    if (t.notes) {
      const n = document.createElement("div");
      n.className = "notes";
      n.textContent = t.notes;
      info.append(n);
    }

    const del = makeDelete(function () {
      if (!confirm("Delete this schedule?")) return;
      tasks = tasks.filter(function (x) { return x !== t; });
      saveAll();
      renderAll();
    });

    row.append(box, info, del);
    panel.append(row);
  });

  const form = document.createElement("div");
  form.className = "form day-form";
  const fTitle = document.createElement("input");
  fTitle.placeholder = "Add a schedule to this day";
  const fTime = document.createElement("input");
  fTime.type = "time";
  fTime.value = "09:00";
  const fNotes = document.createElement("textarea");
  fNotes.placeholder = "Notes";
  const add = document.createElement("button");
  add.textContent = "Add to this day";
  add.onclick = function () {
    const text = fTitle.value.trim();
    if (!text || !fTime.value) {
      alert("Please enter a title and a time.");
      return;
    }
    tasks.push({ title: text, due: selectedDay + "T" + fTime.value, notes: fNotes.value, done: false });
    saveAll();
    renderAll();
  };
  form.append(fTitle, fTime, fNotes, add);
  panel.append(form);
}

function renderReminder() {
  const now = new Date();
  const limit = new Date(now.getTime() + 3 * 86400000);
  const soon = tasks
    .filter(function (t) {
      const due = new Date(t.due);
      return !t.done && due >= now && due <= limit;
    })
    .sort(function (a, b) { return new Date(a.due) - new Date(b.due); });

  ["page-home", "page-schedule"].forEach(function (id) {
    const page = document.getElementById(id);
    if (!page) return;
    let box = page.querySelector(".reminder");
    if (!box) {
      box = document.createElement("div");
      box.className = "reminder";
      page.prepend(box);
    }
    box.innerHTML = "";
    box.classList.toggle("hidden", soon.length === 0);
    if (soon.length === 0) return;

    const head = document.createElement("strong");
    head.textContent = "⏰ Coming up in the next 3 days";
    box.append(head);
    soon.forEach(function (t) {
      const line = document.createElement("div");
      line.textContent = t.title + " · " + new Date(t.due).toLocaleString(undefined, {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit"
      });
      box.append(line);
    });
  });
}

const calPrevBtn = document.getElementById("calPrev");
if (calPrevBtn) {
  calPrevBtn.onclick = function () {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  };
}
const calNextBtn = document.getElementById("calNext");
if (calNextBtn) {
  calNextBtn.onclick = function () {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  };
}

/* Combined Render Trigger */
function renderAll() {
  renderHome();
  renderSchedule();
  renderNotes();
  renderTodos();
  renderMoney();
  renderBalance();
  renderCalendar();
  renderReminder();
  updateTimes();
}

resetMoneyForm();
setInterval(updateTimes, 1000);
setInterval(updateLiveClock, 1000);
updateLiveClock();
renderAll();
fetchRate();
