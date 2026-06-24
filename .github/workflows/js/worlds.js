/* =========================================================================
 * 《入戏》— 题库 & 世界数据层
 * -------------------------------------------------------------------------
 * 严格按 Spec 第十一节实现：
 *   - 4 道通用分流门（决定进入哪个世界）
 *   - 每个世界 5 道专属门（宫廷权谋为完整样板，其余为结构一致的占位题）
 * 门面文字只描述"情境/选择"，不剧透结果；括号内 tag 仅供后台映射，用户不可见。
 *
 * 设计说明（给后续补全留口子）：
 *   - 每道门两个选项各带一个 axis 权重向量，分流门累计权重 → 命中世界大类
 *   - 专属门各选项带 trait 标签，累计 → 该世界内的"角色定位"
 *   - 想新增世界：在 WORLDS 里加一项 + DIVERGE_MAP 加映射 + worldQuestions 加 5 道题
 * ========================================================================= */

/* ---------- 世界定义 ----------
 * skin: 报纸版式皮肤键（结果页据此切换模板）
 * tone: 铸造加载页 / 整体氛围色调
 * artStyle: 图生图画风 prompt 模板（同世界固定，保证群像统一）
 * roles: 该世界内可生成的"角色定位"池（由专属门 trait 命中）
 */
const WORLDS = {
  gongting: {
    id: 'gongting',
    name: '宫廷权谋',
    category: 'guofeng',
    paperName: '邸报',                 // 报头：像这个世界的一份报纸
    masthead: '大內邸報',
    edition: '禁中號外',
    skin: 'guofeng',                   // 报纸皮肤：古籍/邸报/卷宗
    tone: { ink: '#c9a86a', bg: '#0d0b08', accent: '#b8863b' },
    narrate: '你要去的世界，是一座深宫。红墙之内，每一步都算数。',
    artStyle: '工笔淡彩古风人物，宫廷服饰，水墨晕染背景，胶片做旧颗粒质感',
    complete: true,
    roles: ['谋臣', '权臣', '将领', '暗卫', '忠良', '近侍'],
  },
  saibo: {
    id: 'saibo',
    name: '赛博都市',
    category: 'scifi',
    paperName: '数据快讯',
    masthead: 'NEON://日報',
    edition: 'GLITCH 號外',
    skin: 'cyber',
    tone: { ink: '#5ef0e0', bg: '#05070d', accent: '#ff3b6b' },
    narrate: '你要去的世界，霓虹从不熄灭。数据在血管里流动。',
    artStyle: '赛博朋克霓虹人物肖像，故障艺术，扫描线，胶片噪点',
    complete: false,
    roles: ['黑客', '义体猎人', '数据掮客', '街头医生', '企业暗桩'],
  },
  minguo: {
    id: 'minguo',
    name: '民国旧梦',
    category: 'modern',
    paperName: '申報',
    masthead: '滬上申報',
    edition: '本埠特刊',
    skin: 'minguo',
    tone: { ink: '#d8c4a0', bg: '#0e0b07', accent: '#9c6b3f' },
    narrate: '你要去的世界，是十里洋场。旗袍与硝烟，旧梦未醒。',
    artStyle: '民国老照片风格人物，月份牌画风，泛黄做旧，胶片颗粒',
    complete: false,
    roles: ['报馆主笔', '交际名媛', '地下党人', '洋行买办', '巡捕探长'],
  },
  qihuan: {
    id: 'qihuan',
    name: '魔法学院',
    category: 'fantasy',
    paperName: '公會布告',
    masthead: '秘塔週報',
    edition: '晨鐘號',
    skin: 'fantasy',
    tone: { ink: '#cdb6ff', bg: '#0a0810', accent: '#8b6fd6' },
    narrate: '你要去的世界，魔力在空气里低语。古老的塔，等你登临。',
    artStyle: '奇幻魔法师肖像，羊皮卷质感，符文微光，胶片做旧',
    complete: false,
    roles: ['元素法师', '炼金术士', '召唤师', '游侠', '占星者'],
  },
  jianghu: {
    id: 'jianghu',
    name: '江湖武侠',
    category: 'guofeng',
    paperName: '江湖榜',
    masthead: '風波榜',
    edition: '武林帖',
    skin: 'guofeng',
    tone: { ink: '#c9a86a', bg: '#0c0a07', accent: '#9c7a3a' },
    narrate: '你要去的世界，刀光与酒气同在。江湖路远，你是谁的传说。',
    artStyle: '武侠水墨人物，写意背景，刀剑，胶片做旧颗粒',
    complete: false,
    roles: ['剑客', '隐侠', '帮主', '神医', '说书人'],
  },
};

/* ---------- 4 道通用分流门（Spec 第十一节 A） ----------
 * axis 维度：
 *   inworld(入世) vs outworld(出世)
 *   real(现实)   vs fantasy(奇幻/科幻)
 *   scheme(谋略) vs strange(奇异)
 *   seen(被记住) vs hidden(暗处)
 * 每个选项给相关维度 +1。
 */
const DIVERGE_QUESTIONS = [
  {
    id: 'd1',
    text: '夜里你被一阵声音唤醒，你循着——',
    env: '门后的风，带着远处的气味。',
    left:  { label: '远处的钟鼓与人声', axis: { inworld: 1, real: 1 } },
    right: { label: '天边的微光与异响', axis: { outworld: 1, fantasy: 1 } },
  },
  {
    id: 'd2',
    text: '面前有两条路，你更想要——',
    env: null,
    left:  { label: '脚下踏实的土地', axis: { real: 1, inworld: 1 } },
    right: { label: '未知的远方',     axis: { fantasy: 1, outworld: 1 } },
  },
  {
    id: 'd3',
    text: '如果给你一样东西傍身，你选——',
    env: '有些东西，握在手里就改变了你。',
    left:  { label: '一封看不懂的旧信', axis: { scheme: 1, real: 1 } },
    right: { label: '一枚会发光的石头', axis: { strange: 1, fantasy: 1 } },
  },
  {
    id: 'd4',
    text: '你更愿意成为——',
    env: null,
    left:  { label: '人群中那个被记住的人', axis: { seen: 1, inworld: 1 } },
    right: { label: '暗处看清一切的人',     axis: { hidden: 1, scheme: 1 } },
  },
];

/* ---------- 分流映射 ----------
 * 根据 4 道门累计的 axis，算出最契合的世界。
 * 每个世界给一个"理想画像"权重；点积最高者胜出，同分用 tieBreak 顺序打破。
 */
const WORLD_PROFILE = {
  gongting: { inworld: 2, real: 2, scheme: 2, seen: 1 },        // 入世+现实+谋略+被记住
  minguo:   { inworld: 2, real: 1, scheme: 1, hidden: 1 },       // 入世+现实，带点暗线
  jianghu:  { inworld: 1, real: 1, seen: 1, hidden: 1 },         // 入世现实但更野
  saibo:    { outworld: 2, fantasy: 1, strange: 2, hidden: 2 },  // 出世+奇异+暗处
  qihuan:   { outworld: 2, fantasy: 2, strange: 1, seen: 1 },    // 出世+奇幻
};
const TIE_BREAK = ['gongting', 'saibo', 'minguo', 'qihuan', 'jianghu'];

function decideWorld(axisTotals) {
  let best = null, bestScore = -Infinity;
  for (const wid of TIE_BREAK) {
    const profile = WORLD_PROFILE[wid];
    let score = 0;
    for (const k in profile) score += (axisTotals[k] || 0) * profile[k];
    // 加入一点确定性扰动：让同一组合稳定命中同一世界
    if (score > bestScore) { bestScore = score; best = wid; }
  }
  return best || 'gongting';
}

/* ---------- 各世界 5 道专属门 ----------
 * 宫廷权谋 = 完整样板（Spec 第十一节 B）。
 * 其余世界 = 结构一致的占位题（trait 已铺好，文案可后续替换）。
 * 每个选项的 trait 累计 → 决定该世界内的角色定位（见 resolveRole）。
 */
const WORLD_QUESTIONS = {
  gongting: [
    { id: 'g5', text: '初入宫闱，你先——', env: '宫墙很高，风也学会了拐弯。',
      left:  { label: '结交一位掌权的人', trait: { 攀附: 1, 谋臣: 1 } },
      right: { label: '摸清这宫里的规矩', trait: { 隐忍: 1, 暗线: 1 } } },
    { id: 'g6', text: '有人递来一个秘密，你——', env: null,
      left:  { label: '收下，留作筹码', trait: { 权谋: 1, 野心: 1 } },
      right: { label: '装作没看见',     trait: { 自保: 1, 谨慎: 1 } } },
    { id: 'g7', text: '面对比你高位的人，你——', env: '有些人天生就在你头顶。',
      left:  { label: '正面相争', trait: { 锋芒: 1, 将相: 1 } },
      right: { label: '以退为进', trait: { 城府: 1, 谋士: 1 } } },
    { id: 'g8', text: '深夜还醒着的你在——', env: null,
      left:  { label: '研读卷宗', trait: { 文: 1, 谋臣: 1 } },
      right: { label: '练一套拳脚', trait: { 武: 1, 将领: 1 } } },
    { id: 'g9', text: '你真正想要的，是——', env: '说出来的那一刻，路就定了。',
      left:  { label: '一人之下的权位', trait: { 权臣: 1 } },
      right: { label: '一个干净的身后名', trait: { 忠良: 1 } } },
  ],
  // ---- 以下为占位题（结构一致，方便补全）----
  saibo: makePlaceholderQuestions('saibo', [
    ['霓虹灯下你接的第一单——', '潜入数据塔', '街头改造义体'],
    ['有人出价买你的沉默，你——', '加价反咬', '转手卖给对家'],
    ['系统警报响起，你——', '正面黑进去', '从阴影里绕过'],
    ['你信任的是——', '自己的代码', '街头的人脉'],
    ['你想要的结局——', '掀翻巨头', '活着退场'],
  ], ['黑客', '义体猎人', '数据掮客', '街头医生', '企业暗桩']),
  minguo: makePlaceholderQuestions('minguo', [
    ['初到上海滩，你先——', '混进报馆', '出入舞厅'],
    ['一封匿名信寄到你手上，你——', '登报揭穿', '悄悄查证'],
    ['乱世里你押注——', '笔杆子', '人情账'],
    ['深夜你在——', '赶稿排版', '周旋应酬'],
    ['你真正图的是——', '一篇惊世文章', '一份安稳'],
  ], ['报馆主笔', '交际名媛', '地下党人', '洋行买办', '巡捕探长']),
  qihuan: makePlaceholderQuestions('qihuan', [
    ['踏入秘塔，你先去——', '元素回廊', '炼金工坊'],
    ['古书里夹着一道封印，你——', '当场解开', '抄录研究'],
    ['同窗求助，你——', '正面护他', '暗中布阵'],
    ['你最常握着的是——', '法杖', '羊皮卷'],
    ['你追求的真理是——', '力量的极限', '世界的真相'],
  ], ['元素法师', '炼金术士', '召唤师', '游侠', '占星者']),
  jianghu: makePlaceholderQuestions('jianghu', [
    ['初入江湖，你落脚——', '热闹酒肆', '荒僻客栈'],
    ['路遇不平，你——', '拔刀就上', '记下再算'],
    ['有人要拜你为师，你——', '收下徒弟', '独来独往'],
    ['你练的是——', '一柄快剑', '一身内功'],
    ['你想留下的是——', '一个名号', '一段安生'],
  ], ['剑客', '隐侠', '帮主', '神医', '说书人']),
};

function makePlaceholderQuestions(worldId, items, roles) {
  return items.map((it, i) => {
    const [text, l, r] = it;
    const lRole = roles[i % roles.length];
    const rRole = roles[(i + 1) % roles.length];
    return {
      id: worldId + '_' + (i + 5),
      text,
      env: i % 2 === 0 ? '门后的世界，正等你做出选择。' : null,
      placeholder: true,
      left:  { label: l, trait: { [lRole]: 1, 主动: 1 } },
      right: { label: r, trait: { [rRole]: 1, 内敛: 1 } },
    };
  });
}

/* ---------- 由专属门 trait 解析出该世界内的角色定位 ---------- */
function resolveRole(worldId, traitTotals) {
  const world = WORLDS[worldId];
  const pool = world.roles;
  // 命中专属门里直接出现过的角色名，取累计最高者
  let best = null, bestScore = -1;
  for (const role of pool) {
    const score = traitTotals[role] || 0;
    if (score > bestScore) { bestScore = score; best = role; }
  }
  // 若没有任何角色命中（占位题已保证有命中），用 trait 哈希兜底保多样
  if (bestScore <= 0) {
    const keys = Object.keys(traitTotals);
    const h = keys.reduce((a, k) => a + (traitTotals[k] || 0) * k.length, pool.length);
    best = pool[h % pool.length];
  }
  // 收集前几个性格 trait 作为标签来源
  const traitTags = Object.keys(traitTotals)
    .filter(k => !pool.includes(k))
    .sort((a, b) => traitTotals[b] - traitTotals[a]);
  return { role: best, traitTags };
}

window.RUXI_WORLDS = {
  WORLDS, DIVERGE_QUESTIONS, WORLD_QUESTIONS,
  decideWorld, resolveRole,
};
