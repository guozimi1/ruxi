/* =========================================================================
 * 《入戏》— 后端转发函数（Netlify Functions 版）
 * -------------------------------------------------------------------------
 * 作用：前端不放任何模型 key。前端 POST 到 /api/generate，
 *       本函数在服务端用环境变量里的 key 去调：
 *         1) 文本模型 → 生成 spec 第七节 JSON 结构的人设文案（每人不同）
 *         2) 图生图（元宝/混元）→ 把照片做结构引导生成该世界画风立绘
 *       任一失败则返回部分结果，前端再走参数化兜底，流程不断。
 *
 * 部署：
 *   - Netlify：本文件放 netlify/functions/，netlify.toml 已把 /api/* 重定向到这里。
 *   - 在 Netlify 后台配置环境变量：
 *       LLM_API_URL / LLM_API_KEY / LLM_MODEL        （文本模型，OpenAI 兼容格式）
 *       IMG_API_URL / IMG_API_KEY                    （图生图，可选）
 *   - 照片即用即弃：本函数不落盘、不存储 photo，仅在本次请求中转发。
 * ========================================================================= */

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: '{"error":"method"}' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: cors, body: '{"error":"bad json"}' }; }

  const { name, worldName, role, traitTags, artStyle, photo } = body;

  const result = { card: null, portrait: null };

  // ---------- 1) 文本：真生成人设文案 ----------
  try {
    if (process.env.LLM_API_URL && process.env.LLM_API_KEY) {
      result.card = await genText({ name, worldName, role, traitTags });
    }
  } catch (e) { /* 静默，前端兜底 */ }

  // ---------- 2) 图生图：该世界画风立绘 ----------
  try {
    if (photo && process.env.IMG_API_URL && process.env.IMG_API_KEY) {
      result.portrait = await genImage({ photo, artStyle, worldName });
    }
  } catch (e) { /* 静默，前端兜底 */ }

  return { statusCode: 200, headers: cors, body: JSON.stringify(result) };
};

/* ---- 文本模型（OpenAI 兼容 chat/completions） ---- */
async function genText({ name, worldName, role, traitTags }) {
  const sys = `你是"世界铸造官"。为用户生成一张独一无二的角色卡，文案必须因人而异、贴合世界，不要套话。只返回 JSON，不要任何额外文字。`;
  const user = `用户真名：${name}\n所选世界：${worldName}\n由穿门选择得出的角色定位：${role}（特质：${(traitTags||[]).join('、')}）\n返回 JSON：{"char_name":"角色名(真名或贴合世界的赐名)","public_role":"公开身份","entrance_line":"一句登场白,15字内","bio":"人物小传,60-100字,独特有钩子,呼应其穿门选择","tags":["标签1","标签2","标签3"]}`;

  const res = await fetchJSON(process.env.LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.LLM_API_KEY,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      temperature: 0.95,
      response_format: { type: 'json_object' },
    }),
  }, 20000);

  const txt = res?.choices?.[0]?.message?.content || '';
  const json = JSON.parse(extractJSON(txt));
  json._source = 'backend';
  return json;
}

/* ---- 图生图（占位：按你的元宝/混元接口实现）----
 * 这里给出 OpenAI image-edit 兼容形态示意；接元宝时替换 URL/字段即可。
 * 返回值需为图片 URL 或 dataURL 字符串。
 */
async function genImage({ photo, artStyle, worldName }) {
  const prompt = `${artStyle}；保留人物面部结构特征，融入「${worldName}」世界画风与胶片做旧质感；denoising 0.55`;
  const res = await fetchJSON(process.env.IMG_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.IMG_API_KEY,
    },
    body: JSON.stringify({ prompt, image: photo, strength: 0.6 }),
  }, 25000);
  // 兼容多种返回结构
  return res?.data?.[0]?.url || res?.data?.[0]?.b64_json
    ? (res.data[0].url || ('data:image/png;base64,' + res.data[0].b64_json))
    : (res?.image || res?.url || null);
}

/* ---- 工具 ---- */
async function fetchJSON(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error('upstream ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
function extractJSON(s) {
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) return s.slice(a, b + 1);
  return s;
}
