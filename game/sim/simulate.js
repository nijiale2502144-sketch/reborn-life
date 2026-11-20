// 无界面模拟器： node sim/simulate.js --bot balanced --runs 2000 [--seed 1] [--progress]
import { loadNodeContent } from './load.js';
import { makeGame } from '../src/engine.js';
import { makeBot } from './bots.js';
import { newMeta, shop, buy, runOpts, settle } from '../src/meta.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const runs = Number(args.runs || 1000);
const botKind = args.bot || 'balanced';
const fate = Number(args.fate || 0);
const relic = args.relic || null;
const memArg = args.memories || '';   // all | id1,id2
const seed0 = Number(args.seed || 1);
const content = await loadNodeContent();
const memories = memArg === 'all' ? (content.meta.shards || []).map(x => x.id) : memArg ? memArg.split(',') : [];
const sid = args.script || 'farmer_son';
const g = makeGame(content, sid);
const mainId = g.script.quests.find(q => q.type === 'main').id;

function mulberry(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function playOne(seed, opts = {}) {
  const rnd = mulberry(seed * 7919 + 13);
  const bot = makeBot(botKind, g, rnd, args.ending || null);
  const s = g.newRun(Object.assign({ seed, aspiration: opts.aspiration || g.script.aspirations[0].id, intro: false, fate, relic, memories, talents: args.talent ? String(args.talent).split(',') : [], up: args.up ? Object.fromEntries(String(args.up).split(',').map(x => x.split(':').map((v, i) => i ? Number(v) : v))) : undefined }, opts));
  let steps = 0;
  while (!s.ended) {
    g.choose(s, bot(s));
    if (++steps > 20000) throw new Error('死循环 seed=' + seed + ' prompt=' + JSON.stringify(s.prompt).slice(0, 300));
  }
  return s;
}

const seenAll = {};
const skillUse = {}, skillKnown = {};
const attrSum = [], golds = [], powers = [];
const endings = {}, rps = [], levels = [], turns = [], mainStage = {}, qdone = {}, qfail = {};
let deaths = 0, wins = 0;
const meta = newMeta();
const curve = [];
for (let i = 0; i < runs; i++) {
  const s = playOne(seed0 + i, args.progress ? runOpts(meta) : {});
  const e = s.ended;
  endings[e.name] = (endings[e.name] || 0) + 1;
  attrSum.push(Object.values(s.attrs).reduce((a, b) => a + b, 0)); golds.push(s.gold); powers.push(g.powerOf(s));
  for (const [k, v] of Object.entries(s.stats.skills)) skillUse[k] = (skillUse[k] || 0) + v;
  for (const k of Object.keys(s.flags)) if (k.startsWith('sk_')) skillKnown[k.slice(3)] = (skillKnown[k.slice(3)] || 0) + 1;
  for (const id of Object.keys(s.seen)) seenAll[id] = (seenAll[id] || 0) + s.seen[id];
  rps.push(e.score.rp); levels.push(s.level); turns.push(s.turn);
  if (s.flags.dead) deaths++;
  if (e.cleared) wins++;
  const mq = s.quests[mainId];
  const ms = mq ? (mq.state === 'failed' ? 'failed@' : '') + mq.stage : 'none';
  mainStage[ms] = (mainStage[ms] || 0) + 1;
  for (const [id, q] of Object.entries(s.quests)) {
    if (q.state === 'done') qdone[id] = (qdone[id] || 0) + 1;
    if (q.state === 'failed') qfail[id] = (qfail[id] || 0) + 1;
  }
  if (args.progress) {
    settle(meta, s);
    // 贪心买最便宜的
    for (;;) {
      const cheap = shop(content, meta).filter(x => x.cost !== null && x.cost <= meta.rp && !x.id.startsWith('talent:')).sort((a, b) => a.cost - b.cost)[0];
      if (!cheap) break;
      buy(content, meta, cheap.id);
    }
    if ((i + 1) % 5 === 0) curve.push(`第${i + 1}局 RP累计≈${Math.round(rps.reduce((a, b) => a + b, 0))} 通关率(最近5局)`);
  }
}
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor((a.length - 1) * p)]; };
const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`机器人 ${botKind}，${runs} 局${fate ? `，命运阶位 ${fate}` : ''}${relic ? `，遗物 ${relic}` : ''}${memories.length ? `，记忆碎片 ${memories.length} 枚` : ''}`);
console.log(`通关${(wins / runs * 100).toFixed(1)}%，死亡 ${(deaths / runs * 100).toFixed(1)}%`);
console.log(`转生点 平均 ${avg(rps)}  P10 ${q(rps, .1)}  中位 ${q(rps, .5)}  P90 ${q(rps, .9)}  最高 ${Math.max(...rps)}`);
console.log(`等级 平均 ${avg(levels)}，回合数 平均 ${avg(turns)}`);
console.log(`终局 六维总和 ${avg(attrSum)}，战力 ${avg(powers)}，金币 ${avg(golds)}`);
console.log('结局分布：', Object.entries(endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / runs * 100).toFixed(1)}%`).join('，'));
console.log('主线停在第几章（0 起）：', JSON.stringify(mainStage));
console.log('任务完成：', JSON.stringify(qdone));
console.log('任务失败：', JSON.stringify(qfail));
if (args.progress) console.log(`局外：累计转生点已花光后升级 ${JSON.stringify(meta.up)}，剩余 ${meta.rp}`);

console.log('技能习得率：', Object.entries(skillKnown).map(([k, v]) => `${k} ${(v / runs * 100).toFixed(0)}%`).join('，'));
console.log('技能每局使用：', Object.entries(skillUse).map(([k, v]) => `${k} ${(v / runs).toFixed(1)}`).join('，'));
const allIds = Object.keys(g.E);
const never = allIds.filter(id => !seenAll[id]);
console.log(`事件覆盖：${allIds.length - never.length}/${allIds.length} 个至少出现过一次`);
if (never.length) console.log('从未出现：', never.join(', '));
const per = rps.length ? Object.values(seenAll).reduce((a, b) => a + b, 0) / runs : 0;
console.log(`平均每局触发事件 ${per.toFixed(1)} 次，涉及不同事件 ${(allIds.length - never.length)} 个`);
