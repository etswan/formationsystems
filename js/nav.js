/* Formation Systems: a menu pinned to the upper right, shared by the home page and the Catholic pages.
   Include with <script src="(path to)/js/nav.js" defer></script>. The site root is worked out from this script's own address. */
(function () {
  const me = document.currentScript || [...document.scripts].find(s => /\/js\/nav\.js/.test(s.src));
  const root = new URL('..', me.src).href;
  const here = location.href.split('#')[0].split('?')[0];
  const pages = [['Home', ''], ['Catholic Autopoietic', 'catholic/'], ['Catholic Process', 'catholic/process/'], ['Protestant', 'protestant/']];
  const css = `
  .fsn{position:fixed;top:12px;z-index:1000;display:flex;align-items:center;justify-content:center;gap:8px;min-width:44px;height:44px;padding:0 14px;border-radius:999px;
    background:rgba(255,255,255,.93);color:#24232a;border:1px solid rgba(36,35,42,.16);box-shadow:0 2px 10px rgba(20,16,28,.14);font:600 15px/1 "Source Sans 3",system-ui,sans-serif;
    text-decoration:none;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  .fsn:hover{background:#fff;border-color:rgba(36,35,42,.35)}
  .fsn:focus-visible{outline:2px solid #5b3e8c;outline-offset:2px}
  .fsn-menu{right:12px;padding:0;width:44px}
  .fsn-menu i{display:block;width:18px;height:2px;border-radius:1px;background:currentColor;box-shadow:0 -6px 0 currentColor,0 6px 0 currentColor}
  .fsn-menu[aria-expanded=true] i{background:transparent;box-shadow:none;position:relative}
  .fsn-menu[aria-expanded=true] i::before,.fsn-menu[aria-expanded=true] i::after{content:"";position:absolute;left:0;top:0;width:18px;height:2px;background:currentColor;border-radius:1px;transform:rotate(45deg)}
  .fsn-menu[aria-expanded=true] i::after{transform:rotate(-45deg)}
  .fsn-drop{position:fixed;top:64px;right:12px;z-index:1000;width:min(240px,calc(100vw - 24px));max-height:calc(100vh - 80px);overflow:auto;background:#fff;color:#24232a;
    border:1px solid rgba(36,35,42,.14);border-radius:14px;box-shadow:0 12px 36px rgba(20,16,28,.22);padding:8px;display:none;font:15px/1.35 "Source Sans 3",system-ui,sans-serif}
  .fsn-drop.open{display:block}
  .fsn-drop a{display:block;padding:10px 12px;border-radius:9px;color:#24232a;text-decoration:none}
  .fsn-drop a:hover,.fsn-drop a:focus-visible{background:#f2efea;outline:none}
  .fsn-drop a[aria-current=page]{background:#ece7df}
  .fsn-drop a b{display:block;font-weight:600}.fsn-drop a small{display:block;color:#6b6670;font-size:13px;margin-top:2px}
  .fsn-drop hr{border:0;border-top:1px solid #ece8e2;margin:6px 4px}
  @media print{.fsn,.fsn-drop{display:none!important}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const m = document.createElement('button'); m.className = 'fsn fsn-menu'; m.type = 'button'; m.setAttribute('aria-label', 'Menu'); m.setAttribute('aria-expanded', 'false'); m.setAttribute('aria-controls', 'fsn-drop');
  m.innerHTML = '<i aria-hidden="true"></i>';
  const d = document.createElement('nav'); d.className = 'fsn-drop'; d.id = 'fsn-drop'; d.setAttribute('aria-label', 'Site');
  d.innerHTML = pages.map(([t, h]) => {
    const href = root + h, cur = here === href || here === href + 'index.html';
    return `<a href="${href}"${cur ? ' aria-current="page"' : ''}><b>${t}</b></a>`;
  }).join('');
  document.body.appendChild(m); document.body.appendChild(d);
  const set = o => { d.classList.toggle('open', o); m.setAttribute('aria-expanded', o); };
  m.addEventListener('click', e => { e.stopPropagation(); set(!d.classList.contains('open')); if (d.classList.contains('open')) d.querySelector('a').focus(); });
  document.addEventListener('click', e => { if (!d.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && d.classList.contains('open')) { set(false); m.focus(); } });
})();
