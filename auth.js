'use strict';

// En GitHub Pages no existe servidor de autenticación. Este bloqueo local
// cifra los registros en este navegador; no crea cuentas en la nube.
const PortalAuth = (() => {
  const VAULT_KEY = 'phonegest_practices_vault_2026';
  const LEGACY_KEY = 'phonegest_practices_2026';
  const ITERATIONS = 350000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let vault = null;
  let activeKey = null;
  let onUnlock = null;
  let writes = Promise.resolve();

  const el = id => document.getElementById(id);

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    }
    return btoa(binary);
  }
  function fromBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  async function deriveKey(pin, salt) {
    const base = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name:'PBKDF2', salt, iterations:ITERATIONS, hash:'SHA-256' },
      base,
      { name:'AES-GCM', length:256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  async function encryptRecords(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = encoder.encode(JSON.stringify({ format:'PhoneGestVault1', records:data }));
    const encrypted = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, plaintext);
    return { iv:toBase64(iv), encrypted:toBase64(encrypted) };
  }
  async function decryptRecords(key, saved) {
    const decrypted = await crypto.subtle.decrypt(
      { name:'AES-GCM', iv:fromBase64(saved.iv) }, key, fromBase64(saved.encrypted)
    );
    const obj = JSON.parse(decoder.decode(decrypted));
    if (obj.format !== 'PhoneGestVault1' || !obj.records || typeof obj.records !== 'object' || Array.isArray(obj.records)) {
      throw new Error('Contenido del registro no válido');
    }
    return obj.records;
  }
  function legacyRecords() {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Registros previos no válidos');
    return value;
  }
  function setError(message) {
    el('authError').textContent = message || '';
    el('authError').hidden = !message;
  }
  function showMode() {
    const setup = !vault;
    el('authTitle').textContent = setup ? 'Crear acceso' : 'Bienvenido de nuevo';
    el('authHint').textContent = setup
      ? 'Configura un usuario y un PIN para proteger los registros en este navegador.'
      : 'Introduce tu usuario y PIN para acceder al portal.';
    el('authSubmit').textContent = setup ? 'Crear acceso' : 'Entrar';
    el('authConfirmWrap').hidden = !setup;
    el('authPin').autocomplete = setup ? 'new-password' : 'current-password';
    if (!setup) el('authUser').value = vault.username;
  }
  function unlock(records) {
    el('authPin').value = '';
    el('authConfirmPin').value = '';
    el('authScreen').hidden = true;
    document.querySelector('.app').hidden = false;
    onUnlock(records);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const user = el('authUser').value.trim();
    const pin = el('authPin').value;
    const button = el('authSubmit');
    button.disabled = true;
    try {
      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(user)) throw new Error('Usuario: entre 3 y 32 caracteres, sin espacios.');
      if (!/^\d{4,8}$/.test(pin)) throw new Error('El PIN debe tener entre 4 y 8 dígitos.');
      if (!crypto?.subtle) throw new Error('Este navegador no permite cifrar los registros. Usa HTTPS.');
      if (!vault) {
        if (pin !== el('authConfirmPin').value) throw new Error('Los PIN no coinciden.');
        const records = legacyRecords();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await deriveKey(pin, salt);
        const encrypted = await encryptRecords(key, records);
        const created = { version:1, username:user, salt:toBase64(salt), ...encrypted };
        localStorage.setItem(VAULT_KEY, JSON.stringify(created));
        vault = created;
        activeKey = key;
        // Borrar los registros sin cifrar solo después de persistir el nuevo almacén.
        localStorage.removeItem(LEGACY_KEY);
        unlock(records);
      } else {
        if (vault.username.toLowerCase() !== user.toLowerCase()) throw new Error('Usuario o PIN incorrecto.');
        const key = await deriveKey(pin, fromBase64(vault.salt));
        let records;
        try { records = await decryptRecords(key, vault); }
        catch { throw new Error('Usuario o PIN incorrecto.'); }
        activeKey = key;
        unlock(records);
      }
    } catch (error) {
      setError(error.message || 'No se pudo abrir el portal.');
    } finally {
      button.disabled = false;
    }
  }

  function start(callback) {
    onUnlock = callback;
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      vault = raw ? JSON.parse(raw) : null;
      if (vault && (vault.version !== 1 || !vault.username || !vault.salt || !vault.iv || !vault.encrypted)) {
        throw new Error('Los datos del acceso no son válidos. Conserva una copia antes de modificarlos.');
      }
    } catch (error) {
      el('authTitle').textContent = 'No se puede abrir el acceso';
      setError(error.message);
      el('authSubmit').disabled = true;
      return;
    }
    showMode();
    el('authForm').addEventListener('submit', submit);
    el('authUser').focus();
  }

  function saveRecords(records) {
    if (!activeKey || !vault) return Promise.reject(new Error('La sesión está bloqueada.'));
    // Se captura una instantánea para evitar escrituras que se adelanten.
    const snapshot = JSON.parse(JSON.stringify(records));
    const key = activeKey;
    const write = writes.catch(() => {}).then(async () => {
      const encrypted = await encryptRecords(key, snapshot);
      const next = { ...vault, ...encrypted };
      localStorage.setItem(VAULT_KEY, JSON.stringify(next));
      vault = next;
    });
    writes = write;
    return write;
  }

  async function lock() {
    try { await writes; } catch { /* Se informa del error al guardar en el portal. */ }
    activeKey = null;
    window.location.reload();
  }
  return { start, saveRecords, lock };
})();
