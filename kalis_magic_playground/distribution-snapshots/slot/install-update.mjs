export async function setupUpdates(button) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const workers = navigator.serviceWorker;
    const registration = await workers.register('./sw.js');
    const showWaiting = () => { button.hidden = !registration.waiting; };
    function watchInstall() {
      registration.installing?.addEventListener('statechange', showWaiting);
      showWaiting();
    }
    registration.addEventListener('updatefound', watchInstall);
    watchInstall();
    const dialog = button.closest('dialog');
    let accepted = null;
    dialog.addEventListener('close', () => { accepted = null; });
    button.onclick = () => {
      const worker = registration.waiting;
      if (!dialog.open || !worker) return;
      accepted = worker;
      try { worker.postMessage({ type: 'SKIP_WAITING' }); }
      catch { accepted = null; }
    };
    workers.addEventListener('controllerchange', () => {
      if (!accepted || accepted !== workers.controller) return;
      accepted = null;
      if (dialog.open) location.reload();
    });
  } catch { /* The online app also works without installation. */ }
}
