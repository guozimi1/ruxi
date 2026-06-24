/* =========================================================================
 * 《入戏》— 后端转发函数（Vercel / Edge 兼容版）
 * 与 netlify/functions/generate.js 逻辑一致；Vercel 会把 /api/generate 自动路由到这里。
 * 前端不放任何 key；照片即用即弃，本函数不存储。
 * 环境变量：LLM_API_URL / LLM_API_KEY / LLM_MODEL / IMG_API_URL / IMG_API_KEY
 * ========================================================================= */

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body) {
    // 某些运行时不自动解析
    body = await readBody(req);
  }

  const { name, worldName, role, traitTags, artStyle, photo } = body || {};
  const result = { card: null, portrait: null };

  try {
    if (process.env.LLM_API_URL && process.env.LLM_API_KEY) {
      result.card = await genText({ name, worldName, role, traitTags });
    }
  } catch (e) {}

  try {
    if (photo && process.env.IMG_API_URL && process.env.IMG_API_KEY) {
      result.portrait = await genImage({ photo, artStyle, worldName });
    }
  } catch (e) {}

  res.status(200).json(result);
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function genText({ name, worldName, role, traitTags }) {
  const sys = `你是"世界铸造官"。为用户生成一张独一无二的角色卡，文案必须因人而异、贴合世界，不要套话。只返回 JSON，不要任何额外文字。`;
  const user = `用户真名：${name}\n所选世界：${worldName}\n角色定位：${role}（特质：${(traitTags||[]).join('、')}）\n返回 JSON：{"char_name":"角色名","public_role":"公开身份","entrance_line":"登场白,15字内","bio":"人物小传,60-100字,独特有钩子","tags":["标签1","标签2","标签3"]}`;
  const r = await fetchJSON(process.env.LLM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.LLM_API_KEY },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      temperature: 0.95, response_format: { type: 'json_object' },
    }),
  }, 20000);
  const txt = r?.choices?.[0]?.message?.content || '';
  const json = JSON.parse(extractJSON(txt));
  json._source = 'backend';
  return json;
}

async function genImage({ photo, artStyle, worldName }) {
  const prompt = `${artStyle}；保留人物面部结构特征，融入「${worldName}」世界画风与胶片做旧质感；denoising 0.55`;
  const r = await fetchJSON(process.env.IMG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.IMG_API_KEY },
    body: JSON.stringify({ prompt, image: photo, strength: 0.6 }),
  }, 25000);
  if (r?.data?.[0]) return r.data[0].url || ('data:image/png;base64,' + r.data[0].b64_json);
  return r?.image || r?.url || null;
}

async function fetchJSON(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
  try {
    const rr = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    if (!rr.ok) throw new Error('upstream ' + rr.status);
    return await rr.json();
  } finally { clearTimeout(t); }
}
function extractJSON(s) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); return (a >= 0 && b > a) ? s.slice(a, b + 1) : s; }
