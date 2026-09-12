const FIRESTORE_KEY = 'AIzaSyDv_CmaZrHLx6-M2akr-2XZqjCYbHO6G5c';
const PROJECT_ID = 'la-saine-doctrine';
const SITE_NAME = 'La Saine Doctrine';
const SITE_URL = 'https://lasainedoctrine.org';
const DEFAULT_IMAGE = 'https://lasainedoctrine.org/images/default-cover.png';

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
}

function getField(fields, key) {
  return fields && fields[key] ? fields[key] : undefined;
}

function getLocalizedMap(fields, key) {
  // Firestore map<string,string> field -> plain JS object {fr:'..', en:'..', it:'..'}
  const f = getField(fields, key);
  const mapFields = f && f.mapValue && f.mapValue.fields;
  if (!mapFields) return {};
  const out = {};
  for (const lang of Object.keys(mapFields)) {
    out[lang] = mapFields[lang].stringValue || '';
  }
  return out;
}

function pickLocalized(map, fallback) {
  for (const lang of ['fr', 'en', 'it']) {
    if (map[lang] && map[lang].trim()) return { text: map[lang].trim(), lang };
  }
  return { text: fallback, lang: 'fr' };
}

function docToArticle(doc, slugFallback) {
  const fields = doc.fields || {};
  const titreMap = getLocalizedMap(fields, 'titre');
  const extraitMap = getLocalizedMap(fields, 'extrait');
  const { text: titre, lang } = pickLocalized(titreMap, 'Sans titre');
  const resume = extraitMap[lang] || '';
  const imageField = getField(fields, 'image');
  const image = (imageField && imageField.stringValue) || '';
  const idField = getField(fields, 'id');
  const slug = (idField && idField.stringValue) || slugFallback;
  return { titre, resume, image, lang, slug };
}

async function fetchArticleBySlug(slug) {
  // 1) Try the document directly (slug used as the Firestore document name)
  try {
    const directUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/articles/${encodeURIComponent(slug)}?key=${FIRESTORE_KEY}`;
    const res = await fetch(directUrl);
    if (res.ok) {
      const doc = await res.json();
      if (doc && doc.fields) {
        return docToArticle(doc, slug);
      }
    }
  } catch (e) {}

  // 2) Fall back to querying by the "id" field (the recalculated slug stored in the doc)
  try {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIRESTORE_KEY}`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'articles' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'id' },
            op: 'EQUAL',
            value: { stringValue: slug }
          }
        },
        limit: 1
      }
    };
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      const doc = data[0] && data[0].document;
      if (doc) {
        return docToArticle(doc, slug);
      }
    }
  } catch (e) {}

  return null;
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text || '';
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '...';
}

const CTA_TEXTS = {
  fr: "Lisez l'article complet sur La Saine Doctrine",
  en: 'Read the full article on La Saine Doctrine',
  it: "Leggi l'articolo completo su La Saine Doctrine"
};

const DEFAULT_RESUMES = {
  fr: "Un enseignement biblique pour l'édification du corps de Christ.",
  en: 'A biblical teaching for the edification of the body of Christ.',
  it: "Un insegnamento biblico per l'edificazione del corpo di Cristo."
};

const READ_MORE = {
  fr: "Lire l'article complet →",
  en: 'Read the full article →',
  it: "Leggi l'articolo completo →"
};

const LOCALE_MAP = { fr: 'fr_FR', en: 'en_US', it: 'it_IT' };

function buildDescription(resume, lang) {
  const cta = CTA_TEXTS[lang] || CTA_TEXTS.fr;
  const base = (resume && resume.trim()) ? resume.trim() : (DEFAULT_RESUMES[lang] || DEFAULT_RESUMES.fr);
  const maxBaseLength = 160 - cta.length - 3;
  return `${truncateText(base, maxBaseLength)} ${cta}`;
}

function renderPreviewHtml(article) {
  const { titre, resume, image, lang, slug } = article;
  const articleUrl = `${SITE_URL}/#/article/${slug}`;
  const pageUrl = `${SITE_URL}/p/${slug}.html`;
  const description = buildDescription(resume, lang);
  const ogImage = image || DEFAULT_IMAGE;
  const locale = LOCALE_MAP[lang] || 'fr_FR';
  const readMore = READ_MORE[lang] || READ_MORE.fr;

  const title = escapeHtml(titre);
  const desc = escapeHtml(description);
  const img = escapeHtml(ogImage);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — ${SITE_NAME}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:locale" content="${locale}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${img}">
<script>window.location.href = ${JSON.stringify(articleUrl)};</script>
<style>
body { font-family: Georgia, serif; max-width: 600px; margin: 50px auto; padding: 20px; color: #333; text-align: center; }
.cta-button { display: inline-block; background: #d4a574; color: #ffffff !important; padding: 14px 28px; border-radius: 6px; font-weight: bold; text-decoration: none; margin-top: 20px; font-size: 1.05em; }
.cta-button:hover { background: #c2955f; }
</style>
</head>
<body>
<h1>${title}</h1>
<p>${desc}</p>
<p><a href="${articleUrl}" class="cta-button">${readMore}</a></p>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if ((pathname.startsWith('/p/') || pathname.startsWith('/article/')) && pathname.endsWith('.html')) {
      const slug = pathname.replace(/^\/(p|article)\//, '').replace(/\.html$/, '');

      // 1) Build the preview page live from Firestore (always up to date, never depends
      //    on a locally pre-generated file)
      try {
        const article = await fetchArticleBySlug(slug);
        if (article) {
          return new Response(renderPreviewHtml(article), {
            headers: { 'content-type': 'text/html; charset=UTF-8' }
          });
        }
      } catch (e) {}

      // 2) Fall back to a pre-generated static file if one happens to exist
      try {
        const response = await env.ASSETS.fetch(request);
        if (response.status === 200) {
          return response;
        }
      } catch (e) {}

      // 3) Last resort: redirect to the homepage instead of crashing (this is what
      //    used to throw "Error 1101: Worker threw exception")
      return Response.redirect(SITE_URL, 302);
    }

    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response('Page indisponible pour le moment.', {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=UTF-8' }
      });
    }
  }
};
