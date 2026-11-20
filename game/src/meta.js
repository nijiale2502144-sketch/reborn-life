// 局外养成：转生点、转生树、天赋、图鉴（存档由调用方负责，浏览器用 localStorage）
import { ATTRS } from './const.js';
import { test } from './cond.js';

export const newMeta = () => ({
  v: 1, rp: 0, runs: 0, wins: 0, best: 0, fragments: 0, codex: [], endings: {}, endingsBy: {},
  up: { str: 0, agi: 0, int: 0, wil: 0, cha: 0, luk: 0, stamina: 0, slots: 1 },
  talents: [], equipped: [], unlocked: ['farmer_son'],
  relics: [], relicEquipped: null, fateMax: 0, fateSelected: 0, shards: [],
});

const ATTR_COST = lv => 40 * (lv + 1);          // +1 / +2 / +3 分别 40 / 80 / 120
const STAMINA_COST = [800, 1600];               // 体力 +1 / +2
const SLOT_COST = [600, 1500];                  // 第 2 / 第 3 个天赋槽

export function shop(content, meta) {
  const L = content.config.labels.attr;
  const out = [];
  for (const a of ATTRS) {
    const lv = meta.up[a];
    out.push({ id: 'attr:' + a, group: '肉身', name: `${L[a]}起始值 +${Math.min(lv + 1, 3)}`, desc: '开局属性提高（每项最多 +3）', level: lv, max: 3, cost: lv < 3 ? ATTR_COST(lv) : null });
  }
  const sl = meta.up.stamina;
  out.push({ id: 'stamina', group: '肉身', name: `体力上限 +${Math.min(sl + 1, 2)}`, desc: '每回合体力 +1（最多 +2）', level: sl, max: 2, cost: sl < 2 ? STAMINA_COST[sl] : null });
  const sd = meta.up.slots - 1;
  out.push({ id: 'slot', group: '天赋', name: `天赋槽 ${Math.min(sd + 2, 3)}`, desc: '开局可以多带一个天赋', level: sd, max: 2, cost: sd < 2 ? SLOT_COST[sd] : null });
  for (const sc of Object.values(content.scripts)) {
    if (!sc.unlockCost) continue;
    const owned = meta.unlocked.includes(sc.id);
    out.push({ id: 'script:' + sc.id, group: '剧本', name: `解锁剧本《${sc.name}》`, desc: sc.subtitle + '。' + sc.desc, level: owned ? 1 : 0, max: 1, cost: owned ? null : sc.unlockCost });
  }
  for (const t of content.meta.talents) {
    const owned = meta.talents.includes(t.id);
    out.push({ id: 'talent:' + t.id, group: '天赋', name: t.name, desc: t.price ? `${t.desc}（代价：${t.price}）` : t.desc, level: owned ? 1 : 0, max: 1, cost: owned ? null : t.cost });
  }
  return out;
}

export function buy(content, meta, id) {
  const item = shop(content, meta).find(x => x.id === id);
  if (!item || item.cost === null) return { ok: false, msg: '已经买满了' };
  if (meta.rp < item.cost) return { ok: false, msg: '转生点不够' };
  meta.rp -= item.cost;
  if (id.startsWith('attr:')) meta.up[id.slice(5)]++;
  else if (id === 'stamina') meta.up.stamina++;
  else if (id === 'slot') meta.up.slots++;
  else if (id.startsWith('talent:')) meta.talents.push(id.slice(7));
  else if (id.startsWith('script:')) meta.unlocked.push(id.slice(7));
  return { ok: true, msg: `已购买：${item.name}` };
}

export function equipRelic(meta, id) { meta.relicEquipped = meta.relicEquipped === id ? null : (meta.relics.includes(id) ? id : null); }

export function toggleTalent(meta, id) {
  if (meta.equipped.includes(id)) meta.equipped = meta.equipped.filter(x => x !== id);
  else if (meta.talents.includes(id) && meta.equipped.length < meta.up.slots) meta.equipped.push(id);
}

export function runOpts(meta, extra = {}) {
  return Object.assign({
    up: meta.up, talents: meta.equipped.filter(id => meta.talents.includes(id)), codex: meta.codex,
    relic: meta.relics.includes(meta.relicEquipped) ? meta.relicEquipped : null,
    fate: Math.min(meta.fateSelected || 0, meta.fateMax || 0), memories: meta.shards || [],
  }, extra);
}

// 一局结束后调用，把转生点和图鉴记进存档
export function settle(meta, s, content) {
  meta.rp += s.ended.score.rp;
  meta.runs++;
  if (s.ended.cleared) meta.wins++;
  meta.best = Math.max(meta.best, s.ended.score.rp);
  meta.fragments += s.fragments;
  meta.endings[s.ended.id] = (meta.endings[s.ended.id] || 0) + 1;
  // 结局博物馆：按「剧本:结局」记录次数、首次是第几世、最高转生点；首次达成给一笔小奖励
  if (!meta.endingsBy) meta.endingsBy = {};
  const ek = `${s.script}:${s.ended.id}`;
  const prev = meta.endingsBy[ek];
  let newEnding = null;
  if (!prev) {
    const bonus = ((content && content.config.endingBonus) || {})[s.ended.kind] || 0;
    meta.rp += bonus;
    newEnding = { id: s.ended.id, bonus };
  }
  meta.endingsBy[ek] = { n: (prev ? prev.n : 0) + 1, first: prev ? prev.first : meta.runs, best: Math.max(prev ? prev.best : 0, s.ended.score.rp) };
  const set = new Set(meta.codex);
  for (const id of Object.keys(s.seen)) set.add(id);
  meta.codex = [...set];
  // 遗物：满足条件就解锁（条件按这一局结束时的状态判断）
  const gained = [];
  for (const r of (content && content.meta.relics) || []) {
    if (meta.relics.includes(r.id) || (r.script && !r.script.includes(s.script))) continue;
    if (test(s, r.unlock.cond)) { meta.relics.push(r.id); gained.push(r); }
  }
  // 记忆碎片：失败的支线、发现的真相都会留下碎片（条件按这一局结束时的状态判断，失败的一局也算）
  if (!meta.shards) meta.shards = [];
  const shards = [];
  for (const r of (content && content.meta.shards) || []) {
    if (meta.shards.includes(r.id) || (r.script && !r.script.includes(s.script))) continue;
    if (test(s, r.unlock.cond)) { meta.shards.push(r.id); shards.push(r); }
  }
  // 命运阶位：在当前最高阶位通关，解锁下一阶
  let fateUp = false;
  if (s.ended.cleared && (s.fate || 0) === meta.fateMax && meta.fateMax < 5) { meta.fateMax++; fateUp = true; }
  s.settleInfo = { newEnding, gainedRelics: gained.map(r => r.id), gainedShards: shards.map(r => r.id), fateUp, fateMax: meta.fateMax };
  return meta;
}
