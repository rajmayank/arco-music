const storageKey = 'arco-theme';
const preferences = new Set(['system', 'light', 'dark']);
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let preference = readPreference();
let initialized = false;

function readPreference() {
  try {
    const saved = localStorage.getItem(storageKey);
    return preferences.has(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function getTheme() {
  return preference;
}

export function resolvedTheme() {
  return preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
}

function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171513' : '#f7f4ee');
  window.dispatchEvent(new CustomEvent('arco-theme-change', {detail: {preference, theme}}));
  return theme;
}

export function setTheme(next) {
  if (!preferences.has(next)) return resolvedTheme();
  preference = next;
  try { localStorage.setItem(storageKey, preference); } catch { /* Keep the choice for this visit. */ }
  return applyTheme();
}

export function initTheme() {
  if (!initialized) {
    systemTheme.addEventListener('change', () => {
      if (preference === 'system') applyTheme();
    });
    window.addEventListener('storage', event => {
      if (event.key === storageKey || event.key === null) {
        preference = readPreference();
        applyTheme();
      }
    });
    initialized = true;
  }
  return applyTheme();
}
