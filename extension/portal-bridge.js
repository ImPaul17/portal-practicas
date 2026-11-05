'use strict';
const PHONEGEST_PORTAL_ORIGIN = 'https://impaul17.github.io';
if (location.origin === PHONEGEST_PORTAL_ORIGIN &&
    (location.pathname === '/portal-practicas' || location.pathname.startsWith('/portal-practicas/'))) {
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== PHONEGEST_PORTAL_ORIGIN) return;
    if (event.data?.source !== 'PhoneGestPortal') return;
    const isPing = event.data.type === 'PHONEGEST_PING';
    if (!isPing && event.data.type !== 'SEND_SENECA') return;
    const replyType = isPing ? 'PHONEGEST_PONG' : 'SENECA_TRANSFER_RESULT';
    const reply = (ok, error) => window.postMessage({
      source:'PhoneGestExtension', type:replyType, requestId:event.data.requestId,
      ok, ...(error ? {error} : {})
    }, PHONEGEST_PORTAL_ORIGIN);
    try {
      chrome.runtime.sendMessage({type:isPing ? 'PHONEGEST_PING' : 'PHONEGEST_TRANSFER',payload:event.data.payload}, response => {
        const error = chrome.runtime.lastError?.message;
        const ok = !error && response?.ok === true;
        reply(ok, ok ? undefined : error || response?.error || 'No se pudo conectar con la extensión.');
      });
    } catch (error) {
      reply(false, 'Recarga el portal tras actualizar la extensión.');
    }
  });
}
