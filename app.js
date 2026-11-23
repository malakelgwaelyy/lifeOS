const STORAGE_KEY = 'lifeos-dashboard-v1';
const STORAGE_SCHEMA_VERSION = 2;
const AREA_MODULES = [
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'notes', label: 'Notes', icon: '📝' },
  { id: 'habits', label: 'Habits', icon: '🔄' },
  { id: 'subjects', label: 'Subjects', icon: '📚' },
  { id: 'milestones', label: 'Milestones', icon: '🏁' },
  { id: 'resources', label: 'Resources', icon: '🔗' },
  { id: 'study', label: 'Study sessions', icon: '📘' },
  { id: 'calendar', label: 'Calendar', icon: '📅' }
];
let dataOwner = 'local';
window.LIFEOS_DATA_OWNER = dataOwner;

const defaultState = {
  settings: {
    theme: 'dark',
    name: 'Your Life',
    todayFocus: 'Protect your attention and finish the work that moves your life forward.'
  },
  currentView: 'dashboard',
  selectedAreaId: null,
  selectedSubjectId: null,
  selectedAreaSection: 'overview',
  searchQuery: '',
  onboardingComplete: false,
  lifeAreas: [],
  subjects: [],
  goals: [],
  projects: [],
  tasks: [],
  study: [],
  habits: [],
  notes: [],
  events: [],
  resources: [],
  drafts: []
};

function getLegacyAreaModules(area, dashboard = {}) {
  const modules = new Set(['goals', 'tasks', 'notes', 'study', 'calendar']);
  const previousStructure = area?.structureType;
  if (previousStructure !== 'none' && previousStructure !== 'projects') modules.add('subjects');
  if (previousStructure !== 'none' && previousStructure !== 'subjects') modules.add('projects');
  if (dashboard.habits?.some((habit) => habit.lifeAreaId === area?.id)) modules.add('habits');
  return [...modules];
}

function getAreaModules(area) {
  if (Array.isArray(area?.modules)) return area.modules.filter((moduleId) => AREA_MODULES.some((module) => module.id === moduleId));
  return getLegacyAreaModules(area, state);
}

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'No date';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatLongDate(dateStr) {
  if (!dateStr) return 'No date';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function getStorageKey(owner = dataOwner) {
  return owner === 'local'
    ? `${STORAGE_KEY}:v${STORAGE_SCHEMA_VERSION}:local`
    : `${STORAGE_KEY}:v${STORAGE_SCHEMA_VERSION}:user:${encodeURIComponent(owner)}`;
}

function normalizeState(parsed = {}) {
  const normalized = {
    ...JSON.parse(JSON.stringify(defaultState)),
    ...parsed,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    settings: { ...defaultState.settings, ...(parsed.settings || {}) }
  };
  ['lifeAreas', 'subjects', 'goals', 'projects', 'tasks', 'study', 'habits', 'notes', 'events', 'resources', 'drafts'].forEach((key) => {
    normalized[key] = Array.isArray(parsed[key]) ? parsed[key] : normalized[key];
  });
  normalized.lifeAreas = normalized.lifeAreas.map((area) => ({
    ...area,
    modules: Array.isArray(area.modules) ? area.modules.filter((moduleId) => AREA_MODULES.some((module) => module.id === moduleId)) : getLegacyAreaModules(area, normalized)
  }));
  return normalized;
}

function loadState(owner = dataOwner) {
  try {
    const scopedKey = getStorageKey(owner);
    let raw = localStorage.getItem(scopedKey);
    if (!raw && owner === 'local') {
      raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const migrated = normalizeState(JSON.parse(raw));
        localStorage.setItem(scopedKey, JSON.stringify(migrated));
        return migrated;
      }
    }
    return raw ? normalizeState(JSON.parse(raw)) : normalizeState();
  } catch (error) {
    console.warn('LifeOS state load failed; keeping saved data untouched.', error);
    return normalizeState();
  }
}

let state = loadState();

function persistState({ sync = true } = {}) {
  state.updatedAt = Date.now();
  state.schemaVersion = STORAGE_SCHEMA_VERSION;
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
  if (sync && typeof triggerFirebaseSync === 'function') triggerFirebaseSync();
}

function setLifeOSDataOwner(owner) {
  const nextOwner = owner || 'local';
  if (nextOwner === dataOwner) return;
  persistState({ sync: false });
  if (typeof saveLifeState === 'function') saveLifeState({ sync: false });
  dataOwner = nextOwner;
  window.LIFEOS_DATA_OWNER = dataOwner;
  if (dataOwner === 'signed-out') {
    state = normalizeState();
    if (typeof resetLifeState === 'function') resetLifeState();
  } else {
    state = loadState(dataOwner);
    if (typeof loadLifeState === 'function') loadLifeState(dataOwner);
  }
  if (document.getElementById('mainContent')) renderCurrentView();
}

function replaceLifeOSDashboardState(nextState) {
  state = normalizeState(nextState);
  persistState({ sync: false });
  if (document.getElementById('mainContent')) renderCurrentView();
}

window.setLifeOSDataOwner = setLifeOSDataOwner;
window.replaceLifeOSDashboardState = replaceLifeOSDashboardState;

function getAreaById(id) {
  return state.lifeAreas.find((area) => area.id === id) || null;
}

function getGoalById(id) {
  return state.goals.find((goal) => goal.id === id) || null;
}

function getProjectById(id) {
  return state.projects.find((project) => project.id === id) || null;
}

function getTaskById(id) {
  return state.tasks.find((task) => task.id === id) || null;
}

function getNoteById(id) {
  return state.notes.find((note) => note.id === id) || null;
}

function getSubjectById(id) {
  return state.subjects.find((subject) => subject.id === id) || null;
}

function getSubjectLabel(subjectId) {
  return getSubjectById(subjectId)?.name || '';
}

function getDraftById(id) {
  return state.drafts.find((draft) => draft.id === id) || null;
}

function getResourceById(id) {
  return state.resources.find((resource) => resource.id === id) || null;
}

function getModalFormValues(form) {
  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());
  if (form.querySelector('[name="modules"]')) values.modules = formData.getAll('modules');
  return values;
}

function saveDraft(type, entityId, values, draftId = '') {
  const existing = draftId ? getDraftById(draftId) : entityId ? state.drafts.find((draft) => draft.type === type && draft.entityId === entityId) : null;
  const now = Date.now();
  const draft = {
    id: existing?.id || `draft-${now}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    entityId: entityId || null,
    values,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  if (existing) Object.assign(existing, draft);
  else state.drafts.push(draft);
  persistState();
  updateDraftCount();
  return draft;
}

function deleteDraft(draftId) {
  state.drafts = state.drafts.filter((draft) => draft.id !== draftId);
  persistState();
  updateDraftCount();
}

function updateDraftCount() {
  const button = document.querySelector('.nav-item[data-view="drafts"]');
  if (!button) return;
  let count = button.querySelector('.nav-count');
  if (!state.drafts.length) {
    count?.remove();
    return;
  }
  if (!count) {
    count = document.createElement('span');
    count.className = 'nav-count';
    button.append(count);
  }
  count.textContent = state.drafts.length;
}

function getAreaProgress(areaId) {
  const modules = new Set(getAreaModules(getAreaById(areaId)));
  const areaGoals = modules.has('goals') ? state.goals.filter((goal) => goal.lifeAreaId === areaId) : [];
  const areaProjects = modules.has('projects') ? state.projects.filter((project) => project.lifeAreaId === areaId) : [];
  const areaTasks = modules.has('tasks') ? state.tasks.filter((task) => task.lifeAreaId === areaId) : [];
  const goalProgress = areaGoals.length ? areaGoals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / areaGoals.length : 0;
  const projectProgress = areaProjects.length ? areaProjects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / areaProjects.length : 0;
  const taskRatio = areaTasks.length ? (areaTasks.filter((task) => task.status === 'Done').length / areaTasks.length) * 100 : 0;
  const activeWeights = (areaGoals.length ? 0.45 : 0) + (areaProjects.length ? 0.35 : 0) + (areaTasks.length ? 0.2 : 0);
  return activeWeights ? Math.round(((goalProgress * (areaGoals.length ? 0.45 : 0)) + (projectProgress * (areaProjects.length ? 0.35 : 0)) + (taskRatio * (areaTasks.length ? 0.2 : 0))) / activeWeights) : 0;
}

function getOverallProgress() {
  const goals = state.goals.length ? state.goals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / state.goals.length : 0;
  const projects = state.projects.length ? state.projects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / state.projects.length : 0;
  const tasks = state.tasks.length ? (state.tasks.filter((task) => task.status === 'Done').length / state.tasks.length) * 100 : 0;
  return Math.round((goals * 0.45) + (projects * 0.35) + (tasks * 0.2));
}

function getTodayTasks() {
  const today = isoDate(0);
  return state.tasks.filter((task) => task.status !== 'Done' && task.dueDate === today);
}

function isHabitCompleteOnDate(habit, date) {
  return Boolean(habit.completionHistory?.[date]);
}

function getEnabledHabits() {
  const habitAreaIds = new Set(state.lifeAreas.filter((area) => !area.archived && getAreaModules(area).includes('habits')).map((area) => area.id));
  return state.habits.filter((habit) => habitAreaIds.has(habit.lifeAreaId));
}

function toggleHabitCompletion(habitId, date = isoDate(0)) {
  const habit = state.habits.find((entry) => entry.id === habitId);
  if (!habit) return null;
  const history = habit.completionHistory && typeof habit.completionHistory === 'object' && !Array.isArray(habit.completionHistory)
    ? { ...habit.completionHistory }
    : {};
  const completed = !history[date];
  if (completed) history[date] = true;
  else delete history[date];
  habit.completionHistory = history;
  persistState();
  return completed;
}

function updateHabitChecklistUI(button, completed) {
  button.classList.toggle('done', completed);
  button.setAttribute('aria-pressed', String(completed));
  button.setAttribute('aria-label', `${completed ? 'Unmark' : 'Mark'} ${button.dataset.habitName} ${completed ? 'incomplete' : 'complete'} for ${formatLongDate(isoDate(0))}`);
  button.textContent = completed ? '✓' : '';
  button.closest('.dashboard-habit-row')?.classList.toggle('completed', completed);
  document.querySelectorAll('[data-habit-count]').forEach((counter) => {
    const total = Number(counter.dataset.habitTotal || 0);
    const done = Math.max(0, Math.min(total, Number(counter.dataset.habitCount || 0) + (completed ? 1 : -1)));
    counter.dataset.habitCount = String(done);
    counter.textContent = counter.dataset.habitCountStyle === 'dashboard' ? `Habits · ${done}/${total}` : `${done}/${total} complete`;
  });
}

function renderHabitChecklist(habits, date, compact = false) {
  return habits.map((habit) => {
    const completed = isHabitCompleteOnDate(habit, date);
    const actionLabel = `${completed ? 'Unmark' : 'Mark'} ${habit.name} ${completed ? 'incomplete' : 'complete'} for ${formatLongDate(date)}`;
    return `<div class="dashboard-habit-row ${completed ? 'completed' : ''} ${compact ? 'compact' : ''}">
      <button type="button" class="habit-check ${completed ? 'done' : ''}" data-action="toggle-habit-today" data-habit-id="${habit.id}" data-habit-name="${escapeHtml(habit.name)}" aria-label="${escapeHtml(actionLabel)}" aria-pressed="${completed}">${completed ? '✓' : ''}</button>
      <span class="dashboard-habit-name">${escapeHtml(habit.name)}<small>${escapeHtml(getAreaById(habit.lifeAreaId)?.name || habit.frequency || 'Daily')}</small></span>
      ${compact ? '' : `<small class="habit-frequency">${escapeHtml(habit.frequency || 'daily')}</small>`}
    </div>`;
  }).join('');
}

function getOverdueTasks() {
  const today = new Date(isoDate(0) + 'T00:00:00');
  return state.tasks.filter((task) => task.status !== 'Done' && task.dueDate && new Date(task.dueDate + 'T00:00:00') < today);
}

function getUpcomingTasks(limit = 5) {
  const today = new Date(isoDate(0) + 'T00:00:00');
  return state.tasks
    .filter((task) => task.status !== 'Done' && task.dueDate && new Date(task.dueDate + 'T00:00:00') >= today)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, limit);
}

function getTasksByArea(areaId) {
  return state.tasks.filter((task) => task.lifeAreaId === areaId && task.status !== 'Done');
}

function getActiveGoals() {
  return state.goals.filter((goal) => goal.status === 'In Progress').slice(0, 4);
}

function getActiveProjects() {
  return state.projects.filter((project) => project.status === 'In Progress' || project.status === 'Planning').slice(0, 4);
}

function getSearchResults() {
  const query = state.searchQuery.trim().toLowerCase();
  if (!query) return [];

  const results = [];

  state.lifeAreas.forEach((area) => {
    if ([area.name, area.description, area.icon].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Life Area', label: area.name, icon: area.icon, entity: 'area', id: area.id });
    }
  });

  state.subjects.forEach((subject) => {
    if ([subject.name, subject.description, getAreaById(subject.lifeAreaId)?.name || ''].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Subject', label: subject.name, icon: '▤', entity: 'subject', id: subject.id });
    }
  });

  state.goals.forEach((goal) => {
    if ([goal.title, goal.description, getAreaById(goal.lifeAreaId)?.name || '', getSubjectLabel(goal.subjectId)].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Goal', label: goal.title, icon: '🎯', entity: 'goal', id: goal.id });
    }
  });

  state.projects.forEach((project) => {
    if ([project.name, project.description, getAreaById(project.lifeAreaId)?.name || '', getSubjectLabel(project.subjectId)].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Project', label: project.name, icon: '🗂', entity: 'project', id: project.id });
    }
  });

  state.tasks.forEach((task) => {
    if ([task.title, task.description, task.notes, task.tags?.join(' ') || '', getAreaById(task.lifeAreaId)?.name || '', getSubjectLabel(task.subjectId)].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Task', label: task.title, icon: '✅', entity: 'task', id: task.id });
    }
  });

  state.study.forEach((item) => {
    if ([item.title, item.goal, item.topic, getAreaById(item.lifeAreaId)?.name || '', getSubjectLabel(item.subjectId)].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Study', label: item.title, icon: '📘', entity: 'study', id: item.id });
    }
  });

  state.habits.forEach((habit) => {
    if ([habit.name, getAreaById(habit.lifeAreaId)?.name || ''].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Habit', label: habit.name, icon: '🔁', entity: 'habit', id: habit.id });
    }
  });

  state.notes.forEach((note) => {
    if ([note.title, note.body, getAreaById(note.lifeAreaId)?.name || '', getSubjectLabel(note.subjectId)].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Note', label: note.title, icon: '✎', entity: 'note', id: note.id });
    }
  });

  state.events.forEach((event) => {
    if ([event.title, event.type, getAreaById(event.lifeAreaId)?.name || ''].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Event', label: event.title, icon: '📅', entity: 'event', id: event.id });
    }
  });

  state.resources.forEach((resource) => {
    if ([resource.name, resource.url, resource.description, getAreaById(resource.lifeAreaId)?.name || ''].join(' ').toLowerCase().includes(query)) {
      results.push({ type: 'Resource', label: resource.name, icon: '🔗', entity: 'resource', id: resource.id });
    }
  });

  return results.slice(0, 50);
}

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  const groups = [
    { label: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: '◫' }, { id: 'today', label: 'Today', icon: '☀' }, { id: 'calendar', label: 'Calendar', icon: '📅' }] },
    { label: 'Workspace', items: [{ id: 'areas', label: 'Life Areas', icon: '🧭' }, { id: 'subjects', label: 'Subjects', icon: '▤' }, { id: 'goals', label: 'Goals', icon: '🎯' }, { id: 'projects', label: 'Projects', icon: '🗂' }, { id: 'tasks', label: 'Tasks', icon: '✅' }] },
    { label: 'Learning', items: [{ id: 'study', label: 'Study', icon: '📘' }, { id: 'study-planner', label: 'Study Planner', icon: '🗓' }] },
    { label: 'Tracking', items: [{ id: 'habits', label: 'Habits', icon: '🔁' }, { id: 'insights', label: 'Insights', icon: '📈' }] },
    { label: 'Other', items: [{ id: 'notes', label: 'Notes', icon: '✎' }, { id: 'drafts', label: 'Drafts', icon: '▧' }, { id: 'settings', label: 'Settings', icon: '⚙' }] }
  ];

  const navButton = (item) => `
    <button class="nav-item ${state.currentView === item.id ? 'active' : ''}" data-view="${item.id}">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label}</span>
      ${item.id === 'drafts' && state.drafts.length ? `<span class="nav-count">${state.drafts.length}</span>` : ''}
    </button>
  `;

  const groupsMarkup = groups.map((group) => `
    <div class="nav-group">
      <div class="nav-group-label">${group.label}</div>
      ${group.items.map(navButton).join('')}
      ${group.label === 'Workspace' ? state.lifeAreas.filter((area) => !area.archived).map((area) => `
        <button class="nav-item area-nav ${state.selectedAreaId === area.id ? 'active' : ''}" data-action="open-area" data-area-id="${area.id}">
          <span class="nav-icon">${area.icon || '◎'}</span>
          <span>${escapeHtml(area.name)}</span>
        </button>
      `).join('') : ''}
    </div>
  `).join('');

  nav.innerHTML = groupsMarkup;
}

function renderTopbar() {
  const topbar = document.getElementById('topbarMeta');
  const search = document.getElementById('globalSearch');
  if (topbar) {
    const today = new Date();
    topbar.textContent = today.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (search) {
    search.value = state.searchQuery;
  }
}

function renderCurrentView() {
  const main = document.getElementById('mainContent');

  if (!state.onboardingComplete && !state.lifeAreas.length) {
    renderOnboarding();
    renderSidebar();
    renderTopbar();
    syncTheme();
    return;
  }

  if (state.searchQuery.trim()) {
    renderSearchResults();
    renderSidebar();
    renderTopbar();
    syncTheme();
    return;
  }

  if (state.currentView === 'area-workspace' && state.selectedAreaId) {
    if (getAreaById(state.selectedAreaId)) {
      renderAreaWorkspace(state.selectedAreaId, state.selectedAreaSection || 'overview');
      renderSidebar();
      renderTopbar();
      syncTheme();
      return;
    }
    state.currentView = 'areas';
    state.selectedAreaId = null;
  }

  if (state.currentView === 'subject-workspace' && state.selectedSubjectId) {
    if (getSubjectById(state.selectedSubjectId)) {
      renderSubjectWorkspace(state.selectedSubjectId);
      renderSidebar();
      renderTopbar();
      syncTheme();
      return;
    }
    state.currentView = 'dashboard';
    state.selectedSubjectId = null;
  }

  const view = state.currentView;
  const viewMap = {
    dashboard: renderDashboard,
    today: renderToday,
    calendar: renderCalendar,
    areas: renderAreas,
    subjects: renderSubjects,
    goals: renderGoals,
    projects: renderProjects,
    tasks: renderTasks,
    study: renderStudy,
    'study-planner': renderStudy,
    habits: renderHabits,
    notes: renderNotes,
    drafts: renderDrafts,
    analytics: renderAnalytics,
    insights: renderAnalytics,
    settings: renderSettings
  };

  const renderer = viewMap[view] || renderDashboard;
  renderer(main);
  renderSidebar();
  renderTopbar();
  syncTheme();
}

function renderOnboarding() {
  const main = document.getElementById('mainContent');
  const suggestions = [
    { name: 'Health', icon: '🌿', color: '#7c83ff' },
    { name: 'Learning', icon: '📘', color: '#52a7ff' },
    { name: 'Work', icon: '💼', color: '#2ec5a4' },
    { name: 'Relationships', icon: '🤝', color: '#f89d5d' },
    { name: 'Personal projects', icon: '✦', color: '#ff5e7d' }
  ];

  main.innerHTML = `
    <div class="page-shell onboarding-shell">
      <div class="panel onboarding-panel">
        <p class="eyebrow">Welcome</p>
        <h2>Let's set up your LifeOS.</h2>
        <p class="onboarding-copy">Create the areas of your life you want to manage.</p>

        <div class="suggestion-grid">
          ${suggestions.map((suggestion) => `
            <button class="suggestion-card" data-action="onboarding-suggest-area" data-area-name="${escapeHtml(suggestion.name)}" data-area-icon="${escapeHtml(suggestion.icon)}" data-area-color="${suggestion.color}">
              <span>${suggestion.icon}</span>
              <strong>${escapeHtml(suggestion.name)}</strong>
            </button>
          `).join('')}
        </div>

        <div class="onboarding-actions">
          <button class="primary-btn" data-action="onboarding-custom-area">Add my own area</button>
          <button class="ghost-btn" data-action="skip-onboarding">Skip for now</button>
        </div>
      </div>
    </div>
  `;

  bindDefaultActions();
}

function renderSearchResults() {
  const main = document.getElementById('mainContent');
  const query = state.searchQuery.trim().toLowerCase();
  const results = getSearchResults();

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Search</p>
          <h2>Results for “${escapeHtml(query)}”</h2>
        </div>
      </div>
      <div class="panel">
        <div class="search-results-list">
          ${results.length ? results.map((result) => `
            <button class="search-result" data-action="open-result" data-entity="${result.entity}" data-id="${result.id}">
              <span class="search-result-icon">${result.icon}</span>
              <div>
                <strong>${escapeHtml(result.label)}</strong>
                <small>${escapeHtml(result.type)}</small>
              </div>
            </button>
          `).join('') : '<div class="empty-state"><p>No matching items found. Try another term or create something new.</p><button class="primary-btn" data-action="quick-add" data-type="task">Create new item</button></div>'}
        </div>
      </div>
    </div>
  `;

  bindDefaultActions();
}

function renderDashboard() {
  const main = document.getElementById('mainContent');
  const todayKey = isoDate(0);
  const overall = getOverallProgress();
  const todayTasks = getTodayTasks();
  const overdue = getOverdueTasks();
  const todayStudy = state.study.filter((item) => item.sessions?.some((session) => session.date === todayKey));
  const todayHabits = getEnabledHabits();
  const upcomingTasks = getUpcomingTasks(5);
  const upcomingStudy = state.study.filter((item) => item.sessions?.some((session) => session.date >= todayKey)).slice(0, 4);
  const priorities = state.tasks.filter((task) => task.status !== 'Done').sort((a, b) => ({ Urgent: 4, High: 3, Medium: 2, Low: 1 }[b.priority] || 0) - ({ Urgent: 4, High: 3, Medium: 2, Low: 1 }[a.priority] || 0)).slice(0, 5);
  const activeGoals = getActiveGoals();
  const activeProjects = getActiveProjects();

  const empty = (message, type, label) => `<div class="empty-state compact-empty"><strong>${message}</strong><span>Start with one small action.</span><button class="ghost-btn" data-action="quick-add" data-type="${type}">+ ${label}</button></div>`;
  const taskRows = (tasks, emptyMessage) => tasks.length ? tasks.map((task) => `
    <div class="dashboard-task" data-action="edit-task" data-task-id="${task.id}">
      <button class="task-toggle" data-action="toggle-task" data-task-id="${task.id}" aria-label="Complete ${escapeHtml(task.title)}"></button>
      <div><strong>${escapeHtml(task.title)}</strong><small>${getAreaById(task.lifeAreaId)?.name || 'General'} · ${task.dueDate ? formatDate(task.dueDate) : 'Flexible'}</small></div>
      <span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span>
    </div>
  `).join('') : empty(emptyMessage, 'task', 'Create task');

  const areaCards = state.lifeAreas.length ? state.lifeAreas.filter((area) => !area.archived).map((area) => {
    const progress = getAreaProgress(area.id);
    return `<button class="mini-area-card" data-action="open-area" data-area-id="${area.id}" style="--area-accent:${area.color};"><div class="mini-area-head"><span class="mini-area-icon">${area.icon}</span><span class="mini-area-name">${escapeHtml(area.name)}</span><span class="area-arrow">→</span></div><div class="progress-track"><span style="width:${progress}%; background:${area.color};"></span></div><div class="mini-area-meta"><span>${progress}% progress</span><span>${getTasksByArea(area.id).length} open tasks</span></div></button>`;
  }).join('') : empty('Your life is still a blank canvas.', 'area', 'Create Life Area');

  const goalCards = activeGoals.length ? activeGoals.map((goal) => {
    const area = getAreaById(goal.lifeAreaId);
    return `<div class="info-card goal-card clickable-card" data-action="edit-goal" data-goal-id="${goal.id}"><div class="card-row"><span class="tiny-badge" style="background:${area?.color || '#6f8cff'}20; color:${area?.color || '#6f8cff'};">${escapeHtml(area?.name || 'General')}</span><span class="status-pill">${goal.status}</span></div><h4>${escapeHtml(goal.title)}</h4><div class="progress-track"><span style="width:${goal.progress}%; background:${area?.color || '#6f8cff'};"></span></div><div class="meta-row"><span>${goal.progress}% complete</span><span>Target ${formatDate(goal.targetDate)}</span></div></div>`;
  }).join('') : empty('No active goals yet.', 'goal', 'Create goal');

  const projectCards = activeProjects.length ? activeProjects.map((project) => {
    const area = getAreaById(project.lifeAreaId);
    return `<div class="info-card project-card clickable-card" data-action="edit-project" data-project-id="${project.id}"><div class="card-row"><span class="tiny-badge" style="background:${area?.color || '#6f8cff'}20; color:${area?.color || '#6f8cff'};">${escapeHtml(area?.name || 'General')}</span><span class="status-pill">${project.status}</span></div><h4>${escapeHtml(project.name)}</h4><div class="progress-track"><span style="width:${project.progress}%; background:${area?.color || '#6f8cff'};"></span></div><div class="meta-row"><span>${project.progress}% complete</span><span>Due ${formatDate(project.deadline)}</span></div></div>`;
  }).join('') : empty('No active projects yet.', 'project', 'Create project');

  const upcoming = [...upcomingTasks.map((task) => `<div class="line-item clickable-card" data-action="edit-task" data-task-id="${task.id}"><div><strong>${escapeHtml(task.title)}</strong><small>${getAreaById(task.lifeAreaId)?.name || 'General'} · Task</small></div><span>${formatDate(task.dueDate)}</span></div>`), ...upcomingStudy.map((item) => { const session = item.sessions.find((entry) => entry.date >= todayKey); return `<div class="line-item clickable-card" data-action="edit-study" data-study-id="${item.id}"><div><strong>${escapeHtml(item.title)}</strong><small>${getAreaById(item.lifeAreaId)?.name || 'General'} · Study</small></div><span>${formatDate(session?.date)}</span></div>`; })].slice(0, 6).join('');

  main.innerHTML = `
    <div class="page-shell">
      <div class="hero-panel">
        <div>
          <p class="eyebrow">Friday, ${formatLongDate(todayKey)}</p>
          <h1>${escapeHtml(state.settings.name)}</h1>
          <p class="hero-copy">${escapeHtml(state.settings.todayFocus)}</p>
          <div class="hero-actions"><button class="primary-btn" data-action="navigate" data-view="today">Open today</button><button class="ghost-btn" data-action="quick-add">Quick add</button></div>
        </div>
        <div class="hero-ring">
          <div class="ring-chart" aria-label="Overall progress">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="48" class="ring-bg"></circle>
              <circle cx="60" cy="60" r="48" class="ring-fill" style="stroke-dashoffset:${(1 - overall / 100) * 301.59};"></circle>
            </svg>
            <div class="ring-center">${overall}%</div>
          </div>
        </div>
      </div>

      <div class="section-grid two-up dashboard-primary-grid">
          <div class="panel command-panel"><div class="panel-header"><div><p class="eyebrow">Action queue</p><h3>Today</h3></div><button class="ghost-btn" data-action="navigate" data-view="today">View all</button></div><div class="dashboard-list">${taskRows(todayTasks, 'Nothing needs your attention yet.')}</div><div class="today-subsections"><div><div class="subsection-label">Study sessions</div>${todayStudy.length ? todayStudy.map((item) => `<div class="dashboard-subrow clickable-card" data-action="edit-study" data-study-id="${item.id}"><span>📘 ${escapeHtml(item.title)}</span><small>${item.sessions.filter((session) => session.date === todayKey).length} scheduled</small></div>`).join('') : '<div class="dashboard-muted">No study sessions today.</div>'}</div><div><div class="subsection-label" data-habit-count="${todayHabits.filter((habit) => isHabitCompleteOnDate(habit, todayKey)).length}" data-habit-total="${todayHabits.length}" data-habit-count-style="dashboard">Habits · ${todayHabits.filter((habit) => isHabitCompleteOnDate(habit, todayKey)).length}/${todayHabits.length}</div>${todayHabits.length ? `<div class="dashboard-habit-list">${renderHabitChecklist(todayHabits, todayKey, true)}</div>` : '<div class="dashboard-muted">No habits tracked yet.</div>'}</div></div><div class="dashboard-summary"><span>${overdue.length} overdue</span><span>${todayStudy.length} study sessions</span><span>${todayHabits.length} habits</span></div></div>
        <div class="panel command-panel"><div class="panel-header"><div><p class="eyebrow">Most important</p><h3>Priorities</h3></div><button class="ghost-btn" data-action="navigate" data-view="tasks">All tasks</button></div><div class="dashboard-list">${taskRows(priorities, 'Your priority list is clear.')}</div></div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div><p class="eyebrow">Your world</p><h3>Life Areas</h3></div>
          <button class="ghost-btn" data-action="navigate" data-view="areas">Manage</button>
        </div>
        <div class="area-cards-grid">${areaCards}</div>
      </div>

      <div class="section-grid three-up dashboard-secondary-grid"><div class="panel"><div class="panel-header"><div><p class="eyebrow">Direction</p><h3>Goals</h3></div><button class="ghost-btn" data-action="quick-add" data-type="goal">+ Add</button></div><div class="stack-card-list">${goalCards}</div></div><div class="panel"><div class="panel-header"><div><p class="eyebrow">In motion</p><h3>Active Projects</h3></div><button class="ghost-btn" data-action="quick-add" data-type="project">+ Add</button></div><div class="stack-card-list">${projectCards}</div></div><div class="panel"><div class="panel-header"><div><p class="eyebrow">Next up</p><h3>Upcoming</h3></div><button class="ghost-btn" data-action="navigate" data-view="calendar">Calendar</button></div><div class="stack-list slim">${upcoming || '<div class="empty-small">Nothing scheduled yet.</div>'}</div></div></div>
    </div>
  `;

  bindDefaultActions();
}

function renderToday() {
  const main = document.getElementById('mainContent');
  const todayKey = isoDate(0);
  const todayHabits = getEnabledHabits();
  const taskAreas = state.lifeAreas.filter((area) => !area.archived && getAreaModules(area).includes('tasks'));
  const grouped = {};
  taskAreas.forEach((area) => {
    grouped[area.id] = state.tasks.filter((task) => task.lifeAreaId === area.id && task.status !== 'Done' && (task.dueDate === todayKey || task.dueDate === undefined));
  });

  const sections = taskAreas.map((area) => {
    const tasks = grouped[area.id];
    return `
      <div class="panel">
        <div class="panel-header">
          <h3>${area.icon} ${escapeHtml(area.name)}</h3>
        </div>
        ${tasks.length ? tasks.map((task) => `
          <div class="todo-item" data-task-id="${task.id}">
            <div class="task-check ${task.status === 'Done' ? 'done' : ''}" data-action="toggle-task" data-task-id="${task.id}"></div>
            <div class="task-body">
              <div class="task-topline">
                <strong>${escapeHtml(task.title)}</strong>
                <span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span>
              </div>
              <small>${task.status} • ${task.dueDate ? formatDate(task.dueDate) : 'Flexible'} • ${escapeHtml(task.tags?.join(', ') || '')}</small>
            </div>
          </div>
        `).join('') : '<div class="empty-small">No tasks assigned here today.</div>'}
      </div>
    `;
  }).join('');

  const overdue = getOverdueTasks();
  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Today</p>
          <h2>What needs attention now</h2>
        </div>
        <button class="primary-btn" data-action="quick-add" data-type="task">+ Add task</button>
      </div>

      <div class="section-grid two-up">
        <div class="panel">
          <div class="panel-header"><h3>Priorities</h3></div>
          <div class="stack-list slim">
            ${state.tasks.filter((task) => task.status !== 'Done').slice(0, 5).map((task) => `
              <div class="line-item">
                <div>
                  <strong>${escapeHtml(task.title)}</strong>
                  <small>${getAreaById(task.lifeAreaId)?.name || 'General'}</small>
                </div>
                <span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span>
              </div>
            `).join('') || '<div class="empty-small">No urgent items.</div>'}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h3>Overdue</h3></div>
          <div class="stack-list slim">
            ${overdue.length ? overdue.map((task) => `
              <div class="line-item">
                <div>
                  <strong>${escapeHtml(task.title)}</strong>
                  <small>${getAreaById(task.lifeAreaId)?.name || 'General'}</small>
                </div>
                <span>${formatDate(task.dueDate)}</span>
              </div>
            `).join('') : '<div class="empty-small">No overdue work.</div>'}
          </div>
        </div>
      </div>

      <div class="panel today-habits-panel">
        <div class="panel-header"><div><p class="eyebrow">Daily checklist</p><h3>Habits</h3></div><span class="habit-count" data-habit-count="${todayHabits.filter((habit) => isHabitCompleteOnDate(habit, todayKey)).length}" data-habit-total="${todayHabits.length}">${todayHabits.filter((habit) => isHabitCompleteOnDate(habit, todayKey)).length}/${todayHabits.length} complete</span></div>
        <div class="today-habit-list">${todayHabits.length ? renderHabitChecklist(todayHabits, todayKey) : '<div class="empty-small">No habits in enabled Life Area modules.</div>'}</div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Today's task groups</h3></div>
        <div class="grid-two-columns">${sections}</div>
      </div>
    </div>
  `;

  bindDefaultActions();
}

function renderCalendar() {
  const main = document.getElementById('mainContent');
  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startWeekday + lastDay.getDate()) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const date = new Date(year, month, i - startWeekday + 1);
    const cellDate = date.toISOString().split('T')[0];
    const isCurrentMonth = date.getMonth() === month;
    const events = state.events.filter((event) => event.date === cellDate);
    cells.push(`
      <div class="calendar-day ${isCurrentMonth ? '' : 'muted'} ${cellDate === isoDate(0) ? 'today' : ''}">
        <strong>${date.getDate()}</strong>
        <div class="calendar-events">
          ${events.map((event) => `<span class="calendar-tag" style="--tag-color:${getAreaById(event.lifeAreaId)?.color || '#7c83ff'};">${event.type}</span>`).join('')}
        </div>
      </div>
    `);
  }

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Calendar</p>
          <h2>${today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        </div>
      </div>
      <div class="panel">
        <div class="calendar-grid">
          <div class="calendar-header">Mon</div>
          <div class="calendar-header">Tue</div>
          <div class="calendar-header">Wed</div>
          <div class="calendar-header">Thu</div>
          <div class="calendar-header">Fri</div>
          <div class="calendar-header">Sat</div>
          <div class="calendar-header">Sun</div>
          ${cells.join('')}
        </div>
      </div>
    </div>
  `;
}

function renderAreas() {
  const main = document.getElementById('mainContent');
  const cards = state.lifeAreas.length
    ? state.lifeAreas.map((area) => {
        const progress = getAreaProgress(area.id);
        const modules = getAreaModules(area);
        const moduleLabels = modules.map((moduleId) => AREA_MODULES.find((module) => module.id === moduleId)).filter(Boolean);

        return `
          <div class="panel area-panel" style="--area-accent:${area.color};">
            <div class="panel-header">
              <div class="card-row"><span class="area-bubble">${area.icon}</span><h3>${escapeHtml(area.name)}</h3></div>
              <div class="inline-actions">
                <button class="icon-btn" data-action="edit-area" data-area-id="${area.id}">✎</button>
                <button class="icon-btn" data-action="move-area-up" data-area-id="${area.id}">↑</button>
                <button class="icon-btn" data-action="move-area-down" data-area-id="${area.id}">↓</button>
                <button class="icon-btn danger" data-action="archive-area" data-area-id="${area.id}">Archive</button>
                <button class="icon-btn danger" data-action="delete-area" data-area-id="${area.id}">✕</button>
              </div>
            </div>
            <p>${escapeHtml(area.description || 'No description yet.')}</p>
            <div class="progress-track"><span style="width:${progress}%; background:${area.color};"></span></div>
            <div class="meta-row"><span>${progress}% progress</span><span>${modules.length} modules</span></div>
            <div class="area-module-summary">${moduleLabels.length ? moduleLabels.map((module) => `<span>${module.icon} ${escapeHtml(module.label)}</span>`).join('') : '<span>No modules selected</span>'}</div>
            <div class="card-actions">
              <button class="ghost-btn" data-action="open-area" data-area-id="${area.id}">Open area</button>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state"><p>No life areas created yet. Your system starts empty and grows around what matters to you.</p><button class="primary-btn" data-action="quick-add" data-type="area">Create your first area</button></div>';

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Life areas</p>
          <h2>Define the parts of your life that matter</h2>
        </div>
        <button class="primary-btn" data-action="quick-add" data-type="area">+ Add area</button>
      </div>
      <div class="area-grid">${cards}</div>
    </div>
  `;

  bindDefaultActions();
}

function renderSubjects() {
  const main = document.getElementById('mainContent');
  const areas = state.lifeAreas.filter((area) => !area.archived && getAreaModules(area).includes('subjects'));
  const activeSubjects = state.subjects.filter((subject) => !subject.archived);
  const groups = areas.map((area) => {
    const subjects = activeSubjects.filter((subject) => subject.lifeAreaId === area.id);
    const cards = subjects.map((subject) => {
      const relatedCount = ['goals', 'projects', 'tasks', 'study', 'notes']
        .reduce((count, key) => count + state[key].filter((item) => item.subjectId === subject.id).length, 0);
      return `<article class="panel subject-card">
        <div class="panel-header"><div><h3>${escapeHtml(subject.name)}</h3><small>${escapeHtml(subject.description || 'No description yet.')}</small></div>
          <div class="inline-actions"><button class="icon-btn" data-action="edit-subject" data-subject-id="${subject.id}" aria-label="Edit ${escapeHtml(subject.name)}">✎</button><button class="icon-btn" data-action="archive-subject" data-subject-id="${subject.id}">Archive</button></div>
        </div>
        <div class="meta-row"><span>${relatedCount} linked items</span><span>${state.tasks.filter((task) => task.subjectId === subject.id).length} tasks</span></div>
        <button class="ghost-btn" data-action="open-subject" data-subject-id="${subject.id}">Open subject</button>
      </article>`;
    }).join('');
    return `<section class="subjects-area-section">
      <div class="subject-section-heading"><div><p class="eyebrow">Life Area</p><h3>${escapeHtml(area.name)}</h3></div><button class="ghost-btn" data-action="quick-add" data-type="subject" data-assign-area="${area.id}">+ Add subject</button></div>
      <div class="card-grid subject-card-grid">${cards || '<div class="empty-small">No subjects in this area yet.</div>'}</div>
    </section>`;
  }).join('');
  const archived = state.subjects.filter((subject) => subject.archived && getAreaModules(getAreaById(subject.lifeAreaId)).includes('subjects'));

  main.innerHTML = `<div class="page-shell">
    <div class="header-row spacing-row"><div><p class="eyebrow">Workspace</p><h2>Subjects</h2><p>Organize goals, work and learning within each Life Area.</p></div></div>
    ${areas.length ? groups : '<div class="empty-state"><p>Create a Life Area before adding Subjects.</p><button class="primary-btn" data-action="quick-add" data-type="area">Create Life Area</button></div>'}
    ${archived.length ? `<section class="archived-subjects"><h3>Archived subjects</h3>${archived.map((subject) => `<div class="line-item"><div><strong>${escapeHtml(subject.name)}</strong><small>${escapeHtml(getAreaById(subject.lifeAreaId)?.name || 'No Life Area')}</small></div><div class="inline-actions"><button class="ghost-btn" data-action="restore-subject" data-subject-id="${subject.id}">Restore</button><button class="icon-btn danger" data-action="delete-subject" data-subject-id="${subject.id}" aria-label="Delete ${escapeHtml(subject.name)}">✕</button></div></div>`).join('')}</section>` : ''}
  </div>`;
  bindDefaultActions();
}

function renderAreaWorkspace(areaId, section = 'overview') {
  const area = getAreaById(areaId);
  if (!area) return;

  const modules = new Set(getAreaModules(area));
  const tabs = ['overview', ...AREA_MODULES.filter((module) => modules.has(module.id)).map((module) => module.id)];
  if (!tabs.includes(section)) section = 'overview';
  const areaSubjects = modules.has('subjects') ? state.subjects.filter((subject) => subject.lifeAreaId === areaId && !subject.archived) : [];
  const archivedAreaSubjects = modules.has('subjects') ? state.subjects.filter((subject) => subject.lifeAreaId === areaId && subject.archived) : [];
  const overviewGoals = modules.has('goals') || modules.has('milestones') ? state.goals.filter((goal) => goal.lifeAreaId === areaId) : [];
  const overviewProjects = modules.has('projects') ? state.projects.filter((project) => project.lifeAreaId === areaId) : [];
  const overviewTasks = modules.has('tasks') ? state.tasks.filter((task) => task.lifeAreaId === areaId).slice(0, 5) : [];
  const overviewNotes = modules.has('notes') ? state.notes.filter((note) => note.attachedTo?.type === 'area' && note.attachedTo.id === areaId).slice(0, 4) : [];
  const overviewStudy = modules.has('study') ? state.study.filter((item) => item.lifeAreaId === areaId).slice(0, 3) : [];
  const overviewEvents = modules.has('calendar') ? state.events.filter((event) => event.lifeAreaId === areaId).slice(0, 4) : [];
  const overviewHabits = modules.has('habits') ? state.habits.filter((habit) => habit.lifeAreaId === areaId) : [];
  const overviewResources = modules.has('resources') ? state.resources.filter((resource) => resource.lifeAreaId === areaId) : [];

  const main = document.getElementById('mainContent');
  const tabBar = tabs.map((tab) => {
    const label = tab === 'overview' ? 'Overview' : AREA_MODULES.find((module) => module.id === tab)?.label || tab;
    return `<button class="tab-btn ${section === tab ? 'active' : ''}" data-action="area-tab" data-area-id="${area.id}" data-section="${tab}">${label}</button>`;
  }).join('');

  let body = '';
  if (section === 'overview') {
    const previews = [];
    const preview = (title, type, items, emptyMessage, renderItem) => `<div class="panel"><div class="panel-header"><h3>${title}</h3><button class="ghost-btn" data-action="area-tab" data-area-id="${area.id}" data-section="${type}">Open</button></div><div class="stack-list slim">${items.length ? items.slice(0, 4).map(renderItem).join('') : `<div class="empty-small">${emptyMessage}</div>`}</div></div>`;
    if (modules.has('subjects')) previews.push(preview('Subjects', 'subjects', areaSubjects, 'No subjects yet.', (subject) => `<button class="line-item subject-line" data-action="open-subject" data-subject-id="${subject.id}"><div><strong>${escapeHtml(subject.name)}</strong><small>${state.tasks.filter((task) => task.subjectId === subject.id).length} tasks</small></div><span>Open</span></button>`));
    if (modules.has('goals')) previews.push(preview('Goals', 'goals', overviewGoals, 'No goals yet.', (goal) => `<div class="line-item"><div><strong>${escapeHtml(goal.title)}</strong><small>${goal.progress}%</small></div><span>${escapeHtml(goal.status)}</span></div>`));
    if (modules.has('projects')) previews.push(preview('Projects', 'projects', overviewProjects, 'No projects yet.', (project) => `<div class="line-item"><div><strong>${escapeHtml(project.name)}</strong><small>${project.progress}%</small></div><span>${escapeHtml(project.status)}</span></div>`));
    if (modules.has('tasks')) previews.push(preview('Tasks', 'tasks', state.tasks.filter((task) => task.lifeAreaId === areaId), 'No tasks yet.', (task) => `<div class="line-item"><div><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.status)}</small></div><span>${escapeHtml(task.priority)}</span></div>`));
    if (modules.has('notes')) previews.push(preview('Notes', 'notes', overviewNotes, 'No notes yet.', (note) => `<div class="line-item"><div><strong>${escapeHtml(note.title)}</strong><small>${escapeHtml(note.body.slice(0, 55))}</small></div><span>${formatDate(note.createdAt)}</span></div>`));
    if (modules.has('habits')) previews.push(`<div class="panel"><div class="panel-header"><h3>Habits</h3><button class="ghost-btn" data-action="area-tab" data-area-id="${area.id}" data-section="habits">Open</button></div><div class="today-habit-list">${overviewHabits.length ? renderHabitChecklist(overviewHabits, isoDate(0), true) : '<div class="empty-small">No habits yet.</div>'}</div></div>`);
    if (modules.has('milestones')) {
      const milestones = overviewGoals.flatMap((goal) => (goal.milestones || []).map((milestone) => ({ ...milestone, goalTitle: goal.title })));
      previews.push(preview('Milestones', 'milestones', milestones, 'No milestones yet.', (milestone) => `<div class="line-item"><div><strong>${escapeHtml(milestone.title)}</strong><small>${escapeHtml(milestone.goalTitle)}</small></div><span>${milestone.done ? 'Done' : 'Open'}</span></div>`));
    }
    if (modules.has('resources')) previews.push(preview('Resources', 'resources', overviewResources, 'No resources yet.', (resource) => `<div class="line-item"><div><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(resource.url || resource.description)}</small></div></div>`));
    if (modules.has('study')) previews.push(preview('Study sessions', 'study', overviewStudy, 'No study items yet.', (item) => `<div class="line-item"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.goal)}</small></div><span>${formatDate(item.sessions?.[0]?.date || isoDate(0))}</span></div>`));
    if (modules.has('calendar')) previews.push(preview('Calendar', 'calendar', overviewEvents, 'No events yet.', (event) => `<div class="line-item"><div><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.type)}</small></div><span>${formatDate(event.date)}</span></div>`));
    body = previews.length ? `<div class="module-preview-grid">${previews.join('')}</div>` : '<div class="empty-state"><p>No modules selected for this Life Area.</p><button class="primary-btn" data-action="edit-area" data-area-id="' + area.id + '">Choose modules</button></div>';
  } else if (section === 'subjects') {
    body = `
      <div class="subject-section-heading"><div><p class="eyebrow">Life area subjects</p><h3>Organize work by subject</h3></div><button class="primary-btn" data-action="quick-add" data-type="subject" data-assign-area="${area.id}">+ Add subject</button></div>
      <div class="card-grid subject-card-grid">${areaSubjects.length ? areaSubjects.map((subject) => `<div class="panel subject-card"><div class="panel-header"><div><h3>${escapeHtml(subject.name)}</h3><small>${escapeHtml(subject.description || 'No description')}</small></div><div class="inline-actions"><button class="icon-btn" data-action="edit-subject" data-subject-id="${subject.id}" aria-label="Edit ${escapeHtml(subject.name)}">✎</button><button class="icon-btn" data-action="archive-subject" data-subject-id="${subject.id}">Archive</button><button class="icon-btn danger" data-action="delete-subject" data-subject-id="${subject.id}" aria-label="Delete ${escapeHtml(subject.name)}">✕</button></div></div><button class="ghost-btn" data-action="open-subject" data-subject-id="${subject.id}">Open subject</button></div>`).join('') : '<div class="empty-state"><p>No subjects in this Life Area yet.</p><button class="primary-btn" data-action="quick-add" data-type="subject" data-assign-area="' + area.id + '">Create subject</button></div>'}</div>
      ${archivedAreaSubjects.length ? `<div class="archived-subjects"><h3>Archived subjects</h3>${archivedAreaSubjects.map((subject) => `<div class="line-item"><div><strong>${escapeHtml(subject.name)}</strong><small>Archived</small></div><div class="inline-actions"><button class="ghost-btn" data-action="restore-subject" data-subject-id="${subject.id}">Restore</button><button class="icon-btn danger" data-action="delete-subject" data-subject-id="${subject.id}">Delete</button></div></div>`).join('')}</div>` : ''}
    `;
  } else if (section === 'goals') {
    body = `
      <div class="card-grid">
        ${overviewGoals.length ? overviewGoals.map((goal) => `
          <div class="panel goal-panel">
            <div class="panel-header">
              <div class="card-row"><span class="tiny-badge" style="background:${area.color}20; color:${area.color};">${area.name}</span><span class="status-pill status-${goal.status.toLowerCase().replace(/\s+/g, '-')}">${goal.status}</span></div>
              <div class="inline-actions"><button class="icon-btn" data-action="edit-goal" data-goal-id="${goal.id}">✎</button><button class="icon-btn danger" data-action="delete-goal" data-goal-id="${goal.id}">✕</button></div>
            </div>
            <h3>${escapeHtml(goal.title)}</h3>
            <p>${escapeHtml(goal.description)}</p>
            <div class="progress-track"><span style="width:${goal.progress}%; background:${area.color};"></span></div>
            <div class="meta-row"><span>${goal.progress}%</span><span>${formatDate(goal.targetDate)}</span></div>
          </div>
        `).join('') : '<div class="empty-state"><p>No goals yet for this area. Create one to turn intent into progress.</p><button class="primary-btn" data-action="quick-add" data-type="goal" data-assign-area="${area.id}">Create goal</button></div>'}
      </div>
    `;
  } else if (section === 'projects') {
    body = `
      <div class="card-grid">
        ${overviewProjects.length ? overviewProjects.map((project) => `
          <div class="panel project-panel">
            <div class="panel-header">
              <div class="card-row"><span class="tiny-badge" style="background:${area.color}20; color:${area.color};">${area.name}</span><span class="status-pill status-${project.status.toLowerCase().replace(/\s+/g, '-')}">${project.status}</span></div>
              <div class="inline-actions"><button class="icon-btn" data-action="edit-project" data-project-id="${project.id}">✎</button><button class="icon-btn danger" data-action="delete-project" data-project-id="${project.id}">✕</button></div>
            </div>
            <h3>${escapeHtml(project.name)}</h3>
            <p>${escapeHtml(project.description)}</p>
            <div class="progress-track"><span style="width:${project.progress}%; background:${area.color};"></span></div>
            <div class="meta-row"><span>${project.progress}%</span><span>${formatDate(project.deadline)}</span></div>
          </div>
        `).join('') : '<div class="empty-state"><p>No projects yet. Start the first workstream for this area.</p><button class="primary-btn" data-action="quick-add" data-type="project" data-assign-area="${area.id}">Create project</button></div>'}
      </div>
    `;
  } else if (section === 'tasks') {
    const tasks = state.tasks.filter((task) => task.lifeAreaId === areaId);
    body = `
      <div class="panel">
        <div class="task-list">
          ${tasks.length ? tasks.map((task) => `
            <div class="task-row ${task.status === 'Done' ? 'done' : ''}">
              <button class="task-toggle" data-action="toggle-task" data-task-id="${task.id}">${task.status === 'Done' ? '✓' : ''}</button>
              <div class="task-main">
                <div class="task-title-row"><strong>${escapeHtml(task.title)}</strong><span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span></div>
                <small>${escapeHtml(task.status)} • ${task.dueDate ? formatDate(task.dueDate) : 'No date'}</small>
              </div>
              <div class="task-actions"><button class="ghost-btn" data-action="edit-task" data-task-id="${task.id}">Edit</button><button class="icon-btn danger" data-action="delete-task" data-task-id="${task.id}">✕</button></div>
            </div>
          `).join('') : '<div class="empty-state"><p>No tasks yet in this area.</p><button class="primary-btn" data-action="quick-add" data-type="task" data-assign-area="${area.id}">Create task</button></div>'}
        </div>
      </div>
    `;
  } else if (section === 'study') {
    const items = state.study.filter((item) => item.lifeAreaId === areaId);
    body = `
      <div class="card-grid">
        ${items.length ? items.map((item) => `
          <div class="panel study-panel">
            <div class="panel-header"><h3>${area.icon} ${escapeHtml(item.title)}</h3><div class="inline-actions"><button class="icon-btn" data-action="edit-study" data-study-id="${item.id}">✎</button><button class="icon-btn danger" data-action="delete-study" data-study-id="${item.id}">✕</button></div></div>
            <p>${escapeHtml(item.goal)}</p>
            <div class="progress-track"><span style="width:${item.progress}%; background:${area.color};"></span></div>
            <div class="meta-row"><span>${item.progress}%</span><span>${item.sessions.length} sessions</span></div>
          </div>
        `).join('') : '<div class="empty-state"><p>No study sessions yet for this area.</p><button class="primary-btn" data-action="quick-add" data-type="study" data-assign-area="${area.id}">Add study session</button></div>'}
      </div>
    `;
  } else if (section === 'notes') {
    const notes = state.notes.filter((note) => note.attachedTo?.type === 'area' && note.attachedTo.id === areaId);
    body = `
      <div class="card-grid">
        ${notes.length ? notes.map((note) => `
          <div class="panel note-panel"><div class="panel-header"><h3>${escapeHtml(note.title)}</h3><div class="inline-actions"><button class="icon-btn" data-action="edit-note" data-note-id="${note.id}">✎</button><button class="icon-btn danger" data-action="delete-note" data-note-id="${note.id}">✕</button></div></div><p>${escapeHtml(note.body)}</p><small>${formatLongDate(note.createdAt)}</small></div>
        `).join('') : '<div class="empty-state"><p>No notes yet. Put an idea or observation here.</p><button class="primary-btn" data-action="quick-add" data-type="note" data-assign-area="${area.id}">Create note</button></div>'}
      </div>
    `;
  } else if (section === 'habits') {
    body = `
      <div class="panel">
        <div class="panel-header"><div><p class="eyebrow">Daily checklist</p><h3>Habits</h3></div><button class="primary-btn" data-action="quick-add" data-type="habit" data-assign-area="${area.id}">+ Add habit</button></div>
        <div class="today-habit-list">${overviewHabits.length ? renderHabitChecklist(overviewHabits, isoDate(0)) : '<div class="empty-small">No habits in this area yet.</div>'}</div>
      </div>
    `;
  } else if (section === 'milestones') {
    const milestones = overviewGoals.flatMap((goal) => (goal.milestones || []).map((milestone) => ({ ...milestone, goalTitle: goal.title })));
    body = `<div class="panel"><div class="panel-header"><h3>Milestones</h3><button class="ghost-btn" data-action="quick-add" data-type="goal" data-assign-area="${area.id}">+ Add goal</button></div><div class="stack-list slim">${milestones.length ? milestones.map((milestone) => `<div class="line-item"><div><strong>${escapeHtml(milestone.title)}</strong><small>${escapeHtml(milestone.goalTitle)}</small></div><span>${milestone.done ? 'Done' : 'Open'}</span></div>`).join('') : '<div class="empty-small">Milestones are managed within goals.</div>'}</div></div>`;
  } else if (section === 'resources') {
    body = `<div class="panel"><div class="panel-header"><h3>Resources</h3><button class="primary-btn" data-action="quick-add" data-type="resource" data-assign-area="${area.id}">+ Add resource</button></div><div class="stack-list slim">${overviewResources.length ? overviewResources.map((resource) => `<div class="line-item resource-row"><div><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(resource.description || resource.url || '')}</small></div><div class="inline-actions">${resource.url ? `<a class="ghost-btn" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}<button class="icon-btn" data-action="edit-resource" data-resource-id="${resource.id}" aria-label="Edit ${escapeHtml(resource.name)}">✎</button><button class="icon-btn danger" data-action="delete-resource" data-resource-id="${resource.id}" aria-label="Delete ${escapeHtml(resource.name)}">✕</button></div></div>`).join('') : '<div class="empty-small">No resources saved yet.</div>'}</div></div>`;
  } else if (section === 'calendar') {
    const events = state.events.filter((event) => event.lifeAreaId === areaId);
    body = `
      <div class="panel">
        <div class="panel-header"><h3>Upcoming items</h3><button class="ghost-btn" data-action="quick-add" data-type="event" data-assign-area="${area.id}">+ Add</button></div>
        <div class="stack-list slim">${events.length ? events.map((event) => `<div class="line-item"><div><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.type)}</small></div><span>${formatDate(event.date)}</span></div>`).join('') : '<div class="empty-small">No events for this area yet.</div>'}</div>
      </div>
    `;
  }

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Life area workspace</p>
          <h2>${area.icon} ${escapeHtml(area.name)}</h2>
        </div>
        <div class="inline-actions">
          <button class="ghost-btn" data-action="edit-area" data-area-id="${area.id}">Edit area</button>
          ${modules.has('tasks') ? `<button class="primary-btn" data-action="quick-add" data-type="task" data-assign-area="${area.id}">+ New task</button>` : ''}
        </div>
      </div>
      <div class="tab-row">${tabBar}</div>
      ${body}
    </div>
  `;

  bindDefaultActions();
}

function renderSubjectWorkspace(subjectId) {
  const subject = getSubjectById(subjectId);
  if (!subject) return;
  const area = getAreaById(subject.lifeAreaId);
  const related = {
    goals: state.goals.filter((item) => item.subjectId === subjectId),
    projects: state.projects.filter((item) => item.subjectId === subjectId),
    tasks: state.tasks.filter((item) => item.subjectId === subjectId),
    study: state.study.filter((item) => item.subjectId === subjectId),
    notes: state.notes.filter((item) => item.subjectId === subjectId)
  };
  const main = document.getElementById('mainContent');
  const block = (title, type, items, label, renderItem) => `<div class="panel"><div class="panel-header"><h3>${title}</h3><button class="ghost-btn" data-action="quick-add" data-type="${type}" data-assign-area="${subject.lifeAreaId}" data-assign-subject="${subject.id}">+ Add</button></div><div class="stack-list slim">${items.length ? items.map(renderItem).join('') : `<div class="empty-small">No ${label} linked to this subject.</div>`}</div></div>`;
  main.innerHTML = `<div class="page-shell"><div class="header-row spacing-row"><div><p class="eyebrow">${escapeHtml(area?.name || 'Life Area')} · Subject</p><h2>▤ ${escapeHtml(subject.name)}</h2><p>${escapeHtml(subject.description || '')}</p></div><div class="inline-actions"><button class="ghost-btn" data-action="edit-subject" data-subject-id="${subject.id}">Edit subject</button><button class="primary-btn" data-action="quick-add" data-type="task" data-assign-area="${subject.lifeAreaId}" data-assign-subject="${subject.id}">+ New task</button></div></div><div class="subject-related-grid">${block('Tasks', 'task', related.tasks, 'tasks', (item) => `<button class="line-item" data-action="edit-task" data-task-id="${item.id}"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.status)}</small></div><span>${item.priority}</span></button>`)}${block('Goals', 'goal', related.goals, 'goals', (item) => `<button class="line-item" data-action="edit-goal" data-goal-id="${item.id}"><div><strong>${escapeHtml(item.title)}</strong><small>${item.progress}%</small></div><span>${escapeHtml(item.status)}</span></button>`)}${block('Projects', 'project', related.projects, 'projects', (item) => `<button class="line-item" data-action="edit-project" data-project-id="${item.id}"><div><strong>${escapeHtml(item.name)}</strong><small>${item.progress}%</small></div><span>${escapeHtml(item.status)}</span></button>`)}${block('Study sessions', 'study', related.study, 'study sessions', (item) => `<button class="line-item" data-action="edit-study" data-study-id="${item.id}"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.goal || '')}</small></div><span>${item.sessions?.length || 0} sessions</span></button>`)}${block('Notes', 'note', related.notes, 'notes', (item) => `<button class="line-item" data-action="edit-note" data-note-id="${item.id}"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body.slice(0, 60))}</small></div><span>${formatDate(item.createdAt)}</span></button>`)}</div></div>`;
  bindDefaultActions();
}

function renderGoals() {
  const main = document.getElementById('mainContent');
  const cards = state.goals.map((goal) => {
    const area = getAreaById(goal.lifeAreaId);
    return `
      <div class="panel goal-panel">
        <div class="panel-header">
          <div class="card-row"><span class="tiny-badge" style="background:${area ? area.color : '#7c83ff'}20; color:${area ? area.color : '#7c83ff'};">${area ? escapeHtml(area.name) : 'General'}</span>${getSubjectLabel(goal.subjectId) ? `<span class="tiny-badge">${escapeHtml(getSubjectLabel(goal.subjectId))}</span>` : ''}<span class="status-pill status-${goal.status.toLowerCase().replace(/\s+/g, '-')}">${goal.status}</span></div>
          <div class="inline-actions">
            <button class="icon-btn" data-action="edit-goal" data-goal-id="${goal.id}">✎</button>
            <button class="icon-btn danger" data-action="delete-goal" data-goal-id="${goal.id}">✕</button>
          </div>
        </div>
        <h3>${escapeHtml(goal.title)}</h3>
        <p>${escapeHtml(goal.description)}</p>
        <div class="progress-track"><span style="width:${goal.progress}%; background:${area ? area.color : '#7c83ff'};"></span></div>
        <div class="meta-row"><span>${goal.progress}%</span><span>${formatDate(goal.targetDate)}</span></div>
        <div class="mini-list">
          ${goal.milestones.map((milestone) => `
            <div class="mini-list-item ${milestone.done ? 'done' : ''}">
              <span>${milestone.done ? '✓' : '○'}</span>
              <span>${escapeHtml(milestone.title)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Goals</p>
          <h2>Ambitions with structure</h2>
        </div>
        <button class="primary-btn" data-action="quick-add" data-type="goal">+ Add goal</button>
      </div>
      <div class="card-grid">${cards || '<div class="empty-state"><p>No goals yet.</p></div>'}</div>
    </div>
  `;

  bindDefaultActions();
}

function renderProjects() {
  const main = document.getElementById('mainContent');
  const cards = state.projects.map((project) => {
    const area = getAreaById(project.lifeAreaId);
    return `
      <div class="panel project-panel">
        <div class="panel-header">
          <div class="card-row"><span class="tiny-badge" style="background:${area ? area.color : '#7c83ff'}20; color:${area ? area.color : '#7c83ff'};">${area ? escapeHtml(area.name) : 'General'}</span>${getSubjectLabel(project.subjectId) ? `<span class="tiny-badge">${escapeHtml(getSubjectLabel(project.subjectId))}</span>` : ''}<span class="status-pill status-${project.status.toLowerCase().replace(/\s+/g, '-')}">${project.status}</span></div>
          <div class="inline-actions">
            <button class="icon-btn" data-action="edit-project" data-project-id="${project.id}">✎</button>
            <button class="icon-btn danger" data-action="delete-project" data-project-id="${project.id}">✕</button>
          </div>
        </div>
        <h3>${escapeHtml(project.name)}</h3>
        <p>${escapeHtml(project.description)}</p>
        <div class="progress-track"><span style="width:${project.progress}%; background:${area ? area.color : '#7c83ff'};"></span></div>
        <div class="meta-row"><span>${project.progress}%</span><span>${formatDate(project.deadline)}</span></div>
      </div>
    `;
  }).join('');

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Projects</p>
          <h2>Current work streams</h2>
        </div>
        <button class="primary-btn" data-action="quick-add" data-type="project">+ Add project</button>
      </div>
      <div class="card-grid">${cards || '<div class="empty-state"><p>No projects yet.</p></div>'}</div>
    </div>
  `;

  bindDefaultActions();
}

function renderTasks() {
  const main = document.getElementById('mainContent');
  const query = state.searchQuery.trim().toLowerCase();
  const tasks = state.tasks.filter((task) => {
    if (!query) return true;
    return [task.title, task.description, task.notes, task.tags?.join(' ') || '', getAreaById(task.lifeAreaId)?.name || ''].join(' ').toLowerCase().includes(query);
  }).sort((a, b) => {
    const priorityRank = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
    return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
  });

  const rows = tasks.map((task) => {
    const area = getAreaById(task.lifeAreaId);
    return `
      <div class="task-row ${task.status === 'Done' ? 'done' : ''}">
        <button class="task-toggle" data-action="toggle-task" data-task-id="${task.id}">${task.status === 'Done' ? '✓' : ''}</button>
        <div class="task-main">
          <div class="task-title-row">
            <strong>${escapeHtml(task.title)}</strong>
            <span class="priority-pill priority-${task.priority.toLowerCase()}">${task.priority}</span>
          </div>
          <small>${area ? escapeHtml(area.name) : 'General'}${getSubjectLabel(task.subjectId) ? ` · ${escapeHtml(getSubjectLabel(task.subjectId))}` : ''} • ${task.status} • ${task.dueDate ? formatDate(task.dueDate) : 'No date'}</small>
        </div>
        <div class="task-actions">
          <button class="ghost-btn" data-action="edit-task" data-task-id="${task.id}">Edit</button>
          <button class="icon-btn danger" data-action="delete-task" data-task-id="${task.id}">✕</button>
        </div>
      </div>
    `;
  }).join('') || '<div class="empty-state"><p>No tasks match your filters.</p></div>';

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Tasks</p>
          <h2>Capture, prioritize, and move</h2>
        </div>
        <button class="primary-btn" data-action="quick-add" data-type="task">+ Add task</button>
      </div>
      <div class="panel">
        <div class="task-list">${rows}</div>
      </div>
    </div>
  `;

  bindDefaultActions();
}

function renderStudy() {
  const main = document.getElementById('mainContent');
  const cards = state.study.map((studyItem) => {
    const area = getAreaById(studyItem.lifeAreaId);
    return `
      <div class="panel study-panel" style="--area-accent:${area ? area.color : '#7c83ff'};">
        <div class="panel-header">
          <h3>${area ? area.icon : '📘'} ${escapeHtml(studyItem.title)}</h3>
        </div>
        <p>${escapeHtml(studyItem.goal)}</p>
        ${getSubjectLabel(studyItem.subjectId) ? `<small class="subject-context">${escapeHtml(getSubjectLabel(studyItem.subjectId))}</small>` : ''}
        <div class="progress-track"><span style="width:${studyItem.progress}%; background:${area ? area.color : '#7c83ff'};"></span></div>
        <div class="meta-row"><span>${studyItem.progress}%</span><span>${studyItem.sessions.length} sessions</span></div>
        <div class="tag-list">
          ${studyItem.topics.map((topic) => `<span class="tag">${escapeHtml(topic)}</span>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Study</p>
          <h2>Learning systems, not random effort</h2>
        </div>
        <button class="primary-btn" data-action="quick-add" data-type="study">+ Add study</button>
      </div>
      <div class="study-grid">${cards}</div>
    </div>
  `;

  bindDefaultActions();
}

function renderHabits() {
  const main = document.getElementById('mainContent');
  const habits = state.habits;
  const cards = habits.map((habit) => `
    <div class="panel habit-panel">
      <div class="panel-header">
        <h3>${escapeHtml(habit.name)}</h3>
      </div>
      <div class="habit-meta">
        <span>Streak: ${habit.streak} days</span>
        <span>${habit.frequency}</span>
        <span>${escapeHtml(getAreaById(habit.lifeAreaId)?.name || 'General')}</span>
      </div>
      <div class="progress-track"><span style="width:${habit.completion}%; background:${habit.color || '#7c83ff'};"></span></div>
      <div class="meta-row"><span>${habit.completion}% consistency</span><span>+ ${habit.streak}</span></div>
    </div>
  `).join('');

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Habits</p>
          <h2>Small daily acts that shape your life</h2>
        </div>
        <button class="primary-btn" data-action="quick-add" data-type="habit">+ Add habit</button>
      </div>
      <div class="card-grid">${cards || '<div class="empty-state"><p>No habits in Life Areas with Habits enabled.</p></div>'}</div>
    </div>
  `;

  bindDefaultActions();
}

function renderNotes() {
  const main = document.getElementById('mainContent');
  const cards = state.notes.map((note) => {
    const attached = note.attachedTo?.type === 'area' ? getAreaById(note.attachedTo.id) : note.attachedTo?.type === 'goal' ? getGoalById(note.attachedTo.id) : null;
    return `
      <div class="panel note-panel">
        <div class="panel-header">
          <h3>${escapeHtml(note.title)}</h3>
          <span class="tiny-badge">${attached ? escapeHtml(attached.name || attached.title) : 'General'}</span>
          ${getSubjectLabel(note.subjectId) ? `<span class="tiny-badge">${escapeHtml(getSubjectLabel(note.subjectId))}</span>` : ''}
        </div>
        <p>${escapeHtml(note.body)}</p>
        <small>${formatLongDate(note.createdAt)}</small>
      </div>
    `;
  }).join('');

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Notes</p>
          <h2>Capture the ideas that matter</h2>
        </div>
        <button class="primary-btn" data-action="quick-add" data-type="note">+ Add note</button>
      </div>
      <div class="card-grid">${cards || '<div class="empty-state"><p>No notes yet.</p></div>'}</div>
    </div>
  `;

  bindDefaultActions();
}

function renderDrafts() {
  const main = document.getElementById('mainContent');
  const typeNames = { area: 'Life Area', subject: 'Subject', goal: 'Goal', project: 'Project', task: 'Task', study: 'Study session', habit: 'Habit', note: 'Note', event: 'Event', resource: 'Resource' };
  const cards = [...state.drafts].sort((a, b) => b.updatedAt - a.updatedAt).map((draft) => {
    const areaId = draft.values.lifeAreaId || (draft.type === 'area' ? draft.values.id : '');
    const areaName = getAreaById(areaId)?.name || 'No Life Area';
    const subjectName = getSubjectLabel(draft.values.subjectId);
    const title = draft.values.title || draft.values.name || draft.values.description || 'Untitled draft';
    return `<article class="panel draft-card"><div class="draft-card-main"><div class="card-row"><span class="tiny-badge">${typeNames[draft.type] || draft.type}</span><span class="draft-time">Last edited ${new Date(draft.updatedAt).toLocaleString()}</span></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml([areaName, subjectName].filter(Boolean).join(' · '))}</p></div><div class="inline-actions"><button class="primary-btn" data-action="resume-draft" data-draft-id="${draft.id}">Continue</button><button class="icon-btn danger" data-action="discard-draft" data-draft-id="${draft.id}">Discard</button></div></article>`;
  }).join('');
  main.innerHTML = `<div class="page-shell"><div class="header-row spacing-row"><div><p class="eyebrow">Workspace</p><h2>Drafts</h2></div></div><div class="draft-list">${cards || '<div class="empty-state"><p>No saved drafts.</p></div>'}</div></div>`;
  bindDefaultActions();
}

function renderAnalytics() {
  const main = document.getElementById('mainContent');
  const completedThisWeek = state.tasks.filter((task) => task.status === 'Done' && task.dueDate && Number((new Date() - new Date(task.dueDate + 'T00:00:00')) / 86400000) >= -7).length;
  const taskCompletionRate = state.tasks.length ? Math.round((state.tasks.filter((task) => task.status === 'Done').length / state.tasks.length) * 100) : 0;

  const areaStats = state.lifeAreas.map((area) => {
    const progress = getAreaProgress(area.id);
    return `
      <div class="stats-row">
        <div class="stats-label-row">
          <span>${area.icon} ${escapeHtml(area.name)}</span>
          <strong>${progress}%</strong>
        </div>
        <div class="progress-track"><span style="width:${progress}%; background:${area.color};"></span></div>
      </div>
    `;
  }).join('');

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Analytics</p>
          <h2>Signals, not noise</h2>
        </div>
      </div>
      <div class="section-grid three-up">
        <div class="panel stat-panel">
          <span class="metric-label">Tasks completed this week</span>
          <strong>${completedThisWeek}</strong>
        </div>
        <div class="panel stat-panel">
          <span class="metric-label">Completion rate</span>
          <strong>${taskCompletionRate}%</strong>
        </div>
        <div class="panel stat-panel">
          <span class="metric-label">Active life areas</span>
          <strong>${state.lifeAreas.length}</strong>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Life area progress</h3></div>
        <div class="stats-stack">${areaStats}</div>
      </div>
    </div>
  `;
}

function renderSettings() {
  const main = document.getElementById('mainContent');
  const createdAt = window.LIFEOS_PROFILE?.createdAt;
  const createdDate = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt || '');
  const memberSince = Number.isNaN(createdDate.getTime()) ? 'Account date unavailable' : `Member since ${createdDate.toLocaleDateString()}`;
  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Settings</p>
          <h2>Personalize the system</h2>
        </div>
      </div>
      <div class="panel settings-panel">
        <section class="account-section" aria-labelledby="accountHeading">
          <div class="account-heading">
            ${window.LIFEOS_AUTH_USER?.photoURL ? `<img class="account-avatar" src="${escapeHtml(window.LIFEOS_AUTH_USER.photoURL)}" alt="">` : '<span class="account-avatar account-avatar-fallback">◎</span>'}
            <div>
              <h3 id="accountHeading">Account</h3>
              <p>${escapeHtml(window.LIFEOS_AUTH_USER?.displayName || state.settings.name)} · ${escapeHtml(window.LIFEOS_AUTH_USER?.email || '')}</p>
              <small>${escapeHtml(memberSince)}</small>
            </div>
          </div>
          <button class="ghost-btn" data-action="account-sign-out">Log out</button>
        </section>
        <div class="settings-row">
          <div>
            <label>Profile name</label>
            <small>What should this dashboard call you?</small>
          </div>
          <input id="profileName" value="${escapeHtml(state.settings.name)}">
        </div>
        <div class="settings-row">
          <div>
            <label>Today's focus</label>
            <small>Use this as your daily anchor.</small>
          </div>
          <textarea id="focusText">${escapeHtml(state.settings.todayFocus)}</textarea>
        </div>
        <div class="settings-row">
          <div>
            <label>Theme</label>
            <small>Switch between calm dark and daylight light.</small>
          </div>
          <button class="primary-btn" data-action="toggle-theme">${state.settings.theme === 'dark' ? 'Switch to light' : 'Switch to dark'}</button>
        </div>
        <div class="settings-row danger-row">
          <div>
            <label>Reset workspace</label>
            <small>This removes custom data and resets the app.</small>
          </div>
          <button class="danger-btn" data-action="reset-data">Reset</button>
        </div>
      </div>
    </div>
  `;

  bindDefaultActions();
}

function syncTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.theme || 'dark');
}

function openAreaView(areaId) {
  state.selectedAreaId = areaId;
  const area = getAreaById(areaId);
  const main = document.getElementById('mainContent');
  if (!area) return;

  const areaTasks = state.tasks.filter((task) => task.lifeAreaId === areaId);
  const areaGoals = state.goals.filter((goal) => goal.lifeAreaId === areaId);
  const areaProjects = state.projects.filter((project) => project.lifeAreaId === areaId);
  const areaNotes = state.notes.filter((note) => note.attachedTo?.id === areaId);

  main.innerHTML = `
    <div class="page-shell">
      <div class="header-row spacing-row">
        <div>
          <p class="eyebrow">Life area</p>
          <h2>${area.icon} ${escapeHtml(area.name)}</h2>
        </div>
        <button class="primary-btn" data-action="quick-add" data-type="task" data-assign-area="${area.id}">+ Add task</button>
      </div>
      <div class="section-grid three-up">
        <div class="panel">
          <div class="panel-header"><h3>Goals</h3></div>
          <div class="stack-list slim">
            ${areaGoals.length ? areaGoals.map((goal) => `<div class="line-item"><div><strong>${escapeHtml(goal.title)}</strong><small>${goal.progress}%</small></div><span>${goal.status}</span></div>`).join('') : '<div class="empty-small">No goals for this area yet.</div>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Projects</h3></div>
          <div class="stack-list slim">
            ${areaProjects.length ? areaProjects.map((project) => `<div class="line-item"><div><strong>${escapeHtml(project.name)}</strong><small>${project.progress}%</small></div><span>${project.status}</span></div>`).join('') : '<div class="empty-small">No projects tracked.</div>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Tasks</h3></div>
          <div class="stack-list slim">
            ${areaTasks.length ? areaTasks.slice(0, 6).map((task) => `<div class="line-item"><div><strong>${escapeHtml(task.title)}</strong><small>${task.status}</small></div><span>${task.priority}</span></div>`).join('') : '<div class="empty-small">No tasks active.</div>'}
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Notes</h3></div>
        <div class="stack-list slim">
          ${areaNotes.length ? areaNotes.map((note) => `<div class="line-item"><div><strong>${escapeHtml(note.title)}</strong><small>${escapeHtml(note.body.slice(0, 80))}</small></div><span>${formatDate(note.createdAt)}</span></div>`).join('') : '<div class="empty-small">No notes saved yet.</div>'}
        </div>
      </div>
    </div>
  `;

  bindDefaultActions();
}

function renderQuickAddMenu() {
  const modal = document.getElementById('modalBackdrop');
  modal.hidden = false;
  modal.innerHTML = `
    <div class="modal-card quick-add-card">
      <div class="modal-head"><h3>Quick add</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
      <div class="quick-add-grid">
        ${['task', 'goal', 'project', 'area', 'study', 'habit', 'note', 'event', 'resource'].map((type) => `<button class="quick-add-item" data-action="quick-add-select" data-type="${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</button>`).join('')}
      </div>
    </div>
  `;
  modal.querySelectorAll('[data-action="quick-add-select"]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.type;
      const preset = { lifeAreaId: state.lifeAreas[0]?.id || '' };
      renderModal(type, preset);
    });
  });
  modal.querySelectorAll('[data-action="close-modal"]').forEach((button) => button.addEventListener('click', () => {
    modal.hidden = true;
    modal.innerHTML = '';
  }));
}

function renderModal(type, preset = {}, draftId = '') {
  const modal = document.getElementById('modalBackdrop');
  const draft = draftId ? getDraftById(draftId) : null;
  const entityId = draft?.entityId || preset.id || '';
  if (draft) preset = { ...draft.values, ...(entityId ? { id: entityId } : {}) };
  let activeDraftId = draft?.id || '';
  let autosaveTimeout;
  const close = () => {
    clearTimeout(autosaveTimeout);
    const form = modal.querySelector('#modalForm');
    if (form?.dataset.dirty === 'true') {
      activeDraftId = saveDraft(type, entityId, getModalFormValues(form), activeDraftId).id;
    }
    modal.hidden = true;
    modal.innerHTML = '';
  };

  const defaultArea = state.lifeAreas[0]?.id || '';
  const subjectOptions = (lifeAreaId, subjectId) => `<option value="">No subject</option>${state.subjects.filter((subject) => subject.lifeAreaId === (lifeAreaId || defaultArea) && (!subject.archived || subject.id === subjectId)).map((subject) => `<option value="${subject.id}" ${subjectId === subject.id ? 'selected' : ''}>${escapeHtml(subject.name)}${subject.archived ? ' (Archived)' : ''}</option>`).join('')}`;

  const forms = {
    subject: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Create'} subject</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="subject" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label class="full-width">Name<input name="name" value="${escapeHtml(preset.name || '')}" required></label>
            <label>Life area<select name="lifeAreaId" required>${state.lifeAreas.filter((area) => !area.archived).map((area) => `<option value="${area.id}" ${preset.lifeAreaId === area.id || (!preset.lifeAreaId && area.id === (state.selectedAreaId || defaultArea)) ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}</select></label>
            <label class="full-width">Description<textarea name="description">${escapeHtml(preset.description || '')}</textarea></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Close</button><button type="submit" class="primary-btn">Save subject</button></div>
        </form>
      </div>
    `,
    area: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Create'} life area</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="area" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label>Name<input name="name" value="${escapeHtml(preset.name || '')}" required></label>
            <label>Icon<input name="icon" value="${escapeHtml(preset.icon || '✨')}" required></label>
            <label>Color<input type="color" name="color" value="${preset.color || '#7c83ff'}"></label>
            <label>Priority<select name="priority"><option ${preset.priority === 'Low' ? 'selected' : ''}>Low</option><option ${preset.priority === 'Medium' || !preset.priority ? 'selected' : ''}>Medium</option><option ${preset.priority === 'High' ? 'selected' : ''}>High</option><option ${preset.priority === 'Critical' ? 'selected' : ''}>Critical</option></select></label>
            <fieldset class="module-fieldset full-width"><legend>Life Area modules</legend><p>Choose the sections that belong in this area. Turning a module off keeps its saved data.</p><div class="module-choice-grid">${AREA_MODULES.map((module) => `<label class="module-choice"><input type="checkbox" name="modules" value="${module.id}" ${(preset.modules || []).includes(module.id) ? 'checked' : ''}><span>${module.icon} ${module.label}</span></label>`).join('')}</div></fieldset>
            <label class="full-width">Description<textarea name="description">${escapeHtml(preset.description || '')}</textarea></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Cancel</button><button type="submit" class="primary-btn">Save</button></div>
        </form>
      </div>
    `,
    goal: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Create'} goal</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="goal" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label class="full-width">Title<input name="title" value="${escapeHtml(preset.title || '')}" required></label>
            <label class="full-width">Description<textarea name="description">${escapeHtml(preset.description || '')}</textarea></label>
            <label>Life area<select name="lifeAreaId">${state.lifeAreas.map((area) => `<option value="${area.id}" ${preset.lifeAreaId === area.id || (!preset.lifeAreaId && area.id === defaultArea) ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}</select></label>
            <label>Subject<select name="subjectId">${subjectOptions(preset.lifeAreaId, preset.subjectId)}</select></label>
            <label>Priority<select name="priority"><option ${preset.priority === 'Low' ? 'selected' : ''}>Low</option><option ${preset.priority === 'Medium' || !preset.priority ? 'selected' : ''}>Medium</option><option ${preset.priority === 'High' ? 'selected' : ''}>High</option><option ${preset.priority === 'Urgent' ? 'selected' : ''}>Urgent</option></select></label>
            <label>Status<select name="status"><option ${preset.status === 'Not Started' ? 'selected' : ''}>Not Started</option><option ${preset.status === 'In Progress' || !preset.status ? 'selected' : ''}>In Progress</option><option ${preset.status === 'On Hold' ? 'selected' : ''}>On Hold</option><option ${preset.status === 'Completed' ? 'selected' : ''}>Completed</option><option ${preset.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option></select></label>
            <label>Start date<input type="date" name="startDate" value="${preset.startDate || isoDate(-7)}"></label>
            <label>Target date<input type="date" name="targetDate" value="${preset.targetDate || isoDate(30)}"></label>
            <label>Progress<input type="number" name="progress" min="0" max="100" value="${preset.progress || 0}"></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Cancel</button><button type="submit" class="primary-btn">Save</button></div>
        </form>
      </div>
    `,
    project: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Create'} project</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="project" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label class="full-width">Name<input name="name" value="${escapeHtml(preset.name || '')}" required></label>
            <label class="full-width">Description<textarea name="description">${escapeHtml(preset.description || '')}</textarea></label>
            <label>Life area<select name="lifeAreaId">${state.lifeAreas.map((area) => `<option value="${area.id}" ${preset.lifeAreaId === area.id || (!preset.lifeAreaId && area.id === defaultArea) ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}</select></label>
            <label>Subject<select name="subjectId">${subjectOptions(preset.lifeAreaId, preset.subjectId)}</select></label>
            <label>Goal<select name="goalId"><option value="">No goal</option>${state.goals.filter((goal) => goal.lifeAreaId === (preset.lifeAreaId || defaultArea)).map((goal) => `<option value="${goal.id}" ${preset.goalId === goal.id ? 'selected' : ''}>${escapeHtml(goal.title)}</option>`).join('')}</select></label>
            <label>Start date<input type="date" name="startDate" value="${preset.startDate || isoDate(-7)}"></label>
            <label>Deadline<input type="date" name="deadline" value="${preset.deadline || isoDate(14)}"></label>
            <label>Status<select name="status"><option ${preset.status === 'Planning' ? 'selected' : ''}>Planning</option><option ${preset.status === 'In Progress' || !preset.status ? 'selected' : ''}>In Progress</option><option ${preset.status === 'Completed' ? 'selected' : ''}>Completed</option></select></label>
            <label>Priority<select name="priority"><option ${preset.priority === 'Low' ? 'selected' : ''}>Low</option><option ${preset.priority === 'Medium' || !preset.priority ? 'selected' : ''}>Medium</option><option ${preset.priority === 'High' ? 'selected' : ''}>High</option><option ${preset.priority === 'Urgent' ? 'selected' : ''}>Urgent</option></select></label>
            <label>Progress<input type="number" name="progress" min="0" max="100" value="${preset.progress || 0}"></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Cancel</button><button type="submit" class="primary-btn">Save</button></div>
        </form>
      </div>
    `,
    task: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Create'} task</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="task" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label class="full-width">Title<input name="title" value="${escapeHtml(preset.title || '')}" required></label>
            <label class="full-width">Description<textarea name="description">${escapeHtml(preset.description || '')}</textarea></label>
            <label>Life area<select name="lifeAreaId">${state.lifeAreas.map((area) => `<option value="${area.id}" ${preset.lifeAreaId === area.id || (!preset.lifeAreaId && area.id === defaultArea) ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}</select></label>
            <label>Subject<select name="subjectId">${subjectOptions(preset.lifeAreaId, preset.subjectId)}</select></label>
            <label>Project<select name="projectId"><option value="">No project</option>${state.projects.filter((project) => project.lifeAreaId === (preset.lifeAreaId || defaultArea)).map((project) => `<option value="${project.id}" ${preset.projectId === project.id ? 'selected' : ''}>${escapeHtml(project.name)}</option>`).join('')}</select></label>
            <label>Goal<select name="goalId"><option value="">No goal</option>${state.goals.filter((goal) => goal.lifeAreaId === (preset.lifeAreaId || defaultArea)).map((goal) => `<option value="${goal.id}" ${preset.goalId === goal.id ? 'selected' : ''}>${escapeHtml(goal.title)}</option>`).join('')}</select></label>
            <label>Priority<select name="priority"><option ${preset.priority === 'Low' ? 'selected' : ''}>Low</option><option ${preset.priority === 'Medium' || !preset.priority ? 'selected' : ''}>Medium</option><option ${preset.priority === 'High' ? 'selected' : ''}>High</option><option ${preset.priority === 'Urgent' ? 'selected' : ''}>Urgent</option></select></label>
            <label>Status<select name="status"><option ${preset.status === 'To Do' || !preset.status ? 'selected' : ''}>To Do</option><option ${preset.status === 'In Progress' ? 'selected' : ''}>In Progress</option><option ${preset.status === 'Done' ? 'selected' : ''}>Done</option></select></label>
            <label>Due date<input type="date" name="dueDate" value="${preset.dueDate || isoDate(1)}"></label>
            <label>Estimated mins<input type="number" name="estimatedMins" value="${preset.estimatedMins || 30}"></label>
            <label>Actual mins<input type="number" name="actualMins" value="${preset.actualMins || 0}"></label>
            <label class="full-width">Tags<input name="tags" value="${escapeHtml((preset.tags || []).join(', '))}"></label>
            <label class="full-width">Notes<textarea name="notes">${escapeHtml(preset.notes || '')}</textarea></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Cancel</button><button type="submit" class="primary-btn">Save</button></div>
        </form>
      </div>
    `,
    habit: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Create'} habit</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="habit" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label>Name<input name="name" value="${escapeHtml(preset.name || '')}" required></label>
            <label>Life area<select name="lifeAreaId">${state.lifeAreas.map((area) => `<option value="${area.id}" ${preset.lifeAreaId === area.id ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}</select></label>
            <label>Subject<select name="subjectId">${subjectOptions(preset.lifeAreaId, preset.subjectId)}</select></label>
            <label>Frequency<select name="frequency"><option ${preset.frequency === 'daily' || !preset.frequency ? 'selected' : ''}>daily</option><option ${preset.frequency === 'weekly' ? 'selected' : ''}>weekly</option></select></label>
            <label>Color<input type="color" name="color" value="${preset.color || '#7c83ff'}"></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Cancel</button><button type="submit" class="primary-btn">Save</button></div>
        </form>
      </div>
    `,
    study: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Create'} study session</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="study" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label class="full-width">Title<input name="title" value="${escapeHtml(preset.title || '')}" required></label>
            <label class="full-width">Goal<textarea name="goal">${escapeHtml(preset.goal || '')}</textarea></label>
            <label>Life area<select name="lifeAreaId">${state.lifeAreas.map((area) => `<option value="${area.id}" ${preset.lifeAreaId === area.id || (!preset.lifeAreaId && area.id === defaultArea) ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}</select></label>
            <label>Subject<select name="subjectId">${subjectOptions(preset.lifeAreaId, preset.subjectId)}</select></label>
            <label>Topic<input name="topic" value="${escapeHtml(preset.topics?.[0] || '')}"></label>
            <label>Progress<input type="number" name="progress" min="0" max="100" value="${preset.progress || 0}"></label>
            <label>Date<input type="date" name="date" value="${preset.sessions?.[0]?.date || isoDate(0)}"></label>
            <label>Start time<input type="time" name="startTime" value="${preset.sessions?.[0]?.startTime || '09:00'}"></label>
            <label>Duration (mins)<input type="number" name="duration" value="${preset.sessions?.[0]?.duration || 60}"></label>
            <label>Status<select name="status"><option ${preset.sessions?.[0]?.status === 'Planned' || !preset.sessions?.[0]?.status ? 'selected' : ''}>Planned</option><option ${preset.sessions?.[0]?.status === 'Completed' ? 'selected' : ''}>Completed</option></select></label>
            <label class="full-width">Notes<textarea name="notes">${escapeHtml(preset.sessions?.[0]?.notes || '')}</textarea></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Cancel</button><button type="submit" class="primary-btn">Save</button></div>
        </form>
      </div>
    `,
    note: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Create'} note</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="note" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label class="full-width">Title<input name="title" value="${escapeHtml(preset.title || '')}" required></label>
            <label class="full-width">Body<textarea name="body" required>${escapeHtml(preset.body || '')}</textarea></label>
            <label>Life area<select name="lifeAreaId">${state.lifeAreas.map((area) => `<option value="${area.id}" ${preset.lifeAreaId === area.id || (!preset.lifeAreaId && area.id === (state.selectedAreaId || defaultArea)) ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}</select></label>
            <label>Attach to<select name="attachedType"><option value="area" ${preset.attachedTo?.type === 'area' || !preset.attachedTo ? 'selected' : ''}>Life area</option><option value="goal" ${preset.attachedTo?.type === 'goal' ? 'selected' : ''}>Goal</option></select></label>
            <label>Subject<select name="subjectId">${subjectOptions(preset.lifeAreaId || state.selectedAreaId, preset.subjectId)}</select></label>
            <label>Target<select name="attachedId">${state.lifeAreas.map((area) => `<option value="area:${area.id}" ${preset.attachedTo?.id === area.id && preset.attachedTo?.type === 'area' ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}${state.goals.map((goal) => `<option value="goal:${goal.id}" ${preset.attachedTo?.id === goal.id && preset.attachedTo?.type === 'goal' ? 'selected' : ''}>${escapeHtml(goal.title)}</option>`).join('')}</select></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Cancel</button><button type="submit" class="primary-btn">Save</button></div>
        </form>
      </div>
    `,
    event: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Create'} event</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="event" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label class="full-width">Title<input name="title" value="${escapeHtml(preset.title || '')}" required></label>
            <label>Life area<select name="lifeAreaId">${state.lifeAreas.map((area) => `<option value="${area.id}" ${preset.lifeAreaId === area.id || (!preset.lifeAreaId && area.id === defaultArea) ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}</select></label>
            <label>Subject<select name="subjectId">${subjectOptions(preset.lifeAreaId, preset.subjectId)}</select></label>
            <label>Type<select name="type"><option ${preset.type === 'Deadline' ? 'selected' : ''}>Deadline</option><option ${preset.type === 'Milestone' || !preset.type ? 'selected' : ''}>Milestone</option><option ${preset.type === 'Focus' ? 'selected' : ''}>Focus</option></select></label>
            <label>Date<input type="date" name="date" value="${preset.date || isoDate(1)}"></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Cancel</button><button type="submit" class="primary-btn">Save</button></div>
        </form>
      </div>
    `,
    resource: `
      <div class="modal-card">
        <div class="modal-head"><h3>${preset.id ? 'Edit' : 'Add'} resource</h3><button class="icon-btn" data-action="close-modal">✕</button></div>
        <form id="modalForm" data-type="resource" data-id="${preset.id || ''}">
          <div class="form-grid">
            <label class="full-width">Name<input name="name" value="${escapeHtml(preset.name || '')}" required></label>
            <label class="full-width">Link<input type="url" name="url" value="${escapeHtml(preset.url || '')}" placeholder="https://"></label>
            <label class="full-width">Description<textarea name="description">${escapeHtml(preset.description || '')}</textarea></label>
            <label>Life area<select name="lifeAreaId">${state.lifeAreas.map((area) => `<option value="${area.id}" ${preset.lifeAreaId === area.id || (!preset.lifeAreaId && area.id === (state.selectedAreaId || defaultArea)) ? 'selected' : ''}>${escapeHtml(area.name)}</option>`).join('')}</select></label>
          </div>
          <div class="modal-actions"><button type="button" class="ghost-btn" data-action="close-modal">Cancel</button><button type="submit" class="primary-btn">Save resource</button></div>
        </form>
      </div>
    `
  };

  modal.hidden = false;
  modal.innerHTML = forms[type] || forms.task;

  const form = document.getElementById('modalForm');
  if (form) {
    const attachDiscardButton = () => {
      if (!activeDraftId || form.querySelector('[data-action="discard-current-draft"]')) return;
      const discard = document.createElement('button');
      discard.type = 'button';
      discard.className = 'danger-btn';
      discard.dataset.action = 'discard-current-draft';
      discard.textContent = 'Discard draft';
      discard.addEventListener('click', () => {
        clearTimeout(autosaveTimeout);
        deleteDraft(activeDraftId);
        activeDraftId = '';
        modal.hidden = true;
        modal.innerHTML = '';
        renderCurrentView();
      });
      form.querySelector('.modal-actions')?.prepend(discard);
    };
    attachDiscardButton();
    const autosave = () => {
      form.dataset.dirty = 'true';
      const values = getModalFormValues(form);
      activeDraftId = saveDraft(type, entityId, values, activeDraftId).id;
      form.dataset.dirty = 'false';
      attachDiscardButton();
      const status = modal.querySelector('.draft-save-status');
      if (status) status.textContent = 'Draft saved';
    };
    const queueAutosave = () => {
      form.dataset.dirty = 'true';
      clearTimeout(autosaveTimeout);
      autosaveTimeout = setTimeout(autosave, 350);
    };
    form.addEventListener('input', queueAutosave);
    form.addEventListener('change', queueAutosave);
    const refreshAreaOptions = () => {
      const lifeAreaId = form.querySelector('[name="lifeAreaId"]')?.value || defaultArea;
      const refreshSelect = (select, options) => {
        if (!select) return;
        const previousValue = select.value;
        select.innerHTML = options;
        select.value = [...select.options].some((option) => option.value === previousValue)
          ? previousValue
          : (select.options[0]?.value || '');
      };
      const selectedSubjectId = form.querySelector('[name="subjectId"]')?.value;
      const subjects = state.subjects.filter((subject) => subject.lifeAreaId === lifeAreaId && (!subject.archived || subject.id === selectedSubjectId));
      refreshSelect(form.querySelector('[name="subjectId"]'), `<option value="">No subject</option>${subjects.map((subject) => `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`).join('')}`);

      const goals = state.goals.filter((goal) => goal.lifeAreaId === lifeAreaId && !goal.archived);
      refreshSelect(form.querySelector('[name="goalId"]'), `<option value="">No goal</option>${goals.map((goal) => `<option value="${goal.id}">${escapeHtml(goal.title)}</option>`).join('')}`);

      const projects = state.projects.filter((project) => project.lifeAreaId === lifeAreaId && !project.archived);
      refreshSelect(form.querySelector('[name="projectId"]'), `<option value="">No project</option>${projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('')}`);

      const targetSelect = form.querySelector('[name="attachedId"]');
      if (targetSelect) {
        const targetType = form.querySelector('[name="attachedType"]')?.value || 'area';
        const targetOptions = targetType === 'goal'
          ? goals.map((goal) => `<option value="goal:${goal.id}">${escapeHtml(goal.title)}</option>`).join('')
          : state.lifeAreas.filter((area) => area.id === lifeAreaId && !area.archived).map((area) => `<option value="area:${area.id}">${escapeHtml(area.name)}</option>`).join('');
        refreshSelect(targetSelect, targetOptions);
      }
    };
    form.querySelector('[name="lifeAreaId"]')?.addEventListener('change', () => {
      refreshAreaOptions();
      queueAutosave();
    });
    form.querySelector('[name="attachedType"]')?.addEventListener('change', () => {
      refreshAreaOptions();
      queueAutosave();
    });
    refreshAreaOptions();
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearTimeout(autosaveTimeout);
      const entries = getModalFormValues(form);
      saveForm(type, entries, entityId);
      if (activeDraftId) deleteDraft(activeDraftId);
      else if (entityId) {
        const matchingDraft = state.drafts.find((entry) => entry.type === type && entry.entityId === entityId);
        if (matchingDraft) deleteDraft(matchingDraft.id);
      }
      modal.hidden = true;
      modal.innerHTML = '';
      renderCurrentView();
    });
  }

  const matchingDrafts = state.drafts.filter((entry) => entry.type === type && entry.id !== activeDraftId);
  if (matchingDrafts.length) {
    const draftPicker = document.createElement('div');
    draftPicker.className = 'modal-draft-picker';
    draftPicker.innerHTML = `<strong>Saved ${type} drafts</strong>${matchingDrafts.map((entry) => `<button type="button" class="draft-picker-item" data-action="resume-draft" data-draft-id="${entry.id}"><span>${escapeHtml(entry.values.title || entry.values.name || 'Untitled')}</span><small>Last edited ${new Date(entry.updatedAt).toLocaleString()}</small></button>`).join('')}`;
    modal.querySelector('.modal-card')?.prepend(draftPicker);
  }
  const status = document.createElement('small');
  status.className = 'draft-save-status';
  status.textContent = draft ? `Draft last edited ${new Date(draft.updatedAt).toLocaleString()}` : 'Changes save as a draft while you type';
  modal.querySelector('.modal-head')?.after(status);

  modal.querySelectorAll('[data-action="close-modal"]').forEach((button) => button.addEventListener('click', close));
  modal.querySelectorAll('[data-action="resume-draft"]').forEach((button) => button.addEventListener('click', () => renderModal(type, {}, button.dataset.draftId)));
}

function saveForm(type, values, id) {
  if (!state.lifeAreas.length && ['goal', 'project', 'task', 'study', 'habit', 'event', 'resource'].includes(type)) {
    state.lifeAreas.push({
      id: `area-${Date.now()}`,
      name: 'General',
      icon: '◎',
      color: '#7c83ff',
      description: 'Your general life area for goals and tasks created before a dedicated category exists.',
      modules: [{ goal: 'goals', project: 'projects', task: 'tasks', study: 'study', habit: 'habits', event: 'calendar', resource: 'resources' }[type]].filter(Boolean),
    });
  }

  switch (type) {
    case 'subject': {
      const payload = { id: id || `subject-${Date.now()}`, name: values.name.trim(), description: values.description.trim(), lifeAreaId: values.lifeAreaId || state.lifeAreas[0]?.id || '', archived: id ? !!getSubjectById(id)?.archived : false };
      if (id) {
        const index = state.subjects.findIndex((subject) => subject.id === id);
        if (index >= 0) state.subjects[index] = { ...state.subjects[index], ...payload };
      } else {
        state.subjects.push(payload);
      }
      ['goals', 'projects', 'tasks', 'study', 'habits', 'notes', 'events'].forEach((collection) => {
        state[collection].forEach((item) => {
          if (item.subjectId === payload.id) item.lifeAreaId = payload.lifeAreaId;
        });
      });
      state.drafts.forEach((draft) => {
        if (draft.values.subjectId === payload.id) draft.values.lifeAreaId = payload.lifeAreaId;
      });
      break;
    }
    case 'area': {
      const existingArea = id ? getAreaById(id) : null;
      const payload = { id: id || `area-${Date.now()}`, name: values.name.trim(), icon: values.icon.trim() || '✨', color: values.color || '#7c83ff', description: values.description.trim(), priority: values.priority || 'Medium', modules: Array.isArray(values.modules) ? values.modules.filter((moduleId) => AREA_MODULES.some((module) => module.id === moduleId)) : (existingArea ? getAreaModules(existingArea) : []), archived: !!existingArea?.archived };
      if (id) {
        const index = state.lifeAreas.findIndex((area) => area.id === id);
        if (index >= 0) state.lifeAreas[index] = { ...state.lifeAreas[index], ...payload };
      } else {
        state.lifeAreas.push(payload);
      }
      break;
    }
    case 'goal': {
      const payload = { id: id || `goal-${Date.now()}`, title: values.title.trim(), description: values.description.trim(), lifeAreaId: values.lifeAreaId || state.lifeAreas[0]?.id || '', subjectId: values.subjectId || '', priority: values.priority, status: values.status, startDate: values.startDate || isoDate(-7), targetDate: values.targetDate || isoDate(30), progress: Number(values.progress || 0), milestones: id ? (getGoalById(id)?.milestones || []) : [{ id: `m-${Date.now()}`, title: 'First milestone', done: false }], notes: '' };
      if (id) {
        const index = state.goals.findIndex((goal) => goal.id === id);
        if (index >= 0) state.goals[index] = { ...state.goals[index], ...payload };
      } else {
        state.goals.push(payload);
      }
      break;
    }
    case 'project': {
      const payload = { id: id || `project-${Date.now()}`, name: values.name.trim(), description: values.description.trim(), lifeAreaId: values.lifeAreaId || state.lifeAreas[0]?.id || '', subjectId: values.subjectId || '', goalId: values.goalId || '', startDate: values.startDate || isoDate(-7), deadline: values.deadline || isoDate(14), status: values.status || 'In Progress', priority: values.priority || 'Medium', progress: Number(values.progress || 0), notes: '' };
      if (id) {
        const index = state.projects.findIndex((project) => project.id === id);
        if (index >= 0) state.projects[index] = { ...state.projects[index], ...payload };
      } else {
        state.projects.push(payload);
      }
      break;
    }
    case 'task': {
      const payload = { id: id || `task-${Date.now()}`, title: values.title.trim(), description: values.description.trim(), lifeAreaId: values.lifeAreaId || state.lifeAreas[0]?.id || '', subjectId: values.subjectId || '', projectId: values.projectId || '', goalId: values.goalId || '', dueDate: values.dueDate || isoDate(1), priority: values.priority || 'Medium', status: values.status || 'To Do', estimatedMins: Number(values.estimatedMins || 30), actualMins: Number(values.actualMins || 0), tags: String(values.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean), notes: values.notes.trim() };
      if (id) {
        const index = state.tasks.findIndex((task) => task.id === id);
        if (index >= 0) state.tasks[index] = { ...state.tasks[index], ...payload };
      } else {
        state.tasks.push(payload);
      }
      break;
    }
    case 'study': {
      const areaId = values.lifeAreaId || state.lifeAreas[0]?.id || '';
      const entry = {
        id: id || `study-${Date.now()}`,
        title: values.title.trim(),
        lifeAreaId: areaId,
        subjectId: values.subjectId || '',
        goal: values.goal.trim(),
        progress: Number(values.progress || 0),
        topics: [values.topic.trim(), 'Practice'].filter(Boolean),
        sessions: id ? (state.study.find((item) => item.id === id)?.sessions || []) : []
      };
      const session = {
        id: `session-${Date.now()}`,
        date: values.date || isoDate(0),
        startTime: values.startTime || '09:00',
        duration: Number(values.duration || 60),
        status: values.status || 'Planned',
        title: values.title.trim(),
        topic: values.topic.trim(),
        goal: values.goal.trim(),
        notes: values.notes || ''
      };
      if (id) {
        const index = state.study.findIndex((item) => item.id === id);
        if (index >= 0) {
          state.study[index] = { ...state.study[index], ...entry, sessions: [...state.study[index].sessions, session] };
        }
      } else {
        state.study.push({ ...entry, sessions: [session] });
      }
      break;
    }
    case 'habit': {
      if (id) {
        const index = state.habits.findIndex((habit) => habit.id === id);
        if (index >= 0) state.habits[index] = { ...state.habits[index], id, name: values.name.trim(), lifeAreaId: values.lifeAreaId || state.lifeAreas[0]?.id || '', subjectId: values.subjectId || '', frequency: values.frequency || 'daily', color: values.color || '#7c83ff' };
      } else {
        state.habits.push({ id: `habit-${Date.now()}`, name: values.name.trim(), lifeAreaId: values.lifeAreaId || state.lifeAreas[0]?.id || '', subjectId: values.subjectId || '', frequency: values.frequency || 'daily', streak: 0, completion: 0, completionHistory: {}, color: values.color || '#7c83ff' });
      }
      break;
    }
    case 'note': {
      const [kind, targetId] = String(values.attachedId || '').split(':');
      const payload = { id: id || `note-${Date.now()}`, title: values.title.trim(), body: values.body.trim(), lifeAreaId: values.lifeAreaId || getAreaById(targetId)?.id || '', subjectId: values.subjectId || '', createdAt: id ? (getNoteById(id)?.createdAt || isoDate(0)) : isoDate(0), attachedTo: { type: kind === 'goal' ? 'goal' : 'area', id: targetId || state.lifeAreas[0]?.id } };
      if (id) {
        const index = state.notes.findIndex((note) => note.id === id);
        if (index >= 0) state.notes[index] = { ...state.notes[index], ...payload };
      } else {
        state.notes.push(payload);
      }
      break;
    }
    case 'event': {
      const payload = { id: id || `event-${Date.now()}`, title: values.title.trim(), lifeAreaId: values.lifeAreaId || state.lifeAreas[0]?.id || '', subjectId: values.subjectId || '', type: values.type || 'Milestone', date: values.date || isoDate(1) };
      if (id) {
        const index = state.events.findIndex((event) => event.id === id);
        if (index >= 0) state.events[index] = { ...state.events[index], ...payload };
      } else {
        state.events.push(payload);
      }
      break;
    }
    case 'resource': {
      const payload = { id: id || `resource-${Date.now()}`, name: values.name.trim(), url: values.url.trim(), description: values.description.trim(), lifeAreaId: values.lifeAreaId || state.lifeAreas[0]?.id || '' };
      if (id) {
        const index = state.resources.findIndex((resource) => resource.id === id);
        if (index >= 0) state.resources[index] = { ...state.resources[index], ...payload };
      } else {
        state.resources.push(payload);
      }
      break;
    }
  }

  persistState();
}

function bindDefaultActions() {
  document.querySelectorAll('[data-action="navigate"]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      state.currentView = view;
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="area-tab"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedAreaId = button.dataset.areaId;
      state.selectedAreaSection = button.dataset.section;
      state.currentView = 'area-workspace';
      renderAreaWorkspace(button.dataset.areaId, button.dataset.section);
    });
  });

  document.querySelectorAll('[data-action="open-area"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedAreaId = button.dataset.areaId;
      state.currentView = 'area-workspace';
      state.selectedAreaSection = state.selectedAreaSection || 'overview';
      renderAreaWorkspace(button.dataset.areaId, state.selectedAreaSection || 'overview');
    });
  });

  document.querySelectorAll('[data-action="open-result"]').forEach((button) => {
    button.addEventListener('click', () => {
      const entity = button.dataset.entity;
      const id = button.dataset.id;
      state.searchQuery = '';
      if (entity === 'area') {
        state.currentView = 'area-workspace';
        state.selectedAreaId = id;
        state.selectedAreaSection = 'overview';
        renderCurrentView();
      } else if (entity === 'subject') {
        state.currentView = 'subject-workspace';
        state.selectedSubjectId = id;
        renderSubjectWorkspace(id);
      } else if (entity === 'goal') {
        const goal = getGoalById(id);
        if (goal) renderModal('goal', goal);
      } else if (entity === 'project') {
        const project = getProjectById(id);
        if (project) renderModal('project', project);
      } else if (entity === 'task') {
        const task = getTaskById(id);
        if (task) renderModal('task', task);
      } else if (entity === 'study') {
        const item = state.study.find((entry) => entry.id === id);
        if (item) renderModal('study', item);
      } else if (entity === 'habit') {
        const habit = state.habits.find((entry) => entry.id === id);
        if (habit) renderModal('habit', habit);
      } else if (entity === 'note') {
        const note = state.notes.find((entry) => entry.id === id);
        if (note) renderModal('note', note);
      } else if (entity === 'event') {
        const event = state.events.find((entry) => entry.id === id);
        if (event) renderModal('event', event);
      } else if (entity === 'resource') {
        const resource = getResourceById(id);
        if (resource) renderModal('resource', resource);
      }
    });
  });

  document.querySelectorAll('[data-action="quick-add"]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.type;
      if (!type || type === 'menu') {
        renderQuickAddMenu();
        return;
      }
      const preset = { lifeAreaId: button.dataset.assignArea || state.lifeAreas[0]?.id || '', subjectId: button.dataset.assignSubject || '' };
      renderModal(type, preset);
    });
  });

  document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="account-sign-out"]').forEach((button) => {
    button.addEventListener('click', () => firebaseSignOut());
  });

  document.querySelectorAll('[data-action="reset-data"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!window.confirm('This permanently removes saved data for the active profile. Continue?')) return;
      localStorage.removeItem(getStorageKey());
      if (dataOwner === 'local') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('lifeos_v1');
      }
      if (typeof getLifeStorageKey === 'function') {
        localStorage.removeItem(getLifeStorageKey());
        if (dataOwner === 'local') localStorage.removeItem(LIFE_KEY);
      }
      state = normalizeState();
      if (typeof loadLifeState === 'function') loadLifeState(dataOwner);
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="close-modal"]').forEach((button) => button.addEventListener('click', () => {
    document.getElementById('modalBackdrop').hidden = true;
    document.getElementById('modalBackdrop').innerHTML = '';
  }));

  document.querySelectorAll('[data-action="archive-area"]').forEach((button) => {
    button.addEventListener('click', () => {
      const area = getAreaById(button.dataset.areaId);
      if (!area) return;
      area.archived = true;
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="restore-area"]').forEach((button) => {
    button.addEventListener('click', () => {
      const area = getAreaById(button.dataset.areaId);
      if (!area) return;
      area.archived = false;
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="delete-area"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.lifeAreas = state.lifeAreas.filter((area) => area.id !== button.dataset.areaId);
      const removedSubjectIds = new Set(state.subjects.filter((subject) => subject.lifeAreaId === button.dataset.areaId).map((subject) => subject.id));
      state.subjects = state.subjects.filter((subject) => subject.lifeAreaId !== button.dataset.areaId);
      state.goals = state.goals.filter((goal) => goal.lifeAreaId !== button.dataset.areaId);
      state.projects = state.projects.filter((project) => project.lifeAreaId !== button.dataset.areaId);
      state.tasks = state.tasks.filter((task) => task.lifeAreaId !== button.dataset.areaId);
      state.study = state.study.filter((item) => item.lifeAreaId !== button.dataset.areaId);
      state.habits = state.habits.filter((habit) => habit.lifeAreaId !== button.dataset.areaId);
      state.notes = state.notes.filter((note) => note.attachedTo?.id !== button.dataset.areaId || note.attachedTo?.type !== 'area');
      state.events = state.events.filter((event) => event.lifeAreaId !== button.dataset.areaId);
      state.resources = state.resources.filter((resource) => resource.lifeAreaId !== button.dataset.areaId);
      state.drafts = state.drafts.filter((draft) => draft.values.lifeAreaId !== button.dataset.areaId && !removedSubjectIds.has(draft.values.subjectId));
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="move-area-up"]').forEach((button) => {
    button.addEventListener('click', () => {
      const idx = state.lifeAreas.findIndex((area) => area.id === button.dataset.areaId);
      if (idx <= 0) return;
      [state.lifeAreas[idx - 1], state.lifeAreas[idx]] = [state.lifeAreas[idx], state.lifeAreas[idx - 1]];
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="move-area-down"]').forEach((button) => {
    button.addEventListener('click', () => {
      const idx = state.lifeAreas.findIndex((area) => area.id === button.dataset.areaId);
      if (idx === -1 || idx >= state.lifeAreas.length - 1) return;
      [state.lifeAreas[idx], state.lifeAreas[idx + 1]] = [state.lifeAreas[idx + 1], state.lifeAreas[idx]];
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="delete-goal"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.goals = state.goals.filter((goal) => goal.id !== button.dataset.goalId);
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="delete-project"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.projects = state.projects.filter((project) => project.id !== button.dataset.projectId);
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="delete-task"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.tasks = state.tasks.filter((task) => task.id !== button.dataset.taskId);
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="edit-area"]').forEach((button) => {
    button.addEventListener('click', () => {
      const area = getAreaById(button.dataset.areaId);
      renderModal('area', area);
    });
  });

  document.querySelectorAll('[data-action="open-subject"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSubjectId = button.dataset.subjectId;
      state.currentView = 'subject-workspace';
      renderSubjectWorkspace(button.dataset.subjectId);
    });
  });

  document.querySelectorAll('[data-action="edit-subject"]').forEach((button) => {
    button.addEventListener('click', () => renderModal('subject', getSubjectById(button.dataset.subjectId)));
  });

  document.querySelectorAll('[data-action="archive-subject"]').forEach((button) => {
    button.addEventListener('click', () => {
      const subject = getSubjectById(button.dataset.subjectId);
      if (!subject) return;
      subject.archived = true;
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="restore-subject"]').forEach((button) => {
    button.addEventListener('click', () => {
      const subject = getSubjectById(button.dataset.subjectId);
      if (!subject) return;
      subject.archived = false;
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="delete-subject"]').forEach((button) => {
    button.addEventListener('click', () => {
      const subjectId = button.dataset.subjectId;
      state.subjects = state.subjects.filter((subject) => subject.id !== subjectId);
      ['goals', 'projects', 'tasks', 'study', 'notes'].forEach((collection) => {
        state[collection].forEach((item) => { if (item.subjectId === subjectId) item.subjectId = ''; });
      });
      state.drafts.forEach((draft) => { if (draft.values.subjectId === subjectId) draft.values.subjectId = ''; });
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="resume-draft"]').forEach((button) => {
    button.addEventListener('click', () => {
      const draft = getDraftById(button.dataset.draftId);
      if (draft) renderModal(draft.type, {}, draft.id);
    });
  });

  document.querySelectorAll('[data-action="discard-draft"]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteDraft(button.dataset.draftId);
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="edit-goal"]').forEach((button) => {
    button.addEventListener('click', () => {
      const goal = getGoalById(button.dataset.goalId);
      renderModal('goal', goal);
    });
  });

  document.querySelectorAll('[data-action="edit-project"]').forEach((button) => {
    button.addEventListener('click', () => {
      const project = getProjectById(button.dataset.projectId);
      renderModal('project', project);
    });
  });

  document.querySelectorAll('[data-action="edit-task"]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = getTaskById(button.dataset.taskId);
      renderModal('task', task);
    });
  });

  document.querySelectorAll('[data-action="toggle-task"]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = getTaskById(button.dataset.taskId);
      if (!task) return;
      task.status = task.status === 'Done' ? 'To Do' : 'Done';
      persistState();
      renderCurrentView();
    });
  });

  const profileName = document.getElementById('profileName');
  if (profileName) {
    profileName.addEventListener('change', () => {
      state.settings.name = profileName.value.trim() || 'Your Life';
      persistState();
      renderCurrentView();
    });
  }

  const focusText = document.getElementById('focusText');
  if (focusText) {
    focusText.addEventListener('change', () => {
      state.settings.todayFocus = focusText.value.trim() || 'Protect your attention and finish the work that moves your life forward.';
      persistState();
      renderCurrentView();
    });
  }

  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.searchQuery = event.target.value;
      persistState();
      renderCurrentView();
    });
  }

  document.querySelectorAll('[data-action="onboarding-suggest-area"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.onboardingComplete = true;
      renderModal('area', { name: button.dataset.areaName, icon: button.dataset.areaIcon || '◎', color: button.dataset.areaColor || '#7c83ff', modules: [] });
    });
  });

  document.querySelectorAll('[data-action="onboarding-custom-area"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.onboardingComplete = true;
      renderModal('area', {});
    });
  });

  document.querySelectorAll('[data-action="skip-onboarding"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.onboardingComplete = true;
      state.currentView = 'dashboard';
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="edit-study"]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = state.study.find((entry) => entry.id === button.dataset.studyId);
      if (item) renderModal('study', item);
    });
  });

  document.querySelectorAll('[data-action="delete-study"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.study = state.study.filter((entry) => entry.id !== button.dataset.studyId);
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="edit-note"]').forEach((button) => {
    button.addEventListener('click', () => {
      const note = state.notes.find((entry) => entry.id === button.dataset.noteId);
      if (note) renderModal('note', note);
    });
  });

  document.querySelectorAll('[data-action="delete-note"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.notes = state.notes.filter((entry) => entry.id !== button.dataset.noteId);
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="edit-habit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const habit = state.habits.find((entry) => entry.id === button.dataset.habitId);
      if (habit) renderModal('habit', habit);
    });
  });

  document.querySelectorAll('[data-action="delete-habit"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.habits = state.habits.filter((entry) => entry.id !== button.dataset.habitId);
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="edit-event"]').forEach((button) => {
    button.addEventListener('click', () => {
      const event = state.events.find((entry) => entry.id === button.dataset.eventId);
      if (event) renderModal('event', event);
    });
  });

  document.querySelectorAll('[data-action="delete-event"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.events = state.events.filter((entry) => entry.id !== button.dataset.eventId);
      persistState();
      renderCurrentView();
    });
  });

  document.querySelectorAll('[data-action="edit-resource"]').forEach((button) => {
    button.addEventListener('click', () => renderModal('resource', getResourceById(button.dataset.resourceId)));
  });

  document.querySelectorAll('[data-action="delete-resource"]').forEach((button) => {
    button.addEventListener('click', () => {
      state.resources = state.resources.filter((resource) => resource.id !== button.dataset.resourceId);
      persistState();
      renderCurrentView();
    });
  });
}

async function initializeApp() {
  if (window.lifeOSAuthReady) await window.lifeOSAuthReady;
  if (!window.LIFEOS_AUTH_USER) return;
  window.activateLifeOSApp();
}

let appInteractionsInitialized = false;
window.activateLifeOSApp = function activateLifeOSApp() {
  const appShell = document.getElementById('appShell');
  const authGate = document.getElementById('authGate');
  if (appShell) appShell.hidden = false;
  if (authGate) authGate.hidden = true;
  syncTheme();
  renderSidebar();
  renderTopbar();
  renderCurrentView();

  if (appInteractionsInitialized) return;
  appInteractionsInitialized = true;

  document.getElementById('mainContent')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="toggle-habit-today"]');
    if (!button) return;
    const completed = toggleHabitCompletion(button.dataset.habitId);
    if (completed === null) return;
    updateHabitChecklistUI(button, completed);
  });

  document.getElementById('sidebarNav')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (button) {
      state.currentView = button.dataset.view;
      renderCurrentView();
      return;
    }
    const areaButton = event.target.closest('[data-action="open-area"]');
    if (areaButton) {
      state.selectedAreaId = areaButton.dataset.areaId;
      state.currentView = 'area-workspace';
      renderAreaWorkspace(areaButton.dataset.areaId, state.selectedAreaSection || 'overview');
    }
  });

  document.getElementById('modalBackdrop')?.addEventListener('click', (event) => {
    if (event.target === document.getElementById('modalBackdrop')) {
      document.getElementById('modalBackdrop').hidden = true;
      document.getElementById('modalBackdrop').innerHTML = '';
    }
  });
};

window.deactivateLifeOSApp = function deactivateLifeOSApp() {
  const appShell = document.getElementById('appShell');
  if (appShell) appShell.hidden = true;
};

document.addEventListener('DOMContentLoaded', initializeApp);
