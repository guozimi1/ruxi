/* =========================================================================
 * 《入戏》— 主控 app.js
 * 串起：落地 → 穿门(4分流+5专属) → 世界揭示 → 名字/照片 → 铸造加载 →
 *        复古报纸结果 → 邀请 → 群像 → 元宝续写
 * ========================================================================= */
(function(){
'use strict';

const { WORLDS, DIVERGE_QUESTIONS, WORLD_QUESTIONS, decideWorld, resolveRole } = window.RUXI_WORLDS;
const STORE = window.RUXI_STORE;
const GEN = window.RUXI_GEN;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ---------- 解决移动端 100vh 抖动 ---------- */
function fixVH(){ document.documentElement.style.setProperty('--vh', window.innerHeight + 'px'); }
fixVH(); window.addEventListener('resize', fixVH);

/* ---------- 全局会话状态 ---------- */
const S = {
  mode: 'create',          // create | join
  room: null,              // { worldId, worldKey, hostName }
  phase: 'diverge',        // diverge | exclusive
  qIndex: 0,
  questions: [],           // 当前题组
  history: [],             // 选择历史（用于回退 + 命运凝聚光点）
  axisTotals: {},
  traitTotals: {},
  worldKey: null,
  name: '',
  photoDataUrl: null,
  card: null,
  portrait: null,
  role: null,
};

/* ---------- 场景切换 ---------- */
let curScene = null;
function go(id){
  if (curScene) curScene.classList.remove('active');
  const el = document.getElementById('scene-' + id);
  el.classList.add('active');
  curScene = el;
  $('#topHome').style.display = (id === 'landing') ? 'none' : 'block';
  if (el.scrollTop !== undefined) el.scrollTop = 0;
}

function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 1800);
}

/* ---------- 旁白工具 ---------- */
function showNarr(el, text, delay){
  if (text != null) el.innerHTML = text;
  el.classList.remove('show');
  setTimeout(()=>el.classList.add('show'), delay || 60);
}

/* =========================================================================
 * 启动：判断是创世还是被邀请
 * ========================================================================= */
function boot(){
  const joinInfo = STORE.parseHash();
  if (joinInfo){
    S.mode = 'join';
    S.room = joinInfo;
    // 被邀请：落地页文案稍变，强调"进入同一个世界"
    $('#landingNarr').innerHTML =
      `有人为你推开了一扇门……<br>${joinInfo.hostName ? joinInfo.hostName + ' ' : ''}创建的世界，正等你登场。`;
    $('#btnCreate').textContent = '走进这个世界';
    $('#btnJoin').style.display = 'none';
  }
  go('landing');
  setTimeout(()=>$('#landingNarr').classList.add('show'), 400);
}

/* =========================================================================
 * 穿门流程
 * ========================================================================= */
function startDoors(){
  S.phase = 'diverge';
  S.qIndex = 0;
  S.questions = DIVERGE_QUESTIONS;
  S.history = [];
  S.axisTotals = {};
  S.traitTotals = {};
  renderProgress();
  go('doors');
  renderQuestion();
}

function renderProgress(){
  const box = $('#doorProgress');
  box.innerHTML = '';
  const total = 9;
  const passed = S.phase === 'diverge' ? S.qIndex : 4 + S.qIndex;
  for (let i = 0; i < total; i++){
    const i_ = document.createElement('i');
    if (i < passed) i_.className = 'done';
    else if (i === passed) i_.className = 'cur';
    box.appendChild(i_);
  }
}

function renderQuestion(){
  const q = S.questions[S.qIndex];
  // 环境旁白（穿门途中偶尔一行）
  const env = $('#envLine');
  if (q.env){ showNarr(env, q.env, 80); }
  else { env.classList.remove('show'); env.innerHTML=''; }

  $('#doorQuestion').textContent = q.text;
  $('#labelLeft').textContent = q.left.label;
  $('#labelRight').textContent = q.right.label;
  $('#doorLeft').classList.remove('lean-left','lean-right');
  $('#doorRight').classList.remove('lean-left','lean-right');
  $('#doorBack').style.visibility = (S.history.length > 0) ? 'visible' : 'hidden';
  renderProgress();
}

/* 选择某扇门 */
function choose(side){
  const q = S.questions[S.qIndex];
  const opt = side === 'left' ? q.left : q.right;
  // 累计权重
  if (opt.axis) for (const k in opt.axis) S.axisTotals[k] = (S.axisTotals[k]||0) + opt.axis[k];
  if (opt.trait) for (const k in opt.trait) S.traitTotals[k] = (S.traitTotals[k]||0) + opt.trait[k];
  S.history.push({ phase: S.phase, qIndex: S.qIndex, side, opt });

  playThrough(()=>{
    advance();
  });
}

function advance(){
  if (S.phase === 'diverge'){
    if (S.qIndex < 3){ S.qIndex++; renderQuestion(); return; }
    // 4 道分流完成 → 决定世界
    decideAndReveal();
    return;
  }
  // exclusive
  if (S.qIndex < S.questions.length - 1){ S.qIndex++; renderQuestion(); return; }
  // 9 道完成 → 名字照片
  go('input');
}

/* 回退一步 */
function back(){
  if (!S.history.length) return;
  const last = S.history.pop();
  // 撤销权重
  if (last.opt.axis) for (const k in last.opt.axis) S.axisTotals[k] -= last.opt.axis[k];
  if (last.opt.trait) for (const k in last.opt.trait) S.traitTotals[k] -= last.opt.trait[k];
  S.phase = last.phase;
  S.qIndex = last.qIndex;
  S.questions = S.phase === 'diverge' ? DIVERGE_QUESTIONS : WORLD_QUESTIONS[S.worldKey];
  renderQuestion();
}

/* 穿门过场：镜头穿过黑暗 */
function playThrough(cb){
  const t = $('#through');
  t.classList.remove('run');
  void t.offsetWidth;
  t.classList.add('run');
  setTimeout(cb, 300);
  setTimeout(()=>t.classList.remove('run'), 640);
}

/* 分流完成 → 揭示世界 */
function decideAndReveal(){
  // join 模式：好友被引导进入房主的世界（spec：同处一个世界），但角色仍由后续专属门自己答
  let worldKey;
  if (S.mode === 'join' && S.room && WORLDS[S.room.worldKey]){
    worldKey = S.room.worldKey;
  } else {
    worldKey = decideWorld(S.axisTotals);
  }
  S.worldKey = worldKey;
  const w = WORLDS[worldKey];

  go('reveal');
  $('#revealName').classList.remove('show');
  $('#revealDesc').classList.remove('show');
  $('#revealTip').textContent = S.mode === 'join'
    ? '你被引向的世界，正在显现……'
    : '你要去的世界，正在显现……';
  setTimeout(()=>{
    $('#revealName').textContent = w.name;
    $('#revealName').classList.add('show');
  }, 700);
  setTimeout(()=>{
    $('#revealDesc').textContent = w.narrate + (w.complete ? '' : '（此世界专属门为占位，结构已就绪）');
    $('#revealDesc').classList.add('show');
  }, 1500);
  // 自动进入专属门
  setTimeout(()=>{
    S.phase = 'exclusive';
    S.qIndex = 0;
    S.questions = WORLD_QUESTIONS[worldKey];
    go('doors');
    renderQuestion();
  }, 3400);
}

/* =========================================================================
 * 穿门手势（探探式拖拽 + 点门兜底）
 * ========================================================================= */
function initGestures(){
  const stage = $('#doorStage');
  const dl = $('#doorLeft'), dr = $('#doorRight');
  let startX = null, startY = null, dragging = false, lean = null;
  const TH = 46; // 阈值

  function onDown(e){
    const p = e.touches ? e.touches[0] : e;
    startX = p.clientX; startY = p.clientY; dragging = true; lean = null;
  }
  function onMove(e){
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - startX;
    const dy = p.clientY - startY;
    if (Math.abs(dx) < Math.abs(dy)) return; // 竖向滚动不触发
    if (e.cancelable) e.preventDefault();
    dl.classList.remove('lean-left','lean-right');
    dr.classList.remove('lean-left','lean-right');
    if (dx < -10){ lean='left'; dl.classList.add('lean-left'); dr.classList.add('lean-left'); }
    else if (dx > 10){ lean='right'; dl.classList.add('lean-right'); dr.classList.add('lean-right'); }
    else lean=null;
  }
  function onUp(e){
    if (!dragging) return;
    dragging = false;
    const p = (e.changedTouches ? e.changedTouches[0] : e);
    const dx = p.clientX - startX;
    dl.classList.remove('lean-left','lean-right');
    dr.classList.remove('lean-left','lean-right');
    if (dx <= -TH){ choose('left'); }
    else if (dx >= TH){ choose('right'); }
  }

  stage.addEventListener('touchstart', onDown, {passive:true});
  stage.addEventListener('touchmove', onMove, {passive:false});
  stage.addEventListener('touchend', onUp);
  stage.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  // 点门兜底
  dl.addEventListener('click', (e)=>{ if (Math.abs((e.detail||0))>=0) choose('left'); });
  dr.addEventListener('click', ()=> choose('right'));
}

/* =========================================================================
 * 名字 + 照片
 * ========================================================================= */
function initInput(){
  const zone = $('#photoZone'), file = $('#fileInput'),
        prev = $('#photoPreview'), ph = $('#phText');
  zone.addEventListener('click', ()=> file.click());
  file.addEventListener('change', ()=>{
    const f = file.files && file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      S.photoDataUrl = reader.result;
      prev.src = reader.result; prev.style.display='block'; ph.style.display='none';
    };
    reader.readAsDataURL(f);
  });

  $('#btnForge').addEventListener('click', ()=>{
    const name = $('#nameInput').value.trim();
    if (!name){ toast('先写下你的名字'); $('#nameInput').focus(); return; }
    S.name = name;
    runForge();
  });
}

/* =========================================================================
 * 铸造加载页（叙事化高潮 + 命运凝聚光点）
 * ========================================================================= */
function runForge(){
  go('forge');
  const lines = $('#forgeLines'); lines.innerHTML='';
  const frag = $('#forgeFragment'); frag.classList.remove('show'); frag.textContent='';

  const w = WORLDS[S.worldKey];
  startForgeCanvas(w);

  const script = [
    '命运的门，已在你身后合上……',
    '正在寻找你的容貌……',
    '正在写下你的来历……',
    '正在赋予你一个名字……',
  ];
  let i = 0;
  function nextLine(){
    if (i >= script.length) return;
    const el = document.createElement('div');
    el.className = 'forge-line';
    el.textContent = script[i];
    lines.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('show'));
    i++;
    if (i < script.length) setTimeout(nextLine, 1150);
  }
  nextLine();

  // 悬念碎片：模糊独白先露
  setTimeout(()=>{
    const teaser = ['……我记得那扇门后的光。','……有人在叫我的名字。','……这一次，我不再只是看客。'];
    frag.textContent = teaser[Math.floor(Math.random()*teaser.length)];
    frag.classList.add('show');
  }, 1800);

  // 实际生成（并行），但节奏拉到 4-6s 配合叙事
  const minDelay = new Promise(r=>setTimeout(r, 4800));
  const gen = GEN.generateCard({
    worldId: S.worldKey,
    traitTotals: S.traitTotals,
    name: S.name,
    photoDataUrl: S.photoDataUrl,
  });

  Promise.all([gen, minDelay]).then(([res])=>{
    S.card = res.card; S.portrait = res.portrait; S.role = res.role;
    stopForgeCanvas();
    persistMember();
    renderResult();
    go('result');
  }).catch(()=>{
    // 极端兜底
    S.card = GEN.fallbackCard({ name:S.name, worldId:S.worldKey,
      role: resolveRole(S.worldKey, S.traitTotals).role, traitTags: [] });
    stopForgeCanvas(); persistMember(); renderResult(); go('result');
  });
}

/* 铸造画布：穿过的门化成光点 → 汇聚成人形剪影 → 点亮 */
let forgeRAF = null;
function startForgeCanvas(world){
  const cv = $('#forge-canvas');
  const dpr = Math.min(2, window.devicePixelRatio||1);
  const W = cv.clientWidth = cv.offsetWidth, H = cv.clientHeight = cv.offsetHeight;
  cv.width = W*dpr; cv.height = H*dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr,dpr);
  const accent = world.tone.accent, glow = world.tone.ink;

  // 人形剪影目标点（简单人体轮廓采样）
  const cx = W/2, cy = H/2;
  const bodyPts = [];
  for (let a=0;a<Math.PI*2;a+=0.35){ bodyPts.push([cx+Math.cos(a)*16, cy-70+Math.sin(a)*16]); } // 头
  for (let t=0;t<=1;t+=0.08){ bodyPts.push([cx, cy-50 + t*86]); }                                  // 躯干
  for (let t=0;t<=1;t+=0.12){ bodyPts.push([cx - t*40, cy-40 + t*40]); bodyPts.push([cx + t*40, cy-40 + t*40]); } // 臂
  for (let t=0;t<=1;t+=0.1){ bodyPts.push([cx - t*22, cy+36 + t*70]); bodyPts.push([cx + t*22, cy+36 + t*70]); }  // 腿

  // 把"穿过的门"数量映射成光点群
  const N = 90;
  const sparks = [];
  for (let i=0;i<N;i++){
    const ang = Math.random()*Math.PI*2, r = 120 + Math.random()*180;
    const tgt = bodyPts[i % bodyPts.length];
    sparks.push({
      x: cx + Math.cos(ang)*r, y: cy + Math.sin(ang)*r,
      tx: tgt[0] + (Math.random()-.5)*6, ty: tgt[1] + (Math.random()-.5)*6,
      s: 0.8 + Math.random()*1.6,
    });
  }
  const t0 = performance.now();
  function draw(now){
    const p = Math.min(1, (now - t0)/4600);     // 0→1 over ~4.6s
    const ease = 1 - Math.pow(1-p, 3);
    ctx.clearRect(0,0,W,H);
    // 氛围底光（随世界）
    const g = ctx.createRadialGradient(cx,cy,10,cx,cy,W*0.7);
    g.addColorStop(0, hexA(accent, 0.10*ease+0.02));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    sparks.forEach(s=>{
      const x = s.x + (s.tx - s.x)*ease;
      const y = s.y + (s.ty - s.y)*ease;
      ctx.beginPath();
      ctx.arc(x, y, s.s*(1+ (1-ease)*1.5), 0, Math.PI*2);
      ctx.fillStyle = hexA(glow, 0.5 + 0.4*ease);
      ctx.shadowColor = accent; ctx.shadowBlur = 12*ease;
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    // 收束后剪影微微点亮
    if (p > 0.85){
      ctx.globalAlpha = (p-0.85)/0.15 * 0.25;
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(cx, cy-10, 70, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    forgeRAF = requestAnimationFrame(draw);
  }
  forgeRAF = requestAnimationFrame(draw);
}
function stopForgeCanvas(){ if (forgeRAF) cancelAnimationFrame(forgeRAF); forgeRAF=null; }
function hexA(hex, a){
  const h = hex.replace('#',''); const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

/* =========================================================================
 * 复古报纸结果页（随世界切皮肤）
 * ========================================================================= */
function renderResult(){
  const w = WORLDS[S.worldKey];
  const c = S.card;
  const portraitUrl = S.portrait && S.portrait.url;
  const dateStr = guofengDate(w.skin);

  const portraitHTML = portraitUrl
    ? `<img src="${portraitUrl}" alt="">`
    : `<div class="placeholder">◌</div>`;

  const tags = (c.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('');

  $('#paperMount').innerHTML = `
    <div class="paper ${w.skin}" id="paperCard">
      <div class="paper-masthead">${esc(w.masthead)}</div>
      <div class="paper-meta">
        <span>${esc(w.edition)}</span>
        <span>${dateStr}</span>
        <span>第 ${(STORE.loadCast(S.room? S.room.worldId : 'solo').length)+1} 號</span>
      </div>
      <h2 class="paper-headline">${esc(c.char_name)}</h2>
      <div class="paper-subrole">公開身份 · ${esc(c.public_role)}</div>
      <div class="paper-body">
        <div class="paper-portrait">
          <div class="frame">${portraitHTML}</div>
          <div class="cap">— 本報記者 攝 —</div>
        </div>
        <div class="paper-col">
          <span class="bio-title">人 物 小 傳</span><br>
          ${esc(c.bio)}
        </div>
      </div>
      <div class="paper-entrance">「${esc(c.entrance_line)}」</div>
      <div class="paper-tags">${tags}</div>
    </div>`;
}

function guofengDate(skin){
  const d = new Date();
  if (skin === 'cyber') return d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate()+' // SYS';
  // 简化"干支/旧历感"
  return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日';
}

/* =========================================================================
 * 房间持久化 + 群像
 * ========================================================================= */
function ensureRoom(){
  if (S.room) return S.room;
  // 创世者首次完成 → 建房
  S.room = {
    worldId: STORE.genWorldId(),
    worldKey: S.worldKey,
    hostName: S.name,
  };
  return S.room;
}

function persistMember(){
  const room = ensureRoom();
  const member = {
    memberId: STORE.genMemberId(),
    name: S.name,
    role: S.card.public_role,
    char_name: S.card.char_name,
    bio: S.card.bio,
    tags: S.card.tags,
    entrance: S.card.entrance_line,
    portrait: S.portrait && S.portrait.url || null,
    isHost: S.mode === 'create',
    ts: Date.now(),
  };
  STORE.saveMember(room.worldId, member);
}

function renderGroup(){
  const room = ensureRoom();
  const w = WORLDS[S.worldKey];
  const cast = STORE.loadCast(room.worldId).sort((a,b)=>a.ts-b.ts);
  $('#groupTitle').textContent = w.name + ' · 群像';
  $('#groupSub').textContent = `同处一个世界的 ${cast.length} 个人`;
  const grid = $('#castGrid');
  if (!cast.length){
    grid.innerHTML = `<div class="cast-empty">这个世界还只有你一个人……<br>邀请朋友进来，群像才热闹。</div>`;
    return;
  }
  grid.innerHTML = cast.map(m=>{
    const ava = m.portrait ? `<img src="${m.portrait}">` : `<div class="ph">◌</div>`;
    return `<div class="cast-card">
      <div class="ava">${ava}</div>
      <div class="info">
        <h4>${esc(m.char_name)}${m.isHost?' · 创世者':''}</h4>
        <div class="role">${esc(m.role)}</div>
        <div class="bio">${esc(m.bio)}</div>
      </div>
    </div>`;
  }).join('');
}

/* =========================================================================
 * 邀请（链接 / 二维码）
 * ========================================================================= */
function openInvite(){
  const room = ensureRoom();
  const url = STORE.buildShareUrl(room);
  $('#shareLink').value = url;
  $('#inviteTitle').textContent = `来我创建的【${WORLDS[S.worldKey].name}】当个角色`;
  // 生成二维码
  const box = $('#qrBox'); box.innerHTML='';
  try {
    new QRCode(box, { text: url, width: 150, height: 150,
      colorDark:'#1a140a', colorLight:'#ffffff',
      correctLevel: QRCode.CorrectLevel.M });
  } catch(e){ box.innerHTML = '<div style="color:#8a7f6c;font-size:12px">二维码生成失败，可直接复制链接</div>'; }
  $('#inviteSheet').classList.add('show');
}
function closeInvite(){ $('#inviteSheet').classList.remove('show'); }

/* =========================================================================
 * 元宝续写 deeplink（带世界 + 全员角色，未安装走下载兜底）
 * ========================================================================= */
function goYuanbao(withAll){
  const room = ensureRoom();
  const w = WORLDS[S.worldKey];
  let prompt;
  if (withAll){
    const cast = STORE.loadCast(room.worldId);
    const roster = cast.map(m=>`${m.char_name}（${m.role}）`).join('、');
    prompt = `继续【${w.name}】的故事。你是这个世界的AI主持人/GM。在场角色：${roster}。请抛出一个事件，让我们各自以角色身份做选择，把剧情演下去。`;
  } else {
    prompt = `继续【${w.name}】的故事。你是这个世界的AI主持人/GM。我的角色是「${S.card.char_name}·${S.card.public_role}」，小传：${S.card.bio} 请为我开场，并抛出第一个需要我做选择的事件。`;
  }
  const enc = encodeURIComponent(prompt);
  // 元宝 deeplink（唤起 App 并预填）；未安装则回退到下载/网页版
  const scheme = `tencentyuanbao://chat?msg=${enc}`;
  const fallback = `https://yuanbao.tencent.com/`;
  launchAppOrFallback(scheme, fallback);
}

function launchAppOrFallback(scheme, fallback){
  const start = Date.now();
  const timer = setTimeout(()=>{
    // 1.2s 内没切走 → 认为未安装，去兜底
    if (Date.now() - start < 1600) window.location.href = fallback;
  }, 1200);
  // 用隐藏 iframe 尝试唤起（iOS/Android 兼容性较好）
  try {
    const ifr = document.createElement('iframe');
    ifr.style.display='none'; ifr.src = scheme;
    document.body.appendChild(ifr);
    setTimeout(()=>document.body.removeChild(ifr), 1500);
  } catch(e){}
  // 同时尝试直接跳（部分浏览器需要）
  window.location.href = scheme;
  window.addEventListener('pagehide', ()=>clearTimeout(timer), {once:true});
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) clearTimeout(timer); }, {once:true});
}

/* =========================================================================
 * 导出角色卡为图片
 * ========================================================================= */
function saveCard(){
  const node = $('#paperCard');
  if (!node){ toast('暂无可保存的角色卡'); return; }
  toast('正在生成图片……');
  // 用前景渲染：优先 html-to-image 思路的极简实现 —— 这里用 foreignObject 序列化
  const w = node.offsetWidth, h = node.offsetHeight;
  const clone = node.cloneNode(true);
  const xml = new XMLSerializer().serializeToString(clone);
  // 内联样式较复杂，改为提示用户长按截图作为最稳兜底（移动端最可靠）
  // 同时尝试 canvas 截图（若浏览器支持）
  try {
    const data = `data:image/svg+xml;charset=utf-8,`+
      encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>`+
      `<foreignObject width='100%' height='100%'>`+
      `<div xmlns='http://www.w3.org/1999/xhtml'>${injectStyles(xml)}</div>`+
      `</foreignObject></svg>`);
    const img = new Image();
    img.onload = ()=>{
      const cv = document.createElement('canvas');
      const dpr = 2; cv.width = w*dpr; cv.height = h*dpr;
      const ctx = cv.getContext('2d'); ctx.scale(dpr,dpr);
      ctx.drawImage(img,0,0);
      cv.toBlob(b=>{
        if (!b){ toast('请长按角色卡保存截图'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `入戏-${S.card.char_name}.png`;
        a.click();
        toast('已生成，长按图片可保存');
      });
    };
    img.onerror = ()=> toast('请长按角色卡截图保存');
    img.src = data;
  } catch(e){ toast('请长按角色卡截图保存'); }
}
function injectStyles(xml){
  // foreignObject 需要内联关键样式，简单注入
  return xml.replace('<div class="paper', '<div style="font-family:serif" class="paper');
}

/* ---------- 工具 ---------- */
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

/* =========================================================================
 * 事件绑定
 * ========================================================================= */
function bind(){
  $('#btnCreate').addEventListener('click', startDoors);
  $('#btnJoin').addEventListener('click', startDoors);
  $('#doorBack').addEventListener('click', back);
  $('#topHome').addEventListener('click', ()=>{ if(confirm('重新开始？当前进度将清空')) location.href = location.origin+location.pathname; });

  $('#btnInvite').addEventListener('click', openInvite);
  $('#btnInvite2').addEventListener('click', openInvite);
  $('#sheetClose').addEventListener('click', closeInvite);
  $('#btnCopy').addEventListener('click', ()=>{
    const inp = $('#shareLink'); inp.select();
    try { navigator.clipboard.writeText(inp.value); } catch(e){ document.execCommand('copy'); }
    toast('链接已复制，去发给朋友吧');
  });

  $('#btnGroup').addEventListener('click', ()=>{ renderGroup(); go('group'); });
  $('#btnMyCard').addEventListener('click', ()=> go('result'));
  $('#btnYuanbao').addEventListener('click', ()=> goYuanbao(false));
  $('#btnYuanbao2').addEventListener('click', ()=> goYuanbao(true));
  $('#btnSave').addEventListener('click', saveCard);

  initGestures();
  initInput();
}

bind();
boot();

})();
