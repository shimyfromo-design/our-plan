/* First open without a personal link: either the owner's one-time setup, or "open your link". */
import { esc, toast, copyText } from '../core.js?v=c1a0501fca';
import { Config, call, LS } from '../api.js?v=d44773a102';
import { rerender } from '../nav.js?v=57c55c9996';
import { primary, textBtn } from '../ui.js?v=b5958020ce';
const btn = (label, act, opts = {}) => (opts.kind === 'primary' ? primary(label, act, opts.data || {}, { disabled: opts.disabled }) : textBtn(label, act, opts.data || {}, { cls: 'block' }));

const st = { phase: 'idle', ping: null, error: '', result: null, busy: false };
const API_ID_RE = /^[A-Za-z0-9_-]{20,140}$/;

function setupApi() {
  const q = new URLSearchParams(location.search);
  const a = q.get('setup') || q.get('a') || '';
  return API_ID_RE.test(a) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(a) ? a : '';
}
function apiUrlFor(a) { return /^http/.test(a) ? a : 'https://script.google.com/macros/s/' + a + '/exec'; }

export function render() {
  if (st.result) return linksScreen();
  const a = setupApi();
  if (a) return ownerSetup(a);
  return openLink();
}

function shell(inner) { return `<div class="install"><div class="app-mark"><img src="icons/icon-512-v32.png" alt=""></div>${inner}</div>`; }

function ownerSetup(a) {
  if (st.phase === 'idle') { st.phase = 'checking'; ping(a); }
  if (st.phase === 'checking') return shell(`<h1 class="title">Our Plan</h1><p class="sub">Checking your Google script…</p>`);
  if (st.phase === 'not_authorized') {
    return shell(`<h1 class="title">One step first</h1><p class="body">Our Plan can't reach your Google script yet — usually because Google hasn't been given permission.</p>
      <p>Do <b>morning step 1</b> in SETUP.md (the "Run, then Allow" step), then come back to this page.</p>
      ${btn('I did it — check again', 'inst-recheck', { kind: 'primary', block: true })}${st.error ? `<p class="note bad">${esc(st.error)}</p>` : ''}`);
  }
  if (st.phase === 'ready_already') {
    return shell(`<h1 class="title">Already set up</h1><p class="body">Our Plan is already running. Open your personal link from the "Our Plan is ready" email.</p>${openLinkForm()}`);
  }
  if (st.phase === 'error') return shell(`<h1 class="title">Couldn't reach Our Plan</h1><p class="note bad">${esc(st.error)}</p>${btn('Try again', 'inst-recheck', { kind: 'primary', block: true })}`);
  return shell(`<h1 class="title">Welcome to Our Plan</h1><p class="body">Two names and you're done. We'll create your private Google Sheet, your two private links, and email them to you.</p>
    <label class="field"><span>Your first name</span><input id="in-n1" type="text" maxlength="40" autocomplete="given-name" autocapitalize="words" value="${esc(LS.get('op_in_n1') || '')}"></label>
    <label class="field"><span>Your partner's first name</span><input id="in-n2" type="text" maxlength="40" autocapitalize="words" value="${esc(LS.get('op_in_n2') || '')}"></label>
    <label class="field"><span>Your partner's email (optional)</span><input id="in-e2" type="email" inputmode="email" maxlength="120"></label>
    ${btn(st.busy ? 'Setting up… (about 30 seconds)' : 'Create our plan', 'inst-create', { kind: 'primary', block: true, disabled: st.busy })}
    ${st.error ? `<p class="note bad">${esc(st.error)}</p>` : ''}
    <p class="caption">Nothing is shared with anyone else. Your data lives in your own Google account.</p>`);
}

async function ping(a) {
  try {
    const r = await call('ping', {}, { apiUrl: apiUrlFor(a), timeout: 30000 });
    st.ping = r;
    st.phase = r.ready ? 'ready_already' : 'form';
  } catch (e) {
    st.error = e.message;
    // Before Google permission is granted the script answers without CORS headers, which looks like a network error.
    st.phase = (e.code === 'not_authorized' || e.code === 'network') && navigator.onLine !== false ? 'not_authorized' : 'error';
  }
  rerender();
}

function linksScreen() {
  const r = st.result;
  return shell(`<h1 class="title">You're all set</h1>
    <p class="body">${r.emailedTo ? `We emailed both private links to <b>${esc(r.emailedTo)}</b>.` : 'Copy your links below.'}</p>
    <div class="card"><div class="eyebrow">${esc(r.names[0])} (you)</div><p class="caption">Open this on <b>your iPhone</b> in Safari, then Share → Add to Home Screen.</p>${btn('Copy my link', 'inst-copy', { kind: 'secondary', block: true, icon: 'copy', data: { 'data-k': 'owner' } })}</div>
    ${r.links.partner ? `<div class="card"><div class="eyebrow">${esc(r.names[1])}</div><p class="caption">Send this to ${esc(r.names[1])} by text or email. It opens their own plan.</p>${btn('Share ' + r.names[1] + '\'s link', 'inst-share', { kind: 'secondary', block: true, icon: 'share' })}</div>` : ''}
    <p class="caption">Each link is private — anyone who has it can open that person's plan. You can make new links later in More → Settings.</p>
    ${btn('Continue on this device', 'inst-continue', { kind: 'primary', block: true })}`);
}

function openLinkForm() {
  return `<label class="field"><span>Paste your personal link</span><input id="in-link" type="url" inputmode="url" placeholder="https://…?u=…" autocomplete="off"></label>${btn('Open my plan', 'inst-open', { kind: 'primary', block: true })}`;
}
function openLink() {
  return shell(`<h1 class="title">Our Plan</h1><p class="body">This is a private app. Open your personal link — it's in the email titled "Our Plan is ready", or ask the person who set it up to send it to you.</p>${openLinkForm()}`);
}

export const actions = {
  'inst-recheck'() { st.phase = 'idle'; st.error = ''; rerender(); },
  async 'inst-create'() {
    const n1 = document.getElementById('in-n1').value.trim();
    const n2 = document.getElementById('in-n2').value.trim();
    if (!n1) { toast('Enter your first name.', { kind: 'err' }); return; }
    LS.set('op_in_n1', n1); LS.set('op_in_n2', n2);
    const a = setupApi();
    st.busy = true; st.error = ''; rerender();
    try {
      const r = await call('bootstrap', { names: [n1, n2].filter(Boolean), partnerEmail: document.getElementById('in-e2').value.trim(), appUrl: location.origin + location.pathname, apiUrl: apiUrlFor(a), apiId: /^http/.test(a) ? a : '' }, { apiUrl: apiUrlFor(a), timeout: 120000 });
      st.result = r;
      Config.setLink(r.token, /^http/.test(a) ? a : r.apiId);
    } catch (e) { st.error = e.message; }
    st.busy = false; rerender();
  },
  async 'inst-copy'() { toast((await copyText(st.result.links.owner)) ? 'Copied. Open it on your iPhone.' : 'Couldn\'t copy.', { icon: 'copy' }); },
  async 'inst-share'() {
    const r = st.result;
    const text = 'Here\'s your private link for Our Plan. Open it in Safari on your iPhone, then tap Share → Add to Home Screen: ' + r.links.partner;
    try { if (navigator.share) { await navigator.share({ title: 'Our Plan', text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    toast((await copyText(r.links.partner)) ? 'Link copied — paste it into a text to ' + r.names[1] + '.' : 'Couldn\'t copy.', { icon: 'copy' });
  },
  'inst-continue'() { st.result = null; location.hash = '#/setup'; location.reload(); },
  'inst-open'() {
    const v = (document.getElementById('in-link').value || '').trim();
    try {
      const u = new URL(v);
      const t = u.searchParams.get('u'), a = u.searchParams.get('a');
      if (!t || !a) throw new Error('missing');
      Config.setLink(t, a);
      location.reload();
    } catch (e) { toast('That doesn\'t look like a personal link. It should contain "?u=".', { kind: 'err' }); }
  }
};
