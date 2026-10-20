'use strict';
const PORTAL_ORIGIN = 'https://impaul17.github.io';
const CODES = new Set(['AF8','AF9','AF10','AF11','AF12','AF13']);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Solo se aceptan transferencias desde el portal autorizado.
  if (!sender.tab || !sender.url?.startsWith(PORTAL_ORIGIN + '/portal-practicas/')) return;
  if (message?.type === 'PHONEGEST_PING') { sendResponse({ok:true}); return; }
  if (message?.type !== 'PHONEGEST_TRANSFER') return;

  try {
    const p = message.payload;
    if (!p || p.version !== 1 || !/^2026-(10|11|12)-\d{2}$/.test(p.date) ||
        p.modality !== 'Presencial' || p.start !== '09:00' || p.end !== '16:00' ||
        !Array.isArray(p.af) || p.af.length < 1 || p.af.length > 6 ||
        !p.af.every(a => CODES.has(a)) || typeof p.notes !== 'string' ||
        !p.notes.trim() || p.notes.length > 20000) {
      sendResponse({ok:false,error:'El registro no contiene todos los datos requeridos.'});
      return;
    }
    const payload = {
      version:1, date:p.date, modality:'Presencial', start:'09:00', end:'16:00',
      af:[...new Set(p.af)], notes:p.notes, receivedAt:Date.now()
    };
    // Almacenamiento efímero, nunca a GitHub ni a servidores de terceros.
    chrome.storage.session.set({phonegestPending:payload})
      .then(() => sendResponse({ok:true}))
      .catch(e => sendResponse({ok:false,error:String(e)}));
  } catch (e) { sendResponse({ok:false,error:String(e)}); }
  return true;
});
