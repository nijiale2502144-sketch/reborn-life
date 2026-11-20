// 策略机器人：用同一套 choose() 接口玩完一整局，用来调数值。
import { ATTRS } from '../src/const.js';

export function makeBot(kind, g, rnd, pref) {   // pref: 'reseal' | 'throne'（追求隐藏结局的机器人）
  const scriptId = g.script.id;
  const R = rnd;
  const avail = (s, id) => s.prompt.items.findIndex(i => i.id === id && !i.disabled && i.cost <= s.stamina);
  const dungeonFor = s => {
    const order = ['dg_fortress', 'dg_grave', 'dg_mine', 'dg_cave'];
    const need = { dg_fortress: 18, dg_grave: 12, dg_mine: 8, dg_cave: 1 };
    for (const id of order) if (s.level >= need[id] && avail(s, id) >= 0) return id;
    return null;
  };

  function pickNoble(s, hpRatio, first, end) {
    let i;
    if ((i = first(['ask_support', 'challenge_valen', 'open_safe', 'investigate_theft', 'explore_cellar', 'watch_manor', 'read_forbidden'])) >= 0 && hpRatio > 0.5) return i;
    if (s.counters.debt > 0 && s.gold >= 350 && (i = first(['repay_debt'])) >= 0) return i;
    if (s.gold >= 260 && (i = first(['hire_hand', 'hire_hand_2', 'hire_hand_3', 'hire_hand_4'])) >= 0) return i;
    if ((i = first(['buy_medicine'])) >= 0) return i;
    if (kind !== 'farmer' && s.gold >= 300 && !s.flags.has_robe && (i = first(['go_market'])) >= 0) return i;
    if (hpRatio > 0.4 && (i = first(['metis_trial', 'decode_letters', 'investigate_archive', 'bribe_clerk'])) >= 0) return i;
    if ((i = first(['guild_register'])) >= 0) return i;
    if (s.rel.alfred < 5 && (i = first(['chat_alfred'])) >= 0) return i;
    if (s.flags.vera_alive && s.rel.vera < 7 && s.turn % 3 === 0 && (i = first(['visit_vera'])) >= 0) return i;
    if (hpRatio < 0.5 && (i = first(['rest'])) >= 0) return i;
    if (s.gold < 120 && (i = first(['tutoring', 'copywork'])) >= 0) return i;
    if (s.rep.tower < 60 && s.turn % 2 === 0 && (i = first(['tower_lecture'])) >= 0) return i;
    const dg = hpRatio >= 0.6 ? dungeonFor(s) : null;
    if (dg) return avail(s, dg);
    if ((i = first(s.turn % 3 === 0 ? ['banquet', 'study_arcana'] : ['study_arcana', 'tower_lecture'])) >= 0) return i;
    if ((i = first(['tutoring', 'copywork', 'salon', 'rest'])) >= 0) return i;
    return end;
  }

  function pickThief(s, hpRatio, first, end) {
    const heat = s.counters.heat || 0;
    let i;
    if ((i = first(['guild_trial', 'search_hideout', 'steal_plan', 'free_lila_brother', 'challenge_boss', 'fetch_goods', 'report_cass', 'help_cass'])) >= 0 && hpRatio > 0.5) return i;
    if (heat >= 50 && s.gold >= 50 && (i = first(['bribe_guard'])) >= 0) return i;
    if (heat >= 35 && (i = first(['lay_low'])) >= 0) return i;
    if (s.gold >= 300 && !s.flags.vault_plan && s.turn > 20 && (i = first(['go_blackmarket'])) >= 0) return i;
    if ((s.counters.donate || 0) < 4 && s.gold >= 60 && (i = first(['help_orphans'])) >= 0) return i;
    if (hpRatio < 0.5 && (i = first(['rest'])) >= 0) return i;
    if ((s.counters.intel || 0) < 7 && (i = first(['scout'])) >= 0 && s.turn % 2 === 0) return i;
    if ((s.counters.crew || 0) < 3 && s.rep.shadow >= 15 && (i = first(['recruit'])) >= 0) return i;
    if (s.rel.rat < 5 && (i = first(['learn_rat'])) >= 0 && s.turn % 3 !== 0) return i;
    const dg = hpRatio >= 0.6 ? dungeonForThief(s) : null;
    if (dg && heat < 60) return avail(s, dg);
    if (heat < 30 && (i = first(['burgle', 'pickpocket'])) >= 0 && hpRatio > 0.4) return i;
    if ((i = first(['dock_work', 'train', 'study'])) >= 0) return i;
    return end;
  }
  const dungeonForThief = s => {
    const order = ['dg_vault', 'dg_manor', 'dg_warehouse', 'dg_sewer'];
    for (const id of order) if (avail(s, id) >= 0 && s.level >= { dg_vault: 17, dg_manor: 12, dg_warehouse: 8, dg_sewer: 4 }[id]) return id;
    return null;
  };

  function pickVoyager(s, hpRatio, first, end) {
    const ship = s.counters.ship || 0, crew = s.counters.crew || 0;
    let i;
    if ((i = first(['take_exam', 'meet_scarlett', 'listen_song', 'star_survey', 'deliver_cargo', 'help_bram', 'redeem_chart'])) >= 0 && hpRatio > 0.4) return i;
    if ((i = first(['repair_ship'])) >= 0) return i;
    if ((i = first(['buy_ship_4', 'buy_ship_3', 'buy_ship_2', 'buy_ship_1'])) >= 0) return i;
    if (hpRatio < 0.5 && (i = first(['rest'])) >= 0) return i;
    if (crew < 3 && ship >= 1 && (i = first(['hire_sailor'])) >= 0) return i;
    if (s.rel.haide < 5 && (i = first(['learn_haide'])) >= 0 && s.turn % 3 !== 0) return i;
    const need = { dg_abyss: 17, dg_kraken: 12, dg_wreck: 8, dg_reef: 3 };
    if (hpRatio >= 0.6) for (const id of ['dg_abyss', 'dg_kraken', 'dg_wreck', 'dg_reef']) if (s.level >= need[id] && (i = first([id])) >= 0 && (id !== 'dg_reef' || s.level < 8) && (id !== 'dg_kraken' || s.level < 20)) return i;
    if (ship >= 1 && (i = first(['trade_luxury', 'trade_far', 'trade_coast'])) >= 0) return i;
    if ((i = first(['fish_trip', 'work_docks', 'train', 'study_charts'])) >= 0) return i;
    return end;
  }
  function pickAction(s) {
    const hpRatio = s.hp / g.hpMax(s);
    const first = ids => { for (const id of ids) { const i = avail(s, id); if (i >= 0) return i; } return -1; };
    const end = s.prompt.items.length - 1;
    let i;
    if (scriptId === 'noble_heir' && kind !== 'random') return pickNoble(s, hpRatio, first, end);
    if (scriptId === 'thief' && kind !== 'random') return pickThief(s, hpRatio, first, end);
    if (scriptId === 'voyager' && kind !== 'random') return pickVoyager(s, hpRatio, first, end);
    if (kind === 'random') {
      const ok = s.prompt.items.map((it, k) => k).filter(k => !s.prompt.items[k].disabled && s.prompt.items[k].cost <= s.stamina);
      return ok.length ? ok[Math.floor(R() * ok.length)] : end;
    }
    if (pref && (i = first(['confront_ambrose', 'infiltrate_vault'])) >= 0) return i;
    if (kind !== 'random' && s.gold >= 260 && (i = first(['hire_hand', 'hire_hand_2', 'hire_hand_3', 'hire_hand_4'])) >= 0) return i;
    if (kind !== 'random' && kind !== 'farmer' && s.gold >= 300 && !s.flags.has_leather_buy && (i = first(['go_market'])) >= 0) return i;
    if (kind === 'farmer') {
      if (hpRatio < 0.5 && (i = first(['rest'])) >= 0) return i;
      if ((i = first(['farm_spring', 'farm_summer', 'farm_autumn', 'farm_winter'])) >= 0) return i;
      if ((i = first(['patrol', 'church_help', 'socialize', 'hunt'])) >= 0) return i;
      return end;
    }
    // 通用优先级
    if ((i = first(['march_demon', 'take_efna_city', 'guild_register'])) >= 0) return i;
    if (kind !== 'fighter' && hpRatio > 0.5 && (i = first(['escort_caravan', 'explore_ruins', 'repair_mill', 'look_after_orphan'])) >= 0) return i;
    if (kind === 'balanced' || kind === 'mage') {
      if (hpRatio > 0.4 && (i = first(['find_moon_herb', 'clear_glen_name'])) >= 0) return i;
      if (!s.flags.y_farm_spring && (i = first(['farm_spring'])) >= 0) return i;
      if (!s.flags.y_farm_autumn && (i = first(['farm_autumn'])) >= 0) return i;
    } else if (kind === 'fighter') {
      if (!s.flags.y_farm_autumn && (i = first(['farm_autumn'])) >= 0) return i;
      if (!s.flags.y_farm_spring && (i = first(['farm_spring'])) >= 0) return i;
    }
    if (hpRatio < 0.5 && (i = first(['rest'])) >= 0) return i;
    if (kind === 'balanced' || kind === 'mage') {
      if (s.rel.efna < 4 && (i = first(['accompany_efna'])) >= 0) return i;
      if (s.rel.glen < 3 && (i = first(['learn_sword'])) >= 0) return i;
      if (s.rep.church < 62 && (i = first(['church_help'])) >= 0 && s.turn % 3 !== 0) return i;
      if (kind === 'mage' && s.counters.arcana < 16 && s.turn % 2 === 0 && (i = first(['study_arcana'])) >= 0) return i;
    }
    const dg = hpRatio >= 0.6 ? dungeonFor(s) : null;
    if (dg && (kind === 'fighter' || s.level < 24)) return avail(s, dg);
    if ((i = first(s.turn % 4 === 3 ? ['study_arcana', 'study', 'train'] : ['train', 'study_arcana', 'study'])) >= 0) return i;
    if ((i = first(['patrol', 'socialize', 'rest'])) >= 0) return i;
    return end;
  }

  return function act(s) {
    const p = s.prompt;
    switch (p.kind) {
      case 'result': return 0;
      case 'end': return 0;
      case 'alloc': {
        const prefs = scriptId === 'noble_heir' ? ['int', 'wil', 'int', 'str'] : kind === 'farmer' ? ['str', 'wil'] : kind === 'mage' ? ['int', 'wil', 'int', 'str'] : ['str', 'wil', 'str', 'agi'];
        if (kind === 'random') return Math.floor(R() * 6);
        return ATTRS.indexOf(prefs[s.level % prefs.length]);
      }
      case 'event': {
        const ok = p.options.map((o, k) => k).filter(k => !p.options[k].disabled);
        if (!ok.length) return 0;
        if (kind === 'random') return ok[Math.floor(R() * ok.length)];
        if (pref) {
          const want = ['知道你是谁', pref === 'throne' ? '接过来' : '重铸它'];
          for (const w of want) { const k = ok.find(k => p.options[k].label.includes(w)); if (k !== undefined) return k; }
        }
        return ok.find(k => !p.options[k].avoid) ?? ok[0];
      }
      case 'combat': {
        const t = p.tactics;
        const base = 0.5 + (p.myPower - p.enemyPower) * 0.02;
        const idxOf = id => t.findIndex(x => x.id === id);
        if (kind === 'random') { const ok = t.map((x, i) => i).filter(i => !t[i].disabled); return ok[Math.floor(R() * ok.length)]; }
        const flee = idxOf('flee');
        // 候选：强攻、可用技能（跳过被禁用的）；省魔力：底子够硬就直接强攻
        const cands = t.map((x, i) => ({ x, i })).filter(c => c.x.id !== 'flee' && !c.x.disabled);
        const hpLow = p.hp / p.hpMax < 0.4;
        let best = cands.find(c => c.x.id === 'attack');
        if (base < 0.8 || hpLow) {
          for (const c of cands) {
            const val = c.x.win + (hpLow ? (c.x.heal || 0) * 0.5 + (c.x.injure < 1 ? (1 - c.x.injure) * 0.1 : 0) : 0);
            const cur = best.x.win + (hpLow ? (best.x.heal || 0) * 0.5 + (best.x.injure < 1 ? (1 - best.x.injure) * 0.1 : 0) : 0);
            if (val > cur) best = c;
          }
        }
        if (base + best.x.win < 0.3 && flee >= 0) return flee;
        return best.i;
      }
      case 'dungeon': {
        const hpRatio = s.hp / g.hpMax(s);
        const boss = p.nodes[0].type === 'boss';
        if (kind !== 'random' && hpRatio < (boss ? 0.5 : 0.35)) return p.nodes.length; // 撤离
        const rank = { rest: hpRatio < 0.6 ? 0 : 3, chest: 1, event: 2, fight: 2, boss: 0 };
        let best = 0;
        p.nodes.forEach((n, k) => { if (rank[n.type] < rank[p.nodes[best].type]) best = k; });
        return kind === 'random' ? Math.floor(R() * p.nodes.length) : best;
      }
      case 'actions': return pickAction(s);
      default: throw new Error('未知 prompt ' + p.kind);
    }
  };
}
