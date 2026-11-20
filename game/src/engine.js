// 规则引擎：回合、体力、事件、任务、地下城、战斗、结算。
// 不依赖浏览器，也不依赖 Node，所以界面和模拟器共用同一份代码。
// 状态 s 是纯 JSON 对象，可以直接存档。
import { test, value } from './cond.js';
import { computeScore } from './score.js';
import { ATTRS, SEASONS, SEASON_CN } from './const.js';

export { ATTRS, SEASONS, SEASON_CN };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = a => a.reduce((x, y) => x + y, 0);

export function makeGame(content, scriptId) {
  const cfg = content.config;
  const script = content.scripts[scriptId];
  // 剧本可以覆盖通用的文案标签、说明和提示（深合并）
  const merge = (a, b) => {
    const out = Object.assign({}, a);
    for (const [k, v] of Object.entries(b || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' ? merge(out[k], v) : v;
    return out;
  };
  const LB = merge(cfg.labels, script.labels);
  const HELP = merge(cfg.help, script.help);
  const TIPS = merge(cfg.tips, script.tips);
  const A = {}, E = {}, QM = {}, D = {};
  const mine = x => (!x.only || x.only.includes(scriptId)) && !(x.except && x.except.includes(scriptId));   // only:["剧本id"] 只在该剧本出现；except:["剧本id"] 在该剧本里不出现
  for (const a of [...content.common.actions, ...script.actions].filter(mine)) A[a.id] = a;
  for (const e of [...content.common.events, ...script.events].filter(mine)) E[e.id] = e;
  for (const q of script.quests) QM[q.id] = q;
  for (const d of content.dungeons) D[d.id] = d;
  const EN = content.enemies;
  const SK = {};
  for (const k of content.skills) SK[k.id] = k;
  const IT = content.items;
  const allEvents = Object.values(E);
  const SPECIALS = allEvents.filter(e => e.kind === 'special');
  const RANDOMS = allEvents.filter(e => e.kind === 'random');
  const DERIVED = allEvents.filter(e => e.kind === 'derived');
  const DUNGEON_EVENTS = allEvents.filter(e => e.kind === 'dungeon');

  const npcName = id => (script.npcs && script.npcs[id] && script.npcs[id].name) || id;

  // ---------------------------------------------------------------- 随机数
  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rint = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  function wpick(s, arr, wf) {
    const ws = arr.map(wf);
    let r = rand(s) * sum(ws);
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r < 0) return arr[i]; }
    return arr[arr.length - 1];
  }

  // ---------------------------------------------------------------- 派生值
  const hpMax = s => Math.round(cfg.baseHp + s.attrs.str * cfg.hpPerStr + s.level * cfg.hpPerLevel);
  const mpMax = s => s.attrs.wil * 2 + s.attrs.int + (s.mods.mpBonus || 0);
  const expNeed = s => cfg.expBase + cfg.expPerLevel * s.level;
  const attrNeed = v => cfg.attrExpBase + Math.floor(cfg.attrExpPer * v);
  const hasStatus = (s, id) => s.status.some(x => x.id === id);
  // 体力上限的组成（界面和“体力上限变化”提示都用它）
  function staminaParts(s) {
    const parts = [
      { label: '基础', val: cfg.baseStamina },
      { label: `体魄 ${s.attrs.str}（每 ${cfg.staminaPerStr} 点 +1）`, key: '体魄', val: Math.floor(s.attrs.str / cfg.staminaPerStr) },
    ];
    if (s.mods.staminaBonus) parts.push({ label: '转生 / 天赋加成', key: '转生 / 天赋加成', val: s.mods.staminaBonus });
    for (const m of script.staminaMods || []) if (test(s, m.cond)) parts.push({ label: m.label || m.cond, key: m.label || m.cond, val: m.add });
    return parts;
  }
  const staminaMax = s => Math.max(3, sum(staminaParts(s).map(p => p.val)));
  function staminaChangeNote(s) {
    const parts = staminaParts(s);
    const now = Math.max(3, sum(parts.map(p => p.val)));
    const old = s.staminaSeen;
    const oldParts = s.staminaPartsSeen || [];
    s.staminaSeen = now;
    s.staminaPartsSeen = parts.map(p => ({ key: p.key || p.label, val: p.val, label: p.label }));
    if (old === undefined || old === now) return null;
    const lines = [`体力上限 ${old} → ${now}`];
    const keys = new Set([...oldParts.map(p => p.key), ...s.staminaPartsSeen.map(p => p.key)]);
    for (const k of keys) {
      const a = (oldParts.find(p => p.key === k) || { val: 0 }).val;
      const b = (s.staminaPartsSeen.find(p => p.key === k) || { val: 0 }).val;
      if (a !== b) lines.push(`${k}：${a >= 0 ? '+' : ''}${a} → ${b >= 0 ? '+' : ''}${b}`);
    }
    return { t: 'result', title: now > old ? '体力上限提高了' : '体力上限降低了', text: now > old ? '身体或处境的变化，让你每个回合能多做一点事。' : '状态不如从前了，每个回合能做的事少了一些。', lines, tone: 'tip' };
  }
  const SLOT_CN = { weapon: '武器', armor: '护甲', shield: '盾牌', trinket: '饰品' };
  const SLOT_N = { weapon: 1, armor: 1, shield: 1, trinket: 2 };   // 每个栏位生效的件数
  function gearParts(s) {
    const by = {};
    for (const id of s.gear) {
      const it = IT[id];
      if (!it) continue;
      (by[it.slot || 'trinket'] = by[it.slot || 'trinket'] || []).push(it);
    }
    const parts = [];
    for (const [slot, list] of Object.entries(by)) {
      list.sort((a, b) => b.power - a.power);
      list.slice(0, SLOT_N[slot] || 1).forEach(it => parts.push({ label: `${it.name}（${SLOT_CN[slot] || slot}）`, val: it.power }));
    }
    return parts;
  }
  function gearView(s) {
    const by = {};
    for (const id of s.gear) { const it = IT[id]; if (it) (by[it.slot || 'trinket'] = by[it.slot || 'trinket'] || []).push(id); }
    const active = new Set();
    for (const [slot, ids] of Object.entries(by)) ids.sort((x, y) => IT[y].power - IT[x].power).slice(0, SLOT_N[slot] || 1).forEach(id => active.add(id));
    return s.gear.filter(id => IT[id]).map(id => ({ id, name: IT[id].name, slot: SLOT_CN[IT[id].slot] || '饰品', power: IT[id].power, desc: IT[id].desc || '', active: active.has(id) }));
  }
  function powerParts(s) {
    const three = ['str', 'int', 'wil'].sort((a, b) => s.attrs[b] - s.attrs[a]);
    const main = three[0], rest = three.slice(1);
    const parts = [
      { label: `等级 ${s.level}×4`, val: s.level * 4 },
      { label: `${LB.attr[main]} ${s.attrs[main]}×1.5（体魄、智力、意志中最高的一项）`, val: s.attrs[main] * 1.5 },
      { label: `${rest.map(a => `${LB.attr[a]} ${s.attrs[a]}`).join('、')} 各×0.5`, val: sum(rest.map(a => s.attrs[a])) * 0.5 },
      ...gearParts(s),
    ];
    if (s.mods.powerBonus) parts.push({ label: '遗物 / 天赋加成', val: s.mods.powerBonus });
    for (const b of script.powerBonus || []) if (test(s, b.cond)) parts.push({ label: b.label || b.cond, val: b.add });
    return parts;
  }
  const powerOf = s => Math.round(sum(powerParts(s).map(p => p.val)));
  function addStatus(s, id, turns) {
    const x = s.status.find(y => y.id === id);
    if (x) x.turns = Math.max(x.turns, turns); else s.status.push({ id, turns });
  }

  const say = (s, text) => { s.log.push({ turn: s.turn, text }); if (s.log.length > 300) s.log.shift(); };

  // ---------------------------------------------------------------- 检定
  // 命运阶位：敌人战力 +1.2% / +2.4% / +3.6%（阶位 3 / 4 / 5）
  const fateEnemyMult = s => 1 + 0.006 * ((s.fate >= 1) + (s.fate >= 2) + (s.fate >= 4) + (s.fate >= 5));
  const luckBonus = s => (s.attrs.luk - 10) * (cfg.luckBonus || 0);
  function chance(s, spec) {
    const md = spec.memDiff && (s.memories || []).includes(spec.memDiff.id) ? spec.memDiff.diff : 0;   // 前世记忆：降低（负数）或提高检定难度
    const fd = spec.flagDiff && s.flags[spec.flagDiff.id] ? spec.flagDiff.diff : 0;                       // 剧情标记：同上
    let parts = null, p;
    if (spec.compose) {
      // 组合检定：基础值由若干项累加（每项有上限），再由属性浮动。例如呈堂：证据 + 盟友 + 名望 为底，魅力为浮动
      const c = spec.compose;
      parts = [];
      p = c.base || 0;
      for (const a of c.add) {
        const v = value(s, a.key) || 0;
        const add = Math.min(v, a.max) * a.per;
        p += add;
        parts.push({ label: a.label, v, add });
      }
      const fl = (s.attrs[spec.attr] - (c.from || 10)) * (c.per || 0.015);
      p += fl;
      parts.push({ label: LB.attr[spec.attr], v: s.attrs[spec.attr], add: fl });
      p += (hasStatus(s, 'fatigue') ? -0.1 : 0) + (spec.bonus || 0) + luckBonus(s) - (spec.fateDiff || 0) * (s.fate || 0) * 0.03 + (md + fd) * -0.03;
    } else {
      const diff = spec.diff + md + fd + ((spec.seasonDiff && spec.seasonDiff[SEASONS[s.season]]) || 0) + (spec.fateDiff || 0) * (s.fate || 0);
      p = 0.5 + (s.attrs[spec.attr] - diff) * 0.03 + (hasStatus(s, 'fatigue') ? -0.1 : 0) + (spec.bonus || 0) + luckBonus(s);
    }
    return { p: clamp(p, 0.05, 0.95), parts };
  }
  function check(s, spec) {
    const { p, parts } = chance(s, spec);
    const roll = rand(s);
    return { ok: roll < p, p, roll, parts };
  }
  const checkLine = (spec, r) => `${LB.attr[spec.attr]}检定（成功率 ${Math.round(r.p * 100)}%${r.parts ? '：' + r.parts.map(x => `${x.label} ${x.v} ${x.add >= 0 ? '+' : ''}${Math.round(x.add * 100)}%`).join('，') : ''}）：${r.ok ? '成功' : '失败'}`;

  // ---------------------------------------------------------------- 成长
  function expMult(s, attr, tag) {
    const md = s.mods;
    const young = s.age <= 22 && (attr === 'int' || attr === 'wil');
    let m = 1;
    if (young) m += 0.2 + (md.youngMentalExp || 0);
    if (s.age >= 28 && (attr === 'str' || attr === 'agi')) m -= 0.2;
    if (s.age >= (md.lateAge || 28)) m += md.lateExp || 0;
    m += tag === 'study' ? (md.studyExp || 0) : (md.otherExp || 0);
    return Math.max(0.1, m);
  }
  function gainAttrExp(s, attr, amt, lines, tag) {
    const real = amt * expMult(s, attr, tag);
    s.attrExp[attr] += real;
    lines.push(`${LB.attr[attr]}经验 +${real.toFixed(real % 1 ? 1 : 0)}`);
    while (s.attrExp[attr] >= attrNeed(s.attrs[attr])) {
      s.attrExp[attr] -= attrNeed(s.attrs[attr]);
      s.attrs[attr]++;
      lines.push(`${LB.attr[attr]} +1（现为 ${s.attrs[attr]}）`);
    }
  }
  function gainExp(s, n, lines) {
    s.exp += n;
    lines.push(`经验 +${n}`);
    while (s.exp >= expNeed(s)) {
      s.exp -= expNeed(s);
      s.level++;
      s.freePoints += cfg.freePointsPerLevel;
      s.hp = Math.min(hpMax(s), s.hp + cfg.hpPerLevel);
      lines.push(`升级！等级 ${s.level}（获得 ${cfg.freePointsPerLevel} 点自由属性点）`);
    }
  }
  function hurt(s, n, lines) {
    n = Math.max(0, Math.round(n));
    s.hp -= n;
    lines.push(`生命 -${n}`);
    if (s.hp <= 0) nearDeath(s, lines);
  }
  function nearDeath(s, lines) {
    const tries = 2 + (s.mods.deathChecks || 0);
    let ok = false;
    for (let i = 0; i < tries && !ok; i++) ok = check(s, { attr: i === 0 ? 'wil' : 'luk', diff: (cfg.nearDeathDiff || 10) + (s.fate >= 5 ? 2 : 0) }).ok;
    if (ok) {
      s.hp = Math.max(1, Math.round(hpMax(s) * 0.3));
      addStatus(s, 'injured', 2);
      lines.push('濒死判定：你挺了过来，但身负重伤（2 回合内无法冒险）。');
    } else {
      s.hp = 0;
      s.flags.dead = true;
      lines.push('濒死判定失败……你倒下了。');
      setEnd(s, 'auto');
    }
  }
  function setEnd(s, id) {
    s.pendingEnd = id;
    s.queue = s.queue.filter(i => i.t === 'result');
    s.dun = null;
  }

  // ---------------------------------------------------------------- 效果
  // 字符串效果： gold+30  hp-8  hometown+3  exp+40  stamina+1  str_exp+4  attr:str+1
  //   flag+:x  flag-:x  flagclear:prefix  rel:efna+1  rep:church-2  quest:start:id  quest:fail:id
  //   status+:fatigue:2  status-:fatigue  goto:event_id  end:auto  rank:2  item:iron_sword  heal:0.5  log:文字
  // 对象效果： {if:cond, then:[..], else:[..]}   {type:'combat', enemy, win, lose, flee, noFlee}
  function fx(s, raw, lines, front, ctx) {
    if (typeof raw === 'object') {
      if (raw.if !== undefined) {
        for (const r of (test(s, raw.if) ? raw.then : raw.else) || []) fx(s, r, lines, front, ctx);
        return;
      }
      if (raw.type === 'combat') {
        front.push({ t: 'combat', enemy: raw.enemy, win: raw.win || [], lose: raw.lose || [], flee: raw.flee || [], noFlee: !!raw.noFlee, from: 'queue' });
        return;
      }
      throw new Error('未知效果对象 ' + JSON.stringify(raw));
    }
    let m;
    if (raw.startsWith('log:')) { lines.push(raw.slice(4)); return; }
    if (raw.startsWith('goto:')) { front.push({ t: 'event', id: raw.slice(5) }); return; }
    if ((m = raw.match(/^flag([+-]):(\w+)$/))) { if (m[1] === '+') s.flags[m[2]] = true; else delete s.flags[m[2]]; return; }
    if ((m = raw.match(/^flagclear:(\w+)$/))) { for (const k of Object.keys(s.flags)) if (k.startsWith(m[1])) delete s.flags[k]; return; }
    if ((m = raw.match(/^rel:(\w+)([+-])(\d+)$/))) {
      const d = (m[2] === '+' ? 1 : -1) * Number(m[3]);
      const old = s.rel[m[1]] || 0;
      s.rel[m[1]] = clamp(old + d, 0, 10);
      if (s.rel[m[1]] !== old) lines.push(`${npcName(m[1])}好感 ${d > 0 ? '+' : ''}${s.rel[m[1]] - old}`);
      return;
    }
    if ((m = raw.match(/^rep:(\w+)([+-])(\d+)$/))) {
      const d = (m[2] === '+' ? 1 : -1) * Number(m[3]);
      const old = s.rep[m[1]] || 0;
      s.rep[m[1]] = clamp(old + d, 0, 100);
      if (s.rep[m[1]] !== old) lines.push(`${LB.rep[m[1]] || m[1]} ${d > 0 ? '+' : ''}${s.rep[m[1]] - old}`);
      return;
    }
    if ((m = raw.match(/^quest:(start|fail):(\w+)$/))) {
      if (m[1] === 'start') startQuest(s, m[2], lines, front); else failQuest(s, m[2], lines, front);
      return;
    }
    if ((m = raw.match(/^status([+-]):(\w+)(?::(\d+))?$/))) {
      if (m[1] === '+') { addStatus(s, m[2], Number(m[3] || 2)); lines.push(`获得状态：${LB.status[m[2]] || m[2]}`); }
      else s.status = s.status.filter(x => x.id !== m[2]);
      return;
    }
    if ((m = raw.match(/^end:(\w+)$/))) { setEnd(s, m[1]); return; }
    if ((m = raw.match(/^rank:(\d+)$/))) { s.rank = Math.max(s.rank, Number(m[1])); lines.push(`等阶提升：${script.ranks[s.rank - 1] || s.rank}`); return; }
    if ((m = raw.match(/^item:(\w+)$/))) {
      if (!s.gear.includes(m[1])) { s.gear.push(m[1]); lines.push(`获得装备：${IT[m[1]].name}（战力 +${IT[m[1]].power}）`); }
      return;
    }
    if ((m = raw.match(/^learn:(\w+)$/))) { learnSkill(s, m[1], lines); return; }
    if ((m = raw.match(/^count:(\w+)([+-])(\d+)$/))) {
      // 计数门：剧本的 counterGates 可以规定「某计数在条件不满足时，增量改记到另一个计数」（例如证据在第三章之前只能先记成线索）
      let name = m[1];
      const gate = script.counterGates && script.counterGates[name];
      if (gate && m[2] === '+' && !test(s, gate.cond)) name = gate.alt;
      s.counters[name] = Math.max(0, (s.counters[name] || 0) + (m[2] === '+' ? 1 : -1) * Number(m[3]));
      return;
    }
    if ((m = raw.match(/^mpheal:([\d.]+)$/))) {
      const old = s.mp; s.mp = Math.min(mpMax(s), s.mp + Math.round(mpMax(s) * Number(m[1])));
      if (s.mp > old) lines.push(`魔力 +${s.mp - old}`);
      return;
    }
    if ((m = raw.match(/^heal:([\d.]+)$/))) {
      const n = Math.round(hpMax(s) * Number(m[1]));
      const old = s.hp; s.hp = Math.min(hpMax(s), s.hp + n);
      if (s.hp > old) lines.push(`生命 +${s.hp - old}`);
      return;
    }
    if ((m = raw.match(/^attr:(\w+)([+-])(\d+)$/))) {
      s.attrs[m[1]] += (m[2] === '+' ? 1 : -1) * Number(m[3]);
      lines.push(`${LB.attr[m[1]]} ${m[2]}${m[3]}`);
      return;
    }
    if ((m = raw.match(/^(\w+)_exp([+-])(\d+(?:\.\d+)?)$/)) && ATTRS.includes(m[1])) {
      const n = Number(m[3]);
      if (m[2] === '+') gainAttrExp(s, m[1], n, lines, ctx && ctx.tag);
      else { s.attrExp[m[1]] = Math.max(0, s.attrExp[m[1]] - n); lines.push(`${LB.attr[m[1]]}经验 -${n}`); }
      return;
    }
    if ((m = raw.match(/^(gold|hp|hometown|exp|stamina|mp)([+-])(\d+(?:\.\d+)?)$/))) {
      const d = (m[2] === '+' ? 1 : -1) * Number(m[3]);
      if (m[1] === 'gold') {
        const old = s.gold; s.gold = Math.max(0, s.gold + d);
        if (s.gold !== old) lines.push(`金币 ${s.gold - old > 0 ? '+' : ''}${s.gold - old}`);
      } else if (m[1] === 'hp') {
        if (d < 0) hurt(s, -d, lines); else { const old = s.hp; s.hp = Math.min(hpMax(s), s.hp + d); lines.push(`生命 +${s.hp - old}`); }
      } else if (m[1] === 'hometown') {
        const old = s.hometown; s.hometown = clamp(old + d, 0, 100);
        if (s.hometown !== old) lines.push(`${LB.hometown} ${s.hometown - old > 0 ? '+' : ''}${s.hometown - old}`);
      } else if (m[1] === 'mp') {
        const old = s.mp; s.mp = clamp(old + d, 0, mpMax(s));
        if (s.mp !== old) lines.push(`魔力 ${s.mp - old > 0 ? '+' : ''}${s.mp - old}`);
      } else if (m[1] === 'exp') {
        if (d > 0) gainExp(s, d, lines);
      } else {
        s.stamina += d; lines.push(`体力 ${d > 0 ? '+' : ''}${d}`);
      }
      return;
    }
    throw new Error('未知效果 ' + raw);
  }
  function applyFx(s, list, ctx) {
    const lines = (ctx && ctx.lines) || [];
    const front = [];
    for (const raw of list || []) fx(s, raw, lines, front, ctx);
    s.queue.unshift(...front);
    return lines;
  }

  // ---------------------------------------------------------------- 技能
  function learnSkill(s, id, lines) {
    if (s.flags['sk_' + id]) return false;
    if (!SK[id]) throw new Error('未知技能 ' + id);
    s.flags['sk_' + id] = true;
    lines.push(`习得技能：${SK[id].name}（${LB.route[SK[id].route]}）——${SK[id].desc}`);
    return true;
  }
  function checkLearn(s) {
    const items = [];
    for (const r of script.autoLearn || []) {
      if (s.flags['sk_' + r.skill] || !test(s, r.cond)) continue;
      const lines = [];
      learnSkill(s, r.skill, lines);
      const st = r.story || {};
      items.push({ t: 'result', title: st.title || '习得新技能', text: st.text, portrait: st.portrait, scene: st.scene, lines, tone: 'skill' });
    }
    return items;
  }
  function skillChecks(s, k) {
    const r = (script.autoLearn || []).find(x => x.skill === k.id);
    if (!r || !r.checks) return [];
    return r.checks.map(c => ({ label: c.label, ok: test(s, c.cond), cur: c.cur ? value(s, c.cur) : null }));
  }
  const knownSkills = s => content.skills.filter(k => s.flags['sk_' + k.id]);
  const cdLeft = (s, k) => (s.cd && s.cd[k.id]) || 0;
  function tickCooldowns(s, except) {
    for (const id of Object.keys(s.cd || {})) { if (id === except) continue; s.cd[id] = Math.max(0, s.cd[id] - 1); if (!s.cd[id]) delete s.cd[id]; }
  }
  // 魔法威力随智力成长（智力每超过 10 点，胜率加成 +4.5%），其他路线暂不缩放
  function skillBonus(s, k, enemy) {
    const raw = k.win + ((k.vs && enemy.tag && k.vs[enemy.tag]) || 0);
    return k.route === 'magic' ? raw * (1 + (cfg.magicScale ?? 0.045) * Math.max(0, s.attrs.int - 10)) * (1 + (s.mods.magicPower || 0)) : raw;
  }
  function skillHint(k, s, enemy) {
    const parts = [k.mp ? `${k.mp} 魔力` : '无消耗'];
    // 魔法技能的威力随智力、天赋放大；有角色状态时显示实际值，没有时只显示基础值
    const mult = s && k.route === 'magic' ? (1 + (cfg.magicScale ?? 0.045) * Math.max(0, s.attrs.int - 10)) * (1 + (s.mods.magicPower || 0)) : 1;
    const pc = v => Math.round(v * mult * 100);
    if (k.win) parts.push(`胜率 +${pc(k.win)}%` + (k.route === 'magic' ? (s ? (mult > 1.005 ? `（基础 ${Math.round(k.win * 100)}%，智力 ${s.attrs.int}，放大 ×${mult.toFixed(2)}）` : `（智力 ${s.attrs.int}，尚未放大）`) : '（随智力成长）') : ''));
    for (const [t, v] of Object.entries(k.vs || {})) parts.push(`对${LB.tag[t]}再 +${pc(v)}%${enemy && enemy.tag === t ? '（本场生效）' : ''}`);
    if (k.heal) parts.push(`立刻恢复 ${Math.round(k.heal * 100)}% 生命`);
    if (k.injure !== undefined && k.injure !== 1) parts.push(`落败时受伤 ×${k.injure}`);
    if (k.cd) parts.push(`冷却 ${k.cd} 场战斗`);
    return parts.join('，');
  }

  // ---------------------------------------------------------------- 任务
  function startQuest(s, id, lines, front) {
    if (s.quests[id]) return;
    const q = QM[id];
    s.quests[id] = { state: 'active', stage: 0, startTurn: s.turn, stageTurn: s.turn, stageScore: 0 };
    // 变故：有 snag 的支线，开启时暗中掷一次骰子（幸运高一点点会好些），中了就会在 1 到 6 回合后因意外而失败（走任务自己的失败结果）
    if (q.snag && rand(s) < clamp(q.snag.p - (s.attrs.luk - 10) * 0.01, 0.05, 0.9)) s.quests[id].doom = s.turn + rint(s, 1, 6);
    if (q.type !== 'hidden') lines.push(`【任务开启】${q.name}`);
    if (q.intro && front) front.push({ t: 'result', title: q.intro.title || q.name, text: q.intro.text, portrait: q.intro.portrait, scene: q.intro.scene, lines: [`【任务开启】${q.name}`], tone: 'story' });
  }
  function failQuest(s, id, lines, front, miss) {
    const st = s.quests[id];
    if (!st || st.state !== 'active') return;
    const q = QM[id];
    st.state = 'failed';
    s.fragments++;
    lines.push(`【任务失败】${q.name}`);
    if (miss) for (const r of miss) fx(s, r, lines, front);
    for (const r of q.onFail || []) fx(s, r, lines, front);
  }
  // 命运阶位：支线期限 3 阶起提前 1 年，主线期限 5 阶起提前 1 年（终局事件 2 阶起提前，见 whenMatches）
  // 支线的期限每局还会有 -1 到 +1 年的随机偏移（s.qjit，开局时抽定）
  const fateShift = (s, q) => (q.type === 'main' ? (s.fate >= 5 ? 1 : 0) : (s.fate >= 1 ? 1 : 0) + ((s.qjit && s.qjit[q.id]) || 0));
  function checkQuests(s) {
    const lines = [];
    const front = [];
    const stories = [];
    for (const q of script.quests) {
      if (!s.quests[q.id] && q.start && test(s, q.start)) { startQuest(s, q.id, lines, stories); }
      const st = s.quests[q.id];
      if (!st || st.state !== 'active') continue;
      for (let guard = 0; guard < 8 && st.state === 'active'; guard++) {
        const stg = q.stages[st.stage];
        if (test(s, stg.done)) {
          const my = [`【任务进展】${q.name}：${stg.desc}`];
          st.stageScore += stg.score || 0;
          for (const r of stg.fx || []) fx(s, r, my, front);
          st.stage++; st.stageTurn = s.turn;
          if (st.stage >= q.stages.length) {
            st.state = 'done';
            my.push(`【任务完成】${q.name}`);
            for (const r of q.reward || []) fx(s, r, my, front);
          }
          const story = stg.story || (st.state === 'done' ? q.doneStory : null);
          if (story) stories.push({ t: 'result', title: story.title || q.name, text: story.text, portrait: story.portrait, scene: story.scene, lines: my, tone: 'story' });
          else lines.push(...my);
          continue;
        }
        if (st.doom !== undefined && s.turn >= st.doom) {
          lines.push(q.snag.text);
          failQuest(s, q.id, lines, front);
          break;
        }
        const sh = fateShift(s, q);
        if ((stg.deadlineAge != null && s.age >= stg.deadlineAge - sh) ||
            (q.deadlineAge != null && s.age >= q.deadlineAge - sh) ||
            (stg.deadlineTurns != null && s.turn - st.stageTurn > stg.deadlineTurns)) {
          failQuest(s, q.id, lines, front, stg.onMiss);
        }
        break;
      }
    }
    s.queue.unshift(...front);
    return { lines, stories };
  }

  // ---------------------------------------------------------------- 提示（界面读取 s.prompt）
  const sceneDefault = s => s.dun ? D[s.dun.id].scene
    : script.scenes ? script.scenes[SEASONS[s.season]]
    : 'village_' + (s.season === 1 ? 'spring' : SEASONS[s.season]);

  function actionsPrompt(s) {
    const items = [];
    for (const a of Object.values(A)) {
      if (!test(s, a.cond)) continue;
      if (a.tag === 'adventure' && hasStatus(s, 'injured')) continue;
      items.push({
        id: a.id, name: a.name, cost: a.cost, desc: a.desc || '', hint: a.hint || '', group: a.group || 'daily',
        disabled: s.stamina - a.cost < -cfg.overdraft,
      });
    }
    items.push({ id: '__end', name: '结束本回合', cost: 0, desc: s.stamina > 0 ? `还剩 ${s.stamina} 点体力，不会保留到下回合` : '', hint: '', group: 'end', disabled: false });
    return { kind: 'actions', items, scene: sceneDefault(s) };
  }

  function eventPrompt(s, e) {
    const notes = e.enter ? applyFx(s, e.enter, {}) : [];
    s.seen[e.id] = (s.seen[e.id] || 0) + 1;
    s.used[e.id] = true;
    s.last[e.id] = s.turn;
    const opts = (e.options && e.options.length ? e.options : [{ label: '继续' }]).map((o, i) => {
      const locked = !test(s, o.cond);
      const poor = (o.cost || 0) > 0 && s.stamina - o.cost < -cfg.overdraft;
      let hint = '';
      if (o.check && o.check.compose) { const c = chance(s, o.check); hint = `预计成功率 ${Math.round(c.p * 100)}%（${c.parts.map(x => `${x.label} ${x.v} ${x.add >= 0 ? '+' : ''}${Math.round(x.add * 100)}%`).join('，')}）`; }
      return { i, label: o.label, hint, avoid: !!o.avoid, cost: o.cost || 0, disabled: locked || poor, reason: locked ? (o.reason || '条件不足') : poor ? '体力不足' : '', hidden: locked && !!o.hideIfLocked };
    }).filter(o => !o.hidden);
    // 条件在事件弹出前后发生变化时，可能一个选项都点不了：给一个兜底，避免卡死
    if (!opts.some(o => !o.disabled)) opts.push({ i: -1, label: '继续', cost: 0, disabled: false, reason: '', hidden: false });
    return { kind: 'event', eid: e.id, title: e.title || '', text: e.text, notes, options: opts, portrait: e.portrait || null, scene: e.scene || sceneDefault(s) };
  }

  function resultPrompt(title, text, lines, extra) {
    return Object.assign({ kind: 'result', title, text: text || '', lines: lines || [] }, extra || {});
  }

  function dungeonPrompt(s) {
    const d = D[s.dun.id];
    const last = s.dun.layer === d.layers;
    let nodes;
    if (last) nodes = [{ type: 'boss', label: 'Boss', hint: '这一层的守护者' }];
    else {
      const w = d.nodeWeights || { fight: 5, chest: 2, event: 2, rest: 2 };
      nodes = [0, 1].map(() => {
        const type = wpick(s, Object.keys(w), k => w[k]);
        return { type, label: LB.node[type], hint: '' };
      });
    }
    s.dun.nodes = nodes;
    return { kind: 'dungeon', name: s.dun.name || d.name, layer: s.dun.layer, layers: d.layers, nodes, scene: d.scene, gold: s.dun.gold, exp: s.dun.exp, mult: s.dun.mult };
  }

  // 落败时受到的伤害：敌方战力×系数×战术倍率，敏捷每高于 8 点减伤 1.2%（最多 40%），地下城 Boss 额外加重
  const agiReduce = s => Math.min(0.4, 0.012 * Math.max(0, s.attrs.agi - 8));
  const lossDamage = (s, e, inj, boss) => e.power * (cfg.lossDamage || 0.5) * inj * (1 - agiReduce(s)) * (boss ? (cfg.bossLossMult || 1) : 1) * (s.fate >= 4 ? 1.08 : s.fate >= 2 ? 1.03 : 1);
  function combatPrompt(s) {
    const c = s.combat, e = c.enemy, my = powerOf(s);
    const base = clamp(0.5 + (my - e.power) * 0.02 + luckBonus(s), 0.05, 0.95);
    const tactics = [
      { id: 'attack', label: '强攻', hint: '胜率 +10%，落败时受伤 ×1.5', win: 0.1, injure: 1.5, mp: 0 },
      { id: 'defend', label: '稳守', hint: '胜率 -5%，落败时受伤减半', win: -0.05, injure: 0.5, mp: 0 },
    ];
    for (const k of knownSkills(s)) {
      const poor = s.mp < k.mp, cool = cdLeft(s, k);
      tactics.push({ id: 'skill:' + k.id, label: k.name, hint: skillHint(k, s, e), win: skillBonus(s, k, e), injure: k.injure === undefined ? 1 : k.injure, heal: k.heal || 0, mp: k.mp, route: k.route, disabled: poor || cool > 0, reason: cool > 0 ? `冷却中，还需 ${cool} 场战斗` : poor ? '魔力不足' : '' });
    }
    if (!c.noFlee) tactics.push({ id: 'flee', label: '撤退', hint: '敏捷检定，成功则无损脱身', mp: 0 });
    return {
      kind: 'combat', enemy: e.name, enemyPower: e.power, myPower: my, enemyTag: e.tag ? LB.tag[e.tag] : '',
      hp: s.hp, hpMax: hpMax(s), mp: s.mp, mpMax: mpMax(s),
      risk: base >= 0.65 ? '把握大' : base >= 0.4 ? '势均力敌' : '凶险',
      tactics, scene: c.scene || (s.dun ? D[s.dun.id].scene : sceneDefault(s)),
    };
  }

  function allocPrompt(s) {
    return { kind: 'alloc', points: s.freePoints, options: ATTRS.map(a => ({ id: a, label: LB.attr[a], value: s.attrs[a] })), scene: sceneDefault(s) };
  }

  // 一次性提示：content/config.json 的 tips
  function tipItem(s, id) {
    const t = TIPS && TIPS[id];
    if (!t || s.tips[id]) return null;
    s.tips[id] = true;
    return { t: 'result', title: t.title, text: t.text, lines: [], tone: 'tip' };
  }

  // ---------------------------------------------------------------- 队列推进
  function runItem(s, it) {
    switch (it.t) {
      case 'event': {
        const e = E[it.id];
        if (!e) throw new Error('找不到事件 ' + it.id);
        s.prompt = eventPrompt(s, e);
        return true;
      }
      case 'result':
        s.prompt = resultPrompt(it.title, it.text, it.lines, { tone: it.tone, scene: it.scene || sceneDefault(s), portrait: it.portrait });
        return true;
      case 'combatShow':
        s.prompt = combatPrompt(s);
        return true;
      case 'dungeonShow':
        s.prompt = dungeonPrompt(s);
        return true;
      case 'combat': {
        const tip = !it.tipped && tipItem(s, 'combat');
        if (tip) { s.queue.unshift(tip, Object.assign({}, it, { tipped: true })); return false; }
        const en0 = it.enemyObj || { name: EN[it.enemy].name, power: EN[it.enemy].power, exp: EN[it.enemy].exp || 0, gold: EN[it.enemy].gold, tag: EN[it.enemy].tag };
        const en = Object.assign({}, en0, { power: Math.round(en0.power * fateEnemyMult(s)) });
        s.combat = { enemy: en, win: it.win, lose: it.lose, flee: it.flee, noFlee: it.noFlee, from: it.from, boss: !!it.boss, scene: it.scene };
        s.prompt = combatPrompt(s);
        return true;
      }
      case 'dungeonNext':
        s.dun.layer++;
        if (s.dun.layer > D[s.dun.id].layers) { finishDungeon(s, true); return false; }
        s.prompt = dungeonPrompt(s);
        return true;
      case 'dungeonLeave': finishDungeon(s, false); return false;
      case 'dungeonRout': finishDungeon(s, false, true); return false;
      case 'dungeonClear': finishDungeon(s, true); return false;
      default: throw new Error('未知队列项 ' + it.t);
    }
  }

  function advance(s) {
    for (let guard = 0; guard < 400; guard++) {
      if (s.ended) return;
      const head = s.queue[0];
      if (head && head.intro) { s.queue.shift(); if (runItem(s, head)) return; continue; }
      const ql = checkQuests(s);
      const out = [...ql.stories];
      if (ql.lines.length) out.push({ t: 'result', title: '任务动态', lines: ql.lines, tone: 'quest' });
      out.push(...checkLearn(s));
      if (out.length) s.queue.unshift(...out);
      if (s.freePoints > 0 && !s.pendingEnd) {
        const tip = tipItem(s, 'alloc');
        if (tip) { s.queue.unshift(tip); } else { s.prompt = allocPrompt(s); return; }
      }
      const it = s.queue.shift();
      if (it) { if (runItem(s, it)) return; continue; }
      if (s.pendingEnd) { finish(s); return; }
      const low = s.stamina <= 1 && tipItem(s, 'overdraft');
      if (low) { s.queue.unshift(low); continue; }
      s.phase = 'act';
      s.prompt = actionsPrompt(s);
      return;
    }
    throw new Error('advance 循环次数过多');
  }

  // ---------------------------------------------------------------- 回合
  function staminaOfTurn(s) {
    s.stamina = staminaMax(s) - s.debt;
    if (s.debt > 0) { addStatus(s, 'fatigue', 2); }
    s.debt = 0;
  }

  // 特殊事件默认只播一次（once:false 表示可重复）；随机事件默认可重复（once:true 表示只出现一次）
  function isDue(s, e) {
    const once = e.once !== undefined ? e.once : e.kind === 'special';
    if (once && s.used[e.id]) return false;
    if (e.cooldown && s.last[e.id] !== undefined && s.turn - s.last[e.id] < e.cooldown) return false;
    return test(s, e.cond);
  }
  function whenMatches(s, e) {
    const w = e.when;
    if (!w) return true;
    const early = e.finale && s.fate >= 3 ? 1 : 0;   // 命运阶位 3：终局提前 1 年
    return (w.age === undefined || s.age === w.age - early) && (w.season === undefined || SEASONS[s.season] === w.season);
  }

  function pickSpecial(s) {
    // 新到期的特殊事件 + 之前被挤掉的特殊事件，每回合最多播一个
    const pool = [];
    for (const e of SPECIALS) {
      const deferred = s.deferred.find(d => d.id === e.id);
      if (deferred) {
        if (s.turn - deferred.since > 2) {
          s.deferred = s.deferred.filter(d => d.id !== e.id);
          s.flags['missed_' + e.id] = true;
          continue;
        }
        if (isDue(s, e)) pool.push({ e, since: deferred.since });
      } else if ((!e.when || whenMatches(s, e)) && isDue(s, e)) {
        pool.push({ e, since: s.turn });
      }
    }
    if (!pool.length) return null;
    pool.sort((a, b) => ((b.e.priority || 0) - (a.e.priority || 0)) || (a.since - b.since));
    const [first, ...rest] = pool;
    s.deferred = s.deferred.filter(d => d.id !== first.e.id);
    for (const r of rest) if (!s.deferred.some(d => d.id === r.e.id)) s.deferred.push({ id: r.e.id, since: r.since });
    return first.e;
  }

  function pickRandom(s) {
    if (rand(s) >= cfg.randomEventChance && s.dry < 1) { s.dry++; return null; }
    let cands = RANDOMS.filter(e => isDue(s, e));
    if (!cands.length) { s.dry++; return null; }
    if (s.calamityStreak >= 3) {
      const good = cands.filter(e => e.pool === 'opportunity');
      if (good.length) cands = good;
    }
    const f = (s.attrs.luk - 10) / 10 * 0.1;
    const e = wpick(s, cands, c => {
      let w = c.weight || 10;
      if (c.pool === 'opportunity') w *= Math.max(0.2, 1 + f);
      if (c.pool === 'calamity') w *= Math.max(0.2, 1 - f) * (s.fate >= 1 ? 1.2 : 1);
      return w;
    });
    s.calamityStreak = e.pool === 'calamity' ? s.calamityStreak + 1 : 0;
    s.dry = 0;
    return e;
  }

  function startTurn(s) {
    s.phase = 'start';
    for (const k of Object.keys(s.flags)) if (k.startsWith('t_')) delete s.flags[k];
    staminaOfTurn(s);
    const note = staminaChangeNote(s);
    if (note) s.queue.push(note);
    const sp = pickSpecial(s);
    if (sp) s.queue.push({ t: 'event', id: sp.id });
    const rd = pickRandom(s);
    if (rd) s.queue.push({ t: 'event', id: rd.id });
    advance(s);
  }

  function endTurn(s) {
    s.debt = Math.max(0, -s.stamina);
    // 生活费
    const cost = script.livingCost;
    const paid = Math.min(s.gold, cost);
    s.gold -= paid;
    const lines = [];
    if (paid < cost) { s.hometown = clamp(s.hometown - 2, 0, 100); lines.push(`${script.livingMsg || '钱不够交这一季的生活费，日子紧了些'}（${LB.hometown} -2）。`); }
    // 状态
    for (const st of s.status) st.turns--;
    s.status = s.status.filter(st => st.turns > 0);
    // 自然恢复
    const regen = Math.ceil(hpMax(s) * cfg.regen);
    s.hp = Math.min(hpMax(s), s.hp + regen);
    s.mp = Math.min(mpMax(s), s.mp + Math.ceil(mpMax(s) * cfg.mpRegen));
    tickCooldowns(s, null);
    s.turn++;
    s.season = (s.season + 1) % 4;
    if (s.season === 0) {
      const yl = [];
      for (const r of script.yearEnd || []) {
        if (!test(s, r.cond)) continue;
        if (r.text) yl.push(r.text);
        applyFx(s, r.fx, { lines: yl });
      }
      s.queue.push({ t: 'result', title: `${s.age} 岁这一年结束了`, text: '', lines: yl, tone: 'year' });
      s.age++;
    }
    if (lines.length) s.queue.unshift({ t: 'result', title: '季末结算', lines });
    if (s.turn >= s.maxTurns && !s.pendingEnd) { s.flags.natural_end = true; setEnd(s, 'auto'); }
    if (s.pendingEnd) { advance(s); return; }
    startTurn(s);
  }

  // ---------------------------------------------------------------- 行动
  function chooseAction(s, idx) {
    const it = s.prompt.items[idx];
    if (!it || it.disabled) return;
    if (it.id === '__end') { endTurn(s); return; }
    const a = A[it.id];
    s.stamina -= a.cost;
    s.stats.stamina += a.cost;
    s.stats.actions[a.id] = (s.stats.actions[a.id] || 0) + 1;
    if (a.dungeon) { startDungeon(s, a); return; }
    const lines = [];
    let text, branch = null;
    if (a.check) {
      const r = check(s, a.check);
      lines.push(checkLine(a.check, r));
      branch = r.ok ? (a.great && r.roll < r.p * 0.2 ? a.great : a.ok) : a.fail;
    }
    const ctx = { lines, tag: a.tag };
    applyFx(s, a.fx, ctx);
    if (branch) { applyFx(s, branch.fx, ctx); text = branch.text; }
    if (!text && a.texts) text = pick(s, a.texts);
    s.prompt = resultPrompt(a.name, text, lines, { scene: a.scene || sceneDefault(s), portrait: a.portrait });
    if (rand(s) < cfg.derivedChance) {
      const c = DERIVED.filter(e => e.parent === a.id && !(e.once && s.used[e.id]) && test(s, e.cond));
      if (c.length) s.queue.push({ t: 'event', id: wpick(s, c, e => e.weight || 10).id });
    }
  }

  function chooseEvent(s, idx) {
    const e = E[s.prompt.eid];
    const meta = s.prompt.options[idx];
    if (!meta || meta.disabled) return;
    const o = meta.i === -1 ? { label: '继续', fx: [] } : e.options && e.options.length ? e.options[meta.i] : { label: '继续', fx: e.fx };
    s.stamina -= o.cost || 0;
    s.stats.stamina += o.cost || 0;
    const lines = [];
    let text, list;
    if (o.check) {
      const r = check(s, o.check);
      lines.push(checkLine(o.check, r));
      const b = r.ok ? o.ok : o.fail;
      text = b.text; list = b.fx;
    } else { text = o.text; list = o.fx; }
    applyFx(s, list, { lines });
    s.prompt = resultPrompt(e.title || o.label, text, lines, { portrait: e.portrait, scene: e.scene || sceneDefault(s) });
  }

  // ---------------------------------------------------------------- 地下城与战斗
  function startDungeon(s, a) {
    const d = D[a.dungeon];
    const recent = (s.dunRuns[d.id] || []).filter(t => s.turn - t < 4).length;
    s.dunRuns[d.id] = [...(s.dunRuns[d.id] || []), s.turn];
    s.dun = { id: d.id, layer: 1, layers: d.layers, gold: 0, exp: 0, kills: 0, nodes: [], mult: Math.max(0.45, 1 - 0.12 * recent), name: a.dungeonName || d.name };
    const tip = tipItem(s, 'dungeon');
    if (tip) { s.queue.unshift(tip, { t: 'dungeonShow' }); advance(s); return; }
    s.prompt = dungeonPrompt(s);
  }

  function chooseDungeon(s, idx) {
    const d = D[s.dun.id];
    if (idx >= s.dun.nodes.length) { // 撤离
      s.queue.unshift({ t: 'dungeonLeave' });
      advance(s);
      return;
    }
    const node = s.dun.nodes[idx];
    const lines = [];
    const layer = s.dun.layer;
    if (node.type === 'fight' || node.type === 'boss') {
      const boss = node.type === 'boss';
      const power = d.power + (layer - 1) * d.step + (boss ? d.bossBonus : 0);
      const exp = boss ? d.bossExp : rint(s, d.exp[0], d.exp[1]);
      const en = { name: boss ? d.boss : pick(s, d.enemies), power, exp, gold: boss ? d.bossGold : d.gold, tag: d.tag };
      s.queue.unshift({ t: 'combat', enemyObj: en, win: [], lose: [], flee: [], noFlee: false, from: 'dungeon', boss, scene: d.scene });
      advance(s);
      return;
    }
    if (node.type === 'chest') {
      const g = Math.round(rint(s, d.chest[0], d.chest[1]) * s.dun.mult);
      applyFx(s, [`gold+${g}`], { lines });
      s.dun.gold += g;
      const lootList = (script.dungeonLoot && script.dungeonLoot[d.id]) || d.loot;
      const owned = lootList.filter(id => !s.gear.includes(id));
      if (owned.length && rand(s) < 0.35) applyFx(s, ['item:' + pick(s, owned)], { lines });
      s.queue.unshift({ t: 'dungeonNext' });
      s.prompt = resultPrompt('宝箱', pick(s, ['箱子里的东西不多，但够你高兴一阵。', '锁已经锈了，一脚就踹开了。', '灰尘下面压着一只旧箱子。']), lines, { scene: d.scene });
      return;
    }
    if (node.type === 'rest') {
      applyFx(s, ['heal:0.3', 'mpheal:0.3'], { lines });
      s.queue.unshift({ t: 'dungeonNext' });
      s.prompt = resultPrompt('休息点', '你在一处干燥的角落歇了口气。', lines, { scene: d.scene });
      return;
    }
    // 事件节点：从地下城事件池里抽一个，播完继续下一层
    const c = DUNGEON_EVENTS.filter(e => isDue(s, e) && (!e.dungeons || e.dungeons.includes(s.dun.id)));
    const e = wpick(s, c.length ? c : DUNGEON_EVENTS, x => x.weight || 10);
    s.queue.unshift({ t: 'event', id: e.id }, { t: 'dungeonNext' });
    advance(s);
  }

  function finishDungeon(s, cleared, routed) {
    const d = D[s.dun.id];
    const lines = [];
    const first = cleared && !s.clears[d.id];
    if (cleared) {
      s.clears[d.id] = (s.clears[d.id] || 0) + 1;
      s.flags['clear_' + d.id] = true;
      if (first) applyFx(s, d.onClear, { lines });
    }
    const text = cleared ? `你击败了「${d.boss}」，从${s.dun.name || d.name}凯旋。` : routed ? `你败给了「${d.boss}」，拖着伤痕累累的身体逃出了${s.dun.name || d.name}。` : `你带着已有的收获离开了${s.dun.name || d.name}。`;
    const sum2 = [`本次探索：金币 +${s.dun.gold}，经验 +${s.dun.exp}`].concat(lines);
    s.dun = null;
    s.queue.unshift({ t: 'result', title: cleared ? '探索成功' : routed ? '败退' : '撤离', text, lines: sum2 });
  }

  function chooseCombat(s, tid) {
    const c = s.combat, e = c.enemy, my = powerOf(s);
    const lines = [];
    let text;
    let win = false, fled = false;
    let tac = 0, inj = 1, usedSkill = null;
    if (tid === 'attack') { tac = 0.1; inj = 1.5; }
    else if (tid === 'defend') { tac = -0.05; inj = 0.5; }
    else if (tid.startsWith('skill:')) {
      const k = SK[tid.slice(6)];
      if (!k || !s.flags['sk_' + k.id] || s.mp < k.mp || cdLeft(s, k) > 0) return;
      s.mp -= k.mp;
      usedSkill = k.id;
      s.cd[k.id] = k.cd || 0;
      if (!s.cd[k.id]) delete s.cd[k.id];
      s.stats.skills[k.id] = (s.stats.skills[k.id] || 0) + 1;
      lines.push(`施展「${k.name}」${k.mp ? `（魔力 -${k.mp}）` : ''}`);
      if (k.heal) applyFx(s, [`heal:${k.heal}`], { lines });
      tac = skillBonus(s, k, e);
      inj = k.injure === undefined ? 1 : k.injure;
    }
    if (tid === 'flee') {
      const diff = 10 + Math.round((e.power - my) / 4);
      const r = check(s, { attr: 'agi', diff });
      lines.push(checkLine({ attr: 'agi' }, r));
      if (r.ok) { fled = true; text = '你抓住时机甩开了对手。'; applyFx(s, c.flee, { lines }); }
      else { text = '没跑掉，被追上狠狠打了一下。'; hurt(s, lossDamage(s, e, 1, false), lines); }
    } else {
      const p = clamp(0.5 + (my - e.power) * 0.02 + tac + luckBonus(s), 0.05, 0.95);
      win = rand(s) < p;
      lines.push(`战力 ${my} 对 ${e.power}，胜率 ${Math.round(p * 100)}%：${win ? '获胜' : '落败'}`);
      if (win) {
        text = `你击败了${e.name}。`;
        const mult = s.dun ? s.dun.mult : 1;
        if (e.exp) { const x = Math.round(e.exp * mult); gainExp(s, x, lines); if (s.dun) s.dun.exp += x; }
        if (e.gold) {
          const g = Math.round((Array.isArray(e.gold) ? rint(s, e.gold[0], e.gold[1]) : e.gold) * mult);
          applyFx(s, [`gold+${g}`], { lines });
          if (s.dun) s.dun.gold += g;
        }
        applyFx(s, c.win, { lines });
      } else {
        text = `${e.name}占了上风，你受了伤。`;
        hurt(s, lossDamage(s, e, inj, c.from === 'dungeon' && c.boss), lines);
        applyFx(s, c.lose, { lines });
      }
    }
    tickCooldowns(s, usedSkill);
    const dungeon = c.from === 'dungeon';
    s.combat = null;
    s.prompt = resultPrompt(e.name, text, lines, { scene: c.scene });
    if (dungeon && !s.pendingEnd) {
      if (fled) s.queue.unshift({ t: 'dungeonLeave' });
      else if (win && c.boss) s.queue.unshift({ t: 'dungeonClear' });
      else if (c.boss) s.queue.unshift({ t: 'dungeonRout' });
      else s.queue.unshift({ t: 'dungeonNext' });
    }
  }

  // ---------------------------------------------------------------- 结局与结算
  function finish(s) {
    let end;
    if (s.pendingEnd === 'auto') end = script.endings.find(e => test(s, e.cond));
    else end = script.endings.find(e => e.id === s.pendingEnd);
    if (!end) throw new Error('找不到结局 ' + s.pendingEnd);
    const score = computeScore(content, script, s, end);
    s.ended = { id: end.id, name: end.name, text: end.text, kind: end.kind, mult: end.mult, score, age: s.age, turn: s.turn, cleared: script.clearCond ? test(s, script.clearCond) : end.kind !== 'fail' };
    s.prompt = { kind: 'end', ending: s.ended, scene: sceneDefault(s) };
  }

  // ---------------------------------------------------------------- 对外接口
  function newRun(opts = {}) {
    const st = script.start;
    const s = {
      v: 1, script: scriptId, rng: (opts.seed === undefined ? Date.now() : opts.seed) | 0,
      age: st.age, season: 0, turn: 0, maxTurns: script.maxTurns || cfg.maxTurns,
      stamina: 0, debt: 0, mp: 0, counters: Object.assign({}, st.counters || {}), cd: {}, tips: {}, dry: 0,
      attrs: Object.assign({}, st.attrs), attrStart: {}, attrExp: { str: 0, agi: 0, int: 0, wil: 0, cha: 0, luk: 0 },
      level: 1, exp: 0, freePoints: 0, rank: 1, hp: 0, gold: st.gold, hometown: st.hometown || 0,
      rep: Object.assign({}, st.rep), rel: Object.assign({}, st.rel), flags: Object.assign({}, st.flags || {}),
      status: [], quests: {}, gear: [...(st.gear || [])],
      queue: [], deferred: [], seen: {}, used: {}, last: {}, clears: {}, fragments: 0,
      fate: Math.max(0, Math.min(5, opts.fate || 0)), relic: null,
      qjit: {},
      memories: (opts.memories || []).filter(id => (content.meta.shards || []).some(x => x.id === id && (!x.script || x.shared || x.script.includes(scriptId)))),
      aspiration: opts.aspiration || null, talents: opts.talents || [], codex: opts.codex || [],
      mods: {}, calamityStreak: 0, log: [], prompt: null, phase: 'start', ended: null, pendingEnd: null,
      dun: null, dunRuns: {}, combat: null, stats: { stamina: 0, actions: {}, skills: {} },
    };
    for (const q of script.quests) if (q.type === 'side' && q.deadlineAge != null) s.qjit[q.id] = pick(s, [-1, 0, 0, 1]);
    const up = opts.up || {};
    for (const a of ATTRS) s.attrs[a] += up[a] || 0;
    s.mods.staminaBonus = up.stamina || 0;
    for (const id of s.talents) {
      const t = content.meta.talents.find(x => x.id === id);
      if (!t) continue;
      for (const [k, v] of Object.entries(t.mods)) s.mods[k] = (s.mods[k] || 0) + v;
    }
    // 遗物（传承）：开局携带一件，写在 content/meta.json 的 relics
    const relic = (content.meta.relics || []).find(r => r.id === opts.relic && (!r.script || r.script.includes(scriptId)));
    if (relic) {
      s.relic = relic.id;
      for (const [k, v] of Object.entries(relic.mods || {})) s.mods[k] = (s.mods[k] || 0) + v;
      const rs = relic.start || {};
      for (const id of rs.gear || []) if (!s.gear.includes(id)) s.gear.push(id);
      Object.assign(s.flags, rs.flags || {});
      for (const [k, v] of Object.entries(rs.counters || {})) s.counters[k] = (s.counters[k] || 0) + v;
      for (const [k, v] of Object.entries(rs.rep || {})) s.rep[k] = (s.rep[k] || 0) + v;
      for (const [k, v] of Object.entries(rs.rel || {})) s.rel[k] = (s.rel[k] || 0) + v;
      for (const [k, v] of Object.entries(rs.attrs || {})) s.attrs[k] += v;
      s.gold += rs.gold || 0;
      s.hometown = clamp(s.hometown + (rs.hometown || 0), 0, 100);
    }
    for (const a of ATTRS) s.attrs[a] += s.mods['start_' + a] || 0;
    s.gold += s.mods.startGold || 0;
    s.attrStart = Object.assign({}, s.attrs);
    s.hp = hpMax(s);
    s.mp = mpMax(s);
    say(s, script.intro);
    if (s.memories.length) say(s, `【前世记忆】${s.memories.map(id => content.meta.shards.find(x => x.id === id).name).join('、')}，在脑海里隐隐浮现。`);
    if (opts.intro !== false) for (const pg of script.introPages || []) s.queue.push({ t: 'result', title: pg.title, text: pg.text, portrait: pg.portrait, scene: pg.scene, lines: [], tone: 'story', intro: true });
    startTurn(s);
    return s;
  }

  // 旧存档补字段
  function migrate(s) {
    if (s.mp === undefined) s.mp = mpMax(s);
    if (!s.counters) s.counters = {};
    if (!s.cd) s.cd = {};
    if (!s.tips) s.tips = {};
    if (s.dry === undefined) s.dry = 0;
    if (s.fate === undefined) s.fate = 0;
    if (s.relic === undefined) s.relic = null;
    if (!s.memories) s.memories = [];
    if (!s.qjit) s.qjit = {};
    if (!s.stats.skills) s.stats.skills = {};
    return s;
  }

  function choose(s, idx) {
    const p = s.prompt;
    if (!p || s.ended) return;
    switch (p.kind) {
      case 'actions': chooseAction(s, idx); break;
      case 'event': chooseEvent(s, idx); break;
      case 'result': say(s, [p.title, p.text].filter(Boolean).join('：')); advance(s); break;
      case 'dungeon': chooseDungeon(s, idx); break;
      case 'combat': chooseCombat(s, p.tactics[idx].id); break;
      case 'alloc': s.attrs[p.options[idx].id]++; s.freePoints--; advance(s); break;
      default: break;
    }
  }

  function view(s) {
    return {
      display: (script.display || []).map(d => ({ key: d.key, label: d.label, top: !!d.top, help: d.help, value: d.flag ? (s.flags[d.flag] ? '是' : '否') : (s.counters[d.key] || 0) })),
      gear: gearView(s),
      fate: s.fate || 0, memories: (s.memories || []).map(id => (content.meta.shards || []).find(x => x.id === id)).filter(Boolean), relic: s.relic ? (content.meta.relics || []).find(r => r.id === s.relic) : null,
      hpMax: hpMax(s), mpMax: mpMax(s), staminaMax: staminaMax(s), staminaParts: staminaParts(s).map(p => ({ label: p.label, val: p.val })), powerParts: powerParts(s),
      skills: content.skills.filter(k => s.flags['sk_' + k.id] || (script.autoLearn || []).some(r => r.skill === k.id)).map(k => ({ id: k.id, name: k.name, route: k.route, known: !!s.flags['sk_' + k.id], hint: skillHint(k, s), desc: k.desc, learn: k.learn, checks: skillChecks(s, k) })), power: powerOf(s), expNeed: expNeed(s),
      attrNeed: Object.fromEntries(ATTRS.map(a => [a, attrNeed(s.attrs[a])])),
      scene: (s.prompt && s.prompt.scene) || sceneDefault(s),
      rankName: script.ranks[s.rank - 1],
      quests: script.quests.filter(q => s.quests[q.id] && q.type !== 'hidden').map(q => {
        const st = s.quests[q.id];
        const stg = q.stages[Math.min(st.stage, q.stages.length - 1)];
        let dl = '';
        if (st.state === 'active') {
          const age = stg.deadlineAge != null ? stg.deadlineAge : q.deadlineAge;
          if (age != null) dl = `${age - fateShift(s, q)} 岁前`;
          if (stg.deadlineTurns != null) dl = `剩 ${Math.max(0, stg.deadlineTurns - (s.turn - st.stageTurn) + 1)} 回合`;
        }
        const checks = st.state === 'active' && stg.checks ? stg.checks.map(c => ({ label: c.label, ok: test(s, c.cond) })) : [];
        return { id: q.id, name: q.name, type: q.type, checks, state: st.state, stage: st.stage, stages: q.stages.length, desc: st.state === 'active' ? stg.desc : (st.state === 'done' ? '已完成' : '已失败'), deadline: dl };
      }),
    };
  }

  return { newRun, choose, view, migrate, hpMax, mpMax, staminaMax, powerOf, labels: LB, help: HELP, script, content, A, E, D, QM, ATTRS };
}
