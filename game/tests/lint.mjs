// 内容检查：事件/任务/地下城引用是否存在，条件和效果语法是否能解析
import { loadNodeContent } from '../sim/load.js';
import { makeGame } from '../src/engine.js';
import { test } from '../src/cond.js';
import { readdirSync } from 'node:fs';

const content = await loadNodeContent();
const assetDir = new URL('../../', import.meta.url).pathname;
const errs = [];
const FX = [
  /^log:/, /^goto:\w+$/, /^flag[+-]:\w+$/, /^flagclear:\w+$/, /^rel:\w+[+-]\d+$/, /^rep:\w+[+-]\d+$/,
  /^quest:(start|fail):\w+$/, /^status[+-]:\w+(:\d+)?$/, /^end:\w+$/, /^rank:\d+$/, /^item:\w+$/, /^heal:[\d.]+$/,
  /^attr:\w+[+-]\d+$/, /^(str|agi|int|wil|cha|luk)_exp[+-][\d.]+$/, /^(gold|hp|hometown|exp|stamina|mp)[+-][\d.]+$/, /^learn:\w+$/, /^count:\w+[+-]\d+$/, /^mpheal:[\d.]+$/,
];

const SCENES = new Set(readdirSync(assetDir + 'scenes').map(f => f.replace(/^scene_|\.png$/g, '')));
const PORTS = new Set(readdirSync(assetDir + 'portraits').map(f => f.replace(/^portrait_|_normal\.png$/g, '')));

// 结局都要有线索（结局博物馆用）
for (const sc of Object.values(content.scripts)) for (const e of sc.endings) if (!e.hint) errs.push(`[${sc.id}] 结局 ${e.id}: 缺少 hint`);
// 遗物检查（与剧本无关，只检查一次）
{
  const probe = makeGame(content, Object.keys(content.scripts)[0]).newRun({ seed: 1 });
  const KNOWN_MODS = new Set(['deathChecks', 'staminaBonus', 'mpBonus', 'powerBonus', 'start_luk', 'start_str', 'start_agi', 'start_int', 'start_wil', 'start_cha', 'rpBonus', 'startGold', 'magicPower', 'lateExp', 'lateAge']);
  const seen = new Set();
  for (const r of content.meta.relics || []) {
    if (seen.has(r.id)) errs.push(`遗物 id 重复: ${r.id}`); seen.add(r.id);
    try { test(probe, r.unlock.cond); } catch (e) { errs.push(`遗物 ${r.id}: 解锁条件错误 ${e.message}`); }
    for (const sc of r.script || []) if (!content.scripts[sc]) errs.push(`遗物 ${r.id}: 剧本 ${sc} 不存在`);
    for (const k of Object.keys(r.mods || {})) if (!KNOWN_MODS.has(k)) errs.push(`遗物 ${r.id}: 未知加成 ${k}`);
    for (const it of (r.start && r.start.gear) || []) if (!content.items[it]) errs.push(`遗物 ${r.id}: 找不到物品 ${it}`);
    if (!r.desc || !r.unlock.text) errs.push(`遗物 ${r.id}: 缺少说明`);
  }
  // 记忆碎片检查：id 唯一、条件可解析、剧本存在；内容里引用的碎片必须存在
  const shardIds = new Set();
  for (const r of content.meta.shards || []) {
    if (shardIds.has(r.id)) errs.push(`碎片 id 重复: ${r.id}`); shardIds.add(r.id);
    try { test(probe, r.unlock.cond); } catch (e) { errs.push(`碎片 ${r.id}: 解锁条件错误 ${e.message}`); }
    for (const sc of r.script || []) if (!content.scripts[sc]) errs.push(`碎片 ${r.id}: 剧本 ${sc} 不存在`);
    if (!r.name || !r.text || !r.use || !r.unlock.text) errs.push(`碎片 ${r.id}: 缺少说明`);
  }
  const blob = JSON.stringify([content.common, ...Object.values(content.scripts)]);
  for (const m of blob.matchAll(/memory:([A-Za-z0-9_]+)/g)) if (!shardIds.has(m[1])) errs.push(`引用了不存在的记忆碎片 memory:${m[1]}`);
  for (const m of blob.matchAll(/"memDiff":\{"id":"([A-Za-z0-9_]+)"/g)) if (!shardIds.has(m[1])) errs.push(`memDiff 引用了不存在的记忆碎片 ${m[1]}`);
  if ((content.config.fateRules || []).length !== 5) errs.push('config.fateRules 应有 5 条');
}

function lintScript(sid) {
const g = makeGame(content, sid);
const s = g.newRun({ seed: 1 });
const script = content.scripts[sid];
const pre = m => `[${sid}] ${m}`;
const E_ = errs;
const errsLocal = { push: m => E_.push(pre(m)) };
const dup = {};
for (const e of [...content.common.events, ...script.events]) { if (dup[e.id]) errsLocal.push(`事件 id 重复: ${e.id}`); dup[e.id] = 1; }
const events = g.E, quests = g.QM, actions = g.A, dungeons = g.D, enemies = content.enemies, items = content.items;

function checkCond(where, c) {
  if (typeof c === 'string' && c.includes('||')) errsLocal.push(`${where}: 条件里不支持 ||，请改写成数组（或）: ${c}`);
  if (Array.isArray(c) && c.some(x => x.includes('||'))) errsLocal.push(`${where}: 数组条件里不能再写 ||`);
  try { test(s, c); } catch (e) { errsLocal.push(`${where}: 条件错误 ${JSON.stringify(c)} (${e.message})`); }
}
function walkFx(where, list) {
  for (const f of list || []) {
    if (typeof f === 'string') {
      if (!FX.some(r => r.test(f))) errsLocal.push(`${where}: 效果语法错误 "${f}"`);
      let m;
      if ((m = f.match(/^goto:(\w+)$/)) && !events[m[1]]) errsLocal.push(`${where}: goto 找不到事件 ${m[1]}`);
      if ((m = f.match(/^quest:\w+:(\w+)$/)) && !quests[m[1]]) errsLocal.push(`${where}: 找不到任务 ${m[1]}`);
      if ((m = f.match(/^item:(\w+)$/)) && !items[m[1]]) errsLocal.push(`${where}: 找不到物品 ${m[1]}`);
      if ((m = f.match(/^learn:(\w+)$/)) && !content.skills.some(k => k.id === m[1])) errsLocal.push(`${where}: 找不到技能 ${m[1]}`);
    } else if (f.if !== undefined) {
      checkCond(where, f.if); walkFx(where, f.then); walkFx(where, f.else);
    } else if (f.type === 'combat') {
      if (!enemies[f.enemy]) errsLocal.push(`${where}: 找不到敌人 ${f.enemy}`);
      walkFx(where, f.win); walkFx(where, f.lose); walkFx(where, f.flee);
    } else errsLocal.push(`${where}: 未知效果对象`);
  }
}
for (const e of Object.values(events)) {
  const w = `事件 ${e.id}`;
  checkCond(w, e.cond); walkFx(w, e.enter); walkFx(w, e.fx);
  if (e.kind === 'derived' && !actions[e.parent]) errsLocal.push(`${w}: parent 行动不存在 ${e.parent}`);
  for (const o of e.options || []) {
    checkCond(w, o.cond); walkFx(w, o.fx);
    if (o.check) { walkFx(w, o.ok && o.ok.fx); walkFx(w, o.fail && o.fail.fx); if (!o.ok || !o.fail) errsLocal.push(`${w}: 检定缺少 ok/fail`); }
  }
}
for (const a of Object.values(actions)) {
  const w = `行动 ${a.id}`;
  checkCond(w, a.cond); walkFx(w, a.fx);
  if (a.dungeon && !dungeons[a.dungeon]) errsLocal.push(`${w}: 找不到地下城 ${a.dungeon}`);
  if (a.check) { walkFx(w, a.ok && a.ok.fx); walkFx(w, a.fail && a.fail.fx); walkFx(w, a.great && a.great.fx); if (!a.ok || !a.fail) errsLocal.push(`${w}: 检定缺少 ok/fail`); }
  if (!a.dungeon && !a.fx && !a.check) errsLocal.push(`${w}: 没有任何效果`);
}
for (const q of Object.values(quests)) {
  const w = `任务 ${q.id}`;
  checkCond(w, q.start); walkFx(w, q.reward); walkFx(w, q.onFail);
  for (const st of q.stages) { checkCond(w, st.done); walkFx(w, st.fx); walkFx(w, st.onMiss); }
}
for (const d of Object.values(dungeons)) {
  walkFx(`地下城 ${d.id}`, d.onClear);
  for (const it of d.loot) if (!items[it]) errsLocal.push(`地下城 ${d.id}: 找不到物品 ${it}`);
}
const SCENES = new Set(readdirSync(assetDir + 'scenes').map(f => f.replace(/^scene_|\.png$/g, '')));
const PORTS = new Set(readdirSync(assetDir + 'portraits').map(f => f.replace(/^portrait_|_normal\.png$/g, '')));
for (const e of Object.values(events)) {
  if (e.scene && !SCENES.has(e.scene)) errsLocal.push(`事件 ${e.id}: 素材名 scene 不存在 ${e.scene}`);
  if (e.portrait && !PORTS.has(e.portrait)) errsLocal.push(`事件 ${e.id}: 素材名 portrait 不存在 ${e.portrait}`);
}
for (const sn of Object.values(script.scenes || {})) if (!SCENES.has(sn)) errsLocal.push(`script.scenes 里的 ${sn} 不存在`);
for (const a of Object.values(actions)) if (a.scene && !SCENES.has(a.scene)) errsLocal.push(`行动 ${a.id}: 素材名 scene 不存在 ${a.scene}`);
for (const d of Object.values(dungeons)) if (!SCENES.has(d.scene)) errsLocal.push(`地下城 ${d.id}: 素材名 scene 不存在 ${d.scene}`);
const storyOf = o => [o.story, o.intro, o.doneStory].filter(Boolean);
for (const q of script.quests) for (const st of [...storyOf(q), ...q.stages.flatMap(storyOf)]) { if (st.scene && !SCENES.has(st.scene)) errsLocal.push(`任务 ${q.id}: scene ${st.scene}`); if (st.portrait && !PORTS.has(st.portrait)) errsLocal.push(`任务 ${q.id}: portrait ${st.portrait}`); }
for (const pg of [...(script.introPages || []), ...(script.autoLearn || []).map(r => r.story || {})]) { if (pg.scene && !SCENES.has(pg.scene)) errsLocal.push(`剧情页 scene ${pg.scene}`); if (pg.portrait && !PORTS.has(pg.portrait)) errsLocal.push(`剧情页 portrait ${pg.portrait}`); }
const SKL = Object.fromEntries(content.skills.map(k => [k.id, k]));
for (const k of content.skills) { if (!['martial', 'holy', 'magic', 'shadow', 'tide'].includes(k.route)) errsLocal.push(`技能 ${k.id}: 路线错误`); for (const t of Object.keys(k.vs || {})) if (!content.config.labels.tag[t]) errsLocal.push(`技能 ${k.id}: 未知标签 ${t}`); }
for (const r of script.autoLearn || []) { checkCond('autoLearn ' + r.skill, r.cond); if (!SKL[r.skill]) errsLocal.push(`autoLearn: 找不到技能 ${r.skill}`); }
for (const [id, en] of Object.entries(enemies)) if (en.tag && !content.config.labels.tag[en.tag]) errsLocal.push(`敌人 ${id}: 未知标签 ${en.tag}`);
for (const d of Object.values(dungeons)) if (d.tag && !content.config.labels.tag[d.tag]) errsLocal.push(`地下城 ${d.id}: 未知标签 ${d.tag}`);
for (const r of (script.yearEnd || [])) { checkCond('yearEnd', r.cond); walkFx('yearEnd', r.fx); }
for (const e of script.endings) checkCond('结局 ' + e.id, e.cond);
for (const a of (script.aspirations || [])) checkCond('志向 ' + a.id, a.cond);
for (const m of (script.staminaMods || [])) checkCond('staminaMods', m.cond);


// 额外检查
const ranks = script.ranks || [];
const labelRep = Object.assign({}, content.config.labels.rep, (script.labels || {}).rep);
const allFx = [];
const grab = list => { for (const f of list || []) { if (typeof f === 'string') allFx.push(f); else if (f.if !== undefined) { grab(f.then); grab(f.else); } else if (f.type === 'combat') { grab(f.win); grab(f.lose); grab(f.flee); } } };
for (const e of Object.values(events)) { grab(e.enter); grab(e.fx); for (const o of e.options || []) { grab(o.fx); grab(o.ok && o.ok.fx); grab(o.fail && o.fail.fx); } }
for (const a of Object.values(actions)) { grab(a.fx); grab(a.ok && a.ok.fx); grab(a.fail && a.fail.fx); grab(a.great && a.great.fx); }
for (const q of Object.values(quests)) { grab(q.reward); grab(q.onFail); for (const st of q.stages) { grab(st.fx); grab(st.onMiss); } }
for (const r of script.yearEnd || []) grab(r.fx);
for (const f of allFx) {
  let m;
  if ((m = f.match(/^rank:(\d+)$/)) && Number(m[1]) > ranks.length) errsLocal.push(`rank:${m[1]} 超出 ranks 数量 ${ranks.length}`);
  if ((m = f.match(/^rep:(\w+)[+-]/)) && !labelRep[m[1]]) errsLocal.push(`声望 ${m[1]} 没有名字（labels.rep）`);
  if ((m = f.match(/^rel:(\w+)[+-]/)) && !(script.npcs && script.npcs[m[1]])) errsLocal.push(`好感对象 ${m[1]} 没有登记（npcs）`);
}
const kinds = {};
for (const e of Object.values(events)) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
console.log(`== ${sid} ==`);
console.log('事件分类：', JSON.stringify(kinds));
console.log(`事件 ${Object.keys(events).length} 个，行动 ${Object.keys(actions).length} 个，任务 ${Object.keys(quests).length} 个，地下城 ${Object.keys(dungeons).length} 个`);
}

for (const sid of Object.keys(content.scripts)) lintScript(sid);
if (errs.length) { console.error('发现问题：\n' + errs.map(e => ' - ' + e).join('\n')); process.exit(1); }
console.log('内容检查通过');
