const { useEffect, useMemo, useState } = React;

const PERIOD_START = new Date(2026, 9, 5);
const PERIOD_END = new Date(2026, 11, 18);
const HOLIDAYS = {
  '2026-10-12': 'Festivo',
  '2026-11-02': 'Festivo',
  '2026-12-07': 'Festivo',
  '2026-12-08': 'Festivo',
};
const AF = [
  ['AF8', 'Contenido web'],
  ['AF9', 'Redes'],
  ['AF10', 'Scripts'],
  ['AF11', 'Sistemas'],
  ['AF12', 'Resolución'],
  ['AF13', 'Seguridad'],
];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const STORAGE_KEY = 'phonegest_practicas_react_v1';
const OLD_STORAGE_KEY = 'phonegest_practices_2026';
const VAULT_KEY = 'phonegest_practices_vault_2026';
const SETTINGS_KEY = 'phonegest_practices_settings_2026';
const VAULT_ITERATIONS = 350000;
let vaultWrites = Promise.resolve();

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function isWorkingDay(date) {
  const day = date.getDay();
  return date >= PERIOD_START && date <= PERIOD_END && day !== 0 && day !== 6 && !HOLIDAYS[dateKey(date)];
}
function getWorkingDays() {
  const days = [];
  const cursor = new Date(PERIOD_START);
  while (cursor <= PERIOD_END) {
    if (isWorkingDay(cursor)) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
const WORKING_DAYS = getWorkingDays();

function formatDate(key, options = {}) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', ...options }).format(parseDate(key));
}
function formatShortDate(key) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(parseDate(key)).replace('.', '');
}
function duration(start, end) {
  if (!start || !end) return '7 h';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const value = (eh * 60 + em) - (sh * 60 + sm);
  if (value <= 0) return '-';
  return `${Math.floor(value / 60)} h${value % 60 ? ` ${value % 60} min` : ''}`;
}
function lines(text = '') {
  return text.split(/\r?\n/).map((line) => line.trim().replace(/^(?:-|\u2022|\*)\s*/, '')).filter(Boolean);
}
function defaultRecord(settings) {
  return { gitlab: '', notes: '', af: [], tags: [], start: settings.defaultStart, end: settings.defaultEnd, closed: false };
}
function statusOf(record) {
  if (!record) return 'empty';
  if (record.closed) return 'closed';
  const hasContent = Boolean((record.gitlab || '').trim() || (record.notes || '').trim() || record.af?.length || record.tags?.length);
  return hasContent ? 'progress' : 'draft';
}
function statusLabel(status) {
  return { empty: 'Sin abrir', draft: 'Borrador', progress: 'En curso', closed: 'Cerrado' }[status] || 'Sin abrir';
}

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function readVault() {
  const vault = readJson(VAULT_KEY);
  if (!vault || vault.version !== 1 || !vault.username || !vault.salt || !vault.iv || !vault.encrypted) return null;
  return vault;
}
function normalizeRecords(source = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).map(([key, value = {}]) => [key, {
    gitlab: value.gitlab || '',
    notes: value.notes || value.ipasen || '',
    af: Array.isArray(value.af) ? value.af : [],
    tags: Array.isArray(value.tags) ? value.tags : (Array.isArray(value.labels) ? value.labels : []),
    start: value.start || '09:00',
    end: value.end || '16:00',
    closed: Boolean(value.closed),
    createdAt: value.createdAt || value.updatedAt || undefined,
  }]));
}
function loadSettings() {
  const saved = readJson(SETTINGS_KEY) || {};
  const current = readJson(STORAGE_KEY)?.settings || {};
  return { studentName: 'Pablo', defaultStart: '09:00', defaultEnd: '16:00', ...saved, ...current };
}
function bytesFromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
function base64FromBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return btoa(binary);
}
async function deriveVaultKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: VAULT_ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function decryptVault(vault, pin) {
  const key = await deriveVaultKey(pin, bytesFromBase64(vault.salt));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytesFromBase64(vault.iv) }, key, bytesFromBase64(vault.encrypted));
  const payload = JSON.parse(new TextDecoder().decode(decrypted));
  if (payload.format !== 'PhoneGestVault1') throw new Error('Formato de registros no válido.');
  return { key, records: normalizeRecords(payload.records) };
}
function persistVault(vault, key, records) {
  const snapshot = JSON.stringify({ format: 'PhoneGestVault1', records });
  vaultWrites = vaultWrites.catch(() => {}).then(async () => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(snapshot));
    localStorage.setItem(VAULT_KEY, JSON.stringify({ ...vault, iv: base64FromBytes(iv), encrypted: base64FromBytes(encrypted) }));
  });
  return vaultWrites;
}
function loadInitial() {
  const fallback = { records: {}, settings: { studentName: 'Pablo', defaultStart: '09:00', defaultEnd: '16:00' } };
  const vault = readVault();
  const settings = loadSettings();
  if (vault) return { records: {}, settings, vault, requiresAuth: true };
  try {
    const saved = readJson(STORAGE_KEY);
    if (saved?.records) return { ...fallback, ...saved, records: normalizeRecords(saved.records), settings: { ...fallback.settings, ...settings, ...(saved.settings || {}) } };
    const old = readJson(OLD_STORAGE_KEY);
    if (old && typeof old === 'object') {
      return { ...fallback, records: normalizeRecords(old), settings: { ...fallback.settings, ...settings } };
    }
  } catch (error) { console.warn('No se pudo restaurar el estado local', error); }
  return { ...fallback, settings };
}

function Icon({ name, size = 18, stroke = 1.8 }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M7 2.5v4M17 2.5v4M3 9h18" /><path d="M7 13h.01M12 13h.01M17 13h.01M7 17h.01M12 17h.01" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 5-7" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    tag: <><path d="M20 13 13 20 4 11V4h7z" /><path d="M8 8h.01" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    unlock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 7-2" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05-1.42 1.42-.05-.05A1.7 1.7 0 0 0 16.4 18a1.7 1.7 0 0 0-1 .99 1.7 1.7 0 0 0-.16.72v.08h-2v-.08A1.7 1.7 0 0 0 12 18a1.7 1.7 0 0 0-1-.99 1.7 1.7 0 0 0-1.88.34l-.05.05-1.42-1.42.05-.05A1.7 1.7 0 0 0 8 14.4a1.7 1.7 0 0 0-.99-1 1.7 1.7 0 0 0-.72-.16h-.08v-2h.08A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.34-1.88l-.05-.05 1.42-1.42.05.05A1.7 1.7 0 0 0 10.6 7a1.7 1.7 0 0 0 1-.99 1.7 1.7 0 0 0 .16-.72v-.08h2v.08A1.7 1.7 0 0 0 14 6a1.7 1.7 0 0 0 1 .99 1.7 1.7 0 0 0 1.88-.34l.05-.05 1.42 1.42-.05.05A1.7 1.7 0 0 0 18 9.6a1.7 1.7 0 0 0 .99 1 1.7 1.7 0 0 0 .72.16h.08v2h-.08A1.7 1.7 0 0 0 18 14a1.7 1.7 0 0 0 1.4 1z" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 20h16" /></>,
    upload: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5M4 20h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.home}</svg>;
}

function Badge({ status }) { return <span className={`status-badge ${status}`}><i />{statusLabel(status)}</span>; }

function Sidebar({ route, go, records, onOpenDay, settings }) {
  const createdDays = Object.keys(records).filter((key) => isWorkingDay(parseDate(key))).sort().reverse();
  const closed = createdDays.filter((key) => records[key].closed).length;
  return <aside className="sidebar"><div className="brand"><div className="brand-mark">P<span>•</span></div><div><strong>PhoneGest</strong><small>prácticas 2026</small></div></div><div className="profile-card"><div className="avatar">{(settings.studentName || 'P').slice(0, 1).toUpperCase()}</div><div><strong>{settings.studentName || 'Pablo'}</strong><small>En formación</small></div><span className="live-dot" /></div><nav className="side-nav" aria-label="Navegación principal"><p className="nav-caption">ESPACIO DE TRABAJO</p><button className={`nav-item ${route === 'home' ? 'active' : ''}`} onClick={() => go('home')}><Icon name="home" /><span>Inicio</span></button><button className={`nav-item ${route === 'calendar' ? 'active' : ''}`} onClick={() => go('calendar')}><Icon name="calendar" /><span>Calendario</span><em>{WORKING_DAYS.length}</em></button><button className={`nav-item ${route === 'records' ? 'active' : ''}`} onClick={() => go('records')}><Icon name="book" /><span>Registros</span><em>{createdDays.length}</em></button><button className={`nav-item ${route === 'summary' ? 'active' : ''}`} onClick={() => go('summary')}><Icon name="chart" /><span>Resumen</span></button><p className="nav-caption created-caption">DÍAS ABIERTOS <span>{createdDays.length}</span></p><button className={`open-day-nav ${route === 'open' ? 'selected' : ''}`} onClick={() => go('open')}><span className="open-day-icon"><Icon name="plus" size={15} /></span><span>Abrir día</span><Icon name="arrow" size={15} /></button><div className="created-days">{createdDays.length === 0 ? <div className="empty-days"><span>-</span><p>Aquí aparecerán tus días<br />cuando abras el primero.</p></div> : createdDays.slice(0, 8).map((key) => <button key={key} className="created-day" onClick={() => onOpenDay(key)}><span className={`day-dot ${statusOf(records[key])}`} /><span>{formatShortDate(key)}</span><small>{records[key].closed ? 'cerrado' : 'abierto'}</small></button>)}{createdDays.length > 8 && <button className="more-days" onClick={() => go('records')}>Ver todos <Icon name="arrow" size={13} /></button>}</div></nav><div className="sidebar-bottom"><div className="side-progress"><div><span>PROGRESO</span><b>{closed}/{WORKING_DAYS.length}</b></div><div className="progress-track"><i style={{ width: `${Math.round((closed / WORKING_DAYS.length) * 100)}%` }} /></div><small>{WORKING_DAYS.length - closed} días restantes</small></div><button className={`nav-item ${route === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}><Icon name="settings" /><span>Ajustes</span></button></div></aside>;
}

function Topbar({ route, selectedDay, onOpenDay, onBack, onMenu }) {
  const titles = { home: ['PANEL DE CONTROL', 'Inicio'], calendar: ['PLANIFICACIÓN', 'Calendario'], records: ['HISTORIAL', 'Registros'], summary: ['SEGUIMIENTO', 'Resumen'], open: ['NUEVA JORNADA', 'Abrir día'], settings: ['PREFERENCIAS', 'Ajustes'] };
  const title = selectedDay && route === 'day' ? ['JORNADA', formatDate(selectedDay)] : titles[route] || ['JORNADA', 'Detalle del día'];
  return <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={onMenu} aria-label="Abrir menú"><Icon name="menu" /></button>{route === 'day' && <button className="back-button" onClick={onBack}><Icon name="chevronLeft" size={16} /> Volver</button>}<div><span className="eyebrow">{title[0]}</span><h1>{title[1]}</h1></div></div><div className="topbar-actions"><span className="status-chip"><i /> Guardado local</span>{route !== 'day' && route !== 'open' && <button className="button primary compact" onClick={onOpenDay}><Icon name="plus" size={16} /> Abrir día</button>}</div></header>;
}

function StatCard({ icon, label, value, hint, tone = 'mint' }) { return <article className={`stat-card ${tone}`}><div className="stat-top"><span className="stat-icon"><Icon name={icon} size={17} /></span><span>{label}</span></div><strong>{value}</strong><small>{hint}</small></article>; }

function HomePage({ records, settings, go, onOpenDay }) {
  const created = Object.keys(records).filter((key) => isWorkingDay(parseDate(key))).sort();
  const closed = created.filter((key) => records[key].closed).length;
  const next = WORKING_DAYS.find((day) => !records[dateKey(day)]?.closed) || WORKING_DAYS[WORKING_DAYS.length - 1];
  const nextKey = dateKey(next);
  const afDone = AF.filter(([code]) => created.some((key) => records[key].closed && records[key].af?.includes(code))).length;
  const hours = created.reduce((sum, key) => { const r = records[key]; const [sh, sm] = (r.start || '09:00').split(':').map(Number); const [eh, em] = (r.end || '16:00').split(':').map(Number); return sum + Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60); }, 0);
  return <div className="page home-page"><section className="hero-card"><div className="hero-copy"><span className="kicker">☀ Buenos días, {settings.studentName || 'Pablo'}</span><h2>Tu práctica,<br /><em>en orden.</em></h2><p>Registra lo que haces cada jornada, cierra los días terminados y mantén todo listo para tu seguimiento.</p><div className="hero-actions"><button className="button primary" onClick={() => onOpenDay(nextKey)}><Icon name="plus" size={17} /> Abrir próximo día</button><button className="button ghost" onClick={() => go('calendar')}>Ver calendario <Icon name="arrow" size={16} /></button></div></div><div className="hero-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><span>{Math.round((closed / WORKING_DAYS.length) * 100)}%</span><small>completado</small></div><div className="orbit-label"><Icon name="calendar" size={14} /> 05 OCT - 18 DIC</div></div></section><div className="stat-grid"><StatCard icon="calendar" label="DÍAS ABIERTOS" value={created.length} hint={`${WORKING_DAYS.length - created.length} por abrir`} /><StatCard icon="check" label="DÍAS CERRADOS" value={closed} hint={`${closed ? Math.round((closed / WORKING_DAYS.length) * 100) : 0}% del periodo`} tone="blue" /><StatCard icon="clock" label="HORAS REGISTRADAS" value={`${hours} h`} hint="En jornadas guardadas" tone="amber" /><StatCard icon="chart" label="AF COMPLETADAS" value={`${afDone}/${AF.length}`} hint="áreas formativas" tone="violet" /></div><div className="home-columns"><section className="panel next-panel"><div className="panel-heading"><div><span className="section-label">SIGUIENTE PASO</span><h3>Continúa con tu jornada</h3></div><span className="date-pill">{formatShortDate(nextKey)}</span></div><div className="next-day"><div className="next-date"><span>{WEEKDAYS[next.getDay()].slice(0, 3).toUpperCase()}</span><strong>{String(next.getDate()).padStart(2, '0')}</strong><small>{MONTHS[next.getMonth()].slice(0, 3).toUpperCase()}</small></div><div className="next-info"><h4>{records[nextKey] ? 'Revisar y completar registro' : 'Aún no has abierto este día'}</h4><p>{records[nextKey] ? 'Tienes un registro en curso. Añade las actividades que faltan.' : 'Empieza una página nueva para anotar tus tareas y AF.'}</p><button className="text-button" onClick={() => onOpenDay(nextKey)}>{records[nextKey] ? 'Continuar registro' : 'Abrir jornada'} <Icon name="arrow" size={14} /></button></div></div></section><section className="panel pulse-panel"><div className="panel-heading"><div><span className="section-label">RITMO DE TRABAJO</span><h3>Últimos días</h3></div><button className="icon-link" onClick={() => go('records')}><Icon name="arrow" size={16} /></button></div><div className="week-bars">{WORKING_DAYS.slice(-7).map((day) => { const key = dateKey(day); const record = records[key]; const value = record ? (record.closed ? 100 : record.af?.length ? 64 : 30) : 8; return <div className="bar-day" key={key}><div className="bar-track"><i className={record?.closed ? 'closed' : record ? 'active' : ''} style={{ height: `${value}%` }} /></div><span>{day.getDate()}</span></div>; })}</div><div className="pulse-legend"><span><i className="legend-dot closed" /> Cerrado</span><span><i className="legend-dot active" /> En curso</span><span><i className="legend-dot empty" /> Sin abrir</span></div></section></div><section className="panel recent-panel"><div className="panel-heading"><div><span className="section-label">ACTIVIDAD RECIENTE</span><h3>Tus días abiertos</h3></div><button className="text-button" onClick={() => go('records')}>Ver todos <Icon name="arrow" size={14} /></button></div>{created.length === 0 ? <div className="blank-state"><span className="blank-icon"><Icon name="calendar" size={20} /></span><div><strong>Tu historial empieza aquí</strong><p>Abre tu primera jornada para verla en este listado.</p></div><button className="button soft" onClick={() => onOpenDay(nextKey)}>Abrir día</button></div> : <div className="recent-list">{created.slice(-4).reverse().map((key) => <button className="recent-row" key={key} onClick={() => onOpenDay(key)}><span className="recent-date"><strong>{String(parseDate(key).getDate()).padStart(2, '0')}</strong><small>{MONTHS[parseDate(key).getMonth()].slice(0, 3)}</small></span><span className="recent-copy"><strong>{formatDate(key, { weekday: 'long' })}</strong><small>{lines(records[key].notes || records[key].gitlab || '').slice(0, 1)[0] || 'Sin descripción todavía'}</small></span><Badge status={statusOf(records[key])} /><Icon name="chevronRight" size={16} /></button>)}</div>}</section></div>;
}

function monthCells(month) {
  const first = new Date(2026, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(2026, month + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => { const number = index - offset + 1; return number < 1 || number > daysInMonth ? null : new Date(2026, month, number); });
}

function CalendarPage({ records, month, setMonth, onOpenDay }) {
  const cells = monthCells(month);
  const monthName = `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} 2026`;
  return <div className="page calendar-page"><div className="calendar-toolbar"><p className="page-intro">Planifica, abre y revisa cada jornada.</p><div className="month-switch"><button className="round-button" disabled={month <= 9} onClick={() => setMonth((value) => value - 1)}><Icon name="chevronLeft" size={16} /></button><strong>{monthName}</strong><button className="round-button" disabled={month >= 11} onClick={() => setMonth((value) => value + 1)}><Icon name="chevronRight" size={16} /></button></div></div><section className="calendar-panel"><div className="calendar-week"><span>LUN</span><span>MAR</span><span>MIÉ</span><span>JUE</span><span>VIE</span><span>SÁB</span><span>DOM</span></div><div className="calendar-grid">{cells.map((date, index) => { if (!date) return <div className="calendar-cell blank" key={`blank-${index}`} />; const key = dateKey(date); const record = records[key]; const status = statusOf(record); const workday = isWorkingDay(date); return <button key={key} className={`calendar-cell ${workday ? 'workday' : 'nonwork'} ${record ? 'created' : ''}`} disabled={!workday} onClick={() => workday && onOpenDay(key)}><div className="cell-header"><span className="cell-number">{date.getDate()}</span>{record && <span className={`cell-status ${status}`}><i /></span>}</div>{!workday ? <span className="cell-note">{HOLIDAYS[key] || (date.getDay() === 0 || date.getDay() === 6 ? 'Fin de semana' : '')}</span> : record ? <><span className="cell-status-label">{statusLabel(status)}</span><span className="cell-tags">{record.af?.slice(0, 2).map((af) => <b key={af}>{af}</b>)}</span></> : <span className="cell-note open-hint">Abrir día <Icon name="plus" size={12} /></span>}</button>; })}</div></section><div className="calendar-legend"><span><i className="legend-dot closed" /> Cerrado</span><span><i className="legend-dot active" /> En curso</span><span><i className="legend-dot empty" /> Disponible</span><span className="legend-note">Haz clic en cualquier día laborable para abrir su página</span></div></div>;
}

function OpenDayPage({ records, onOpenDay }) {
  const [query, setQuery] = useState('');
  const filtered = WORKING_DAYS.filter((date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page open-page"><div className="open-intro"><div><span className="section-label">NUEVA JORNADA</span><h2>¿Qué día quieres abrir?</h2><p>Selecciona una fecha para entrar en su página de registro. Solo los días que guardes aparecerán en el menú lateral.</p></div><div className="open-search"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar fecha…" /></div></div><div className="open-list">{[9, 10, 11].map((month) => { const monthDays = filtered.filter((date) => date.getMonth() === month); if (!monthDays.length) return null; return <section className="open-month" key={month}><div className="open-month-title"><h3>{MONTHS[month][0].toUpperCase() + MONTHS[month].slice(1)}</h3><span>{monthDays.length} jornadas</span></div><div className="open-day-grid">{monthDays.map((date) => { const key = dateKey(date); const record = records[key]; return <button className={`open-day-card ${record ? 'already' : ''}`} key={key} onClick={() => onOpenDay(key)}><span className="open-card-date"><strong>{String(date.getDate()).padStart(2, '0')}</strong><small>{WEEKDAYS[date.getDay()].slice(0, 3).toUpperCase()}</small></span><span className="open-card-copy"><b>{record ? 'Continuar jornada' : 'Abrir jornada'}</b><small>{record ? `${record.closed ? 'Día cerrado - puedes reabrirlo' : 'Registro en curso'}` : 'Página vacía - 7 h previstas'}</small></span><span className="open-card-action"><Icon name={record ? 'arrow' : 'plus'} size={16} /></span></button>; })}</div></section>; })}</div></div>;
}

function RecordsPage({ records, onOpenDay }) {
  const [filter, setFilter] = useState('all'); const [query, setQuery] = useState('');
  const entries = Object.keys(records).filter((key) => isWorkingDay(parseDate(key))).sort().reverse().filter((key) => filter === 'all' || statusOf(records[key]) === filter).filter((key) => `${key} ${records[key].notes} ${records[key].gitlab}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page records-page"><div className="list-toolbar"><div className="search-field"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en tus registros-" /></div><div className="filter-pills">{[['all', 'Todos'], ['closed', 'Cerrados'], ['progress', 'En curso'], ['draft', 'Borradores']].map(([value, label]) => <button className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>{entries.length === 0 ? <div className="empty-panel"><span className="blank-icon"><Icon name="book" size={20} /></span><h3>{Object.keys(records).length ? 'No hay coincidencias' : 'Todavía no hay registros'}</h3><p>Abre un día para empezar a construir tu historial.</p></div> : <section className="records-table"><div className="records-head"><span>JORNADA</span><span>RESUMEN</span><span>AF</span><span>ESTADO</span><span /></div>{entries.map((key) => { const record = records[key]; return <button className="record-item" key={key} onClick={() => onOpenDay(key)}><span className="record-date"><strong>{formatShortDate(key)}</strong><small>{formatDate(key, { weekday: 'long' })}</small></span><span className="record-summary"><strong>{lines(record.notes || record.gitlab || '').slice(0, 1)[0] || 'Sin descripción'}</strong><small>{duration(record.start, record.end)} - actualizado recientemente</small></span><span className="record-af">{record.af?.length ? record.af.slice(0, 3).map((af) => <b key={af}>{af}</b>) : <small>-</small>}</span><Badge status={statusOf(record)} /><Icon name="chevronRight" size={16} /></button>; })}</section>}</div>;
}

function SummaryPage({ records }) {
  const created = Object.keys(records).filter((key) => isWorkingDay(parseDate(key))); const closed = created.filter((key) => records[key].closed).length; const afCount = (code) => created.filter((key) => records[key].af?.includes(code)).length; const maxAf = Math.max(1, ...AF.map(([code]) => afCount(code)));
  return <div className="page summary-page"><div className="summary-hero"><div><span className="section-label">VISIÓN GENERAL</span><h2>Tu recorrido hasta ahora</h2><p>Una lectura rápida de las jornadas abiertas, las horas guardadas y las actividades formativas que has tocado.</p></div><div className="summary-ring" style={{ background: `conic-gradient(var(--violet) ${Math.round((closed / WORKING_DAYS.length) * 360)}deg, #222239 0deg)` }}><div><strong>{Math.round((closed / WORKING_DAYS.length) * 100)}%</strong><span>completado</span></div></div></div><div className="summary-metrics"><div><span>DÍAS RESTANTES</span><strong>{WORKING_DAYS.length - closed}</strong><small>de {WORKING_DAYS.length} laborables</small></div><div><span>JORNADAS CERRADAS</span><strong>{closed}</strong><small>listas para revisión</small></div><div><span>AF CON ACTIVIDAD</span><strong>{AF.filter(([code]) => afCount(code) > 0).length}</strong><small>de {AF.length} áreas</small></div><div><span>MEDIA DE AF</span><strong>{created.length ? (created.reduce((sum, key) => sum + (records[key].af?.length || 0), 0) / created.length).toFixed(1) : '0'}</strong><small>por jornada abierta</small></div></div><section className="panel af-panel"><div className="panel-heading"><div><span className="section-label">ACTIVIDADES FORMATIVAS</span><h3>Cobertura por área</h3></div><span className="panel-meta">AF8 — AF13</span></div><div className="af-list">{AF.map(([code, name]) => { const count = afCount(code); return <div className="af-row" key={code}><span className="af-code">{code}</span><div className="af-info"><div><strong>{name}</strong><span>{count} {count === 1 ? 'jornada' : 'jornadas'}</span></div><div className="af-track"><i style={{ width: `${(count / maxAf) * 100}%` }} /></div></div><span className="af-percent">{created.length ? Math.round((count / created.length) * 100) : 0}%</span></div>; })}</div></section></div>;
}

function DayPage({ dayKey, records, settings, onSave, onCloseDay, onDelete, onReopen, onSendSeneca }) {
  const existing = records[dayKey]; const draft = (record) => ({ ...defaultRecord(settings), ...(record || {}), af: record?.af || [], tags: record?.tags || [] }); const [form, setForm] = useState(() => draft(existing)); const [tagInput, setTagInput] = useState(''); const isClosed = Boolean(existing?.closed);
  useEffect(() => { setForm(draft(records[dayKey])); }, [dayKey]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const addTag = (event) => { if (event.key !== 'Enter' && event.key !== ',') return; event.preventDefault(); const clean = tagInput.trim().replace(/^#/, ''); if (clean && !form.tags.includes(clean)) update('tags', [...form.tags, clean]); setTagInput(''); };
  const save = () => onSave(dayKey, { ...form, updatedAt: new Date().toISOString() });
  return <div className="page day-page"><div className="day-header"><div><span className="section-label">{WEEKDAYS[parseDate(dayKey).getDay()].toUpperCase()} - {duration(form.start, form.end)}</span><h2>{formatDate(dayKey)}</h2><p>{existing ? 'Continúa con las notas de esta jornada.' : 'Esta página queda reservada para tu jornada.'}</p></div><div className="day-header-actions">{existing && <Badge status={statusOf(existing)} />}{isClosed ? <button className="button soft" onClick={() => onReopen(dayKey)}><Icon name="unlock" size={16} /> Reabrir día</button> : <button className="button primary" onClick={save}><Icon name="check" size={16} /> Guardar día</button>}</div></div>{isClosed && <div className="closed-banner"><span><Icon name="lock" size={18} /></span><div><strong>Jornada cerrada</strong><p>El registro está listo. Puedes reabrirlo si necesitas corregir algo.</p></div><button className="text-button" onClick={() => onReopen(dayKey)}>Editar de nuevo <Icon name="arrow" size={14} /></button></div>}<div className="day-layout"><main className="day-main"><section className="editor-card"><div className="editor-heading"><div><span className="editor-kicker gitlab-dot">GITLAB</span><h3>¿Qué has construido hoy?</h3></div><span className="editor-help">Una tarea por línea</span></div><textarea disabled={isClosed} value={form.gitlab} onChange={(event) => update('gitlab', event.target.value)} placeholder="Ej. Maquetación de la vista de seguimiento…\nPruebas y revisión de errores…" /><div className="editor-footer"><span>{lines(form.gitlab).length} tareas</span><button className="text-button" onClick={() => navigator.clipboard?.writeText(`### ${formatDate(dayKey)}\n\n${settings.studentName || 'Pablo'}\n${lines(form.gitlab).map((line) => `- ${line}`).join('\n')}`)}>Copiar formato <Icon name="external" size={13} /></button></div></section><section className="editor-card"><div className="editor-heading"><div><span className="editor-kicker ipasen-dot">IPASEN</span><h3>Resumen para la tutoría</h3></div><span className="editor-help">Lo que se envía al seguimiento</span></div><textarea disabled={isClosed} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Cuenta brevemente qué has aprendido o qué has resuelto…" /><div className="editor-footer"><span>{lines(form.notes).length} líneas</span><button className="text-button" onClick={() => navigator.clipboard?.writeText(lines(form.notes).map((line) => `- ${line}`).join('\n'))}>Copiar lista <Icon name="external" size={13} /></button></div></section><section className="editor-card"><div className="editor-heading"><div><span className="editor-kicker violet-dot">ACTIVIDADES FORMATIVAS</span><h3>¿Qué AF has trabajado?</h3></div><span className="editor-help">Puedes marcar varias</span></div><div className="af-selector">{AF.map(([code, name]) => { const active = form.af.includes(code); return <button type="button" disabled={isClosed} className={`af-select ${active ? 'active' : ''}`} key={code} onClick={() => update('af', active ? form.af.filter((item) => item !== code) : [...form.af, code])}><span className="af-select-check">{active ? <Icon name="check" size={12} /> : null}</span><span><strong>{code}</strong><small>{name}</small></span></button>; })}</div></section></main><aside className="day-aside"><section className="aside-card"><div className="aside-title"><Icon name="clock" size={16} /><div><strong>Horario</strong><small>Tiempo de esta jornada</small></div></div><div className="time-fields"><label>Entrada<input disabled={isClosed} type="time" value={form.start} onChange={(event) => update('start', event.target.value)} /></label><span>-</span><label>Salida<input disabled={isClosed} type="time" value={form.end} onChange={(event) => update('end', event.target.value)} /></label></div><div className="hours-total"><span>Total previsto</span><strong>{duration(form.start, form.end)}</strong></div></section><section className="aside-card"><div className="aside-title"><Icon name="tag" size={16} /><div><strong>Etiquetas</strong><small>Para encontrar este día</small></div></div><div className="tag-editor"><div className="tag-chips">{form.tags.map((tag) => <span key={tag}>#{tag}<button disabled={isClosed} onClick={() => update('tags', form.tags.filter((item) => item !== tag))}><Icon name="close" size={12} /></button></span>)}</div><input disabled={isClosed} value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={addTag} placeholder="Añadir etiqueta-" /></div></section><section className="aside-card aside-actions"><button className="button soft full" onClick={save} disabled={isClosed}><Icon name="check" size={16} /> Guardar cambios</button>{existing && !isClosed && <button className="button close-day full" onClick={() => { save(); onCloseDay(dayKey); }}><Icon name="lock" size={16} /> Cerrar día</button>}{existing && <button className="danger-link" onClick={() => onDelete(dayKey)}>Eliminar registro</button>}</section>{existing && <button className="seneca-link" onClick={() => onSendSeneca(dayKey, form)}><Icon name="external" size={14} /> Enviar a Séneca</button>}</aside></div></div>;
}

function SettingsPage({ settings, onSaveSettings, onExport, onImport }) {
  const [form, setForm] = useState(settings);
  return <div className="page settings-page"><div className="settings-intro"><span className="section-label">PREFERENCIAS</span><h2>Adapta el portal a tu ritmo</h2><p>Estos datos se guardan solo en este navegador.</p></div><section className="settings-card"><div className="settings-section"><div><h3>Perfil</h3><p>Cómo quieres que aparezca tu nombre en los registros.</p></div><label className="field-label">Nombre<input value={form.studentName} onChange={(event) => setForm({ ...form, studentName: event.target.value })} /></label></div><div className="settings-section"><div><h3>Horario habitual</h3><p>Se usará como valor inicial al abrir una jornada.</p></div><div className="settings-time"><label className="field-label">Entrada<input type="time" value={form.defaultStart} onChange={(event) => setForm({ ...form, defaultStart: event.target.value })} /></label><label className="field-label">Salida<input type="time" value={form.defaultEnd} onChange={(event) => setForm({ ...form, defaultEnd: event.target.value })} /></label></div></div><div className="settings-section"><div><h3>Datos</h3><p>Guarda una copia o restaura tus jornadas en otro navegador.</p></div><div className="settings-data-actions"><button className="button soft" onClick={onExport}><Icon name="download" size={15} /> Exportar JSON</button><label className="button soft file-input"><Icon name="upload" size={15} /> Importar JSON<input type="file" accept="application/json" hidden onChange={(event) => event.target.files[0] && onImport(event.target.files[0])} /></label></div></div><div className="settings-save"><span>Los cambios se aplican a los nuevos días.</span><button className="button primary" onClick={() => onSaveSettings(form)}>Guardar ajustes</button></div></section></div>;
}

function AuthScreen({ vault, onUnlock }) {
  const [username, setUsername] = useState(vault.username || '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!username.trim() || !/^\d{4,8}$/.test(pin)) { setError('Introduce tu usuario y un PIN de 4 a 8 dígitos.'); return; }
    setBusy(true);
    try {
      if (username.trim().toLowerCase() !== String(vault.username).toLowerCase()) throw new Error('Usuario o PIN incorrecto.');
      const unlocked = await decryptVault(vault, pin);
      onUnlock({ ...unlocked, vault });
    } catch (unlockError) {
      setError(unlockError.message === 'Formato de registros no válido.' ? unlockError.message : 'Usuario o PIN incorrecto.');
      setPin('');
    } finally { setBusy(false); }
  };
  return <div className="auth-gate"><div className="auth-glow" /><section className="auth-card"><div className="auth-brand"><div className="brand-mark">P<span>•</span></div><div><strong>PhoneGest</strong><small>prácticas 2026</small></div></div><span className="section-label">REGISTROS PROTEGIDOS</span><h1>Vuelve a tus<br /><em>jornadas.</em></h1><p>Introduce tu acceso anterior para recuperar los registros que ya habías guardado.</p><form onSubmit={submit}><label className="auth-label">Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus /></label><label className="auth-label">PIN<input type="password" inputMode="numeric" pattern="[0-9]{4,8}" minLength="4" maxLength="8" value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="current-password" /></label>{error && <div className="auth-error">{error}</div>}<button className="button primary auth-submit" disabled={busy}>{busy ? 'Descifrando…' : 'Entrar al portal'} <Icon name="arrow" size={16} /></button></form><small className="auth-note"><Icon name="lock" size={13} /> Tus registros se descifran solo en este navegador.</small></section></div>;
}

function App() {
  const initial = useMemo(loadInitial, []); const [records, setRecords] = useState(initial.requiresAuth ? {} : initial.records); const [settings, setSettings] = useState(initial.settings); const [authState, setAuthState] = useState(initial.requiresAuth ? null : { mode: 'local' }); const [route, setRoute] = useState('home'); const [selectedDay, setSelectedDay] = useState(null); const [month, setMonth] = useState(9); const [notice, setNotice] = useState(''); const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!authState) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (authState.mode === 'vault') persistVault(authState.vault, authState.key, records);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ records, settings }));
  }, [records, settings, authState]);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(timer); }, [notice]);
  if (!authState) return <AuthScreen vault={initial.vault} onUnlock={({ records: unlockedRecords, key, vault }) => { setRecords(unlockedRecords); setAuthState({ mode: 'vault', key, vault }); }} />;
  const go = (next) => { setRoute(next); setMobileOpen(false); if (next !== 'day') setSelectedDay(null); }; const openDay = (key) => { setSelectedDay(key); setRoute('day'); setMobileOpen(false); };
  const saveDay = (key, data) => { setRecords((current) => ({ ...current, [key]: { ...data, createdAt: current[key]?.createdAt || new Date().toISOString() } })); setNotice('Jornada guardada'); }; const closeDay = (key) => { setRecords((current) => ({ ...current, [key]: { ...current[key], closed: true } })); setNotice('Día cerrado y añadido a tu progreso'); }; const reopenDay = (key) => { setRecords((current) => ({ ...current, [key]: { ...current[key], closed: false } })); setNotice('Día reabierto para editarlo'); }; const deleteDay = (key) => { if (!window.confirm('¿Eliminar este registro?')) return; setRecords((current) => { const next = { ...current }; delete next[key]; return next; }); go('records'); setNotice('Registro eliminado'); };
  const sendSeneca = (key, form) => { window.postMessage({ source: 'PhoneGestPortal', type: 'SEND_SENECA', requestId: window.crypto?.randomUUID?.() || String(Date.now()), payload: { version: 1, date: key, modality: 'Presencial', start: form.start, end: form.end, af: form.af, notes: lines(form.notes).map((line) => `- ${line}`).join('\n') } }, window.location.origin); setNotice('Registro enviado a la extensión'); };
  const exportData = () => { const blob = new Blob([JSON.stringify({ app: 'PhoneGest', version: 4, exportedAt: new Date().toISOString(), settings, records }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'phonegest-practicas.json'; anchor.click(); URL.revokeObjectURL(url); setNotice('Copia exportada'); }; const importData = (file) => { const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); setRecords(data.records || {}); setSettings((current) => ({ ...current, ...(data.settings || {}) })); setNotice('Datos importados'); } catch { setNotice('El archivo no es válido'); } }; reader.readAsText(file); };
  const activeRoute = route === 'day' ? 'day' : route;
  return <div className={`app-shell ${mobileOpen ? 'mobile-open' : ''}`}><Sidebar route={activeRoute} go={go} records={records} onOpenDay={openDay} settings={settings} /><div className="main-shell"><Topbar route={activeRoute} selectedDay={selectedDay} onOpenDay={() => go('open')} onBack={() => go('records')} onMenu={() => setMobileOpen((value) => !value)} /><main className="content">{route === 'home' && <HomePage records={records} settings={settings} go={go} onOpenDay={openDay} />}{route === 'calendar' && <CalendarPage records={records} month={month} setMonth={setMonth} onOpenDay={openDay} />}{route === 'open' && <OpenDayPage records={records} onOpenDay={openDay} />}{route === 'records' && <RecordsPage records={records} onOpenDay={openDay} />}{route === 'summary' && <SummaryPage records={records} />}{route === 'settings' && <SettingsPage settings={settings} onSaveSettings={(next) => { setSettings(next); setNotice('Ajustes guardados'); }} onExport={exportData} onImport={importData} />}{route === 'day' && selectedDay && <DayPage dayKey={selectedDay} records={records} settings={settings} onSave={saveDay} onCloseDay={closeDay} onDelete={deleteDay} onReopen={reopenDay} onSendSeneca={sendSeneca} />}</main></div>{notice && <div className="toast"><span><Icon name="check" size={14} /></span>{notice}</div>}</div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
