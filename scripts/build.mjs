// Build de Javi'Sweeties: valida datos, optimiza fotos, escribe las tarjetas en el HTML y genera SEO.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const p = (...a) => path.join(ROOT, ...a);

function leer(ruta, defecto) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch (e) {
    console.warn(`⚠ No pude leer ${path.relative(ROOT, ruta)} (${e.message}). Uso valores por defecto.`);
    return defecto;
  }
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clp = (n) => '$' + Number(n).toLocaleString('es-CL');
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hash = (file) => crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 8);

const cfg = leer(p('sitio.config.json'), {});
const aj = leer(p('data/ajustes.json'), {});

// ---- Vaciar dist por dentro (en Windows la carpeta puede estar abierta por el servidor)
fs.mkdirSync(DIST, { recursive: true });
for (const f of fs.readdirSync(DIST)) fs.rmSync(path.join(DIST, f), { recursive: true, force: true });

// ---- Validaciones
let wa = String(aj.whatsapp || '').replace(/\D/g, '');
if (wa && !/^569\d{8}$/.test(wa)) {
  console.warn(`⚠ WhatsApp "${aj.whatsapp}" no tiene formato 569XXXXXXXX. El botón de WhatsApp se oculta.`);
  wa = '';
}
const waUrl = (texto) => `https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(texto)}`;

// ---- Productos (máximo 10 en la demo)
const dirProd = p('data/productos');
let productos = fs
  .readdirSync(dirProd)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ id: f.replace('.json', ''), ...leer(path.join(dirProd, f), null) }))
  .filter((x) => x.nombre && x.visible !== false && Array.isArray(x.variantes) && x.variantes.length)
  .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
if (productos.length > 10) console.warn(`⚠ Hay ${productos.length} productos; la demo muestra solo 10.`);
productos = productos.slice(0, 10);

// ---- Fotos WebP
const optDir = path.join(DIST, 'img', '_opt');
fs.mkdirSync(optDir, { recursive: true });
async function foto(src, nombre, anchos) {
  const origen = p(src);
  if (!fs.existsSync(origen)) {
    console.warn(`⚠ Falta la foto ${src}`);
    return null;
  }
  for (const w of anchos) {
    await sharp(origen).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(optDir, `${nombre}-${w}.webp`));
  }
  return anchos.map((w) => `img/_opt/${nombre}-${w}.webp`);
}
for (const x of productos) {
  const r = await foto(x.foto || '', x.id, [480, 900]);
  x._img = r;
}
await foto('img/logo.jpg', 'logo', [160]);
const hero = productos[0]?._img ? productos[0] : productos.find((x) => x._img);

// ---- Tarjetas
const cats = [...new Set(productos.map((x) => x.categoria))];
const filtros = cats.length >= 2
  ? `<button class="chip is-on" data-filtro="todos" type="button">Todo</button>` + cats.map((c) => `<button class="chip" data-filtro="${esc(slug(c))}" type="button">${esc(c)}</button>`).join('')
  : '';

const tarjetas = productos
  .map((x, i) => {
    const vs = x.variantes;
    const conPrecio = vs.some((v) => v.precio);
    const primero = vs.find((v) => v.precio) || vs[0];
    const img = x._img
      ? `<img src="${x._img[0]}" srcset="${x._img[0]} 480w, ${x._img[1]} 900w" sizes="(min-width:900px) 300px, 80vw" alt="${esc(x.nombre)}" width="480" height="${i % 2 ? 560 : 600}" loading="lazy" decoding="async">`
      : '';
    const chips = vs.length > 1 && conPrecio
      ? `<div class="vars" role="radiogroup" aria-label="Formato">${vs.map((v, k) => `<button type="button" class="var${k === 0 ? ' is-on' : ''}" data-v="${k}" role="radio" aria-checked="${k === 0}">${esc(v.nombre)}</button>`).join('')}</div>`
      : `<p class="var-unica">${esc(primero.nombre)}</p>`;
    const pie = conPrecio
      ? `<div class="card__pie"><span class="precio" data-precio>${clp(primero.precio)}</span><button class="btn btn--add" type="button" data-add>Agregar a la bolsa</button></div>`
      : `<div class="card__pie"><span class="precio precio--cotiza">Cotizar</span>${wa ? `<a class="btn btn--wa" href="${waUrl(`Hola Javi! Quiero cotizar: ${x.nombre} 👋`)}" target="_blank" rel="noopener">Cotizar por WhatsApp</a>` : ''}</div>`;
    return `<article class="card${x.destacado ? ' card--dest' : ''}" data-id="${esc(x.id)}" data-cat="${esc(slug(x.categoria))}" style="--i:${i}">
  <div class="card__foto">${img}${x.etiqueta ? `<span class="etiqueta">${esc(x.etiqueta)}</span>` : ''}</div>
  <div class="card__body"><span class="card__cat">${esc(x.categoria)}</span><h3>${esc(x.nombre)}</h3><p>${esc(x.descripcion || '')}</p>${chips}${pie}</div>
</article>`;
  })
  .join('\n');

const catalogo = productos.map((x) => ({
  id: x.id, nombre: x.nombre, img: x._img?.[0] || '',
  variantes: x.variantes.map((v) => ({ nombre: v.nombre, precio: v.precio || 0 })),
}));
const appCfg = {
  whatsapp: wa, nombre: cfg.nombre, despachoDesde: aj.despacho_desde || 0, zonas: aj.zonas || [],
  comunaRetiro: aj.comuna_retiro || '', anticipacion: aj.anticipacion || '', catalogo,
};

// ---- Datos estructurados
const jsonld = {
  '@context': 'https://schema.org',
  '@type': cfg.schema_tipo || 'LocalBusiness',
  name: cfg.nombre, description: cfg.seo_descripcion, url: cfg.site_url,
  image: `${cfg.site_url}/img/_opt/${hero?.id}-900.webp`,
  address: { '@type': 'PostalAddress', addressLocality: aj.comuna_retiro, addressRegion: 'Región Metropolitana', addressCountry: 'CL' },
  areaServed: (aj.zonas || []).filter((z) => !z.startsWith('Otra')),
  sameAs: [`https://www.instagram.com/${aj.instagram}/`],
  hasOfferCatalog: {
    '@type': 'OfferCatalog', name: 'Productos',
    itemListElement: productos.filter((x) => x.variantes.some((v) => v.precio)).map((x) => ({
      '@type': 'Offer', priceCurrency: 'CLP', price: x.variantes.find((v) => v.precio).precio,
      itemOffered: { '@type': 'Product', name: x.nombre, description: x.descripcion },
    })),
  },
};
if (wa) jsonld.telephone = '+' + wa;

// ---- Archivos estáticos con hash
const css = `styles.${hash(p('styles.css'))}.css`;
const js = `app.${hash(p('app.js'))}.js`;
fs.copyFileSync(p('styles.css'), path.join(DIST, css));
fs.copyFileSync(p('app.js'), path.join(DIST, js));
fs.cpSync(p('admin'), path.join(DIST, 'admin'), { recursive: true });
fs.cpSync(p('data'), path.join(DIST, 'data'), { recursive: true });
if (fs.existsSync(p('favicon.ico'))) fs.copyFileSync(p('favicon.ico'), path.join(DIST, 'favicon.ico'));

// ---- HTML
const ig = `https://www.instagram.com/${aj.instagram}/`;
const mapaQ = encodeURIComponent(aj.direccion_retiro || '');
const valores = {
  NOMBRE: esc(cfg.nombre), SEO_TITULO: esc(cfg.seo_titulo), SEO_DESC: esc(cfg.seo_descripcion),
  CANONICAL: cfg.site_url, CSS: css, JS: js, TARJETAS: tarjetas, FILTROS: filtros,
  APP_CONFIG: JSON.stringify(appCfg).replace(/</g, '\\u003c'),
  JSONLD: JSON.stringify(jsonld).replace(/</g, '\\u003c'),
  WA_URL: wa ? waUrl(aj.mensaje_defecto || 'Hola!') : '', IG_URL: ig, IG_USER: esc(aj.instagram),
  HERO_IMG: hero?._img?.[1] || '', HERO_ALT: esc(hero?.nombre || ''),
  FOTO_B: productos[3]?._img?.[0] || '', FOTO_C: productos[2]?._img?.[0] || '',
  SEGUIDORES: esc(aj.seguidores), PUBLICACIONES: esc(aj.publicaciones),
  LEMA: esc(aj.lema), HERO_TITULO: esc(aj.hero_titulo), HERO_TEXTO: esc(aj.hero_texto), HISTORIA: esc(aj.historia),
  COMUNA: esc(aj.comuna_retiro), DESPACHO: aj.despacho_desde ? clp(aj.despacho_desde) : '',
  ANTICIPACION: esc(aj.anticipacion), ZONAS: (aj.zonas || []).map((z) => `<li>${esc(z)}</li>`).join(''),
  MAPA_SRC: `https://www.google.com/maps?q=${mapaQ}&output=embed`,
  MAPA_URL: `https://www.google.com/maps/search/?api=1&query=${mapaQ}`,
  MAPA_TITULO: esc(`Mapa de retiro de ${cfg.nombre}`), DIRECCION: esc(aj.direccion_retiro),
  CORREO: esc(aj.correo), GOOGLE_VER: esc(cfg.google_verificacion), ANIO: new Date().getFullYear(),
};
const flags = { WHATSAPP: !!wa, MAPA: !!aj.direccion_retiro, CORREO: !!aj.correo, GOOGLE: !!cfg.google_verificacion, FILTROS: !!filtros };

let html = fs.readFileSync(p('index.html'), 'utf8');
html = html.replace(/<!-- SI:(\w+) -->([\s\S]*?)<!-- \/SI:\1 -->/g, (_, k, c) => (flags[k] ? c : ''));
html = html.replace(/%%(\w+)%%/g, (m, k) => (k in valores ? valores[k] : m));
const resto = html.match(/%%\w+%%/g);
if (resto) console.warn('⚠ Marcadores sin reemplazar:', [...new Set(resto)].join(', '));
fs.writeFileSync(path.join(DIST, 'index.html'), html);

fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${cfg.site_url}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${cfg.site_url}/</loc></url></urlset>\n`);

console.log(`✔ Build listo: ${productos.length} productos, WhatsApp ${wa ? 'sí' : 'no'}, mapa ${flags.MAPA ? 'sí' : 'no'}.`);
