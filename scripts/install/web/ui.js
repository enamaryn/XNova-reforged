/* Assistant autonome : aucun build Next, React ou accès à la base n'est nécessaire. */
const element = id => document.getElementById(id);
let csrf = '';
let current = null;
let timer;

function error(message) {
  element('error').textContent = message || '';
  element('error').hidden = !message;
}

async function request(path, body) {
  const response = await fetch(`/bootstrap/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'x-xnova-bootstrap-csrf': csrf },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== 'auth') {
      clearTimeout(timer);
      element('auth').hidden = false;
      element('configuration').hidden = true;
      element('progress').hidden = true;
    }
    throw Object.assign(new Error(data.error || 'La requête a échoué.'), { status: response.status });
  }
  return data;
}

function fields() {
  const external = element('database').value === 'external';
  element('external-fields').hidden = !external;
  element('database-url').required = external && !current?.config;
  element('local-help').hidden = external;
  const certbot = element('tls').value === 'certbot';
  element('certificate-fields').hidden = !certbot;
  element('email').required = certbot;
  element('proxy-help').hidden = element('tls').value !== 'proxy';
}

function adopt(data) {
  current = data;
  if (data.csrf) csrf = data.csrf;
  element('auth').hidden = true;
  const services = data.existingServices || [];
  element('existing-services').hidden = services.length === 0;
  element('services-found').textContent = services.join(', ');
  for (const id of ['keep-services', 'recreate-services']) element(id).required = services.length > 0;
  if (data.config) {
    for (const id of ['mode', 'url', 'database', 'tls']) {
      element(id).value = data.config[id];
      element(id).disabled = true;
    }
    element('email').value = data.config.email;
    element('resume-info').hidden = false;
    element('install-button').textContent = 'Reprendre l’installation';
    element('database-summary').textContent = data.config.databaseName
      ? `Base locale : ${data.config.databaseName}. Les identifiants sont enregistrés sur le serveur.`
      : 'Base externe. Les identifiants sont enregistrés sur le serveur.';
  }
  fields();
  element('configuration').hidden = !['idle', 'failed'].includes(data.phase);
  element('progress').hidden = data.phase === 'idle';
  element('stage').textContent = data.stage;
  element('continue').hidden = data.phase !== 'ready';
  if (data.error) error(data.error);
  clearTimeout(timer);
  if (data.phase === 'running') timer = setTimeout(poll, 1500);
}

async function poll() {
  try { adopt(await request('status')); }
  catch (e) { error(e.message); if (e.status !== 401) timer = setTimeout(poll, 3000); }
}

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
  try {
    const data = await request('auth', { code: element('code').value.trim() });
    element('code').value = '';
    adopt(data);
  } catch (e) { error(e.message); }
});
element('configuration').addEventListener('submit', async event => {
  event.preventDefault();
  error('');
  element('install-button').disabled = true;
  try {
    const options = Object.fromEntries(['mode', 'url', 'database', 'tls', 'email'].map(id => [id, element(id).value.trim()]));
    options.databaseUrl = element('database-url').value.trim();
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
  finally { element('install-button').disabled = false; }
});
element('continue').addEventListener('click', async () => {
  error('');
  element('continue').disabled = true;
  element('stage').textContent = 'Démarrage du site et ouverture de la configuration SMTP…';
  try { const { next } = await request('handoff', {}); window.location.assign(next); }
  catch (e) { error(e.message); element('continue').disabled = false; }
});
// Rechargement de la page : reprendre une session encore valide, sans mémoriser le code dans le navigateur.
request('status').then(adopt).catch(() => {});
