let records = [];

// localStorage keys
const STORAGE_KEY = "work_time_tracker_records";
const SETTINGS_KEY = "work_time_tracker_settings";

/* =========================
   Helpers
========================= */
function to2(n) {
  return (Number(n) || 0).toFixed(2);
}

function clampMinutes(val) {
  let m = parseInt(val) || 0;
  if (m < 0) m = 0;
  if (m > 59) m = 59;
  return m;
}

function normalizeRecordTypes(arr) {
  arr.forEach(r => {
    r.worked = Number(r.worked) || 0;
    r.allocated = Number(r.allocated) || 0;
    r.balance = Number(r.balance) || 0;
    r.cargoLate = Number(r.cargoLate) || 0;

    if (typeof r.date !== "string") r.date = String(r.date || "");
    if (typeof r.start !== "string") r.start = String(r.start || "");
    if (typeof r.end !== "string") r.end = String(r.end || "");
  });
}

function sortRecords() {
  records.sort((a, b) => b.date.localeCompare(a.date));
}

function dedupeByDateKeepLast() {
  const m = new Map();
  for (const r of records) m.set(r.date, r);
  records = Array.from(m.values());
}

function sortDedupeNormalizeDisplay() {
  normalizeRecordTypes(records);
  dedupeByDateKeepLast();
  sortRecords();
  refreshLists();
  saveToLocalStorage();
}

/* =========================
   Records localStorage
========================= */
function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn("Could not save records to localStorage", err);
  }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return;

    records = parsed;
    sortDedupeNormalizeDisplay();
  } catch (err) {
    console.warn("Could not load records from localStorage", err);
  }
}

function clearLocalRecords() {
  const ok = confirm("Are you sure you want to delete all saved records?");
  if (!ok) return;

  records = [];
  localStorage.removeItem(STORAGE_KEY);
  refreshLists();

  document.getElementById("workedHours").innerText = "0.00";
  document.getElementById("workPay").innerText = "0.00";
  document.getElementById("overtTime").innerText = "0.00";
  document.getElementById("overTimePay").innerText = "0.00";
  document.getElementById("nightTimePay").innerText = "0.00";
  document.getElementById("cargoLateTimeTotal").innerText = "0.00";
  document.getElementById("cargoLatePay").innerText = "0.00";
  document.getElementById("totalPay").innerText = "0.00";
}

/* =========================
   Settings localStorage
========================= */
function saveSettingsToLocalStorage() {
  const hourlyRate = parseFloat(document.getElementById("hourlyRate")?.value) || 0;
  const overtimeMultiplier = parseFloat(document.getElementById("overtimeMultiplier")?.value) || 1;
  const nightPayRate = parseFloat(document.getElementById("nightPayRate")?.value) || 0;

  const settings = { hourlyRate, overtimeMultiplier, nightPayRate };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("Could not save settings to localStorage", err);
  }
}

function loadSettingsFromLocalStorage() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return;

    const settings = JSON.parse(saved);

    if (settings.hourlyRate != null)
      document.getElementById("hourlyRate").value = settings.hourlyRate;

    if (settings.overtimeMultiplier != null)
      document.getElementById("overtimeMultiplier").value = settings.overtimeMultiplier;

    if (settings.nightPayRate != null)
      document.getElementById("nightPayRate").value = settings.nightPayRate;
  } catch (err) {
    console.warn("Could not load settings from localStorage", err);
  }
}

/* =========================
   Convert hours+minutes -> decimal
========================= */
function updateAllocatedDecimal() {
  const h = parseInt(document.getElementById("allocHours").value) || 0;
  const m = clampMinutes(document.getElementById("allocMinutes").value);
  document.getElementById("allocMinutes").value = m;

  document.getElementById("allocated").value = h + (m / 60);
  calculateDailyHours();
}

function updateCargoDecimal() {
  const h = parseInt(document.getElementById("cargoHours").value) || 0;
  const m = clampMinutes(document.getElementById("cargoMinutes").value);
  document.getElementById("cargoMinutes").value = m;

  document.getElementById("cargoLate").value = h + (m / 60);
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

  let diff = (endDate - startDate) / (1000 * 60 * 60);
  if (diff < 0) diff += 24;

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

/* =========================
   Listeners
========================= */
document.getElementById("start").addEventListener("change", calculateDailyHours);
document.getElementById("end").addEventListener("change", calculateDailyHours);

document.getElementById("allocHours").addEventListener("input", updateAllocatedDecimal);
document.getElementById("allocMinutes").addEventListener("input", updateAllocatedDecimal);

document.getElementById("cargoHours").addEventListener("input", updateCargoDecimal);
document.getElementById("cargoMinutes").addEventListener("input", updateCargoDecimal);

// ✅ settings listeners
document.getElementById("hourlyRate").addEventListener("input", saveSettingsToLocalStorage);
document.getElementById("overtimeMultiplier").addEventListener("input", saveSettingsToLocalStorage);
document.getElementById("nightPayRate").addEventListener("input", saveSettingsToLocalStorage);

/* =========================
   Save / Load record into form
========================= */
function loadRecordIntoForm(record) {
  document.getElementById("date").value = record.date;
  document.getElementById("start").value = record.start;
  document.getElementById("end").value = record.end;

  // allocated
  document.getElementById("allocated").value = record.allocated;
  const ah = Math.floor(record.allocated || 0);
  const am = Math.round(((record.allocated || 0) - ah) * 60);
  document.getElementById("allocHours").value = ah;
  document.getElementById("allocMinutes").value = am;

  // cargo late
  document.getElementById("cargoLate").value = record.cargoLate || 0;
  const ch = Math.floor(record.cargoLate || 0);
  const cm = Math.round(((record.cargoLate || 0) - ch) * 60);
  document.getElementById("cargoHours").value = ch;
  document.getElementById("cargoMinutes").value = cm;

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
  const cargoLate = parseFloat(document.getElementById("cargoLate").value) || 0;

  if (!date || !start || !end) {
    alert("Please fill in date, start, and end time!");
    return;
  }

  const record = { date, start, end, worked, allocated, balance, cargoLate };

  records = records.filter(r => r.date !== date);
  records.push(record);

  sortDedupeNormalizeDisplay();
}

/* =========================
   Display lists
========================= */
function refreshLists() {
  const list = document.getElementById("recordsList");
  list.innerHTML = "";

  records.forEach(r => {
    const div = document.createElement("div");
    div.className = "record";
    div.textContent =
      `${r.date} | ${r.start}-${r.end} | Worked: ${to2(r.worked)}h | Allocated: ${to2(r.allocated)}h | Balance: ${to2(r.balance)}h | Cargo Late: ${to2(r.cargoLate)}h`;
    div.onclick = () => loadRecordIntoForm(r);
    list.appendChild(div);
  });

  document.getElementById("calcRecordsList").innerHTML = list.innerHTML;
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
    } catch {
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
  for (let i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";

  const tablinks = document.getElementsByClassName("tablinks");
  for (let i = 0; i < tablinks.length; i++)
    tablinks[i].className = tablinks[i].className.replace(" active", "");

  document.getElementById(openTabId).style.display = "block";
  evt.currentTarget.className += " active";
}

/* =========================
   Weekly Calculation
========================= */
function CalculateWorkTime() {
  const startDate = document.getElementById("startWeekDate").value;
  const endDate = document.getElementById("endWeekDate").value;

  if (!startDate || !endDate) return alert("Please select start and end dates!");
  if (endDate < startDate) return alert("End Date must be on or after Start Date.");

  const hourlyRate = parseFloat(document.getElementById("hourlyRate").value) || 0;
  const overtimeMultiplier = parseFloat(document.getElementById("overtimeMultiplier").value) || 1;
  const nightPayPerHour = parseFloat(document.getElementById("nightPayRate").value) || 0;

  saveSettingsToLocalStorage();

  let totalWorked = 0, totalOvertime = 0, totalCargoLate = 0;

  for (const r of records) {
    if (r.date >= startDate && r.date <= endDate) {
      totalWorked += Number(r.worked) || 0;
      totalOvertime += Number(r.balance) || 0;
      totalCargoLate += Number(r.cargoLate) || 0;
    }
  }

  const normalHours = totalWorked - totalOvertime;

  const workPay = normalHours * hourlyRate;
  const overTimePay = totalOvertime * hourlyRate * overtimeMultiplier;
  const nightTimePay = normalHours * nightPayPerHour;
  const cargoLatePay = totalCargoLate * hourlyRate;

  const totalPay = workPay + overTimePay + nightTimePay + cargoLatePay;

  document.getElementById("workedHours").innerText = to2(normalHours);
  document.getElementById("workPay").innerText = to2(workPay);

  document.getElementById("overtTime").innerText = to2(totalOvertime);
  document.getElementById("overTimePay").innerText = to2(overTimePay);

  document.getElementById("nightTimePay").innerText = to2(nightTimePay);

  document.getElementById("cargoLateTimeTotal").innerText = to2(totalCargoLate);
  document.getElementById("cargoLatePay").innerText = to2(cargoLatePay);

  document.getElementById("totalPay").innerText = to2(totalPay);
}

/* =========================
   Init
========================= */
document.getElementById("defaultOpen").click();
loadFromLocalStorage();
loadSettingsFromLocalStorage();
