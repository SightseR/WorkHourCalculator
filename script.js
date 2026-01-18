let records = [];

/* =========================
   Helpers
========================= */
function to2(n) {
  return (Number(n) || 0).toFixed(2);
}

function normalizeRecordTypes(arr) {
  arr.forEach(r => {
    r.worked = Number(r.worked) || 0;
    r.allocated = Number(r.allocated) || 0;
    r.balance = Number(r.balance) || 0;

    if (typeof r.date !== "string") r.date = String(r.date || "");
    if (typeof r.start !== "string") r.start = String(r.start || "");
    if (typeof r.end !== "string") r.end = String(r.end || "");
  });
}

function sortRecords() {
  // newest first (works because YYYY-MM-DD)
  records.sort((a, b) => b.date.localeCompare(a.date));
}

function dedupeByDateKeepLast() {
  // keep last record per date
  const m = new Map();
  for (const r of records) m.set(r.date, r);
  records = Array.from(m.values());
}

function sortDedupeNormalizeDisplay() {
  normalizeRecordTypes(records);
  dedupeByDateKeepLast();
  sortRecords();
  refreshLists();
}

/* =========================
   Daily calculation logic
========================= */
function calculateDailyHours() {
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;
  const allocated = parseFloat(document.getElementById("allocated").value) || 0;

  if (!start || !end) return;

  const startDate = new Date("1970-01-01T" + start + ":00");
  const endDate = new Date("1970-01-01T" + end + ":00");

  let diff = (endDate - startDate) / (1000 * 60 * 60); // hours
  if (diff < 0) diff += 24; // overnight shift

  // Rule:
  // if allocated > worked => worked = allocated, balance = 0
  // else worked = diff, balance = diff - allocated
  let worked, balance;

  if (allocated > diff) {
    worked = allocated;
    balance = 0;
  } else {
    worked = diff;
    balance = diff - allocated;
  }

  document.getElementById("worked").innerText = to2(worked);
  document.getElementById("balance").innerText = to2(balance);
}

// Live calculation events
document.getElementById("start").addEventListener("change", calculateDailyHours);
document.getElementById("end").addEventListener("change", calculateDailyHours);
document.getElementById("allocated").addEventListener("input", calculateDailyHours);

/* =========================
   Save / Load record into form
========================= */
function loadRecordIntoForm(record) {
  document.getElementById("date").value = record.date;
  document.getElementById("start").value = record.start;
  document.getElementById("end").value = record.end;
  document.getElementById("allocated").value = record.allocated;

  document.getElementById("worked").innerText = to2(record.worked);
  document.getElementById("balance").innerText = to2(record.balance);
}

function saveRecord() {
  const date = document.getElementById("date").value;
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;

  const worked = parseFloat(document.getElementById("worked").innerText) || 0;
  const allocated = parseFloat(document.getElementById("allocated").value) || 0;
  const balance = parseFloat(document.getElementById("balance").innerText) || 0;

  if (!date || !start || !end) {
    alert("Please fill in date, start, and end time!");
    return;
  }

  const record = { date, start, end, worked, allocated, balance };

  // overwrite record for same date
  records = records.filter(r => r.date !== date);
  records.push(record);

  sortDedupeNormalizeDisplay();
}

/* =========================
   Display lists
========================= */
function refreshLists() {
  // Enter tab
  const list = document.getElementById("recordsList");
  list.innerHTML = "";

  records.forEach(r => {
    const div = document.createElement("div");
    div.className = "record";
    div.style.cursor = "pointer";

    div.textContent =
      `${r.date} | ${r.start}-${r.end} | Worked: ${to2(r.worked)}h | Allocated: ${to2(r.allocated)}h | Balance: ${to2(r.balance)}h`;

    div.onclick = () => loadRecordIntoForm(r);

    list.appendChild(div);
  });

  // Calculate tab (mirror view, no click needed)
  const calcList = document.getElementById("calcRecordsList");
  calcList.innerHTML = list.innerHTML;
}

/* =========================
   File save/load
========================= */
function downloadFile() {
  sortDedupeNormalizeDisplay();

  const text = JSON.stringify(records, null, 2);
  const blob = new Blob([text], { type: "text/plain" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "records.txt";
  link.click();
}

function loadFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const loaded = JSON.parse(e.target.result);

      if (!Array.isArray(loaded)) throw new Error("Not an array");

      records = loaded;
      sortDedupeNormalizeDisplay();
    } catch (err) {
      alert("Invalid file format!");
    }
  };

  reader.readAsText(file);
}

/* =========================
   Tabs
========================= */
function openTab(evt, openTabId) {
  const tabcontent = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  const tablinks = document.getElementsByClassName("tablinks");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  document.getElementById(openTabId).style.display = "block";
  evt.currentTarget.className += " active";
}

/* =========================
   Weekly Calculation (Tab 2)
========================= */
function CalculateWorkTime() {
  const startDate = document.getElementById("startWeekDate").value;
  const endDate = document.getElementById("endWeekDate").value;

  if (!startDate || !endDate) {
    alert("Please select start and end dates!");
    return;
  }
  if (endDate < startDate) {
    alert("End Date must be on or after Start Date.");
    return;
  }

  let totalWorked = 0;
  let totalOvertime = 0;

  for (const r of records) {
    if (r.date >= startDate && r.date <= endDate) {
      totalWorked += Number(r.worked) || 0;
      totalOvertime += Number(r.balance) || 0;
    }
  }

  // ✅ Work hours WITHOUT overtime
  const normalHours = totalWorked - totalOvertime;

  // Pay rules
  const hourlyRate = 11.21;
  const overtimeRate = hourlyRate * 1.2;
  const nightPayPerHour = 1.28;

  const workPay = normalHours * hourlyRate;
  const overTimePay = totalOvertime * overtimeRate;
  const nightTimePay = normalHours * nightPayPerHour;

  const totalPay = workPay + overTimePay + nightTimePay;

  document.getElementById("workedHours").innerText = to2(normalHours);
  document.getElementById("overtTime").innerText = to2(totalOvertime);

  document.getElementById("workPay").innerText = to2(workPay);
  document.getElementById("overTimePay").innerText = to2(overTimePay);
  document.getElementById("nightTimePay").innerText = to2(nightTimePay);
  document.getElementById("totalPay").innerText = to2(totalPay);
}

/* =========================
   Init
========================= */
document.getElementById("defaultOpen").click();