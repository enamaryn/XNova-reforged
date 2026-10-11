/* Assistant autonome : aucun build Next, React ou accès à la base n'est nécessaire. */
const element = id => document.getElementById(id);
const LANGUAGES = window.XNOVA_LANGUAGES;
const DICTIONARY = window.XNOVA_I18N;
const STAGES = window.XNOVA_STAGES;
const STORAGE_KEY = 'xnova-install-language';
let csrf = '';
let current = null;
let timer;
let language = 'fr';

/* ---------- Langue ---------- */
function t(key, params = {}) {
  const text = (DICTIONARY[language] && DICTIONARY[language][key]) ?? DICTIONARY.fr[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => (name in params ? params[name] : `{${name}}`));
}

function stageText(stage) {
  if (!stage) return '';
  const entry = STAGES[stage];
  if (language === 'fr' || !entry) return stage;
  return typeof entry === 'string' ? t(entry) : entry[language] || stage;
}

function applyLanguage(id) {
  if (!DICTIONARY[id]) id = 'fr';
  language = id;
  document.documentElement.lang = id;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const button of document.querySelectorAll('#languages button')) button.setAttribute('aria-pressed', String(button.dataset.language === id));
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* stockage indisponible : le choix reste valable pour cette page */ }
  // Le site (Next) reprend la langue choisie : même nom d'hôte, donc même cookie.
  document.cookie = `NEXT_LOCALE=${id}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
  if (current) {
    element('stage').textContent = stageText(current.stage);
    describeDatabase();
  }
  fields();
}

function buildLanguageBar() {
  const bar = element('languages');
  for (const entry of LANGUAGES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.language = entry.id;
    button.lang = entry.id;
    button.textContent = `${entry.flag} ${entry.name}`;
    button.addEventListener('click', () => applyLanguage(entry.id));
    bar.appendChild(button);
  }
}

function initialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICTIONARY[stored]) return stored;
  } catch { /* ignoré */ }
  return 'fr';
}

/* ---------- Erreurs et requêtes ---------- */
function error(message) {
  const box = element('error');
  box.textContent = message || '';
  box.hidden = !message;
  // Le message est sticky : il reste visible quel que soit le défilement du formulaire.
  if (message) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

async function request(path, body) {
  let response;
  try {
    response = await fetch(`/bootstrap/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-xnova-bootstrap-csrf': csrf },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw Object.assign(new Error(t('errNetwork')), { status: 0 });
  }
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw Object.assign(new Error(t('errNotJson', { status: response.status })), { status: response.status }); }
  if (!response.ok) {
    if (response.status === 401 && path !== 'auth') {
      clearTimeout(timer);
      element('auth').hidden = false;
      element('configuration').hidden = true;
      element('progress').hidden = true;
    }
    throw Object.assign(new Error(data.error || t('errRequest')), { status: response.status });
  }
  return data;
}

/* ---------- Formulaire ---------- */
function fields() {
  const external = element('database').value === 'external';
  element('external-fields').hidden = !external;
  element('local-help').hidden = external;
  const certbot = element('tls').value === 'certbot';
  element('certificate-fields').hidden = !certbot;
  element('proxy-help').hidden = element('tls').value !== 'proxy';
}

function describeDatabase() {
  if (!current?.config) return;
  element('database-summary').textContent = current.config.databaseName
    ? t('databaseSummaryLocal', { name: current.config.databaseName })
    : t('databaseSummaryExternal');
}

function adopt(data) {
  current = data;
  if (data.csrf) csrf = data.csrf;
  element('auth').hidden = true;
  const services = data.existingServices || [];
  element('existing-services').hidden = services.length === 0;
  element('services-found').textContent = services.join(', ');
  if (data.config) {
    for (const id of ['mode', 'url', 'database', 'tls']) {
      element(id).value = data.config[id];
      element(id).disabled = true;
    }
    element('email').value = data.config.email;
    element('resume-info').hidden = false;
    element('install-button').dataset.i18n = 'resume';
    element('install-button').textContent = t('resume');
    describeDatabase();
  }
  fields();
  element('configuration').hidden = !['idle', 'failed'].includes(data.phase);
  element('progress').hidden = data.phase === 'idle';
  element('stage').textContent = stageText(data.stage);
  element('continue').hidden = data.phase !== 'ready';
  if (data.error) error(data.error);
  clearTimeout(timer);
  if (data.phase === 'running') timer = setTimeout(poll, 1500);
}

async function poll() {
  try { adopt(await request('status')); }
  catch (e) { error(e.message); if (e.status !== 401) timer = setTimeout(poll, 3000); }
}

/** Validation locale : un champ manquant produit toujours un message visible (jamais une bulle muette du navigateur). */
function validateConfiguration() {
  for (const id of ['url', 'database-url', 'email']) element(id).classList.remove('field-invalid');
  const fail = (id, key) => { element(id).classList.add('field-invalid'); element(id).focus(); return t(key); };
  const url = element('url').value.trim();
  let validUrl = false;
  try { validUrl = ['http:', 'https:'].includes(new URL(url).protocol); } catch { /* adresse invalide */ }
  if (!validUrl) return fail('url', 'errUrl');
  if (element('database').value === 'external' && !current?.config && !element('database-url').value.trim()) return fail('database-url', 'errDatabaseUrl');
  if (element('tls').value === 'certbot' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(element('email').value.trim())) return fail('email', 'errEmail');
  if ((current?.existingServices || []).length > 0 && !document.querySelector('input[name="service-action"]:checked')) {
    element('existing-services').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return t('errServices');
  }
  return null;
}

/* ---------- Démarrage ---------- */
buildLanguageBar();
applyLanguage(initialLanguage());
element('url').value = `https://${window.location.hostname}`;
for (const id of ['database', 'tls']) element(id).addEventListener('change', fields);
element('mode').addEventListener('change', () => {
  if (element('mode').value === 'development' && element('url').value === `https://${window.location.hostname}`) {
    element('url').value = `http://${window.location.hostname}`;
    element('tls').value = 'none';
  }
  fields();
});
element('auth').addEventListener('submit', async event => {
  event.preventDefault();
  error('');
  const code = element('code').value.trim();
  if (!code) { element('code').focus(); error(t('errCode')); return; }
  try {
    const data = await request('auth', { code });
    element('code').value = '';
    adopt(data);
  } catch (e) { error(e.message); }
});
element('configuration').addEventListener('submit', async event => {
  event.preventDefault();
  error('');
  const problem = validateConfiguration();
  if (problem) { error(problem); return; }
  const button = element('install-button');
  button.disabled = true;
  button.textContent = t('working');
  try {
    const options = Object.fromEntries(['mode', 'url', 'database', 'tls', 'email'].map(id => [id, element(id).value.trim()]));
    options.databaseUrl = element('database-url').value.trim();
    options.language = language;
    const action = document.querySelector('input[name="service-action"]:checked')?.value;
    if (action) options.serviceAction = action;
    adopt(await request('install', options));
    element('database-url').value = '';
  } catch (e) {
    // Une autre installation peut avoir créé des services depuis l'ouverture du formulaire.
    if (e.status === 400) {
      try { adopt(await request('status')); } catch { /* Garder l'erreur initiale. */ }
    }
    error(e.message);
  }
  finally {
    button.disabled = false;
    button.textContent = t(button.dataset.i18n || 'install');
  }
});
element('continue').addEventListener('click', async () => {
  error('');
  element('continue').disabled = true;
  element('stage').textContent = t('handoff');
  try { const { next } = await request('handoff', { language }); window.location.assign(next); }
  catch (e) { error(e.message); element('continue').disabled = false; }
});
// Rechargement de la page : reprendre une session encore valide, sans mémoriser le code dans le navigateur.
request('status').then(adopt).catch(() => {});
