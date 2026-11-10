// Test rapide des clés IA (une toute petite requête par IA, coût négligeable) : dit si chaque IA répond,
// ou pourquoi elle refuse (crédit épuisé, clé invalide…). Ne montre jamais la valeur des clés.
//   Lancé sur GitHub : workflow « Teufy — tester les IA » (bouton Run workflow).
const res = [];
async function gemini() {
  const cle = (process.env.GEMINI_API_KEY || '').trim(); if (!cle) return 'clé absente';
  const API = 'https://generativelanguage.googleapis.com/v1beta/models';
  const l = await (await fetch(`${API}?pageSize=200&key=${cle}`)).json().catch(() => ({}));
  const conf = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'))).llm?.modele_gemini;
  let m = conf || (l.models || []).map((x) => x.name.replace('models/', '')).filter((n) => /^gemini-[\d.]+-flash$/.test(n)).sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)))[0] || 'gemini-3.8-flash';
  const essai = (mod) => fetch(`${API}/${mod}:generateContent?key=${cle}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Réponds juste OK.' }] }], generationConfig: { maxOutputTokens: 5 } }) });
  let r = await essai(m); let t = await r.text();
  const conseil = r.status === 404 && t.match(/use models\/([\w.-]+)/)?.[1];
  if (conseil) { m = conseil; r = await essai(m); t = await r.text(); }
  return r.ok ? `✓ répond (${m})` : `✗ HTTP ${r.status} : ${(() => { try { return JSON.parse(t).error.message; } catch { return t.slice(0, 200); } })()}`;
}
async function anthropic() {
  if (!(process.env.ANTHROPIC_API_KEY || '').trim()) return 'clé absente';
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY.trim(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 5, messages: [{ role: 'user', content: 'Réponds juste OK.' }] }) });
  const t = await r.text();
  return r.ok ? '✓ répond' : `✗ HTTP ${r.status} : ${(() => { try { return JSON.parse(t).error.message; } catch { return t.slice(0, 200); } })()}`;
}
for (const [nom, f] of [['Gemini', gemini], ['Anthropic (Claude)', anthropic]]) res.push(`${nom} : ${await f().catch((e) => `✗ ${e.message}`)}`);
console.log(res.join('\n'));
