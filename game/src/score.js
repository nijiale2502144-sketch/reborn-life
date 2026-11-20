import { test } from './cond.js';
import { ATTRS } from './const.js';

const sum = a => a.reduce((x, y) => x + y, 0);

// 转生点结算（对应策划案第 11 节）
export function computeScore(content, script, s, ending) {
  const items = [];
  const add = (label, v) => { if (v) items.push({ label, value: Math.round(v) }); };

  let main = 0, side = 0, hidden = 0;
  for (const q of script.quests) {
    const st = s.quests[q.id];
    if (!st) continue;
    const v = (st.stageScore || 0) + (st.state === 'done' ? (q.score || 0) : 0);
    if (q.type === 'main') main += v; else if (q.type === 'hidden') hidden += v; else side += v;
  }
  add('主线进度', main);
  add('支线任务', side);
  add('隐藏任务', hidden);
  const asp = (script.aspirations || []).find(a => a.id === s.aspiration);
  if (asp && test(s, asp.cond)) add('人生志向：' + asp.name, asp.score || 30);

  add('等级', s.level * 2);
  add('属性提升', sum(ATTRS.map(a => Math.max(0, s.attrs[a] - s.attrStart[a]))));
  add('等阶', (s.rank - 1) * 20);
  add('技能', Math.min(30, 5 * Object.keys(s.flags).filter(k => k.startsWith('sk_')).length));

  add('金币', Math.min(30, Math.floor(s.gold / 100)));
  add('声望', Math.min(30, Math.floor(sum(Object.values(s.rep)) / 10)));
  add('重要关系', Math.min(40, 10 * Object.values(s.rel).filter(v => v >= 8).length));

  add('地下城首通', 10 * Object.keys(s.clears).length);
  const known = new Set(s.codex || []);
  add('图鉴新事件', Math.min(40, 2 * Object.keys(s.seen).filter(id => !known.has(id)).length));

  const subtotal = sum(items.map(i => i.value));
  const mult = ending.mult * (script.scoreCoef || 1) * (content.config.rpScale || 1) * (1 + (s.mods.rpBonus || 0)) * (1 + 0.2 * (s.fate || 0));
  const rp = Math.max(30, Math.round(subtotal * mult));
  return { items, subtotal, mult, rp };
}
