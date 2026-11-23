// Uses the global config loaded by firebase-config.js and the compat SDK below.
const FIREBASE_CONFIG = window.LIFEOS_FIREBASE_CONFIG;
const REQUIRED_FIREBASE_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

let resolveLifeOSAuthReady;
window.lifeOSAuthReady = new Promise(resolve => { resolveLifeOSAuthReady = resolve; });
let lifeOSAuthReadyResolved = false;
let AUTH_MODE = 'login';

function finishLifeOSAuthReady() {
  if (lifeOSAuthReadyResolved) return;
  lifeOSAuthReadyResolved = true;
  resolveLifeOSAuthReady();
}

function renderAuthGate(view = 'login', message = '') {
  const gate = document.getElementById('authGate');
  if (!gate) return;
  if (view === 'loading') {
    gate.innerHTML = '<div class="auth-loading"><span class="brand-mark">◎</span><strong>LifeOS</strong><span>Loading your private workspace…</span></div>';
    return;
  }
  if (view === 'unconfigured' || view === 'error') {
    gate.innerHTML = `<section class="auth-panel auth-notice">
      <div class="brand"><span class="brand-mark">◎</span><div><div class="brand-name">LifeOS</div><span class="brand-sub">Private by design</span></div></div>
      <p class="eyebrow">Secure account access</p>
      <h1>${view === 'unconfigured' ? 'LifeOS is not connected yet.' : 'We could not connect securely.'}</h1>
      <p>${escapeHtml(message || (view === 'unconfigured' ? 'The hosted LifeOS deployment needs its Firebase project configuration before accounts can be created.' : 'Check your connection, then try again.'))}</p>
      ${view === 'error' ? '<button class="primary-btn" data-auth-retry>Try again</button>' : ''}
    </section>`;
    gate.querySelector('[data-auth-retry]')?.addEventListener('click', () => window.location.reload());
    return;
  }
  if (view === 'migration') {
    gate.innerHTML = `<section class="auth-panel migration-panel">
      <div class="brand"><span class="brand-mark">◎</span><div><div class="brand-name">LifeOS</div><span class="brand-sub">Private by design</span></div></div>
      <p class="eyebrow">Existing device data</p>
      <h1>Import your local workspace?</h1>
      <p>LifeOS found existing data on this device. Importing copies it into ${escapeHtml(SYNC.user?.email || 'your account')}; it will not be uploaded unless you choose to continue.</p>
      <div class="auth-error" role="alert" hidden></div>
      <div class="auth-actions"><button class="primary-btn" data-migration-import>Import to my account</button><button class="ghost-btn" data-migration-skip>Start with a clean workspace</button></div>
    </section>`;
    gate.querySelector('[data-migration-import]')?.addEventListener('click', () => finishLegacyMigration(true));
    gate.querySelector('[data-migration-skip]')?.addEventListener('click', () => finishLegacyMigration(false));
    return;
  }

  const mode = AUTH_MODE;
  const signingUp = mode === 'signup';
  const resetting = mode === 'reset';
  gate.innerHTML = `<section class="auth-panel">
    <div class="brand"><span class="brand-mark">◎</span><div><div class="brand-name">LifeOS</div><span class="brand-sub">Your personal operating system</span></div></div>
    <p class="eyebrow">Private workspace</p>
    <h1>${resetting ? 'Reset your password.' : signingUp ? 'Build a life that feels intentional.' : 'Welcome back.'}</h1>
    <p class="auth-intro">${resetting ? 'We will email you a secure password reset link.' : 'Your areas, plans, notes, and progress stay yours.'}</p>
    <div class="auth-error" role="alert" ${message ? '' : 'hidden'}>${escapeHtml(message)}</div>
    <form id="authForm" class="auth-form">
      ${signingUp ? '<label>Display name<input name="displayName" autocomplete="name" maxlength="80" required></label>' : ''}
      <label>Email address<input name="email" type="email" autocomplete="email" required></label>
      ${resetting ? '' : '<label>Password<input name="password" type="password" autocomplete="' + (signingUp ? 'new-password' : 'current-password') + '" minlength="6" required></label>'}
      <button class="primary-btn auth-submit" type="submit">${resetting ? 'Send reset link' : signingUp ? 'Create account' : 'Log in'}</button>
    </form>
    ${resetting ? '<button class="text-button" data-auth-mode="login">Back to login</button>' : `<button class="google-btn" data-auth-google type="button"><span class="google-g">G</span>Continue with Google</button>
      <div class="auth-switch">${signingUp ? 'Already have an account?' : 'New to LifeOS?'} <button class="text-button" data-auth-mode="${signingUp ? 'login' : 'signup'}">${signingUp ? 'Log in' : 'Create an account'}</button></div>
      ${signingUp ? '' : '<button class="text-button forgot-button" data-auth-mode="reset">Forgot password?</button>'}`}
    <p class="auth-privacy">Each account has its own private LifeOS. Data access is enforced by Firestore Security Rules.</p>
  </section>`;

  gate.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => {
    AUTH_MODE = button.dataset.authMode;
    renderAuthGate();
  }));
  gate.querySelector('[data-auth-google]')?.addEventListener('click', firebaseSignIn);
  gate.querySelector('#authForm')?.addEventListener('submit', handleAuthSubmit);
}

function authMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'An account already uses this email. Log in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'That email and password do not match.',
    'auth/user-not-found': 'No account was found for that email.',
    'auth/wrong-password': 'That email and password do not match.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
    'auth/network-request-failed': 'Network connection failed. Check your connection and try again.'
  };
  return messages[error?.code] || 'Authentication failed. Please try again.';
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const email = String(values.get('email') || '').trim();
  const password = String(values.get('password') || '');
  try {
    if (AUTH_MODE === 'reset') {
      await SYNC.auth.sendPasswordResetEmail(email);
      AUTH_MODE = 'login';
      renderAuthGate('login', 'Password reset email sent. Check your inbox.');
      return;
    }
    renderAuthGate('loading');
    if (AUTH_MODE === 'signup') {
      const credential = await SYNC.auth.createUserWithEmailAndPassword(email, password);
      const displayName = String(values.get('displayName') || '').trim();
      if (displayName) await credential.user.updateProfile({ displayName });
      await saveUserProfile(credential.user, { displayName });
    } else {
      await SYNC.auth.signInWithEmailAndPassword(email, password);
    }
  } catch (error) {
    renderAuthGate(AUTH_MODE, authMessage(error));
  }
}

async function finishLegacyMigration(importData) {
  if (importData) {
    try {
      window.importLifeOSLocalData();
      localStorage.setItem('lifeos:legacy-migration-claimed', SYNC.user.uid);
      await syncToFirebase();
    } catch (error) {
      const message = document.querySelector('.migration-panel .auth-error');
      if (message) { message.textContent = 'Import failed. Your local data is unchanged. Try again.'; message.hidden = false; }
      return;
    }
  }
  completeAuthenticatedStartup();
}

let migrationPending = false;
function completeAuthenticatedStartup() {
  migrationPending = false;
  renderAuthGate('loading');
  window.LIFEOS_AUTH_USER = SYNC.user;
  window.LIFEOS_PROFILE = SYNC.profile;
  window.activateLifeOSApp?.();
  finishLifeOSAuthReady();
}

/* ── SYNC STATE ─────────────────────────────────────────────*/
const SYNC = {
  enabled:     false,   // true once Firebase loads
  configured:  false,   // true if config has been replaced
  user:        null,    // Firebase user object
  db:          null,    // Firestore instance
  auth:        null,    // Auth instance
  online:      navigator.onLine,
  pendingSync: false,
  lastSync:    null,
  authRevision: 0
};

/* ── CHECK IF CONFIG HAS BEEN SET ──────────────────────────*/
function isFirebaseConfigured() {
  return REQUIRED_FIREBASE_CONFIG_KEYS.every(key => {
    const value = FIREBASE_CONFIG?.[key];
    return typeof value === 'string' && value.trim() && !value.includes('YOUR_');
  });
}

/* ── LOAD FIREBASE SDK DYNAMICALLY ─────────────────────────*/
function loadFirebaseSDK() {
  if (!isFirebaseConfigured()) {
    const configMissing = !FIREBASE_CONFIG;
    const missingKeys = REQUIRED_FIREBASE_CONFIG_KEYS.filter(key => !FIREBASE_CONFIG?.[key] || String(FIREBASE_CONFIG[key]).includes('YOUR_'));
    const message = configMissing
      ? 'firebase-config.js did not provide window.LIFEOS_FIREBASE_CONFIG.'
      : `Firebase configuration is incomplete or contains placeholders: ${missingKeys.join(', ')}.`;
    console.error('LifeOS Firebase configuration error:', message);
    renderAuthGate(configMissing ? 'unconfigured' : 'error', message);
    setLifeOSDataOwner('signed-out');
    finishLifeOSAuthReady();
    return;
  }

  // Inject Firebase scripts dynamically (avoids need for type="module")
  function injectScript(src, onload) {
    if (document.querySelector(`script[src="${src}"]`)) { onload && onload(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = onload;
    s.onerror = () => {
      console.error('LifeOS: Firebase compat SDK failed to load:', src);
      s.remove();
      renderAuthGate('error', 'Firebase services could not be loaded. Check your connection and deployment configuration.');
      finishLifeOSAuthReady();
    };
    document.head.appendChild(s);
  }

  // Use Firebase compat SDK (works with regular scripts, no import() needed)
  const FB_VER = '10.12.0';
  injectScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`, () => {
    injectScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth-compat.js`, () => {
      injectScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore-compat.js`, () => {
        initFirebaseApp();
      });
    });
  });
}

function initFirebaseApp() {
  try {
    if (typeof firebase === 'undefined') {
      console.error('LifeOS: Firebase compat SDK loaded no firebase global.');
      renderAuthGate('error', 'Firebase services could not be loaded.');
      finishLifeOSAuthReady();
      return;
    }

    // Initialize app (avoid double-init)
    const app = firebase.apps.length
      ? firebase.apps[0]
      : firebase.initializeApp(FIREBASE_CONFIG);

    SYNC.auth = firebase.auth(app);
    SYNC.db   = firebase.firestore(app);
    SYNC.enabled = true;

    // Auth state
    SYNC.auth.onAuthStateChanged(handleFirebaseUserChange, err => {
      console.warn('LifeOS: Auth state could not be loaded:', err.message);
      SYNC.user = null;
      window.LIFEOS_AUTH_USER = null;
      setLifeOSDataOwner('signed-out');
      window.deactivateLifeOSApp?.();
      renderAuthGate('error', 'Your session could not be verified. Reconnect and try again.');
      finishLifeOSAuthReady();
    });

    SYNC.configured = true;
    renderSyncUI('loaded');

  } catch (err) {
    console.error('LifeOS: Firebase initialization failed:', err);
    renderAuthGate('error', `Firebase initialization failed: ${err.message || 'unknown error'}`);
    finishLifeOSAuthReady();
  }
}

async function handleFirebaseUserChange(user) {
  const revision = ++SYNC.authRevision;
  SYNC.user = user;
  SYNC.pendingSync = false;
  SYNC.userHasRemoteData = false;
  clearTimeout(window._syncDebounce);

  if (!user) {
    AUTH_MODE = 'login';
    window.LIFEOS_AUTH_USER = null;
    window.LIFEOS_PROFILE = null;
    setLifeOSDataOwner('signed-out');
    window.deactivateLifeOSApp?.();
    renderAuthGate(AUTH_MODE);
    finishLifeOSAuthReady();
    return;
  }

  window.LIFEOS_AUTH_USER = user;
  setLifeOSDataOwner(user.uid);
  renderAuthGate('loading');
  console.info('LifeOS: Signed in as', user.displayName);
  const loaded = await pullFromFirebase(revision);
  if (revision !== SYNC.authRevision || SYNC.user?.uid !== user.uid) return;
  if (!loaded && navigator.onLine) {
    renderAuthGate('error', 'Your private cloud data could not be loaded. Check your connection and security-rules deployment, then sign in again.');
    return;
  }
  if (!loaded) SYNC.pendingSync = true;
  if (loaded && !SYNC.userHasRemoteData && !localStorage.getItem('lifeos:legacy-migration-claimed') && window.hasImportableLifeOSLocalData?.()) {
    migrationPending = true;
    renderAuthGate('migration');
    return;
  }
  if (loaded) await syncToFirebase();
  if (revision === SYNC.authRevision) completeAuthenticatedStartup();
}

async function saveUserProfile(user, overrides = {}) {
  if (!SYNC.db || !user) return;
  const profileRef = SYNC.db.collection('users').doc(user.uid).collection('data').doc('profile');
  const existing = SYNC.profile || {};
  const profile = {
    displayName: overrides.displayName || user.displayName || existing.displayName || '',
    email: user.email || existing.email || '',
    photoURL: user.photoURL || existing.photoURL || '',
    createdAt: existing.createdAt || user.metadata?.creationTime || new Date().toISOString(),
    preferences: { ...(existing.preferences || {}), theme: state?.settings?.theme || existing.preferences?.theme || 'dark' },
    updatedAt: Date.now()
  };
  await profileRef.set(profile, { merge: true });
  SYNC.profile = { ...existing, ...profile };
}

/* ── SIGN IN / SIGN OUT ────────────────────────────────────*/
async function firebaseSignIn() {
  if (!SYNC.enabled || !SYNC.auth || typeof firebase === 'undefined') return;
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    renderAuthGate('loading');
    await SYNC.auth.signInWithPopup(provider);
  } catch (err) {
    console.error('Sign in failed:', err.message);
    renderAuthGate(AUTH_MODE, authMessage(err));
  }
}

async function firebaseSignOut() {
  if (!SYNC.enabled || !SYNC.auth) return;
  try {
    window.deactivateLifeOSApp?.();
    renderAuthGate('loading');
    await SYNC.auth.signOut();
  } catch (err) {
    console.error('Sign out failed:', err);
    renderAuthGate('error', 'Sign out could not be completed. Check your connection and retry.');
  }
}

/* ── SYNC TO FIREBASE ──────────────────────────────────────*/
async function syncToFirebase() {
  if (!SYNC.enabled || !SYNC.user || !SYNC.db) {
    SYNC.pendingSync = true;
    return;
  }
  if (!navigator.onLine) {
    SYNC.pendingSync = true;
    return;
  }

  try {
    const uid = SYNC.user.uid;
    if (window.LIFEOS_DATA_OWNER !== uid) return;
    const timestamp = Date.now();

    // Collect all data to sync
    const payload = {
      timestamp,
      // From app.js STATE (roadmap progress)
      roadmap: {
        tasks:        typeof STATE !== 'undefined' ? STATE.tasks        : {},
        notes:        typeof STATE !== 'undefined' ? STATE.notes        : {},
        xp:           typeof STATE !== 'undefined' ? STATE.xp           : 0,
        level:        typeof STATE !== 'undefined' ? STATE.level        : 1,
        streak:       typeof STATE !== 'undefined' ? STATE.streak       : { count: 0, lastDate: '' },
        achievements: typeof STATE !== 'undefined' ? [...STATE.achievements] : [],
        phase:        typeof STATE !== 'undefined' ? STATE.phase        : 0,
        week:         typeof STATE !== 'undefined' ? STATE.week         : 0,
        day:          typeof STATE !== 'undefined' ? STATE.day          : 0,
        theme:        typeof STATE !== 'undefined' ? STATE.theme        : 'dark',
        pomodoro:     typeof STATE !== 'undefined' ? STATE.pomodoro     : {},
      },
      // From life-os.js LIFE_STATE
      worship:  typeof LIFE_STATE !== 'undefined' ? LIFE_STATE.worship  : {},
      work:     typeof LIFE_STATE !== 'undefined' ? LIFE_STATE.work     : {},
      content:  typeof LIFE_STATE !== 'undefined' ? LIFE_STATE.content  : {},
      tasks:    typeof LIFE_STATE !== 'undefined' ? LIFE_STATE.tasks    : [],
      schedule: typeof LIFE_STATE !== 'undefined' ? LIFE_STATE.schedule : {},
      // Dashboard state is local-first and includes Subjects and in-progress Drafts.
      dashboard: typeof state !== 'undefined' ? state : null,
    };
    const profilePayload = {
      ...(SYNC.profile || {}),
      displayName: SYNC.user.displayName || SYNC.profile?.displayName || '',
      email: SYNC.user.email || SYNC.profile?.email || '',
      photoURL: SYNC.user.photoURL || SYNC.profile?.photoURL || '',
      preferences: { ...(SYNC.profile?.preferences || {}), theme: state?.settings?.theme || 'dark' },
      updatedAt: timestamp
    };

    // Fitness is stored separately (can be large)
    const fitnessPayload = {
      timestamp,
      profile: typeof LIFE_STATE !== 'undefined' ? LIFE_STATE.fitness.profile : null,
      plan:    typeof LIFE_STATE !== 'undefined' ? LIFE_STATE.fitness.plan    : null,
      logs:    typeof LIFE_STATE !== 'undefined' ? LIFE_STATE.fitness.logs    : {},
    };

    await Promise.all([
      SYNC.db.collection('users').doc(uid).collection('data').doc('main').set(payload, { merge: true }),
      SYNC.db.collection('users').doc(uid).collection('data').doc('fitness').set(fitnessPayload, { merge: true }),
      SYNC.db.collection('users').doc(uid).collection('data').doc('profile').set(profilePayload, { merge: true }),
    ]);
    SYNC.profile = profilePayload;

    SYNC.lastSync    = new Date();
    SYNC.pendingSync = false;
    updateSyncIndicator('synced');

  } catch (err) {
    console.warn('LifeOS sync error:', err.message);
    updateSyncIndicator('error');
  }
}

/* ── SYNC FROM FIREBASE (pull on login) ────────────────────*/
async function pullFromFirebase(revision = SYNC.authRevision) {
  if (!SYNC.enabled || !SYNC.user || !SYNC.db) return false;

  try {
    const user = SYNC.auth?.currentUser;
    if (!user || user.uid !== SYNC.user.uid) {
      throw new Error('Firestore read stopped because the current Firebase Auth user does not match the active LifeOS user.');
    }
    const uid = user.uid;
    const isDevelopment = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    const readTargets = ['main', 'fitness', 'profile'].map(documentId => ({
      path: `users/${uid}/data/${documentId}`,
      read: () => SYNC.db.collection('users').doc(uid).collection('data').doc(documentId).get()
    }));
    if (isDevelopment) console.info('LifeOS Firestore read UID:', uid);
    const readResults = await Promise.allSettled(readTargets.map(target => target.read()));
    const failures = readResults.flatMap((result, index) => result.status === 'rejected' ? [{
      path: isDevelopment ? readTargets[index].path : `users/{uid}/data/${readTargets[index].path.split('/').pop()}`,
      code: result.reason?.code || 'unknown',
      message: result.reason?.message || String(result.reason)
    }] : []);
    if (failures.length) {
      console.error('LifeOS Firestore read failure:', {
        uid: isDevelopment ? uid : undefined,
        failures
      });
      throw readResults.find(result => result.status === 'rejected').reason;
    }
    const [mainSnap, fitnessSnap, profileSnap] = readResults.map(result => result.value);
    if (revision !== SYNC.authRevision || SYNC.user?.uid !== uid) return false;
    SYNC.userHasRemoteData = mainSnap.exists || fitnessSnap.exists;
    SYNC.profile = profileSnap.exists ? profileSnap.data() : null;
    if (!SYNC.profile) await saveUserProfile(SYNC.user);

    if (mainSnap.exists) {
      const remote = mainSnap.data();

      if (remote.dashboard && typeof state !== 'undefined') {
        const localUpdatedAt = Number(state.updatedAt || 0);
        const remoteUpdatedAt = Number(remote.dashboard.updatedAt || 0);
        if (remoteUpdatedAt >= localUpdatedAt) {
          replaceLifeOSDashboardState(remote.dashboard);
        }
      }

      // Merge roadmap state (take newer timestamp)
      if (remote.roadmap && typeof STATE !== 'undefined') {
        const localTs  = parseInt(localStorage.getItem(`autoos_lastSync:${uid}`) || '0');
        const remoteTs = remote.timestamp || 0;
        if (remoteTs > localTs) {
          // Remote is newer — merge in
          Object.assign(STATE.tasks,        remote.roadmap.tasks || {});
          Object.assign(STATE.notes,        remote.roadmap.notes || {});
          STATE.xp           = Math.max(STATE.xp, remote.roadmap.xp || 0);
          STATE.level        = Math.max(STATE.level, remote.roadmap.level || 1);
          STATE.streak       = remote.roadmap.streak || STATE.streak;
          STATE.achievements = new Set([...STATE.achievements, ...(remote.roadmap.achievements || [])]);
          if (typeof saveState === 'function') saveState();
        }
      }

      // Merge life-os state
      if (remote.worship  && typeof LIFE_STATE !== 'undefined') {
        Object.assign(LIFE_STATE.worship,  remote.worship  || {});
        Object.assign(LIFE_STATE.work,     remote.work     || {});
        Object.assign(LIFE_STATE.content,  remote.content  || {});
        if (Array.isArray(remote.tasks)) {
          // Merge tasks by ID
          const existingIds = new Set(LIFE_STATE.tasks.map(t => t.id));
          remote.tasks.forEach(t => { if (!existingIds.has(t.id)) LIFE_STATE.tasks.push(t); });
        }
        if (typeof saveLifeState === 'function') saveLifeState();
      }
    }

    if (fitnessSnap.exists) {
      const fit = fitnessSnap.data();
      if (fit && typeof LIFE_STATE !== 'undefined') {
        if (!LIFE_STATE.fitness.profile && fit.profile) LIFE_STATE.fitness.profile = fit.profile;
        if (!LIFE_STATE.fitness.plan    && fit.plan)    LIFE_STATE.fitness.plan    = fit.plan;
        if (fit.logs) Object.assign(LIFE_STATE.fitness.logs, fit.logs);
        if (typeof saveLifeState === 'function') saveLifeState();
      }
    }

    localStorage.setItem(`autoos_lastSync:${SYNC.user.uid}`, Date.now().toString());
    updateSyncIndicator('synced');

    // Re-render current view with fresh data
    const view = typeof STATE !== 'undefined' ? STATE.view : 'home';
    if (typeof renderLifeView === 'function' && typeof LIFE_VIEWS !== 'undefined' && LIFE_VIEWS.includes(view)) {
      renderLifeView(view);
    } else if (typeof renderAll === 'function') {
      renderAll();
    }
    return true;

  } catch (err) {
    console.warn('LifeOS pull error:', err.message);
    return false;
  }
}

/* ── REALTIME LISTENER ──────────────────────────────────────*/
function startRealtimeSync() {
  if (!SYNC.enabled || !SYNC.user || !SYNC.db) return;
  // Pull once on sign-in, then periodic sync on changes
  pullFromFirebase();
}

/* ── ONLINE / OFFLINE HANDLERS ─────────────────────────────*/
window.addEventListener('online', () => {
  SYNC.online = true;
  updateSyncIndicator('online');
  if (SYNC.user) reconnectCloudSync();
});

async function reconnectCloudSync() {
  const revision = SYNC.authRevision;
  const loaded = await pullFromFirebase(revision);
  if (loaded && revision === SYNC.authRevision) await syncToFirebase();
}

window.addEventListener('offline', () => {
  SYNC.online = false;
  updateSyncIndicator('offline');
});

/* ── SYNC UI ────────────────────────────────────────────────*/
function renderSyncUI(state) {
  // Inject sync indicator into settings view when it's open
  // Also update a persistent status dot in topbar if it exists
  const settingsSyncEl = document.getElementById('syncStatusArea');
  if (settingsSyncEl) {
    settingsSyncEl.innerHTML = buildSyncStatusHTML(state);
    bindSyncButtons();
  }
}

function buildSyncStatusHTML(state) {
  if (!isFirebaseConfigured()) {
    return `<div class="sync-status-box">
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.7;margin-bottom:12px">
        🔒 <strong>Local mode only.</strong> Your data is saved on this device.<br>
        To enable cloud sync across devices, configure Firebase in <code>firebase-sync.js</code>.
      </div>
      <a href="https://console.firebase.google.com" target="_blank" rel="noopener"
         style="display:inline-block;padding:8px 16px;background:var(--accent);color:white;border-radius:8px;font-size:12px;font-weight:600">
        Open Firebase Console ↗
      </a>
    </div>`;
  }

  if (state === 'signed-out' || state === 'loaded') {
    return `<div class="sync-status-box">
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
        Sign in with Google to sync your data across all devices.
      </div>
      <button id="firebaseSignInBtn" style="display:flex;align-items:center;gap:8px;padding:10px 20px;background:white;color:#333;border:1px solid #ddd;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
        Sign in with Google
      </button>
    </div>`;
  }

  if (state === 'online' && SYNC.user) {
    return `<div class="sync-status-box">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div class="sync-dot online"></div>
        <span style="font-size:13px;color:var(--text-secondary)">
          Signed in as <strong>${escapeHtml(SYNC.user.displayName || SYNC.user.email || 'your account')}</strong>
        </span>
      </div>
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">
        Last sync: ${SYNC.lastSync ? SYNC.lastSync.toLocaleTimeString() : 'Syncing…'}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="firebaseSyncNowBtn" style="padding:8px 16px;background:var(--accent);color:white;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">
          Sync Now
        </button>
        <button id="firebaseSignOutBtn" style="padding:8px 16px;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary);border-radius:8px;font-size:12px;cursor:pointer">
          Sign Out
        </button>
      </div>
    </div>`;
  }

  if (state === 'error') {
    return `<div class="sync-status-box">
      <div style="font-size:13px;color:var(--fitness-text)">
        ⚠️ Firebase failed to load. Check your config in firebase-sync.js.
      </div>
    </div>`;
  }

  return `<div class="sync-status-box">
    <div class="sync-indicator">
      <div class="sync-dot syncing"></div>
      <span>Connecting…</span>
    </div>
  </div>`;
}

function bindSyncButtons() {
  document.getElementById('firebaseSignInBtn')?.addEventListener('click', firebaseSignIn);
  document.getElementById('firebaseSignOutBtn')?.addEventListener('click', firebaseSignOut);
  document.getElementById('firebaseSyncNowBtn')?.addEventListener('click', () => {
    updateSyncIndicator('syncing');
    syncToFirebase();
  });
}

window.hasImportableLifeOSLocalData = function hasImportableLifeOSLocalData() {
  const dashboard = typeof loadState === 'function' ? loadState('local') : {};
  if (['lifeAreas', 'subjects', 'goals', 'projects', 'tasks', 'study', 'habits', 'notes', 'events', 'resources', 'drafts'].some(key => dashboard[key]?.length)) return true;
  if (dashboard.onboardingComplete || (dashboard.settings?.name && dashboard.settings.name !== 'Your Life')) return true;
  const keys = ['lifeos_v1:v2:local', 'lifeos_v1'];
  for (const key of keys) {
    try {
      const legacy = JSON.parse(localStorage.getItem(key) || 'null');
      if (!legacy) continue;
      if (legacy.tasks?.length || legacy.work?.shifts?.length || legacy.work?.activeShift || legacy.content?.videoIdeas?.length || legacy.fitness?.profile || legacy.fitness?.plan || Object.keys(legacy.worship?.prayers || {}).length || Object.keys(legacy.fitness?.logs?.water || {}).length) return true;
    } catch (error) {
      console.warn('LifeOS legacy data check failed.', error);
    }
  }
  return false;
};

window.importLifeOSLocalData = function importLifeOSLocalData() {
  if (typeof loadState === 'function') window.replaceLifeOSDashboardState(loadState('local'));
  if (typeof loadLifeState === 'function') {
    loadLifeState('local');
    saveLifeState({ sync: false });
  }
  if (typeof persistState === 'function') persistState({ sync: false });
};

function updateSyncIndicator(state) {
  const settingsSyncEl = document.getElementById('syncStatusArea');
  if (settingsSyncEl) {
    if (state === 'synced') {
      SYNC.lastSync = new Date();
      renderSyncUI(SYNC.user ? 'online' : 'signed-out');
    } else if (state === 'syncing') {
      const dot = settingsSyncEl.querySelector('.sync-dot');
      if (dot) { dot.className = 'sync-dot syncing'; }
    }
  }
}

/* ── EXPOSE PUBLIC API ──────────────────────────────────────*/
// Called by life-os.js and app.js saveState to trigger background sync
function triggerFirebaseSync() {
  if (!SYNC.enabled || !SYNC.user) return;
  // Debounce — don't sync on every keystroke
  clearTimeout(window._syncDebounce);
  window._syncDebounce = setTimeout(() => syncToFirebase(), 2000);
}

/* ── PATCH SETTINGS VIEW to include sync panel ─────────────*/
// We hook into the settings render lifecycle
const _origRenderSettings = typeof renderSettingsView === 'function' ? renderSettingsView : null;

function patchSettingsWithSync() {
  // Called after settings view renders to inject sync panel
  setTimeout(() => {
    const main = document.getElementById('mainContent');
    if (!main?.querySelector('.view-settings')) return;

    // Inject sync section before the danger zone
    const dangerSection = main.querySelector('.settings-section:last-child');
    if (dangerSection) {
      const syncSection = document.createElement('div');
      syncSection.className = 'settings-section';
      syncSection.innerHTML = `
        <div class="settings-section-title">☁️ Cloud Sync</div>
        <div id="syncStatusArea">${buildSyncStatusHTML(SYNC.user ? 'online' : (isFirebaseConfigured() ? 'loaded' : 'unconfigured'))}</div>
      `;
      dangerSection.parentNode.insertBefore(syncSection, dangerSection);
      bindSyncButtons();
    }
  }, 50);
}

/* ── INIT ──────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  loadFirebaseSDK();

  // Watch for settings view to inject sync panel
  const mainContent = document.getElementById('mainContent');
  if (mainContent) {
    const observer = new MutationObserver(() => {
      if (mainContent.querySelector('.view-settings')) {
        patchSettingsWithSync();
      }
    });
    observer.observe(mainContent, { childList: true });
  }
});
