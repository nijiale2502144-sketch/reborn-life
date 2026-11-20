// 内容加载：readJson(path) 由调用方提供（浏览器用 fetch，Node 用 fs）
export async function loadContent(readJson) {
  const names = ['config', 'dungeons', 'enemies', 'items', 'meta', 'skills'];
  const [config, dungeons, enemies, items, meta, skills] = await Promise.all(names.map(n => readJson(`content/${n}.json`)));
  const [cActions, ...cEventFiles] = await Promise.all(['actions', 'events', 'events_dungeon'].map(n => readJson(`content/common/${n}.json`)));
  const ids = await readJson('content/scripts.json');
  const scripts = {};
  for (const id of ids) {
    const [sc, actions, quests, ...eventFiles] = await Promise.all(
      ['script', 'actions', 'quests', 'events', 'events_random', 'events_derived', 'events_story', 'events_dungeon'].map(n => readJson(`content/${id}/${n}.json`)));
    scripts[id] = Object.assign({ id, actions, events: eventFiles.flat(), quests }, sc);
  }
  return {
    config, dungeons, enemies, items, meta, skills,
    common: { actions: cActions, events: cEventFiles.flat() },
    scripts,
  };
}
