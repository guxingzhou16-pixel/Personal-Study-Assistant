# 第二轮视觉参考与本地来源

日期：2026-10-17。本轮保留上一轮「晴岛」的顶部导航、欢迎横幅、双列学习卡片与阅读／助手布局，另外制作三套视觉方向。原晴岛只作排版基线，保留在[上一轮目录](../2026-10-17-three-directions/03-island/index.html)，不计入本次三个新方案。

## 三个新方向如何参考

| 设计方向 | 视觉材料                                                                                          | 本轮转译                                                         | 参考边界                                                   |
| -------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 玄墨     | [Halfmoon](https://github.com/halfmoonui/halfmoon)：暗色表面层级、细边框与表单秩序                | 黑白灰的安静桌面工作区，以灰阶区分背景、卡片与文字；保留晴岛布局 | Halfmoon 默认含蓝色等语义色，玄墨的纯灰阶是本轮自行设计    |
| 赤陶     | [Pico CSS](https://github.com/picocss/pico)：语义化排版、文字间距、简单控件                       | 米白纸面、陶土橙强调色和偏编辑式的标题，保持学习工作台的信息顺序 | Pico 展示页保留上游默认配色；赤陶不是直接套用官方主题      |
| 蓝调     | [Neo-Brutalism CSS](https://github.com/quak-smauga/Neo-brutalism-CSS)：粗描边、硬阴影、色块与几何 | 钴蓝与奶油黄、较明确的按钮轮廓，收敛阅读正文中的装饰             | 借鉴视觉语言；没有复制原库营销页、原示例外部图片或远程字体 |

软件概念按自身排版与交互编写，不依赖把三个框架直接加入正式 Electron 项目。另设[本地开源参考台](references/index.html)，真实引用对应库 CSS，便于看清「原组件」和「新设计」之间的差别。

## 已核对的上游证据

- **Halfmoon**：[README](https://github.com/halfmoonui/halfmoon/blob/cf038207614636028d363ca5c746f532b2d1426b/README.md) 给出本地 `halfmoon.min.css` 模板；[package.json](https://github.com/halfmoonui/halfmoon/blob/cf038207614636028d363ca5c746f532b2d1426b/package.json) 为 2.0.2，入口 `css/halfmoon.min.css`。暗色切换遵循[官方色彩模式说明](https://www.gethalfmoon.com/docs/color-modes/)中的 `data-bs-theme`。静态组件页只用 CSS，不需要 Bootstrap JS。[MIT 许可](https://github.com/halfmoonui/halfmoon/blob/cf038207614636028d363ca5c746f532b2d1426b/LICENSE)。
- **Pico CSS**：[README](https://github.com/picocss/pico/blob/a07563ddc856e6ed31a740e33b0397814227d469/README.md) 支持手动引入 CSS；[package.json](https://github.com/picocss/pico/blob/a07563ddc856e6ed31a740e33b0397814227d469/package.json) 为 2.1.1，入口 `css/pico.min.css`。可按[官方 CSS 变量说明](https://picocss.com/docs/css-variables)覆盖配色；[色彩模式说明](https://picocss.com/docs/color-schemes)使用 `data-theme`。[MIT 许可](https://github.com/picocss/pico/blob/a07563ddc856e6ed31a740e33b0397814227d469/LICENSE.md)。
- **Neo-Brutalism CSS**：[原 showcase HTML](https://github.com/quak-smauga/Neo-brutalism-CSS/blob/cf19c9a4270eb6ebbed2aeb9f72a0ff54643fb33/neobrutalism-showcase.html) 直接引用 `styles/main.css`；该文件用相对导入组合九个模块，无需构建。本地展示使用这组 CSS，自行编写组件示例。原变量文件的远程字体导入已仅在运行副本移除。[MIT 许可](https://github.com/quak-smauga/Neo-brutalism-CSS/blob/cf19c9a4270eb6ebbed2aeb9f72a0ff54643fb33/LICENSE)。

完整源码以固定 commit ZIP 保存于本轮 `references/upstream/`，由 Git 忽略；最小运行资产及原许可证保存在 `references/assets/` 并纳入设计档案。不是在线部署，也未安装依赖或运行第三方脚本。

精确 revision、下载来源、原始文件与本地文件 SHA-256、两项离线适配均见 [sources.lock.json](references/sources.lock.json)。运行与交接约定见[参考台 README](references/README.md)。这些参考支持审美选择，不构成现有软件功能或模型效果的验证。
