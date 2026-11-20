import { SEASONS } from './const.js';

// 条件语法：
//   字符串 = 多项用 && 连接（全部成立）；数组 = 多个字符串，任意一个成立（或）
//   项： flag:x   status:x   memory:碎片id（前世记忆，开局时已拥有）   key>=n   key==text   前缀 ! 表示取反
//   key： memories（已拥有的记忆碎片数） age season turn stamina gold level hp hometown rank
//         attr.str  rel.efna  rep.church  quest.id（none/active/done/failed）  qstage.id（当前阶段序号）
export function value(s, key) {
  if (key === 'season') return SEASONS[s.season];
  if (key === 'ending') return s.ended ? s.ended.id : '';
  if (key === 'fate') return s.fate || 0;
  if (key === 'memories') return (s.memories || []).length;
  if (key.startsWith('attr.')) return s.attrs[key.slice(5)];
  if (key.startsWith('rel.')) return s.rel[key.slice(4)] || 0;
  if (key.startsWith('rep.')) return s.rep[key.slice(4)] || 0;
  if (key.startsWith('quest.')) return (s.quests[key.slice(6)] || {}).state || 'none';
  if (key.startsWith('count.')) return s.counters[key.slice(6)] || 0;
  if (key.startsWith('qstage.')) {
    const q = s.quests[key.slice(7)];
    return q ? q.stage : -1;
  }
  return s[key];
}

function term(s, t) {
  let neg = false;
  if (t.startsWith('!')) { neg = true; t = t.slice(1); }
  let r;
  if (t === 'true') r = true;
  else if (t.startsWith('flag:')) r = !!s.flags[t.slice(5)];
  else if (t.startsWith('status:')) r = s.status.some(x => x.id === t.slice(7));
  else if (t.startsWith('memory:')) r = (s.memories || []).includes(t.slice(7));
  else {
    const m = t.match(/^([\w.]+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
    if (!m) throw new Error('条件无法解析: ' + t);
    const lhs = value(s, m[1]);
    const rhs = isNaN(Number(m[3])) ? m[3] : Number(m[3]);
    switch (m[2]) {
      case '>=': r = lhs >= rhs; break;
      case '<=': r = lhs <= rhs; break;
      case '>': r = lhs > rhs; break;
      case '<': r = lhs < rhs; break;
      case '==': r = lhs == rhs; break;
      default: r = lhs != rhs;
    }
  }
  return neg ? !r : r;
}

export function test(s, cond) {
  if (cond === undefined || cond === null || cond === '') return true;
  if (Array.isArray(cond)) return cond.length === 0 || cond.some(c => test(s, c));
  return cond.split('&&').every(t => term(s, t.trim()));
}
