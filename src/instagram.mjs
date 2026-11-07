// Publication via l'API officielle Instagram (Graph API, compte professionnel).
// Fonctionne avec graph.facebook.com (compte Instagram relié à une Page Facebook)
// ou graph.instagram.com (« Instagram API with Instagram Login »).
// Les médias doivent être accessibles par une URL publique (ici GitHub Pages).

const VERSION = process.env.IG_API_VERSION || 'v21.0';
const HOST = process.env.IG_API_HOST || 'graph.facebook.com';

export function igConfig() {
  const token = process.env.IG_ACCESS_TOKEN;
  const user = process.env.IG_USER_ID;
  return token && user ? { token, user } : null;
}

async function call(method, pathname, params, { token }) {
  const url = new URL(`https://${HOST}/${VERSION}/${pathname}`);
  const body = new URLSearchParams({ ...params, access_token: token });
  let res;
  if (method === 'GET') {
    for (const [k, v] of body) url.searchParams.set(k, v);
    res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  } else {
    res = await fetch(url, { method, body, signal: AbortSignal.timeout(120000) });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(`Instagram ${pathname} : ${e.message || res.status} (code ${e.code ?? '?'}, sous-code ${e.error_subcode ?? '-'})`);
  }
  return json;
}

async function waitReady(id, ig, { timeoutMs = 10 * 60e3 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const { status_code, status } = await call('GET', id, { fields: 'status_code,status' }, ig);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Conteneur ${id} : ${status_code} ${status || ''}`);
    if (Date.now() - t0 > timeoutMs) throw new Error(`Conteneur ${id} pas prêt après ${timeoutMs / 1000} s (${status_code})`);
    await new Promise((r) => setTimeout(r, 8000));
  }
}

async function publish(creationId, ig) {
  for (let i = 0; i < 4; i++) {
    try {
      return await call('POST', `${ig.user}/media_publish`, { creation_id: creationId }, ig);
    } catch (err) {
      if (i === 3) throw err;
      await new Promise((r) => setTimeout(r, 15000)); // « média pas encore prêt » : on réessaie
    }
  }
}

export async function publishCarousel(imageUrls, caption, ig) {
  const children = [];
  for (const image_url of imageUrls.slice(0, 10)) {
    const { id } = await call('POST', `${ig.user}/media`, { image_url, is_carousel_item: 'true' }, ig);
    children.push(id);
  }
  for (const id of children) await waitReady(id, ig, { timeoutMs: 3 * 60e3 });
  const { id } = await call('POST', `${ig.user}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption }, ig);
  await waitReady(id, ig, { timeoutMs: 3 * 60e3 });
  return publish(id, ig);
}

export async function publishSingle(imageUrl, caption, ig) {
  const { id } = await call('POST', `${ig.user}/media`, { image_url: imageUrl, caption }, ig);
  await waitReady(id, ig, { timeoutMs: 3 * 60e3 });
  return publish(id, ig);
}

export async function publishReel(videoUrl, coverUrl, caption, ig, { essai = false } = {}) {
  const params = { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true' };
  if (coverUrl) params.cover_url = coverUrl;
  // Trial Reel : montré d'abord aux non-abonnés, publié sur le profil s'il performe.
  if (essai) params.trial_params = JSON.stringify({ graduation_strategy: 'SS_PERFORMANCE' });
  let id;
  try {
    ({ id } = await call('POST', `${ig.user}/media`, params, ig));
  } catch (err) {
    if (!essai) throw err;
    console.log(`Reel d'essai refusé (${err.message}) : publication normale.`);
    delete params.trial_params;
    ({ id } = await call('POST', `${ig.user}/media`, params, ig));
  }
  await waitReady(id, ig);
  return publish(id, ig);
}

export async function permalink(mediaId, ig) {
  try { return (await call('GET', mediaId, { fields: 'permalink' }, ig)).permalink; } catch { return null; }
}

// --- Statistiques (permission instagram_manage_insights) ----------------------

const FEED_METRICS = ['reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'follows', 'profile_visits'];
const REEL_METRICS = ['reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'views', 'ig_reels_avg_watch_time'];

function parseInsights(json) {
  const out = {};
  for (const d of json.data || []) {
    const v = d.values?.[0]?.value ?? d.total_value?.value;
    if (typeof v === 'number') out[d.name] = v;
  }
  return out;
}

export async function insights(mediaId, isReel, ig) {
  const metrics = isReel ? REEL_METRICS : FEED_METRICS;
  let out = {};
  try {
    out = parseInsights(await call('GET', `${mediaId}/insights`, { metric: metrics.join(',') }, ig));
  } catch {
    // Une métrique non disponible fait échouer tout l'appel : on les demande une par une.
    for (const m of metrics) {
      try { Object.assign(out, parseInsights(await call('GET', `${mediaId}/insights`, { metric: m }, ig))); } catch { /* ignorée */ }
    }
  }
  // Repli sans permission « insights » : likes et commentaires publics.
  if (out.likes == null || out.comments == null) {
    try {
      const f = await call('GET', mediaId, { fields: 'like_count,comments_count' }, ig);
      out.likes ??= f.like_count;
      out.comments ??= f.comments_count;
    } catch { /* ignorée */ }
  }
  return Object.keys(out).length ? out : null;
}

export async function followers(ig) {
  const f = await call('GET', ig.user, { fields: 'followers_count' }, ig);
  return f.followers_count;
}

// Posts publics d'un autre compte professionnel (API « Business Discovery »).
export async function businessDiscovery(handle, ig) {
  const fields = `business_discovery.username(${handle}){username,followers_count,media_count,media.limit(25){caption,like_count,comments_count,media_type,media_product_type,timestamp,permalink}}`;
  const j = await call('GET', ig.user, { fields }, ig);
  return j.business_discovery;
}

// Derniers posts du compte (y compris ceux publiés à la main), pour les noter et comparer.
export async function compteMedia(ig, limit = 60) {
  const j = await call('GET', `${ig.user}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,permalink', limit: String(limit) }, ig);
  return j.data || [];
}
