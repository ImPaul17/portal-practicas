'use strict';
const $ = id=>document.getElementById(id);
let pending;

function status(message,kind='') {
  $('result').textContent=message;
  $('result').className=kind;
}
function dateEs(key) {
  const [y,m,d]=key.split('-');
  return d+'/'+m+'/'+y;
}
function openTab(url) { chrome.tabs.create({url}); }
$('openPortal').addEventListener('click',()=>openTab('https://impaul17.github.io/portal-practicas/'));
$('openSeneca').addEventListener('click',()=>openTab('https://seneca.juntadeandalucia.es/'));

async function initialize() {
  const saved=await chrome.storage.session.get('phonegestPending');
  pending=saved.phonegestPending;
  $('empty').hidden=!!pending;
  $('pending').hidden=!pending;
  if (!pending) return;
  $('date').textContent=dateEs(pending.date);
  $('af').textContent=pending.af.join(', ');
  $('hours').textContent=`Presencial · ${pending.start}–${pending.end}`;
  $('notes').textContent=pending.notes.slice(0,330)+(pending.notes.length>330?'…':'');
}
$('fill').addEventListener('click',async()=>{
  if (!pending) return;
  $('fill').disabled=true;
  status('Localizando formulario…');
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !/^https:\/\/seneca\.juntadeandalucia\.es\//i.test(tab.url||'')) {
      status('Abre Séneca en esta ventana, entra en el detalle de la actividad diaria y vuelve a pulsar el icono de la extensión.','error');
      return;
    }
    const results=await chrome.scripting.executeScript({
      target:{tabId:tab.id,allFrames:true},
      func:fillSeneca,
      args:[pending]
    });
    const found=results.map(r=>r.result).filter(Boolean).filter(r=>r.status!=='skip');
    if (!found.length) {
      status('No se encontró el formulario. Abre el detalle de actividad diaria del alumnado en Séneca.','error');
      return;
    }
    const result=found.find(r=>r.status==='ok')||found.find(r=>r.status==='partial')||found[0];
    if (result.status==='blocked') {status(result.reason,'error');return;}
    const success=(result.completed||[]).join('\n• ');
    const errors=(result.warnings||[]).join('\n• ');
    status((success?'Rellenado:\n• '+success+'\n\n':'')+
      (errors?'Revisar manualmente:\n• '+errors+'\n\n':'')+
      'Comprueba los datos en Séneca y pulsa Guardar allí.',result.status==='ok'?'ok':'error');
  } catch(e) {
    status('No se pudo acceder al formulario: '+(e.message||String(e)),'error');
  } finally {
    $('fill').disabled=false;
  }
});
initialize().catch(e=>status('Error al cargar el registro: '+e.message,'error'));
