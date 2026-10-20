'use strict';
const PHONEGEST_PORTAL_ORIGIN = 'https://impaul17.github.io';
if (location.origin === PHONEGEST_PORTAL_ORIGIN &&
    location.pathname.startsWith('/portal-practicas/')) {
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== PHONEGEST_PORTAL_ORIGIN) return;
    if (event.data?.source !== 'PhoneGestPortal' || event.data?.type !== 'SEND_SENECA') return;
    chrome.runtime.sendMessage({type:'PHONEGEST_TRANSFER',payload:event.data.payload}, response => {
      const error = chrome.runtime.lastError?.message;
      window.postMessage({
        source:'PhoneGestExtension',type:'SENECA_TRANSFER_RESULT',
        requestId:event.data.requestId,ok:!error && response?.ok === true,
        error:error || response?.error || 'No se pudo conectar con la extensión.'
      }, PHONEGEST_PORTAL_ORIGIN);
    });
  });
}
