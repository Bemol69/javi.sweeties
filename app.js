(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CFG = JSON.parse($('#appCfg').textContent);
  const clp = (n) => '$' + Number(n).toLocaleString('es-CL');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = 'javisweeties_bolsa_v1';

  /* ---------- Revelados y contadores ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  $$('.reveal, .card').forEach((el) => io.observe(el));

  const cuentas = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    cuentas.unobserve(e.target);
    const txt = e.target.dataset.cuenta;
    const m = txt.match(/[\d.,]+/);
    if (reduce || !m) return;
    const fin = parseFloat(m[0].replace(',', '.'));
    const dec = m[0].includes(',') ? 1 : 0;
    const t0 = performance.now();
    const paso = (t) => {
      const k = Math.min((t - t0) / 1100, 1);
      const v = fin * (1 - Math.pow(1 - k, 3));
      e.target.textContent = txt.replace(m[0], dec ? v.toFixed(1).replace('.', ',') : Math.round(v));
      if (k < 1) requestAnimationFrame(paso); else e.target.textContent = txt;
    };
    requestAnimationFrame(paso);
  }), { threshold: 0.6 });
  $$('[data-cuenta]').forEach((el) => cuentas.observe(el));

  /* ---------- Filtros ---------- */
  $$('#filtros .chip').forEach((b) => b.addEventListener('click', () => {
    $$('#filtros .chip').forEach((x) => x.classList.toggle('is-on', x === b));
    const f = b.dataset.filtro;
    $$('.card').forEach((c) => { c.hidden = f !== 'todos' && c.dataset.cat !== f; if (!c.hidden) c.classList.add('in'); });
  }));

  /* ---------- Variantes en tarjetas ---------- */
  const prod = (id) => CFG.catalogo.find((x) => x.id === id);
  $$('.card').forEach((card) => {
    const p = prod(card.dataset.id);
    $$('.var', card).forEach((b) => b.addEventListener('click', () => {
      $$('.var', card).forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', x === b); });
      $('[data-precio]', card).textContent = clp(p.variantes[+b.dataset.v].precio);
    }));
    const add = $('[data-add]', card);
    if (add) add.addEventListener('click', () => {
      const on = $('.var.is-on', card);
      agregar(p.id, on ? +on.dataset.v : 0);
      add.classList.add('ok'); add.textContent = '¡Agregado! ✓';
      setTimeout(() => { add.classList.remove('ok'); add.textContent = 'Agregar a la bolsa'; }, 1300);
    });
  });

  /* ---------- Bolsa ---------- */
  let bolsa = [];
  try { bolsa = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { bolsa = []; }
  bolsa = bolsa.filter((l) => prod(l.id) && prod(l.id).variantes[l.v]);
  const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(bolsa)); } catch (e) { /* sin almacenamiento */ } };
  const total = () => bolsa.reduce((s, l) => s + prod(l.id).variantes[l.v].precio * l.q, 0);
  const cantidad = () => bolsa.reduce((s, l) => s + l.q, 0);

  function agregar(id, v) {
    const l = bolsa.find((x) => x.id === id && x.v === v);
    if (l) l.q++; else bolsa.push({ id, v, q: 1 });
    guardar(); pintarContador(); aviso('Agregado a tu bolsa 🧁');
    const b = $('#abrirBolsa'); b.classList.remove('late'); void b.offsetWidth; b.classList.add('late');
    if ($('#cajon').classList.contains('on')) pintarBolsa();
  }
  function pintarContador() {
    const n = cantidad(), el = $('#bolsaN');
    el.hidden = !n; el.textContent = n;
  }
  let avisoT;
  function aviso(t) {
    const a = $('#aviso'); a.textContent = t; a.hidden = false;
    clearTimeout(avisoT); avisoT = setTimeout(() => (a.hidden = true), 1800);
  }

  const cajon = $('#cajon'), velo = $('#velo');
  function abrir() {
    pintarBolsa(); velo.hidden = false;
    requestAnimationFrame(() => { velo.classList.add('on'); cajon.classList.add('on'); });
    cajon.setAttribute('aria-hidden', 'false'); document.body.classList.add('sin-scroll'); cajon.focus();
  }
  function cerrar() {
    velo.classList.remove('on'); cajon.classList.remove('on');
    cajon.setAttribute('aria-hidden', 'true'); document.body.classList.remove('sin-scroll');
    setTimeout(() => (velo.hidden = true), 300); $('#abrirBolsa').focus();
  }
  $('#abrirBolsa').addEventListener('click', abrir);
  $('#cerrarBolsa').addEventListener('click', cerrar);
  velo.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cajon.classList.contains('on')) cerrar(); });

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const estado = { entrega: 'retiro', nombre: '', comuna: '', direccion: '', fecha: '', notas: '' };

  function pintarBolsa() {
    const cuerpo = $('#bolsaCuerpo');
    if (!bolsa.length) {
      cuerpo.innerHTML = '<div class="vacia"><span>🧁</span><p>Tu bolsa está vacía.<br>Agrega algo rico desde la vitrina.</p><p><button class="btn" type="button" id="irVitrina">Ver productos</button></p></div>';
      $('#irVitrina').addEventListener('click', () => { cerrar(); location.hash = '#productos'; });
      return;
    }
    const lineas = bolsa.map((l, i) => {
      const p = prod(l.id), v = p.variantes[l.v];
      return `<div class="item"><img src="${p.img}" alt="" width="64" height="64"><div><h4>${esc(p.nombre)}</h4><small>${esc(v.nombre)} · ${clp(v.precio)}</small><div class="qty"><button type="button" data-menos="${i}" aria-label="Quitar uno">−</button><span>${l.q}</span><button type="button" data-mas="${i}" aria-label="Agregar uno">+</button></div></div><div class="item__der"><strong>${clp(v.precio * l.q)}</strong><button class="quitar" type="button" data-quitar="${i}">Quitar</button></div></div>`;
    }).join('');
    const zonas = CFG.zonas.map((z) => `<option value="${esc(z)}"${estado.comuna === z ? ' selected' : ''}>${esc(z)}</option>`).join('');
    const desp = estado.entrega === 'despacho';
    cuerpo.innerHTML = `${lineas}
      <div class="total"><span>Subtotal</span><span>${clp(total())}</span></div>
      <p class="total-nota">${desp && CFG.despachoDesde ? `El despacho se suma aparte (desde ${clp(CFG.despachoDesde)} según comuna). ` : ''}Javi confirma disponibilidad y pago por WhatsApp.</p>
      <form class="form" id="form" novalidate>
        <label>Tu nombre<input name="nombre" autocomplete="name" value="${esc(estado.nombre)}" placeholder="Ej: Camila"><span class="err" data-err="nombre"></span></label>
        <div class="entrega" role="radiogroup" aria-label="Entrega">
          <label><input type="radio" name="entrega" value="retiro"${!desp ? ' checked' : ''}> 🏡 Retiro${CFG.comunaRetiro ? ' en ' + esc(CFG.comunaRetiro) : ''}</label>
          <label><input type="radio" name="entrega" value="despacho"${desp ? ' checked' : ''}> 🚚 Despacho</label>
        </div>
        ${desp ? `<label>Comuna<select name="comuna"><option value="">Elige tu comuna</option>${zonas}</select><span class="err" data-err="comuna"></span></label>
        <label>Dirección<input name="direccion" autocomplete="street-address" value="${esc(estado.direccion)}" placeholder="Calle, número, depto"><span class="err" data-err="direccion"></span></label>` : ''}
        <label>Fecha en que lo necesitas<input type="date" name="fecha" value="${esc(estado.fecha)}"><span class="err" data-err="fecha"></span></label>
        <label>Notas (sabores, dedicatoria, alergias)<textarea name="notas" rows="3" placeholder="Ej: la caja de 6 con 2 red velvet y 4 chocochips">${esc(estado.notas)}</textarea></label>
        <label>Vista previa del mensaje<div class="vista" id="vista"></div></label>
        <button class="btn btn--enviar" type="submit"${CFG.whatsapp ? '' : ' disabled'}>Enviar pedido por WhatsApp</button>
        ${CFG.whatsapp ? '' : '<p class="err">WhatsApp aún no está configurado.</p>'}
      </form>`;
    const f = $('#form');
    f.addEventListener('input', () => { leer(f); vista(); });
    f.addEventListener('change', (e) => { leer(f); if (e.target.name === 'entrega') pintarBolsa(); else vista(); });
    f.addEventListener('submit', (e) => { e.preventDefault(); enviar(f); });
    $$('[data-mas]').forEach((b) => b.addEventListener('click', () => { bolsa[+b.dataset.mas].q++; cambio(); }));
    $$('[data-menos]').forEach((b) => b.addEventListener('click', () => { const l = bolsa[+b.dataset.menos]; l.q--; if (l.q < 1) bolsa.splice(+b.dataset.menos, 1); cambio(); }));
    $$('[data-quitar]').forEach((b) => b.addEventListener('click', () => { bolsa.splice(+b.dataset.quitar, 1); cambio(); }));
    vista();
  }
  function cambio() { guardar(); pintarContador(); pintarBolsa(); }
  function leer(f) {
    const d = new FormData(f);
    for (const k of ['nombre', 'entrega', 'comuna', 'direccion', 'fecha', 'notas']) if (d.has(k)) estado[k] = String(d.get(k)).trim();
  }
  function fechaBonita(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function mensaje() {
    const l = bolsa.map((x) => { const p = prod(x.id), v = p.variantes[x.v]; return `• ${x.q} x ${p.nombre} (${v.nombre}) — ${clp(v.precio * x.q)}`; }).join('\n');
    const desp = estado.entrega === 'despacho';
    return [
      `¡Hola Javi! Quiero hacer un pedido 🧁`, '',
      `*Pedido*`, l, '',
      `*Subtotal:* ${clp(total())}`, '',
      `👤 *Nombre:* ${estado.nombre || '…'}`,
      desp ? `🚚 *Despacho:* ${estado.direccion || '…'}, ${estado.comuna || '…'}` : `🏡 *Retiro en ${CFG.comunaRetiro || 'tienda'}*`,
      `📅 *Para el:* ${fechaBonita(estado.fecha) || '…'}`,
      estado.notas ? `📝 *Notas:* ${estado.notas}` : '',
    ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
  }
  function vista() { const v = $('#vista'); if (v) v.textContent = mensaje(); }

  function enviar(f) {
    leer(f);
    const errs = {};
    if (estado.nombre.length < 2) errs.nombre = 'Escribe tu nombre.';
    if (estado.entrega === 'despacho') {
      if (!estado.comuna) errs.comuna = 'Elige una comuna.';
      if (estado.direccion.length < 5) errs.direccion = 'Escribe tu dirección.';
    }
    if (!estado.fecha) errs.fecha = 'Elige la fecha.';
    else {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const [y, m, d] = estado.fecha.split('-').map(Number);
      if (new Date(y, m - 1, d) < new Date(hoy.getTime() + 86400000)) errs.fecha = `Pide con ${CFG.anticipacion || 'anticipación'} de anticipación.`;
    }
    $$('[data-err]', f).forEach((s) => { s.textContent = errs[s.dataset.err] || ''; const i = s.previousElementSibling; if (i) i.classList.toggle('invalido', !!errs[s.dataset.err]); });
    const primera = Object.keys(errs)[0];
    if (primera) { $(`[name="${primera}"]`, f)?.focus(); return; }
    window.open(`https://api.whatsapp.com/send?phone=${CFG.whatsapp}&text=${encodeURIComponent(mensaje())}`, '_blank', 'noopener');
  }

  /* ---------- Mapa diferido ---------- */
  const mapa = $('#mapa');
  if (mapa) {
    const cargar = () => {
      if ($('iframe', mapa)) return;
      const i = document.createElement('iframe');
      i.src = mapa.dataset.src; i.title = mapa.dataset.titulo; i.loading = 'lazy';
      i.referrerPolicy = 'no-referrer-when-downgrade'; mapa.innerHTML = ''; mapa.appendChild(i);
    };
    $('#verMapa')?.addEventListener('click', cargar);
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { cargar(); o.disconnect(); } }, { rootMargin: '200px' }).observe(mapa);
  }

  pintarContador();
})();
