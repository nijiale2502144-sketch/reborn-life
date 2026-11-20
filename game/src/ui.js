// 界面：纯 DOM，没有框架。所有规则都在 engine.js，这里只负责画 s.prompt。
import { loadContent } from './content.js';
import { makeGame, ATTRS, SEASON_CN } from './engine.js';
import { newMeta, shop, buy, toggleTalent, equipRelic, runOpts, settle } from './meta.js';

const app = document.getElementById('app');
const META_KEY = 'reborn_meta_v1', SAVE_KEY = 'reborn_save_v1';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式等 */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// ---- 悬停 / 点击说明（手机上点一下显示，再点或点别处关闭） ----
let tipEl = null, tipTarget = null;
function hideTip() { if (tipEl) tipEl.hidden = true; tipTarget = null; }
function showTip(el) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'tip'; document.body.append(tipEl); }
  tipEl.textContent = el.dataset.tip;
  tipEl.hidden = false;
  const r = el.getBoundingClientRect(), w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  const top = r.bottom + 6 + hgt > window.innerHeight ? Math.max(8, r.top - hgt - 6) : r.bottom + 6;
  tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
  tipTarget = el;
}
function withTip(el, text) {
  if (!text) return el;
  el.dataset.tip = text; el.classList.add('has-tip'); el.setAttribute('tabindex', '0');
  el.addEventListener('mouseenter', () => showTip(el));
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('click', ev => { ev.stopPropagation(); if (tipTarget === el) hideTip(); else showTip(el); });
  return el;
}
document.addEventListener('click', hideTip);
window.addEventListener('scroll', hideTip, { passive: true });

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
// 单文件版（dist/）会把图片和内容内嵌进 window.__ASSETS / window.__FILES
const asset = p => (typeof window !== 'undefined' && window.__ASSETS && window.__ASSETS[p]) || p;
const img = (src, cls, alt = '') => h('img', { src: asset(src), class: 'px ' + cls, alt });

let content, g, script, meta, s;
const games = {};
const useScript = id => { g = games[id] || games.farmer_son; script = g.script; };
let screen = 'title';
let tab = 'daily';
let setupChoice = { script: 'farmer_son', aspiration: null };
const ATTR = () => g.labels.attr;
const routeName = r => g.labels.route[r];

// ------------------------------------------------------------------ 启动
async function boot() {
  content = await loadContent(p => window.__FILES ? Promise.resolve(window.__FILES[p]) : fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); }));
  for (const id of Object.keys(content.scripts)) games[id] = makeGame(content, id);
  useScript('farmer_son');
  meta = mergeMeta(store.get(META_KEY));
  setupChoice.aspiration = script.aspirations[0].id;
  showTitle();
}
function mergeMeta(saved) {
  saved = saved || {};
  const base = newMeta();
  const m = Object.assign(base, saved, { up: Object.assign(base.up, saved.up || {}) });
  if (!Array.isArray(m.shards)) m.shards = [];
  if (!m.endingsBy) m.endingsBy = {};
  // 旧存档只按结局 id 记录次数：能唯一对应某个剧本的，补记到那个剧本；多个剧本共用的 id（天不假年、平淡一生），补记到已解锁的剧本
  if (!Object.keys(m.endingsBy).length && Object.keys(m.endings || {}).length) {
    for (const [id, n] of Object.entries(m.endings)) {
      const owners = Object.values(content.scripts).filter(sc => sc.endings.some(e => e.id === id));
      const ok = owners.length === 1 ? owners : owners.filter(sc => m.unlocked.includes(sc.id));
      for (const sc of ok) m.endingsBy[`${sc.id}:${id}`] = { n, first: 0, best: 0 };
    }
  }
  if (!Array.isArray(m.unlocked) || !m.unlocked.includes('farmer_son')) m.unlocked = ['farmer_son', ...(m.unlocked || [])];
  return m;
}
const saveMeta = () => store.set(META_KEY, meta);

// ------------------------------------------------------------------ 标题 / 设置
function showTitle() {
  screen = 'title';
  const save = store.get(SAVE_KEY);
  app.replaceChildren(h('div', { class: 'center' },
    h('h1', {}, '轮回人生录'),
    h('p', { class: 'sub' }, '一个人的一生，用有限的体力去换。 · 原型 v0.3'),
    h('div', { class: 'card' },
      h('div', { class: 'row' }, h('span', {}, '转生点'), h('b', { class: 'big' }, meta.rp), h('span', { class: 'dim' }, `已经历 ${meta.runs} 世 · 通关 ${meta.wins} 次 · 最高 ${meta.best}`))),
    h('div', { class: 'stack' },
      save && !save.ended ? h('button', { class: 'btn primary', onclick: () => { useScript(save.script || 'farmer_son'); s = g.migrate(save); screen = 'game'; render(); } }, `继续上次的人生（《${(content.scripts[save.script || 'farmer_son'] || {}).name}》${save.age} 岁 · ${SEASON_CN[save.season]}）`) : null,
      h('button', { class: 'btn primary', onclick: showSetup }, '开始新的人生'),
      h('button', { class: 'btn', onclick: showMeta }, '转生树（局外养成）'),
      h('button', { class: 'btn', onclick: showMuseum }, '结局博物馆'),
      h('button', { class: 'btn', onclick: showSaveDialog }, '存档管理（导出 / 导入）'),
      h('button', { class: 'btn', onclick: ev => { const b = ev.currentTarget; if (b.dataset.armed) { store.del(META_KEY); store.del(SAVE_KEY); location.reload(); } else { b.dataset.armed = '1'; b.textContent = '再点一次，确认清空所有存档和转生点'; } } }, '清空存档'))));
}

function showSetup() {
  screen = 'setup';
  useScript(setupChoice.script);
  if (!script.aspirations.some(a => a.id === setupChoice.aspiration)) setupChoice.aspiration = script.aspirations[0].id;
  const owned = meta.talents.map(id => content.meta.talents.find(t => t.id === id));
  const scripts = Object.values(content.scripts);
  app.replaceChildren(h('div', { class: 'center' },
    h('h2', {}, '选择人生剧本'),
    h('div', { class: 'stack', style: 'margin-bottom:14px' }, scripts.map(sc => {
      const open = meta.unlocked.includes(sc.id);
      return h('label', { class: 'radio' + (open ? '' : ' locked') },
        h('input', { type: 'radio', name: 'scr', disabled: !open, checked: setupChoice.script === sc.id, onchange: () => { setupChoice.script = sc.id; showSetup(); } }),
        h('span', {}, h('b', {}, `《${sc.name}》`), h('span', { class: 'tag' }, sc.subtitle), open ? null : h('span', { class: 'tag bad' }, `未解锁，转生树里 ${sc.unlockCost} 点`), h('br'), h('span', { class: 'dim' }, sc.desc)));
    })),
    h('div', { class: 'card' }, h('h2', {}, '人生志向'), h('div', { class: 'stack' },
      script.aspirations.map(a => h('label', { class: 'radio' },
        h('input', { type: 'radio', name: 'asp', checked: setupChoice.aspiration === a.id, onchange: () => { setupChoice.aspiration = a.id; } }),
        h('span', {}, h('b', {}, a.name), h('br'), h('span', { class: 'dim' }, `${a.desc}（达成 +${a.score} 分）`)))))),
    h('div', { class: 'card' }, h('h2', {}, `天赋（${meta.equipped.length}/${meta.up.slots} 槽）`),
      owned.length ? h('div', { class: 'stack' }, owned.map(t => h('label', { class: 'radio' },
        h('input', { type: 'checkbox', checked: meta.equipped.includes(t.id), onchange: () => { toggleTalent(meta, t.id); saveMeta(); showSetup(); } }),
        h('span', {}, h('b', {}, t.name), h('br'), h('span', { class: 'dim' }, t.price ? `${t.desc}；代价：${t.price}` : t.desc)))))
        : h('p', { class: 'dim' }, '还没有天赋。结算后到转生树购买。')),
    relicCard(),
    shardCard(setupChoice.script),
    fateCard(),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: startRun }, '踏入这一世'),
      h('button', { class: 'btn', onclick: showTitle }, '返回'))));
}

function relicCard() {
  const list = (content.meta.relics || []).filter(r => !r.script || r.script.includes(setupChoice.script));
  return h('div', { class: 'card' }, withTip(h('h2', {}, '传承（遗物）'), g.help.relic),
    h('p', { class: 'dim' }, '遗物由成就解锁，每一世只能带一件。'),
    h('div', { class: 'stack' },
      h('label', { class: 'radio' },
        h('input', { type: 'radio', name: 'relic', checked: !meta.relicEquipped || !meta.relics.includes(meta.relicEquipped), onchange: () => { meta.relicEquipped = null; saveMeta(); } }),
        h('span', {}, h('b', {}, '不携带'))),
      list.map(r => {
        const own = meta.relics.includes(r.id);
        return h('label', { class: 'radio' + (own ? '' : ' locked') },
          h('input', { type: 'radio', name: 'relic', disabled: !own, checked: own && meta.relicEquipped === r.id, onchange: () => { meta.relicEquipped = r.id; saveMeta(); } }),
          h('span', {}, h('b', {}, own ? r.name : '？？？'), own ? null : h('span', { class: 'tag' }, '未解锁'), h('br'),
            h('span', { class: 'dim' }, own ? r.desc : `解锁条件：${r.unlock.text}`)));
      })));
}

function shardCard(scriptId, withName) {
  const list = (content.meta.shards || []).filter(r => !r.script || r.script.includes(scriptId) || (r.shared && (meta.shards || []).includes(r.id)));
  if (!list.length) return null;
  const own = list.filter(r => (meta.shards || []).includes(r.id));
  return h('div', { class: 'card' }, withTip(h('h2', {}, `前世记忆${withName ? '·' + content.scripts[scriptId].name : ''}（${own.length}/${list.length}）`), g.help.memory),
    h('p', { class: 'dim' }, '失败的支线、发现的真相，都会在这一世结束时留下记忆碎片。带着它们转生，会出现新的选项、提示，甚至是隐藏的剧情。碎片永久保留，自动生效。'),
    h('div', { class: 'stack' }, list.map(r => {
      const has = own.includes(r);
      return h('div', { class: 'radio' + (has ? '' : ' locked') },
        h('span', {}, h('b', {}, has ? r.name : '？？？'), h('span', { class: 'tag ' + (has ? 'good' : '') }, has ? '已获得' : '未获得'), h('br'),
          h('span', { class: 'dim' }, has ? `${r.text}\n前世记忆：${r.use}` : `线索：${r.unlock.text}`)));
    })));
}

function fateCard() {
  const rules = script.fateRules || content.config.fateRules;
  if (!meta.fateMax) return h('div', { class: 'card locked-card' }, withTip(h('h2', {}, '命运阶位'), g.help.fate), h('p', { class: 'dim' }, '通关任意一个剧本后解锁。每提高一阶，规则更严苛，转生点收益 +20%。'));
  if ((meta.fateSelected || 0) > meta.fateMax) meta.fateSelected = meta.fateMax;
  return h('div', { class: 'card' }, withTip(h('h2', {}, '命运阶位'), g.help.fate),
    h('p', { class: 'dim' }, '在当前最高阶位通关，会解锁下一阶。选中的阶位会叠加之前所有阶位的规则。'),
    h('div', { class: 'stack' }, Array.from({ length: meta.fateMax + 1 }, (_, n) =>
      h('label', { class: 'radio' },
        h('input', { type: 'radio', name: 'fate', checked: (meta.fateSelected || 0) === n, onchange: () => { meta.fateSelected = n; saveMeta(); } }),
        h('span', {}, h('b', {}, n === 0 ? '阶位 0（标准）' : `阶位 ${n}`), n ? h('span', { class: 'tag good' }, `转生点 +${n * 20}%`) : null, h('br'),
          h('span', { class: 'dim' }, n === 0 ? '没有额外规则。' : `新增：${rules[n - 1]}`))))));
}

function startRun() {
  useScript(setupChoice.script);
  s = g.newRun(runOpts(meta, { aspiration: setupChoice.aspiration, seed: (Date.now() % 2147483647), intro: true }));
  meta.introSeen = Object.assign({}, meta.introSeen, { [setupChoice.script]: true });
  saveMeta();
  screen = 'game'; tab = 'daily';
  store.set(SAVE_KEY, s);
  render();
}

// ------------------------------------------------------------------ 转生树
function showMeta(note) {
  screen = 'meta';
  const items = shop(content, meta);
  const groups = [...new Set(items.map(i => i.group))];
  app.replaceChildren(h('div', { class: 'center' },
    h('h2', {}, '转生树'),
    h('div', { class: 'row' }, h('span', {}, '可用转生点'), h('b', { class: 'big' }, meta.rp), typeof note === 'string' ? h('span', { class: 'tag info' }, note) : null),
    groups.map(gr => h('div', { class: 'card' }, h('h2', {}, gr), h('div', { class: 'shop' },
      items.filter(i => i.group === gr).map(i => [
        h('div', {}, h('div', { class: 'nm' }, i.name, ' ', i.max > 1 ? h('span', { class: 'tag' }, `${i.level}/${i.max}`) : null), h('div', { class: 'ds' }, i.desc)),
        i.cost === null ? h('span', { class: 'tag good' }, i.max === 1 ? '已拥有' : '已满') :
          h('button', { class: 'btn', disabled: meta.rp < i.cost, onclick: () => { const r = buy(content, meta, i.id); saveMeta(); showMeta(r.msg); } }, `${i.cost} 点`),
      ])))),
    Object.values(content.scripts).filter(sc => meta.unlocked.includes(sc.id)).map(sc => shardCard(sc.id, true)),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: showSetup }, '再来一世'), h('button', { class: 'btn', onclick: showTitle }, '返回'))));
}

// ------------------------------------------------------------------ 结局博物馆
const KIND_CN = { true: '真结局', normal: '普通结局', fail: '失败结局', hidden: '隐藏结局' };
const KIND_CLS = { true: 'good', normal: 'info', fail: 'bad', hidden: 'good' };
function showMuseum() {
  screen = 'museum';
  // 标了 safety 的是保底结局（正常游玩到不了），不在博物馆展示，也不计入收集进度
  const scripts = Object.values(content.scripts).map(sc => Object.assign({}, sc, { endings: sc.endings.filter(e => !e.safety) }));
  const by = meta.endingsBy || {};
  const total = scripts.reduce((a, sc) => a + sc.endings.length, 0);
  const got = scripts.reduce((a, sc) => a + sc.endings.filter(e => by[`${sc.id}:${e.id}`]).length, 0);
  app.replaceChildren(h('div', { class: 'center' },
    h('h2', {}, '结局博物馆'),
    h('p', { class: 'dim' }, '每个剧本都有多个结局。没见过的结局只留下一行线索。首次达成一个结局，会额外获得一笔转生点（失败 15、普通 30、真结局 60、隐藏 80）。'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', {}, '已收集'), h('b', { class: 'big' }, `${got} / ${total}`)),
      h('div', { class: 'bar exp' }, h('i', { style: `width:${got / total * 100}%` }))),
    scripts.map(sc => {
      const open = meta.unlocked.includes(sc.id);
      const n = sc.endings.filter(e => by[`${sc.id}:${e.id}`]).length;
      return h('div', { class: 'card' },
        h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, `《${sc.name}》`), h('span', { class: 'tag' }, `${n} / ${sc.endings.length}`), open ? null : h('span', { class: 'tag bad' }, '剧本未解锁')),
        open ? h('div', { class: 'stack', style: 'margin-top:8px' }, sc.endings.map(e => {
          const rec = by[`${sc.id}:${e.id}`];
          if (!rec) return h('div', { class: 'radio locked' }, h('span', {}, h('b', {}, '？？？'), h('span', { class: 'tag' }, KIND_CN[e.kind] === '隐藏结局' ? '隐藏' : '未达成'), h('br'), h('span', { class: 'dim' }, `线索：${e.hint || '尚无线索'}`)));
          return h('div', { class: 'radio' }, h('span', {},
            h('b', {}, e.name), h('span', { class: 'tag ' + (KIND_CLS[e.kind] || '') }, KIND_CN[e.kind] || e.kind),
            h('span', { class: 'dim' }, `  达成 ${rec.n} 次${rec.best ? ` · 最高 ${rec.best} 点` : ''}`), h('br'),
            h('details', {}, h('summary', { class: 'dim' }, e.text.split('\n')[0].slice(0, 36) + '…（展开）'), h('p', { class: 'narr' }, e.text))));
        })) : h('p', { class: 'dim' }, `共 ${sc.endings.length} 个结局。在转生树里解锁这个剧本后可以查看线索。`));
    }),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: showTitle }, '返回'))));
}

// ------------------------------------------------------------------ 结算
function showEnd() {
  const e = s.ended;
  if (!s.settled) { settle(meta, s, content); s.settled = true; saveMeta(); }
  const info = s.settleInfo || {};
  store.del(SAVE_KEY);
  app.replaceChildren(h('div', { class: 'center' },
    h('div', { class: 'scene' }, img(`../scenes/scene_${g.view(s).scene}.png`, '')),
    h('h1', {}, e.name),
    h('p', { class: 'narr' }, e.text),
    h('div', { class: 'card' },
      h('h2', {}, '人生结算'),
      h('p', { class: 'dim' }, `${e.age} 岁 · 共 ${e.turn} 回合 · 等级 ${s.level}`),
      h('table', { class: 'sc' }, e.score.items.map(i => h('tr', {}, h('td', {}, i.label), h('td', {}, '+' + i.value))),
        h('tr', {}, h('td', {}, '小计'), h('td', {}, e.score.subtotal)),
        h('tr', {}, h('td', {}, '结局系数 × 其他系数'), h('td', {}, '× ' + e.score.mult.toFixed(2)))),
      s.fate ? h('p', { class: 'dim' }, `命运阶位 ${s.fate}：转生点 +${s.fate * 20}%（已计入系数）`) : null,
      h('p', {}, '获得转生点：', h('b', { class: 'big' }, e.score.rp))),
    (info.gainedRelics || []).length ? h('div', { class: 'card tone-story' }, h('h2', {}, '获得遗物'),
      info.gainedRelics.map(id => { const r = content.meta.relics.find(x => x.id === id); return h('p', {}, h('b', {}, r.name), '：', r.desc); }),
      h('p', { class: 'dim' }, '下一世开局时可以携带它。')) : null,
    (info.gainedShards || []).length ? h('div', { class: 'card tone-story' }, h('h2', {}, '获得记忆碎片'),
      info.gainedShards.map(id => { const r = content.meta.shards.find(x => x.id === id); return h('p', {}, h('b', {}, r.name), '：', r.text, h('br'), h('span', { class: 'dim' }, `前世记忆：${r.use}`)); }),
      h('p', { class: 'dim' }, '碎片永久保留，下一世自动生效。')) : null,
    info.newEnding ? h('div', { class: 'card tone-story' }, h('h2', {}, '新结局解锁'), h('p', {}, h('b', {}, e.name), info.newEnding.bonus ? `：首次达成，额外获得 ${info.newEnding.bonus} 转生点。` : '：首次达成。'), h('button', { class: 'btn', onclick: showMuseum }, '前往结局博物馆')) : null,
    info.fateUp ? h('div', { class: 'card tone-story' }, h('h2', {}, `命运阶位 ${info.fateMax} 已解锁`), h('p', {}, (script.fateRules || content.config.fateRules)[info.fateMax - 1])) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: showMeta }, '前往转生树'),
      h('button', { class: 'btn', onclick: showMuseum }, '结局博物馆'),
      h('button', { class: 'btn', onclick: showSetup }, '再来一世'),
      h('button', { class: 'btn', onclick: showTitle }, '标题'))));
}

// ------------------------------------------------------------------ 游戏主界面
function step(idx) {
  g.choose(s, idx);
  if (s.ended) { screen = 'end'; showEnd(); return; }
  store.set(SAVE_KEY, s);
  render();
  window.scrollTo({ top: 0 });
}

function lineClass(t) {
  if (/升级|习得|\+\d|完成|获得|提升|成功/.test(t) && !/-\d|失败/.test(t)) return 'good';
  if (/-\d|失败|倒下|落败/.test(t)) return 'bad';
  if (/任务|进展/.test(t)) return 'hl';
  return '';
}
const linesEl = lines => lines && lines.length ? h('ul', { class: 'lines' }, lines.map(t => h('li', { class: lineClass(t) }, t))) : null;
const optBtn = (n, nm, ds, cost, disabled, onclick, extra) => h('button', { class: 'opt ' + (extra || ''), disabled, onclick },
  h('span', { class: 'k' }, n), h('span', {}, h('span', { class: 'nm' }, nm), ds ? h('div', { class: 'ds' }, ds) : null), cost ? h('span', { class: 'cost' }, cost) : null);

function topbar(v) {
  const H = g.help;
  const pips = [];
  const max = v.staminaMax;
  for (let i = 0; i < Math.max(max, s.stamina); i++) pips.push(h('span', { class: i < s.stamina ? '' : 'off' }, i < s.stamina ? '●' : '○'));
  if (s.stamina < 0) pips.push(h('span', { class: 'neg' }, `透支 ${-s.stamina}`));
  const stTip = `${H.stamina}\n\n当前上限 ${max}：\n` + v.staminaParts.map(p => `· ${p.label}：${p.val >= 0 ? '+' : ''}${p.val}`).join('\n');
  return h('div', { class: 'topbar' }, h('div', { class: 'in' },
    h('b', {}, `${s.age} 岁 · ${SEASON_CN[s.season]}`),
    h('span', { class: 'dim' }, `第 ${s.turn + 1} / ${s.maxTurns} 回合`),
    withTip(h('span', { class: 'pips' }, '体力 ', pips), stTip),
    withTip(h('span', {}, `金币 ${s.gold}`), H.gold),
    withTip(h('span', {}, `魔力 ${s.mp}/${v.mpMax}`, h('div', { class: 'bar mp' }, h('i', { style: `width:${Math.max(0, s.mp / v.mpMax * 100)}%` }))), `${H.mp}\n\n当前 ${s.mp}/${v.mpMax}`),
    withTip(h('span', {}, `生命 ${s.hp}/${v.hpMax}`, h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(0, s.hp / v.hpMax * 100)}%` }))), `${H.hp}\n\n当前 ${s.hp}/${v.hpMax}`),
    withTip(h('span', {}, `${g.labels.hometown} ${s.hometown}`), H.hometown),
    v.display.filter(d => d.top).map(d => withTip(h('span', {}, `${d.label} ${d.value}`), d.help)),
    h('button', { class: 'btn', onclick: showLog }, '日志'),
    h('button', { class: 'btn', onclick: showSaveDialog }, '存档')));
}

function showLog() {
  const body = document.getElementById('logbody');
  body.replaceChildren(...s.log.slice(-60).reverse().map(l => h('p', {}, h('span', { class: 'dim' }, `[${l.turn + 1}] `), l.text)));
  document.getElementById('logdlg').showModal();
}

function statsPanel(v) {
  const L = ATTR();
  const H = g.help;
  const SD = g.labels.statusDesc;
  const known = v.skills.filter(k => k.known), locked = v.skills.filter(k => !k.known);
  return h('aside', { class: 'aside' },
    h('div', { class: 'card' },
      h('div', { class: 'kv' }, h('b', {}, `Lv.${s.level}`), withTip(h('span', { class: 'tag info' }, v.rankName), H.rank)),
      v.fate || v.relic || v.memories.length ? h('div', { class: 'row', style: 'margin:6px 0' },
        v.memories.length ? withTip(h('span', { class: 'tag info' }, `前世记忆 ${v.memories.length}`), `${g.help.memory}\n\n` + v.memories.map(m => `· ${m.name}：${m.use}`).join('\n')) : null,
        v.fate ? withTip(h('span', { class: 'tag bad' }, `命运阶位 ${v.fate}`), `${g.help.fate}\n\n当前生效：\n` + (script.fateRules || content.config.fateRules).slice(0, v.fate).map((t, i) => `阶位 ${i + 1}：${t}`).join('\n')) : null,
        v.relic ? withTip(h('span', { class: 'tag good' }, `遗物：${v.relic.name}`), `${v.relic.name}\n${v.relic.desc}`) : null) : null,
      h('div', { class: 'bar exp' }, h('i', { style: `width:${s.exp / v.expNeed * 100}%` })),
      withTip(h('div', { class: 'kv dim' }, h('span', {}, '经验'), h('span', { class: 'v' }, `${s.exp}/${v.expNeed}`)), H.exp),
      withTip(h('div', { class: 'kv' }, h('span', {}, '战力'), h('span', { class: 'v' }, v.power)), `${H.power}\n\n当前 ${v.power}：\n` + v.powerParts.map(p => `· ${p.label}：+${p.val}`).join('\n')),
      h('div', { class: 'sec' }, '技能'),
      known.length ? known.map(k => withTip(h('div', { class: 'sk' }, h('span', { class: 'tag ' + k.route }, routeName(k.route)), ' ', k.name), `${k.name}（${routeName(k.route)}）\n${k.desc}\n${k.hint}`)) : h('div', { class: 'dim', style: 'font-size:13px' }, '还没有学会技能'),
      locked.length ? h('details', { class: 'sk-locked' }, h('summary', {}, `未习得 ${locked.length} 个`),
        locked.map(k => h('div', { class: 'sk-need' },
          h('div', {}, h('span', { class: 'tag ' + k.route }, routeName(k.route)), ' ', k.name),
          k.checks && k.checks.length ? h('ul', { class: 'checks' }, k.checks.map(c => h('li', { class: c.ok ? 'ok' : '' }, (c.ok ? '✓ ' : '○ ') + c.label + (c.cur !== null && c.cur !== undefined && !c.ok ? `（当前 ${c.cur}）` : ''))))
            : h('div', { class: 'dim', style: 'font-size:12px' }, k.learn)))) : null,
      h('div', { class: 'sec' }, '六维'),
      ATTRS.map(a => withTip(h('div', {}, h('div', { class: 'kv' }, h('span', {}, L[a]), h('span', { class: 'v' }, s.attrs[a])),
        h('div', { class: 'bar exp' }, h('i', { style: `width:${s.attrExp[a] / v.attrNeed[a] * 100}%` }))),
        `${H.attr[a]}\n\n当前 ${s.attrs[a]}，再积累 ${Math.max(0, Math.ceil(v.attrNeed[a] - s.attrExp[a]))} 点经验升到 ${s.attrs[a] + 1}。`)),
      v.display.length ? [h('div', { class: 'sec' }, '关键进度'), v.display.map(d => withTip(h('div', { class: 'kv' }, h('span', {}, d.label), h('span', { class: 'v' }, d.value)), d.help))] : null,
      h('div', { class: 'sec' }, '声望与关系'),
      Object.entries(s.rep).filter(([, x]) => x > 0).map(([k, x]) => withTip(h('div', { class: 'kv' }, h('span', {}, g.labels.rep[k]), h('span', { class: 'v' }, x)), `${H.rep}\n\n当前 ${x}/100`)),
      Object.entries(s.rel).filter(([, x]) => x > 0).map(([k, x]) => withTip(h('div', { class: 'kv' }, h('span', {}, `${script.npcs[k].name}好感`), h('span', { class: 'v' }, `${x}/10`)), H.rel)),
      s.status.length ? [h('div', { class: 'sec' }, '状态'), h('div', { class: 'row' }, s.status.map(st => withTip(h('span', { class: 'tag' }, `${g.labels.status[st.id] || st.id} ${st.turns}`), `${SD[st.id] || ''}\n还剩 ${st.turns} 回合。`)))] : null,
      h('div', { class: 'sec' }, '装备'),
      v.gear.length ? h('div', { class: 'row' }, v.gear.map(it => withTip(h('span', { class: 'tag' + (it.active ? '' : ' off') }, `${it.slot}·${it.name}`), `${it.name}（${it.slot}）\n${it.desc}\n战力 +${it.power}${it.active ? '' : '\n（同一栏位有更强的装备，这件暂不计入战力）'}`))) : h('div', { class: 'dim', style: 'font-size:13px' }, '无')),
    h('div', { class: 'card' }, h('div', { class: 'sec', style: 'margin-top:0' }, '任务'),
      g.view(s).quests.map(q => h('div', { class: `q ${q.type === 'main' ? 'main' : ''} ${q.state}` },
        h('b', {}, q.name), ' ', h('span', { class: 'tag' }, q.state === 'active' ? `${q.stage + 1}/${q.stages}` : q.state === 'done' ? '完成' : '失败'),
        q.deadline ? h('span', { class: 'tag bad' }, q.deadline) : null,
        h('div', { class: 'dim' }, q.desc),
        q.checks.length ? h('ul', { class: 'checks' }, q.checks.map(c => h('li', { class: c.ok ? 'ok' : '' }, (c.ok ? '✓ ' : '○ ') + c.label))) : null)),
      s.aspiration ? h('div', { class: 'q' }, h('b', {}, '志向：'), script.aspirations.find(a => a.id === s.aspiration).name) : null));
}

function mainPanel(v) {
  const p = s.prompt;
  switch (p.kind) {
    case 'actions': return actionsPanel(p);
    case 'event': return h('div', { class: 'card panel' },
      h('div', { class: 'evt' }, p.portrait ? img(`../portraits/portrait_${p.portrait}_normal.png`, 'pt') : null,
        h('div', {}, h('h2', {}, p.title), h('div', { class: 'narr' }, p.text), linesEl(p.notes))),
      h('div', { class: 'stack', style: 'margin-top:12px' }, p.options.map((o, k) =>
        optBtn(k + 1, o.label, o.disabled ? o.reason : (o.hint || ''), o.cost ? `${o.cost} 体力` : '', o.disabled, () => step(k)))));
    case 'result': return h('div', { class: 'card panel tone-' + (p.tone || 'plain') },
      h('div', { class: 'evt' }, p.portrait ? img(`../portraits/portrait_${p.portrait}_normal.png`, 'pt') : null,
        h('div', {}, p.tone === 'tip' ? h('span', { class: 'tag info' }, '小提示') : null, h('h2', {}, p.title), p.text ? h('div', { class: 'narr' }, p.text) : null, linesEl(p.lines))),
      h('div', { class: 'stack', style: 'margin-top:12px' }, optBtn('↵', '继续', '', '', false, () => step(0), 'continue')));
    case 'dungeon': return h('div', { class: 'card panel' },
      h('h2', {}, `${p.name} · 第 ${p.layer}/${p.layers} 层`),
      h('p', { class: 'dim' }, `本次已获得：金币 ${p.gold}，经验 ${p.exp}${p.mult < 1 ? `　（近期反复探索，收获 ×${p.mult.toFixed(2)}）` : ''}`),
      h('div', { class: 'stack' }, p.nodes.map((n, k) => optBtn(k + 1, n.label, n.hint, '', false, () => step(k))),
        optBtn(p.nodes.length + 1, '撤离', '带着已有的收获离开', '', false, () => step(p.nodes.length), 'end')));
    case 'combat': return h('div', { class: 'card panel' },
      h('h2', {}, `遭遇：${p.enemy}`, p.enemyTag ? h('span', { class: 'tag', style: 'margin-left:8px' }, p.enemyTag) : null),
      h('div', { class: 'vs' }, h('span', {}, `你的战力 ${p.myPower}`), h('span', { class: 'dim' }, 'vs'), h('span', {}, `敌方战力 ${p.enemyPower}`), h('span', { class: 'tag ' + (p.risk === '凶险' ? 'bad' : p.risk === '把握大' ? 'good' : '') }, p.risk)),
      h('div', { class: 'dim', style: 'margin-bottom:10px' }, `生命 ${p.hp}/${p.hpMax}　魔力 ${p.mp}/${p.mpMax}`),
      h('div', { class: 'stack' }, p.tactics.map((t, k) => optBtn(k + 1, t.label, t.disabled ? `${t.hint}（${t.reason}）` : t.hint, t.mp ? `${t.mp} 魔力` : '', !!t.disabled, () => step(k), t.route ? 'skill ' + t.route : ''))));
    case 'alloc': return h('div', { class: 'card panel' },
      h('h2', {}, `分配属性点（剩余 ${p.points}）`),
      h('div', { class: 'stack' }, p.options.map((o, k) => optBtn(k + 1, `${o.label}  ${o.value} → ${o.value + 1}`, '', '', false, () => step(k)))));
    default: return h('div', {}, '未知状态 ' + p.kind);
  }
}

function actionsPanel(p) {
  const labels = { daily: '日常', adventure: '冒险', social: '社交', quest: '任务' };
  const groups = Object.keys(labels).filter(k => p.items.some(i => i.group === k));
  if (!groups.includes(tab)) tab = groups[0];
  const shown = p.items.map((it, idx) => ({ it, idx })).filter(x => x.it.group === tab);
  const endIt = p.items.length - 1;
  return h('div', { class: 'card panel' },
    h('div', { class: 'tabs' }, groups.map(k => h('button', { class: 'tab' + (k === tab ? ' on' : ''), onclick: () => { tab = k; render(); } }, labels[k]))),
    h('div', { class: 'stack' }, shown.map(({ it, idx }, n) =>
      optBtn(n + 1, it.name, [it.desc, it.hint ? `→ ${it.hint}` : ''].filter(Boolean).join('  '), `${it.cost} 体力`, it.disabled, () => step(idx)))),
    h('div', { class: 'stack', style: 'margin-top:12px' }, optBtn('E', p.items[endIt].name, p.items[endIt].desc, '', false, () => step(endIt), 'end')));
}

function render() {
  hideTip();
  if (!s) return showTitle();
  if (s.ended) return showEnd();
  const v = g.view(s);
  const p = s.prompt;
  const narr = p.kind === 'actions' ? (s.log.length ? s.log[s.log.length - 1].text : '') : '';
  app.replaceChildren(topbar(v), h('div', { class: 'wrap' }, h('div', { class: 'layout' },
    h('div', {},
      h('div', { class: 'scene' }, img(`../scenes/scene_${v.scene}.png`, '', v.scene)),
      narr ? h('div', { class: 'card panel narr', style: 'font-size:15px' }, narr) : null,
      mainPanel(v)),
    statsPanel(v))));
}

document.addEventListener('keydown', ev => {
  if (screen !== 'game' || ev.metaKey || ev.ctrlKey || document.getElementById('logdlg').open) return;
  const btns = [...document.querySelectorAll('.panel button.opt:not(:disabled)')];
  if (ev.key === 'Enter' || ev.key === ' ') { const c = document.querySelector('.panel button.continue'); if (c) { ev.preventDefault(); c.click(); } return; }
  if (ev.key.toLowerCase() === 'e') { const e = btns.find(b => b.classList.contains('end')); if (e && e.textContent.includes('结束本回合')) e.click(); return; }
  const n = Number(ev.key);
  if (n >= 1 && n <= 9) { const b = btns.find(x => x.querySelector('.k').textContent === String(n)); if (b) b.click(); }
});

window.__reborn = { get s() { return s; }, get g() { return g; }, get meta() { return meta; } };
boot().catch(err => { app.replaceChildren(h('div', { class: 'center' }, h('h2', {}, '加载失败'), h('pre', {}, String(err && err.stack || err)))); });


// ------------------------------------------------------------------ 存档导出 / 导入
// 在线版（Artifact）里浏览器的“下载文件”经常被拦截，所以主要靠“复制存档代码 / 粘贴导入”。
const SAVE_FORMAT = 'reborn-save';
const toB64 = bytes => { let b = ''; for (const x of bytes) b += String.fromCharCode(x); return btoa(b); };
const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
async function pipeBytes(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
async function encodeSave(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== 'undefined') {
    try { return 'REBORN1Z:' + toB64(await pipeBytes(bytes, new CompressionStream('gzip'))); } catch { /* 退回未压缩 */ }
  }
  return 'REBORN1:' + toB64(bytes);
}
async function decodeSave(text) {
  text = text.trim().replace(/\s+/g, '');
  let bytes;
  if (text.startsWith('REBORN1Z:')) {
    if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持解压这种存档代码');
    bytes = await pipeBytes(fromB64(text.slice(9)), new DecompressionStream('gzip'));
  } else if (text.startsWith('REBORN1:')) bytes = fromB64(text.slice(8));
  else throw new Error('不是有效的存档代码（应以 REBORN1 开头）');
  return JSON.parse(new TextDecoder().decode(bytes));
}
function currentRun() {
  const run = s && !s.ended ? s : store.get(SAVE_KEY);
  if (!run || run.ended) return null;
  const slim = Object.assign({}, run, { log: (run.log || []).slice(-30), codex: [] });
  return slim;
}
function validateSave(o) {
  if (!o || o.format !== SAVE_FORMAT) throw new Error('这不是本游戏的存档');
  if (o.v !== 1) throw new Error('存档版本不兼容');
  const m = o.meta;
  if (!m || typeof m.rp !== 'number' || !m.up || !Array.isArray(m.talents) || !Array.isArray(m.codex)) throw new Error('存档里的转生数据不完整');
  if (o.run) {
    const r = o.run;
    if (!content.scripts[r.script] || typeof r.rng !== 'number' || !r.attrs || !r.flags || !r.quests || typeof r.age !== 'number') throw new Error('存档里的这一世数据不完整，或剧本已不存在');
  }
}
function showSaveDialog() {
  const dlg = document.getElementById('savedlg');
  const body = document.getElementById('savebody');
  const outArea = h('textarea', { id: 'save-out', class: 'savebox', readonly: true, rows: 4, placeholder: '点「生成存档代码」' });
  const inArea = h('textarea', { id: 'save-in', class: 'savebox', rows: 4, placeholder: '把存档代码粘贴到这里' });
  const msg = h('p', { class: 'dim', id: 'save-msg' });
  const say = (t, bad) => { msg.textContent = t; msg.className = bad ? 'bad-text' : 'dim'; };
  let code = '';
  const doExport = async () => {
    const run = currentRun();
    try { code = await encodeSave({ format: SAVE_FORMAT, v: 1, at: new Date().toISOString(), meta, run }); }
    catch (e) { say('生成存档失败：' + e.message, true); return; }
    outArea.value = code;
    say(`已生成（${(code.length / 1024).toFixed(1)} KB）。包含转生点与已解锁内容${run ? '，以及当前这一世的进度' : '（当前没有进行中的这一世）'}。`);
  };
  const copy = async () => {
    if (!code) await doExport();
    try { await navigator.clipboard.writeText(code); say('已复制到剪贴板。请把它存到备忘录或发给自己。'); }
    catch { outArea.select(); say('浏览器不允许自动复制，请手动全选并复制上面的内容。'); }
  };
  const download = async () => {
    if (!code) await doExport();
    if (!code) return;
    const filename = `轮回人生录-存档-${new Date().toISOString().slice(0, 10)}.txt`;
    // 在线版：通过平台的 downloads 能力保存（会先让你确认）；本地版：普通下载
    try {
      const d = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (d) {
        await d.save({ filename, data: code });
        say('已保存。导入时用「选择文件」，或者把文件内容粘贴到上面的输入框。');
        return;
      }
    } catch (e) {
      if (e && e.code === 'declined') { say('已取消保存。'); return; }
      say('这里无法保存文件，请改用「复制存档代码」。', true);
      return;
    }
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
      a.download = filename;
      document.body.append(a); a.click(); a.remove();
      say('已尝试下载。如果没有反应，请改用「复制存档代码」。');
    } catch { say('下载被拦截了，请改用「复制存档代码」。', true); }
  };
  const readFile = ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => { inArea.value = String(fr.result); say(`已读取文件「${f.name}」，确认无误后点「导入」。`); };
    fr.onerror = () => say('读取文件失败。', true);
    fr.readAsText(f);
  };
  const doImport = async ev => {
    const btn = ev.currentTarget;
    let o;
    try { o = await decodeSave(inArea.value); validateSave(o); } catch (e) { say('导入失败：' + e.message, true); return; }
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1'; btn.textContent = '再点一次，确认覆盖当前存档';
      say(`存档里有：转生点 ${o.meta.rp}，已经历 ${o.meta.runs || 0} 世${o.run ? `，进行中的一世《${content.scripts[o.run.script].name}》${o.run.age} 岁` : ''}。导入会覆盖现在的进度。`);
      return;
    }
    meta = mergeMeta(o.meta);
    saveMeta();
    if (o.run) { o.run.codex = meta.codex; store.set(SAVE_KEY, o.run); } else store.del(SAVE_KEY);
    s = null;
    dlg.close();
    showTitle();
  };
  body.replaceChildren(
    h('h2', {}, '存档管理'),
    h('div', { class: 'card' }, h('h2', {}, '导出'),
      h('p', { class: 'dim' }, '换设备、换浏览器前，先把存档代码复制出来保存好。'),
      outArea,
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('button', { class: 'btn primary', onclick: doExport }, '生成存档代码'),
        h('button', { class: 'btn', onclick: copy }, '复制存档代码'),
        h('button', { class: 'btn', onclick: download }, '下载为文件'))),
    h('div', { class: 'card' }, h('h2', {}, '导入'),
      h('p', { class: 'dim' }, '粘贴之前导出的存档代码，或选择导出的文件。导入会覆盖当前的转生点和进行中的一世。'),
      inArea,
      h('div', { class: 'row', style: 'margin-top:8px' },
        h('input', { type: 'file', id: 'save-file', accept: '.txt,.json,text/plain', onchange: readFile }),
        h('button', { class: 'btn primary', onclick: doImport }, '导入'))),
    msg);
  dlg.showModal();
}
