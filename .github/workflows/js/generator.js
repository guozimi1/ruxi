/* =========================================================================
 * 《入戏》— 生成层（图生图 + 文案）
 * -------------------------------------------------------------------------
 * 策略（Spec 第七节 / 第十节）：
 *   1. 优先走后端转发（前端不放任何 key）：
 *        POST {API_BASE}/api/generate  → { card: {...}, portrait: dataURL|url }
 *      后端再去调元宝图生图 + 文本模型。
 *   2. 任一失败 / 无后端 / 无人脸 → 前端"按世界×角色×名字"参数化兜底，
 *      保证每人小传不同、流程不断；立绘退回做旧头像框 + 半调处理。
 * ========================================================================= */

// 后端地址：默认同源 /api；可在部署时改成你的函数地址或写到 window.RUXI_API_BASE
const API_BASE = (window.RUXI_API_BASE || '').replace(/\/$/, '');

/* ---------- 参数化文案兜底库 ---------- */
const NAME_PREFIX = {
  gongting: ['', '', '', '内廷·', '东宫·'],
  saibo:    ['NEON·', 'V-', '', '幽灵·', ''],
  minguo:   ['', '', '沪上·', '', ''],
  qihuan:   ['秘塔·', '', '星语者·', '', ''],
  jianghu:  ['', '江湖人称·', '', '', '剑下·'],
};

const ROLE_FLAVOR = {
  谋臣:   { line: '一纸一笔，皆是棋。', bioCore: '出入禁中，惯于在沉默里落子，凡经手之事必留三分余地。', tags: ['深谋', '冷静', '不显山露水'] },
  权臣:   { line: '这朝堂，该听我的。', bioCore: '从微末爬到能影响圣意，手段不温柔，却从不空手。', tags: ['野心', '强势', '善权变'] },
  将领:   { line: '边关的风，记得我的名字。', bioCore: '刀口舔血出身，认死理也认情义，朝中无人时仍守得住一座城。', tags: ['果决', '忠勇', '重义'] },
  暗卫:   { line: '你看不见我，我却看得见你。', bioCore: '宫墙的影子里长大，奉命行事，唯一的破绽是偶尔的心软。', tags: ['隐忍', '敏锐', '孤狼'] },
  忠良:   { line: '问心无愧四个字，够重。', bioCore: '清流一派，明知逆水仍要进言，身后名比眼前权更要紧。', tags: ['刚直', '清正', '不合时宜'] },
  近侍:   { line: '主子的喜怒，我先知道。', bioCore: '伴驾左右，最懂察言观色，一句话能递到天听，也能压在心底。', tags: ['机敏', '谨慎', '善揣度'] },
  黑客:   { line: '没有我进不去的系统。', bioCore: '在数据洪流里裸泳的人，键盘是武器，匿名是铠甲。', tags: ['极客', '叛逆', '冷感'] },
  义体猎人:{ line: '钢与肉，我都信。', bioCore: '半身机械，专接最脏的活，伤疤是履历，沉默是报价。', tags: ['冷硬', '狠辣', '念旧'] },
  数据掮客:{ line: '情报有价，沉默更贵。', bioCore: '游走在所有阵营之间，谁的秘密都买，谁也不真正效忠。', tags: ['圆滑', '精明', '骑墙'] },
  街头医生:{ line: '命我能救，钱别欠太久。', bioCore: '后巷诊所的主人，缝合过太多不该活下来的人，因此什么都见过。', tags: ['务实', '温吞', '见多识广'] },
  企业暗桩:{ line: '我效忠的，是更高的那层。', bioCore: '一张人畜无害的脸，背后连着冰冷的董事会，连呼吸都是任务。', tags: ['克制', '城府', '双面'] },
  报馆主笔:{ line: '这版头条，我说了算。', bioCore: '一支笔搅动十里洋场，敢登别人不敢登的，也因此总在搬家。', tags: ['锋利', '理想', '不怕事'] },
  交际名媛:{ line: '舞步之间，自有乾坤。', bioCore: '名利场的常客，笑里藏着算计，旗袍下藏着不肯认输的心。', tags: ['玲珑', '聪慧', '清醒'] },
  地下党人:{ line: '有些事，总得有人做。', bioCore: '白天是寻常面孔，夜里走另一条路，把命押在一个还没来的明天。', tags: ['坚定', '隐忍', '赤诚'] },
  洋行买办:{ line: '生意嘛，没有不能谈的。', bioCore: '中西之间的桥，也是缝里取利的人，账本比良心算得清。', tags: ['精算', '世故', '左右逢源'] },
  巡捕探长:{ line: '这码头的规矩，我立。', bioCore: '灰色地带的执法者，黑白两道都给三分面子，独缺一点干净。', tags: ['老练', '强硬', '游刃'] },
  元素法师:{ line: '让风火听我的。', bioCore: '与元素立约的人，天赋逼人也代价不菲，越强大越孤独。', tags: ['天才', '炽烈', '执拗'] },
  炼金术士:{ line: '万物皆可拆解重组。', bioCore: '在工坊里把世界拆成公式，相信没有奇迹只有尚未理解的规律。', tags: ['严谨', '偏执', '求真'] },
  召唤师:{ line: '我从不孤身一人。', bioCore: '契约异界之物为伴，温柔待友，也敢放出最危险的存在。', tags: ['温和', '担当', '深藏'] },
  游侠:   { line: '路在脚下，剑在腰间。', bioCore: '不属于任何塔与公会，靠一身本事行走，哪里有事去哪里。', tags: ['自由', '仗义', '洒脱'] },
  占星者:{ line: '星辰已写下答案。', bioCore: '读得懂命运的纹路，却总在替别人指路时，看不清自己。', tags: ['通透', '神秘', '宿命感'] },
  剑客:   { line: '一剑，便够了。', bioCore: '剑不离身的独行者，话少手快，恩怨从不过夜。', tags: ['利落', '孤傲', '快意'] },
  隐侠:   { line: '做了，便不必留名。', bioCore: '行侠仗义却不愿被记住，江湖传闻里只有他的事，没有他的脸。', tags: ['低调', '侠义', '神秘'] },
  帮主:   { line: '兄弟的事，就是我的事。', bioCore: '一帮人的主心骨，讲义气也讲规矩，肩上扛的从来不只是自己。', tags: ['豪气', '担当', '威严'] },
  神医:   { line: '救得了命，救不了人心。', bioCore: '一手回春妙术，行走江湖只为多救一人，偏又卷入太多是非。', tags: ['仁心', '淡泊', '通达'] },
  说书人:{ line: '诸位，且听我道来。', bioCore: '把别人的传奇说成段子的人，自己的故事却从不讲，茶馆是他的江湖。', tags: ['机智', '风趣', '洞察'] },
};

// 通用占位角色（占位题命中的非预设角色）也给到差异化文案模板
const GENERIC_FLAVOR = {
  line: ['命运给的牌，我自己打。', '门后的路，是我选的。', '我来，是为我自己。'],
  bioCore: '走进这个世界时，ta 没有回头。每一道门都是自己推开的，于是这里的故事，从此也有了 ta 的一笔。',
  tags: ['果敢', '独立', '有故事的人'],
};

/* 简单确定性哈希：同名字+世界+角色 → 稳定但因人而异 */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

/* ---------- 参数化兜底：生成专属角色卡（每人不同） ---------- */
function fallbackCard({ name, worldId, role, traitTags }) {
  const world = window.RUXI_WORLDS.WORLDS[worldId];
  const seed = hashStr(name + '|' + worldId + '|' + role);
  const flavor = ROLE_FLAVOR[role] || {
    line: GENERIC_FLAVOR.line[seed % GENERIC_FLAVOR.line.length],
    bioCore: GENERIC_FLAVOR.bioCore,
    tags: GENERIC_FLAVOR.tags,
  };

  const prefixPool = NAME_PREFIX[worldId] || [''];
  const prefix = prefixPool[seed % prefixPool.length];
  const char_name = name ? (prefix + name) : (prefix + '无名者');

  // 用 trait 标签 + 角色固有标签拼出"每人不同"的标签组
  const dynTags = (traitTags || []).slice(0, 2);
  const tags = Array.from(new Set([...dynTags, ...flavor.tags])).slice(0, 3);

  // 小传：角色内核 + 因穿门 trait 而异的一句 + 因名字 seed 而异的开场&收尾
  const traitClause = dynTags.length
    ? `旁人说 ta ${dynTags.join('又')}，` : '';
  // 用名字本身做一句"专属起笔"，确保同角色不同名字也有可见差异
  const openers = [
    `没人记得 ta 是哪天来的。`,
    `第一次有人喊出这个名字时，街角的人都回了头。`,
    `关于 ta 的传闻，比 ta 本人先到。`,
    `ta 来时不声不响，走时却留下不少话头。`,
    `认识 ta 的人都说，这名字记一次就忘不掉。`,
    `没人说得清 ta 的来路，只知道 ta 已经在局中。`,
  ];
  const endings = [
    `在${world.name}里，这个名字迟早会有人记住。`,
    `${world.name}的故事很长，而 ta 的，才刚翻开第一页。`,
    `没人知道 ta 能走多远，包括 ta 自己。`,
    `这一局${world.name}，因 ta 而多了一种可能。`,
    `而 ta 的故事，得由 ta 自己接着往下走。`,
    `从此${world.name}的版图上，又多了一个变数。`,
  ];
  const seed2 = hashStr(name + '#' + role + '#open');
  // 把名字直接织进小传，确保"每人不同"100%成立（同时呼应 spec：因人而异、不套话）
  const who = name || '此人';
  const nameClause = [
    `「${who}」这名字，在${world.name}里渐渐有了分量。`,
    `如今提起${who}，知情人只会意味深长地笑。`,
    `${who}，是这一页${world.name}里绕不开的一笔。`,
    `而${who}究竟会写下怎样的结局，没人替 ta 答得了。`,
  ];
  const bio = `${openers[seed2 % openers.length]}${flavor.bioCore}${traitClause}${nameClause[seed % nameClause.length]}`;

  return {
    char_name,
    public_role: role,
    entrance_line: flavor.line,
    bio,
    tags,
    _source: 'fallback',
  };
}

/* ---------- 调后端（图生图 + 文本真生成） ---------- */
async function callBackend({ name, worldId, role, traitTags, photoDataUrl }) {
  if (!API_BASE && location.protocol === 'file:') throw new Error('no-backend');
  const url = (API_BASE || '') + '/api/generate';
  const world = window.RUXI_WORLDS.WORLDS[worldId];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        name, worldId, worldName: world.name, role,
        traitTags, artStyle: world.artStyle,
        // 照片即用即弃：只在本次请求体里传，后端不得落盘存储
        photo: photoDataUrl || null,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('backend-' + res.status);
    const data = await res.json();
    return data; // { card, portrait }
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/* ---------- 立绘做旧降级：把上传照片做半调/做旧处理放进头像框 ---------- */
function makeFallbackPortrait(photoDataUrl, worldId) {
  return new Promise((resolve) => {
    if (!photoDataUrl) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      const size = 520;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      // 居中裁切
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      // 去色 + 提对比（报纸印刷感）
      const imgd = ctx.getImageData(0, 0, size, size);
      const d = imgd.data;
      for (let i = 0; i < d.length; i += 4) {
        let g = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
        g = (g - 128) * 1.25 + 128;            // 对比
        g = Math.max(0, Math.min(255, g));
        // 暖褐做旧调
        d[i] = Math.min(255, g * 1.05);
        d[i + 1] = g * 0.95;
        d[i + 2] = g * 0.78;
      }
      ctx.putImageData(imgd, 0, 0);
      // 半调网点叠加
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#000';
      for (let y = 0; y < size; y += 4) {
        for (let x = 0; x < size; x += 4) {
          if ((x + y) % 8 === 0) ctx.fillRect(x, y, 1.6, 1.6);
        }
      }
      ctx.globalAlpha = 1;
      resolve({ url: c.toDataURL('image/jpeg', 0.85), halftone: true });
    };
    img.onerror = () => resolve(null);
    img.src = photoDataUrl;
  });
}

/* ---------- 对外主入口：generateCard ----------
 * 返回 { card, portrait, source }
 * onStep(label) 用于铸造加载页同步叙事推进。
 */
async function generateCard(params, onStep) {
  const { worldId, traitTotals, name, photoDataUrl } = params;
  const { role, traitTags } = window.RUXI_WORLDS.resolveRole(worldId, traitTotals || {});

  let card = null, portrait = null, source = 'fallback';

  onStep && onStep('正在写下你的来历……');
  try {
    const data = await callBackend({ name, worldId, role, traitTags, photoDataUrl });
    if (data && data.card) { card = data.card; card._source = 'backend'; source = 'backend'; }
    if (data && data.portrait) portrait = { url: data.portrait };
  } catch (e) {
    // 静默降级
    source = 'fallback';
  }

  if (!card) card = fallbackCard({ name, worldId, role, traitTags });

  onStep && onStep('正在寻找你的容貌……');
  if (!portrait) portrait = await makeFallbackPortrait(photoDataUrl, worldId);

  onStep && onStep('正在赋予你一个名字……');
  return { card, portrait, role, source };
}

window.RUXI_GEN = { generateCard, fallbackCard, makeFallbackPortrait };
