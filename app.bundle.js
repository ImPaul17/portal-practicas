(() => {
  const { useEffect, useMemo, useState } = React;
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
    return { gitlab: "", notes: "", af: [], tags: [], start: settings.defaultStart, end: settings.defaultEnd, closed: false };
  }
  function statusOf(record) {
    if (!record) return "empty";
    if (record.closed) return "closed";
    const hasContent = Boolean((record.gitlab || "").trim() || (record.notes || "").trim() || record.af?.length || record.tags?.length);
    return hasContent ? "progress" : "draft";
  }
  function statusLabel(status) {
    return { empty: "Sin abrir", draft: "Borrador", progress: "En curso", closed: "Cerrado" }[status] || "Sin abrir";
  }
  function loadInitial() {
    const fallback = { records: {}, settings: { studentName: "Pablo", defaultStart: "09:00", defaultEnd: "16:00" } };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.records) return { ...fallback, ...saved, settings: { ...fallback.settings, ...saved.settings || {} } };
      const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
      if (old && typeof old === "object") {
        const records = Object.fromEntries(Object.entries(old).map(([key, value]) => [key, {
          gitlab: value.gitlab || "",
          notes: value.ipasen || "",
          af: value.af || [],
          tags: value.labels || [],
          start: value.start || "09:00",
          end: value.end || "16:00",
          closed: false
        }]));
        return { ...fallback, records };
      }
    } catch (error) {
      console.warn("No se pudo restaurar el estado local", error);
    }
    return fallback;
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
      close: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "m6 6 12 12M18 6 6 18" })),
      menu: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M4 7h16M4 12h16M4 17h16" })),
      external: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M14 4h6v6M20 4l-9 9" }), /* @__PURE__ */ React.createElement("path", { d: "M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" }))
    };
    return /* @__PURE__ */ React.createElement("svg", { className: "icon", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, paths[name] || paths.home);
  }
  function Badge({ status }) {
    return /* @__PURE__ */ React.createElement("span", { className: `status-badge ${status}` }, /* @__PURE__ */ React.createElement("i", null), statusLabel(status));
  }
  function Sidebar({ route, go, records, onOpenDay, settings }) {
    const createdDays = Object.keys(records).filter((key) => isWorkingDay(parseDate(key))).sort().reverse();
    const closed = createdDays.filter((key) => records[key].closed).length;
    return /* @__PURE__ */ React.createElement("aside", { className: "sidebar" }, /* @__PURE__ */ React.createElement("div", { className: "brand" }, /* @__PURE__ */ React.createElement("div", { className: "brand-mark" }, "P", /* @__PURE__ */ React.createElement("span", null, "\u2022")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "PhoneGest"), /* @__PURE__ */ React.createElement("small", null, "pr\xE1cticas 2026"))), /* @__PURE__ */ React.createElement("div", { className: "profile-card" }, /* @__PURE__ */ React.createElement("div", { className: "avatar" }, (settings.studentName || "P").slice(0, 1).toUpperCase()), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, settings.studentName || "Pablo"), /* @__PURE__ */ React.createElement("small", null, "En formaci\xF3n")), /* @__PURE__ */ React.createElement("span", { className: "live-dot" })), /* @__PURE__ */ React.createElement("nav", { className: "side-nav", "aria-label": "Navegaci\xF3n principal" }, /* @__PURE__ */ React.createElement("p", { className: "nav-caption" }, "ESPACIO DE TRABAJO"), /* @__PURE__ */ React.createElement("button", { className: `nav-item ${route === "home" ? "active" : ""}`, onClick: () => go("home") }, /* @__PURE__ */ React.createElement(Icon, { name: "home" }), /* @__PURE__ */ React.createElement("span", null, "Inicio")), /* @__PURE__ */ React.createElement("button", { className: `nav-item ${route === "calendar" ? "active" : ""}`, onClick: () => go("calendar") }, /* @__PURE__ */ React.createElement(Icon, { name: "calendar" }), /* @__PURE__ */ React.createElement("span", null, "Calendario"), /* @__PURE__ */ React.createElement("em", null, WORKING_DAYS.length)), /* @__PURE__ */ React.createElement("button", { className: `nav-item ${route === "records" ? "active" : ""}`, onClick: () => go("records") }, /* @__PURE__ */ React.createElement(Icon, { name: "book" }), /* @__PURE__ */ React.createElement("span", null, "Registros"), /* @__PURE__ */ React.createElement("em", null, createdDays.length)), /* @__PURE__ */ React.createElement("button", { className: `nav-item ${route === "summary" ? "active" : ""}`, onClick: () => go("summary") }, /* @__PURE__ */ React.createElement(Icon, { name: "chart" }), /* @__PURE__ */ React.createElement("span", null, "Resumen")), /* @__PURE__ */ React.createElement("p", { className: "nav-caption created-caption" }, "D\xCDAS ABIERTOS ", /* @__PURE__ */ React.createElement("span", null, createdDays.length)), /* @__PURE__ */ React.createElement("button", { className: `open-day-nav ${route === "open" ? "selected" : ""}`, onClick: () => go("open") }, /* @__PURE__ */ React.createElement("span", { className: "open-day-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 15 })), /* @__PURE__ */ React.createElement("span", null, "Abrir d\xEDa"), /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 15 })), /* @__PURE__ */ React.createElement("div", { className: "created-days" }, createdDays.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "empty-days" }, /* @__PURE__ */ React.createElement("span", null, "-"), /* @__PURE__ */ React.createElement("p", null, "Aqu\xED aparecer\xE1n tus d\xEDas", /* @__PURE__ */ React.createElement("br", null), "cuando abras el primero.")) : createdDays.slice(0, 8).map((key) => /* @__PURE__ */ React.createElement("button", { key, className: "created-day", onClick: () => onOpenDay(key) }, /* @__PURE__ */ React.createElement("span", { className: `day-dot ${statusOf(records[key])}` }), /* @__PURE__ */ React.createElement("span", null, formatShortDate(key)), /* @__PURE__ */ React.createElement("small", null, records[key].closed ? "cerrado" : "abierto"))), createdDays.length > 8 && /* @__PURE__ */ React.createElement("button", { className: "more-days", onClick: () => go("records") }, "Ver todos ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 13 })))), /* @__PURE__ */ React.createElement("div", { className: "sidebar-bottom" }, /* @__PURE__ */ React.createElement("div", { className: "side-progress" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", null, "PROGRESO"), /* @__PURE__ */ React.createElement("b", null, closed, "/", WORKING_DAYS.length)), /* @__PURE__ */ React.createElement("div", { className: "progress-track" }, /* @__PURE__ */ React.createElement("i", { style: { width: `${Math.round(closed / WORKING_DAYS.length * 100)}%` } })), /* @__PURE__ */ React.createElement("small", null, WORKING_DAYS.length - closed, " d\xEDas restantes")), /* @__PURE__ */ React.createElement("button", { className: `nav-item ${route === "settings" ? "active" : ""}`, onClick: () => go("settings") }, /* @__PURE__ */ React.createElement(Icon, { name: "settings" }), /* @__PURE__ */ React.createElement("span", null, "Ajustes"))));
  }
  function Topbar({ route, selectedDay, onOpenDay, onBack, onMenu }) {
    const titles = { home: ["PANEL DE CONTROL", "Inicio"], calendar: ["PLANIFICACI\xD3N", "Calendario"], records: ["HISTORIAL", "Registros"], summary: ["SEGUIMIENTO", "Resumen"], open: ["NUEVA JORNADA", "Abrir d\xEDa"], settings: ["PREFERENCIAS", "Ajustes"] };
    const title = selectedDay && route === "day" ? ["JORNADA", formatDate(selectedDay)] : titles[route] || ["JORNADA", "Detalle del d\xEDa"];
    return /* @__PURE__ */ React.createElement("header", { className: "topbar" }, /* @__PURE__ */ React.createElement("div", { className: "topbar-left" }, /* @__PURE__ */ React.createElement("button", { className: "mobile-menu", onClick: onMenu, "aria-label": "Abrir men\xFA" }, /* @__PURE__ */ React.createElement(Icon, { name: "menu" })), route === "day" && /* @__PURE__ */ React.createElement("button", { className: "back-button", onClick: onBack }, /* @__PURE__ */ React.createElement(Icon, { name: "chevronLeft", size: 16 }), " Volver"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, title[0]), /* @__PURE__ */ React.createElement("h1", null, title[1]))), /* @__PURE__ */ React.createElement("div", { className: "topbar-actions" }, /* @__PURE__ */ React.createElement("span", { className: "status-chip" }, /* @__PURE__ */ React.createElement("i", null), " Guardado local"), route !== "day" && route !== "open" && /* @__PURE__ */ React.createElement("button", { className: "button primary compact", onClick: onOpenDay }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 16 }), " Abrir d\xEDa")));
  }
  function StatCard({ icon, label, value, hint, tone = "mint" }) {
    return /* @__PURE__ */ React.createElement("article", { className: `stat-card ${tone}` }, /* @__PURE__ */ React.createElement("div", { className: "stat-top" }, /* @__PURE__ */ React.createElement("span", { className: "stat-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 17 })), /* @__PURE__ */ React.createElement("span", null, label)), /* @__PURE__ */ React.createElement("strong", null, value), /* @__PURE__ */ React.createElement("small", null, hint));
  }
  function HomePage({ records, settings, go, onOpenDay }) {
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
    return /* @__PURE__ */ React.createElement("div", { className: "page home-page" }, /* @__PURE__ */ React.createElement("section", { className: "hero-card" }, /* @__PURE__ */ React.createElement("div", { className: "hero-copy" }, /* @__PURE__ */ React.createElement("span", { className: "kicker" }, "\u2600 Buenos d\xEDas, ", settings.studentName || "Pablo"), /* @__PURE__ */ React.createElement("h2", null, "Tu pr\xE1ctica,", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("em", null, "en orden.")), /* @__PURE__ */ React.createElement("p", null, "Registra lo que haces cada jornada, cierra los d\xEDas terminados y mant\xE9n todo listo para tu seguimiento."), /* @__PURE__ */ React.createElement("div", { className: "hero-actions" }, /* @__PURE__ */ React.createElement("button", { className: "button primary", onClick: () => onOpenDay(nextKey) }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 17 }), " Abrir pr\xF3ximo d\xEDa"), /* @__PURE__ */ React.createElement("button", { className: "button ghost", onClick: () => go("calendar") }, "Ver calendario ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 16 })))), /* @__PURE__ */ React.createElement("div", { className: "hero-orbit" }, /* @__PURE__ */ React.createElement("div", { className: "orbit-ring ring-one" }), /* @__PURE__ */ React.createElement("div", { className: "orbit-ring ring-two" }), /* @__PURE__ */ React.createElement("div", { className: "orbit-core" }, /* @__PURE__ */ React.createElement("span", null, Math.round(closed / WORKING_DAYS.length * 100), "%"), /* @__PURE__ */ React.createElement("small", null, "completado")), /* @__PURE__ */ React.createElement("div", { className: "orbit-label" }, /* @__PURE__ */ React.createElement(Icon, { name: "calendar", size: 14 }), " 05 OCT - 18 DIC"))), /* @__PURE__ */ React.createElement("div", { className: "stat-grid" }, /* @__PURE__ */ React.createElement(StatCard, { icon: "calendar", label: "D\xCDAS ABIERTOS", value: created.length, hint: `${WORKING_DAYS.length - created.length} por abrir` }), /* @__PURE__ */ React.createElement(StatCard, { icon: "check", label: "D\xCDAS CERRADOS", value: closed, hint: `${closed ? Math.round(closed / WORKING_DAYS.length * 100) : 0}% del periodo`, tone: "blue" }), /* @__PURE__ */ React.createElement(StatCard, { icon: "clock", label: "HORAS REGISTRADAS", value: `${hours} h`, hint: "En jornadas guardadas", tone: "amber" }), /* @__PURE__ */ React.createElement(StatCard, { icon: "chart", label: "AF COMPLETADAS", value: `${afDone}/${AF.length}`, hint: "\xE1reas formativas", tone: "violet" })), /* @__PURE__ */ React.createElement("div", { className: "home-columns" }, /* @__PURE__ */ React.createElement("section", { className: "panel next-panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "SIGUIENTE PASO"), /* @__PURE__ */ React.createElement("h3", null, "Contin\xFAa con tu jornada")), /* @__PURE__ */ React.createElement("span", { className: "date-pill" }, formatShortDate(nextKey))), /* @__PURE__ */ React.createElement("div", { className: "next-day" }, /* @__PURE__ */ React.createElement("div", { className: "next-date" }, /* @__PURE__ */ React.createElement("span", null, WEEKDAYS[next.getDay()].slice(0, 3).toUpperCase()), /* @__PURE__ */ React.createElement("strong", null, String(next.getDate()).padStart(2, "0")), /* @__PURE__ */ React.createElement("small", null, MONTHS[next.getMonth()].slice(0, 3).toUpperCase())), /* @__PURE__ */ React.createElement("div", { className: "next-info" }, /* @__PURE__ */ React.createElement("h4", null, records[nextKey] ? "Revisar y completar registro" : "A\xFAn no has abierto este d\xEDa"), /* @__PURE__ */ React.createElement("p", null, records[nextKey] ? "Tienes un registro en curso. A\xF1ade las actividades que faltan." : "Empieza una p\xE1gina nueva para anotar tus tareas y AF."), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => onOpenDay(nextKey) }, records[nextKey] ? "Continuar registro" : "Abrir jornada", " ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 14 }))))), /* @__PURE__ */ React.createElement("section", { className: "panel pulse-panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "RITMO DE TRABAJO"), /* @__PURE__ */ React.createElement("h3", null, "\xDAltimos d\xEDas")), /* @__PURE__ */ React.createElement("button", { className: "icon-link", onClick: () => go("records") }, /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 16 }))), /* @__PURE__ */ React.createElement("div", { className: "week-bars" }, WORKING_DAYS.slice(-7).map((day) => {
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
  function CalendarPage({ records, month, setMonth, onOpenDay }) {
    const cells = monthCells(month);
    const monthName = `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} 2026`;
    return /* @__PURE__ */ React.createElement("div", { className: "page calendar-page" }, /* @__PURE__ */ React.createElement("div", { className: "calendar-toolbar" }, /* @__PURE__ */ React.createElement("p", { className: "page-intro" }, "Planifica, abre y revisa cada jornada."), /* @__PURE__ */ React.createElement("div", { className: "month-switch" }, /* @__PURE__ */ React.createElement("button", { className: "round-button", disabled: month <= 9, onClick: () => setMonth((value) => value - 1) }, /* @__PURE__ */ React.createElement(Icon, { name: "chevronLeft", size: 16 })), /* @__PURE__ */ React.createElement("strong", null, monthName), /* @__PURE__ */ React.createElement("button", { className: "round-button", disabled: month >= 11, onClick: () => setMonth((value) => value + 1) }, /* @__PURE__ */ React.createElement(Icon, { name: "chevronRight", size: 16 })))), /* @__PURE__ */ React.createElement("section", { className: "calendar-panel" }, /* @__PURE__ */ React.createElement("div", { className: "calendar-week" }, /* @__PURE__ */ React.createElement("span", null, "LUN"), /* @__PURE__ */ React.createElement("span", null, "MAR"), /* @__PURE__ */ React.createElement("span", null, "MI\xC9"), /* @__PURE__ */ React.createElement("span", null, "JUE"), /* @__PURE__ */ React.createElement("span", null, "VIE"), /* @__PURE__ */ React.createElement("span", null, "S\xC1B"), /* @__PURE__ */ React.createElement("span", null, "DOM")), /* @__PURE__ */ React.createElement("div", { className: "calendar-grid" }, cells.map((date, index) => {
      if (!date) return /* @__PURE__ */ React.createElement("div", { className: "calendar-cell blank", key: `blank-${index}` });
      const key = dateKey(date);
      const record = records[key];
      const status = statusOf(record);
      const workday = isWorkingDay(date);
      return /* @__PURE__ */ React.createElement("button", { key, className: `calendar-cell ${workday ? "workday" : "nonwork"} ${record ? "created" : ""}`, disabled: !workday, onClick: () => workday && onOpenDay(key) }, /* @__PURE__ */ React.createElement("div", { className: "cell-header" }, /* @__PURE__ */ React.createElement("span", { className: "cell-number" }, date.getDate()), record && /* @__PURE__ */ React.createElement("span", { className: `cell-status ${status}` }, /* @__PURE__ */ React.createElement("i", null))), !workday ? /* @__PURE__ */ React.createElement("span", { className: "cell-note" }, HOLIDAYS[key] || (date.getDay() === 0 || date.getDay() === 6 ? "Fin de semana" : "")) : record ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "cell-status-label" }, statusLabel(status)), /* @__PURE__ */ React.createElement("span", { className: "cell-tags" }, record.af?.slice(0, 2).map((af) => /* @__PURE__ */ React.createElement("b", { key: af }, af)))) : /* @__PURE__ */ React.createElement("span", { className: "cell-note open-hint" }, "Abrir d\xEDa ", /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 12 })));
    }))), /* @__PURE__ */ React.createElement("div", { className: "calendar-legend" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot closed" }), " Cerrado"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot active" }), " En curso"), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("i", { className: "legend-dot empty" }), " Disponible"), /* @__PURE__ */ React.createElement("span", { className: "legend-note" }, "Haz clic en cualquier d\xEDa laborable para abrir su p\xE1gina")));
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
  function DayPage({ dayKey, records, settings, onSave, onCloseDay, onDelete, onReopen, onSendSeneca }) {
    const existing = records[dayKey];
    const draft = (record) => ({ ...defaultRecord(settings), ...record || {}, af: record?.af || [], tags: record?.tags || [] });
    const [form, setForm] = useState(() => draft(existing));
    const [tagInput, setTagInput] = useState("");
    const isClosed = Boolean(existing?.closed);
    useEffect(() => {
      setForm(draft(records[dayKey]));
    }, [dayKey]);
    const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
    const addTag = (event) => {
      if (event.key !== "Enter" && event.key !== ",") return;
      event.preventDefault();
      const clean = tagInput.trim().replace(/^#/, "");
      if (clean && !form.tags.includes(clean)) update("tags", [...form.tags, clean]);
      setTagInput("");
    };
    const save = () => onSave(dayKey, { ...form, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    return /* @__PURE__ */ React.createElement("div", { className: "page day-page" }, /* @__PURE__ */ React.createElement("div", { className: "day-header" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, WEEKDAYS[parseDate(dayKey).getDay()].toUpperCase(), " - ", duration(form.start, form.end)), /* @__PURE__ */ React.createElement("h2", null, formatDate(dayKey)), /* @__PURE__ */ React.createElement("p", null, existing ? "Contin\xFAa con las notas de esta jornada." : "Esta p\xE1gina queda reservada para tu jornada.")), /* @__PURE__ */ React.createElement("div", { className: "day-header-actions" }, existing && /* @__PURE__ */ React.createElement(Badge, { status: statusOf(existing) }), isClosed ? /* @__PURE__ */ React.createElement("button", { className: "button soft", onClick: () => onReopen(dayKey) }, /* @__PURE__ */ React.createElement(Icon, { name: "unlock", size: 16 }), " Reabrir d\xEDa") : /* @__PURE__ */ React.createElement("button", { className: "button primary", onClick: save }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 16 }), " Guardar d\xEDa"))), isClosed && /* @__PURE__ */ React.createElement("div", { className: "closed-banner" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(Icon, { name: "lock", size: 18 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Jornada cerrada"), /* @__PURE__ */ React.createElement("p", null, "El registro est\xE1 listo. Puedes reabrirlo si necesitas corregir algo.")), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => onReopen(dayKey) }, "Editar de nuevo ", /* @__PURE__ */ React.createElement(Icon, { name: "arrow", size: 14 }))), /* @__PURE__ */ React.createElement("div", { className: "day-layout" }, /* @__PURE__ */ React.createElement("main", { className: "day-main" }, /* @__PURE__ */ React.createElement("section", { className: "editor-card" }, /* @__PURE__ */ React.createElement("div", { className: "editor-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "editor-kicker gitlab-dot" }, "GITLAB"), /* @__PURE__ */ React.createElement("h3", null, "\xBFQu\xE9 has construido hoy?")), /* @__PURE__ */ React.createElement("span", { className: "editor-help" }, "Una tarea por l\xEDnea")), /* @__PURE__ */ React.createElement("textarea", { disabled: isClosed, value: form.gitlab, onChange: (event) => update("gitlab", event.target.value), placeholder: "Ej. Maquetaci\xF3n de la vista de seguimiento\u2026\\nPruebas y revisi\xF3n de errores\u2026" }), /* @__PURE__ */ React.createElement("div", { className: "editor-footer" }, /* @__PURE__ */ React.createElement("span", null, lines(form.gitlab).length, " tareas"), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => navigator.clipboard?.writeText(`### ${formatDate(dayKey)}

${settings.studentName || "Pablo"}
${lines(form.gitlab).map((line) => `- ${line}`).join("\n")}`) }, "Copiar formato ", /* @__PURE__ */ React.createElement(Icon, { name: "external", size: 13 })))), /* @__PURE__ */ React.createElement("section", { className: "editor-card" }, /* @__PURE__ */ React.createElement("div", { className: "editor-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "editor-kicker ipasen-dot" }, "IPASEN"), /* @__PURE__ */ React.createElement("h3", null, "Resumen para la tutor\xEDa")), /* @__PURE__ */ React.createElement("span", { className: "editor-help" }, "Lo que se env\xEDa al seguimiento")), /* @__PURE__ */ React.createElement("textarea", { disabled: isClosed, value: form.notes, onChange: (event) => update("notes", event.target.value), placeholder: "Cuenta brevemente qu\xE9 has aprendido o qu\xE9 has resuelto\u2026" }), /* @__PURE__ */ React.createElement("div", { className: "editor-footer" }, /* @__PURE__ */ React.createElement("span", null, lines(form.notes).length, " l\xEDneas"), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => navigator.clipboard?.writeText(lines(form.notes).map((line) => `- ${line}`).join("\n")) }, "Copiar lista ", /* @__PURE__ */ React.createElement(Icon, { name: "external", size: 13 })))), /* @__PURE__ */ React.createElement("section", { className: "editor-card" }, /* @__PURE__ */ React.createElement("div", { className: "editor-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "editor-kicker violet-dot" }, "ACTIVIDADES FORMATIVAS"), /* @__PURE__ */ React.createElement("h3", null, "\xBFQu\xE9 AF has trabajado?")), /* @__PURE__ */ React.createElement("span", { className: "editor-help" }, "Puedes marcar varias")), /* @__PURE__ */ React.createElement("div", { className: "af-selector" }, AF.map(([code, name]) => {
      const active = form.af.includes(code);
      return /* @__PURE__ */ React.createElement("button", { type: "button", disabled: isClosed, className: `af-select ${active ? "active" : ""}`, key: code, onClick: () => update("af", active ? form.af.filter((item) => item !== code) : [...form.af, code]) }, /* @__PURE__ */ React.createElement("span", { className: "af-select-check" }, active ? /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 12 }) : null), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, code), /* @__PURE__ */ React.createElement("small", null, name)));
    })))), /* @__PURE__ */ React.createElement("aside", { className: "day-aside" }, /* @__PURE__ */ React.createElement("section", { className: "aside-card" }, /* @__PURE__ */ React.createElement("div", { className: "aside-title" }, /* @__PURE__ */ React.createElement(Icon, { name: "clock", size: 16 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Horario"), /* @__PURE__ */ React.createElement("small", null, "Tiempo de esta jornada"))), /* @__PURE__ */ React.createElement("div", { className: "time-fields" }, /* @__PURE__ */ React.createElement("label", null, "Entrada", /* @__PURE__ */ React.createElement("input", { disabled: isClosed, type: "time", value: form.start, onChange: (event) => update("start", event.target.value) })), /* @__PURE__ */ React.createElement("span", null, "-"), /* @__PURE__ */ React.createElement("label", null, "Salida", /* @__PURE__ */ React.createElement("input", { disabled: isClosed, type: "time", value: form.end, onChange: (event) => update("end", event.target.value) }))), /* @__PURE__ */ React.createElement("div", { className: "hours-total" }, /* @__PURE__ */ React.createElement("span", null, "Total previsto"), /* @__PURE__ */ React.createElement("strong", null, duration(form.start, form.end)))), /* @__PURE__ */ React.createElement("section", { className: "aside-card" }, /* @__PURE__ */ React.createElement("div", { className: "aside-title" }, /* @__PURE__ */ React.createElement(Icon, { name: "tag", size: 16 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Etiquetas"), /* @__PURE__ */ React.createElement("small", null, "Para encontrar este d\xEDa"))), /* @__PURE__ */ React.createElement("div", { className: "tag-editor" }, /* @__PURE__ */ React.createElement("div", { className: "tag-chips" }, form.tags.map((tag) => /* @__PURE__ */ React.createElement("span", { key: tag }, "#", tag, /* @__PURE__ */ React.createElement("button", { disabled: isClosed, onClick: () => update("tags", form.tags.filter((item) => item !== tag)) }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 12 }))))), /* @__PURE__ */ React.createElement("input", { disabled: isClosed, value: tagInput, onChange: (event) => setTagInput(event.target.value), onKeyDown: addTag, placeholder: "A\xF1adir etiqueta-" }))), /* @__PURE__ */ React.createElement("section", { className: "aside-card aside-actions" }, /* @__PURE__ */ React.createElement("button", { className: "button soft full", onClick: save, disabled: isClosed }, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 16 }), " Guardar cambios"), existing && !isClosed && /* @__PURE__ */ React.createElement("button", { className: "button close-day full", onClick: () => {
      save();
      onCloseDay(dayKey);
    } }, /* @__PURE__ */ React.createElement(Icon, { name: "lock", size: 16 }), " Cerrar d\xEDa"), existing && /* @__PURE__ */ React.createElement("button", { className: "danger-link", onClick: () => onDelete(dayKey) }, "Eliminar registro")), existing && /* @__PURE__ */ React.createElement("button", { className: "seneca-link", onClick: () => onSendSeneca(dayKey, form) }, /* @__PURE__ */ React.createElement(Icon, { name: "external", size: 14 }), " Enviar a S\xE9neca"))));
  }
  function SettingsPage({ settings, onSaveSettings, onExport, onImport }) {
    const [form, setForm] = useState(settings);
    return /* @__PURE__ */ React.createElement("div", { className: "page settings-page" }, /* @__PURE__ */ React.createElement("div", { className: "settings-intro" }, /* @__PURE__ */ React.createElement("span", { className: "section-label" }, "PREFERENCIAS"), /* @__PURE__ */ React.createElement("h2", null, "Adapta el portal a tu ritmo"), /* @__PURE__ */ React.createElement("p", null, "Estos datos se guardan solo en este navegador.")), /* @__PURE__ */ React.createElement("section", { className: "settings-card" }, /* @__PURE__ */ React.createElement("div", { className: "settings-section" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, "Perfil"), /* @__PURE__ */ React.createElement("p", null, "C\xF3mo quieres que aparezca tu nombre en los registros.")), /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "Nombre", /* @__PURE__ */ React.createElement("input", { value: form.studentName, onChange: (event) => setForm({ ...form, studentName: event.target.value }) }))), /* @__PURE__ */ React.createElement("div", { className: "settings-section" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, "Horario habitual"), /* @__PURE__ */ React.createElement("p", null, "Se usar\xE1 como valor inicial al abrir una jornada.")), /* @__PURE__ */ React.createElement("div", { className: "settings-time" }, /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "Entrada", /* @__PURE__ */ React.createElement("input", { type: "time", value: form.defaultStart, onChange: (event) => setForm({ ...form, defaultStart: event.target.value }) })), /* @__PURE__ */ React.createElement("label", { className: "field-label" }, "Salida", /* @__PURE__ */ React.createElement("input", { type: "time", value: form.defaultEnd, onChange: (event) => setForm({ ...form, defaultEnd: event.target.value }) })))), /* @__PURE__ */ React.createElement("div", { className: "settings-section" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, "Datos"), /* @__PURE__ */ React.createElement("p", null, "Guarda una copia o restaura tus jornadas en otro navegador.")), /* @__PURE__ */ React.createElement("div", { className: "settings-data-actions" }, /* @__PURE__ */ React.createElement("button", { className: "button soft", onClick: onExport }, /* @__PURE__ */ React.createElement(Icon, { name: "download", size: 15 }), " Exportar JSON"), /* @__PURE__ */ React.createElement("label", { className: "button soft file-input" }, /* @__PURE__ */ React.createElement(Icon, { name: "upload", size: 15 }), " Importar JSON", /* @__PURE__ */ React.createElement("input", { type: "file", accept: "application/json", hidden: true, onChange: (event) => event.target.files[0] && onImport(event.target.files[0]) })))), /* @__PURE__ */ React.createElement("div", { className: "settings-save" }, /* @__PURE__ */ React.createElement("span", null, "Los cambios se aplican a los nuevos d\xEDas."), /* @__PURE__ */ React.createElement("button", { className: "button primary", onClick: () => onSaveSettings(form) }, "Guardar ajustes"))));
  }
  function App() {
    const initial = useMemo(loadInitial, []);
    const [records, setRecords] = useState(initial.records);
    const [settings, setSettings] = useState(initial.settings);
    const [route, setRoute] = useState("home");
    const [selectedDay, setSelectedDay] = useState(null);
    const [month, setMonth] = useState(9);
    const [notice, setNotice] = useState("");
    const [mobileOpen, setMobileOpen] = useState(false);
    useEffect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ records, settings }));
    }, [records, settings]);
    useEffect(() => {
      if (!notice) return void 0;
      const timer = setTimeout(() => setNotice(""), 2600);
      return () => clearTimeout(timer);
    }, [notice]);
    const go = (next) => {
      setRoute(next);
      setMobileOpen(false);
      if (next !== "day") setSelectedDay(null);
    };
    const openDay = (key) => {
      setSelectedDay(key);
      setRoute("day");
      setMobileOpen(false);
    };
    const saveDay = (key, data) => {
      setRecords((current) => ({ ...current, [key]: { ...data, createdAt: current[key]?.createdAt || (/* @__PURE__ */ new Date()).toISOString() } }));
      setNotice("Jornada guardada");
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
    return /* @__PURE__ */ React.createElement("div", { className: `app-shell ${mobileOpen ? "mobile-open" : ""}` }, /* @__PURE__ */ React.createElement(Sidebar, { route: activeRoute, go, records, onOpenDay: openDay, settings }), /* @__PURE__ */ React.createElement("div", { className: "main-shell" }, /* @__PURE__ */ React.createElement(Topbar, { route: activeRoute, selectedDay, onOpenDay: () => go("open"), onBack: () => go("records"), onMenu: () => setMobileOpen((value) => !value) }), /* @__PURE__ */ React.createElement("main", { className: "content" }, route === "home" && /* @__PURE__ */ React.createElement(HomePage, { records, settings, go, onOpenDay: openDay }), route === "calendar" && /* @__PURE__ */ React.createElement(CalendarPage, { records, month, setMonth, onOpenDay: openDay }), route === "open" && /* @__PURE__ */ React.createElement(OpenDayPage, { records, onOpenDay: openDay }), route === "records" && /* @__PURE__ */ React.createElement(RecordsPage, { records, onOpenDay: openDay }), route === "summary" && /* @__PURE__ */ React.createElement(SummaryPage, { records }), route === "settings" && /* @__PURE__ */ React.createElement(SettingsPage, { settings, onSaveSettings: (next) => {
      setSettings(next);
      setNotice("Ajustes guardados");
    }, onExport: exportData, onImport: importData }), route === "day" && selectedDay && /* @__PURE__ */ React.createElement(DayPage, { dayKey: selectedDay, records, settings, onSave: saveDay, onCloseDay: closeDay, onDelete: deleteDay, onReopen: reopenDay, onSendSeneca: sendSeneca }))), notice && /* @__PURE__ */ React.createElement("div", { className: "toast" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(Icon, { name: "check", size: 14 })), notice));
  }
  ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
})();
