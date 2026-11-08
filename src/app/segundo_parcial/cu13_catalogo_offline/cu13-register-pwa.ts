export async function registerDrapeMindPwa(): Promise<void> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    await navigator.serviceWorker.register(new URL('sw.js', document.baseURI), {
      scope: new URL('.', document.baseURI).pathname,
      updateViaCache: 'none',
    });
  } catch {
    /* Download/IndexedDB remains usable in the current tab; installation can retry next load. */
  }
}
