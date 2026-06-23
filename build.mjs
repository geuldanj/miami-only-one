// Génère les pages multilingues statiques (/, /en/, /es/) depuis index.html + content.json
import { load } from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'fs';

const BASE = 'https://miamionlyone.com';
const tpl = readFileSync('index.html', 'utf8');
const content = JSON.parse(readFileSync('content.json', 'utf8'));
const i18n = content.i18n || {};
const seo = content.seo || {};
const media = (content.settings || {}).media || {};
const langs = [['fr', ''], ['en', 'en/'], ['es', 'es/']];

function setMeta($, attr, key, val) {
  const el = $(`meta[${attr}="${key}"]`);
  if (el.length && val != null) el.attr('content', val);
}

if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

for (const [lang, sub] of langs) {
  const $ = load(tpl, { decodeEntities: false });
  $('html').attr('lang', lang);

  // 1) Texte de toutes les sections (data-i18n) baké au build -> SEO + zéro flash
  $('[data-i18n]').each((_, el) => {
    const k = $(el).attr('data-i18n');
    const v = i18n[lang] && i18n[lang][k];
    if (v != null) $(el).text(v);
  });

  // 2) Balises SEO par langue
  const title = (seo[lang] && seo[lang].title) || $('title').text();
  const desc = (seo[lang] && seo[lang].description) || '';
  const url = BASE + '/' + sub;
  $('title').text(title);
  $('meta[name="description"]').attr('content', desc);
  setMeta($, 'property', 'og:title', title);
  setMeta($, 'property', 'og:description', desc);
  setMeta($, 'property', 'og:url', url);
  if (media.heroImage) setMeta($, 'property', 'og:image', BASE + media.heroImage);
  $('link[rel="canonical"]').attr('href', url);

  // 3) hreflang (toutes les versions + x-default)
  $('link[rel="alternate"][hreflang]').remove();
  const head = $('head');
  for (const [l, s] of langs) head.append(`\n<link rel="alternate" hreflang="${l}" href="${BASE}/${s}">`);
  head.append(`\n<link rel="alternate" hreflang="x-default" href="${BASE}/">`);

  // 4) Langue forcée pour le JS + onglet de langue actif
  head.append(`\n<script>window.FORCE_LANG=${JSON.stringify(lang)};</script>`);
  $('.lang-btn').removeClass('active');
  $(`.lang-btn[data-lang="${lang}"]`).addClass('active');

  // 5) Écriture
  if (sub) mkdirSync('dist/' + sub, { recursive: true });
  writeFileSync('dist/' + sub + 'index.html', $.html());
  console.log('  ✓ /' + sub + ' (' + lang + ') — ' + title);
}

// Assets
cpSync('content.json', 'dist/content.json');
cpSync('images', 'dist/images', { recursive: true });
cpSync('admin', 'dist/admin', { recursive: true });
console.log('build OK → dist/');
