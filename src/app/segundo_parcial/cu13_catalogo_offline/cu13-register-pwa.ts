export async function registerDrapeMindPwa(): Promise<void> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    const reg = await navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {
      scope: new URL('.', document.baseURI).pathname,
      updateViaCache: 'none',
    });
    void reg.update();
  } catch {
    /* Download/IndexedDB remains usable in the current tab; installation can retry next load. */
  }
}
