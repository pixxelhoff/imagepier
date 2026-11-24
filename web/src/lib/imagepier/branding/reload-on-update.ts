// After an update the files of the previous version are gone: a page that was opened before cannot load the parts of
// the next page, and the navigation stops with an error. Reloads the page once to get the new version.
const RELOAD_KEY = 'imagepier-reloaded-at';
const MIN_INTERVAL_MS = 60_000;

const reloadOnce = () => {
  try {
    const last = Number(globalThis.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < MIN_INTERVAL_MS) {
      return false;
    }
    globalThis.sessionStorage.setItem(RELOAD_KEY, `${Date.now()}`);
  } catch {
    // Without storage the page is reloaded anyway.
  }
  globalThis.location.reload();
  return true;
};

if (typeof document !== 'undefined') {
  globalThis.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) {
      event.preventDefault();
    }
  });
}
