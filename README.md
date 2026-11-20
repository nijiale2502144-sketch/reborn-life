# 占位像素素材

- `portraits/`：人物立绘，64×64，对应界面的“立绘槽”。
  - portrait_hero_normal.png 主角（农夫之子）
  - portrait_efna_normal.png 艾芙娜
  - portrait_glen_normal.png 老兵格伦
  - portrait_priest_normal.png 神父
- `scenes/`：场景底图，320×180，对应界面的“场景图槽”。
  - scene_village_spring / autumn / winter.png 麦穗村四季（春、秋、冬）
  - scene_mountain.png 进山
  - scene_cave_entrance.png 后山洞穴入口
- `preview.png`：放大预览总览。
- `gen_pixel.py`：生成脚本，改调色板或参数后重新运行即可（需要 Pillow）。

使用时在 CSS 里加 `image-rendering: pixelated`，并按整数倍放大。
