// Linksmith by Edgar Akonski - v1.1.0

document.addEventListener('DOMContentLoaded', () => {
  restoreState();
  bindEvents();
});

// ─── Field IDs ─────────────────────────────────────────────────────────────
const INPUT_IDS = [
  'source', 'language', 'location', 'date', 'baseUrl',
  'campaignType', 'campaignObjective', 'match',
  'specialName', 'campaignTerm', 'adName', 'audience'
];

const OUTPUT_IDS = [
  'out-campaignName', 'out-medium', 'out-content', 'out-term', 'out-utm'
];

// ─── Auto-fill helpers ─────────────────────────────────────────────────────
function autoFillDate() {
  const el = document.getElementById('date');
  if (!el || el.value) return;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year  = String(now.getFullYear()).slice(-2);
  el.value = `${month}/${year}`;
}

function autoFillBaseUrl() {
  const el = document.getElementById('baseUrl');
  if (!el || el.value) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      const url = tabs[0].url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const parsed = new URL(url);
          el.value = parsed.origin + parsed.pathname.replace(/\/$/, '');
        } catch(e) {
          el.value = url.split('?')[0];
        }
      }
    }
  });
}

// ─── Bind Events ───────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('generateBtn').addEventListener('click', generate);
  document.getElementById('resetBtn').addEventListener('click', resetAll);

  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', saveState);
  });

  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const value = document.getElementById(targetId).textContent;
      if (value && value !== '—') copyToClipboard(value, btn);
    });
  });
}

// ─── Core Generate Logic ───────────────────────────────────────────────────
function generate() {
  const source      = val('source');
  const lang        = val('language');
  const location    = val('location');
  const date        = val('date');
  const baseUrl     = val('baseUrl').trim();
  const type        = val('campaignType');
  const objective   = val('campaignObjective');
  const match       = val('match');
  const specialName = val('specialName').trim();
  const termRaw     = val('campaignTerm').trim();
  const adNameRaw   = val('adName').trim();
  const audienceRaw = val('audience').trim();

  // Campaign Name: specialName | type | objective | location | lang | date
  const campaignName = [specialName, type, objective, location, lang, date]
    .filter(p => p && p.trim() !== '')
    .join(' | ');

  // Campaign Medium: term | audience | match
  const medium = [termRaw, audienceRaw, match]
    .filter(p => p && p.trim() !== '')
    .join(' | ');

  // Campaign Content: adName
  const content = adNameRaw;

  // Campaign Term: termRaw
  const term = termRaw;

  // Full UTM URL
  let fullUtm = '';
  if (baseUrl) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    fullUtm = baseUrl + sep
      + 'utm_source='    + encodeURIComponent(source)
      + '&utm_medium='   + encodeURIComponent(medium)
      + '&utm_campaign=' + encodeURIComponent(campaignName)
      + '&utm_term='     + encodeURIComponent(term)
      + '&utm_content='  + encodeURIComponent(content);
  }

  setOutput('out-campaignName', campaignName || '—');
  setOutput('out-medium',       medium       || '—');
  setOutput('out-content',      content      || '—');
  setOutput('out-term',         term         || '—');
  setOutput('out-utm',          fullUtm      || '—');

  document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  saveState();
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setOutput(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ─── Clipboard ─────────────────────────────────────────────────────────────
function copyToClipboard(text, btn) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => flashCopied(btn));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    flashCopied(btn);
  }
}

function flashCopied(btn) {
  btn.classList.add('copied');
  showToast('Copied!');
  setTimeout(() => btn.classList.remove('copied'), 1500);
}

function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ─── State Persistence ─────────────────────────────────────────────────────
function saveState() {
  const state = {};
  INPUT_IDS.forEach(id => { state[id] = val(id); });
  OUTPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) state[id] = el.textContent;
  });
  chrome.storage.local.set({ campaignNamerState: state });
}

function restoreState() {
  chrome.storage.local.get(['campaignNamerState'], (result) => {
    const state = result.campaignNamerState;
    if (state) {
      INPUT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && state[id] !== undefined) el.value = state[id];
      });
      OUTPUT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el && state[id]) el.textContent = state[id];
      });
    }
    autoFillDate();
    autoFillBaseUrl();
  });
}

// ─── Reset ─────────────────────────────────────────────────────────────────
function resetAll() {
  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Restore select defaults
  const lang = document.getElementById('language');
  const loc  = document.getElementById('location');
  if (lang) lang.value = 'HE';
  if (loc)  loc.value  = 'IL';

  OUTPUT_IDS.forEach(id => setOutput(id, '—'));
  chrome.storage.local.remove('campaignNamerState');
  autoFillDate();
  autoFillBaseUrl();
  showToast('Reset ✓');
}
