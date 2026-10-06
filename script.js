const FALLBACK_RATE = 0.68; // 1 VND is about 0.68 IDR

let rate = parseFloat(localStorage.getItem("vndIdrRate")) || FALLBACK_RATE;
let rateStatus = localStorage.getItem("vndIdrRate") ? "saved rate" : "default rate";

let tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
let notes = JSON.parse(localStorage.getItem("notes") || "[]");
let todos = JSON.parse(localStorage.getItem("todos") || "[]");
let money = JSON.parse(localStorage.getItem("money") || "[]");
let editingId = null;

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
    .catch(function () {
      /* no internet or blocked: keep the saved or default rate */
    });
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

/* ---------- Home ---------- */
function renderHome() {
  document.getElementById("today").textContent = new Date().toLocaleDateString(
    undefined,
    { weekday: "long", month: "long", day: "numeric" }
  );

  const next = document.getElementById("next");
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

  const doneTasks = tasks.filter(function (t) { return t.done; }).length;
  const doneTodos = todos.filter(function (t) { return t.done; }).length;
  document.getElementById("stats").textContent =
    "Schedule: " + doneTasks + " of " + tasks.length + " done  |  " +
    "To-do: " + doneTodos + " of " + todos.length + " done";
}

/* ---------- Schedule ---------- */
function renderSchedule() {
  const list = document.getElementById("list");
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

document.getElementById("addTask").onclick = function () {
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

/* ---------- Notes ---------- */
function renderNotes() {
  const list = document.getElementById("noteList");
  list.innerHTML = "";

  notes.slice().reverse().forEach(function (n) {
    const card = document.createElement("div");
    card.className = "task";

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("strong");
    title.textContent = n.title;
    const text = document.createElement("div");
    text.className = "notes";
    text.textContent = n.text;
    info.append(title, text);

    const del = makeDelete(function () {
      notes = notes.filter(function (x) { return x !== n; });
      saveAll();
      renderAll();
    });

    card.append(info, del);
    list.append(card);
  });
}

document.getElementById("addNote").onclick = function () {
  const title = document.getElementById("noteTitle").value.trim();
  const text = document.getElementById("noteText").value;
  if (!title && !text.trim()) {
    alert("Write a title or some text first.");
    return;
  }
  notes.push({ title: title || "Untitled", text: text });
  saveAll();
  renderAll();
  document.getElementById("noteTitle").value = "";
  document.getElementById("noteText").value = "";
};

/* ---------- To-do ---------- */
function renderTodos() {
  const list = document.getElementById("todoList");
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

document.getElementById("addTodo").onclick = function () {
  const text = document.getElementById("todoText").value.trim();
  if (!text) return;
  todos.push({ text: text, done: false });
  saveAll();
  renderAll();
  document.getElementById("todoText").value = "";
};

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
  return m.pay === "cashless" ? "Cashless" : "Cash";
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

  const bars = document.getElementById("moneyBars");
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

  renderLoans();
  renderMoneyList();
}

function renderLoans() {
  const box = document.getElementById("loanSummary");
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
  const isLoan = document.getElementById("moneyPay").value === "loan";
  document.getElementById("moneyPerson").classList.toggle("hidden", !isLoan);
  document.getElementById("moneyType").classList.toggle("hidden", isLoan);
}
document.getElementById("moneyPay").onchange = updatePayFields;

function resetMoneyForm() {
  editingId = null;
  document.getElementById("moneyTitle").value = "";
  document.getElementById("moneyAmount").value = "";
  document.getElementById("moneyPay").value = "cash";
  document.getElementById("moneyPerson").value = "";
  document.getElementById("moneyType").value = "expense";
  document.getElementById("moneyDate").value = todayStr();
  document.getElementById("addMoney").textContent = "Add";
  document.getElementById("cancelMoney").classList.add("hidden");
  updatePayFields();
}

function startEdit(m) {
  editingId = m.id;
  document.getElementById("moneyTitle").value = m.title;
  document.getElementById("moneyAmount").value = m.amount;
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

document.getElementById("cancelMoney").onclick = resetMoneyForm;

document.getElementById("addMoney").onclick = function () {
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

function renderAll() {
  renderHome();
  renderSchedule();
  renderNotes();
  renderTodos();
  renderMoney();
  updateTimes();
}

resetMoneyForm();
setInterval(updateTimes, 1000);
renderAll();
fetchRate();
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
  box.innerHTML = "";
  box.append(
    moneyRow("Cash", cash, cash >= 0 ? "plus" : "minus"),
    moneyRow("Cashless", cashless, cashless >= 0 ? "plus" : "minus"),
    moneyRow("Total", cash + cashless, cash + cashless >= 0 ? "plus" : "minus")
  );
}

/* make the page redraw the wallet every time it redraws everything else */
const oldRenderAll = renderAll;
renderAll = function () {
  oldRenderAll();
  renderBalance();
};
renderBalance();


