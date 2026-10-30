(() => {
  const { useEffect, useMemo, useRef, useState } = React;
  const PERIOD_START = new Date(2026, 9, 5);
  const PERIOD_END = new Date(2026, 11, 18);
  const HOLIDAYS = {
    "2026-10-12": "Festivo",
    "2026-11-02": "Festivo",
    "2026-12-07": "Festivo",
    "2026-12-08": "Festivo"
  };
  const AF = [
    ["AF8", "Contenido web"],
    ["AF9", "Redes"],
    ["AF10", "Scripts"],
    ["AF11", "Sistemas"],
    ["AF12", "Resoluci\xF3n"],
    ["AF13", "Seguridad"]
  ];
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const WEEKDAYS = ["domingo", "lunes", "martes", "mi\xE9rcoles", "jueves", "viernes", "s\xE1bado"];
  const STORAGE_KEY = "phonegest_practicas_react_v1";
  const OLD_STORAGE_KEY = "phonegest_practices_2026";
  const VAULT_KEY = "phonegest_practices_vault_2026";
  const SETTINGS_KEY = "phonegest_practices_settings_2026";
  const VAULT_ITERATIONS = 35e4;
  let vaultWrites = Promise.resolve();
  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function parseDate(key) {
    const [year, month, day] = key.split("-").map(Number);
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
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", ...options }).format(parseDate(key));
  }
  function formatShortDate(key) {
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(parseDate(key)).replace(".", "");
  }
  function duration(start, end) {
    if (!start || !end) return "7 h";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const value = eh * 60 + em - (sh * 60 + sm);
    if (value <= 0) return "-";
    return `${Math.floor(value / 60)} h${value % 60 ? ` ${value % 60} min` : ""}`;
  }
  function lines(text = "") {
    return text.split(/\r?\n/).map((line) => line.trim().replace(/^(?:-|\u2022|\*)\s*/, "")).filter(Boolean);
  }
  function defaultRecord(settings) {
    return { gitlab: "", notes: "", af: [], start: settings.defaultStart, end: settings.defaultEnd, closed: false };
  }
  function statusOf(record) {
    if (!record) return "empty";
    if (record.closed) return "closed";
    const hasContent = Boolean((record.gitlab || "").trim() || (record.notes || "").trim() || record.af?.length);
    return hasContent ? "progress" : "draft";
  }
  function statusLabel(status) {
    return { empty: "Sin abrir", draft: "Borrador", progress: "En curso", closed: "Cerrado" }[status] || "Sin abrir";
  }
  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }
  function readVault() {
    const vault = readJson(VAULT_KEY);
    if (!vault || vault.version !== 1 || !vault.username || !vault.salt || !vault.iv || !vault.encrypted) return null;
    return vault;
  }
  function normalizeRecords(source = {}) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return {};
    return Object.fromEntries(Object.entries(source).map(([key, value = {}]) => [key, {
      ...value,
      gitlab: value.gitlab || "",
      notes: value.notes || value.ipasen || "",
      af: Array.isArray(value.af) ? value.af : [],
      start: value.start || "09:00",
      end: value.end || "16:00",
      closed: Boolean(value.closed),
      createdAt: value.createdAt || value.updatedAt || void 0
    }]));
  }
  function loadSettings() {
    const saved = readJson(SETTINGS_KEY) || {};
    const current = readJson(STORAGE_KEY)?.settings || {};
    return { studentName: "Pablo", defaultStart: "09:00", defaultEnd: "16:00", ...saved, ...current };
  }
  function bytesFromBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  function base64FromBytes(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    return btoa(binary);
  }
  async function deriveVaultKey(pin, salt) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: VAULT_ITERATIONS, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function decryptVault(vault, pin) {
    const key = await deriveVaultKey(pin, bytesFromBase64(vault.salt));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytesFromBase64(vault.iv) }, key, bytesFromBase64(vault.encrypted));
    const payload = JSON.parse(new TextDecoder().decode(decrypted));
    if (payload.format !== "PhoneGestVault1") throw new Error("Formato de registros no v\xE1lido.");
    return { key, records: normalizeRecords(payload.records) };
  }
  function persistVault(vault, key, records) {
    const snapshot = JSON.stringify({ format: "PhoneGestVault1", records });
    vaultWrites = vaultWrites.catch(() => {
    }).then(async () => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(snapshot));
      localStorage.setItem(VAULT_KEY, JSON.stringify({ ...vault, iv: base64FromBytes(iv), encrypted: base64FromBytes(encrypted) }));
    });
    return vaultWrites;
  }
  async function copyText(text, successMessage = "Copiado") {
    if (!String(text || "").trim()) return false;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      if (!copied) return false;
    }
    return successMessage;
  }
  function previousWorkingKey(key) {
    const index = WORKING_DAYS.findIndex((day) => dateKey(day) === key);
    return index > 0 ? dateKey(WORKING_DAYS[index - 1]) : null;
  }
  function loadInitial() {
    const fallback = { records: {}, settings: { studentName: "Pablo", defaultStart: "09:00", defaultEnd: "16:00" } };
    const vault = readVault();
    const settings = loadSettings();
    if (vault) return { records: {}, settings, vault, requiresAuth: true };
    try {
      const saved = readJson(STORAGE_KEY);
      if (saved?.records) return { ...fallback, ...saved, records: normalizeRecords(saved.records), settings: { ...fallback.settings, ...settings, ...saved.settings || {} } };
      const old = readJson(OLD_STORAGE_KEY);
      if (old && typeof old === "object") {
        return { ...fallback, records: normalizeRecords(old), settings: { ...fallback.settings, ...settings } };
      }
    } catch (error) {
      console.warn("No se pudo restaurar el estado local", error);
    }
    return { ...fallback, settings };
  }
  function Icon({ name, size = 18, stroke = 1.8 }) {
    const paths = {
      home: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "m3 10 9-7 9 7" }), /* @__PURE__ */ React.createElement("path", { d: "M5 9v11h14V9" }), /* @__PURE__ */ React.createElement("path", { d: "M9 20v-6h6v6" })),
      calendar: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4.5", width: "18", height: "16", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M7 2.5v4M17 2.5v4M3 9h18" }), /* @__PURE__ */ React.createElement("path", { d: "M7 13h.01M12 13h.01M17 13h.01M7 17h.01M12 17h.01" })),
      plus: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M12 5v14M5 12h14" })),
      chart: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M4 19V5M4 19h16" }), /* @__PURE__ */ React.createElement("path", { d: "m7 15 3-4 3 2 5-7" })),
      book: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" }), /* @__PURE__ */ React.createElement("path", { d: "M4 5.5v16M8 7h8M8 11h8" })),
      arrow: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M5 12h14" }), /* @__PURE__ */ React.createElement("path", { d: "m13 6 6 6-6 6" })),
      chevronLeft: /* @__PURE__ */ React.createElement("path", { d: "m15 18-6-6 6-6" }),
      chevronRight: /* @__PURE__ */ React.createElement("path", { d: "m9 18 6-6-6-6" }),
      check: /* @__PURE__ */ React.createElement("path", { d: "m5 12 4 4L19 6" }),
      clock: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "8.5" }), /* @__PURE__ */ React.createElement("path", { d: "M12 7v5l3 2" })),
      tag: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M20 13 13 20 4 11V4h7z" }), /* @__PURE__ */ React.createElement("path", { d: "M8 8h.01" })),
      lock: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "5", y: "10", width: "14", height: "10", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M8 10V7a4 4 0 0 1 8 0v3" })),
      unlock: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "5", y: "10", width: "14", height: "10", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M8 10V7a4 4 0 0 1 7-2" })),
      search: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "10.8", cy: "10.8", r: "6.8" }), /* @__PURE__ */ React.createElement("path", { d: "m16 16 4.5 4.5" })),
      settings: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "3" }), /* @__PURE__ */ React.createElement("path", { d: "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05-1.42 1.42-.05-.05A1.7 1.7 0 0 0 16.4 18a1.7 1.7 0 0 0-1 .99 1.7 1.7 0 0 0-.16.72v.08h-2v-.08A1.7 1.7 0 0 0 12 18a1.7 1.7 0 0 0-1-.99 1.7 1.7 0 0 0-1.88.34l-.05.05-1.42-1.42.05-.05A1.7 1.7 0 0 0 8 14.4a1.7 1.7 0 0 0-.99-1 1.7 1.7 0 0 0-.72-.16h-.08v-2h.08A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.34-1.88l-.05-.05 1.42-1.42.05.05A1.7 1.7 0 0 0 10.6 7a1.7 1.7 0 0 0 1-.99 1.7 1.7 0 0 0 .16-.72v-.08h2v.08A1.7 1.7 0 0 0 14 6a1.7 1.7 0 0 0 1 .99 1.7 1.7 0 0 0 1.88-.34l.05-.05 1.42 1.42-.05.05A1.7 1.7 0 0 0 18 9.6a1.7 1.7 0 0 0 .99 1 1.7 1.7 0 0 0 .72.16h.08v2h-.08A1.7 1.7 0 0 0 18 14a1.7 1.7 0 0 0 1.4 1z" })),
      download: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M12 3v12" }), /* @__PURE__ */ React.createElement("path", { d: "m7 10 5 5 5-5M4 20h16" })),
      upload: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M12 15V3" }), /* @__PURE__ */ React.createElement("path", { d: "m7 8 5-5 5 5M4 20h16" })),
      copy: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "8", y: "8", width: "12", height: "12", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" })),
      repeat: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "m17 2 4 4-4 4" }), /* @__PURE__ */ React.createElement("path", { d: "M3 11V9a3 3 0 0 1 3-3h15" }), /* @__PURE__ */ React.createElement("path", { d: "m7 22-4-4 4-4" }), /* @__PURE__ */ React.createElement("path", { d: "M21 13v2a3 3 0 0 1-3 3H3" })),
      trash: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M4 7h16" }), /* @__PURE__ */ React.createElement("path", { d: "M10 11v6M14 11v6" }), /* @__PURE__ */ React.createElement("path", { d: "M6 7l1 13h10l1-13M9 7V4h6v3" })),
      close: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "m6 6 12 12M18 6 6 18" })),
      menu: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M4 7h16M4 12h16M4 17h16" })),
      external: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M14 4h6v6M20 4l-9 9" }), /* @__PURE__ */ React.createElement("path", { d: "M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" }))
    };
    return /* @__PURE__ */ React.createElement("svg", { className: "icon", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, paths[name] || paths.home);
  }
  function Badge({ status }) {
    return /* @__PURE__ */ React.createElement("span", { className: `status-badge ${status}` }, /* @__PURE__ */ React.createElement("i", null), statusLabel(status));
  }
  function Sidebar({ route, go, records, onOpenDay, onOpenToday, selectedDay, settings }) {
    const createdDays = Object.keys(records).filter((key) => isWorkingDay(parseDate(key))).sort().reverse();
    const openDays = createdDays.filter((key) => !records[key].closed);
    const closedDays = createdDays.filter((key) => records[key].closed);
    const closed = closedDays.length;
    const [closedExpanded, setClosedExpanded] = useState(false);
    const renderDay = (key) => /* @__PURE__ */ React.createElement("button", { key, className: "created-day" + (selectedDay === key ? " active" : ""), "aria-current": selectedDay === key ? "page" : void 0, onClick: () => onOpenDay(key) }, /* @__PURE__ */ React.createElement("span", { className: "day-dot " + statusOf(records[key]) }), /* @__PURE__ */ React.createElement("span", null, formatShortDate(key)), /* @__PURE__ */ React.createElement("small", null, selectedDay === key ? "abierto" : "listo"));
    return /* @__PURE__ */ React.createElement("aside", { className: "sidebar glass" }, /* @__PURE__ */ React.createElement("div", { className: "brand" }, /* @__PURE__ */ React.createElement("div", { className: "brand-mark" }, "P", /* @__PURE__ */ React.createElement("span", null, "\u2022")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "PhoneGest"), /* @__PURE__ */ React.createElement("small", null, "pr\xE1cticas 2026"))), /* @__PURE__ */ React.createElement("div", { className: "profile-card" }, /* @__PURE__ */ React.createElement("div", { className: "avatar" }, (settings.studentName || "P").slice(0, 1).toUpperCase()), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, settings.studentName || "Pablo"), /* @__PURE__ */ React.createElement("small", null, "En formaci\xF3n")), /* @__PURE__ */ React.createElement("span", { className: "live-dot" })), /* @__PURE__ */ React.createElement("nav", { className: "side-nav", "aria-label": "Navegaci\xF3n principal" }, /* @__PURE__ */ React.createElement("p", { className: "nav-caption" }, "ESPACIO DE TRABAJO"), /* @__PURE__ */ React.createElement("button", { className: "nav-item " + (route === "home" ? "active" : ""), onClick: () => go("home") }, /* @__PURE__ */ React.createElement(Icon, { name: "home" }), /* @__PURE__ */ React.createElement("span", null, "Inicio")), /* @__PURE__ */ React.createElement("button", { className: "nav-item " + (route === "calendar" ? "active" : ""), onClick: () => go("calendar") }, /* @__PURE__ */ React.createElement(Icon, { name: "calendar" }), /* @__PURE__ */ React.createElement("span", null, "Calendario"), /* @__PURE__ */ React.createElement("em", null, WORKING_DAYS.length)), /* @__PURE__ */ React.createElement("button", { className: "nav-item " + (route === "records" ? "active" : ""), onClick: () => go("records") }, /* @__PURE__ */ React.createElement(Icon, { name: "book" }), /* @__PURE__ */ React.createElement("span", null, "Registros"), /* @__PURE__ */ React.createElement("em", null, createdDays.length)), /* @__PURE__ */ React.createElement("button", { className: "nav-item " + (route === "summary" ? "active" : ""), onClick: () => go("summary") }, /* @__PURE__ */ React.createElement(Icon, { name: "chart" }), /* @__PURE__ */ React.createElement("span", null, "Resumen")), /* @__PURE__ */ React.createElement("p", { className: "nav-caption created-caption" }, "D\xCDAS ABIERTOS ", /* @__PURE__ */ React.createElement("span", null, openDays.length)), /* @__PURE__ */ React.createElement("button", { className: "open-day-nav", onClick: onOpenToday }, /* @__PURE__ */ React.createElement("span", { className: "open-day-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 15 })), /* @__PURE__ */ React.createElement("span", null, "Abrir d\xEDa de hoy"), /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 15 })), /* @__PURE__ */ React.createElement("div", { className: "created-days" }, openDays.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-days" }, /* @__PURE__ */ React.createElement("span", null, "-"), /* @__PURE__ */ React.createElement("p", null, "Aqu\xED aparecer\xE1n tus d\xEDas", /* @__PURE__ */ React.createElement("br", null), "cuando abras el primero.")) : openDays.slice(0, 8).map(renderDay), openDays.length > 8 && /* @__PURE__ */ React.createElement("button", { className: "more-days", onClick: () => go("records") }, "Ver todos ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 13 }))), /* @__PURE__ */ React.createElement("button", { className: "days-group-toggle " + (closedExpanded ? "expanded" : ""), onClick: () => setClosedExpanded((value) => !value), "aria-expanded": closedExpanded }, /* @__PURE__ */ React.createElement("span", null, "D\xCDAS CERRADOS ", /* @__PURE__ */ React.createElement("em", null, closedDays.length)), /* @__PURE__ */ React.createElement(Icon, { name: "chevronRight", size: 14 })), closedExpanded && /* @__PURE__ */ React.createElement("div", { className: "created-days closed-days-list" }, closedDays.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "closed-empty" }, "Todav\xEDa no hay jornadas cerradas.") : closedDays.slice(0, 12).map(renderDay), closedDays.length > 12 && /* @__PURE__ */ React.createElement("button", { className: "more-days", onClick: () => go("records") }, "Ver todos ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 13 })))), /* @__PURE__ */ React.createElement("div", { className: "sidebar-bottom" }, /* @__PURE__ */ React.createElement("div", { className: "side-progress" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "PROGRESO"), /* @__PURE__ */ React.createElement("b", null, closed, "/", WORKING_DAYS.length)), /* @__PURE__ */ React.createElement("div", { className: "progress-track" }, /* @__PURE__ */ React.createElement("i", { style: { width: String(Math.round(closed / WORKING_DAYS.length * 100)) + "%" } })), /* @__PURE__ */ React.createElement("small", null, WORKING_DAYS.length - closed, " d\xEDas restantes")), /* @__PURE__ */ React.createElement("button", { className: "nav-item " + (route === "settings" ? "active" : ""), onClick: () => go("settings") }, /* @__PURE__ */ React.createElement(Icon, { name: "settings" }), /* @__PURE__ */ React.createElement("span", null, "Ajustes"))));
  }
  function Topbar({ route, selectedDay, onOpenToday, onBack, onMenu }) {
    const titles = { home: ["PANEL DE CONTROL", "Inicio"], calendar: ["PLANIFICACI\xD3N", "Calendario"], records: ["HISTORIAL", "Registros"], summary: ["SEGUIMIENTO", "Resumen"], open: ["NUEVA JORNADA", "Abrir d\xEDa"], settings: ["PREFERENCIAS", "Ajustes"] };
    const title = selectedDay && route === "day" ? ["JORNADA", formatDate(selectedDay)] : titles[route] || ["JORNADA", "Detalle del d\xEDa"];
    return /* @__PURE__ */ React.createElement("header", { className: "topbar" }, /* @__PURE__ */ React.createElement("div", { className: "topbar-left" }, /* @__PURE__ */ React.createElement("button", { className: "mobile-menu", onClick: onMenu, "aria-label": "Abrir men\xFA" }, /* @__PURE__ */ React.createElement(Icon, { name: "menu" })), route === "day" && /* @__PURE__ */ React.createElement("button", { className: "back-button", onClick: onBack, "aria-label": "Volver al calendario", title: "Volver al calendario" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevronLeft", size: 18 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, title[0]), /* @__PURE__ */ React.createElement("h1", null, title[1]))), /* @__PURE__ */ React.createElement("div", { className: "topbar-actions" }, /* @__PURE__ */ React.createElement("span", { className: "status-chip" }, /* @__PURE__ */ React.createElement("i", null), " Guardado local"), route !== "day" && route !== "open" && /* @__PURE__ */ React.createElement("button", { className: "button primary compact", onClick: onOpenToday }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 16 }), " Abrir d\xEDa de hoy")));
  }
  function StatCard({ icon, label, value, hint, tone = "mint" }) {
    return /* @__PURE__ */ React.createElement("article", { className: `stat-card ${tone}` }, /* @__PURE__ */ React.createElement("div", { className: "stat-top" }, /* @__PURE__ */ React.createElement("span", { className: "stat-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 17 })), /* @__PURE__ */ React.createElement("span", null, label)), /* @__PURE__ */ React.createElement("strong", null, value), /* @__PURE__ */ React.createElement("small", null, hint));
  }
  function HomePage({ records, settings, go, onOpenDay, onOpenToday }) {
    const created = Object.keys(records).filter((key) => isWorkingDay(parseDate(key))).sort();
    const closed = created.filter((key) => records[key].closed).length;
    const next = WORKING_DAYS.find((day) => !records[dateKey(day)]?.closed) || WORKING_DAYS[WORKING_DAYS.length - 1];
    const nextKey = dateKey(next);
    const afDone = AF.filter(([code]) => created.some((key) => records[key].closed && records[key].af?.includes(code))).length;
    const hours = created.reduce((sum, key) => {
      const r = records[key];
      const [sh, sm] = (r.start || "09:00").split(":").map(Number);
      const [eh, em] = (r.end || "16:00").split(":").map(Number);
      return sum + Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
    }, 0);
    return /* @__PURE__ */ React.createElement("div", { className: "page home-page" }, /* @__PURE__ */ React.createElement("section", { className: "hero-card" }, /* @__PURE__ */ React.createElement("div", { className: "hero-copy" }, /* @__PURE__ */ React.createElement("span", { className: "kicker" }, "\u2600 Buenos d\xEDas, ", settings.studentName || "Pablo"), /* @__PURE__ */ React.createElement("h2", null, "Tu pr\xE1ctica,", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("em", null, "en orden.")), /* @__PURE__ */ React.createElement("p", null, "Registra lo que haces cada jornada, cierra los d\xEDas terminados y mant\xE9n todo listo para tu seguimiento."), /* @__PURE__ */ React.createElement("div", { className: "hero-actions" }, /* @__PURE__ */ React.createElement("button", { className: "button primary", onClick: onOpenToday }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 17 }), " Abrir d\xEDa de hoy"), /* @__PURE__ */ React.createElement("button", { className: "button ghost", onClick: () => go("calendar") }, "Ver calendario ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 16 })))), /* @__PURE__ */ React.createElement("div", { className: "hero-orbit" }, /* @__PURE__ */ React.createElement("div", { className: "orbit-ring ring-one" }), /* @__PURE__ */ React.createElement("div", { className: "orbit-ring ring-two" }), /* @__PURE__ */ React.createElement("div", { className: "orbit-core" }, /* @__PURE__ */ React.createElement("span", null, Math.round(closed / WORKING_DAYS.length * 100), "%"), /* @__PURE__ */ React.createElement("small", null, "completado")), /* @__PURE__ */ React.createElement("div", { className: "orbit-label" }, /* @__PURE__ */ React.createElement(Icon, { name: "calendar", size: 14 }), " 05 OCT - 18 DIC"))), /* @__PURE__ */ React.createElement("div", { className: "stat-grid" }, /* @__PURE__ */ React.createElement(StatCard, { icon: "calendar", label: "D\xCDAS ABIERTOS", value: created.length, hint: `${WORKING_DAYS.length - created.length} por abrir` }), /* @__PURE__ */ React.createElement(StatCard, { icon: "check", label: "D\xCDAS CERRADOS", value: closed, hint: `${closed ? Math.round(closed / WORKING_DAYS.length * 100) : 0}% del periodo`, tone: "blue" }), /* @__PURE__ */ React.createElement(StatCard, { icon: "clock", label: "HORAS REGISTRADAS", value: `${hours} h`, hint: "En jornadas guardadas", tone: "amber" }), /* @__PURE__ */ React.createElement(StatCard, { icon: "chart", label: "AF COMPLETADAS", value: `${afDone}/${AF.length}`, hint: "\xE1reas formativas", tone: "violet" })), /* @__PURE__ */ React.createElement("div", { className: "home-columns" }, /* @__PURE__ */ React.createElement("section", { className: "panel next-panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "SIGUIENTE PASO"), /* @__PURE__ */ React.createElement("h3", null, "Contin\xFAa con tu jornada")), /* @__PURE__ */ React.createElement("span", { className: "date-pill" }, formatShortDate(nextKey))), /* @__PURE__ */ React.createElement("div", { className: "next-day" }, /* @__PURE__ */ React.createElement("div", { className: "next-date" }, /* @__PURE__ */ React.createElement("span", null, WEEKDAYS[next.getDay()].slice(0, 3).toUpperCase()), /* @__PURE__ */ React.createElement("strong", null, String(next.getDate()).padStart(2, "0")), /* @__PURE__ */ React.createElement("small", null, MONTHS[next.getMonth()].slice(0, 3).toUpperCase())), /* @__PURE__ */ React.createElement("div", { className: "next-info" }, /* @__PURE__ */ React.createElement("h4", null, records[nextKey] ? "Revisar y completar registro" : "A\xFAn no has abierto este d\xEDa"), /* @__PURE__ */ React.createElement("p", null, records[nextKey] ? "Tienes un registro en curso. A\xF1ade las actividades que faltan." : "Empieza una p\xE1gina nueva para anotar tus tareas y AF."), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => onOpenDay(nextKey) }, records[nextKey] ? "Continuar registro" : "Abrir jornada", " ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 14 }))))), /* @__PURE__ */ React.createElement("section", { className: "panel pulse-panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "RITMO DE TRABAJO"), /* @__PURE__ */ React.createElement("h3", null, "\xDAltimos d\xEDas")), /* @__PURE__ */ React.createElement("button", { className: "icon-link", onClick: () => go("records") }, /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 16 }))), /* @__PURE__ */ React.createElement("div", { className: "week-bars" }, WORKING_DAYS.slice(-7).map((day) => {
      const key = dateKey(day);
      const record = records[key];
      const value = record ? record.closed ? 100 : record.af?.length ? 64 : 30 : 8;
      return /* @__PURE__ */ React.createElement("div", { className: "bar-day", key }, /* @__PURE__ */ React.createElement("div", { className: "bar-track" }, /* @__PURE__ */ React.createElement("i", { className: record?.closed ? "closed" : record ? "active" : "", style: { height: `${value}%` } })), /* @__PURE__ */ React.createElement("span", null, day.getDate()));
    })), /* @__PURE__ */ React.createElement("div", { className: "pulse-legend" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot closed" }), " Cerrado"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot active" }), " En curso"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot empty" }), " Sin abrir")))), /* @__PURE__ */ React.createElement("section", { className: "panel recent-panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "ACTIVIDAD RECIENTE"), /* @__PURE__ */ React.createElement("h3", null, "Tus d\xEDas abiertos")), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => go("records") }, "Ver todos ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 14 }))), created.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "blank-state" }, /* @__PURE__ */ React.createElement("span", { className: "blank-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: "calendar", size: 20 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Tu historial empieza aqu\xED"), /* @__PURE__ */ React.createElement("p", null, "Abre tu primera jornada para verla en este listado.")), /* @__PURE__ */ React.createElement("button", { className: "button soft", onClick: () => onOpenDay(nextKey) }, "Abrir d\xEDa")) : /* @__PURE__ */ React.createElement("div", { className: "recent-list" }, created.slice(-4).reverse().map((key) => /* @__PURE__ */ React.createElement("button", { className: "recent-row", key, onClick: () => onOpenDay(key) }, /* @__PURE__ */ React.createElement("span", { className: "recent-date" }, /* @__PURE__ */ React.createElement("strong", null, String(parseDate(key).getDate()).padStart(2, "0")), /* @__PURE__ */ React.createElement("small", null, MONTHS[parseDate(key).getMonth()].slice(0, 3))), /* @__PURE__ */ React.createElement("span", { className: "recent-copy" }, /* @__PURE__ */ React.createElement("strong", null, formatDate(key, { weekday: "long" })), /* @__PURE__ */ React.createElement("small", null, lines(records[key].notes || records[key].gitlab || "").slice(0, 1)[0] || "Sin descripci\xF3n todav\xEDa")), /* @__PURE__ */ React.createElement(Badge, { status: statusOf(records[key]) }), /* @__PURE__ */ React.createElement(Icon, { name: "chevronRight", size: 16 }))))));
  }
  function monthCells(month) {
    const first = new Date(2026, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(2026, month + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const number = index - offset + 1;
      return number < 1 || number > daysInMonth ? null : new Date(2026, month, number);
    });
  }
  function CalendarPage({ records, month, setMonth, onOpenDay, onContextDay }) {
    const cells = monthCells(month);
    const monthName = `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} 2026`;
    const today = dateKey(/* @__PURE__ */ new Date());
    return /* @__PURE__ */ React.createElement("div", { className: "page calendar-page" }, /* @__PURE__ */ React.createElement("div", { className: "calendar-toolbar" }, /* @__PURE__ */ React.createElement("p", { className: "page-intro" }, "Planifica, abre y revisa cada jornada."), /* @__PURE__ */ React.createElement("div", { className: "month-switch" }, /* @__PURE__ */ React.createElement("button", { className: "round-button", disabled: month <= 9, onClick: () => setMonth((value) => value - 1) }, /* @__PURE__ */ React.createElement(Icon, { name: "chevronLeft", size: 16 })), /* @__PURE__ */ React.createElement("strong", null, monthName), /* @__PURE__ */ React.createElement("button", { className: "round-button", disabled: month >= 11, onClick: () => setMonth((value) => value + 1) }, /* @__PURE__ */ React.createElement(Icon, { name: "chevronRight", size: 16 })))), /* @__PURE__ */ React.createElement("section", { className: "calendar-panel" }, /* @__PURE__ */ React.createElement("div", { className: "calendar-week" }, /* @__PURE__ */ React.createElement("span", null, "LUN"), /* @__PURE__ */ React.createElement("span", null, "MAR"), /* @__PURE__ */ React.createElement("span", null, "MI\xC9"), /* @__PURE__ */ React.createElement("span", null, "JUE"), /* @__PURE__ */ React.createElement("span", null, "VIE"), /* @__PURE__ */ React.createElement("span", null, "S\xC1B"), /* @__PURE__ */ React.createElement("span", null, "DOM")), /* @__PURE__ */ React.createElement("div", { className: "calendar-grid" }, cells.map((date, index) => {
      if (!date) return /* @__PURE__ */ React.createElement("div", { className: "calendar-cell blank", key: `blank-${index}` });
      const key = dateKey(date);
      const record = records[key];
      const status = statusOf(record);
      const workday = isWorkingDay(date);
      return /* @__PURE__ */ React.createElement("button", { key, className: "calendar-cell " + (workday ? "workday " : "nonwork ") + (record ? "created " : "") + (key === today ? "today" : ""), "aria-haspopup": "menu", "aria-label": formatDate(key, { weekday: "long" }) + " \xB7 " + (workday ? statusLabel(status) : HOLIDAYS[key] || (date.getDay() === 0 || date.getDay() === 6 ? "Fin de semana" : "No laborable")), onClick: () => workday && onOpenDay(key), onContextMenu: (event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextDay(event, key, workday, HOLIDAYS[key] || (date.getDay() === 0 || date.getDay() === 6 ? "Fin de semana" : "No laborable"));
      }, onKeyDown: (event) => {
        if (!(event.key === "ContextMenu" || event.shiftKey && event.key === "F10")) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        onContextDay({ clientX: rect.left + Math.min(rect.width / 2, 120), clientY: rect.top + rect.height / 2 }, key, workday, HOLIDAYS[key] || (date.getDay() === 0 || date.getDay() === 6 ? "Fin de semana" : "No laborable"));
      } }, /* @__PURE__ */ React.createElement("div", { className: "cell-header" }, /* @__PURE__ */ React.createElement("span", { className: "cell-number" }, date.getDate()), record && /* @__PURE__ */ React.createElement("span", { className: `cell-status ${status}` }, /* @__PURE__ */ React.createElement("i", null))), !workday ? /* @__PURE__ */ React.createElement("span", { className: "cell-note" }, HOLIDAYS[key] || (date.getDay() === 0 || date.getDay() === 6 ? "Fin de semana" : "")) : record ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "cell-status-label" }, statusLabel(status)), /* @__PURE__ */ React.createElement("span", { className: "cell-tags" }, record.af?.slice(0, 2).map((af) => /* @__PURE__ */ React.createElement("b", { key: af }, af)))) : /* @__PURE__ */ React.createElement("span", { className: "cell-note open-hint" }, "Abrir d\xEDa ", /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 12 })));
    }))), /* @__PURE__ */ React.createElement("div", { className: "calendar-legend" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot closed" }), " Cerrado"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot active" }), " En curso"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot empty" }), " Disponible"), /* @__PURE__ */ React.createElement("span", { className: "legend-note" }, "Clic derecho sobre un d\xEDa para ver acciones r\xE1pidas")));
  }
  function OpenDayPage({ records, onOpenDay }) {
    const [query, setQuery] = useState("");
    const filtered = WORKING_DAYS.filter((date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`.toLowerCase().includes(query.toLowerCase()));
    return /* @__PURE__ */ React.createElement("div", { className: "page open-page" }, /* @__PURE__ */ React.createElement("div", { className: "open-intro" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "NUEVA JORNADA"), /* @__PURE__ */ React.createElement("h2", null, "\xBFQu\xE9 d\xEDa quieres abrir?"), /* @__PURE__ */ React.createElement("p", null, "Selecciona una fecha para entrar en su p\xE1gina de registro. Solo los d\xEDas que guardes aparecer\xE1n en el men\xFA lateral.")), /* @__PURE__ */ React.createElement("div", { className: "open-search" }, /* @__PURE__ */ React.createElement(Icon, { name: "search", size: 16 }), /* @__PURE__ */ React.createElement("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Buscar fecha\u2026" }))), /* @__PURE__ */ React.createElement("div", { className: "open-list" }, [9, 10, 11].map((month) => {
      const monthDays = filtered.filter((date) => date.getMonth() === month);
      if (!monthDays.length) return null;
      return /* @__PURE__ */ React.createElement("section", { className: "open-month", key: month }, /* @__PURE__ */ React.createElement("div", { className: "open-month-title" }, /* @__PURE__ */ React.createElement("h3", null, MONTHS[month][0].toUpperCase() + MONTHS[month].slice(1)), /* @__PURE__ */ React.createElement("span", null, monthDays.length, " jornadas")), /* @__PURE__ */ React.createElement("div", { className: "open-day-grid" }, monthDays.map((date) => {
        const key = dateKey(date);
        const record = records[key];
        return /* @__PURE__ */ React.createElement("button", { className: `open-day-card ${record ? "already" : ""}`, key, onClick: () => onOpenDay(key) }, /* @__PURE__ */ React.createElement("span", { className: "open-card-date" }, /* @__PURE__ */ React.createElement("strong", null, String(date.getDate()).padStart(2, "0")), /* @__PURE__ */ React.createElement("small", null, WEEKDAYS[date.getDay()].slice(0, 3).toUpperCase())), /* @__PURE__ */ React.createElement("span", { className: "open-card-copy" }, /* @__PURE__ */ React.createElement("b", null, record ? "Continuar jornada" : "Abrir jornada"), /* @__PURE__ */ React.createElement("small", null, record ? `${record.closed ? "D\xEDa cerrado - puedes reabrirlo" : "Registro en curso"}` : "P\xE1gina vac\xEDa - 7 h previstas")), /* @__PURE__ */ React.createElement("span", { className: "open-card-action" }, /* @__PURE__ */ React.createElement(Icon, { name: record ? "arrow" : "plus", size: 16 })));
      })));
    })));
  }
  function RecordsPage({ records, onOpenDay }) {
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");
    const entries = Object.keys(records).filter((key) => isWorkingDay(parseDate(key))).sort().reverse().filter((key) => filter === "all" || statusOf(records[key]) === filter).filter((key) => `${key} ${records[key].notes} ${records[key].gitlab}`.toLowerCase().includes(query.toLowerCase()));
    return /* @__PURE__ */ React.createElement("div", { className: "page records-page" }, /* @__PURE__ */ React.createElement("div", { className: "list-toolbar" }, /* @__PURE__ */ React.createElement("div", { className: "search-field" }, /* @__PURE__ */ React.createElement(Icon, { name: "search", size: 16 }), /* @__PURE__ */ React.createElement("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Buscar en tus registros-" })), /* @__PURE__ */ React.createElement("div", { className: "filter-pills" }, [["all", "Todos"], ["closed", "Cerrados"], ["progress", "En curso"], ["draft", "Borradores"]].map(([value, label]) => /* @__PURE__ */ React.createElement("button", { className: filter === value ? "active" : "", key: value, onClick: () => setFilter(value) }, label)))), entries.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-panel" }, /* @__PURE__ */ React.createElement("span", { className: "blank-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: "book", size: 20 })), /* @__PURE__ */ React.createElement("h3", null, Object.keys(records).length ? "No hay coincidencias" : "Todav\xEDa no hay registros"), /* @__PURE__ */ React.createElement("p", null, "Abre un d\xEDa para empezar a construir tu historial.")) : /* @__PURE__ */ React.createElement("section", { className: "records-table" }, /* @__PURE__ */ React.createElement("div", { className: "records-head" }, /* @__PURE__ */ React.createElement("span", null, "JORNADA"), /* @__PURE__ */ React.createElement("span", null, "RESUMEN"), /* @__PURE__ */ React.createElement("span", null, "AF"), /* @__PURE__ */ React.createElement("span", null, "ESTADO"), /* @__PURE__ */ React.createElement("span", null)), entries.map((key) => {
      const record = records[key];
      return /* @__PURE__ */ React.createElement("button", { className: "record-item", key, onClick: () => onOpenDay(key) }, /* @__PURE__ */ React.createElement("span", { className: "record-date" }, /* @__PURE__ */ React.createElement("strong", null, formatShortDate(key)), /* @__PURE__ */ React.createElement("small", null, formatDate(key, { weekday: "long" }))), /* @__PURE__ */ React.createElement("span", { className: "record-summary" }, /* @__PURE__ */ React.createElement("strong", null, lines(record.notes || record.gitlab || "").slice(0, 1)[0] || "Sin descripci\xF3n"), /* @__PURE__ */ React.createElement("small", null, duration(record.start, record.end), " - actualizado recientemente")), /* @__PURE__ */ React.createElement("span", { className: "record-af" }, record.af?.length ? record.af.slice(0, 3).map((af) => /* @__PURE__ */ React.createElement("b", { key: af }, af)) : /* @__PURE__ */ React.createElement("small", null, "-")), /* @__PURE__ */ React.createElement(Badge, { status: statusOf(record) }), /* @__PURE__ */ React.createElement(Icon, { name: "chevronRight", size: 16 }));
    })));
  }
  function SummaryPage({ records }) {
    const created = Object.keys(records).filter((key) => isWorkingDay(parseDate(key)));
    const closed = created.filter((key) => records[key].closed).length;
    const afCount = (code) => created.filter((key) => records[key].af?.includes(code)).length;
    const maxAf = Math.max(1, ...AF.map(([code]) => afCount(code)));
    return /* @__PURE__ */ React.createElement("div", { className: "page summary-page" }, /* @__PURE__ */ React.createElement("div", { className: "summary-hero" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "VISI\xD3N GENERAL"), /* @__PURE__ */ React.createElement("h2", null, "Tu recorrido hasta ahora"), /* @__PURE__ */ React.createElement("p", null, "Una lectura r\xE1pida de las jornadas abiertas, las horas guardadas y las actividades formativas que has tocado.")), /* @__PURE__ */ React.createElement("div", { className: "summary-ring", style: { background: `conic-gradient(var(--violet) ${Math.round(closed / WORKING_DAYS.length * 360)}deg, #222239 0deg)` } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, Math.round(closed / WORKING_DAYS.length * 100), "%"), /* @__PURE__ */ React.createElement("span", null, "completado")))), /* @__PURE__ */ React.createElement("div", { className: "summary-metrics" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "D\xCDAS RESTANTES"), /* @__PURE__ */ React.createElement("strong", null, WORKING_DAYS.length - closed), /* @__PURE__ */ React.createElement("small", null, "de ", WORKING_DAYS.length, " laborables")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "JORNADAS CERRADAS"), /* @__PURE__ */ React.createElement("strong", null, closed), /* @__PURE__ */ React.createElement("small", null, "listas para revisi\xF3n")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "AF CON ACTIVIDAD"), /* @__PURE__ */ React.createElement("strong", null, AF.filter(([code]) => afCount(code) > 0).length), /* @__PURE__ */ React.createElement("small", null, "de ", AF.length, " \xE1reas")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "MEDIA DE AF"), /* @__PURE__ */ React.createElement("strong", null, created.length ? (created.reduce((sum, key) => sum + (records[key].af?.length || 0), 0) / created.length).toFixed(1) : "0"), /* @__PURE__ */ React.createElement("small", null, "por jornada abierta"))), /* @__PURE__ */ React.createElement("section", { className: "panel af-panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "ACTIVIDADES FORMATIVAS"), /* @__PURE__ */ React.createElement("h3", null, "Cobertura por \xE1rea")), /* @__PURE__ */ React.createElement("span", { className: "panel-meta" }, "AF8 \u2014 AF13")), /* @__PURE__ */ React.createElement("div", { className: "af-list" }, AF.map(([code, name]) => {
      const count = afCount(code);
      return /* @__PURE__ */ React.createElement("div", { className: "af-row", key: code }, /* @__PURE__ */ React.createElement("span", { className: "af-code" }, code), /* @__PURE__ */ React.createElement("div", { className: "af-info" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, name), /* @__PURE__ */ React.createElement("span", null, count, " ", count === 1 ? "jornada" : "jornadas")), /* @__PURE__ */ React.createElement("div", { className: "af-track" }, /* @__PURE__ */ React.createElement("i", { style: { width: `${count / maxAf * 100}%` } }))), /* @__PURE__ */ React.createElement("span", { className: "af-percent" }, created.length ? Math.round(count / created.length * 100) : 0, "%"));
    }))));
  }
  function DayPage({ dayKey, records, settings, onSave, onCloseDay, onDelete, onReopen, onSendSeneca, onCopy }) {
    const existing = records[dayKey];
    const draft = (record) => ({ ...defaultRecord(settings), ...record || {}, af: record?.af || [] });
    const [form, setForm] = useState(() => draft(existing));
    const isClosed = Boolean(existing?.closed);
    useEffect(() => {
      setForm(draft(records[dayKey]));
    }, [dayKey]);
    const update = (field, value) => {
      const next = { ...form, [field]: value };
      setForm(next);
      if (!isClosed && (existing || next.gitlab.trim() || next.notes.trim() || next.af.length)) onSave(dayKey, { ...next, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, true);
    };
    const save = () => onSave(dayKey, { ...form, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    return /* @__PURE__ */ React.createElement("div", { className: "page day-page" }, /* @__PURE__ */ React.createElement("div", { className: "day-header" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, WEEKDAYS[parseDate(dayKey).getDay()].toUpperCase(), " - ", duration(form.start, form.end)), /* @__PURE__ */ React.createElement("h2", null, formatDate(dayKey)), /* @__PURE__ */ React.createElement("p", null, existing ? "Contin\xFAa con las notas de esta jornada." : "Esta p\xE1gina queda reservada para tu jornada.")), /* @__PURE__ */ React.createElement("div", { className: "day-header-actions" }, existing && /* @__PURE__ */ React.createElement(Badge, { status: statusOf(existing) }), isClosed ? /* @__PURE__ */ React.createElement("button", { className: "button soft", onClick: () => onReopen(dayKey) }, /* @__PURE__ */ React.createElement(Icon, { name: "unlock", size: 16 }), " Reabrir d\xEDa") : existing ? /* @__PURE__ */ React.createElement("button", { className: "button close-day header-close", onClick: () => {
      save();
      onCloseDay(dayKey);
    } }, /* @__PURE__ */ React.createElement(Icon, { name: "lock", size: 16 }), " Cerrar d\xEDa") : /* @__PURE__ */ React.createElement("span", { className: "autosave-label" }, /* @__PURE__ */ React.createElement("i", null), " Guardado autom\xE1tico"))), isClosed && /* @__PURE__ */ React.createElement("div", { className: "closed-banner" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(Icon, { name: "lock", size: 18 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Jornada cerrada"), /* @__PURE__ */ React.createElement("p", null, "El registro est\xE1 listo. Puedes reabrirlo si necesitas corregir algo.")), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => onReopen(dayKey) }, "Editar de nuevo ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 14 }))), /* @__PURE__ */ React.createElement("div", { className: "day-layout" }, /* @__PURE__ */ React.createElement("main", { className: "day-main" }, /* @__PURE__ */ React.createElement("section", { className: "editor-card" }, /* @__PURE__ */ React.createElement("div", { className: "editor-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "editor-kicker gitlab-dot" }, "GITLAB"), /* @__PURE__ */ React.createElement("h3", null, "\xBFQu\xE9 has construido hoy?")), /* @__PURE__ */ React.createElement("span", { className: "editor-help" }, "Una tarea por l\xEDnea")), /* @__PURE__ */ React.createElement("textarea", { disabled: isClosed, value: form.gitlab, onChange: (event) => update("gitlab", event.target.value), placeholder: "Ej. Maquetaci\xF3n de la vista de seguimiento\u2026\\nPruebas y revisi\xF3n de errores\u2026" }), /* @__PURE__ */ React.createElement("div", { className: "editor-footer" }, /* @__PURE__ */ React.createElement("span", null, lines(form.gitlab).length, " tareas"), /* @__PURE__ */ React.createElement("button", { className: "copy-button", onClick: () => onCopy(`### ${formatDate(dayKey)}

${settings.studentName || "Pablo"}
${lines(form.gitlab).map((line) => `- ${line}`).join("\n")}`, "GitLab copiado") }, /* @__PURE__ */ React.createElement(Icon, { name: "copy", size: 14 }), " Copiar"))), /* @__PURE__ */ React.createElement("section", { className: "editor-card" }, /* @__PURE__ */ React.createElement("div", { className: "editor-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "editor-kicker ipasen-dot" }, "IPASEN"), /* @__PURE__ */ React.createElement("h3", null, "Resumen para la tutor\xEDa")), /* @__PURE__ */ React.createElement("span", { className: "editor-help" }, "Lo que se env\xEDa al seguimiento")), /* @__PURE__ */ React.createElement("textarea", { disabled: isClosed, value: form.notes, onChange: (event) => update("notes", event.target.value), placeholder: "Cuenta brevemente qu\xE9 has aprendido o qu\xE9 has resuelto\u2026" }), /* @__PURE__ */ React.createElement("div", { className: "editor-footer" }, /* @__PURE__ */ React.createElement("span", null, lines(form.notes).length, " l\xEDneas"), /* @__PURE__ */ React.createElement("button", { className: "copy-button", onClick: () => onCopy(lines(form.notes).map((line) => `- ${line}`).join("\n"), "Lista copiada") }, /* @__PURE__ */ React.createElement(Icon, { name: "copy", size: 14 }), " Copiar"))), /* @__PURE__ */ React.createElement("section", { className: "editor-card" }, /* @__PURE__ */ React.createElement("div", { className: "editor-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "editor-kicker violet-dot" }, "ACTIVIDADES FORMATIVAS"), /* @__PURE__ */ React.createElement("h3", null, "\xBFQu\xE9 AF has trabajado?")), /* @__PURE__ */ React.createElement("span", { className: "editor-help" }, "Puedes marcar varias")), /* @__PURE__ */ React.createElement("div", { className: "af-selector" }, AF.map(([code, name]) => {
      const active = form.af.includes(code);
      return /* @__PURE__ */ React.createElement("button", { type: "button", disabled: isClosed, className: `af-select ${active ? "active" : ""}`, key: code, onClick: () => update("af", active ? form.af.filter((item) => item !== code) : [...form.af, code]) }, /* @__PURE__ */ React.createElement("span", { className: "af-select-check" }, active ? /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 12 }) : null), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, code), /* @__PURE__ */ React.createElement("small", null, name)));
    })))), /* @__PURE__ */ React.createElement("aside", { className: "day-aside" }, /* @__PURE__ */ React.createElement("section", { className: "aside-card" }, /* @__PURE__ */ React.createElement("div", { className: "aside-title" }, /* @__PURE__ */ React.createElement(Icon, { name: "clock", size: 16 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Horario"), /* @__PURE__ */ React.createElement("small", null, "Tiempo de esta jornada"))), /* @__PURE__ */ React.createElement("div", { className: "time-fields" }, /* @__PURE__ */ React.createElement("label", null, "Entrada", /* @__PURE__ */ React.createElement("input", { disabled: isClosed, type: "time", value: form.start, onChange: (event) => update("start", event.target.value) })), /* @__PURE__ */ React.createElement("span", null, "-"), /* @__PURE__ */ React.createElement("label", null, "Salida", /* @__PURE__ */ React.createElement("input", { disabled: isClosed, type: "time", value: form.end, onChange: (event) => update("end", event.target.value) }))), /* @__PURE__ */ React.createElement("div", { className: "hours-total" }, /* @__PURE__ */ React.createElement("span", null, "Total previsto"), /* @__PURE__ */ React.createElement("strong", null, duration(form.start, form.end)))), /* @__PURE__ */ React.createElement("section", { className: "aside-card aside-actions" }, /* @__PURE__ */ React.createElement("span", { className: "autosave-status" }, /* @__PURE__ */ React.createElement("i", null), " Guardado autom\xE1tico"), existing && !isClosed && /* @__PURE__ */ React.createElement("button", { className: "button close-day full", onClick: () => {
      save();
      onCloseDay(dayKey);
    } }, /* @__PURE__ */ React.createElement(Icon, { name: "lock", size: 16 }), " Cerrar d\xEDa"), existing && /* @__PURE__ */ React.createElement("button", { className: "danger-link", onClick: () => onDelete(dayKey) }, "Eliminar registro")), existing && /* @__PURE__ */ React.createElement("button", { className: "seneca-link", onClick: () => onSendSeneca(dayKey, form) }, /* @__PURE__ */ React.createElement(Icon, { name: "external", size: 14 }), " Enviar a S\xE9neca"))));
  }
  function SettingsPage({ settings, onSaveSettings, onExport, onImport }) {
    const [form, setForm] = useState(settings);
    return /* @__PURE__ */ React.createElement("div", { className: "page settings-page" }, /* @__PURE__ */ React.createElement("div", { className: "settings-intro" }, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "PREFERENCIAS"), /* @__PURE__ */ React.createElement("h2", null, "Adapta el portal a tu ritmo"), /* @__PURE__ */ React.createElement("p", null, "Estos datos se guardan solo en este navegador.")), /* @__PURE__ */ React.createElement("section", { className: "settings-card" }, /* @__PURE__ */ React.createElement("div", { className: "settings-section" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, "Perfil"), /* @__PURE__ */ React.createElement("p", null, "C\xF3mo quieres que aparezca tu nombre en los registros.")), /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "Nombre", /* @__PURE__ */ React.createElement("input", { value: form.studentName, onChange: (event) => setForm({ ...form, studentName: event.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "settings-section" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, "Horario habitual"), /* @__PURE__ */ React.createElement("p", null, "Se usar\xE1 como valor inicial al abrir una jornada.")), /* @__PURE__ */ React.createElement("div", { className: "settings-time" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "Entrada", /* @__PURE__ */ React.createElement("input", { type: "time", value: form.defaultStart, onChange: (event) => setForm({ ...form, defaultStart: event.target.value }) })), /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "Salida", /* @__PURE__ */ React.createElement("input", { type: "time", value: form.defaultEnd, onChange: (event) => setForm({ ...form, defaultEnd: event.target.value }) })))), /* @__PURE__ */ React.createElement("div", { className: "settings-section" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, "Datos"), /* @__PURE__ */ React.createElement("p", null, "Guarda una copia o restaura tus jornadas en otro navegador.")), /* @__PURE__ */ React.createElement("div", { className: "settings-data-actions" }, /* @__PURE__ */ React.createElement("button", { className: "button soft", onClick: onExport }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 15 }), " Exportar JSON"), /* @__PURE__ */ React.createElement("label", { className: "button soft file-input" }, /* @__PURE__ */ React.createElement(Icon, { name: "upload", size: 15 }), " Importar JSON", /* @__PURE__ */ React.createElement("input", { type: "file", accept: "application/json", hidden: true, onChange: (event) => event.target.files[0] && onImport(event.target.files[0]) })))), /* @__PURE__ */ React.createElement("div", { className: "settings-save" }, /* @__PURE__ */ React.createElement("span", null, "Los cambios se aplican a los nuevos d\xEDas."), /* @__PURE__ */ React.createElement("button", { className: "button primary", onClick: () => onSaveSettings(form) }, "Guardar ajustes"))));
  }
  function AuthScreen({ vault, onUnlock }) {
    const storedUser = vault.username || "";
    const [username, setUsername] = useState(storedUser);
    const [changeUser, setChangeUser] = useState(false);
    const [digits, setDigits] = useState(["", "", "", ""]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const refs = useRef([]);
    const [longPin, setLongPin] = useState(false);
    const pin = digits.join("");
    const setDigit = (index, value) => {
      const clean = value.replace(/\D/g, "").slice(-1);
      setDigits((current) => current.map((digit, position) => position === index ? clean : digit));
      if (clean && index < digits.length - 1) refs.current[index + 1]?.focus();
    };
    const submit = async (event) => {
      event.preventDefault();
      setError("");
      if (!username.trim() || !/^\d{4,8}$/.test(pin)) {
        setError("Introduce un PIN de entre 4 y 8 d\xEDgitos.");
        return;
      }
      setBusy(true);
      try {
        if (username.trim().toLowerCase() !== String(vault.username).toLowerCase()) throw new Error("Usuario o PIN incorrecto.");
        const unlocked = await decryptVault(vault, pin);
        onUnlock({ ...unlocked, vault });
      } catch (unlockError) {
        setError(unlockError.message === "Formato de registros no v\xE1lido." ? unlockError.message : "Usuario o PIN incorrecto.");
        setDigits(Array(longPin ? 8 : 4).fill(""));
        refs.current[0]?.focus();
      } finally {
        setBusy(false);
      }
    };
    return /* @__PURE__ */ React.createElement("div", { className: "auth-gate" }, /* @__PURE__ */ React.createElement("div", { className: "auth-glow" }), /* @__PURE__ */ React.createElement("section", { className: "auth-card glass" }, /* @__PURE__ */ React.createElement("div", { className: "auth-brand" }, /* @__PURE__ */ React.createElement("div", { className: "brand-mark" }, "P", /* @__PURE__ */ React.createElement("span", null, "\u2022")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "PhoneGest"), /* @__PURE__ */ React.createElement("small", null, "pr\xE1cticas 2026"))), /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "REGISTROS PROTEGIDOS"), /* @__PURE__ */ React.createElement("h1", null, "Vuelve a tus", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("em", null, "jornadas.")), /* @__PURE__ */ React.createElement("div", { className: "auth-user-choice" }, /* @__PURE__ */ React.createElement("span", null, "Est\xE1s iniciando como ", /* @__PURE__ */ React.createElement("strong", null, "\u201C", storedUser, "\u201D")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "auth-switch", onClick: () => {
      if (changeUser) setUsername(storedUser);
      setChangeUser((value) => !value);
      setError("");
    } }, changeUser ? "Usar este usuario" : "\xBFQuieres iniciar como otro?")), /* @__PURE__ */ React.createElement("form", { onSubmit: submit }, changeUser && /* @__PURE__ */ React.createElement("label", { className: "auth-label" }, "Usuario", /* @__PURE__ */ React.createElement("input", { value: username, onChange: (event) => setUsername(event.target.value), autoComplete: "username" }), /* @__PURE__ */ React.createElement("small", null, "Este navegador contiene el acceso de ", storedUser, ".")), /* @__PURE__ */ React.createElement("div", { className: "pin-label-row" }, /* @__PURE__ */ React.createElement("span", { className: "auth-label-title" }, "Introduce tu PIN"), /* @__PURE__ */ React.createElement("small", null, longPin ? "Entre 4 y 8 d\xEDgitos" : "4 d\xEDgitos")), /* @__PURE__ */ React.createElement("div", { className: "pin-grid", onPaste: (event) => {
      const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
      if (!pasted) return;
      event.preventDefault();
      const count = pasted.length > 4 ? 8 : digits.length;
      setLongPin(count === 8);
      setDigits(Array.from({ length: count }, (_, index) => pasted[index] || ""));
      requestAnimationFrame(() => refs.current[Math.min(pasted.length, count) - 1]?.focus());
    } }, digits.map((digit, index) => /* @__PURE__ */ React.createElement("input", { key: index, ref: (element) => {
      refs.current[index] = element;
    }, className: "pin-box", type: "password", inputMode: "numeric", maxLength: "1", value: digit, "aria-label": "D\xEDgito " + (index + 1), autoFocus: index === 0, onChange: (event) => setDigit(index, event.target.value), onKeyDown: (event) => {
      if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
    } }))), /* @__PURE__ */ React.createElement("button", { type: "button", className: "auth-switch", onClick: () => {
      setLongPin(!longPin);
      setDigits((current) => Array.from({ length: longPin ? 4 : 8 }, (_, index) => current[index] || ""));
    } }, longPin ? "Mi PIN tiene 4 d\xEDgitos" : "Mi PIN tiene m\xE1s de 4 d\xEDgitos"), error && /* @__PURE__ */ React.createElement("div", { className: "auth-error", role: "alert" }, error), /* @__PURE__ */ React.createElement("button", { className: "button primary auth-submit", disabled: busy }, busy ? "Descifrando\u2026" : "Entrar al portal", " ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 16 }))), /* @__PURE__ */ React.createElement("small", { className: "auth-note" }, /* @__PURE__ */ React.createElement(Icon, { name: "lock", size: 13 }), " Tus registros se descifran solo en este navegador.")));
  }
  function ContextMenu({ menu, records, onAction, canNavigate = true }) {
    if (!menu) return null;
    if (menu.global) {
      const actions2 = [
        menu.editable && !menu.password ? ["cut", "Cortar", "copy"] : null,
        menu.hasSelection && !menu.password ? ["copy", "Copiar", "copy"] : null,
        menu.editable ? ["paste", "Pegar", "copy"] : null,
        menu.selectable && !menu.password ? ["select-all", "Seleccionar todo", "check"] : null,
        canNavigate ? ["home", "Ir a Inicio", "home"] : null,
        canNavigate ? ["calendar", "Ir al calendario", "calendar"] : null,
        ["reload", "Recargar p\xE1gina", "repeat"]
      ].filter(Boolean);
      return /* @__PURE__ */ React.createElement("div", { className: "calendar-context-menu glass", role: "menu", style: { left: menu.x, top: menu.y }, onClick: (event) => event.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "context-menu-head" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, "Acciones r\xE1pidas"), /* @__PURE__ */ React.createElement("small", null, menu.editable ? "Edici\xF3n de texto" : "Portal de pr\xE1cticas"))), /* @__PURE__ */ React.createElement("div", { className: "context-menu-items" }, actions2.map(([key, label, icon]) => /* @__PURE__ */ React.createElement("button", { key, role: "menuitem", onClick: () => onAction(key, menu) }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 15 }), /* @__PURE__ */ React.createElement("span", null, label)))));
    }
    const record = records[menu.key];
    const status = statusOf(record);
    if (!menu.workday) return /* @__PURE__ */ React.createElement("div", { className: "calendar-context-menu glass", role: "menu", style: { left: menu.x, top: menu.y }, onClick: (event) => event.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "context-menu-head" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, formatShortDate(menu.key)), /* @__PURE__ */ React.createElement("small", null, menu.reason)), /* @__PURE__ */ React.createElement("span", { className: "context-status nonwork" })), /* @__PURE__ */ React.createElement("div", { className: "context-menu-items" }, /* @__PURE__ */ React.createElement("button", { role: "menuitem", onClick: () => onAction("copy-date", menu.key) }, /* @__PURE__ */ React.createElement(Icon, { name: "calendar", size: 15 }), /* @__PURE__ */ React.createElement("span", null, "Copiar fecha"))));
    const actions = [
      { key: "open", label: record ? "Abrir p\xE1gina" : "Abrir d\xEDa", icon: "arrow" },
      record ? { key: record.closed ? "reopen" : "close", label: record.closed ? "Reabrir d\xEDa" : "Cerrar d\xEDa", icon: record.closed ? "unlock" : "lock" } : null,
      { key: "copy-date", label: "Copiar fecha", icon: "calendar" },
      record ? { key: "copy-summary", label: "Copiar resumen", icon: "copy" } : null,
      { key: "duplicate", label: "Duplicar d\xEDa anterior", icon: "repeat" },
      record ? { key: "delete", label: "Eliminar registro", icon: "trash", danger: true } : null
    ].filter(Boolean);
    return /* @__PURE__ */ React.createElement("div", { className: "calendar-context-menu glass", role: "menu", style: { left: menu.x, top: menu.y }, onClick: (event) => event.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "context-menu-head" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, formatShortDate(menu.key)), /* @__PURE__ */ React.createElement("small", null, statusLabel(status))), /* @__PURE__ */ React.createElement("span", { className: `context-status ${status}` })), /* @__PURE__ */ React.createElement("div", { className: "context-menu-items" }, actions.map((item) => /* @__PURE__ */ React.createElement("button", { key: item.key, role: "menuitem", className: item.danger ? "danger" : "", onClick: () => onAction(item.key, menu.key) }, /* @__PURE__ */ React.createElement(Icon, { name: item.icon, size: 15 }), /* @__PURE__ */ React.createElement("span", null, item.label)))));
  }
  function App() {
    const initial = useMemo(loadInitial, []);
    const [records, setRecords] = useState(initial.requiresAuth ? {} : initial.records);
    const [settings, setSettings] = useState(initial.settings);
    const [authState, setAuthState] = useState(initial.requiresAuth ? null : { mode: "local" });
    const [route, setRoute] = useState("home");
    const [selectedDay, setSelectedDay] = useState(null);
    const [month, setMonth] = useState(9);
    const [notice, setNotice] = useState("");
    const [mobileOpen, setMobileOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    useEffect(() => {
      if (!authState) return;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      if (authState.mode === "vault") persistVault(authState.vault, authState.key, records);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify({ records, settings }));
    }, [records, settings, authState]);
    useEffect(() => {
      if (!notice) return void 0;
      const timer = setTimeout(() => setNotice(""), 2600);
      return () => clearTimeout(timer);
    }, [notice]);
    useEffect(() => {
      const close = () => setContextMenu(null);
      const onKey = (event) => {
        if (event.key === "Escape") close();
      };
      const onContext = (event) => {
        event.preventDefault();
        const target = event.target;
        const editable = target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement && ["text", "search", "password", "email", "url", "tel"].includes(target.type);
        const password = editable && target.type === "password";
        const selection = editable ? target.value.slice(target.selectionStart, target.selectionEnd) : String(window.getSelection());
        setContextMenu({ global: true, target, editable: editable && !target.disabled && !target.readOnly, selectable: editable || !!selection, password, selection, hasSelection: !!selection, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 240)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 275)) });
      };
      window.addEventListener("click", close);
      window.addEventListener("resize", close);
      window.addEventListener("keydown", onKey);
      window.addEventListener("contextmenu", onContext);
      return () => {
        window.removeEventListener("click", close);
        window.removeEventListener("resize", close);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("contextmenu", onContext);
      };
    }, []);
    const handleGlobalAction = async (action, menu) => {
      setContextMenu(null);
      if (action === "reload") {
        window.location.reload();
        return;
      }
      if (action === "home" || action === "calendar") {
        if (authState) {
          setRoute(action);
          setSelectedDay(null);
        }
        return;
      }
      const target = menu.target;
      try {
        if (action === "copy" || action === "cut") {
          if (!menu.selection || !await copyText(menu.selection)) throw new Error();
          if (action === "cut") {
            target.focus();
            document.execCommand("insertText", false, "");
          }
          setNotice(action === "cut" ? "Texto cortado" : "Texto copiado");
        } else if (action === "paste") {
          const value = await navigator.clipboard.readText();
          target.focus();
          document.execCommand("insertText", false, value);
        } else if (action === "select-all") {
          if (menu.editable) {
            target.focus();
            target.select();
          } else {
            const range = document.createRange();
            range.selectNodeContents(document.querySelector(".content") || document.body);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      } catch {
        setNotice("El navegador ha bloqueado el portapapeles. Usa el teclado.");
      }
    };
    if (!authState) return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(AuthScreen, { vault: initial.vault, onUnlock: ({ records: unlockedRecords, key, vault }) => {
      setRecords(unlockedRecords);
      setAuthState({ mode: "vault", key, vault });
    } }), /* @__PURE__ */ React.createElement(ContextMenu, { menu: contextMenu, records, onAction: handleGlobalAction, canNavigate: false }), notice && /* @__PURE__ */ React.createElement("div", { className: "toast", role: "status" }, notice));
    const go = (next) => {
      setContextMenu(null);
      setRoute(next);
      setMobileOpen(false);
      if (next !== "day") setSelectedDay(null);
    };
    const openDay = (key) => {
      setContextMenu(null);
      setSelectedDay(key);
      setRoute("day");
      setMobileOpen(false);
    };
    const openToday = () => {
      const now = /* @__PURE__ */ new Date();
      if (isWorkingDay(now)) {
        openDay(dateKey(now));
        return;
      }
      const nearest = WORKING_DAYS.reduce((best, day) => Math.abs(day - now) < Math.abs(best - now) ? day : best, WORKING_DAYS[0]);
      openDay(dateKey(nearest));
    };
    const saveDay = (key, data, silent = false) => {
      setRecords((current) => ({ ...current, [key]: { ...data, createdAt: current[key]?.createdAt || (/* @__PURE__ */ new Date()).toISOString() } }));
      if (!silent) setNotice("Jornada guardada");
    };
    const closeDay = (key) => {
      setRecords((current) => ({ ...current, [key]: { ...current[key], closed: true } }));
      setNotice("D\xEDa cerrado y a\xF1adido a tu progreso");
    };
    const reopenDay = (key) => {
      setRecords((current) => ({ ...current, [key]: { ...current[key], closed: false } }));
      setNotice("D\xEDa reabierto para editarlo");
    };
    const deleteDay = (key) => {
      if (!window.confirm("\xBFEliminar este registro?")) return;
      setRecords((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      go("records");
      setNotice("Registro eliminado");
    };
    const showContextMenu = (event, key, workday = true, reason = "") => {
      const width = 232;
      const height = workday ? 310 : 150;
      setContextMenu({ key, workday, reason, x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)) });
    };
    const handleContextAction = async (action, key) => {
      if (typeof key === "object") return handleGlobalAction(action, key);
      const record = records[key];
      setContextMenu(null);
      if (action === "open") return openDay(key);
      if (action === "close" && record) return closeDay(key);
      if (action === "reopen" && record) return reopenDay(key);
      if (action === "copy-date") {
        const message = await copyText(formatDate(key, { weekday: "long", year: "numeric" }), "Fecha copiada");
        if (message) setNotice(message);
        return;
      }
      if (action === "copy-summary" && record) {
        const summary = [formatDate(key, { weekday: "long", year: "numeric" }), ...lines(record.notes || record.gitlab).map((line) => `- ${line}`)].join("\n");
        const message = await copyText(summary, "Resumen copiado");
        if (message) setNotice(message);
        return;
      }
      if (action === "duplicate") {
        const previous = previousWorkingKey(key);
        if (!previous || !records[previous]) {
          setNotice("El d\xEDa anterior no tiene contenido");
          return;
        }
        setRecords((current) => ({ ...current, [key]: { ...current[previous], closed: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() } }));
        setNotice("D\xEDa anterior duplicado");
        return;
      }
      if (action === "delete" && record) {
        if (!window.confirm("\xBFEliminar este registro?")) return;
        setRecords((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        setNotice("Registro eliminado");
      }
    };
    const sendSeneca = (key, form) => {
      window.postMessage({ source: "PhoneGestPortal", type: "SEND_SENECA", requestId: window.crypto?.randomUUID?.() || String(Date.now()), payload: { version: 1, date: key, modality: "Presencial", start: form.start, end: form.end, af: form.af, notes: lines(form.notes).map((line) => `- ${line}`).join("\n") } }, window.location.origin);
      setNotice("Registro enviado a la extensi\xF3n");
    };
    const exportData = () => {
      const blob = new Blob([JSON.stringify({ app: "PhoneGest", version: 4, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), settings, records }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "phonegest-practicas.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Copia exportada");
    };
    const importData = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          setRecords(data.records || {});
          setSettings((current) => ({ ...current, ...data.settings || {} }));
          setNotice("Datos importados");
        } catch {
          setNotice("El archivo no es v\xE1lido");
        }
      };
      reader.readAsText(file);
    };
    const activeRoute = route === "day" ? "day" : route;
    return /* @__PURE__ */ React.createElement("div", { className: `app-shell ${mobileOpen ? "mobile-open" : ""}` }, /* @__PURE__ */ React.createElement(Sidebar, { route: activeRoute, go, records, onOpenDay: openDay, onOpenToday: openToday, selectedDay, settings }), /* @__PURE__ */ React.createElement("div", { className: "main-shell glass" }, /* @__PURE__ */ React.createElement(Topbar, { route: activeRoute, selectedDay, onOpenToday: openToday, onBack: () => go("calendar"), onMenu: () => setMobileOpen((value) => !value) }), /* @__PURE__ */ React.createElement("main", { className: "content" }, route === "home" && /* @__PURE__ */ React.createElement(HomePage, { records, settings, go, onOpenDay: openDay, onOpenToday: openToday }), route === "calendar" && /* @__PURE__ */ React.createElement(CalendarPage, { records, month, setMonth, onOpenDay: openDay, onContextDay: showContextMenu }), route === "open" && /* @__PURE__ */ React.createElement(OpenDayPage, { records, onOpenDay: openDay }), route === "records" && /* @__PURE__ */ React.createElement(RecordsPage, { records, onOpenDay: openDay }), route === "summary" && /* @__PURE__ */ React.createElement(SummaryPage, { records }), route === "settings" && /* @__PURE__ */ React.createElement(SettingsPage, { settings, onSaveSettings: (next) => {
      setSettings(next);
      setNotice("Ajustes guardados");
    }, onExport: exportData, onImport: importData }), route === "day" && selectedDay && /* @__PURE__ */ React.createElement(DayPage, { dayKey: selectedDay, records, settings, onSave: saveDay, onCloseDay: closeDay, onDelete: deleteDay, onReopen: reopenDay, onSendSeneca: sendSeneca, onCopy: async (text, message) => {
      const result = await copyText(text, message);
      if (result) setNotice(result);
    } }))), /* @__PURE__ */ React.createElement(ContextMenu, { menu: contextMenu, records, onAction: handleContextAction }), notice && /* @__PURE__ */ React.createElement("div", { className: "toast" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 14 })), notice));
  }
  ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
})();
