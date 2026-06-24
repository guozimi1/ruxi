/* =========================================================================
 * 《入戏》— 世界/房间态 + 链接编解码
 * -------------------------------------------------------------------------
 * 不依赖登录：
 *   - 创世 = 生成一个 worldId（房间）+ 把"世界键"塞进可分享链接的 hash。
 *   - 好友点链接 → 从 hash 解析出世界键，直接进入同一个世界、各自答题。
 *   - 群像：每人完成后把自己的角色卡 push 到 localStorage 里以 worldId 归档的列表。
 *     （单机版群像；如需跨设备实时群像，后端 /api/room 预留了接口，见 README。）
 * ========================================================================= */

const LS_PREFIX = 'ruxi_room_';

function genWorldId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return (t + r).slice(0, 10);
}

/* 把房间信息编码进链接：?w=worldId&k=worldKey&host=创世者名（可选）
 * worldKey = 具体世界（如 gongting），好友进来后直接玩这个世界的专属题，
 *            但分流门仍照走（spec：好友也靠自己答题生成身份）。
 *            这里 worldKey 用于"同处一个世界"，好友的分流结果会被引导到同一 worldKey。
 */
function buildShareUrl(room) {
  const base = location.origin + location.pathname;
  const params = new URLSearchParams();
  params.set('w', room.worldId);
  params.set('k', room.worldKey);
  if (room.hostName) params.set('h', room.hostName); // URLSearchParams 已自动编码
  return base + '#/join?' + params.toString();
}

function parseHash() {
  const h = location.hash || '';
  const m = h.match(/#\/join\?(.*)$/);
  if (!m) return null;
  const p = new URLSearchParams(m[1]);
  const worldId = p.get('w');
  const worldKey = p.get('k');
  if (!worldId || !worldKey) return null;
  return {
    worldId,
    worldKey,
    hostName: p.get('h') || '', // URLSearchParams.get 已自动解码
  };
}

/* ---------- 房间内角色列表（群像）---------- */
function roomKey(worldId) { return LS_PREFIX + worldId; }

function loadCast(worldId) {
  try {
    const raw = localStorage.getItem(roomKey(worldId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMember(worldId, member) {
  const cast = loadCast(worldId);
  // 用 memberId 去重（同一人重玩覆盖）
  const idx = cast.findIndex(m => m.memberId === member.memberId);
  if (idx >= 0) cast[idx] = member; else cast.push(member);
  try { localStorage.setItem(roomKey(worldId), JSON.stringify(cast)); } catch {}
  return cast;
}

function genMemberId() {
  let id = localStorage.getItem('ruxi_member_id');
  if (!id) {
    id = 'm' + Math.random().toString(36).slice(2, 9);
    try { localStorage.setItem('ruxi_member_id', id); } catch {}
  }
  return id;
}

window.RUXI_STORE = {
  genWorldId, buildShareUrl, parseHash,
  loadCast, saveMember, genMemberId,
};
