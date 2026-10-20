/* Se ejecuta al pulsar Rellenar en la extensión, únicamente en Séneca.
   NO pulsa Guardar ni envía el formulario. */
function fillSeneca(p) {
  const visible = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const normalize = s => (s || '').replace(/\s+/g, ' ').trim();
  const text = document.body?.innerText || '';
  if (!/Anotaciones sobre la jornada por parte del alumnado/i.test(text) ||
      !/Actividades realizadas|Registro de actividades según el alumnado/i.test(text)) {
    return { status:'skip', reason:'Este marco no contiene el formulario de actividad diaria.' };
  }

  const [yyyy,mm,dd] = p.date.split('-');
  const wantedDate = dd + '/' + mm + '/' + yyyy;
  const header = text.match(/(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*[-–]\s*(\d{1,2}\/\d{1,2}\/20\d\d)\s*[-–]/i);
  if (!header) {
    return {status:'blocked',reason:'No se pudo confirmar la fecha de la jornada. Abre el detalle del día correspondiente y vuelve a intentarlo.'};
  }
  const currentDate = header[1].split('/').map(Number).join('/');
  if (currentDate !== [Number(dd),Number(mm),Number(yyyy)].join('/')) {
    return {status:'blocked',reason:'Fecha distinta: el portal indica ' + wantedDate + ' y Séneca muestra ' + header[1] + '. Selecciona el mismo día.'};
  }

  const done = [];
  const warnings = [];
  const inputs = () => [...document.querySelectorAll('input')].filter(visible);

  // Presencial: asociar el radio a su texto, sin tocar Teletrabajo.
  let presencial = null;
  for (const label of document.querySelectorAll('label')) {
    if (!/^presencial$/i.test(normalize(label.textContent))) continue;
    const byFor = label.htmlFor && document.getElementById(label.htmlFor);
    const radio = label.querySelector('input[type=radio]') ||
      (byFor?.matches?.('input[type=radio]') ? byFor : null) ||
      label.parentElement?.querySelector('input[type=radio]');
    if (radio) { presencial=radio; break; }
  }
  if (!presencial) {
    const candidate = inputs().filter(input => input.type==='radio' &&
      /presencial/i.test([input.value,input.id,input.name,input.getAttribute('aria-label')].join(' ')));
    if (candidate.length === 1) presencial = candidate[0];
  }
  if (presencial) {
    if (!presencial.checked) presencial.click();
    if (presencial.checked) done.push('Presencial'); else warnings.push('No se pudo seleccionar Presencial');
  } else warnings.push('No se identificó la opción Presencial');

  // Horas: buscar por id/nombre primero, por etiqueta después y finalmente por placeholder.
  function timeInput(which) {
    const ends = which === 'start' ? '(inicio|entrada)' : '(fin|salida|final)';
    const re = new RegExp('(?:hora|time).*' + ends + '|' + ends + '.*(?:hora|time)', 'i');
    const options = inputs().filter(input => !['radio','checkbox','hidden','submit','button'].includes(input.type));
    const named = options.filter(input => re.test([input.name,input.id,input.getAttribute('aria-label')].join(' ')));
    if (named.length === 1) return named[0];
    const target = which === 'start' ? /^hora\s+de\s+inicio\s*:?$/i : /^hora\s+de\s+fin\s*:?$/i;
    const labels = [...document.querySelectorAll('label,span,div,th,td,strong')]
      .filter(element => visible(element) && element.children.length <= 2 && target.test(normalize(element.textContent)));
    for (const label of labels) {
      if (label.htmlFor) {
        const associated = document.getElementById(label.htmlFor);
        if (associated && options.includes(associated)) return associated;
      }
      let ancestor = label;
      for (let depth=0;depth<4 && ancestor;depth++,ancestor=ancestor.parentElement) {
        const found = [...ancestor.querySelectorAll('input')].filter(el=>options.includes(el));
        if (found.length===1) return found[0];
      }
    }
    const hourInputs = options.filter(input => /^hora\s*:?$/i.test(normalize(input.placeholder || '')));
    if (hourInputs.length===2) {
      hourInputs.sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);
      return which==='start'?hourInputs[0]:hourInputs[1];
    }
    return null;
  }
  function setTime(input,value) {
    if (!input) return false;
    if (input.value !== value) {
      const priorReadonly = input.readOnly;
      if (priorReadonly) input.readOnly=false;
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
      if (setter) setter.call(input,value); else input.value=value;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      input.blur();
      if (priorReadonly) input.readOnly=true;
    }
    return input.value === value;
  }
  const startInput = timeInput('start');
  const endInput = timeInput('end');
  if (setTime(startInput,p.start)) done.push('Inicio '+p.start);
  else warnings.push('No se pudo rellenar la hora de inicio');
  if (setTime(endInput,p.end)) done.push('Fin '+p.end);
  else warnings.push('No se pudo rellenar la hora de fin');

  // AF8-AF13: únicamente checkboxes de las filas correspondientes.
  let afCount=0;
  for (const code of ['AF8','AF9','AF10','AF11','AF12','AF13']) {
    const re = new RegExp('^' + code + '(?:\\b|\\.)', 'i');
    const rows = [...document.querySelectorAll('tr,[role=row]')];
    let row=rows.find(el => re.test(normalize(el.textContent)));
    if (!row) {
      const cell = [...document.querySelectorAll('td,div,span')].find(el =>
        el.children.length===0 && re.test(normalize(el.textContent)));
      row = cell?.closest('tr,[role=row]') || cell?.parentElement?.parentElement;
    }
    const candidates = row ? [...row.querySelectorAll('input[type=checkbox]')] : [];
    if (candidates.length!==1) {warnings.push('No se encontró la casilla de '+code);continue;}
    const cb=candidates[0];
    const want=p.af.includes(code);
    if (cb.checked !== want) cb.click();
    if (cb.checked === want) afCount++;
    else warnings.push('No se pudo actualizar '+code);
  }
  if (afCount===6) done.push('AF: '+p.af.join(', '));

  // Campo de anotaciones: no completar otro textarea accidentalmente.
  const textareas=[...document.querySelectorAll('textarea')].filter(visible);
  let notesField=textareas.length===1?textareas[0]:null;
  if (!notesField) {
    const candidates = textareas.filter(t => /anotaci|jornada|observacion/i.test([t.id,t.name,t.placeholder,t.getAttribute('aria-label')].join(' ')));
    if (candidates.length===1) notesField=candidates[0];
  }
  if (notesField) {
    const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;
    if (setter) setter.call(notesField,p.notes); else notesField.value=p.notes;
    notesField.dispatchEvent(new Event('input',{bubbles:true}));
    notesField.dispatchEvent(new Event('change',{bubbles:true}));
    if (notesField.value===p.notes) done.push('Anotaciones');
    else warnings.push('No se pudieron rellenar las anotaciones');
  } else warnings.push('No se localizó el campo de anotaciones');

  return {
    status:warnings.length?'partial':'ok',
    date:wantedDate,
    completed:done,
    warnings,
    message:'Revisa los campos y utiliza el botón Guardar de Séneca. Esta extensión NO los guarda automáticamente.'
  };
}
