// Build step (runs on Vercel): copies the app and generates one static, indexable page
// per town (/stad/<ort>) and per pizzeria (/p/<namn>-<id8>), plus sitemap.xml and robots.txt.
// If the database can't be reached, the app is still built (without the SEO pages) so a deploy never breaks.
import { mkdir, writeFile, copyFile, readFile, rm, cp } from "node:fs/promises";

const SITE = "https://pizza-meny.vercel.app";
const SB = "https://cmmnqckszwgsvaaawouw.supabase.co";
const KEY = (await readFile("app.js", "utf8")).match(/const KEY="([^"]+)"/)[1]; // public anon key, same as the app
const OUT = "dist";
const STATIC = ["index.html", "app.js", "legal.html", "manifest.json", "icon.svg", "sw.js"];
const STATIC_DIRS = ["img"];
const LEAK = ["københavn", "kobenhavn", "copenhagen", "oslo", "helsinki", "vaasa", "nykarleby"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
const slugify = (s) => String(s || "").toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/é/g, "e").replace(/ü/g, "u")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const pageSlug = (p) => slugify(p.name) + "-" + String(p.id).slice(0, 8);
const safeHttp = (u) => { u = String(u || "").trim(); return /^https?:\/\//i.test(u) && !/[\s<]/.test(u) ? u : ""; };
const safeTel = (t) => { const d = String(t || "").replace(/[^\d+]/g, ""); return d.length >= 7 ? d : ""; };
const AREA3 = ["010","011","013","016","018","019","020","021","023","026","031","033","035","036","040","042","044","046","054","060","063","090","070","071","072","073","074","076","077","078","079"];
function fmtPhone(raw) {
  let d = String(raw || "").replace(/[^\d+]/g, ""); if (!d) return "";
  if (d.startsWith("+46")) d = "0" + d.slice(3); else if (d.startsWith("0046")) d = "0" + d.slice(4); else if (d.startsWith("46") && d.length >= 10) d = "0" + d.slice(2);
  if (!/^0\d{6,10}$/.test(d)) return String(raw || "").trim();
  const ac = d.startsWith("08") ? "08" : AREA3.includes(d.slice(0, 3)) ? d.slice(0, 3) : d.slice(0, 4);
  const n = d.slice(ac.length); const g = { 5: [3, 2], 6: [2, 2, 2], 7: [3, 2, 2], 8: [3, 3, 2] }[n.length];
  if (!g) return ac + "-" + n; let i = 0; return ac + "-" + g.map((k) => { const part = n.slice(i, i + k); i += k; return part; }).join(" ");
}
const hasCoords = (p) => !!(p.lat && p.lon && !p.coords_approx);
const mapUrl = (p) => hasCoords(p)
  ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + " " + p.city)}`;
const goodDesc = (d) => { d = String(d || "").trim(); if (!d || /Källa:\s*OpenStreetMap/i.test(d) || /^(Pizza|Pizzeria|Klassisk meny) i [^.]+\.$/.test(d) || d === "Officiell kedja.") return ""; return d; };

async function fetchAll() {
  const cols = "id,name,city,country,phone,lat,lon,menu_url,description,is_sponsored,coords_approx,updated_at";
  let rows = [], off = 0, total = Infinity;
  while (off < total) {
    const r = await fetch(`${SB}/rest/v1/pizzerias?select=${cols}&hidden=is.false&order=id.asc&limit=1000&offset=${off}`,
      { headers: { apikey: KEY, Authorization: "Bearer " + KEY, Prefer: "count=exact" } });
    if (!r.ok) throw new Error("Supabase " + r.status + " " + (await r.text()).slice(0, 200));
    const page = await r.json();
    rows = rows.concat(page);
    total = parseInt((r.headers.get("content-range") || "").split("/")[1] || "0", 10) || rows.length;
    off += 1000;
    if (!page.length) break;
  }
  return rows;
}
function cleanRows(rows) {
  const seen = new Set();
  return rows.filter((p) => p && p.id && p.name && p.city && !seen.has(p.id) && seen.add(p.id)
    && !LEAK.includes(String(p.city).toLowerCase()) && ["Sverige", "Sweden", null, ""].includes(p.country ?? null));
}

const CSS = `:root{color-scheme:dark}*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0e0e0f;color:#f2f2f2;line-height:1.5}
header{background:linear-gradient(90deg,#c41e3a,#a01830);padding:14px 16px;padding-top:calc(14px + env(safe-area-inset-top,0px))}header a{color:#fff;text-decoration:none;font-weight:800}
main{max-width:720px;margin:0 auto;padding:18px 16px 48px}h1{font-size:1.45rem;margin:4px 0 6px}h2{font-size:1.05rem;margin:22px 0 8px}
p{color:#a8a8a8;margin-bottom:10px}a{color:#ff8a9a}.crumb{font-size:.85rem;margin-bottom:8px}
.card{background:#1a1a1c;border-radius:14px;padding:14px 16px;margin-bottom:10px}.card h3{font-size:1.05rem}.card h3 a{color:#f2f2f2;text-decoration:none}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.btn{flex:1;min-width:90px;text-align:center;padding:12px 0;border-radius:12px;font-weight:800;font-size:.9rem;color:#fff;text-decoration:none;background:#2a2a2c}
.ring{background:#ff3b5c}.map{background:#1a73e8}.meny{background:rgba(48,209,88,.18);color:#30d158}.app{background:#ffc400;color:#111}
.meta{font-size:.88rem;color:#a8a8a8}.towns{columns:2;column-gap:20px}.towns a{display:block;padding:4px 0;text-decoration:none}.towns span{color:#a8a8a8;font-size:.85rem}
footer{max-width:720px;margin:0 auto;padding:0 16px 40px;font-size:.78rem;color:#a8a8a8}`;

const shell = ({ title, desc, canonical, body, jsonld }) => `<!DOCTYPE html>
<html lang="sv"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="#c41e3a"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.json">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:locale" content="sv_SE"><meta property="og:site_name" content="Pizza Meny">
<meta property="og:image" content="${SITE}/img/og.png"><meta name="twitter:card" content="summary_large_image"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
<style>${CSS}</style></head><body>
<header><a href="/">🍕 Pizza Meny</a></header>
<main>${body}</main>
<footer>Uppgifterna kan vara fel, ring och kolla. Pizzerior delvis från <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a> (ODbL). <a href="/legal.html">Villkor och integritet</a></footer>
<script defer src="/_vercel/insights/script.js"></script>
</body></html>`;

function buttons(p) {
  const tel = safeTel(p.phone), web = safeHttp(p.menu_url);
  return `<div class="row">${tel ? `<a class="btn ring" href="tel:${esc(tel)}">📞 Ring</a>` : ""}<a class="btn map" href="${esc(mapUrl(p))}" rel="noopener">📍 Karta</a>${web ? `<a class="btn meny" href="${esc(web)}" rel="noopener nofollow">🍕 Meny</a>` : ""}</div>`;
}

function pizzeriaPage(p, townSlug, townCount) {
  const url = `${SITE}/p/${pageSlug(p)}`;
  const desc = goodDesc(p.description);
  const tel = safeTel(p.phone), web = safeHttp(p.menu_url);
  const jsonld = {
    "@context": "https://schema.org", "@type": "Restaurant", name: p.name, servesCuisine: "Pizza", url,
    address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: "SE" },
    ...(tel ? { telephone: fmtPhone(p.phone) } : {}), ...(web ? { hasMenu: web } : {}),
    ...(hasCoords(p) ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lon } } : {}),
  };
  const facts = [tel ? `Telefon ${esc(fmtPhone(p.phone))}` : "", web ? "meny online" : ""].filter(Boolean).join(", ");
  return shell({
    title: `${p.name} i ${p.city} – nummer, karta och meny | Pizza Meny`,
    desc: `${p.name}, pizzeria i ${p.city}.${tel ? " Ring " + fmtPhone(p.phone) + "." : ""}${web ? " Se menyn." : ""} Karta och vägbeskrivning.`,
    canonical: url, jsonld,
    body: `<p class="crumb"><a href="/stad/">Alla orter</a> › <a href="/stad/${townSlug}">${esc(p.city)}</a></p>
<h1>${esc(p.name)}</h1><p class="meta">Pizzeria i ${esc(p.city)}${facts ? " · " + facts : ""}</p>
${desc ? `<p>${esc(desc)}</p>` : ""}${buttons(p)}
<div class="row"><a class="btn app" href="/?p=${esc(p.id)}">Öppna i Pizza Meny</a></div>
${hasCoords(p) ? "" : `<p class="meta" style="margin-top:12px">Exakt adress saknas, kartan söker på namnet.</p>`}
<h2>Äger du ${esc(p.name)}?</h2><p>Öppna pizzerian i appen och tryck Äg. Vi ringer och bekräftar, och hjälper dig sedan att rätta uppgifter och lägga in menyn.</p>
<p><a href="/stad/${townSlug}">Fler pizzerior i ${esc(p.city)} (${townCount})</a></p>`,
  });
}

function townPage(town, list, slug) {
  const url = `${SITE}/stad/${slug}`;
  const withPhone = list.filter((p) => safeTel(p.phone)).length, withMenu = list.filter((p) => safeHttp(p.menu_url)).length;
  const jsonld = { "@context": "https://schema.org", "@type": "ItemList", name: `Pizzerior i ${town}`, numberOfItems: list.length,
    itemListElement: list.slice(0, 100).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/p/${pageSlug(p)}`, name: p.name })) };
  return shell({
    title: `Pizzeria ${town} – ${list.length} pizzerior med nummer och meny | Pizza Meny`,
    desc: `${list.length} pizzerior i ${town}. ${withPhone} med telefonnummer och ${withMenu} med meny online. Ring direkt eller se på kartan.`,
    canonical: url, jsonld,
    body: `<p class="crumb"><a href="/stad/">Alla orter</a></p><h1>Pizzerior i ${esc(town)}</h1>
<p>${list.length} ${list.length === 1 ? "pizzeria" : "pizzerior"} · ${withPhone} med telefon · ${withMenu} med meny online.</p>
<div class="row" style="margin-bottom:16px"><a class="btn app" href="/?stad=${encodeURIComponent(town)}">Öppna ${esc(town)} i appen</a></div>
${list.map((p) => `<div class="card"><h3><a href="/p/${pageSlug(p)}">${esc(p.name)}</a></h3>${buttons(p)}</div>`).join("\n")}
<p style="margin-top:18px">Saknas en pizzeria i ${esc(town)}? <a href="/">Tipsa oss i appen</a>.</p>`,
  });
}

function townsIndex(towns) {
  return shell({
    title: "Pizzerior i hela Sverige – alla orter | Pizza Meny",
    desc: `Pizzerior i ${towns.length} orter i Sverige med telefonnummer, karta och meny.`,
    canonical: `${SITE}/stad/`,
    body: `<h1>Alla orter</h1><p>${towns.reduce((s, t) => s + t.list.length, 0)} pizzerior i ${towns.length} orter.</p>
<div class="towns">${towns.map((t) => `<a href="/stad/${t.slug}">${esc(t.town)} <span>${t.list.length}</span></a>`).join("")}</div>`,
  });
}

const score = (p) => (p.is_sponsored ? 100 : 0) + (safeHttp(p.menu_url) ? 2 : 0) + (safeTel(p.phone) ? 2 : 0) + (hasCoords(p) ? 1 : 0);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const f of STATIC) await copyFile(f, `${OUT}/${f}`);
for (const d of STATIC_DIRS) await cp(d, `${OUT}/${d}`, { recursive: true });
await writeFile(`${OUT}/404.html`, shell({ title: "Sidan finns inte | Pizza Meny", desc: "Sidan finns inte.", canonical: SITE + "/",
  body: `<h1>Sidan finns inte</h1><p>Pizzerian kan ha stängt eller flyttats.</p><div class="row"><a class="btn app" href="/">Till Pizza Meny</a><a class="btn" href="/stad/">Alla orter</a></div>` }));

const today = new Date().toISOString().slice(0, 10);
const urls = [{ loc: `${SITE}/`, pri: "1.0" }];
let rows = [];
try {
  rows = cleanRows(process.env.BUILD_FIXTURE ? JSON.parse(await readFile(process.env.BUILD_FIXTURE, "utf8")) : await fetchAll());
} catch (e) {
  console.warn("WARNING: could not load pizzerias, building app without SEO pages:", e.message);
}

if (rows.length) {
  const byTown = new Map();
  for (const p of rows) { const k = p.city.trim(); if (!byTown.has(k)) byTown.set(k, []); byTown.get(k).push(p); }
  const usedTown = new Set();
  const towns = [...byTown.entries()].map(([town, list]) => {
    let slug = slugify(town) || "ort"; while (usedTown.has(slug)) slug += "-2"; usedTown.add(slug);
    list.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, "sv"));
    return { town, slug, list };
  }).sort((a, b) => a.town.localeCompare(b.town, "sv"));

  await mkdir(`${OUT}/stad`, { recursive: true });
  await mkdir(`${OUT}/p`, { recursive: true });
  await writeFile(`${OUT}/stad/index.html`, townsIndex(towns));
  urls.push({ loc: `${SITE}/stad/`, pri: "0.8" });
  const usedP = new Set();
  for (const t of towns) {
    await writeFile(`${OUT}/stad/${t.slug}.html`, townPage(t.town, t.list, t.slug));
    urls.push({ loc: `${SITE}/stad/${t.slug}`, pri: "0.7" });
    for (const p of t.list) {
      const s = pageSlug(p); if (usedP.has(s)) continue; usedP.add(s);
      await writeFile(`${OUT}/p/${s}.html`, pizzeriaPage(p, t.slug, t.list.length));
      urls.push({ loc: `${SITE}/p/${s}`, pri: "0.5", mod: String(p.updated_at || "").slice(0, 10) });
    }
  }
  console.log(`Generated ${towns.length} town pages and ${usedP.size} pizzeria pages.`);
}

urls.push({ loc: `${SITE}/legal.html`, pri: "0.2" });
await writeFile(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `<url><loc>${esc(u.loc)}</loc><lastmod>${u.mod || today}</lastmod><priority>${u.pri}</priority></url>`).join("\n") + `\n</urlset>\n`);
await writeFile(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`sitemap.xml: ${urls.length} URLs`);
