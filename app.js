'use strict';

const PERIOD_START = new Date(2026, 9, 5);
const PERIOD_END = new Date(2026, 11, 18);
const HOLIDAYS = {
  '2026-10-12': 'Festivo',
  '2026-11-02': 'Festivo',
  '2026-12-07': 'Festivo',
  '2026-12-08': 'Festivo'
};
const AF = [
  ['AF8', 'Contenido web'],
  ['AF9', 'Redes'],
  ['AF10', 'Scripts'],
  ['AF11', 'Sistemas'],
  ['AF12', 'Resolución'],
  ['AF13', 'Seguridad']
];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_CAP = MONTHS.map(x => x[0].toUpperCase() + x.slice(1));
const WEEK = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const STORAGE_KEY = 'phonegest_practices_2026';
const SETTINGS_KEY = 'phonegest_practices_settings_2026';

const $ = id => document.getElementById(id);
const app = document.querySelector('.app');
const calendarGrid = $('calendarGrid');
const dayDrawer = $('dayDrawer');
const contextMenu = $('contextMenu');
const themePopover = $('themePopover');
const settingsModal = $('settingsModal');

let currentMonth = 9;
let selectedDate = null;
let contextDate = null;
let tagsDraft = [];
let dirty = false;
let monthState = {9:true,10:true,11:true};
let records = {};
let settings = loadSettings();

function loadRecords(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function loadSettings(){
  try {
    return Object.assign({ studentName:'Pablo', theme:'cyan', sidebarCollapsed:false }, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
  } catch { return { studentName:'Pablo', theme:'cyan', sidebarCollapsed:false }; }
}
function persist(){ PortalAuth.saveRecords(records).catch(error=>{ console.error('Error al guardar:',error); showToast('Error al cifrar/guardar los registros. Exporta una copia.'); }); }
function persistSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function dateKey(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function parseDate(key){ const [y,m,d]=key.split('-').map(Number); return new Date(y,m-1,d); }
function isWeekend(d){ return d.getDay() === 0 || d.getDay() === 6; }
function inPeriod(d){ return d >= PERIOD_START && d <= PERIOD_END; }
function isWorkingDay(d){ return inPeriod(d) && !isWeekend(d) && !HOLIDAYS[dateKey(d)]; }
function getWorkingDays(){
  const out=[]; const d=new Date(PERIOD_START);
  while(d<=PERIOD_END){ if(isWorkingDay(d)) out.push(new Date(d)); d.setDate(d.getDate()+1); }
  return out;
}
const WORKING_DAYS = getWorkingDays();
function getStatus(key){
  const r=records[key];
  if(!r) return 'empty';
  const hasGit = !!(r.gitlab || '').trim();
  const hasIpasen = !!(r.ipasen || '').trim();
  const hasAf = Array.isArray(r.af) && r.af.length > 0;
  const hasTags = Array.isArray(r.labels) && r.labels.length > 0;
  if(hasIpasen && hasAf) return 'complete';
  if(hasGit || hasIpasen || hasAf || hasTags) return 'partial';
  return 'empty';
}
function statusLabel(status){ return ({empty:'Pendiente',partial:'En curso',complete:'Completado'})[status]; }
function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function linesFrom(text=''){
  return text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
}
function normalizeInputText(text=''){ return linesFrom(text).join('\n'); }
function formatGitlab(key, text){
  const d=parseDate(key); const lines=linesFrom(text);
  const title=`### ${d.getDate()} de ${MONTHS_CAP[d.getMonth()]}`;
  const name=(settings.studentName || 'Pablo').trim();
  const body=[name, ...lines.map(x=>`- ${x}`)].join('\n');
  return title + '\n\n```\n' + body + '\n```';
}
function formatIpasen(text){ return linesFrom(text).map(x=>`- ${x}`).join('\n'); }
function shortDay(d){ return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}.`; }
function fullDate(d){ return `${d.getDate()} de ${MONTHS[d.getMonth()]}`; }
function todayKey(){ return dateKey(new Date()); }
function findClosestWorkingKey(){
  const now=new Date();
  if(now<PERIOD_START) return dateKey(PERIOD_START);
  if(now>PERIOD_END) return dateKey(PERIOD_END);
  if(isWorkingDay(now)) return dateKey(now);
  let best=WORKING_DAYS[0], dist=Infinity;
  WORKING_DAYS.forEach(d=>{ const x=Math.abs(d-now); if(x<dist){dist=x;best=d;} });
  return dateKey(best);
}

function applySettings(){
  document.documentElement.dataset.theme=settings.theme || 'cyan';
  document.querySelectorAll('[data-theme-choice]').forEach(b=>b.classList.toggle('active', b.dataset.themeChoice===settings.theme));
  $('studentName').value=settings.studentName || 'Pablo';
  if(settings.sidebarCollapsed) app.classList.add('sidebar-collapsed'); else app.classList.remove('sidebar-collapsed');
}

function renderCalendar(){
  $('monthLabel').textContent=`${MONTHS_CAP[currentMonth]} 2026`;
  const first=new Date(2026,currentMonth,1); const last=new Date(2026,currentMonth+1,0);
  const offset=(first.getDay()+6)%7;
  const cells=[];
  for(let i=0;i<offset;i++) cells.push(null);
  for(let i=1;i<=last.getDate();i++) cells.push(new Date(2026,currentMonth,i));
  while(cells.length%7) cells.push(null);
  const today=todayKey();
  calendarGrid.innerHTML=cells.map(d=>{
    if(!d) return '<div class="day-cell outside"></div>';
    const key=dateKey(d), work=isWorkingDay(d), weekend=isWeekend(d), holiday=HOLIDAYS[key], r=records[key], status=work?getStatus(key):'empty';
    const classes=['day-cell', work?'workday':'', weekend?'weekend':'', key===today?'today':'', key===selectedDate?'selected':''].filter(Boolean).join(' ');
    let body='';
    if(holiday){ body=`<div class="cell-body"><div class="nonwork-note"><b>Festivo</b>No computa</div></div>`; }
    else if(!inPeriod(d)){ body=`<div class="cell-body"><div class="nonwork-note">Fuera del periodo</div></div>`; }
    else if(weekend){ body=`<div class="cell-body"><div class="nonwork-note">Fin de semana</div></div>`; }
    else if(r){
      const ip=linesFrom(r.ipasen||'')[0], git=linesFrom(r.gitlab||'')[0];
      body=`<div class="cell-body">${ip?`<div class="cell-line"><b>iP</b> ${escapeHtml(ip)}</div>`:''}${git?`<div class="cell-line"><b>GL</b> ${escapeHtml(git)}</div>`:''}<div class="cell-meta">${(r.af||[]).slice(0,3).map(a=>`<span class="mini-chip af">${a}</span>`).join('')}${(r.labels||[]).slice(0,1).map(t=>`<span class="mini-chip">#${escapeHtml(t)}</span>`).join('')}</div></div>`;
    } else { body='<div class="cell-body"><div class="cell-empty">Sin registro</div></div>'; }
    return `<div class="${classes}" ${work?`data-date="${key}"`:''}><div class="day-top"><span class="day-number">${d.getDate()}</span>${work?`<i class="cell-status ${status}"></i>`:''}</div>${body}</div>`;
  }).join('');
  calendarGrid.querySelectorAll('[data-date]').forEach(cell=>{
    cell.addEventListener('click',()=>openDay(cell.dataset.date));
    cell.addEventListener('contextmenu',e=>openContextMenu(e, cell.dataset.date));
  });
  $('prevMonth').disabled=currentMonth<=9;
  $('nextMonth').disabled=currentMonth>=11;
}

function renderDayTree(){
  const groups={9:[],10:[],11:[]};
  WORKING_DAYS.forEach(d=>groups[d.getMonth()].push(d));
  $('dayTree').innerHTML=[9,10,11].map(m=>`<div class="month-group ${monthState[m]?'':'closed'}" data-month-group="${m}">
    <button class="month-toggle" data-month-toggle="${m}"><b>${MONTHS_CAP[m]}</b><span>⌄</span></button>
    <div class="month-days">${groups[m].map(d=>{ const key=dateKey(d), status=getStatus(key); return `<button class="day-link ${selectedDate===key?'active':''}" data-sidebar-date="${key}"><i class="day-dot ${status}"></i><span class="date-copy">${WEEK[d.getDay()].slice(0,3)} · ${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}</span><small>${status==='complete'?'✓':''}</small></button>`; }).join('')}</div>
  </div>`).join('');
  document.querySelectorAll('[data-month-toggle]').forEach(btn=>btn.addEventListener('click',()=>{
    const m=Number(btn.dataset.monthToggle); monthState[m]=!monthState[m]; renderDayTree();
  }));
  document.querySelectorAll('[data-sidebar-date]').forEach(btn=>btn.addEventListener('click',()=>openDay(btn.dataset.sidebarDate)));
}

function renderRecords(){
  const q=$('searchInput').value.trim().toLowerCase(), filter=$('statusFilter').value;
  const days=WORKING_DAYS.slice().reverse().filter(d=>{
    const key=dateKey(d), status=getStatus(key), r=records[key]||{};
    const hay=[r.gitlab||'', r.ipasen||'', ...(r.af||[]), ...(r.labels||[])].join(' ').toLowerCase();
    return (filter==='all'||filter===status) && (!q || hay.includes(q) || key.includes(q) || fullDate(d).includes(q));
  });
  $('recordsList').innerHTML=days.length?days.map(d=>{
    const key=dateKey(d), status=getStatus(key), r=records[key]||{};
    const ip=linesFrom(r.ipasen||'')[0]||'Sin registro iPasen'; const git=linesFrom(r.gitlab||'')[0]||'Sin registro GitLab';
    return `<div class="record-row"><div class="record-date"><b>${fullDate(d)}</b><small>${WEEK[d.getDay()]} · 09–16h</small><span class="status-text ${status}"><i></i>${statusLabel(status)}</span></div><div class="record-content"><p><b>iPasen</b> · ${escapeHtml(ip)}</p><p><b>GitLab</b> · ${escapeHtml(git)}</p><div class="record-tags">${(r.af||[]).map(a=>`<span class="mini-chip af">${a}</span>`).join('')}${(r.labels||[]).slice(0,3).map(t=>`<span class="mini-chip">#${escapeHtml(t)}</span>`).join('')}</div></div><button class="row-edit" data-edit="${key}" title="Editar">↗</button></div>`;
  }).join(''):'<div class="empty-state">No hay resultados.</div>';
  document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openDay(b.dataset.edit)));
}

function renderStats(){
  const completed=WORKING_DAYS.filter(d=>getStatus(dateKey(d))==='complete').length;
  const gitCount=WORKING_DAYS.filter(d=>records[dateKey(d)]?.gitlab?.trim()).length;
  $('totalDaysStat').textContent=WORKING_DAYS.length;
  $('hoursStat').textContent=WORKING_DAYS.length*7;
  $('completedDaysStat').textContent=completed;
  $('gitlabStat').textContent=gitCount;
  $('progressCount').textContent=`${completed} / ${WORKING_DAYS.length}`;
  $('progressRing').style.setProperty('--p', `${Math.round(completed/WORKING_DAYS.length*100)}%`);
  const counts=AF.map(([code])=>WORKING_DAYS.filter(d=>(records[dateKey(d)]?.af||[]).includes(code)).length);
  const max=Math.max(1,...counts);
  $('afStats').innerHTML=AF.map(([code,text],i)=>`<div class="af-stat" title="${escapeHtml(text)}"><b>${code}</b><div class="af-track"><div class="af-fill" style="width:${counts[i]/max*100}%"></div></div><span>${counts[i]} días</span></div>`).join('');
}
function refreshAll(){ renderCalendar(); renderDayTree(); renderRecords(); renderStats(); }

function renderAfOptions(selected=[]){
  $('afOptions').innerHTML=AF.map(([code,text])=>`<label class="af-option ${selected.includes(code)?'checked':''}"><input type="checkbox" value="${code}" ${selected.includes(code)?'checked':''}><span class="af-check">${selected.includes(code)?'✓':''}</span><span class="af-copy"><b>${code}</b><span>${text}</span></span></label>`).join('');
  document.querySelectorAll('.af-option input').forEach(cb=>cb.addEventListener('change',()=>{
    cb.closest('.af-option').classList.toggle('checked',cb.checked);
    cb.closest('.af-option').querySelector('.af-check').textContent=cb.checked?'✓':'';
    setDirty();
  }));
}
function renderTags(){
  $('tagChips').innerHTML=tagsDraft.map((t,i)=>`<span class="tag-chip">#${escapeHtml(t)}<button data-remove-tag="${i}" aria-label="Quitar ${escapeHtml(t)}">×</button></span>`).join('');
  document.querySelectorAll('[data-remove-tag]').forEach(b=>b.addEventListener('click',()=>{ tagsDraft.splice(Number(b.dataset.removeTag),1); renderTags(); setDirty(); }));
}
function addTag(raw){
  raw.split(',').map(x=>x.trim().replace(/^#/,'')).filter(Boolean).forEach(t=>{ if(!tagsDraft.some(x=>x.toLowerCase()===t.toLowerCase())) tagsDraft.push(t); });
  renderTags(); setDirty();
}
function updatePreviews(){
  if(!selectedDate) return;
  $('gitlabPreview').textContent=formatGitlab(selectedDate,$('gitlabEntry').value);
  $('ipasenPreview').textContent=formatIpasen($('ipasenEntry').value) || '-';
}
function setDirty(value=true){ dirty=value; $('saveState').textContent=value?'Cambios sin guardar':'Guardado'; $('saveState').classList.toggle('dirty',value); updatePreviews(); }

function openDay(key){
  const d=parseDate(key); if(!isWorkingDay(d)) return;
  hideContextMenu(); closeTheme();
  selectedDate=key; const r=records[key]||{gitlab:'',ipasen:'',af:[],labels:[]};
  $('drawerWeekday').textContent=`${WEEK[d.getDay()].toUpperCase()} · 7 HORAS`;
  $('drawerDate').textContent=fullDate(d);
  $('gitlabEntry').value=r.gitlab||''; $('ipasenEntry').value=r.ipasen||'';
  tagsDraft=[...(r.labels||[])]; renderTags(); renderAfOptions(r.af||[]); updatePreviews();
  $('deleteDayBtn').style.visibility=records[key]?'visible':'hidden';
  setDirty(false); dayDrawer.classList.add('open'); dayDrawer.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden'; refreshAll();
}
function closeDay(){
  dayDrawer.classList.remove('open'); dayDrawer.setAttribute('aria-hidden','true'); document.body.style.overflow=''; selectedDate=null; dirty=false; refreshAll();
}
function saveDay(){
  if(!selectedDate) return;
  const af=[...document.querySelectorAll('#afOptions input:checked')].map(x=>x.value);
  const gitlab=normalizeInputText($('gitlabEntry').value), ipasen=normalizeInputText($('ipasenEntry').value);
  records[selectedDate]={gitlab,ipasen,af,labels:[...tagsDraft],updatedAt:new Date().toISOString(),hours:7,start:'09:00',end:'16:00'};
  persist(); $('gitlabEntry').value=gitlab; $('ipasenEntry').value=ipasen; setDirty(false); $('deleteDayBtn').style.visibility='visible'; refreshAll(); showToast(getStatus(selectedDate)==='complete'?'Día completado':'Guardado en progreso');
}
function deleteDay(){
  if(!selectedDate || !records[selectedDate]) return;
  if(!confirm(`¿Vaciar el registro del ${fullDate(parseDate(selectedDate))}?`)) return;
  delete records[selectedDate]; persist(); showToast('Registro eliminado'); closeDay();
}

async function writeClipboard(text, success='Copiado'){
  if(!text.trim()){ showToast('No hay contenido para copiar'); return; }
  try { await navigator.clipboard.writeText(text); showToast(success); }
  catch {
    const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast(success); } catch { showToast('No se pudo copiar'); }
    ta.remove();
  }
}
async function readClipboardInto(target){
  try {
    const text=await navigator.clipboard.readText();
    if(!text){ showToast('El portapapeles está vacío'); return; }
    const el=$(target==='gitlab'?'gitlabEntry':'ipasenEntry');
    const cleaned= target==='gitlab' ? cleanPastedGitlab(text) : normalizeInputText(text);
    el.value=[el.value.trim(),cleaned].filter(Boolean).join('\n'); setDirty(); showToast('Pegado');
  } catch { showToast('El navegador bloqueó el pegado. Usa Ctrl+V.'); }
}
function cleanPastedGitlab(text){
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  return lines.filter(x=>!x.startsWith('### ') && x!=='```' && x.toLowerCase()!==(settings.studentName||'Pablo').toLowerCase()).map(x=>x.replace(/^[-•*]\s*/,'')).join('\n');
}

function openContextMenu(e,key){
  e.preventDefault(); contextDate=key; contextMenu.classList.add('open'); contextMenu.setAttribute('aria-hidden','false');
  const rect=contextMenu.getBoundingClientRect();
  const x=Math.min(e.clientX, window.innerWidth-205), y=Math.min(e.clientY, window.innerHeight-210);
  contextMenu.style.left=`${Math.max(8,x)}px`; contextMenu.style.top=`${Math.max(8,y)}px`;
}
function hideContextMenu(){ contextMenu.classList.remove('open'); contextMenu.setAttribute('aria-hidden','true'); contextDate=null; }
function previousWorkingKey(key){
  const i=WORKING_DAYS.findIndex(d=>dateKey(d)===key); return i>0?dateKey(WORKING_DAYS[i-1]):null;
}
async function contextAction(action){
  const key=contextDate; if(!key) return;
  const r=records[key]||{};
  if(action==='open') openDay(key);
  if(action==='copy-gitlab') await writeClipboard(formatGitlab(key,r.gitlab||''),'GitLab copiado');
  if(action==='copy-ipasen') await writeClipboard(formatIpasen(r.ipasen||''),'iPasen copiado');
  if(action==='duplicate-prev'){
    const prev=previousWorkingKey(key); if(!prev || !records[prev]) showToast('El día anterior no tiene registro');
    else { records[key]=JSON.parse(JSON.stringify(records[prev])); records[key].updatedAt=new Date().toISOString(); persist(); refreshAll(); showToast('Contenido del día anterior copiado'); }
  }
  if(action==='clear'){
    if(records[key] && confirm(`¿Vaciar ${fullDate(parseDate(key))}?`)){ delete records[key]; persist(); refreshAll(); showToast('Día vaciado'); }
  }
  hideContextMenu();
}

function switchView(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view));
  document.querySelectorAll('.nav-button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const map={calendarView:['FORMACIÓN EN EMPRESA','Calendario'],recordsView:['HISTORIAL','Registros'],statsView:['PROGRESO','Resumen']};
  $('viewEyebrow').textContent=map[view][0]; $('viewTitle').textContent=map[view][1];
}
function gotoToday(){
  const key=findClosestWorkingKey(), d=parseDate(key); currentMonth=d.getMonth(); switchView('calendarView'); refreshAll();
  requestAnimationFrame(()=>{ const el=document.querySelector(`[data-date="${key}"]`); el?.scrollIntoView({behavior:'smooth',block:'center'}); });
}
function openTheme(){
  const rect=$('themeButton').getBoundingClientRect();
  themePopover.style.left=`${Math.min(window.innerWidth-205, rect.right+8)}px`;
  themePopover.style.top=`${Math.min(window.innerHeight-145, rect.top)}px`;
  themePopover.classList.toggle('open'); themePopover.setAttribute('aria-hidden',themePopover.classList.contains('open')?'false':'true');
}
function closeTheme(){ themePopover.classList.remove('open'); themePopover.setAttribute('aria-hidden','true'); }
function openSettings(){ closeTheme(); $('studentName').value=settings.studentName||'Pablo'; settingsModal.classList.add('open'); settingsModal.setAttribute('aria-hidden','false'); }
function closeSettings(){ settingsModal.classList.remove('open'); settingsModal.setAttribute('aria-hidden','true'); }
function exportJson(){
  const payload={app:'PhoneGest Portal de Prácticas',version:2,period:{start:'2026-10-05',end:'2026-12-18',schedule:'09:00-16:00',hoursPerDay:7,holidays:Object.keys(HOLIDAYS)},settings:{studentName:settings.studentName,theme:settings.theme},exportedAt:new Date().toISOString(),records};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='phonegest-practicas-2026.json'; a.click(); URL.revokeObjectURL(url); showToast('Copia exportada');
}
function importJson(file){
  const reader=new FileReader(); reader.onload=()=>{ try { const p=JSON.parse(reader.result), incoming=p.records||p; if(!incoming||typeof incoming!=='object') throw new Error(); records=incoming; if(p.settings?.studentName) settings.studentName=p.settings.studentName; if(p.settings?.theme) settings.theme=p.settings.theme; persist(); persistSettings(); applySettings(); refreshAll(); showToast('Datos importados'); } catch { showToast('JSON no válido'); } }; reader.readAsText(file);
}
let toastTimer; function showToast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1800); }

// Events
PortalAuth.start(restoredRecords => {
  records = restoredRecords;
  applySettings();
  refreshAll();
});
$('logoutBtn').addEventListener('click', () => PortalAuth.lock());
$('prevMonth').addEventListener('click',()=>{ if(currentMonth>9){currentMonth--;renderCalendar();} });
$('nextMonth').addEventListener('click',()=>{ if(currentMonth<11){currentMonth++;renderCalendar();} });
$('todayButton').addEventListener('click',gotoToday);
$('newDayButton').addEventListener('click',()=>openDay(findClosestWorkingKey()));
$('brandHome').addEventListener('click',()=>switchView('calendarView'));
$('sidebarToggle').addEventListener('click',()=>{ settings.sidebarCollapsed=!app.classList.contains('sidebar-collapsed'); persistSettings(); applySettings(); });
$('collapseMonthsBtn').addEventListener('click',()=>{ const anyOpen=Object.values(monthState).some(Boolean); monthState={9:!anyOpen,10:!anyOpen,11:!anyOpen}; $('collapseMonthsBtn').textContent=anyOpen?'+':'−'; renderDayTree(); });
document.querySelectorAll('.nav-button[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
document.querySelectorAll('[data-close-drawer]').forEach(b=>b.addEventListener('click',closeDay));
$('saveDayBtn').addEventListener('click',saveDay); $('deleteDayBtn').addEventListener('click',deleteDay);
['gitlabEntry','ipasenEntry'].forEach(id=>$(id).addEventListener('input',()=>setDirty()));
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{ const type=b.dataset.copy; if(!selectedDate)return; writeClipboard(type==='gitlab'?formatGitlab(selectedDate,$('gitlabEntry').value):formatIpasen($('ipasenEntry').value),type==='gitlab'?'GitLab copiado':'iPasen copiado'); }));
document.querySelectorAll('[data-paste]').forEach(b=>b.addEventListener('click',()=>readClipboardInto(b.dataset.paste)));
document.querySelectorAll('[data-toggle-preview]').forEach(b=>b.addEventListener('click',()=>b.closest('.format-preview').classList.toggle('open')));
$('tagInput').addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===','){ e.preventDefault(); if(e.target.value.trim()){ addTag(e.target.value); e.target.value=''; } } });
$('tagInput').addEventListener('blur',e=>{ if(e.target.value.trim()){ addTag(e.target.value); e.target.value=''; } });
$('searchInput').addEventListener('input',renderRecords); $('statusFilter').addEventListener('change',renderRecords);
$('themeButton').addEventListener('click',e=>{e.stopPropagation();openTheme();});
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{ settings.theme=b.dataset.themeChoice; persistSettings(); applySettings(); closeTheme(); }));
$('settingsButton').addEventListener('click',openSettings); document.querySelectorAll('[data-close-settings]').forEach(b=>b.addEventListener('click',closeSettings));
$('saveSettingsBtn').addEventListener('click',()=>{ settings.studentName=$('studentName').value.trim()||'Pablo'; persistSettings(); closeSettings(); if(selectedDate) updatePreviews(); showToast('Ajustes guardados'); });
$('exportBtn').addEventListener('click',exportJson); $('importInput').addEventListener('change',e=>{ const f=e.target.files[0]; if(f)importJson(f); e.target.value=''; });
document.querySelectorAll('[data-context-action]').forEach(b=>b.addEventListener('click',()=>contextAction(b.dataset.contextAction)));
document.addEventListener('click',e=>{ if(!contextMenu.contains(e.target)) hideContextMenu(); if(!themePopover.contains(e.target)&&!$('themeButton').contains(e.target)) closeTheme(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(dayDrawer.classList.contains('open')) closeDay(); else if(settingsModal.classList.contains('open')) closeSettings(); hideContextMenu(); closeTheme(); } if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&dayDrawer.classList.contains('open')){ e.preventDefault(); saveDay(); } });
window.addEventListener('resize',()=>{ hideContextMenu(); closeTheme(); });
