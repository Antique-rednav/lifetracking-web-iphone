/* Dashboard Pribadi — app.js
   Dibangun dari dashboard lama. Data lama (goals:*, finance_v1, goal_streak_v1)
   otomatis diimpor sekali ke format baru; kunci lama tidak dihapus. */
(function () {
'use strict';

/* =========================================================
   Util
   ========================================================= */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);

const DOW_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MON_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MON_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function toDateString(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseDate(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateString(d); }
const DAY_BOUNDARY_HOUR = 6;
function activeDate() { const d = new Date(); if (d.getHours() < DAY_BOUNDARY_HOUR) d.setDate(d.getDate() - 1); return toDateString(d); }
function tomorrowDate() { return addDays(activeDate(), 1); }
function calendarToday() { return toDateString(new Date()); }
function fmtDate(s) { const d = parseDate(s); return DOW_ID[d.getDay()] + ', ' + d.getDate() + ' ' + MON_ID[d.getMonth()]; }
function fmtDayShort(s) { return DOW_ID[parseDate(s).getDay()]; }
function fmtMonth(ym) { const p = ym.split('-').map(Number); return MON_LONG[p[1] - 1] + ' ' + p[0]; }
function fmtMonthShort(ym) { const p = ym.split('-').map(Number); return MON_ID[p[1] - 1]; }
function shiftMonth(ym, n) { const p = ym.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
function daysInMonth(ym) { const p = ym.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); }
function timeToMin(t) { const p = String(t || '0:0').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }

function fmtNum(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function idr(n) { return (n < 0 ? '−' : '') + 'Rp ' + fmtNum(n); }
function idrShort(n) {
  const a = Math.abs(n), sg = n < 0 ? '−' : '';
  if (a >= 1e9) return sg + (a / 1e9).toFixed(1).replace('.', ',') + ' M';
  if (a >= 1e6) return sg + (a / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + ' jt';
  if (a >= 1e3) return sg + Math.round(a / 1e3) + ' rb';
  return sg + Math.round(a);
}
function fmtDur(hours) {
  const m = Math.max(0, Math.floor(hours * 60));
  return Math.floor(m / 60) + 'j ' + pad(m % 60) + 'm';
}

/* =========================================================
   Konstanta
   ========================================================= */
const KEY = 'lt_state_v2';
const SECRETS_KEY = 'lt_secrets_v1';
const PREV_KEY = 'lt_prev_backup_v1';
const EXPENSE_CATS = ['Makan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'];
const INCOME_CATS = ['Gaji', 'Freelance', 'Uang saku', 'Hadiah', 'Investasi', 'Lainnya'];
const CAT_MAP = { Food: 'Makan', Transport: 'Transportasi', Shopping: 'Belanja', Bills: 'Tagihan', Entertainment: 'Hiburan', Health: 'Kesehatan', Education: 'Pendidikan', Other: 'Lainnya', Salary: 'Gaji', Allowance: 'Uang saku', Gift: 'Hadiah', Investment: 'Investasi' };
const NOTIF_TYPES = [
  { id: 'morning', label: 'Mulai hari', desc: 'Ringkasan goal dan kebiasaan hari ini', time: '08:00' },
  { id: 'bills', label: 'Tagihan besok', desc: 'Transaksi berulang yang jatuh tempo besok', time: '09:00' },
  { id: 'weekly', label: 'Review mingguan', desc: 'Setiap hari Minggu', time: '18:00' },
  { id: 'expense', label: 'Catat pengeluaran', desc: 'Jika hari ini belum ada catatan uang', time: '20:30' },
  { id: 'plan', label: 'Rencanakan besok', desc: 'Jika rencana besok masih kosong', time: '21:00' },
  { id: 'streak', label: 'Streak terancam', desc: 'Jika masih ada goal belum selesai', time: '21:30' },
  { id: 'bed', label: 'Waktunya tidur', desc: 'Pengingat bersiap tidur', time: '23:00' },
  { id: 'budget', label: 'Anggaran hampir habis', desc: 'Saat kategori mencapai 80% dan 100%', time: null }
];
const THEMES = [
  { id: 'sunrise', label: 'Sunrise', a: '#FF9A62', b: '#E25D7A' },
  { id: 'ocean', label: 'Ocean', a: '#5CC8FF', b: '#6F7CFF' },
  { id: 'forest', label: 'Forest', a: '#6BE3A4', b: '#2FB5A3' },
  { id: 'violet', label: 'Violet', a: '#C49BFF', b: '#FF7BC4' }
];
const WAKE_DEFAULT = 8, SLEEP_DEFAULT = 24;

/* =========================================================
   State
   ========================================================= */
function defaultNotif() {
  const o = {};
  NOTIF_TYPES.forEach(t => { o[t.id] = { on: true, time: t.time }; });
  return o;
}

function defaultState() {
  return {
    v: 2, updatedAt: 0,
    goals: {},            // { 'YYYY-MM-DD': [{id,text,done,doneAt,focus,prio,time,rolled}] }
    habits: [],           // [{id,name,createdAt}]
    habitLog: {},         // { 'YYYY-MM-DD': [habitId] }
    tx: [],               // [{id,type,amount,category,wallet,toWallet,note,date,createdAt}]
    wallets: [{ id: 'w1', name: 'Utama', opening: 0 }],
    budgets: {},          // { Kategori: batasBulanan }
    recurring: [],        // [{id,type,amount,category,wallet,note,day,lastApplied}]
    savings: [],          // [{id,name,target,saved}]
    daily: {},            // { 'YYYY-MM-DD': {sleepStart,wake,energy,water,workout,gratitude} }
    streak: { count: 0, last: null },
    settings: {
      name: 'Jan Ivander Pinasthika',
      wakeHour: WAKE_DEFAULT, sleepHour: SLEEP_DEFAULT, waterTarget: 8,
      theme: 'sunrise', autoSync: true, lastWallet: 'w1', dismiss: {},
      notif: defaultNotif()
    }
  };
}

function ensureShape(st) {
  const d = defaultState();
  Object.keys(d).forEach(k => { if (st[k] == null) st[k] = d[k]; });
  st.settings = Object.assign({}, d.settings, st.settings || {});
  st.settings.notif = Object.assign({}, d.settings.notif, st.settings.notif || {});
  NOTIF_TYPES.forEach(t => { st.settings.notif[t.id] = Object.assign({}, d.settings.notif[t.id], st.settings.notif[t.id] || {}); });
  if (!Array.isArray(st.wallets) || !st.wallets.length) st.wallets = d.wallets;
  return st;
}

function migrateOld(st) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('goals:') !== 0) continue;
      const date = k.slice(6);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      let arr = null;
      try { arr = JSON.parse(localStorage.getItem(k)); } catch (e) { arr = null; }
      if (!Array.isArray(arr)) continue;
      st.goals[date] = arr.filter(g => g && g.text).map(g => ({
        id: uid(), text: String(g.text), done: !!g.done, doneAt: g.doneAt || undefined,
        focus: !!g.queued, prio: 'mid', time: ''
      }));
    }
    let fin = null;
    try { fin = JSON.parse(localStorage.getItem('finance_v1') || 'null'); } catch (e) { fin = null; }
    if (Array.isArray(fin)) {
      st.tx = fin.filter(t => t && Number(t.amount) > 0).map(t => ({
        id: t.id || uid(), type: t.type === 'income' ? 'income' : 'expense',
        amount: Number(t.amount) || 0, category: CAT_MAP[t.category] || t.category || 'Lainnya',
        wallet: 'w1', note: t.note || '', date: t.date || calendarToday(), createdAt: t.createdAt || Date.now()
      }));
    }
    let sk = null;
    try { sk = JSON.parse(localStorage.getItem('goal_streak_v1') || 'null'); } catch (e) { sk = null; }
    if (sk) st.streak = { count: Number(sk.count) || 0, last: sk.lastProcessedDate || null };
    st.migratedFromV1 = true;
  } catch (e) { console.warn('Migrasi data lama gagal', e); }
}

function loadState() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
  if (raw && raw.v === 2) return ensureShape(raw);
  const st = defaultState();
  migrateOld(st);
  // Perangkat baru yang kosong harus berstatus "lama" (0) agar tidak menimpa data di Sheets.
  st.updatedAt = (st.tx.length || Object.keys(st.goals).length) ? Date.now() : 0;
  return st;
}

function getSecrets() { try { return JSON.parse(localStorage.getItem(SECRETS_KEY)) || {}; } catch (e) { return {}; } }
function setSecrets(o) { try { localStorage.setItem(SECRETS_KEY, JSON.stringify(o)); } catch (e) {} }

let S = loadState();
const ui = {
  tab: 'home', moneyTab: 'ringkasan', moreTab: 'review', month: calendarToday().slice(0, 7),
  sheet: null, editGoal: null, editTx: null, sync: { state: 'off', at: 0, msg: '' },
  push: { supported: false, permission: 'default', subscribed: false, standalone: false, ios: false, busy: false, msg: '' },
  focusId: null
};
const drafts = {};

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Gagal menyimpan: penyimpanan perangkat penuh.', 'error'); }
}
function save() {
  S.updatedAt = Date.now();
  persist();
  scheduleSync();
  scheduleSummary();
}

/* =========================================================
   Turunan data
   ========================================================= */
function goalsOf(date) { return S.goals[date] || (S.goals[date] = []); }
function goalsPeek(date) { return S.goals[date] || []; }

function sortGoals(list) {
  const w = { high: 0, mid: 1, low: 2 };
  return list.map((g, i) => ({ g, i })).sort((a, b) => {
    if (!!a.g.done !== !!b.g.done) return a.g.done ? 1 : -1;
    if (!!a.g.focus !== !!b.g.focus) return a.g.focus ? -1 : 1;
    const pa = w[a.g.prio || 'mid'], pb = w[b.g.prio || 'mid'];
    if (pa !== pb) return pa - pb;
    const ta = a.g.time || '99:99', tb = b.g.time || '99:99';
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.i - b.i;
  }).map(x => x.g);
}

function habitDone(hid, date) { return (S.habitLog[date] || []).indexOf(hid) !== -1; }
function habitStreak(hid) {
  let d = activeDate();
  if (!habitDone(hid, d)) d = addDays(d, -1);
  let n = 0;
  while (habitDone(hid, d) && n < 3650) { n++; d = addDays(d, -1); }
  return n;
}
function habitExistsOn(h, date) { return toDateString(new Date(h.createdAt || 0)) <= date; }

function walletName(id) { const w = S.wallets.find(x => x.id === id); return w ? w.name : '—'; }
function walletBalance(w) {
  let b = Number(w.opening) || 0;
  S.tx.forEach(t => {
    if (t.type === 'income' && t.wallet === w.id) b += t.amount;
    else if (t.type === 'expense' && t.wallet === w.id) b -= t.amount;
    else if (t.type === 'transfer') {
      if (t.wallet === w.id) b -= t.amount;
      if (t.toWallet === w.id) b += t.amount;
    }
  });
  return b;
}
function totalBalance() { return sum(S.wallets, walletBalance); }
function txOfMonth(ym) { return S.tx.filter(t => (t.date || '').slice(0, 7) === ym); }
function monthTotals(ym) {
  const m = txOfMonth(ym);
  return {
    income: sum(m.filter(t => t.type === 'income'), t => t.amount),
    expense: sum(m.filter(t => t.type === 'expense'), t => t.amount)
  };
}
function expenseByCat(ym) {
  const by = {};
  txOfMonth(ym).filter(t => t.type === 'expense').forEach(t => { by[t.category] = (by[t.category] || 0) + t.amount; });
  return by;
}
function txSorted(list) {
  return list.slice().sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
}
function budgetStatus(ym) {
  const by = expenseByCat(ym);
  return Object.keys(S.budgets).filter(c => S.budgets[c] > 0).map(c => {
    const spent = by[c] || 0, limit = S.budgets[c];
    return { cat: c, spent, limit, pct: Math.round(spent / limit * 100) };
  }).sort((a, b) => b.pct - a.pct);
}

function sleepHours(rec) {
  if (!rec || !rec.sleepStart || !rec.wake) return null;
  let d = timeToMin(rec.wake) - timeToMin(rec.sleepStart);
  if (d <= 0) d += 1440;
  return d / 60;
}
function dailyOf(date) { return S.daily[date] || (S.daily[date] = {}); }

/* ----- Streak + rollover (sekali saat buka) ----- */
function runStreakCheck() {
  const active = activeDate();
  let count = Number(S.streak.count) || 0, last = S.streak.last || null;
  const dates = Object.keys(S.goals).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < active && (!last || d > last)).sort();
  dates.forEach(d => {
    const gs = S.goals[d];
    if (gs.length) { if (gs.every(g => g.done)) count += 1; else count = 0; }
    last = d;
  });
  if (dates.length) S.streak = { count: count, last: last };
}

function runRollover() {
  const active = activeDate();
  const today = goalsOf(active);
  const have = new Set(today.map(g => g.text));
  let changed = false;
  Object.keys(S.goals).filter(d => d < active).sort().forEach(d => {
    S.goals[d].forEach(g => {
      if (!g.done && !g.rolled && g.text) {
        g.rolled = true; changed = true;
        if (!have.has(g.text)) {
          today.push({ id: uid(), text: g.text, done: false, focus: g.focus || false, prio: g.prio || 'mid', time: g.time || '' });
          have.add(g.text);
        }
      }
    });
  });
  if (changed) persist();
}

/* ----- Transaksi berulang ----- */
function applyRecurring() {
  const now = new Date(), today = toDateString(now), curYM = today.slice(0, 7);
  let changed = false;
  S.recurring.forEach(r => {
    let ym = r.lastApplied ? shiftMonth(r.lastApplied, 1) : curYM;
    let guard = 0;
    while (ym <= curYM && guard < 24) {
      const day = Math.min(r.day, daysInMonth(ym));
      const date = ym + '-' + pad(day);
      if (date > today) break;
      S.tx.push({
        id: uid(), type: r.type, amount: r.amount, category: r.category, wallet: r.wallet,
        note: (r.note ? r.note + ' ' : '') + '(berulang)', date: date, createdAt: Date.now() + guard, recurringId: r.id
      });
      r.lastApplied = ym; changed = true;
      ym = shiftMonth(ym, 1); guard++;
    }
  });
  if (changed) persist();
}

/* ----- Statistik mingguan ----- */
function weekStats(end) {
  const days = [], prev = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(end, -i));
  for (let i = 13; i >= 7; i--) prev.push(addDays(end, -i));
  let gT = 0, gD = 0, best = null;
  days.forEach(d => {
    const gs = goalsPeek(d).filter(g => !g.rolled);
    if (gs.length) {
      const done = gs.filter(g => g.done).length;
      gT += gs.length; gD += done;
      const p = done / gs.length;
      if (!best || p > best.p || (p === best.p && gs.length > best.n)) best = { d: d, p: p, n: gs.length };
    }
  });
  let hT = 0, hD = 0;
  days.forEach(d => {
    S.habits.forEach(h => {
      if (habitExistsOn(h, d)) { hT++; if (habitDone(h.id, d)) hD++; }
    });
  });
  const sl = days.map(d => sleepHours(S.daily[d])).filter(x => x != null);
  const en = days.map(d => (S.daily[d] || {}).energy).filter(x => x);
  const wt = days.map(d => (S.daily[d] || {}).water).filter(x => x != null && x > 0);
  const wk = days.filter(d => (S.daily[d] || {}).workout).length;
  const inRange = (t, arr) => arr.indexOf(t.date) !== -1;
  const spendNow = sum(S.tx.filter(t => t.type === 'expense' && inRange(t, days)), t => t.amount);
  const spendPrev = sum(S.tx.filter(t => t.type === 'expense' && inRange(t, prev)), t => t.amount);
  const incomeNow = sum(S.tx.filter(t => t.type === 'income' && inRange(t, days)), t => t.amount);
  const byCat = {};
  S.tx.filter(t => t.type === 'expense' && inRange(t, days)).forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
  const topCat = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0] || null;
  const avg = a => a.length ? sum(a) / a.length : null;
  return {
    days: days, goalsTotal: gT, goalsDone: gD, goalsPct: gT ? Math.round(gD / gT * 100) : null, best: best,
    habitsTotal: hT, habitsDone: hD, habitsPct: hT ? Math.round(hD / hT * 100) : null,
    sleepAvg: avg(sl), sleepDays: sl.length, energyAvg: avg(en), waterAvg: avg(wt), workoutDays: wk,
    spendNow: spendNow, spendPrev: spendPrev, incomeNow: incomeNow, topCat: topCat, topCatAmt: topCat ? byCat[topCat] : 0
  };
}

function weekInsights(w) {
  const out = [];
  if (w.goalsPct != null) {
    if (w.goalsPct >= 80) out.push('Goal minggu ini kuat: ' + w.goalsPct + '% selesai.');
    else if (w.goalsPct < 50) out.push('Hanya ' + w.goalsPct + '% goal selesai. Coba kurangi jumlah goal harian jadi 3 yang paling penting.');
    else out.push(w.goalsPct + '% goal selesai. Satu dorongan kecil lagi menuju 80%.');
  }
  if (w.spendPrev > 0 && w.spendNow > 0) {
    const ch = Math.round((w.spendNow - w.spendPrev) / w.spendPrev * 100);
    if (ch >= 20) out.push('Pengeluaran naik ' + ch + '% dari minggu lalu' + (w.topCat ? ', terbesar di ' + w.topCat + '.' : '.'));
    else if (ch <= -20) out.push('Pengeluaran turun ' + Math.abs(ch) + '% dari minggu lalu.');
  } else if (w.spendNow > 0 && w.topCat) {
    out.push('Pengeluaran terbesar minggu ini: ' + w.topCat + ' (' + idr(w.topCatAmt) + ').');
  }
  if (w.sleepAvg != null) {
    if (w.sleepAvg < 6.5) out.push('Rata-rata tidur ' + fmtDur(w.sleepAvg) + ', di bawah 7 jam. Coba majukan jam tidur 30 menit.');
    else if (w.sleepAvg >= 7) out.push('Rata-rata tidur ' + fmtDur(w.sleepAvg) + ': cukup baik.');
  }
  if (w.workoutDays === 0 && w.sleepDays + (w.energyAvg ? 1 : 0) > 0) out.push('Belum ada catatan olahraga minggu ini.');
  if (!out.length) out.push('Belum cukup data minggu ini. Isi goal, catatan uang, dan log harian agar review lebih berguna.');
  return out.slice(0, 4);
}

/* ----- Warna matahari untuk ring ----- */
const SUN_STOPS = [
  [0, [255, 216, 158]], [12.5, [255, 205, 121]], [25, [255, 227, 143]], [37.5, [255, 183, 106]],
  [50, [255, 149, 89]], [62.5, [243, 111, 79]], [75, [226, 93, 122]], [87.5, [123, 91, 176]], [100, [47, 58, 102]]
];
function sunColor(pct) {
  const p = clamp(pct, 0, 100);
  for (let i = 0; i < SUN_STOPS.length - 1; i++) {
    const a = SUN_STOPS[i], b = SUN_STOPS[i + 1];
    if (p >= a[0] && p <= b[0]) {
      const t = (p - a[0]) / (b[0] - a[0]);
      const c = a[1].map((v, j) => Math.round(v + (b[1][j] - v) * t));
      return 'rgb(' + c.join(', ') + ')';
    }
  }
  return 'rgb(47, 58, 102)';
}
const RING_C = 2 * Math.PI * 52;
function formatClock(d) {
  let h = d.getHours();
  const m = pad(d.getMinutes());
  return pad(h) + ':' + m;
}
function ringState() {
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const wake = Number(S.settings.wakeHour), sleepH = Number(S.settings.sleepHour);
  const span = Math.max(1, sleepH - wake);
  const r = { clock: formatClock(now), hours: pad(wake % 24) + ':00 – ' + pad(sleepH % 24) + ':00' };
  if (hours < wake) {
    return Object.assign(r, { color: '#5A5853', offset: RING_C, pct: '—', phase: 'ISTIRAHAT', status: 'Masih waktu istirahat', rem: fmtDur(wake - hours) + ' lagi sampai bangun' });
  }
  if (hours >= sleepH) {
    return Object.assign(r, { color: '#E25D7A', offset: 0, pct: '100%', phase: 'LEWAT TIDUR', status: 'Sudah lewat jam tidur', rem: 'Waktunya istirahat' });
  }
  const percent = (hours - wake) / span * 100;
  let phase, status;
  if (percent < 25) { phase = 'PAGI'; status = 'Pagi — awal yang segar'; }
  else if (percent < 50) { phase = 'SIANG'; status = 'Siang — jaga ritme'; }
  else if (percent < 75) { phase = 'SORE'; status = 'Sore — dorong sampai selesai'; }
  else if (percent < 90) { phase = 'MALAM'; status = 'Malam — mulai rapikan hari'; }
  else { phase = 'MENJELANG TIDUR'; status = 'Sebentar lagi waktu tidur'; }
  return Object.assign(r, { color: sunColor(percent), offset: RING_C * (1 - percent / 100), pct: Math.floor(percent) + '%', phase: phase, status: status, rem: fmtDur(sleepH - hours) + ' waktu aktif tersisa' });
}

/* =========================================================
   Util tampilan
   ========================================================= */
function ic(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>'; }
function dv(id, def) { return esc(drafts[id] != null ? drafts[id] : (def != null ? def : '')); }
function opts(list, current, labelFn) {
  return list.map(v => {
    const val = typeof v === 'object' ? v.v : v, lab = typeof v === 'object' ? v.l : (labelFn ? labelFn(v) : v);
    return '<option value="' + esc(val) + '"' + (String(val) === String(current) ? ' selected' : '') + '>' + esc(lab) + '</option>';
  }).join('');
}
function card(cls, inner) { return '<section class="card ' + (cls || '') + '">' + inner + '</section>'; }
function cardHead(title, right) { return '<div class="card-head"><h2>' + title + '</h2>' + (right || '') + '</div>'; }
function emptyBox(text) { return '<div class="empty">' + esc(text) + '</div>'; }

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}

function syncMeta() {
  const s = ui.sync;
  if (!getSecrets().sheetsUrl) return { cls: 'off', label: 'Sheets belum terhubung' };
  if (s.state === 'syncing') return { cls: 'busy', label: 'Menyinkronkan…' };
  if (s.state === 'error') return { cls: 'err', label: 'Sinkron gagal: ' + (s.msg || '') };
  if (s.state === 'ok') return { cls: 'ok', label: 'Tersinkron ' + formatClock(new Date(s.at)) };
  return { cls: 'idle', label: 'Siap sinkron' };
}

function renderTopbar() {
  const first = String(S.settings.name || '').trim().split(/\s+/)[0] || '';
  const sm = syncMeta();
  $('#topbar').innerHTML =
    '<div><div class="eyebrow">' + esc(fmtDate(activeDate())) + '</div>' +
    '<h1 class="hello">' + greeting() + (first ? ', ' + esc(first) : '') + '</h1></div>' +
    '<div class="top-right">' +
    '<span class="chip streak' + (S.streak.count > 0 ? ' on' : '') + '" title="Streak harian">' + ic('zap') + '<b>' + S.streak.count + '</b><span>hari</span></span>' +
    '<button class="icon-btn sync-btn ' + sm.cls + '" data-act="tab" data-tab="more" data-sub="settings" aria-label="' + esc(sm.label) + '" title="' + esc(sm.label) + '">' + ic('cloud') + '<i class="dot"></i></button>' +
    '</div>';
}

const TABS = [
  { id: 'home', label: 'Beranda', icon: 'home' },
  { id: 'tasks', label: 'Tugas', icon: 'tasks' },
  { id: 'money', label: 'Uang', icon: 'wallet' },
  { id: 'life', label: 'Hidup', icon: 'heart' },
  { id: 'more', label: 'Lainnya', icon: 'grid' }
];
function renderTabbar() {
  $('#tabbar').innerHTML = TABS.map(t =>
    '<button class="tab' + (ui.tab === t.id ? ' on' : '') + '" data-act="tab" data-tab="' + t.id + '"' + (ui.tab === t.id ? ' aria-current="page"' : '') + '>' +
    ic(t.icon) + '<span>' + t.label + '</span></button>').join('');
}

/* =========================================================
   Ticker
   ========================================================= */
let tickTimer = null, tickIdx = 0;
function tickItems() {
  const gs = goalsPeek(activeDate());
  if (!gs.length) return [{ status: 'empty', text: 'Belum ada goal hari ini — tambah satu untuk mulai.' }];
  const p = gs.filter(g => !g.done);
  if (!p.length) return [{ status: 'done', text: 'Semua goal selesai — hari yang solid.' }];
  return sortGoals(p).map(g => ({ status: 'pending', text: g.text }));
}
function tickRow(it, extra) {
  return '<div class="tick-row' + (extra ? ' ' + extra : '') + '"><span class="tick-st" data-st="' + it.status + '">' +
    (it.status === 'done' ? '✓' : it.status === 'pending' ? '○' : '·') + '</span><span class="tick-tx">' + esc(it.text) + '</span></div>';
}
function startTicker() {
  clearInterval(tickTimer);
  const stage = $('#tickStage');
  if (!stage) return;
  const items = tickItems();
  stage.innerHTML = tickRow(items[tickIdx % items.length]);
  if (items.length < 2) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  tickTimer = setInterval(() => {
    const st = $('#tickStage');
    if (!st) { clearInterval(tickTimer); return; }
    tickIdx++;
    const it = tickItems();
    const old = st.firstElementChild;
    if (old) { old.classList.add('leave'); setTimeout(() => { if (old.parentNode) old.parentNode.removeChild(old); }, 420); }
    st.insertAdjacentHTML('beforeend', tickRow(it[tickIdx % it.length], 'enter'));
  }, 4500);
}

function updateRing() {
  if (ui.tab !== 'home') return;
  const rs = ringState();
  const f = $('#rFill');
  if (!f) return;
  f.style.stroke = rs.color;
  f.style.strokeDashoffset = rs.offset;
  $('#rPct').textContent = rs.pct;
  $('#rPhase').textContent = rs.phase;
  $('#rClock').textContent = rs.clock;
  $('#rStatus').textContent = rs.status;
  $('#rRem').textContent = rs.rem;
}

/* =========================================================
   Saran cerdas (nudge)
   ========================================================= */
function billsOn(date) {
  const dim = daysInMonth(date.slice(0, 7)), dd = Number(date.slice(8, 10));
  return S.recurring.filter(r => Math.min(r.day, dim) === dd && r.type === 'expense');
}
function buildNudges() {
  const out = [], h = new Date().getHours();
  if (h >= 18 && goalsPeek(tomorrowDate()).length === 0) {
    out.push({ kind: 'info', icon: 'moon', title: 'Rencanakan besok', body: 'Belum ada rencana untuk besok. Tulis 2–3 hal terpenting.', act: 'tab', attrs: 'data-tab="tasks"', cta: 'Rencanakan' });
  }
  if (h >= 19 && !S.tx.some(t => t.date === calendarToday())) {
    out.push({ kind: 'info', icon: 'wallet', title: 'Belum ada catatan uang', body: 'Catat pengeluaran hari ini sebelum lupa.', act: 'openTx', cta: 'Catat' });
  }
  budgetStatus(calendarToday().slice(0, 7)).filter(b => b.pct >= 80).slice(0, 2).forEach(b => {
    out.push({ kind: b.pct >= 100 ? 'danger' : 'warn', icon: 'target', title: 'Anggaran ' + b.cat + ' ' + b.pct + '%', body: idr(b.spent) + ' dari ' + idr(b.limit), act: 'tab', attrs: 'data-tab="money"', cta: 'Lihat' });
  });
  const bt = billsOn(addDays(calendarToday(), 1));
  if (bt.length) out.push({ kind: 'info', icon: 'repeat', title: 'Besok jatuh tempo', body: bt.map(r => (r.note || r.category) + ' ' + idr(r.amount)).join(', ') });
  if (!getSecrets().sheetsUrl && !S.settings.dismiss.sheets) {
    out.push({ kind: 'tip', icon: 'cloud', title: 'Amankan data Anda', body: 'Hubungkan Google Sheets agar data tidak hilang dan tersinkron antar perangkat.', act: 'tab', attrs: 'data-tab="more" data-sub="settings"', cta: 'Hubungkan', dismiss: 'sheets' });
  }
  if (ui.push.supported && !ui.push.subscribed && !S.settings.dismiss.push) {
    out.push({ kind: 'tip', icon: 'bell', title: 'Aktifkan pengingat', body: 'Dapat notifikasi untuk rencana besok, catatan uang, dan streak.', act: 'tab', attrs: 'data-tab="more" data-sub="settings"', cta: 'Atur', dismiss: 'push' });
  }
  return out.slice(0, 3);
}
function nudgeHtml(list) {
  if (!list.length) return '';
  return '<div class="nudges">' + list.map(n =>
    '<div class="nudge ' + n.kind + '"><div class="nudge-ic">' + ic(n.icon) + '</div>' +
    '<div class="nudge-text"><b>' + esc(n.title) + '</b><span>' + esc(n.body) + '</span></div>' +
    (n.act ? '<button class="btn sm" data-act="' + n.act + '" ' + (n.attrs || '') + '>' + esc(n.cta) + '</button>' : '') +
    (n.dismiss ? '<button class="icon-btn sm" data-act="dismiss" data-key="' + n.dismiss + '" aria-label="Tutup saran">' + ic('x') + '</button>' : '') +
    '</div>').join('') + '</div>';
}

/* =========================================================
   Komponen kecil
   ========================================================= */
function goalRow(g, date, locked, compact) {
  if (ui.editGoal && ui.editGoal.id === g.id) {
    return '<li class="goal editing"><input id="editGoalText" class="input" data-draft data-enter="goalEditSave" value="' + dv('editGoalText') + '" aria-label="Ubah goal">' +
      '<button class="btn sm primary" data-act="goalEditSave">Simpan</button><button class="btn sm" data-act="goalEditCancel">Batal</button></li>';
  }
  const lab = { high: 'Tinggi', mid: 'Sedang', low: 'Rendah' };
  const meta = (g.prio && g.prio !== 'mid' ? '<span class="pill prio-' + g.prio + '">' + lab[g.prio] + '</span>' : '') + (g.time ? '<span class="pill">' + ic('clock') + esc(g.time) + '</span>' : '');
  const dis = locked ? ' disabled' : '';
  const at = ' data-date="' + date + '" data-id="' + g.id + '"';
  return '<li class="goal' + (g.done ? ' is-done' : '') + (g.focus && !locked ? ' is-focus' : '') + '">' +
    '<label class="chk"><input type="checkbox" data-act="goalToggle"' + at + (g.done ? ' checked' : '') + dis + ' aria-label="Selesai: ' + esc(g.text) + '"><span class="chk-box">' + ic('check') + '</span></label>' +
    '<div class="goal-main"><span class="goal-text">' + esc(g.text) + '</span>' + (meta ? '<div class="goal-meta">' + meta + '</div>' : '') + '</div>' +
    (compact ? '' :
      '<div class="goal-actions">' +
      '<button class="icon-btn' + (g.focus && !locked ? ' on' : '') + '" data-act="goalFocus"' + at + dis + ' aria-pressed="' + !!g.focus + '" aria-label="Tandai fokus" title="Fokus">' + ic('zap') + '</button>' +
      '<button class="icon-btn" data-act="goalEdit"' + at + ' aria-label="Ubah goal" title="Ubah">' + ic('edit') + '</button>' +
      '<button class="icon-btn danger" data-act="goalDel"' + at + ' aria-label="Hapus goal" title="Hapus">' + ic('trash') + '</button></div>') +
    '</li>';
}

function segBar(goals) {
  if (!goals.length) return '';
  return '<div class="segbar" aria-hidden="true">' + goals.map(g => '<i class="' + (g.done ? 'on' : '') + '"></i>').join('') + '</div>';
}

function addForm(p, which, placeholder) {
  return '<div class="add-form">' +
    '<input id="' + p + 'Input" class="input" data-draft data-enter="goalAdd" data-which="' + which + '" placeholder="' + placeholder + '" autocomplete="off" value="' + dv(p + 'Input') + '" aria-label="' + placeholder + '">' +
    '<div class="add-opts">' +
    '<select id="' + p + 'Prio" class="input sm" data-draft aria-label="Prioritas">' + opts([{ v: 'mid', l: 'Sedang' }, { v: 'high', l: 'Tinggi' }, { v: 'low', l: 'Rendah' }], drafts[p + 'Prio'] || 'mid') + '</select>' +
    '<input id="' + p + 'Time" type="time" class="input sm" data-draft value="' + dv(p + 'Time') + '" aria-label="Jam target (opsional)">' +
    '<button class="btn primary" data-act="goalAdd" data-which="' + which + '">' + ic('plus') + 'Tambah</button>' +
    '<button class="btn" data-act="goalPolish" data-which="' + which + '" title="Rapikan kalimat dengan AI">' + ic('star') + 'Rapikan</button>' +
    '</div><div class="status" id="status-' + which + '" role="status"></div></div>';
}

function waterDrops(n, target) {
  let s = '';
  const total = Math.max(target, n);
  for (let i = 0; i < total; i++) s += '<i class="drop' + (i < n ? ' on' : '') + '"></i>';
  return '<div class="drops" aria-hidden="true">' + s + '</div>';
}
function energyButtons(cur) {
  const lab = ['Habis', 'Rendah', 'Cukup', 'Baik', 'Prima'];
  let s = '';
  for (let i = 1; i <= 5; i++) {
    s += '<button class="energy-btn' + (cur === i ? ' on' : '') + '" data-act="energySet" data-v="' + i + '" aria-pressed="' + (cur === i) + '" aria-label="Energi ' + i + ' dari 5, ' + lab[i - 1] + '"><b>' + i + '</b><span>' + lab[i - 1] + '</span></button>';
  }
  return '<div class="energy">' + s + '</div>';
}

/* =========================================================
   View: Beranda
   ========================================================= */
function viewHome() {
  const d = activeDate();
  const goals = sortGoals(goalsPeek(d));
  const gdone = goals.filter(g => g.done).length;
  const rs = ringState();
  const hdone = S.habits.filter(h => habitDone(h.id, d)).length;
  const dr = S.daily[d] || {};
  const water = dr.water || 0, wt = Number(S.settings.waterTarget) || 8;
  const ym = calendarToday().slice(0, 7);
  const tot = monthTotals(ym), net = tot.income - tot.expense;
  const pending = goals.filter(g => !g.done).slice(0, 3);
  const slp = sleepHours(dr);

  const hero = card('hero',
    '<div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><filter id="ringGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    '<circle class="ring-track" cx="60" cy="60" r="52"/>' +
    '<circle class="ring-fill" id="rFill" cx="60" cy="60" r="52" transform="rotate(-90 60 60)" filter="url(#ringGlow)" style="stroke:' + rs.color + ';stroke-dasharray:' + RING_C + ';stroke-dashoffset:' + rs.offset + '"/></svg>' +
    '<div class="ring-center"><div class="ring-pct" id="rPct">' + rs.pct + '</div><div class="ring-phase" id="rPhase">' + rs.phase + '</div><div class="ring-clock" id="rClock">' + rs.clock + '</div></div></div>' +
    '<div class="hero-info"><div class="hero-status" id="rStatus">' + esc(rs.status) + '</div><div class="hero-rem" id="rRem">' + esc(rs.rem) + '</div>' +
    '<div class="hero-hours">' + rs.hours + '</div>' +
    '<div class="hero-stats">' +
    '<div class="mini"><b>' + gdone + '/' + goals.length + '</b><span>Goal</span></div>' +
    '<div class="mini"><b>' + hdone + '/' + S.habits.length + '</b><span>Kebiasaan</span></div>' +
    '<div class="mini"><b>' + water + '/' + wt + '</b><span>Air</span></div></div></div>');

  const ticker = '<div class="ticker" aria-live="polite"><span class="led"></span><span class="ticker-label">GOAL</span><div class="ticker-stage" id="tickStage"></div><span class="ticker-meta">' + gdone + '/' + goals.length + '</span></div>';

  const focus = card('',
    cardHead('Fokus hari ini', '<button class="link" data-act="tab" data-tab="tasks">Semua tugas ›</button>') +
    (pending.length ? '<ul class="goal-list">' + pending.map(g => goalRow(g, d, false, true)).join('') + '</ul>' :
      emptyBox(goals.length ? 'Semua goal selesai. Hari yang solid.' : 'Belum ada goal hari ini.')) +
    (goals.length === 0 ? '<button class="btn primary block" data-act="tab" data-tab="tasks">' + ic('plus') + 'Tambah goal</button>' : ''));

  const habits = S.habits.length ? card('',
    cardHead('Kebiasaan', '<span class="muted">' + hdone + '/' + S.habits.length + '</span>') +
    '<div class="habit-chips">' + S.habits.map(h => {
      const on = habitDone(h.id, d);
      return '<button class="habit-chip' + (on ? ' on' : '') + '" data-act="habitToggle" data-id="' + h.id + '" aria-pressed="' + on + '">' + ic(on ? 'check' : 'circle') + esc(h.name) + '</button>';
    }).join('') + '</div>') : '';

  const money = card('',
    cardHead('Uang', '<button class="link" data-act="tab" data-tab="money">Buka ›</button>') +
    '<div class="money-line"><div><span class="lbl">Saldo total</span><div class="big num' + (totalBalance() < 0 ? ' neg' : '') + '">' + idr(totalBalance()) + '</div></div>' +
    '<div class="right"><span class="lbl">Bersih bulan ini</span><div class="num ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '') + '">' + (net > 0 ? '+' : '') + idr(net) + '</div></div></div>' +
    '<div class="quick-add"><input id="qAmt" class="input" data-draft data-money data-enter="quickExpense" inputmode="numeric" placeholder="Jumlah (Rp)" autocomplete="off" value="' + dv('qAmt') + '" aria-label="Jumlah pengeluaran">' +
    '<select id="qCat" class="input" data-draft aria-label="Kategori">' + opts(EXPENSE_CATS, drafts.qCat || 'Makan') + '</select>' +
    '<button class="btn primary" data-act="quickExpense">Catat</button></div>' +
    '<button class="link left" data-act="openTx">Catat lengkap (pemasukan, transfer, tanggal) ›</button>');

  const life = card('',
    cardHead('Tubuh hari ini', '<button class="link" data-act="tab" data-tab="life">Log lengkap ›</button>') +
    '<div class="water-row"><button class="icon-btn lg" data-act="waterDec" aria-label="Kurangi satu gelas">' + ic('minus') + '</button>' +
    '<div class="water-mid">' + waterDrops(water, wt) + '<span class="muted">' + water + ' dari ' + wt + ' gelas</span></div>' +
    '<button class="icon-btn lg accent" data-act="waterInc" aria-label="Tambah satu gelas">' + ic('plus') + '</button></div>' +
    '<div class="sub-label">Energi sekarang</div>' + energyButtons(dr.energy || 0) +
    '<div class="muted small" style="margin-top:10px">' + (slp != null ? 'Tidur semalam: ' + fmtDur(slp) : 'Belum ada log tidur hari ini.') + '</div>');

  return '<div class="grid">' + hero + ticker + nudgeHtml(buildNudges()) + '<div class="col">' + focus + habits + '</div><div class="col">' + money + life + '</div></div>';
}

/* =========================================================
   View: Tugas
   ========================================================= */
function viewTasks() {
  const d = activeDate(), tm = tomorrowDate();
  const goals = sortGoals(goalsPeek(d));
  const done = goals.filter(g => g.done).length;
  const allDone = goals.length > 0 && done === goals.length;
  const tgoals = sortGoals(goalsPeek(tm));

  const today = card('goal-card' + (allDone ? ' all-done' : ''),
    '<div class="card-head"><div><div class="eyebrow">Hari ini · ' + esc(fmtDate(d)) + '</div>' +
    '<div class="progress-line"><span class="big">' + done + '</span><span class="of">/ ' + goals.length + '</span><span class="lbl">' + (goals.length === 0 ? 'belum ada goal' : allDone ? 'semua selesai' : 'selesai') + '</span></div></div>' +
    '<span class="chip streak' + (S.streak.count > 0 ? ' on' : '') + '">' + ic('zap') + '<b>' + S.streak.count + '</b><span>hari streak</span></span></div>' +
    segBar(goals) +
    (goals.length ? '<ul class="goal-list">' + goals.map(g => goalRow(g, d, false)).join('') + '</ul>' : emptyBox('Belum ada goal hari ini. Tambah satu di bawah.')) +
    (goals.some(g => !g.done) ? '<button class="btn dashed block" data-act="pushRemaining">Pindahkan yang belum selesai ke besok →</button>' : '') +
    addForm('goal', 'today', 'Tambah goal hari ini…'));

  const hab = card('',
    cardHead('Kebiasaan harian', '<span class="muted">Muncul otomatis setiap hari</span>') +
    (S.habits.length ? '<ul class="habit-list">' + S.habits.map(h => {
      const on = habitDone(h.id, d), st = habitStreak(h.id);
      let dots = '';
      for (let i = 6; i >= 0; i--) { const dd = addDays(d, -i); dots += '<i class="hdot' + (habitDone(h.id, dd) ? ' on' : '') + (habitExistsOn(h, dd) ? '' : ' na') + '" title="' + esc(fmtDate(dd)) + '"></i>'; }
      return '<li class="habit' + (on ? ' is-done' : '') + '"><label class="chk round"><input type="checkbox" data-act="habitToggle" data-id="' + h.id + '"' + (on ? ' checked' : '') + ' aria-label="Selesai: ' + esc(h.name) + '"><span class="chk-box">' + ic('check') + '</span></label>' +
        '<div class="goal-main"><span class="goal-text">' + esc(h.name) + '</span><div class="hdots" aria-label="7 hari terakhir">' + dots + '</div></div>' +
        '<span class="pill streak-pill" title="Streak kebiasaan">' + ic('zap') + st + ' hari</span>' +
        '<button class="icon-btn danger" data-act="habitDel" data-id="' + h.id + '" aria-label="Hapus kebiasaan ' + esc(h.name) + '">' + ic('trash') + '</button></li>';
    }).join('') + '</ul>' : emptyBox('Belum ada kebiasaan. Contoh: Olahraga, Baca 20 menit, Belajar.')) +
    '<div class="add-form"><div class="add-opts one"><input id="habitInput" class="input" data-draft data-enter="habitAdd" placeholder="Tambah kebiasaan baru…" autocomplete="off" value="' + dv('habitInput') + '" aria-label="Nama kebiasaan"><button class="btn primary" data-act="habitAdd">' + ic('plus') + 'Tambah</button></div></div>');

  const tomorrow = card('goal-card tomorrow',
    '<div class="card-head"><div><div class="eyebrow">Rencana besok · ' + esc(fmtDate(tm)) + '</div><div class="muted small">Tulis malam ini, aktif jam 06.00.</div></div><span class="muted">' + tgoals.length + ' rencana</span></div>' +
    (tgoals.length ? '<ul class="goal-list">' + tgoals.map(g => goalRow(g, tm, true)).join('') + '</ul>' : emptyBox('Belum ada rencana besok.')) +
    addForm('tm', 'tomorrow', 'Tambah rencana besok…'));

  return '<div class="grid"><div class="col">' + today + '</div><div class="col">' + hab + tomorrow + '</div></div>';
}

/* =========================================================
   View: Uang
   ========================================================= */
function txIcon(t) { return t.type === 'income' ? 'plus' : t.type === 'transfer' ? 'arrow' : 'minus'; }
function txRow(t) {
  const sign = t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '−';
  const title = t.type === 'transfer' ? 'Transfer' : t.category;
  const sub = t.type === 'transfer' ? walletName(t.wallet) + ' → ' + walletName(t.toWallet) : walletName(t.wallet);
  return '<li class="tx ' + t.type + '"><span class="tx-ic">' + ic(txIcon(t)) + '</span>' +
    '<div class="tx-main"><span class="tx-cat">' + esc(title) + '</span><span class="tx-note">' + esc(fmtDate(t.date)) + ' · ' + esc(sub) + (t.note ? ' · ' + esc(t.note) : '') + '</span></div>' +
    '<span class="tx-amt num">' + sign + idr(t.amount).replace('−', '') + '</span>' +
    '<button class="icon-btn" data-act="txEdit" data-id="' + t.id + '" aria-label="Ubah transaksi">' + ic('edit') + '</button>' +
    '<button class="icon-btn danger" data-act="txDel" data-id="' + t.id + '" aria-label="Hapus transaksi">' + ic('trash') + '</button></li>';
}

function trendChart(endYM) {
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(endYM, -i));
  const data = months.map(m => Object.assign({ m: m }, monthTotals(m)));
  const max = Math.max(1, ...data.map(x => Math.max(x.income, x.expense)));
  const desc = data.map(x => fmtMonthShort(x.m) + ': masuk ' + idr(x.income) + ', keluar ' + idr(x.expense)).join('; ');
  return '<div class="trend" role="img" aria-label="Grafik pemasukan dan pengeluaran 6 bulan. ' + esc(desc) + '">' +
    data.map(x => '<div class="trend-col' + (x.m === endYM ? ' cur' : '') + '"><div class="trend-bars">' +
      '<i class="bar inc" style="height:' + Math.round(x.income / max * 100) + '%" title="Masuk ' + esc(idr(x.income)) + '"></i>' +
      '<i class="bar exp" style="height:' + Math.round(x.expense / max * 100) + '%" title="Keluar ' + esc(idr(x.expense)) + '"></i></div>' +
      '<span class="trend-lbl">' + fmtMonthShort(x.m) + '</span><span class="trend-val">' + idrShort(x.expense) + '</span></div>').join('') +
    '</div><div class="legend"><span><i class="sw inc"></i>Pemasukan</span><span><i class="sw exp"></i>Pengeluaran (angka di bawah bulan)</span></div>';
}

function moneySummary() {
  const ym = ui.month;
  const tot = monthTotals(ym), net = tot.income - tot.expense;
  const by = expenseByCat(ym);
  const cats = Object.keys(by).sort((a, b) => by[b] - by[a]);
  const maxCat = cats.length ? by[cats[0]] : 1;
  const bal = totalBalance();

  const balance = card('balance-card',
    '<div class="eyebrow">Saldo total</div><div class="balance num' + (bal < 0 ? ' neg' : '') + '">' + idr(bal) + '</div>' +
    '<div class="wallet-scroll">' + S.wallets.map(w => '<button class="wallet-chip" data-act="walletEdit" data-id="' + w.id + '" aria-label="Ubah dompet ' + esc(w.name) + '"><span>' + esc(w.name) + '</span><b class="num">' + idr(walletBalance(w)) + '</b></button>').join('') +
    '<button class="wallet-chip add" data-act="walletNew">' + ic('plus') + 'Dompet</button></div>');

  const nav = '<div class="month-nav"><button class="icon-btn" data-act="monthPrev" aria-label="Bulan sebelumnya">' + ic('chevL') + '</button><span class="month-label">' + esc(fmtMonth(ym)) + '</span><button class="icon-btn" data-act="monthNext" aria-label="Bulan berikutnya">' + ic('chevR') + '</button></div>';

  const stats = '<div class="stat-row">' +
    '<div class="stat"><span class="lbl">Masuk</span><b class="num pos">' + idr(tot.income) + '</b></div>' +
    '<div class="stat"><span class="lbl">Keluar</span><b class="num neg">' + idr(tot.expense) + '</b></div>' +
    '<div class="stat"><span class="lbl">Bersih</span><b class="num ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '') + '">' + (net > 0 ? '+' : '') + idr(net) + '</b></div></div>';

  const catCard = card('',
    cardHead('Pengeluaran per kategori', '<button class="link" data-act="moneyTab" data-t="rencana">Atur anggaran ›</button>') +
    (cats.length ? cats.map(c => {
      const lim = S.budgets[c] > 0 ? S.budgets[c] : 0;
      const pct = lim ? Math.round(by[c] / lim * 100) : 0;
      const w = lim ? Math.min(100, pct) : Math.round(by[c] / maxCat * 100);
      const st = !lim ? '' : pct >= 100 ? ' over' : pct >= 80 ? ' warn' : '';
      return '<div class="cat-row"><div class="cat-top"><span class="cat-name">' + esc(c) + (tot.expense ? ' · ' + Math.round(by[c] / tot.expense * 100) + '%' : '') + '</span>' +
        '<span class="cat-amt num">' + idr(by[c]) + (lim ? ' / ' + idrShort(lim) : '') + '</span></div>' +
        '<div class="track' + st + '"><i style="width:' + w + '%"></i></div>' +
        (lim ? '<div class="cat-sub' + st + '">' + (pct >= 100 ? 'Melebihi anggaran ' + idr(by[c] - lim) : pct + '% dari anggaran' + (pct >= 80 ? ' — hampir habis' : '')) + '</div>' : '') + '</div>';
    }).join('') : emptyBox('Belum ada pengeluaran bulan ini.')));

  const trend = card('', cardHead('Tren 6 bulan') + trendChart(ym));
  return '<div class="grid">' + '<div class="col">' + balance + nav + stats + catCard + '</div><div class="col">' + trend + '</div></div>';
}

function moneyTxList() {
  const q = String(drafts.txSearch || '').toLowerCase().trim();
  let list = txSorted(txOfMonth(ui.month));
  if (q) list = list.filter(t => ((t.category || '') + ' ' + (t.note || '') + ' ' + walletName(t.wallet)).toLowerCase().indexOf(q) !== -1);
  const nav = '<div class="month-nav"><button class="icon-btn" data-act="monthPrev" aria-label="Bulan sebelumnya">' + ic('chevL') + '</button><span class="month-label">' + esc(fmtMonth(ui.month)) + '</span><button class="icon-btn" data-act="monthNext" aria-label="Bulan berikutnya">' + ic('chevR') + '</button></div>';
  return '<div class="grid one"><div class="col">' + nav +
    card('', '<input id="txSearch" class="input" data-draft data-live="txSearch" placeholder="Cari kategori, catatan, dompet…" value="' + dv('txSearch') + '" aria-label="Cari transaksi">' +
      '<div id="txListWrap">' + txListInner(list) + '</div>') + '</div></div>';
}
function txListInner(list) {
  return list.length ? '<ul class="tx-list">' + list.map(txRow).join('') + '</ul>' : emptyBox('Tidak ada transaksi.');
}

function moneyPlan() {
  const ym = calendarToday().slice(0, 7);
  const bs = budgetStatus(ym);
  const budgetCard = card('',
    cardHead('Anggaran bulanan', '<button class="btn sm primary" data-act="budgetNew">' + ic('plus') + 'Atur</button>') +
    (bs.length ? bs.map(b => {
      const st = b.pct >= 100 ? ' over' : b.pct >= 80 ? ' warn' : '';
      return '<button class="cat-row btn-row" data-act="budgetEdit" data-cat="' + esc(b.cat) + '"><div class="cat-top"><span class="cat-name">' + esc(b.cat) + '</span><span class="cat-amt num">' + idr(b.spent) + ' / ' + idr(b.limit) + '</span></div><div class="track' + st + '"><i style="width:' + Math.min(100, b.pct) + '%"></i></div><div class="cat-sub' + st + '">' + b.pct + '%' + (b.pct >= 100 ? ' — melebihi' : b.pct >= 80 ? ' — hampir habis' : '') + '</div></button>';
    }).join('') : emptyBox('Belum ada anggaran. Contoh: Makan Rp1.500.000 per bulan.')));

  const recCard = card('',
    cardHead('Transaksi berulang', '<button class="btn sm primary" data-act="recNew">' + ic('plus') + 'Tambah</button>') +
    (S.recurring.length ? '<ul class="tx-list">' + S.recurring.map(r =>
      '<li class="tx ' + r.type + '"><span class="tx-ic">' + ic('repeat') + '</span><div class="tx-main"><span class="tx-cat">' + esc(r.note || r.category) + '</span><span class="tx-note">Tiap tanggal ' + r.day + ' · ' + esc(r.category) + ' · ' + esc(walletName(r.wallet)) + '</span></div>' +
      '<span class="tx-amt num">' + (r.type === 'income' ? '+' : '−') + idr(r.amount).replace('−', '') + '</span>' +
      '<button class="icon-btn" data-act="recEdit" data-id="' + r.id + '" aria-label="Ubah">' + ic('edit') + '</button>' +
      '<button class="icon-btn danger" data-act="recDel" data-id="' + r.id + '" aria-label="Hapus">' + ic('trash') + '</button></li>').join('') + '</ul>'
      : emptyBox('Belum ada. Contoh: uang kos, langganan, gaji bulanan.')));

  const savCard = card('',
    cardHead('Target tabungan', '<button class="btn sm primary" data-act="savNew">' + ic('plus') + 'Target</button>') +
    (S.savings.length ? S.savings.map(s => {
      const pct = s.target > 0 ? Math.min(100, Math.round(s.saved / s.target * 100)) : 0;
      return '<div class="sav"><div class="cat-top"><span class="cat-name">' + esc(s.name) + '</span><span class="cat-amt num">' + idr(s.saved) + ' / ' + idr(s.target) + '</span></div>' +
        '<div class="track good"><i style="width:' + pct + '%"></i></div><div class="cat-sub">' + pct + '% tercapai' + (s.target > s.saved ? ' · kurang ' + idr(s.target - s.saved) : ' · tercapai') + '</div>' +
        '<div class="sav-act"><input id="sav-' + s.id + '" class="input sm" data-draft data-money data-enter="savDeposit" data-id="' + s.id + '" inputmode="numeric" placeholder="Setor (Rp)" value="' + dv('sav-' + s.id) + '" aria-label="Setoran untuk ' + esc(s.name) + '">' +
        '<button class="btn sm primary" data-act="savDeposit" data-id="' + s.id + '">Setor</button>' +
        '<button class="icon-btn" data-act="savEdit" data-id="' + s.id + '" aria-label="Ubah target">' + ic('edit') + '</button>' +
        '<button class="icon-btn danger" data-act="savDel" data-id="' + s.id + '" aria-label="Hapus target">' + ic('trash') + '</button></div></div>';
    }).join('') : emptyBox('Belum ada target. Contoh: Dana darurat, laptop baru.')));

  return '<div class="grid"><div class="col">' + budgetCard + recCard + '</div><div class="col">' + savCard + '</div></div>';
}

function viewMoney() {
  const seg = [{ id: 'ringkasan', l: 'Ringkasan' }, { id: 'transaksi', l: 'Transaksi' }, { id: 'rencana', l: 'Rencana' }];
  const body = ui.moneyTab === 'transaksi' ? moneyTxList() : ui.moneyTab === 'rencana' ? moneyPlan() : moneySummary();
  return '<div class="seg" role="tablist" aria-label="Bagian keuangan">' + seg.map(s =>
    '<button class="seg-btn' + (ui.moneyTab === s.id ? ' on' : '') + '" role="tab" aria-selected="' + (ui.moneyTab === s.id) + '" data-act="moneyTab" data-t="' + s.id + '">' + s.l + '</button>').join('') + '</div>' +
    body + '<button class="fab" data-act="openTx" aria-label="Catat transaksi">' + ic('plus') + '<span>Catat</span></button>';
}

/* =========================================================
   View: Hidup
   ========================================================= */
function lifeChart(days, valFn, max, fmt, cls, target) {
  return '<div class="wk-chart">' + days.map(d => {
    const v = valFn(d);
    const h = v == null ? 0 : Math.round(clamp(v / max, 0, 1) * 100);
    return '<div class="wk-col' + (d === activeDate() ? ' cur' : '') + '"><span class="wk-val">' + (v == null ? '—' : fmt(v)) + '</span><div class="wk-bar"><i class="' + cls + '" style="height:' + h + '%"></i>' + (target ? '<b class="wk-target" style="bottom:' + Math.round(target / max * 100) + '%"></b>' : '') + '</div><span class="wk-day">' + fmtDayShort(d) + '</span></div>';
  }).join('') + '</div>';
}
function viewLife() {
  const d = activeDate(), r = S.daily[d] || {};
  const slp = sleepHours(r), wt = Number(S.settings.waterTarget) || 8, water = r.water || 0;
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(d, -i));

  const log = card('',
    cardHead('Log hari ini', '<span class="muted">' + esc(fmtDate(d)) + '</span>') +
    '<div class="sub-label">' + ic('moon') + 'Tidur</div>' +
    '<div class="time-row"><label class="field"><span>Mulai tidur (semalam)</span><input type="time" id="lgSleep" class="input" value="' + esc(r.sleepStart || '') + '" data-change="logField" data-field="sleepStart"></label>' +
    '<label class="field"><span>Bangun</span><input type="time" id="lgWake" class="input" value="' + esc(r.wake || '') + '" data-change="logField" data-field="wake"></label></div>' +
    '<div class="sleep-dur">' + (slp != null ? 'Durasi tidur: <b>' + fmtDur(slp) + '</b>' + (slp < 6.5 ? ' · kurang dari 7 jam' : slp >= 7 && slp <= 9 ? ' · cukup baik' : '') : 'Isi jam tidur dan bangun untuk melihat durasi.') + '</div>' +
    '<div class="sub-label">' + ic('zap') + 'Energi</div>' + energyButtons(r.energy || 0) +
    '<div class="sub-label">' + ic('drop') + 'Air minum</div>' +
    '<div class="water-row"><button class="icon-btn lg" data-act="waterDec" aria-label="Kurangi satu gelas">' + ic('minus') + '</button><div class="water-mid">' + waterDrops(water, wt) + '<span class="muted">' + water + ' dari ' + wt + ' gelas</span></div><button class="icon-btn lg accent" data-act="waterInc" aria-label="Tambah satu gelas">' + ic('plus') + '</button></div>' +
    '<div class="sub-label">' + ic('activity') + 'Olahraga</div>' +
    '<button class="toggle-btn' + (r.workout ? ' on' : '') + '" data-act="workoutToggle" aria-pressed="' + !!r.workout + '">' + ic(r.workout ? 'check' : 'circle') + (r.workout ? 'Sudah olahraga hari ini' : 'Tandai sudah olahraga') + '</button>' +
    '<div class="sub-label">' + ic('book') + 'Syukur / refleksi singkat</div>' +
    '<textarea id="lgGrat" class="input" rows="3" maxlength="400" data-draft data-change="logField" data-field="gratitude" placeholder="Satu hal baik atau pelajaran hari ini…">' + dv('lgGrat', r.gratitude || '') + '</textarea>');

  const charts = card('',
    cardHead('7 hari terakhir') +
    '<div class="sub-label">Tidur (jam)</div>' + lifeChart(days, x => sleepHours(S.daily[x]), 10, v => v.toFixed(1).replace('.', ','), 'sleep', 7) +
    '<div class="sub-label">Energi (1–5)</div>' + lifeChart(days, x => (S.daily[x] || {}).energy || null, 5, v => String(v), 'energy') +
    '<div class="sub-label">Air (gelas)</div>' + lifeChart(days, x => (S.daily[x] || {}).water || null, Math.max(wt, 10), v => String(v), 'water', wt) +
    '<div class="sub-label">Olahraga</div><div class="wk-chart flat">' + days.map(x => '<div class="wk-col"><span class="dotmark' + ((S.daily[x] || {}).workout ? ' on' : '') + '">' + ((S.daily[x] || {}).workout ? '✓' : '') + '</span><span class="wk-day">' + fmtDayShort(x) + '</span></div>').join('') + '</div>' +
    '<div class="muted small" style="margin-top:12px">Garis pada batang menunjukkan target (tidur 7 jam, air ' + wt + ' gelas).</div>');

  return '<div class="grid"><div class="col">' + log + '</div><div class="col">' + charts + '</div></div>';
}

/* =========================================================
   View: Lainnya (Review + Pengaturan)
   ========================================================= */
function reviewView() {
  const w = weekStats(activeDate());
  const spendCh = w.spendPrev > 0 ? Math.round((w.spendNow - w.spendPrev) / w.spendPrev * 100) : null;
  const best = w.best ? fmtDate(w.best.d) + ' (' + Math.round(w.best.p * 100) + '%)' : '—';
  const ins = weekInsights(w);
  const tile = (lab, val, sub) => '<div class="tile"><span class="lbl">' + lab + '</span><b class="num">' + val + '</b>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>';
  return '<div class="grid"><div class="col">' +
    card('review-hero', '<div class="eyebrow">Review 7 hari · ' + esc(fmtDate(w.days[0])) + ' – ' + esc(fmtDate(w.days[6])) + '</div>' +
      '<ul class="insights">' + ins.map(t => '<li>' + ic('star') + '<span>' + esc(t) + '</span></li>').join('') + '</ul>') +
    card('', cardHead('Angka minggu ini') + '<div class="tiles">' +
      tile('Goal selesai', w.goalsPct == null ? '—' : w.goalsPct + '%', w.goalsTotal ? w.goalsDone + ' dari ' + w.goalsTotal : 'belum ada goal') +
      tile('Hari terbaik', best, '') +
      tile('Kebiasaan', w.habitsPct == null ? '—' : w.habitsPct + '%', w.habitsTotal ? w.habitsDone + ' dari ' + w.habitsTotal : 'belum ada') +
      tile('Rata-rata tidur', w.sleepAvg == null ? '—' : fmtDur(w.sleepAvg), w.sleepDays + ' hari tercatat') +
      tile('Energi rata-rata', w.energyAvg == null ? '—' : w.energyAvg.toFixed(1).replace('.', ',') + ' / 5', '') +
      tile('Olahraga', w.workoutDays + ' hari', w.waterAvg == null ? '' : 'air rata-rata ' + w.waterAvg.toFixed(1).replace('.', ',') + ' gelas') +
      '</div>') + '</div><div class="col">' +
    card('', cardHead('Uang 7 hari') + '<div class="tiles">' +
      tile('Pengeluaran', idr(w.spendNow), spendCh == null ? 'minggu lalu: ' + idr(w.spendPrev) : (spendCh > 0 ? '▲ ' : spendCh < 0 ? '▼ ' : '') + Math.abs(spendCh) + '% dari minggu lalu') +
      tile('Pemasukan', idr(w.incomeNow), '') +
      tile('Terbesar', w.topCat ? esc(w.topCat) : '—', w.topCat ? idr(w.topCatAmt) : '') + '</div>') +
    card('', cardHead('Ekspor') + '<div class="btn-stack"><button class="btn block" data-act="exportCsv">' + ic('down') + 'Unduh transaksi (CSV)</button><button class="btn block" data-act="exportJson">' + ic('down') + 'Unduh cadangan lengkap (JSON)</button></div>') +
    '</div></div>';
}

function settingsView() {
  const sec = getSecrets();
  const sm = syncMeta();
  const p = ui.push;
  const times = []; for (let m = 7 * 60; m <= 23 * 60 + 30; m += 30) times.push(pad(Math.floor(m / 60)) + ':' + pad(m % 60));
  const hoursW = []; for (let h = 3; h <= 12; h++) hoursW.push({ v: h, l: pad(h) + ':00' });
  const hoursS = []; for (let h = 20; h <= 27; h++) hoursS.push({ v: h, l: pad(h % 24) + ':00' + (h >= 24 ? ' (lewat tengah malam)' : '') });

  const profile = card('', cardHead('Tampilan & jam harian') +
    '<label class="field"><span>Nama</span><input id="setName" class="input" value="' + esc(S.settings.name) + '" data-change="setName" autocomplete="off"></label>' +
    '<div class="sub-label">Tema warna</div><div class="themes">' + THEMES.map(t =>
      '<button class="theme-btn' + (S.settings.theme === t.id ? ' on' : '') + '" data-act="setTheme" data-id="' + t.id + '" aria-pressed="' + (S.settings.theme === t.id) + '" aria-label="Tema ' + t.label + '"><i style="background:linear-gradient(135deg,' + t.a + ',' + t.b + ')"></i><span>' + t.label + '</span></button>').join('') + '</div>' +
    '<div class="time-row"><label class="field"><span>Mulai aktif</span><select class="input" data-change="setWake">' + opts(hoursW, S.settings.wakeHour) + '</select></label>' +
    '<label class="field"><span>Tidur</span><select class="input" data-change="setSleep">' + opts(hoursS, S.settings.sleepHour) + '</select></label></div>' +
    '<label class="field"><span>Target air (gelas/hari)</span><select class="input" data-change="setWater">' + opts([4, 5, 6, 7, 8, 9, 10, 12], S.settings.waterTarget) + '</select></label>');

  const sheets = card('', cardHead('Google Sheets & sinkron', '<span class="status-pill ' + sm.cls + '">' + esc(sm.label) + '</span>') +
    '<label class="field"><span>URL Web App (Apps Script)</span><input id="secUrl" class="input" data-draft placeholder="https://script.google.com/macros/s/…/exec" value="' + dv('secUrl', sec.sheetsUrl || '') + '" autocomplete="off" inputmode="url"></label>' +
    '<label class="field"><span>Token rahasia (sama dengan di Apps Script & Netlify)</span><input id="secToken" type="password" class="input" data-draft value="' + dv('secToken', sec.token || '') + '" autocomplete="off"></label>' +
    '<div class="btn-row"><button class="btn primary" data-act="secSave">Simpan</button><button class="btn" data-act="syncNow">' + ic('refresh') + 'Sinkron sekarang</button></div>' +
    '<label class="switch-row"><span>Sinkron otomatis setelah perubahan</span><input type="checkbox" class="switch" data-act="toggleAutoSync" ' + (S.settings.autoSync ? 'checked' : '') + '></label>' +
    '<div class="muted small">Sheets menyimpan satu salinan penuh data Anda plus tabel yang bisa dibaca (Transaksi, Goals, Kebiasaan, Harian). Jika dua perangkat mengubah data bersamaan, versi yang terbaru yang dipakai.</div>' +
    (localStorage.getItem(PREV_KEY) ? '<button class="btn block" data-act="restorePrev" style="margin-top:10px">Pulihkan data sebelum sinkron terakhir</button>' : ''));

  let pushStatus;
  if (!p.supported) pushStatus = p.ios && !p.standalone ? 'Di iPhone, tambahkan situs ini ke Home Screen dulu (Share → Add to Home Screen), lalu buka dari ikon.' : 'Browser ini tidak mendukung notifikasi push.';
  else if (p.permission === 'denied') pushStatus = 'Izin notifikasi ditolak. Ubah di Pengaturan perangkat → situs/app ini.';
  else if (p.subscribed) pushStatus = 'Notifikasi aktif di perangkat ini.';
  else pushStatus = 'Belum aktif.';
  const sorted = NOTIF_TYPES.slice().sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
  const notif = card('', cardHead('Notifikasi', '<span class="status-pill ' + (p.subscribed ? 'ok' : 'off') + '">' + (p.subscribed ? 'Aktif' : 'Nonaktif') + '</span>') +
    '<div class="muted small" style="margin-bottom:10px">' + esc(pushStatus) + (p.msg ? ' ' + esc(p.msg) : '') + '</div>' +
    '<div class="btn-row">' + (p.subscribed ?
      '<button class="btn" data-act="pushTest"' + (p.busy ? ' disabled' : '') + '>' + ic('bell') + 'Kirim notifikasi uji</button><button class="btn danger-o" data-act="pushOff"' + (p.busy ? ' disabled' : '') + '>Matikan</button>' :
      '<button class="btn primary" data-act="pushOn"' + (p.busy || !p.supported ? ' disabled' : '') + '>' + ic('bell') + 'Aktifkan notifikasi</button>') + '</div>' +
    '<ul class="notif-list">' + sorted.map(t => {
      const c = S.settings.notif[t.id];
      return '<li class="notif-row"><div class="notif-main"><b>' + t.label + '</b><span>' + t.desc + '</span></div>' +
        (t.time ? '<select class="input sm" data-change="notifTime" data-id="' + t.id + '" aria-label="Jam ' + t.label + '">' + opts(times, c.time) + '</select>' : '') +
        '<input type="checkbox" class="switch" data-act="notifToggle" data-id="' + t.id + '" ' + (c.on ? 'checked' : '') + ' aria-label="' + t.label + '"></li>';
    }).join('') + '</ul>' +
    '<div class="muted small">Waktu mengikuti zona Asia/Jakarta (WIB). Jam tersedia 07:00–23:30. Notifikasi berbasis data (anggaran, streak) memakai ringkasan terakhir yang dikirim dari app ini.</div>');

  const backup = card('', cardHead('Cadangan') +
    '<div class="btn-stack"><button class="btn block" data-act="exportJson">' + ic('down') + 'Unduh cadangan (JSON)</button>' +
    '<label class="btn block file-btn">' + ic('up') + 'Pulihkan dari file JSON<input type="file" accept="application/json,.json" data-change="importJson" hidden></label>' +
    '<button class="btn block" data-act="exportCsv">' + ic('down') + 'Unduh transaksi (CSV)</button></div>' +
    '<div class="muted small" style="margin-top:10px">' + (S.migratedFromV1 ? 'Data dari versi lama sudah diimpor. Kunci lama tidak dihapus sebagai cadangan.' : 'Simpan cadangan berkala. Data utama ada di browser ini.') + '</div>');

  return '<div class="grid"><div class="col">' + sheets + notif + '</div><div class="col">' + profile + backup + '</div></div>';
}

function viewMore() {
  const seg = [{ id: 'review', l: 'Review' }, { id: 'settings', l: 'Pengaturan' }];
  return '<div class="seg" role="tablist" aria-label="Lainnya">' + seg.map(s =>
    '<button class="seg-btn' + (ui.moreTab === s.id ? ' on' : '') + '" role="tab" aria-selected="' + (ui.moreTab === s.id) + '" data-act="moreTab" data-t="' + s.id + '">' + s.l + '</button>').join('') + '</div>' +
    (ui.moreTab === 'settings' ? settingsView() : reviewView());
}

/* =========================================================
   Sheet (modal bawah) untuk form
   ========================================================= */
function parseMoney(s) { return Number(String(s == null ? '' : s).replace(/\D/g, '')) || 0; }
function fmtMoneyInput(el) {
  const digits = el.value.replace(/\D/g, '').slice(0, 13);
  el.value = digits ? fmtNum(Number(digits)) : '';
}
function moneyStr(n) { return n ? fmtNum(n) : ''; }

function openSheet(kind, id, extra) {
  ui.sheet = { kind: kind, id: id || null, fresh: true };
  const w0 = S.settings.lastWallet && S.wallets.some(w => w.id === S.settings.lastWallet) ? S.settings.lastWallet : S.wallets[0].id;
  if (kind === 'tx') {
    const t = id ? S.tx.find(x => x.id === id) : null;
    if (t) {
      Object.assign(drafts, { txType: t.type, txAmount: moneyStr(t.amount), txCat: t.category, txWallet: t.wallet, txToWallet: t.toWallet || '', txNote: t.note || '', txDate: t.date });
    } else {
      const other = S.wallets.find(w => w.id !== w0);
      Object.assign(drafts, { txType: (extra && extra.type) || 'expense', txAmount: '', txCat: EXPENSE_CATS[0], txWallet: w0, txToWallet: other ? other.id : '', txNote: '', txDate: calendarToday() });
    }
  } else if (kind === 'wallet') {
    const w = id ? S.wallets.find(x => x.id === id) : null;
    Object.assign(drafts, { wlName: w ? w.name : '', wlOpen: w ? moneyStr(Math.abs(w.opening)) : '', wlNeg: w && w.opening < 0 });
  } else if (kind === 'budget') {
    const cat = id || EXPENSE_CATS[0];
    Object.assign(drafts, { bgCat: cat, bgAmt: moneyStr(S.budgets[cat] || 0) });
  } else if (kind === 'recurring') {
    const r = id ? S.recurring.find(x => x.id === id) : null;
    Object.assign(drafts, r ? { rcType: r.type, rcAmt: moneyStr(r.amount), rcCat: r.category, rcWallet: r.wallet, rcNote: r.note || '', rcDay: String(r.day) }
      : { rcType: 'expense', rcAmt: '', rcCat: 'Tagihan', rcWallet: w0, rcNote: '', rcDay: String(new Date().getDate()) });
  } else if (kind === 'saving') {
    const s = id ? S.savings.find(x => x.id === id) : null;
    Object.assign(drafts, { svName: s ? s.name : '', svTarget: s ? moneyStr(s.target) : '' });
  }
  render();
}
function closeSheet() { ui.sheet = null; render(); }
function sheetErr(msg) { const e = $('#sheetErr'); if (e) e.textContent = msg || ''; }

function walletOptions(cur, excludeId) {
  return opts(S.wallets.filter(w => w.id !== excludeId).map(w => ({ v: w.id, l: w.name })), cur);
}
function field(label, inner) { return '<label class="field"><span>' + label + '</span>' + inner + '</label>'; }

function renderSheet() {
  if (!ui.sheet) return '';
  const k = ui.sheet.kind, id = ui.sheet.id;
  let title = '', body = '', actions = '';
  const save = '<button class="btn primary grow" data-act="sheetSave">' + (id ? 'Simpan perubahan' : 'Simpan') + '</button>';
  const del = id ? '<button class="btn danger-o" data-act="sheetDelete">Hapus</button>' : '';
  if (k === 'tx') {
    const type = drafts.txType || 'expense';
    title = id ? 'Ubah transaksi' : 'Catat transaksi';
    const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
    const canTransfer = S.wallets.length > 1;
    body =
      '<div class="type-toggle" role="group" aria-label="Jenis transaksi">' +
      [['expense', 'Pengeluaran'], ['income', 'Pemasukan'], ['transfer', 'Transfer']].map(x =>
        '<button class="type-btn ' + x[0] + (type === x[0] ? ' on' : '') + '" data-act="txType" data-t="' + x[0] + '" aria-pressed="' + (type === x[0]) + '"' + (x[0] === 'transfer' && !canTransfer ? ' disabled title="Butuh minimal dua dompet"' : '') + '>' + x[1] + '</button>').join('') + '</div>' +
      field('Jumlah (Rp)', '<input id="txAmount" class="input big-input" data-draft data-money data-enter="sheetSave" inputmode="numeric" autocomplete="off" placeholder="0" value="' + dv('txAmount') + '">') +
      (type === 'transfer'
        ? '<div class="time-row">' + field('Dari dompet', '<select id="txWallet" class="input" data-draft data-change="txFromChange">' + walletOptions(drafts.txWallet) + '</select>') + field('Ke dompet', '<select id="txToWallet" class="input" data-draft>' + walletOptions(drafts.txToWallet, drafts.txWallet) + '</select>') + '</div>'
        : '<div class="time-row">' + field('Kategori', '<select id="txCat" class="input" data-draft>' + opts(cats, drafts.txCat) + '</select>') + field('Dompet', '<select id="txWallet" class="input" data-draft>' + walletOptions(drafts.txWallet) + '</select>') + '</div>') +
      '<div class="time-row">' + field('Tanggal', '<input id="txDate" type="date" class="input" data-draft value="' + dv('txDate') + '">') + field('Catatan (opsional)', '<input id="txNote" class="input" data-draft data-enter="sheetSave" autocomplete="off" placeholder="Misal: makan siang" value="' + dv('txNote') + '">') + '</div>';
    actions = save + del;
  } else if (k === 'wallet') {
    title = id ? 'Ubah dompet' : 'Dompet baru';
    body = field('Nama dompet', '<input id="wlName" class="input" data-draft data-enter="sheetSave" autocomplete="off" placeholder="Misal: Bank, Tunai, E-Wallet" value="' + dv('wlName') + '">') +
      field('Saldo awal (Rp)', '<input id="wlOpen" class="input" data-draft data-money data-enter="sheetSave" inputmode="numeric" placeholder="0" value="' + dv('wlOpen') + '">') +
      '<div class="muted small">Saldo awal adalah uang di dompet ini sebelum transaksi yang Anda catat di app ini.</div>';
    actions = save + del;
  } else if (k === 'budget') {
    title = 'Anggaran bulanan';
    body = field('Kategori', '<select id="bgCat" class="input" data-draft data-change="bgCatChange">' + opts(EXPENSE_CATS, drafts.bgCat) + '</select>') +
      field('Batas per bulan (Rp)', '<input id="bgAmt" class="input big-input" data-draft data-money data-enter="sheetSave" inputmode="numeric" placeholder="0 = hapus anggaran" value="' + dv('bgAmt') + '">');
    actions = save;
  } else if (k === 'recurring') {
    title = id ? 'Ubah transaksi berulang' : 'Transaksi berulang baru';
    const type = drafts.rcType || 'expense';
    const days = []; for (let d = 1; d <= 31; d++) days.push(d);
    body = '<div class="type-toggle two" role="group" aria-label="Jenis">' + [['expense', 'Pengeluaran'], ['income', 'Pemasukan']].map(x =>
      '<button class="type-btn ' + x[0] + (type === x[0] ? ' on' : '') + '" data-act="rcType" data-t="' + x[0] + '" aria-pressed="' + (type === x[0]) + '">' + x[1] + '</button>').join('') + '</div>' +
      field('Nama / catatan', '<input id="rcNote" class="input" data-draft autocomplete="off" placeholder="Misal: Uang kos, Netflix, Gaji" value="' + dv('rcNote') + '">') +
      field('Jumlah (Rp)', '<input id="rcAmt" class="input big-input" data-draft data-money data-enter="sheetSave" inputmode="numeric" placeholder="0" value="' + dv('rcAmt') + '">') +
      '<div class="time-row">' + field('Kategori', '<select id="rcCat" class="input" data-draft>' + opts(type === 'income' ? INCOME_CATS : EXPENSE_CATS, drafts.rcCat) + '</select>') + field('Dompet', '<select id="rcWallet" class="input" data-draft>' + walletOptions(drafts.rcWallet) + '</select>') + '</div>' +
      field('Tanggal tiap bulan', '<select id="rcDay" class="input" data-draft>' + opts(days, drafts.rcDay) + '</select>') +
      '<div class="muted small">Tercatat otomatis saat tanggalnya tiba (saat app dibuka). Bulan pendek memakai tanggal terakhir.</div>';
    actions = save;
  } else if (k === 'saving') {
    title = id ? 'Ubah target tabungan' : 'Target tabungan baru';
    body = field('Nama target', '<input id="svName" class="input" data-draft data-enter="sheetSave" autocomplete="off" placeholder="Misal: Dana darurat" value="' + dv('svName') + '">') +
      field('Nominal target (Rp)', '<input id="svTarget" class="input big-input" data-draft data-money data-enter="sheetSave" inputmode="numeric" placeholder="0" value="' + dv('svTarget') + '">');
    actions = save;
  }
  return '<div class="sheet-backdrop" data-act="sheetClose"></div>' +
    '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="sheet-grip"></div>' +
    '<div class="sheet-head"><h3>' + esc(title) + '</h3><button class="icon-btn" data-act="sheetClose" aria-label="Tutup">' + ic('x') + '</button></div>' +
    body + '<div class="form-err" id="sheetErr" role="alert"></div><div class="sheet-actions">' + actions + '</div></div>';
}

/* =========================================================
   Render utama
   ========================================================= */
function render() {
  const a = document.activeElement;
  const aid = a && a.id ? a.id : null;
  let ss = null, se = null;
  try { if (a && a.selectionStart != null) { ss = a.selectionStart; se = a.selectionEnd; } } catch (e) {}
  renderTopbar();
  const views = { home: viewHome, tasks: viewTasks, money: viewMoney, life: viewLife, more: viewMore };
  $('#view').innerHTML = (views[ui.tab] || viewHome)();
  renderTabbar();
  $('#sheet').innerHTML = renderSheet();
  document.body.classList.toggle('sheet-open', !!ui.sheet);
  if (aid && !ui.focusId) {
    const el = document.getElementById(aid);
    if (el && el !== document.activeElement) {
      el.focus();
      try { if (ss != null && el.setSelectionRange && /text|search|tel|url|password/.test(el.type || 'text')) el.setSelectionRange(ss, se); } catch (e) {}
    }
  }
  if (ui.focusId) {
    const el = document.getElementById(ui.focusId);
    if (el) { el.focus(); if (el.select && el.type === 'text') { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } }
    ui.focusId = null;
  }
  if (ui.sheet && ui.sheet.fresh) {
    ui.sheet.fresh = false;
    const f = $('#sheet input:not([type=hidden]), #sheet select');
    if (f && f.id !== 'txDate') f.focus();
  }
  startTicker();
}

let toastTimer = null;
function toast(msg, kind) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (kind === 'error' ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3200);
}
function flashStatus(which, msg, isErr) {
  const el = document.getElementById('status-' + which);
  if (!el) return;
  el.textContent = msg;
  el.className = 'status' + (isErr ? ' err' : '');
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 4000);
}
function refreshTxList() {
  const wrap = $('#txListWrap');
  if (!wrap) return;
  const q = String(drafts.txSearch || '').toLowerCase().trim();
  let list = txSorted(txOfMonth(ui.month));
  if (q) list = list.filter(t => ((t.category || '') + ' ' + (t.note || '') + ' ' + walletName(t.wallet)).toLowerCase().indexOf(q) !== -1);
  wrap.innerHTML = txListInner(list);
}

/* =========================================================
   Ekspor / impor
   ========================================================= */
function download(name, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
function csvCell(v) { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function txCsv() {
  const rows = [['tanggal', 'tipe', 'kategori', 'dompet', 'ke_dompet', 'jumlah', 'catatan']];
  txSorted(S.tx).reverse().forEach(t => rows.push([t.date, t.type, t.category || '', walletName(t.wallet), t.toWallet ? walletName(t.toWallet) : '', t.amount, t.note || '']));
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

function buildTables() {
  const byDate = (a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0);
  const goalsRows = [['Tanggal', 'Goal', 'Selesai', 'Prioritas', 'Jam', 'Fokus']];
  Object.keys(S.goals).sort().forEach(d => S.goals[d].forEach(g => goalsRows.push([d, g.text, g.done ? 'ya' : 'tidak', g.prio || 'mid', g.time || '', g.focus ? 'ya' : ''])));
  const habRows = [['Tanggal', 'Kebiasaan']];
  Object.keys(S.habitLog).sort().forEach(d => S.habitLog[d].forEach(hid => { const h = S.habits.find(x => x.id === hid); if (h) habRows.push([d, h.name]); }));
  const dayRows = [['Tanggal', 'Mulai tidur', 'Bangun', 'Durasi (jam)', 'Energi', 'Air (gelas)', 'Olahraga', 'Syukur']];
  Object.keys(S.daily).sort().forEach(d => {
    const r = S.daily[d], sl = sleepHours(r);
    dayRows.push([d, r.sleepStart || '', r.wake || '', sl == null ? '' : Math.round(sl * 10) / 10, r.energy || '', r.water || '', r.workout ? 'ya' : '', r.gratitude || '']);
  });
  const ym = calendarToday().slice(0, 7);
  return {
    Transaksi: [['Tanggal', 'Tipe', 'Kategori', 'Dompet', 'Ke dompet', 'Jumlah', 'Catatan', 'ID']].concat(S.tx.slice().sort(byDate).map(t => [t.date, t.type, t.category || '', walletName(t.wallet), t.toWallet ? walletName(t.toWallet) : '', t.amount, t.note || '', t.id])),
    Goals: goalsRows, Kebiasaan: habRows, Harian: dayRows,
    Dompet: [['Dompet', 'Saldo']].concat(S.wallets.map(w => [w.name, walletBalance(w)])),
    Anggaran: [['Kategori', 'Batas', 'Terpakai bulan ini']].concat(budgetStatus(ym).map(b => [b.cat, b.limit, b.spent])),
    Tabungan: [['Target', 'Nominal', 'Terkumpul']].concat(S.savings.map(s => [s.name, s.target, s.saved]))
  };
}

/* =========================================================
   Aksi
   ========================================================= */
const actions = {
  tab(el) {
    ui.tab = el.dataset.tab;
    if (el.dataset.sub) ui.moreTab = el.dataset.sub;
    ui.sheet = null; render(); window.scrollTo(0, 0);
  },
  moneyTab(el) { ui.moneyTab = el.dataset.t; render(); },
  moreTab(el) { ui.moreTab = el.dataset.t; render(); },
  dismiss(el) { S.settings.dismiss[el.dataset.key] = true; save(); render(); },
  monthPrev() { ui.month = shiftMonth(ui.month, -1); render(); },
  monthNext() { ui.month = shiftMonth(ui.month, 1); render(); },

  /* ----- goals ----- */
  goalToggle(el) {
    const g = goalsOf(el.dataset.date).find(x => x.id === el.dataset.id);
    if (!g) return;
    g.done = el.checked;
    if (g.done) g.doneAt = Date.now(); else delete g.doneAt;
    save(); render();
    const list = goalsPeek(activeDate());
    if (g.done && list.length && list.every(x => x.done)) toast('Semua goal hari ini selesai. Solid!');
  },
  goalFocus(el) {
    const g = goalsOf(el.dataset.date).find(x => x.id === el.dataset.id);
    if (!g) return;
    g.focus = !g.focus; save(); render();
  },
  goalEdit(el) {
    const g = goalsOf(el.dataset.date).find(x => x.id === el.dataset.id);
    if (!g) return;
    ui.editGoal = { date: el.dataset.date, id: g.id };
    drafts.editGoalText = g.text; ui.focusId = 'editGoalText'; render();
  },
  goalEditSave() {
    if (!ui.editGoal) return;
    const g = goalsOf(ui.editGoal.date).find(x => x.id === ui.editGoal.id);
    const t = String(drafts.editGoalText || '').trim();
    if (g && t) { g.text = t; save(); }
    ui.editGoal = null; render();
  },
  goalEditCancel() { ui.editGoal = null; render(); },
  goalDel(el) {
    const arr = goalsOf(el.dataset.date), i = arr.findIndex(x => x.id === el.dataset.id);
    if (i >= 0) { arr.splice(i, 1); save(); render(); }
  },
  goalAdd(el) {
    const which = el.dataset.which || 'today', p = which === 'today' ? 'goal' : 'tm';
    const text = String(drafts[p + 'Input'] || '').trim();
    if (!text) { flashStatus(which, 'Tulis goal dulu.', true); return; }
    addGoalText(which, text);
  },
  async goalPolish(el) {
    const which = el.dataset.which || 'today', p = which === 'today' ? 'goal' : 'tm';
    const raw = String(drafts[p + 'Input'] || '').trim();
    if (!raw) { flashStatus(which, 'Tulis goal dulu.', true); return; }
    flashStatus(which, 'Merapikan…');
    try {
      const res = await callFn('polish', { text: raw });
      if (!res.text) throw new Error('kosong');
      addGoalText(which, res.text);
    } catch (e) {
      addGoalText(which, raw);
      flashStatus(which, 'Rapikan belum aktif atau gagal — ditambahkan apa adanya.', true);
    }
  },
  pushRemaining() {
    const d = activeDate(), today = goalsOf(d), rem = today.filter(g => !g.done);
    if (!rem.length) return;
    if (!confirm('Pindahkan ' + rem.length + ' goal yang belum selesai ke besok?')) return;
    const tm = goalsOf(tomorrowDate()), have = new Set(tm.map(g => g.text));
    rem.forEach(g => { if (!have.has(g.text)) { tm.push({ id: uid(), text: g.text, done: false, prio: g.prio || 'mid', time: g.time || '' }); have.add(g.text); } });
    S.goals[d] = today.filter(g => g.done);
    save(); render();
  },

  /* ----- kebiasaan ----- */
  habitToggle(el) {
    const d = activeDate(), id = el.dataset.id, log = S.habitLog[d] || (S.habitLog[d] = []);
    const i = log.indexOf(id);
    if (i >= 0) log.splice(i, 1); else log.push(id);
    save(); render();
  },
  habitAdd() {
    const name = String(drafts.habitInput || '').trim();
    if (!name) return;
    S.habits.push({ id: uid(), name: name, createdAt: Date.now() });
    drafts.habitInput = ''; ui.focusId = 'habitInput'; save(); render();
  },
  habitDel(el) {
    const h = S.habits.find(x => x.id === el.dataset.id);
    if (!h || !confirm('Hapus kebiasaan "' + h.name + '" beserta riwayatnya?')) return;
    S.habits = S.habits.filter(x => x.id !== h.id);
    Object.keys(S.habitLog).forEach(d => { S.habitLog[d] = S.habitLog[d].filter(x => x !== h.id); });
    save(); render();
  },

  /* ----- tubuh ----- */
  waterInc() { const r = dailyOf(activeDate()); r.water = clamp((r.water || 0) + 1, 0, 30); save(); render(); },
  waterDec() { const r = dailyOf(activeDate()); r.water = clamp((r.water || 0) - 1, 0, 30); save(); render(); },
  energySet(el) { const r = dailyOf(activeDate()), v = Number(el.dataset.v); if (r.energy === v) delete r.energy; else r.energy = v; save(); render(); },
  workoutToggle() { const r = dailyOf(activeDate()); r.workout = !r.workout; save(); render(); },

  /* ----- uang ----- */
  openTx() { openSheet('tx'); },
  quickExpense() {
    const amt = parseMoney(drafts.qAmt);
    if (!amt) { toast('Isi jumlah dulu.', 'error'); ui.focusId = 'qAmt'; render(); return; }
    const w = S.settings.lastWallet && S.wallets.some(x => x.id === S.settings.lastWallet) ? S.settings.lastWallet : S.wallets[0].id;
    S.tx.push({ id: uid(), type: 'expense', amount: amt, category: drafts.qCat || 'Makan', wallet: w, note: '', date: calendarToday(), createdAt: Date.now() });
    drafts.qAmt = ''; save(); render(); toast('Pengeluaran ' + idr(amt) + ' dicatat.');
  },
  txEdit(el) { openSheet('tx', el.dataset.id); },
  txDel(el) {
    const t = S.tx.find(x => x.id === el.dataset.id);
    if (!t || !confirm('Hapus transaksi ' + idr(t.amount) + '?')) return;
    S.tx = S.tx.filter(x => x.id !== t.id); save(); render();
  },
  txType(el) {
    drafts.txType = el.dataset.t;
    const cats = drafts.txType === 'income' ? INCOME_CATS : EXPENSE_CATS;
    if (cats.indexOf(drafts.txCat) === -1) drafts.txCat = cats[0];
    if (drafts.txType === 'transfer' && (!drafts.txToWallet || drafts.txToWallet === drafts.txWallet)) {
      const o = S.wallets.find(w => w.id !== drafts.txWallet); drafts.txToWallet = o ? o.id : '';
    }
    render();
  },
  walletNew() { openSheet('wallet'); },
  walletEdit(el) { openSheet('wallet', el.dataset.id); },
  budgetNew() { openSheet('budget'); },
  budgetEdit(el) { openSheet('budget', el.dataset.cat); },
  recNew() { openSheet('recurring'); },
  recEdit(el) { openSheet('recurring', el.dataset.id); },
  recDel(el) {
    const r = S.recurring.find(x => x.id === el.dataset.id);
    if (!r || !confirm('Hapus transaksi berulang "' + (r.note || r.category) + '"? Transaksi yang sudah tercatat tetap ada.')) return;
    S.recurring = S.recurring.filter(x => x.id !== r.id); save(); render();
  },
  rcType(el) { drafts.rcType = el.dataset.t; const c = el.dataset.t === 'income' ? INCOME_CATS : EXPENSE_CATS; if (c.indexOf(drafts.rcCat) === -1) drafts.rcCat = c[0]; render(); },
  savNew() { openSheet('saving'); },
  savEdit(el) { openSheet('saving', el.dataset.id); },
  savDel(el) {
    const s = S.savings.find(x => x.id === el.dataset.id);
    if (!s || !confirm('Hapus target "' + s.name + '"?')) return;
    S.savings = S.savings.filter(x => x.id !== s.id); save(); render();
  },
  savDeposit(el) {
    const s = S.savings.find(x => x.id === el.dataset.id);
    const amt = parseMoney(drafts['sav-' + el.dataset.id]);
    if (!s || !amt) { toast('Isi nominal setoran.', 'error'); return; }
    s.saved += amt; drafts['sav-' + s.id] = ''; save(); render(); toast('Setoran ' + idr(amt) + ' ke ' + s.name + '.');
  },

  /* ----- sheet ----- */
  sheetClose() { closeSheet(); },
  sheetSave() {
    if (!ui.sheet) return;
    const k = ui.sheet.kind, id = ui.sheet.id;
    if (k === 'tx') {
      const type = drafts.txType || 'expense', amount = parseMoney(drafts.txAmount);
      if (!amount) { sheetErr('Isi jumlah lebih dari 0.'); return; }
      const obj = { type: type, amount: amount, wallet: drafts.txWallet, note: String(drafts.txNote || '').trim(), date: drafts.txDate || calendarToday() };
      if (type === 'transfer') {
        if (!drafts.txToWallet || drafts.txToWallet === drafts.txWallet) { sheetErr('Pilih dua dompet yang berbeda.'); return; }
        obj.category = 'Transfer'; obj.toWallet = drafts.txToWallet;
      } else { obj.category = drafts.txCat || (type === 'income' ? INCOME_CATS[0] : EXPENSE_CATS[0]); }
      if (id) {
        const i = S.tx.findIndex(x => x.id === id);
        if (i >= 0) { const old = S.tx[i]; S.tx[i] = Object.assign({}, old, obj); if (type !== 'transfer') delete S.tx[i].toWallet; }
      } else { S.tx.push(Object.assign({ id: uid(), createdAt: Date.now() }, obj)); }
      S.settings.lastWallet = obj.wallet;
      ui.month = obj.date.slice(0, 7);
      save(); ui.sheet = null; render(); toast(id ? 'Transaksi diperbarui.' : 'Tercatat: ' + idr(amount) + '.');
    } else if (k === 'wallet') {
      const name = String(drafts.wlName || '').trim();
      if (!name) { sheetErr('Isi nama dompet.'); return; }
      const open = parseMoney(drafts.wlOpen);
      if (id) { const w = S.wallets.find(x => x.id === id); if (w) { w.name = name; w.opening = open; } }
      else { S.wallets.push({ id: uid(), name: name, opening: open }); }
      save(); ui.sheet = null; render();
    } else if (k === 'budget') {
      const amt = parseMoney(drafts.bgAmt), cat = drafts.bgCat;
      if (amt > 0) S.budgets[cat] = amt; else delete S.budgets[cat];
      save(); ui.sheet = null; render(); toast(amt > 0 ? 'Anggaran ' + cat + ' disimpan.' : 'Anggaran ' + cat + ' dihapus.');
    } else if (k === 'recurring') {
      const amount = parseMoney(drafts.rcAmt), note = String(drafts.rcNote || '').trim();
      if (!amount) { sheetErr('Isi jumlah lebih dari 0.'); return; }
      if (!note) { sheetErr('Isi nama/catatan, misal "Uang kos".'); return; }
      const day = clamp(Number(drafts.rcDay) || 1, 1, 31);
      const base = { type: drafts.rcType || 'expense', amount: amount, category: drafts.rcCat, wallet: drafts.rcWallet, note: note, day: day };
      if (id) { const r = S.recurring.find(x => x.id === id); if (r) Object.assign(r, base); }
      else {
        const today = new Date(), curYM = toDateString(today).slice(0, 7);
        base.id = uid();
        base.lastApplied = Math.min(day, daysInMonth(curYM)) < today.getDate() ? curYM : shiftMonth(curYM, -1);
        S.recurring.push(base);
      }
      applyRecurring(); save(); ui.sheet = null; render();
    } else if (k === 'saving') {
      const name = String(drafts.svName || '').trim(), target = parseMoney(drafts.svTarget);
      if (!name || !target) { sheetErr('Isi nama dan nominal target.'); return; }
      if (id) { const s = S.savings.find(x => x.id === id); if (s) { s.name = name; s.target = target; } }
      else { S.savings.push({ id: uid(), name: name, target: target, saved: 0 }); }
      save(); ui.sheet = null; render();
    }
  },
  sheetDelete() {
    if (!ui.sheet || !ui.sheet.id) return;
    const k = ui.sheet.kind, id = ui.sheet.id;
    if (k === 'tx') {
      if (!confirm('Hapus transaksi ini?')) return;
      S.tx = S.tx.filter(x => x.id !== id);
    } else if (k === 'wallet') {
      if (S.wallets.length < 2) { sheetErr('Minimal harus ada satu dompet.'); return; }
      if (S.tx.some(t => t.wallet === id || t.toWallet === id) || S.recurring.some(r => r.wallet === id)) { sheetErr('Dompet ini masih punya transaksi. Ubah namanya saja.'); return; }
      if (!confirm('Hapus dompet ini?')) return;
      S.wallets = S.wallets.filter(x => x.id !== id);
    }
    save(); ui.sheet = null; render();
  },

  /* ----- pengaturan ----- */
  setTheme(el) { S.settings.theme = el.dataset.id; document.documentElement.dataset.theme = S.settings.theme; save(); render(); },
  toggleAutoSync(el) { S.settings.autoSync = el.checked; save(); },
  notifToggle(el) { S.settings.notif[el.dataset.id].on = el.checked; save(); },
  secSave() {
    const url = String(drafts.secUrl != null ? drafts.secUrl : (getSecrets().sheetsUrl || '')).trim();
    const token = String(drafts.secToken != null ? drafts.secToken : (getSecrets().token || '')).trim();
    setSecrets({ sheetsUrl: url, token: token });
    delete drafts.secUrl; delete drafts.secToken;
    toast('Pengaturan koneksi disimpan.');
    render();
    if (url && token) syncNow(true);
  },
  syncNow() { syncNow(true); },
  restorePrev() {
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem(PREV_KEY)); } catch (e) {}
    if (!prev || prev.v !== 2) { toast('Tidak ada cadangan.', 'error'); return; }
    if (!confirm('Kembalikan data ke kondisi sebelum sinkron terakhir? Data saat ini akan diganti.')) return;
    S = ensureShape(prev); save(); render(); toast('Data dipulihkan.');
  },
  exportCsv() { download('transaksi-' + calendarToday() + '.csv', 'text/csv;charset=utf-8', '﻿' + txCsv()); },
  exportJson() { download('cadangan-dashboard-' + calendarToday() + '.json', 'application/json', JSON.stringify(S, null, 2)); },
  pushOn() { enablePush(); },
  pushOff() { disablePush(); },
  pushTest() { testPush(); }
};

function addGoalText(which, text) {
  const p = which === 'today' ? 'goal' : 'tm';
  const date = which === 'today' ? activeDate() : tomorrowDate();
  goalsOf(date).push({ id: uid(), text: text, done: false, prio: drafts[p + 'Prio'] || 'mid', time: drafts[p + 'Time'] || '' });
  drafts[p + 'Input'] = ''; drafts[p + 'Time'] = ''; drafts[p + 'Prio'] = 'mid';
  ui.focusId = p + 'Input';
  save(); render();
}

const changes = {
  logField(el) {
    const r = dailyOf(activeDate()), f = el.dataset.field, v = String(el.value || '').trim();
    if (v) r[f] = v; else delete r[f];
    if (f === 'gratitude') delete drafts.lgGrat;
    save(); render();
  },
  setName(el) { S.settings.name = el.value.trim() || 'Pengguna'; save(); renderTopbar(); },
  setWake(el) { S.settings.wakeHour = Number(el.value); save(); },
  setSleep(el) { S.settings.sleepHour = Number(el.value); save(); },
  setWater(el) { S.settings.waterTarget = Number(el.value); save(); },
  notifTime(el) { S.settings.notif[el.dataset.id].time = el.value; save(); },
  bgCatChange(el) { drafts.bgCat = el.value; drafts.bgAmt = moneyStr(S.budgets[el.value] || 0); render(); },
  txFromChange(el) {
    drafts.txWallet = el.value;
    if (drafts.txToWallet === el.value) { const o = S.wallets.find(w => w.id !== el.value); drafts.txToWallet = o ? o.id : ''; }
    render();
  },
  importJson(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(String(rd.result));
        if (!data || data.v !== 2 || !data.goals || !Array.isArray(data.tx)) throw new Error('format');
        if (!confirm('Ganti seluruh data di perangkat ini dengan isi file cadangan?')) return;
        try { localStorage.setItem(PREV_KEY, JSON.stringify(S)); } catch (e) {}
        S = ensureShape(data); save(); document.documentElement.dataset.theme = S.settings.theme; render(); toast('Cadangan dipulihkan.');
      } catch (e) { toast('File cadangan tidak valid.', 'error'); }
    };
    rd.readAsText(f);
    el.value = '';
  }
};

/* =========================================================
   Event delegation
   ========================================================= */
document.addEventListener('click', e => {
  const el = e.target.closest ? e.target.closest('[data-act]') : null;
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.matches || !el.matches('[data-draft]')) return;
  if (el.hasAttribute('data-money')) fmtMoneyInput(el);
  if (el.id) drafts[el.id] = el.value;
  if (el.dataset.live === 'txSearch') refreshTxList();
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.matches && el.matches('[data-draft]') && el.id) drafts[el.id] = el.value;
  if (el.dataset && el.dataset.change && changes[el.dataset.change]) changes[el.dataset.change](el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing && e.target.dataset && e.target.dataset.enter && actions[e.target.dataset.enter]) {
    e.preventDefault();
    if (e.target.id && e.target.hasAttribute && e.target.hasAttribute('data-draft')) drafts[e.target.id] = e.target.value;
    actions[e.target.dataset.enter](e.target, e);
  } else if (e.key === 'Escape' && ui.sheet) { closeSheet(); }
});

/* =========================================================
   Panggilan ke backend (Netlify Functions) dan Sheets
   ========================================================= */
async function callFn(name, body) {
  const sec = getSecrets();
  if (!sec.token) throw new Error('Isi token rahasia dulu di Pengaturan.');
  const res = await fetch('/.netlify/functions/' + name, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-app-token': sec.token },
    body: JSON.stringify(body || {})
  });
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok || (data && data.ok === false)) {
    const err = new Error((data && data.error) || ('HTTP ' + res.status));
    err.status = res.status;
    throw err;
  }
  return data || {};
}

async function sheetsCall(payload) {
  const sec = getSecrets();
  if (!sec.sheetsUrl || !sec.token) throw new Error('Belum diatur');
  const res = await fetch(sec.sheetsUrl, {
    method: 'POST', redirect: 'follow',
    body: JSON.stringify(Object.assign({ token: sec.token }, payload))
  });
  let data = null;
  try { data = await res.json(); } catch (e) { throw new Error('Respons Apps Script tidak valid (cek URL dan hak akses "Siapa saja")'); }
  if (!data || !data.ok) throw new Error((data && data.error) || 'Gagal');
  return data;
}

/* =========================================================
   Sinkron Google Sheets
   ========================================================= */
let syncing = false, syncQueued = false, syncTimer = null;

function hasData(st) { return !!(st.tx.length || Object.keys(st.goals).length || st.habits.length || Object.keys(st.daily).length); }

function scheduleSync() {
  const sec = getSecrets();
  if (!S.settings.autoSync || !sec.sheetsUrl || !sec.token) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(false), 4000);
}

async function syncNow(manual) {
  const sec = getSecrets();
  if (!sec.sheetsUrl || !sec.token) { if (manual) toast('Isi URL Web App dan token dulu.', 'error'); return; }
  if (syncing) { syncQueued = true; return; }
  syncing = true;
  ui.sync = { state: 'syncing', at: ui.sync.at, msg: '' };
  renderTopbar();
  let replaced = false;
  try {
    const remote = await sheetsCall({ action: 'pull' });
    const rs = remote.state && remote.state.v === 2 ? remote.state : null;
    const remoteAt = rs ? (rs.updatedAt || 0) : 0;
    let takeRemote = false;
    if (rs && hasData(rs)) {
      if (!hasData(S)) takeRemote = true;
      else if (!sec.synced) {
        takeRemote = confirm('Data di Google Sheets dan di perangkat ini sama-sama sudah ada.\n\nOK = pakai data dari Sheets (data perangkat ini dicadangkan).\nBatal = pakai data perangkat ini dan timpa Sheets.');
      } else if (remoteAt > S.updatedAt + 1000) takeRemote = true;
    }
    if (takeRemote) {
      try { localStorage.setItem(PREV_KEY, JSON.stringify(S)); } catch (e) {}
      S = ensureShape(rs);
      document.documentElement.dataset.theme = S.settings.theme;
      runStreakCheck(); runRollover(); applyRecurring(); persist();
      replaced = true;
      toast('Data dimuat dari Google Sheets.');
    } else if (hasData(S) && (manual || S.updatedAt > remoteAt || !rs)) {
      await sheetsCall({ action: 'push', state: S, tables: buildTables() });
    }
    if (!sec.synced) setSecrets(Object.assign({}, sec, { synced: true }));
    ui.sync = { state: 'ok', at: Date.now(), msg: '' };
    if (manual) toast('Sinkron selesai.');
  } catch (e) {
    const m = String(e.message || e);
    ui.sync = { state: 'error', at: Date.now(), msg: /Failed to fetch|NetworkError|Load failed/i.test(m) ? 'offline atau URL salah' : m };
    if (manual) toast('Sinkron gagal: ' + ui.sync.msg, 'error');
  } finally {
    syncing = false;
  }
  if (replaced || (ui.tab === 'more' && ui.moreTab === 'settings')) render(); else renderTopbar();
  if (syncQueued) { syncQueued = false; scheduleSync(); }
}

/* =========================================================
   Ringkasan untuk notifikasi server
   ========================================================= */
let sumTimer = null;
function buildSummary() {
  const d = activeDate(), gs = goalsPeek(d), ym = calendarToday().slice(0, 7);
  const w = weekStats(d);
  return {
    date: d, updatedAt: Date.now(),
    goalsTotal: gs.length, goalsDone: gs.filter(g => g.done).length,
    tomorrowPlanned: goalsPeek(tomorrowDate()).length,
    txToday: S.tx.filter(t => t.date === calendarToday() || t.date === d).length,
    streak: Number(S.streak.count) || 0,
    habitsTotal: S.habits.length, habitsDone: S.habits.filter(h => habitDone(h.id, d)).length,
    budget: budgetStatus(ym).filter(b => b.pct >= 80).map(b => ({ cat: b.cat, pct: b.pct })),
    billsTomorrow: billsOn(addDays(calendarToday(), 1)).map(r => ({ name: r.note || r.category, amount: r.amount })),
    weekly: { goalsPct: w.goalsPct, spend: w.spendNow, sleepAvg: w.sleepAvg == null ? null : Math.round(w.sleepAvg * 10) / 10 }
  };
}
function tzName() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta'; } catch (e) { return 'Asia/Jakarta'; } }
function scheduleSummary() {
  if (!ui.push.subscribed) return;
  clearTimeout(sumTimer);
  sumTimer = setTimeout(postSummary, 3000);
}
async function postSummary() {
  try {
    const sub = await currentSub();
    if (!sub) return;
    await callFn('api', { action: 'sync', endpoint: sub.endpoint, tz: tzName(), prefs: S.settings.notif, summary: buildSummary() });
  } catch (e) { console.warn('Kirim ringkasan gagal:', e.message); }
}

/* =========================================================
   Web Push
   ========================================================= */
function urlB64ToUint8Array(b64) {
  const pad4 = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad4).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
async function currentSub() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
async function refreshPushState() {
  const p = ui.push;
  p.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  p.standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  p.supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  p.permission = 'Notification' in window ? Notification.permission : 'denied';
  p.subscribed = false;
  if (p.supported) {
    try { const sub = await currentSub(); p.subscribed = !!sub && p.permission === 'granted'; } catch (e) {}
  }
}
async function enablePush() {
  const p = ui.push;
  p.busy = true; p.msg = ''; render();
  try {
    await refreshPushState();
    if (!p.supported) throw new Error('Perangkat/browser belum mendukung push.');
    if (!getSecrets().token) throw new Error('Isi token rahasia di bagian Google Sheets & sinkron dulu.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Izin notifikasi tidak diberikan.');
    const reg = await navigator.serviceWorker.ready;
    const cfg = await callFn('api', { action: 'config' });
    if (!cfg.publicKey) throw new Error('Server belum punya kunci VAPID.');
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(cfg.publicKey) });
    await callFn('api', { action: 'subscribe', subscription: sub.toJSON(), tz: tzName(), prefs: S.settings.notif, summary: buildSummary() });
    p.subscribed = true; p.msg = '';
    toast('Notifikasi aktif.');
  } catch (e) {
    p.msg = String(e.message || e);
  }
  p.busy = false;
  await refreshPushState();
  render();
}
async function disablePush() {
  const p = ui.push;
  p.busy = true; render();
  try {
    const sub = await currentSub();
    if (sub) {
      try { await callFn('api', { action: 'unsubscribe', endpoint: sub.endpoint }); } catch (e) {}
      await sub.unsubscribe();
    }
    p.msg = '';
  } catch (e) { p.msg = String(e.message || e); }
  p.busy = false;
  await refreshPushState();
  render();
}
async function testPush() {
  const p = ui.push;
  p.busy = true; p.msg = ''; render();
  try {
    const sub = await currentSub();
    if (!sub) throw new Error('Belum berlangganan.');
    await postSummary();
    await callFn('api', { action: 'test', endpoint: sub.endpoint });
    toast('Notifikasi uji dikirim. Cek perangkat Anda.');
  } catch (e) { p.msg = 'Uji gagal: ' + String(e.message || e); }
  p.busy = false;
  render();
}

/* =========================================================
   Service worker + boot
   ========================================================= */
function initSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return Promise.resolve();
  return navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(e => console.warn('SW gagal didaftarkan', e));
}

let lastDay = null;
function dailyChecks() {
  runStreakCheck(); runRollover(); applyRecurring(); persist();
  lastDay = activeDate();
}

function boot() {
  document.documentElement.dataset.theme = S.settings.theme;
  dailyChecks();
  render();
  initSW().then(refreshPushState).then(() => {
    if (ui.tab === 'home' || (ui.tab === 'more' && ui.moreTab === 'settings')) render();
    if (ui.push.subscribed) postSummary();
  });
  if (getSecrets().sheetsUrl) syncNow(false);
  setInterval(updateRing, 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (lastDay !== activeDate()) { dailyChecks(); render(); }
    else updateRing();
    if (getSecrets().sheetsUrl && Date.now() - (ui.sync.at || 0) > 60000) syncNow(false);
  });
  window.addEventListener('online', () => { if (getSecrets().sheetsUrl) syncNow(false); });
}

window.__lt = { get S() { return S; }, set S(v) { S = v; }, ui: ui, drafts: drafts, actions: actions, changes: changes, render: render, buildSummary: buildSummary, weekStats: weekStats, buildTables: buildTables, applyRecurring: applyRecurring, runStreakCheck: runStreakCheck, runRollover: runRollover, loadState: loadState, openSheet: openSheet, ensureShape: ensureShape, txCsv: txCsv, sheetsCall: sheetsCall };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
