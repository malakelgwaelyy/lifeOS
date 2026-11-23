/* ============================================================
   LifeOS — life-os.js
   New Life Domain Modules
   Extends app.js without modifying it.
   ============================================================ */

/* ════════════════════════════════════════════════════════════
   MODULE 1 — LIFE OS STATE EXTENSION
   ════════════════════════════════════════════════════════════ */
const LIFE_KEY = 'lifeos_v1';

const LIFE_STATE_DEFAULTS = {
  worship: {
    prayers: {},      // key: "YYYY-MM-DD_fajr" → true
    quran:   {},      // key: "YYYY-MM-DD" → pages number
    extras:  {},      // key: "YYYY-MM-DD_dhuha" → true
    notes:   {},      // key: "YYYY-MM-DD" → string
    streak:  0,
    lastFullDay: ''
  },
  fitness: {
    profile: null,    // { age, height, weight, bf, activity, injuries, gym, equipment, diet }
    plan: null,       // generated workout plan
    logs: {
      body: [],       // [{ date, weight, waist, hips, notes }]
      workouts: {},   // key: "YYYY-MM-DD_exName" → true
      water: {},      // key: "YYYY-MM-DD" → number (cups)
      calories: {}    // key: "YYYY-MM-DD" → number
    }
  },
  work: {
    shifts: [],       // [{ date, clockIn, clockOut, notes }]
    activeShift: null,// { clockIn: timestamp }
    notes: {},        // key: "YYYY-MM-DD" → [{ text, time }]
    tasks: {}         // key: "YYYY-MM-DD" → [{ text, done }]
  },
  content: {
    videoIdeas: [],   // [{ id, title, status, platform, hook, notes }]
    calendar: {},     // key: "YYYY-MM-DD" → [{ type, title }]
    growthLog: [],    // [{ date, followers, views, posts }]
    skills: {}        // key: skillId → true (completed)
  },
  tasks: [],          // [{ id, title, category, priority, deadline, notes, done, createdAt }]
  schedule: {
  blocks: []        // user-created schedule blocks
  }
};

const LIFE_STATE = JSON.parse(JSON.stringify(LIFE_STATE_DEFAULTS));

function getLifeStorageKey(owner = window.LIFEOS_DATA_OWNER || 'local') {
  return owner === 'local' ? `${LIFE_KEY}:v2:local` : `${LIFE_KEY}:v2:user:${encodeURIComponent(owner)}`;
}

function saveLifeState({ sync = true } = {}) {
  try {
    const s = JSON.parse(JSON.stringify(LIFE_STATE));
    localStorage.setItem(getLifeStorageKey(), JSON.stringify(s));
    // Signal Firebase sync if available
    if (sync && typeof triggerFirebaseSync === 'function') triggerFirebaseSync();
  } catch(e) { console.warn('LifeOS save failed', e); }
}

function loadLifeState(owner = window.LIFEOS_DATA_OWNER || 'local') {
  try {
    const scopedKey = getLifeStorageKey(owner);
    let raw = localStorage.getItem(scopedKey);
    if (!raw && owner === 'local') {
      raw = localStorage.getItem(LIFE_KEY);
      if (raw) localStorage.setItem(scopedKey, raw);
    }
    Object.assign(LIFE_STATE, JSON.parse(JSON.stringify(LIFE_STATE_DEFAULTS)));
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.worship)  Object.assign(LIFE_STATE.worship, s.worship);
    if (s.fitness)  Object.assign(LIFE_STATE.fitness, s.fitness);
    if (s.work)     Object.assign(LIFE_STATE.work, s.work);
    if (s.content)  Object.assign(LIFE_STATE.content, s.content);
    if (s.tasks)    LIFE_STATE.tasks = s.tasks;
    if (s.schedule) Object.assign(LIFE_STATE.schedule, s.schedule);
  } catch(e) { console.warn('LifeOS load failed', e); }
}

function resetLifeState() {
  Object.assign(LIFE_STATE, JSON.parse(JSON.stringify(LIFE_STATE_DEFAULTS)));
}

/* ════════════════════════════════════════════════════════════
   MODULE 2 — HELPERS
   ════════════════════════════════════════════════════════════ */
function todayKey() { return new Date().toISOString().split('T')[0]; }

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(deadline) {
  if (!deadline) return false;
  return new Date(deadline) < new Date(todayKey());
}

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function elapsedString(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

/* ════════════════════════════════════════════════════════════
   MODULE 3 — HOME VIEW
   ════════════════════════════════════════════════════════════ */
function renderHomeView() {
  const main = document.getElementById('mainContent');
  const today = todayKey();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetingEmoji = hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙';

  // Worship summary
  const prayers = ['fajr','dhuhr','asr','maghrib','isha'];
  const prayerDone = prayers.filter(p => LIFE_STATE.worship.prayers[`${today}_${p}`]).length;

  // Fitness summary
  const fitProfile = LIFE_STATE.fitness.profile;
  const waterToday = LIFE_STATE.fitness.logs.water[today] || 0;

  // Tasks summary
  const todayTasks = LIFE_STATE.tasks.filter(t => !t.done && (!t.deadline || t.deadline <= today));
  const doneTasks  = LIFE_STATE.tasks.filter(t => t.done).length;
  const totalTasks = LIFE_STATE.tasks.length;

  // Work shift
  const activeShift = LIFE_STATE.work.activeShift;

  // Content ideas
  const ideasCount = LIFE_STATE.content.videoIdeas.length;

  // Overall progress from learning system (if available)
  let learnProg = { pct: 0 };
  if (typeof getOverallProgress === 'function') learnProg = getOverallProgress();

  // Today's comprehensive ring — combine all domains
  const domains = [
    { label: 'Prayers', icon: '🕌', done: prayerDone, total: 5, color: '#2d7a4f' },
    { label: 'Learning', icon: '🧠', done: learnProg.done || 0, total: Math.max(learnProg.total || 1, 1), color: '#6366f1', pct: learnProg.pct },
    { label: 'Water', icon: '💧', done: waterToday, total: 8, color: '#3b82f6' },
    { label: 'Tasks', icon: '✅', done: doneTasks, total: Math.max(totalTasks, 1), color: '#e67e22' },
  ];

  const overallDone  = domains.reduce((s, d) => s + Math.min(d.done, d.total), 0);
  const overallTotal = domains.reduce((s, d) => s + d.total, 0);
  const overallPct   = Math.round((overallDone / overallTotal) * 100);
  const r = 44, circ = 2 * Math.PI * r;
  const offset = circ - (overallPct / 100) * circ;

  const domainStats = domains.map(d => {
    const pct = d.pct !== undefined ? d.pct : Math.round((Math.min(d.done, d.total) / d.total) * 100);
    return `<div class="home-ring-stat-row">
      <span class="hsr-label">${d.icon} ${d.label}</span>
      <span class="hsr-val" style="color:${d.color}">${pct}%</span>
    </div>`;
  }).join('');

  const quickCards = [
    { icon: '🕌', label: 'Worship', sub: `${prayerDone}/5 prayers`, view: 'worship' },
    { icon: '💪', label: 'Fitness', sub: fitProfile ? `${waterToday}/8 cups` : 'Setup needed', view: 'fitness' },
    { icon: '💼', label: 'Work', sub: activeShift ? '🟢 On shift' : 'Off shift', view: 'work' },
    { icon: '🧠', label: 'Learning', sub: `${learnProg.pct || 0}% done`, view: 'daily' },
    { icon: '🎬', label: 'Content', sub: `${ideasCount} ideas`, view: 'content' },
    { icon: '✅', label: 'Tasks', sub: `${todayTasks.length} pending`, view: 'tasks' },
  ];

  main.innerHTML = `<div class="view-home">
    <div class="home-greeting">
      <div class="home-greeting-title">${greetingEmoji} ${greeting}</div>
      <div class="home-greeting-sub">${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</div>
    </div>

    <div class="home-quick-cards">
      ${quickCards.map(c => `
        <div class="hqc" data-view="${c.view}">
          <span class="hqc-icon">${c.icon}</span>
          <span class="hqc-label">${c.label}</span>
          <span class="hqc-count">${c.sub}</span>
        </div>`).join('')}
    </div>

    <div class="home-today-ring">
      <div class="home-ring-wrap">
        <div class="ring-chart">
          <svg class="ring-svg" viewBox="0 0 100 100" width="100" height="100">
            <circle class="ring-bg" cx="50" cy="50" r="${r}"/>
            <circle class="ring-fill" cx="50" cy="50" r="${r}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
          </svg>
          <div class="ring-text">${overallPct}%<span class="ring-text-sub">Today</span></div>
        </div>
      </div>
      <div class="home-ring-stats">${domainStats}</div>
    </div>

    ${activeShift ? `
    <div class="life-card" style="border-color:var(--work-border);background:var(--work-bg)">
      <div class="life-card-header">
        <span class="life-card-title">💼 Active Shift</span>
        <button class="clock-btn clock-out-btn" id="homeClockOut">Clock Out</button>
      </div>
      <div class="shift-elapsed" id="homeShiftElapsed">00:00</div>
      <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">Started at ${formatTime(activeShift.clockIn)}</div>
    </div>` : ''}

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">📝 Quick Task Add</span></div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="homeQuickTask" class="quick-capture-input" placeholder="Add a quick task…" style="flex:1;border-color:var(--border)"/>
        <button class="quick-capture-btn" id="homeQuickTaskAdd">Add</button>
      </div>
    </div>

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">🗓 Upcoming Tasks</span></div>
      ${todayTasks.slice(0,5).map(t => `
        <div class="custom-task-item" style="margin-bottom:8px">
          <div class="cti-check ${t.done?'checked':''}" data-taskid="${t.id}">${t.done?'✓':''}</div>
          <div class="cti-content">
            <div class="cti-title">${t.title}</div>
            <div class="cti-meta">
              <span class="cti-cat" style="${categoryStyle(t.category)}">${t.category}</span>
              ${t.deadline ? `<span class="cti-deadline ${isOverdue(t.deadline)?'overdue':''}">${formatDateShort(t.deadline)}</span>` : ''}
            </div>
          </div>
        </div>`).join('') || '<div style="color:var(--text-tertiary);font-size:13px;padding:8px 0">No pending tasks — you\'re clear! ✨</div>'}
    </div>
  </div>`;

  // Shift elapsed timer
  if (activeShift) {
    updateHomeShiftTimer();
    clearInterval(window._homeShiftTimer);
    window._homeShiftTimer = setInterval(updateHomeShiftTimer, 1000);
    document.getElementById('homeClockOut')?.addEventListener('click', clockOut);
  }

  // Quick card nav
  main.querySelectorAll('.hqc[data-view]').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.view));
  });

  // Quick task add
  const homeTaskInput = document.getElementById('homeQuickTask');
  document.getElementById('homeQuickTaskAdd')?.addEventListener('click', () => {
    const val = homeTaskInput?.value.trim();
    if (!val) return;
    addCustomTask({ title: val, category: 'Personal', priority: 'Medium' });
    if (homeTaskInput) homeTaskInput.value = '';
    renderHomeView();
  });
  homeTaskInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('homeQuickTaskAdd')?.click();
  });

  // Task checkboxes on home
  main.querySelectorAll('.cti-check[data-taskid]').forEach(el => {
    el.addEventListener('click', () => {
      toggleCustomTask(el.dataset.taskid);
      renderHomeView();
    });
  });
}

function updateHomeShiftTimer() {
  const el = document.getElementById('homeShiftElapsed');
  if (!el || !LIFE_STATE.work.activeShift) return;
  el.textContent = elapsedString(Date.now() - LIFE_STATE.work.activeShift.clockIn);
}

/* ════════════════════════════════════════════════════════════
   MODULE 4 — WORSHIP VIEW
   ════════════════════════════════════════════════════════════ */
const PRAYERS = [
  { id: 'fajr',    name: 'Fajr',    arabic: 'الفجر',   icon: '🌙', time: 'Before dawn' },
  { id: 'dhuhr',   name: 'Dhuhr',   arabic: 'الظهر',   icon: '☀️', time: 'Midday' },
  { id: 'asr',     name: 'Asr',     arabic: 'العصر',   icon: '🌤', time: 'Afternoon' },
  { id: 'maghrib', name: 'Maghrib', arabic: 'المغرب',  icon: '🌇', time: 'Sunset' },
  { id: 'isha',    name: 'Isha',    arabic: 'العشاء',   icon: '🌙', time: 'Night' },
];
const WORSHIP_EXTRAS = [
  { id: 'dhuha',          name: 'Dhuha',           sub: 'Nafl prayer after sunrise' },
  { id: 'morning_adhkar', name: 'Morning Adhkar',  sub: 'أذكار الصباح' },
  { id: 'evening_adhkar', name: 'Evening Adhkar',  sub: 'أذكار المساء' },
  { id: 'quran_done',     name: 'Quran Daily Wird', sub: 'Daily reading completed' },
];

function renderWorshipView() {
  const main  = document.getElementById('mainContent');
  const today = todayKey();
  const ws    = LIFE_STATE.worship;

  const prayerCards = PRAYERS.map(p => {
    const done = !!ws.prayers[`${today}_${p.id}`];
    return `<div class="prayer-card ${done ? 'done' : ''}" data-prayer="${p.id}">
      <span class="prayer-icon">${p.icon}</span>
      <div class="prayer-info">
        <div class="prayer-name">${p.name}</div>
        <div class="prayer-arabic">${p.arabic} · ${p.time}</div>
      </div>
      <div class="prayer-check">✓</div>
    </div>`;
  }).join('');

  const extraCards = WORSHIP_EXTRAS.map(e => {
    const done = !!ws.extras[`${today}_${e.id}`];
    return `<div class="worship-extra-card ${done ? 'done' : ''}" data-extra="${e.id}">
      <div class="wec-header">
        <span class="wec-title">${e.name}</span>
        <span class="wec-check">✓</span>
      </div>
      <div class="wec-sub">${e.sub}</div>
    </div>`;
  }).join('');

  const todayPrayers  = PRAYERS.filter(p => ws.prayers[`${today}_${p.id}`]).length;
  const quranToday    = ws.quran[today] || 0;
  const noteToday     = ws.notes[today] || '';
  const worshipStreak = ws.streak || 0;

  // Progress bar
  const totalWorship = PRAYERS.length + WORSHIP_EXTRAS.length;
  const doneWorship  = PRAYERS.filter(p => ws.prayers[`${today}_${p.id}`]).length +
                       WORSHIP_EXTRAS.filter(e => ws.extras[`${today}_${e.id}`]).length;
  const worshipPct   = Math.round((doneWorship / totalWorship) * 100);

  main.innerHTML = `<div class="view-worship">
    <div class="domain-header">
      <div class="domain-icon" style="background:var(--worship-bg);border:1px solid var(--worship-border)">🕌</div>
      <div class="domain-title-wrap">
        <div class="domain-title" style="color:var(--worship-text)">Worship</div>
        <div class="domain-subtitle">Daily spiritual practice tracker</div>
      </div>
    </div>

    <div class="worship-streak-banner">
      <span class="wsb-icon">🤲</span>
      <div class="wsb-text">
        <div class="wsb-title">${todayPrayers}/5 Prayers Today · ${worshipStreak}-day streak 🔥</div>
        <div class="wsb-sub">Daily progress: ${doneWorship}/${totalWorship} practices completed (${worshipPct}%)</div>
      </div>
    </div>

    <div class="life-card">
      <div class="life-card-header">
        <span class="life-card-title">🕌 Five Prayers</span>
        <span style="font-size:12px;color:var(--worship-text);font-weight:600">${todayPrayers}/5</span>
      </div>
      <div class="prayer-grid">${prayerCards}</div>
    </div>

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">✨ Daily Practices</span></div>
      <div class="worship-extras-grid">${extraCards}</div>
    </div>

    <div class="quran-tracker">
      <div class="qt-header">
        <span class="qt-title">📖 Quran — Daily Wird</span>
        <span class="qt-pages">${quranToday > 0 ? `${quranToday} pages today` : 'Not logged yet'}</span>
      </div>
      <div class="qt-input-row">
        <input type="number" class="qt-input" id="quranInput" placeholder="Pages read today…" value="${quranToday || ''}" min="0" max="604"/>
        <button class="qt-btn" id="quranSave">Save</button>
      </div>
    </div>

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">📝 Reflection Notes</span></div>
      <textarea class="notes-textarea" id="worshipNotes" placeholder="Write your thoughts, duas, and reflections for today…" style="min-height:120px">${noteToday}</textarea>
      <div class="notes-save-status" id="worshipNoteStatus">Auto-saved</div>
    </div>

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">📊 This Week</span></div>
      ${renderWorshipWeeklyChart()}
    </div>
  </div>`;

  bindWorshipEvents();
}

function renderWorshipWeeklyChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const done = PRAYERS.filter(p => LIFE_STATE.worship.prayers[`${key}_${p.id}`]).length;
    const day  = d.toLocaleDateString('en-US', { weekday: 'short' });
    days.push({ key, day, done });
  }
  return `<div style="display:flex;gap:8px;align-items:flex-end;height:64px">
    ${days.map(d => {
      const h = Math.round((d.done / 5) * 56);
      const isToday = d.key === todayKey();
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:100%;height:${h}px;min-height:4px;background:${isToday?'var(--worship-text)':'var(--worship-bg)'};border:1px solid var(--worship-border);border-radius:4px 4px 0 0;transition:height 400ms ease"></div>
        <span style="font-size:9px;color:var(--text-tertiary)">${d.day}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function bindWorshipEvents() {
  const today = todayKey();

  // Prayer toggles
  document.querySelectorAll('.prayer-card[data-prayer]').forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.dataset.prayer;
      const key = `${today}_${pid}`;
      LIFE_STATE.worship.prayers[key] = !LIFE_STATE.worship.prayers[key];
      if (LIFE_STATE.worship.prayers[key] && typeof addXP === 'function') addXP(10, `${pid.charAt(0).toUpperCase()+pid.slice(1)} prayer`);
      updateWorshipStreak();
      saveLifeState();
      renderWorshipView();
    });
  });

  // Extra practice toggles
  document.querySelectorAll('.worship-extra-card[data-extra]').forEach(card => {
    card.addEventListener('click', () => {
      const eid = card.dataset.extra;
      const key = `${today}_${eid}`;
      LIFE_STATE.worship.extras[key] = !LIFE_STATE.worship.extras[key];
      if (LIFE_STATE.worship.extras[key] && typeof addXP === 'function') addXP(8, eid.replace('_',' '));
      saveLifeState();
      renderWorshipView();
    });
  });

  // Quran save
  document.getElementById('quranSave')?.addEventListener('click', () => {
    const val = parseInt(document.getElementById('quranInput')?.value) || 0;
    LIFE_STATE.worship.quran[today] = val;
    saveLifeState();
    const status = document.querySelector('.qt-pages');
    if (status) status.textContent = `${val} pages today ✓`;
  });

  // Worship notes autosave
  let worshipNoteTimer;
  document.getElementById('worshipNotes')?.addEventListener('input', e => {
    LIFE_STATE.worship.notes[today] = e.target.value;
    const st = document.getElementById('worshipNoteStatus');
    if (st) { st.textContent = 'Saving…'; st.classList.remove('saved'); }
    clearTimeout(worshipNoteTimer);
    worshipNoteTimer = setTimeout(() => {
      saveLifeState();
      if (st) { st.textContent = '✓ Saved'; st.classList.add('saved'); }
    }, 800);
  });
}

function updateWorshipStreak() {
  const today = todayKey();
  const allPrayersDone = PRAYERS.every(p => LIFE_STATE.worship.prayers[`${today}_${p.id}`]);
  if (allPrayersDone) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (LIFE_STATE.worship.lastFullDay === yesterday) {
      LIFE_STATE.worship.streak++;
    } else if (LIFE_STATE.worship.lastFullDay !== today) {
      LIFE_STATE.worship.streak = 1;
    }
    LIFE_STATE.worship.lastFullDay = today;
    if (typeof addXP === 'function') addXP(30, 'All 5 prayers complete!');
  }
}

/* ════════════════════════════════════════════════════════════
   MODULE 5 — FITNESS VIEW
   ════════════════════════════════════════════════════════════ */

// Workout plans (gym and home based on profile)
function generateFitnessPlan(profile) {
  const isGym = profile.gym === 'gym';

  // Calorie calculation (Mifflin-St Jeor)
  const age = parseInt(profile.age) || 25;
  const h   = parseInt(profile.height) || 165; // cm
  const w   = parseInt(profile.weight) || 65;  // kg
  const activityMultipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  const mult = activityMultipliers[profile.activity] || 1.375;
  const bmr  = 10 * w + 6.25 * h - 5 * age - 161; // female formula
  const tdee = Math.round(bmr * mult);
  const targetCals = Math.round(tdee - 400); // moderate deficit
  const protein = Math.round(w * 2.2);       // 2.2g per kg
  const fat     = Math.round(targetCals * 0.28 / 9);
  const carbs   = Math.round((targetCals - protein * 4 - fat * 9) / 4);

  const gymWorkouts = {
    A: { name: 'Lower Body + Glutes', exercises: [
      { name: 'Barbell Squat',        sets: 4, reps: '8-10', rest: '90s', notes: 'Drive through heels, chest up' },
      { name: 'Romanian Deadlift',    sets: 3, reps: '10-12', rest: '60s', notes: 'Hip hinge, feel hamstring stretch' },
      { name: 'Hip Thrust',           sets: 4, reps: '12-15', rest: '60s', notes: 'Full hip extension at top' },
      { name: 'Leg Press',            sets: 3, reps: '12-15', rest: '60s', notes: 'Feet hip-width, controlled descent' },
      { name: 'Cable Kickback',       sets: 3, reps: '15 each', rest: '45s', notes: 'Squeeze glute at top' },
      { name: 'Calf Raises',          sets: 3, reps: '15-20', rest: '45s', notes: 'Full range of motion' },
    ]},
    B: { name: 'Upper Body + Core', exercises: [
      { name: 'Dumbbell Bench Press', sets: 4, reps: '8-10', rest: '90s', notes: 'Full range, controlled' },
      { name: 'Seated Cable Row',     sets: 3, reps: '10-12', rest: '60s', notes: 'Squeeze shoulder blades' },
      { name: 'Shoulder Press',       sets: 3, reps: '10-12', rest: '60s', notes: 'Core tight, no back arch' },
      { name: 'Lat Pulldown',         sets: 3, reps: '10-12', rest: '60s', notes: 'Pull to upper chest' },
      { name: 'Lateral Raises',       sets: 3, reps: '12-15', rest: '45s', notes: 'Light weight, controlled' },
      { name: 'Plank',                sets: 3, reps: '30-45s', rest: '45s', notes: 'Neutral spine, breathe' },
      { name: 'Bicycle Crunches',     sets: 3, reps: '20 each', rest: '30s', notes: 'Slow and controlled' },
    ]},
    C: { name: 'Full Body Tone', exercises: [
      { name: 'Goblet Squat',         sets: 3, reps: '12-15', rest: '60s', notes: 'Deep squat, chest up' },
      { name: 'Dumbbell Row',         sets: 3, reps: '10 each', rest: '60s', notes: 'Flat back, full pull' },
      { name: 'Glute Bridge',         sets: 3, reps: '15-20', rest: '45s', notes: 'Drive hips up fully' },
      { name: 'Arnold Press',         sets: 3, reps: '10-12', rest: '60s', notes: 'Rotate as you press up' },
      { name: 'Romanian Deadlift',    sets: 3, reps: '12', rest: '60s', notes: 'Feel the hamstring load' },
      { name: 'Tricep Pushdown',      sets: 3, reps: '12-15', rest: '45s', notes: 'Elbows locked at sides' },
      { name: 'Reverse Crunch',       sets: 3, reps: '15', rest: '30s', notes: 'Lift hips off floor' },
    ]},
  };

  const homeWorkouts = {
    A: { name: 'Lower Body + Glutes', exercises: [
      { name: 'Squat',                sets: 4, reps: '15-20', rest: '60s', notes: 'Bodyweight or with backpack weight' },
      { name: 'Glute Bridge',         sets: 4, reps: '20', rest: '45s', notes: 'Squeeze at top, hold 1 second' },
      { name: 'Reverse Lunge',        sets: 3, reps: '12 each', rest: '60s', notes: 'Control the knee' },
      { name: 'Donkey Kick',          sets: 3, reps: '15 each', rest: '45s', notes: 'Keep core tight' },
      { name: 'Sumo Squat Pulse',     sets: 3, reps: '20', rest: '45s', notes: 'Wide stance, partial reps' },
      { name: 'Calf Raises on Step',  sets: 3, reps: '20', rest: '30s', notes: 'Full extension' },
    ]},
    B: { name: 'Upper Body + Core', exercises: [
      { name: 'Push-ups',             sets: 4, reps: '10-15', rest: '60s', notes: 'Modify on knees if needed' },
      { name: 'Superman Hold',        sets: 3, reps: '12', rest: '45s', notes: 'Hold 2s at top' },
      { name: 'Tricep Dips (chair)',  sets: 3, reps: '12-15', rest: '60s', notes: 'Keep hips close to chair' },
      { name: 'Plank Hold',           sets: 3, reps: '30-45s', rest: '30s', notes: 'Breathe steadily' },
      { name: 'Side Plank',           sets: 3, reps: '20s each', rest: '30s', notes: 'Stack feet or stagger' },
      { name: 'Bicycle Crunch',       sets: 3, reps: '20 each', rest: '30s', notes: 'Slow and deliberate' },
    ]},
    C: { name: 'Cardio + Tone', exercises: [
      { name: 'Jump Rope / March',    sets: 3, reps: '2 min', rest: '60s', notes: 'Warm up properly' },
      { name: 'Squat Jump',           sets: 3, reps: '12', rest: '60s', notes: 'Soft landing' },
      { name: 'Mountain Climbers',    sets: 3, reps: '30s', rest: '45s', notes: 'Keep hips level' },
      { name: 'Hip Thrust (floor)',   sets: 3, reps: '20', rest: '45s', notes: 'Full glute squeeze at top' },
      { name: 'Inchworm',             sets: 3, reps: '10', rest: '45s', notes: 'Walk hands out, push-up optional' },
      { name: 'Cool-down stretch',    sets: 1, reps: '5 min', rest: '—', notes: 'Hip flexors, quads, hamstrings' },
    ]},
  };

  const plan = isGym ? gymWorkouts : homeWorkouts;
  const weeklySchedule = ['A', 'Rest', 'B', 'Rest', 'C', 'Cardio', 'Rest'];
  const cardio = {
    type: isGym ? 'Incline treadmill walk or elliptical' : 'Brisk walk, cycling, or dancing',
    duration: '30–40 min',
    frequency: '2–3×/week',
    notes: 'Low-to-moderate intensity. Heart rate 120–140 bpm. Best done after weights or on rest days.'
  };

  return { plan, weeklySchedule, nutrition: { calories: targetCals, protein, carbs, fat, tdee }, cardio };
}

function renderFitnessView() {
  const main    = document.getElementById('mainContent');
  const profile = LIFE_STATE.fitness.profile;

  if (!profile) {
    renderFitnessSetup();
    return;
  }

  const planData = LIFE_STATE.fitness.plan || generateFitnessPlan(profile);
  if (!LIFE_STATE.fitness.plan) { LIFE_STATE.fitness.plan = planData; saveLifeState(); }

  const today    = todayKey();
  const dow      = new Date().getDay(); // 0=Sun
  const schedIdx = [6,0,1,2,3,4,5][dow]; // Mon=0
  const todayType = planData.weeklySchedule[schedIdx] || 'Rest';
  const workout   = planData.plan[todayType];
  const waterToday = LIFE_STATE.fitness.logs.water[today] || 0;
  const bodyLogs   = LIFE_STATE.fitness.logs.body.slice(-5).reverse();

  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const schedPills = planData.weeklySchedule.map((t, i) => {
    const isToday = i === schedIdx;
    const color = t === 'Rest' ? 'var(--text-tertiary)' : t === 'Cardio' ? '#3b82f6' : 'var(--fitness-text)';
    return `<div style="text-align:center;flex:1">
      <div style="font-size:9px;color:var(--text-tertiary);margin-bottom:3px">${dayLabels[i]}</div>
      <div style="padding:4px 2px;border-radius:6px;font-size:10px;font-weight:600;
        background:${isToday?color:'transparent'};color:${isToday?'white':color};
        border:1px solid ${isToday?color:'var(--border)'};">${t}</div>
    </div>`;
  }).join('');

  main.innerHTML = `<div class="view-fitness">
    <div class="domain-header">
      <div class="domain-icon" style="background:var(--fitness-bg);border:1px solid var(--fitness-border)">💪</div>
      <div class="domain-title-wrap">
        <div class="domain-title" style="color:var(--fitness-text)">Fitness</div>
        <div class="domain-subtitle">Body recomposition system</div>
      </div>
    </div>

    <div class="life-card">
      <div class="life-card-header">
        <span class="life-card-title">📅 Weekly Schedule</span>
        <button class="life-card-action" id="fitnessResetBtn">Edit Profile</button>
      </div>
      <div style="display:flex;gap:4px">${schedPills}</div>
    </div>

    ${todayType !== 'Rest' ? `
    <div class="life-card">
      <div class="life-card-header">
        <span class="life-card-title">🏋️ Today: ${todayType === 'Cardio' ? 'Cardio' : `Workout ${todayType} — ${workout?.name || ''}`}</span>
        <span style="font-size:12px;color:var(--fitness-text)">${countWorkoutDone(today, todayType, workout)}</span>
      </div>
      ${todayType === 'Cardio' ? renderCardioCard(planData.cardio) : renderExerciseList(today, todayType, workout)}
    </div>` : `
    <div class="life-card" style="text-align:center;padding:var(--sp-6)">
      <div style="font-size:32px;margin-bottom:8px">🛌</div>
      <div style="font-size:14px;font-weight:600;color:var(--text-primary)">Rest Day</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Recovery is part of the process. Rest well.</div>
    </div>`}

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">🥗 Nutrition Targets</span></div>
      <div class="macro-grid">
        <div class="macro-card">
          <div class="macro-val">${planData.nutrition.calories}</div>
          <div class="macro-label">Calories</div>
          <div class="macro-unit">kcal/day</div>
        </div>
        <div class="macro-card" style="border-color:rgba(239,68,68,0.3)">
          <div class="macro-val" style="color:var(--fitness-text)">${planData.nutrition.protein}g</div>
          <div class="macro-label">Protein</div>
          <div class="macro-unit">priority #1</div>
        </div>
        <div class="macro-card" style="border-color:rgba(245,158,11,0.3)">
          <div class="macro-val" style="color:var(--warning)">${planData.nutrition.carbs}g</div>
          <div class="macro-label">Carbs</div>
          <div class="macro-unit">g/day</div>
        </div>
        <div class="macro-card" style="border-color:rgba(99,102,241,0.3)">
          <div class="macro-val" style="color:var(--accent)">${planData.nutrition.fat}g</div>
          <div class="macro-label">Fat</div>
          <div class="macro-unit">g/day</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">TDEE: ${planData.nutrition.tdee} kcal · Deficit: ~400 kcal · Sustainable fat loss</div>
    </div>

    <div class="life-card">
      <div class="life-card-header">
        <span class="life-card-title">💧 Water Tracker</span>
        <span style="font-size:12px;color:#3b82f6;font-weight:600">${waterToday}/8 cups</span>
      </div>
      <div class="water-tracker" id="waterTracker">
        ${Array(8).fill(0).map((_,i) =>
          `<div class="water-cup ${i < waterToday ? 'filled' : ''}" data-cup="${i+1}">💧</div>`
        ).join('')}
      </div>
    </div>

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">📊 Body Progress Log</span></div>
      <div class="body-log-form" id="bodyLogForm">
        <div class="body-log-group">
          <span class="body-log-label">Weight (kg)</span>
          <input type="number" class="body-log-input" id="logWeight" placeholder="${profile.weight}" step="0.1"/>
        </div>
        <div class="body-log-group">
          <span class="body-log-label">Waist (cm)</span>
          <input type="number" class="body-log-input" id="logWaist" placeholder="—" step="0.5"/>
        </div>
        <div class="body-log-group">
          <span class="body-log-label">Hips (cm)</span>
          <input type="number" class="body-log-input" id="logHips" placeholder="—" step="0.5"/>
        </div>
        <button class="body-log-submit" id="bodyLogSave">Log</button>
      </div>
      <div class="log-entries">
        ${bodyLogs.map(l => `
          <div class="log-entry">
            <span class="log-entry-date">${formatDateShort(l.date)}</span>
            <span class="log-entry-vals">${l.weight}kg${l.waist ? ' · ' + l.waist + 'cm waist' : ''}${l.hips ? ' · ' + l.hips + 'cm hips' : ''}</span>
          </div>`).join('') || '<div style="font-size:12px;color:var(--text-tertiary)">No logs yet. Start tracking your progress.</div>'}
      </div>
    </div>

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">🏃 Cardio Guide</span></div>
      ${renderCardioCard(planData.cardio)}
    </div>
  </div>`;

  bindFitnessEvents(today, todayType, workout);
}

function renderCardioCard(cardio) {
  return `<div style="display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <span class="badge badge-phase">🏃 ${cardio.type}</span>
      <span class="badge badge-time">⏱ ${cardio.duration}</span>
      <span class="badge badge-week">📆 ${cardio.frequency}</span>
    </div>
    <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;padding:8px;background:var(--bg-elevated);border-radius:8px">${cardio.notes}</div>
  </div>`;
}

function renderExerciseList(today, type, workout) {
  if (!workout) return '<div style="font-size:13px;color:var(--text-tertiary)">No workout data</div>';
  return `<div class="exercise-list">
    ${workout.exercises.map((ex, i) => {
      const key  = `${today}_${type}_${i}`;
      const done = !!LIFE_STATE.fitness.logs.workouts[key];
      return `<div class="exercise-item ${done?'done':''}" data-exkey="${key}">
        <div class="ex-check">✓</div>
        <div class="ex-info">
          <div class="ex-name">${ex.name}</div>
          <div class="ex-meta">${ex.sets} sets × ${ex.reps} · Rest ${ex.rest} · ${ex.notes}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function countWorkoutDone(today, type, workout) {
  if (!workout) return '';
  const total = workout.exercises.length;
  const done  = workout.exercises.filter((_, i) => LIFE_STATE.fitness.logs.workouts[`${today}_${type}_${i}`]).length;
  return `${done}/${total} done`;
}

function bindFitnessEvents(today, todayType, workout) {
  // Exercise checkboxes
  document.querySelectorAll('.exercise-item[data-exkey]').forEach(item => {
    item.addEventListener('click', () => {
      const key = item.dataset.exkey;
      LIFE_STATE.fitness.logs.workouts[key] = !LIFE_STATE.fitness.logs.workouts[key];
      if (LIFE_STATE.fitness.logs.workouts[key] && typeof addXP === 'function') addXP(10, 'Exercise complete');
      saveLifeState();
      renderFitnessView();
    });
  });

  // Water cups
  document.querySelectorAll('.water-cup').forEach(cup => {
    cup.addEventListener('click', () => {
      const n = parseInt(cup.dataset.cup);
      LIFE_STATE.fitness.logs.water[today] = (LIFE_STATE.fitness.logs.water[today] === n) ? n - 1 : n;
      saveLifeState();
      renderFitnessView();
    });
  });

  // Body log
  document.getElementById('bodyLogSave')?.addEventListener('click', () => {
    const w = parseFloat(document.getElementById('logWeight')?.value);
    const waist = parseFloat(document.getElementById('logWaist')?.value) || null;
    const hips  = parseFloat(document.getElementById('logHips')?.value) || null;
    if (!w) return;
    LIFE_STATE.fitness.logs.body.push({ date: today, weight: w, waist, hips });
    if (typeof addXP === 'function') addXP(5, 'Progress logged');
    saveLifeState();
    renderFitnessView();
  });

  // Reset / edit profile
  document.getElementById('fitnessResetBtn')?.addEventListener('click', () => {
    renderFitnessSetup();
  });
}

function renderFitnessSetup() {
  const overlay = document.getElementById('fitnessSetupOverlay');
  const body    = document.getElementById('fitnessSetupBody');
  const profile = LIFE_STATE.fitness.profile || {};
  if (!overlay || !body) return;

  body.innerHTML = `<div class="fitness-setup-form">
    <div class="fsetup-grid">
      <div class="fsetup-row">
        <label class="fsetup-label">Age</label>
        <input type="number" class="fsetup-input" id="fs_age" value="${profile.age||''}" placeholder="25" min="16" max="70"/>
      </div>
      <div class="fsetup-row">
        <label class="fsetup-label">Height (cm)</label>
        <input type="number" class="fsetup-input" id="fs_height" value="${profile.height||''}" placeholder="165"/>
      </div>
      <div class="fsetup-row">
        <label class="fsetup-label">Current Weight (kg)</label>
        <input type="number" class="fsetup-input" id="fs_weight" value="${profile.weight||''}" placeholder="65" step="0.5"/>
      </div>
      <div class="fsetup-row">
        <label class="fsetup-label">Est. Body Fat %</label>
        <input type="number" class="fsetup-input" id="fs_bf" value="${profile.bf||''}" placeholder="25" min="10" max="50"/>
      </div>
    </div>
    <div class="fsetup-row">
      <label class="fsetup-label">Activity Level</label>
      <select class="fsetup-select" id="fs_activity">
        <option value="sedentary" ${profile.activity==='sedentary'?'selected':''}>Sedentary (desk job, no exercise)</option>
        <option value="light" ${profile.activity==='light'?'selected':''}>Lightly Active (1-3 days/week)</option>
        <option value="moderate" ${profile.activity==='moderate'?'selected':''}>Moderately Active (3-5 days/week)</option>
        <option value="active" ${profile.activity==='active'?'selected':''}>Very Active (6-7 days/week)</option>
      </select>
    </div>
    <div class="fsetup-row">
      <label class="fsetup-label">Training Location</label>
      <select class="fsetup-select" id="fs_gym">
        <option value="gym" ${profile.gym==='gym'?'selected':''}>🏋️ Gym (full equipment)</option>
        <option value="home" ${profile.gym==='home'?'selected':''}>🏠 Home (bodyweight/minimal)</option>
      </select>
    </div>
    <div class="fsetup-row">
      <label class="fsetup-label">Injuries or Limitations (optional)</label>
      <input type="text" class="fsetup-input" id="fs_injuries" value="${profile.injuries||''}" placeholder="e.g. knee pain, lower back issues"/>
    </div>
    <div class="fsetup-row">
      <label class="fsetup-label">Food Preferences (optional)</label>
      <input type="text" class="fsetup-input" id="fs_diet" value="${profile.diet||''}" placeholder="e.g. no pork, vegetarian, lactose-free"/>
    </div>
    <button class="fsetup-submit" id="fsetupSave">Generate My Personal Plan 💪</button>
  </div>`;

  overlay.classList.add('open');

  document.getElementById('fsetupSave')?.addEventListener('click', () => {
    const newProfile = {
      age: document.getElementById('fs_age')?.value,
      height: document.getElementById('fs_height')?.value,
      weight: document.getElementById('fs_weight')?.value,
      bf: document.getElementById('fs_bf')?.value,
      activity: document.getElementById('fs_activity')?.value,
      gym: document.getElementById('fs_gym')?.value,
      injuries: document.getElementById('fs_injuries')?.value,
      diet: document.getElementById('fs_diet')?.value
    };
    if (!newProfile.age || !newProfile.weight) {
      alert('Please fill in at least age and weight.');
      return;
    }
    LIFE_STATE.fitness.profile = newProfile;
    LIFE_STATE.fitness.plan = generateFitnessPlan(newProfile);
    saveLifeState();
    overlay.classList.remove('open');
    renderFitnessView();
    if (typeof addXP === 'function') addXP(20, 'Fitness profile created!');
  });

  document.getElementById('fitnessSetupClose')?.addEventListener('click', () => {
    overlay.classList.remove('open');
    const main = document.getElementById('mainContent');
    if (!LIFE_STATE.fitness.profile && main) {
      main.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">💪</div>
        <div class="empty-state-title">No Fitness Profile Yet</div>
        <div class="empty-state-sub">Set up your profile to get a personalized workout and nutrition plan.</div>
        <button class="pom-btn pom-btn-primary" id="fitnessSetupBtn" style="margin-top:16px">Create My Plan</button>
      </div>`;
      document.getElementById('fitnessSetupBtn')?.addEventListener('click', renderFitnessSetup);
    }
  });
}

/* ════════════════════════════════════════════════════════════
   MODULE 6 — WORK VIEW
   ════════════════════════════════════════════════════════════ */
function renderWorkView() {
  const main  = document.getElementById('mainContent');
  const today = todayKey();
  const ws    = LIFE_STATE.work;
  const notes = ws.notes[today] || [];
  const shift = ws.activeShift;

  // Today's shift from logs
  const todayShift = ws.shifts.find(s => s.date === today);

  main.innerHTML = `<div class="view-work">
    <div class="domain-header">
      <div class="domain-icon" style="background:var(--work-bg);border:1px solid var(--work-border)">💼</div>
      <div class="domain-title-wrap">
        <div class="domain-title" style="color:var(--work-text)">Work</div>
        <div class="domain-subtitle">Work shift tracker & notes</div>
      </div>
    </div>

    <div class="shift-card">
      <div class="life-card-header" style="margin-bottom:0">
        <span class="life-card-title">⏰ Shift Tracker</span>
        <span class="shift-badge">${shift ? '🟢 On Shift' : todayShift ? '✅ Done' : '⚫ Off'}</span>
      </div>

      ${shift ? `
        <div class="shift-elapsed" id="shiftElapsedDisplay">00:00</div>
        <div style="font-size:12px;color:var(--text-tertiary)">Started at ${formatTime(shift.clockIn)}</div>
        <div class="shift-time-row">
          <button class="clock-btn clock-out-btn" id="clockOutBtn">🕐 Clock Out</button>
        </div>
      ` : todayShift ? `
        <div style="font-size:13px;color:var(--text-secondary)">
          Shift: ${formatTime(todayShift.clockIn)} → ${formatTime(todayShift.clockOut)}
          · Duration: ${elapsedString(todayShift.clockOut - todayShift.clockIn)}
        </div>
      ` : `
        <div class="shift-time-row">
          <button class="clock-btn clock-in-btn" id="clockInBtn">🟢 Clock In</button>
        </div>
        <div style="font-size:12px;color:var(--text-tertiary)">Track your shifts, notes and tasks.</div>
      `}
    </div>

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">⚡ Quick Capture</span></div>
      <div class="quick-capture-form">
        <input type="text" class="quick-capture-input" id="workNoteInput" placeholder="Type anything — observation, idea, task…"/>
        <button class="quick-capture-btn" id="workNoteAdd">Save</button>
      </div>
      <div class="work-notes-list" id="workNotesList">
        ${(notes.slice(-10).reverse()).map(n => `
          <div class="work-note-item">
            <span class="wni-text">${n.text}</span>
            <span class="wni-time">${n.time}</span>
          </div>`).join('') || '<div style="font-size:12px;color:var(--text-tertiary)">No notes yet today.</div>'}
      </div>
    </div>

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">✅ Today's Work Tasks</span></div>
      ${renderWorkTasks(today)}
      <div style="display:flex;gap:8px;margin-top:12px">
        <input type="text" class="quick-capture-input" id="workTaskInput" placeholder="Add work task…" style="flex:1"/>
        <button class="quick-capture-btn" id="workTaskAdd" style="background:var(--work-text)">Add</button>
      </div>
    </div>

    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">📝 Shift Notes</span></div>
      <textarea class="notes-textarea" id="workShiftNotes" placeholder="Observations, problems noticed, ideas for improvement, store feedback…" style="min-height:140px">${todayShift?.notes || ws.shifts.find(s=>s.date===today)?.notes || ''}</textarea>
    </div>
  </div>`;

  bindWorkEvents(today);
  if (shift) {
    updateShiftTimer();
    clearInterval(window._shiftTimer);
    window._shiftTimer = setInterval(updateShiftTimer, 1000);
  }
}

function renderWorkTasks(today) {
  const tasks = LIFE_STATE.work.tasks[today] || [];
  return `<div class="exercise-list" id="workTaskList">
    ${tasks.map((t, i) => `
      <div class="exercise-item ${t.done?'done':''}" style="border-color:${t.done?'var(--work-border)':'var(--border)'}">
        <div class="ex-check" data-worktask="${i}" style="${t.done?'background:var(--work-text);border-color:var(--work-text);color:white':''}">✓</div>
        <div class="ex-info"><div class="ex-name">${t.text}</div></div>
      </div>`).join('') || '<div style="font-size:12px;color:var(--text-tertiary)">No tasks yet.</div>'}
  </div>`;
}

function bindWorkEvents(today) {
  document.getElementById('clockInBtn')?.addEventListener('click', clockIn);
  document.getElementById('clockOutBtn')?.addEventListener('click', clockOut);

  // Quick capture
  const noteInput = document.getElementById('workNoteInput');
  document.getElementById('workNoteAdd')?.addEventListener('click', () => {
    const val = noteInput?.value.trim();
    if (!val) return;
    if (!LIFE_STATE.work.notes[today]) LIFE_STATE.work.notes[today] = [];
    LIFE_STATE.work.notes[today].push({ text: val, time: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) });
    if (noteInput) noteInput.value = '';
    saveLifeState();
    renderWorkView();
  });
  noteInput?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('workNoteAdd')?.click(); });

  // Work tasks
  const taskInput = document.getElementById('workTaskInput');
  document.getElementById('workTaskAdd')?.addEventListener('click', () => {
    const val = taskInput?.value.trim();
    if (!val) return;
    if (!LIFE_STATE.work.tasks[today]) LIFE_STATE.work.tasks[today] = [];
    LIFE_STATE.work.tasks[today].push({ text: val, done: false });
    if (taskInput) taskInput.value = '';
    saveLifeState();
    renderWorkView();
  });

  // Work task toggle
  document.querySelectorAll('.ex-check[data-worktask]').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.worktask);
      if (LIFE_STATE.work.tasks[today]?.[i]) {
        LIFE_STATE.work.tasks[today][i].done = !LIFE_STATE.work.tasks[today][i].done;
        saveLifeState();
        renderWorkView();
      }
    });
  });

  // Shift notes autosave
  let shiftNoteTimer;
  document.getElementById('workShiftNotes')?.addEventListener('input', e => {
    const s = LIFE_STATE.work.shifts.find(sh => sh.date === today);
    if (s) { s.notes = e.target.value; }
    clearTimeout(shiftNoteTimer);
    shiftNoteTimer = setTimeout(() => saveLifeState(), 1000);
  });
}

function clockIn() {
  LIFE_STATE.work.activeShift = { clockIn: Date.now() };
  saveLifeState();
  renderWorkView();
  if (typeof addXP === 'function') addXP(5, 'Shift started');
}

function clockOut() {
  if (!LIFE_STATE.work.activeShift) return;
  const today = todayKey();
  const shift = {
    date: today,
    clockIn: LIFE_STATE.work.activeShift.clockIn,
    clockOut: Date.now(),
    notes: document.getElementById('workShiftNotes')?.value || ''
  };
  LIFE_STATE.work.shifts.push(shift);
  LIFE_STATE.work.activeShift = null;
  if (typeof addXP === 'function') addXP(15, 'Shift completed!');
  clearInterval(window._shiftTimer);
  clearInterval(window._homeShiftTimer);
  saveLifeState();
  renderWorkView();
}

function updateShiftTimer() {
  const el = document.getElementById('shiftElapsedDisplay');
  if (!el || !LIFE_STATE.work.activeShift) return;
  el.textContent = elapsedString(Date.now() - LIFE_STATE.work.activeShift.clockIn);
}

/* ════════════════════════════════════════════════════════════
   MODULE 7 — CONTENT VIEW
   ════════════════════════════════════════════════════════════ */
const CONTENT_HOOKS = [];
const EDITING_SKILLS = [];
const GROWTH_PRINCIPLES = [];

let contentActiveTab = 'ideas';
let contentCalWeekOffset = 0;

function renderContentView() {
  const main = document.getElementById('mainContent');

  main.innerHTML = `<div class="view-content">
    <div class="domain-header">
      <div class="domain-icon" style="background:var(--content-bg);border:1px solid var(--content-border)">🎬</div>
      <div class="domain-title-wrap">
        <div class="domain-title" style="color:var(--content-text)">Content Creation</div>
        <div class="domain-subtitle">Plan and track your content</div>
      </div>
    </div>

    <div class="content-tabs">
      <button class="content-tab ${contentActiveTab==='ideas'?'active':''}" data-ctab="ideas">💡 Video Ideas</button>
      <button class="content-tab ${contentActiveTab==='calendar'?'active':''}" data-ctab="calendar">📅 Calendar</button>
      <button class="content-tab ${contentActiveTab==='hooks'?'active':''}" data-ctab="hooks">🎣 Hooks & Scripts</button>
      <button class="content-tab ${contentActiveTab==='growth'?'active':''}" data-ctab="growth">📈 Growth</button>
      <button class="content-tab ${contentActiveTab==='editing'?'active':''}" data-ctab="editing">✂️ Editing Skills</button>
    </div>

    <div id="contentTabContent">${renderContentTab(contentActiveTab)}</div>
  </div>`;

  // Tab switching
  document.querySelectorAll('.content-tab[data-ctab]').forEach(tab => {
    tab.addEventListener('click', () => {
      contentActiveTab = tab.dataset.ctab;
      document.querySelectorAll('.content-tab').forEach(t => t.classList.toggle('active', t.dataset.ctab === contentActiveTab));
      document.getElementById('contentTabContent').innerHTML = renderContentTab(contentActiveTab);
      bindContentTabEvents(contentActiveTab);
    });
  });

  bindContentTabEvents(contentActiveTab);
}

function renderContentTab(tab) {
  switch(tab) {
    case 'ideas':    return renderContentIdeas();
    case 'calendar': return renderContentCalendar();
    case 'hooks':    return renderContentHooks();
    case 'growth':   return renderContentGrowth();
    case 'editing':  return renderEditingSkills();
    default:         return '';
  }
}

function renderContentIdeas() {
  const cols = ['Idea 💡', 'Scripted 📝', 'Filmed 🎥', 'Edited ✂️', 'Posted ✅'];
  const statuses = ['idea','scripted','filmed','edited','posted'];
  const ideas = LIFE_STATE.content.videoIdeas;

  const colHtml = cols.map((col, ci) => {
    const colIdeas = ideas.filter(v => v.status === statuses[ci]);
    return `<div class="kanban-col">
      <div class="kanban-col-title">${col} <span style="color:var(--text-primary);margin-left:4px">${colIdeas.length}</span></div>
      ${colIdeas.map(v => `<div class="kanban-card" data-ideaid="${v.id}">
        <div style="font-size:12px;font-weight:500;margin-bottom:4px">${v.title}</div>
        ${v.hook ? `<div style="font-size:10px;color:var(--text-tertiary);font-style:italic">"${v.hook.slice(0,50)}…"</div>` : ''}
        <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
          ${statuses.filter(s => s !== statuses[ci]).map(s =>
            `<button style="font-size:9px;padding:2px 6px;border-radius:4px;border:1px solid var(--border);color:var(--text-tertiary)" data-moveidea="${v.id}" data-tostatus="${s}">${s}</button>`
          ).join('')}
          <button style="font-size:9px;padding:2px 6px;border-radius:4px;border:1px solid rgba(239,68,68,0.3);color:#ef4444" data-deleteidea="${v.id}">✕</button>
        </div>
      </div>`).join('')}
      <button class="kanban-add" data-addcol="${ci}">+ Add idea</button>
    </div>`;
  }).join('');

  return `<div>
    <div class="kanban-board">${colHtml}</div>
    <div class="life-card" style="margin-top:12px">
      <div class="life-card-header"><span class="life-card-title">📊 Growth Tracker</span></div>
      <div class="growth-log-form">
        <div class="growth-input-group">
          <span class="growth-input-label">Followers</span>
          <input type="number" class="growth-input" id="growthFollowers" placeholder="0"/>
        </div>
        <div class="growth-input-group">
          <span class="growth-input-label">Posts</span>
          <input type="number" class="growth-input" id="growthPosts" placeholder="0"/>
        </div>
        <div class="growth-input-group">
          <span class="growth-input-label">Avg Views</span>
          <input type="number" class="growth-input" id="growthViews" placeholder="0"/>
        </div>
        <button class="growth-submit" id="growthLogSave">Log</button>
      </div>
      ${LIFE_STATE.content.growthLog.slice(-5).reverse().map(l => `
        <div class="log-entry">
          <span class="log-entry-date">${formatDateShort(l.date)}</span>
          <span class="log-entry-vals">👥 ${l.followers} · 📹 ${l.posts} posts · 👁 ${l.views} avg</span>
        </div>`).join('') || '<div style="font-size:12px;color:var(--text-tertiary)">Log your first stats.</div>'}
    </div>
  </div>`;
}

function renderContentCalendar() {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + contentCalWeekOffset * 7);
  // Get Monday
  const dayOfWeek = baseDate.getDay();
  const diff = (dayOfWeek + 6) % 7;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - diff);

  const weekLabel = monday.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const days = Array(7).fill(0).map((_,i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return { date: d.toISOString().split('T')[0], day: d.toLocaleDateString('en-US',{weekday:'short'}) };
  });

  const cal = LIFE_STATE.content.calendar;
  const dayCells = days.map(d => {
    const entries = cal[d.date] || [];
    return `<div class="content-cal-day">
      <div class="content-cal-day-header">${d.day} ${new Date(d.date+'T12:00:00').getDate()}</div>
      ${entries.map(e => `<div class="content-cal-entry" data-calentry="${d.date}">${e.title}</div>`).join('')}
      <button style="font-size:10px;color:var(--text-tertiary);padding:2px;width:100%;text-align:left" data-addcalday="${d.date}">+ Add</button>
    </div>`;
  }).join('');

  return `<div>
    <div class="content-week-nav">
      <button data-calshift="-1">← Prev</button>
      <span>Week of ${weekLabel}</span>
      <button data-calshift="1">Next →</button>
    </div>
    <div class="content-cal-grid">${dayCells}</div>
  </div>`;
}

function renderContentHooks() {
  return `<div>
    <div class="strategy-section">
      <div class="strategy-section-title">🎣 Hook Library</div>
      <div class="hook-list">
        ${CONTENT_HOOKS.map(h => `<div class="hook-card" data-hook="${h}">${h}</div>`).join('') || '<div class="empty-state">No saved hooks yet.</div>'}
      </div>
    </div>

    <div class="strategy-section" style="margin-top:20px">
      <div class="strategy-section-title">📜 Script Templates</div>
      <div class="strategy-grid">
        ${[
          { icon: '🧭', title: 'Progress update', desc: 'Starting point → What changed → What you learned → Next step' },
          { icon: '📚', title: 'Explainer', desc: 'Question → Context → Key points → Takeaway' },
          { icon: '🔧', title: 'Tutorial', desc: 'Goal → Materials → Steps → Result' },
          { icon: '💬', title: 'Reflection', desc: 'Situation → Observation → Insight → Open question' },
        ].map(t => `<div class="strategy-card">
          <div class="strategy-card-icon">${t.icon}</div>
          <div class="strategy-card-title">${t.title}</div>
          <div class="strategy-card-desc">${t.desc}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderContentGrowth() {
  return `<div>
    <div class="strategy-section">
      <div class="strategy-section-title">📈 Content Principles</div>
      <div class="strategy-grid">
        ${GROWTH_PRINCIPLES.map(g => `<div class="strategy-card">
          <div class="strategy-card-icon">${g.icon}</div>
          <div class="strategy-card-title">${g.title}</div>
          <div class="strategy-card-desc">${g.desc}</div>
        </div>`).join('') || '<div class="empty-state">Add your own content principles as notes or tasks.</div>'}
      </div>
    </div>
    <div class="strategy-section" style="margin-top:20px">
      <div class="strategy-section-title">🎯 Weekly Review</div>
      ${['Review this week\'s published work',
        'Note what worked and what did not',
        'Plan next week\'s content',
        'Update your progress metrics'
        ].map((item, i) => {
          const key = `content_weekly_${i}`;
          const done = !!LIFE_STATE.content.skills[key];
          return `<div class="skill-item ${done?'done':''}" data-skillid="${key}" style="margin-bottom:8px;border-radius:10px">
            <div class="skill-check">✓</div>
            <div class="skill-info"><div class="skill-name">${item}</div></div>
          </div>`;
        }).join('')}
    </div>
  </div>`;
}

function renderEditingSkills() {
  return `<div>
    <div class="life-card">
      <div class="life-card-header"><span class="life-card-title">✂️ Editing Skills</span></div>
      <div class="skill-list">
        ${EDITING_SKILLS.map(skill => {
          const done = !!LIFE_STATE.content.skills[skill.id];
          return `<div class="skill-item ${done?'done':''}" data-skillid="${skill.id}">
            <div class="skill-check">✓</div>
            <div class="skill-info">
              <div class="skill-name">${skill.name}</div>
              <div class="skill-resource">📌 ${skill.resource}</div>
            </div>
          </div>`;
        }).join('') || '<div class="empty-state">No default skill roadmap. Add your own learning goals.</div>'}
      </div>
    </div>
  </div>`;
}

function bindContentTabEvents(tab) {
  // Skills / checklist items
  document.querySelectorAll('.skill-item[data-skillid]').forEach(item => {
    item.addEventListener('click', () => {
      const sid = item.dataset.skillid;
      LIFE_STATE.content.skills[sid] = !LIFE_STATE.content.skills[sid];
      if (LIFE_STATE.content.skills[sid] && typeof addXP === 'function') addXP(8, 'Editing skill mastered');
      saveLifeState();
      item.classList.toggle('done', !!LIFE_STATE.content.skills[sid]);
      item.querySelector('.skill-check').style.background = LIFE_STATE.content.skills[sid] ? 'var(--content-text)' : '';
      item.querySelector('.skill-check').style.borderColor = LIFE_STATE.content.skills[sid] ? 'var(--content-text)' : '';
      item.querySelector('.skill-check').style.color = LIFE_STATE.content.skills[sid] ? 'white' : 'transparent';
    });
  });

  // Hook copy on click
  document.querySelectorAll('.hook-card[data-hook]').forEach(card => {
    card.addEventListener('click', () => {
      navigator.clipboard?.writeText(card.dataset.hook).catch(() => {});
      card.style.borderColor = 'var(--content-text)';
      setTimeout(() => card.style.borderColor = '', 800);
    });
  });

  // Kanban: move idea
  document.querySelectorAll('[data-moveidea]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idea = LIFE_STATE.content.videoIdeas.find(v => v.id === btn.dataset.moveidea);
      if (idea) { idea.status = btn.dataset.tostatus; saveLifeState(); renderContentView(); }
    });
  });

  // Kanban: delete idea
  document.querySelectorAll('[data-deleteidea]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      LIFE_STATE.content.videoIdeas = LIFE_STATE.content.videoIdeas.filter(v => v.id !== btn.dataset.deleteidea);
      saveLifeState();
      renderContentView();
    });
  });

  // Kanban: add idea
  document.querySelectorAll('[data-addcol]').forEach(btn => {
    btn.addEventListener('click', () => {
      const statuses = ['idea','scripted','filmed','edited','posted'];
      const title = prompt('Video idea title:');
      if (!title) return;
      const hook = prompt('Hook (opening line) — optional:') || '';
      LIFE_STATE.content.videoIdeas.push({ id: uid(), title, hook, status: statuses[parseInt(btn.dataset.addcol)], createdAt: todayKey() });
      if (typeof addXP === 'function') addXP(5, 'Content idea added');
      saveLifeState();
      renderContentView();
    });
  });

  // Calendar: add entry
  document.querySelectorAll('[data-addcalday]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.addcalday;
      const title = prompt('Content for this day:');
      if (!title) return;
      if (!LIFE_STATE.content.calendar[d]) LIFE_STATE.content.calendar[d] = [];
      LIFE_STATE.content.calendar[d].push({ title, type: 'video' });
      saveLifeState();
      renderContentView();
    });
  });

  // Calendar week nav
  document.querySelectorAll('[data-calshift]').forEach(btn => {
    btn.addEventListener('click', () => {
      contentCalWeekOffset += parseInt(btn.dataset.calshift);
      document.getElementById('contentTabContent').innerHTML = renderContentTab('calendar');
      bindContentTabEvents('calendar');
    });
  });

  // Growth log
  document.getElementById('growthLogSave')?.addEventListener('click', () => {
    const f = parseInt(document.getElementById('growthFollowers')?.value) || 0;
    const p = parseInt(document.getElementById('growthPosts')?.value) || 0;
    const v = parseInt(document.getElementById('growthViews')?.value) || 0;
    LIFE_STATE.content.growthLog.push({ date: todayKey(), followers: f, posts: p, views: v });
    if (typeof addXP === 'function') addXP(10, 'Growth stats logged');
    saveLifeState();
    renderContentView();
  });
}

/* ════════════════════════════════════════════════════════════
   MODULE 8 — TASKS VIEW
   ════════════════════════════════════════════════════════════ */
const TASK_CATEGORIES = ['Learning','Fitness','Worship','Work','Content','Personal','Other'];
const TASK_PRIORITIES = ['High','Medium','Low'];
const CAT_COLORS = {
  Learning: '#6366f1', Fitness: '#e05a5a', Worship: '#2d7a4f',
  Work: '#4a7fa5', Content: '#9b59b6', Personal: '#e67e22', Other: '#6b7280'
};

let taskFilterCat = 'All';
let editingTaskId  = null;

function renderTasksView() {
  const main  = document.getElementById('mainContent');
  const today = todayKey();

  const categories = ['All', ...TASK_CATEGORIES];
  const filterTabs = categories.map(c =>
    `<button class="filter-tab ${taskFilterCat===c?'active':''}" data-filter="${c}">${c}</button>`
  ).join('');

  const filtered = taskFilterCat === 'All'
    ? LIFE_STATE.tasks
    : LIFE_STATE.tasks.filter(t => t.category === taskFilterCat);

  const pending  = filtered.filter(t => !t.done);
  const done     = filtered.filter(t => t.done);
  const overdue  = pending.filter(t => isOverdue(t.deadline));
  const upcoming = pending.filter(t => !isOverdue(t.deadline));

  main.innerHTML = `<div class="view-tasks">
    <div class="domain-header">
      <div class="domain-icon" style="background:var(--tasks-bg);border:1px solid var(--tasks-border)">✅</div>
      <div class="domain-title-wrap">
        <div class="domain-title" style="color:var(--tasks-text)">My Tasks</div>
        <div class="domain-subtitle">${pending.length} pending · ${done.length} completed</div>
      </div>
    </div>

    <div class="tasks-toolbar">
      <button class="tasks-add-btn" id="openAddTask">+ Add Task</button>
      <div class="filter-tabs">${filterTabs}</div>
    </div>

    ${overdue.length > 0 ? `
      <div class="task-section-label" style="color:var(--fitness-text)">⚠️ Overdue</div>
      ${overdue.map(t => renderCustomTask(t, true)).join('')}` : ''}

    ${upcoming.length > 0 ? `
      <div class="task-section-label">📋 Pending</div>
      ${upcoming.map(t => renderCustomTask(t, false)).join('')}` : ''}

    ${pending.length === 0 ? `<div style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:13px">
      All caught up! Add a task to get started. ✨
    </div>` : ''}

    ${done.length > 0 ? `
      <div class="task-section-label" style="margin-top:20px">✅ Completed</div>
      ${done.slice(0,10).map(t => renderCustomTask(t, false)).join('')}` : ''}
  </div>`;

  // Filter tabs
  document.querySelectorAll('.filter-tab[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      taskFilterCat = btn.dataset.filter;
      renderTasksView();
    });
  });

  // Add task button
  document.getElementById('openAddTask')?.addEventListener('click', () => openTaskModal());

  // Task interactions
  document.querySelectorAll('.cti-check[data-taskid]').forEach(el => {
    el.addEventListener('click', () => { toggleCustomTask(el.dataset.taskid); renderTasksView(); });
  });
  document.querySelectorAll('[data-edittask]').forEach(el => {
    el.addEventListener('click', () => openTaskModal(el.dataset.edittask));
  });
  document.querySelectorAll('[data-deletetask]').forEach(el => {
    el.addEventListener('click', () => {
      if (confirm('Delete this task?')) {
        LIFE_STATE.tasks = LIFE_STATE.tasks.filter(t => t.id !== el.dataset.deletetask);
        saveLifeState();
        renderTasksView();
      }
    });
  });
}

function renderCustomTask(task, overdue) {
  return `<div class="custom-task-item ${task.done?'done':''}">
    <div class="cti-check ${task.done?'checked':''}" data-taskid="${task.id}">${task.done?'✓':''}</div>
    <div class="cti-content">
      <div class="cti-title">${task.title}</div>
      <div class="cti-meta">
        <span class="cti-cat" style="background:${CAT_COLORS[task.category]||'#6b7280'}22;color:${CAT_COLORS[task.category]||'#6b7280'}">${task.category}</span>
        <span class="cti-cat" style="background:${task.priority==='High'?'rgba(239,68,68,0.1)':task.priority==='Medium'?'var(--warning-soft)':'var(--bg-elevated)'};color:${task.priority==='High'?'#ef4444':task.priority==='Medium'?'var(--warning)':'var(--text-tertiary)'}">${task.priority}</span>
        ${task.deadline ? `<span class="cti-deadline ${overdue?'overdue':''}">${overdue?'⚠️ ':''}${formatDateShort(task.deadline)}</span>` : ''}
      </div>
      ${task.notes ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">${task.notes}</div>` : ''}
    </div>
    <div class="cti-actions">
      <button class="cti-action-btn" data-edittask="${task.id}">✏️</button>
      <button class="cti-action-btn del" data-deletetask="${task.id}">🗑</button>
    </div>
  </div>`;
}

function categoryStyle(cat) {
  const c = CAT_COLORS[cat] || '#6b7280';
  return `background:${c}22;color:${c}`;
}

function openTaskModal(taskId) {
  const overlay = document.getElementById('taskModalOverlay');
  const body    = document.getElementById('taskModalBody');
  const title   = document.getElementById('taskModalTitle');
  if (!overlay || !body) return;

  const existing = taskId ? LIFE_STATE.tasks.find(t => t.id === taskId) : null;
  editingTaskId   = taskId || null;

  if (title) title.textContent = existing ? 'Edit Task' : 'Add Task';

  body.innerHTML = `<div class="task-form">
    <div class="task-form-row">
      <label class="task-form-label">Title *</label>
      <input type="text" class="task-form-input" id="tf_title" value="${existing?.title||''}" placeholder="Task description…"/>
    </div>
    <div class="task-form-grid">
      <div class="task-form-row">
        <label class="task-form-label">Category</label>
        <select class="task-form-select" id="tf_category">
          ${TASK_CATEGORIES.map(c => `<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="task-form-row">
        <label class="task-form-label">Priority</label>
        <select class="task-form-select" id="tf_priority">
          ${TASK_PRIORITIES.map(p => `<option value="${p}" ${existing?.priority===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="task-form-row">
      <label class="task-form-label">Deadline (optional)</label>
      <input type="date" class="task-form-input" id="tf_deadline" value="${existing?.deadline||''}"/>
    </div>
    <div class="task-form-row">
      <label class="task-form-label">Notes (optional)</label>
      <textarea class="task-form-textarea" id="tf_notes" placeholder="Any extra context…">${existing?.notes||''}</textarea>
    </div>
    <button class="task-form-submit" id="tfSubmit">${existing ? 'Update Task' : 'Add Task ✨'}</button>
  </div>`;

  overlay.classList.add('open');

  document.getElementById('taskModalClose')?.addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

  document.getElementById('tfSubmit')?.addEventListener('click', () => {
    const tfTitle = document.getElementById('tf_title')?.value.trim();
    if (!tfTitle) { alert('Title is required'); return; }
    const taskData = {
      title:    tfTitle,
      category: document.getElementById('tf_category')?.value || 'Personal',
      priority: document.getElementById('tf_priority')?.value || 'Medium',
      deadline: document.getElementById('tf_deadline')?.value || '',
      notes:    document.getElementById('tf_notes')?.value || '',
    };
    if (editingTaskId) {
      const idx = LIFE_STATE.tasks.findIndex(t => t.id === editingTaskId);
      if (idx > -1) Object.assign(LIFE_STATE.tasks[idx], taskData);
    } else {
      LIFE_STATE.tasks.push({ ...taskData, id: uid(), done: false, createdAt: todayKey() });
      if (typeof addXP === 'function') addXP(3, 'Task added');
    }
    saveLifeState();
    overlay.classList.remove('open');
    renderTasksView();
  });

  // Focus title input
  setTimeout(() => document.getElementById('tf_title')?.focus(), 100);
}

function addCustomTask(opts) {
  LIFE_STATE.tasks.push({ id: uid(), done: false, createdAt: todayKey(), category: 'Personal', priority: 'Medium', ...opts });
  saveLifeState();
}

function toggleCustomTask(id) {
  const task = LIFE_STATE.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  if (task.done && typeof addXP === 'function') addXP(10, 'Task complete');
  saveLifeState();
}

/* ════════════════════════════════════════════════════════════
   MODULE 9 — SCHEDULE VIEW
   ════════════════════════════════════════════════════════════ */
function renderScheduleView() {
  const main = document.getElementById('mainContent');
  const blocks = LIFE_STATE.schedule.blocks || [];

  main.innerHTML = `<div class="view-schedule">
    <div class="domain-header">
      <div class="domain-icon" style="background:var(--schedule-bg)">⏰</div>
      <div class="domain-title-wrap">
        <div class="domain-title" style="color:var(--schedule-text)">Daily Schedule</div>
        <div class="domain-subtitle">Build a schedule around your day</div>
      </div>
    </div>

    <div class="schedule-timeline">
      ${blocks.length ? blocks.map(b => `
        <div class="schedule-block">
          <div class="sched-time">${b.time}</div>
          <div class="sched-dot" style="background:${b.dot}"></div>
          <div class="sched-card">
            <div class="sched-card-title">${b.title}</div>
            <div class="sched-card-sub">${b.sub}</div>
            <div class="sched-card-tags">
              ${b.tags.map(tag => `<span class="sched-tag">${tag}</span>`).join('')}
            </div>
          </div>
        </div>`).join('') : '<div class="empty-state">No schedule blocks yet.</div>'}
    </div>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   MODULE 10 — ROUTER EXTENSION
   ════════════════════════════════════════════════════════════ */

// lifeNavigate delegates to the patched navigate() in app.js
// which already handles LIFE_VIEWS via renderLifeView()
function lifeNavigate(view, opts = {}) {
  if (typeof navigate === 'function') {
    navigate(view, opts);
  }
}

function renderLifeView(view) {
  const renders = {
    home:     renderHomeView,
    worship:  renderWorshipView,
    fitness:  renderFitnessView,
    work:     renderWorkView,
    content:  renderContentView,
    tasks:    renderTasksView,
    schedule: renderScheduleView,
  };
  (renders[view] || (() => {}))();
  updateNavActive(view);
}

function updateNavActive(view) {
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.querySelectorAll('.bnav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
}

function updateAllTopbar() {
  if (typeof updateTopbarXP     === 'function') updateTopbarXP();
  if (typeof updateTopbarStreak === 'function') updateTopbarStreak();
  if (typeof updateTopbarDate   === 'function') updateTopbarDate();
  if (typeof updateSidebarXP    === 'function') updateSidebarXP();
  if (typeof updateThemeIcon    === 'function') updateThemeIcon();

  const qEl = document.getElementById('quoteText');
  if (qEl && typeof QUOTES !== 'undefined' && typeof currentQuoteIdx !== 'undefined') {
    qEl.textContent = QUOTES[currentQuoteIdx];
  }

  const viewNames = { home:'Home', worship:'Worship', fitness:'Fitness', work:'Work', content:'Content', tasks:'My Tasks', schedule:'Schedule' };
  const view = typeof STATE !== 'undefined' ? STATE.view : 'home';
  if (viewNames[view]) {
    const el = document.getElementById('topbarBreadcrumb');
    if (el) el.innerHTML = `<span class="bc-current">${viewNames[view]}</span>`;
  }
}

/* ════════════════════════════════════════════════════════════
   MODULE 11 — LIFE OS SEARCH EXTENSION
   ════════════════════════════════════════════════════════════ */
function searchLifeOS(query) {
  const q = query.toLowerCase();
  const results = [];

  // Search tasks
  LIFE_STATE.tasks.filter(t => !t.done).forEach(t => {
    if (t.title.toLowerCase().includes(q) || (t.notes||'').toLowerCase().includes(q)) {
      results.push({ icon: '✅', main: t.title, meta: `Task · ${t.category}`, action: () => lifeNavigate('tasks') });
    }
  });

  // Search exercises
  const plan = LIFE_STATE.fitness.plan;
  if (plan) {
    Object.values(plan.plan).forEach(workout => {
      workout.exercises?.forEach(ex => {
        if (ex.name.toLowerCase().includes(q) || ex.notes?.toLowerCase().includes(q)) {
          results.push({ icon: '💪', main: ex.name, meta: `Fitness · ${workout.name}`, action: () => lifeNavigate('fitness') });
        }
      });
    });
  }

  // Search hooks
  CONTENT_HOOKS.forEach(h => {
    if (h.toLowerCase().includes(q)) {
      results.push({ icon: '🎣', main: h, meta: 'Content · Hook Library', action: () => lifeNavigate('content') });
    }
  });

  // Search video ideas
  LIFE_STATE.content.videoIdeas.forEach(v => {
    if (v.title.toLowerCase().includes(q) || (v.hook||'').toLowerCase().includes(q)) {
      results.push({ icon: '🎬', main: v.title, meta: `Content · ${v.status}`, action: () => lifeNavigate('content') });
    }
  });

  return results;
}

/* ════════════════════════════════════════════════════════════
   MODULE 12 — EVENT BINDING (Life OS)
   ════════════════════════════════════════════════════════════ */
function bindLifeOSEvents() {
  // ALL navigation (sidebar + bottom nav) goes through app.js navigate()
  // which is already patched to handle life views via renderLifeView()
  document.querySelectorAll('.nav-item[data-view], .bnav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => lifeNavigate(btn.dataset.view));
  });

  // Sidebar phase nav (learning roadmap) — delegated in app.js bindEvents already
  // handled by handleSidebarClick in app.js

  // Mobile sidebar open
  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.add('mobile-open');
    document.getElementById('mobileOverlay')?.classList.add('show');
  });

  // Sidebar close button (only visible on mobile)
  document.getElementById('sidebarCloseBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('mobileOverlay')?.classList.remove('show');
  });

  // Mobile overlay tap closes sidebar
  document.getElementById('mobileOverlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.getElementById('mobileOverlay')?.classList.remove('show');
  });

  // Search integration: life-os results are now appended by the patched runSearch() in app.js
  // No extra listener needed here — avoids double firing

  // Fitness setup modal close
  document.getElementById('fitnessSetupClose')?.addEventListener('click', () => {
    document.getElementById('fitnessSetupOverlay')?.classList.remove('open');
  });

  // PWA install prompt — store for later use
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window._pwaInstallPrompt = e;
  });
}

// openSearch / closeSearch defined in app.js

function appendLifeSearchResults(q, extraResults) {
  // Appends life-os results to the existing search results from app.js runSearch()
  if (!extraResults || !extraResults.length) return;
  const res = document.getElementById('searchResults');
  if (!res) return;

  const lifeHtml = extraResults.slice(0, 15).map((r, i) => `
    <div class="search-result life-search-result" data-life-idx="${i}">
      <div class="search-result-main">${r.icon} ${r.main}</div>
      <div class="search-result-meta">${r.meta}</div>
    </div>`).join('');

  // Append after existing roadmap results (or replace if empty)
  const existing = res.innerHTML;
  if (!existing || existing.includes('search-empty')) {
    if (!extraResults.length) return;
    res.innerHTML = lifeHtml;
  } else {
    res.innerHTML += lifeHtml;
  }

  // Bind life search click actions
  res.querySelectorAll('.life-search-result').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.lifeIdx);
      extraResults[idx]?.action?.();
      if (typeof closeSearch === 'function') closeSearch();
    });
  });
}

/* ════════════════════════════════════════════════════════════
   MODULE 13 — LIFE OS INIT
   ════════════════════════════════════════════════════════════ */
function initLifeOS() {
  loadLifeState();
  bindLifeOSEvents();

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.info('LifeOS SW registered'))
      .catch(err => console.warn('SW failed:', err));
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SYNC_REQUESTED' && typeof triggerFirebaseSync === 'function') {
        triggerFirebaseSync();
      }
    });
  }

  // Determine which view to show
  const currentView = (typeof STATE !== 'undefined' && STATE.view) ? STATE.view : 'home';
  const lifeViews = ['home','worship','fitness','work','content','tasks','schedule'];

  if (lifeViews.includes(currentView)) {
    // app.js already rendered sidebar & topbar in its init; we render the life view body
    renderLifeView(currentView);
  } else if (!currentView || currentView === 'daily') {
    // app.js handles daily/calendar/etc — just update nav active state
    updateNavActive(currentView || 'daily');
  }

  // Sync nav active indicators
  updateNavActive(currentView);

  // Update theme color meta for PWA
  const themeMeta = document.getElementById('themeColorMeta');
  if (themeMeta) {
    const isDark = typeof STATE !== 'undefined' ? STATE.theme === 'dark' : true;
    themeMeta.content = isDark ? '#0d0f18' : '#f0f2fa';
  }

  console.log('✅ LifeOS initialized | view:', currentView);
}

// Wait for app.js DOMContentLoaded init to finish, then boot LifeOS
// app.js fires its init on DOMContentLoaded; we use a short timeout after
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initLifeOS, 80));
} else {
  setTimeout(initLifeOS, 80);
}
