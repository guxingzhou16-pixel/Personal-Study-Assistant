# 本地开源 UI 参考台

入口：[index.html](index.html)。直接用浏览器打开即可；也可沿用本轮静态服务器访问。无需安装依赖、构建、后端或联网。

这里是三个 GitHub 项目的 **CSS 组件展示**。页面和示例文案由本项目编写，组件样式真实引用各库的本地资产。它们用于核对视觉材料，不是原项目的完整应用，也不是「拾知」正式功能。玄墨、赤陶、蓝调三套软件概念在本轮上级目录，与这些参考页分开保存。

## 本地入口与来源

| 入口                                     | 上游项目                                                                          | 固定版本                                                    | 本地样式                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| [halfmoon.html](halfmoon.html)           | [halfmoonui/halfmoon](https://github.com/halfmoonui/halfmoon)                     | package 2.0.2，`cf038207614636028d363ca5c746f532b2d1426b`   | `assets/halfmoon/halfmoon.min.css`                          |
| [pico.html](pico.html)                   | [picocss/pico](https://github.com/picocss/pico)                                   | package 2.1.1，`a07563ddc856e6ed31a740e33b0397814227d469`   | `assets/pico/pico.min.css`                                  |
| [neo-brutalism.html](neo-brutalism.html) | [quak-smauga/Neo-brutalism-CSS](https://github.com/quak-smauga/Neo-brutalism-CSS) | 无 package 版本，`cf19c9a4270eb6ebbed2aeb9f72a0ff54643fb33` | `assets/neo-brutalism-css/styles/main.css` 及其相对导入模块 |

## 文件边界

- `upstream/`：本机完整源码快照与固定 SHA 的原始 ZIP。最初 GitHub Git 克隆连接超时，改用 GitHub API 读取 commit SHA，再通过 `codeload.github.com` 下载对应 SHA 的 ZIP。解压前验证了全部条目的最终绝对路径位于目标目录内。此目录按 `.gitignore` 忽略，不包含 Git 历史，不需要执行其中脚本。
- `assets/halfmoon/`、`assets/pico/`、`assets/neo-brutalism-css/`：运行展示页所需的最小 CSS 与各自 MIT 许可证副本，随设计档案提交。即使没有忽略的 `upstream/`，三个本地展示仍可运行。
- `assets/showcase.css`：本项目编写的展示页容器、双栏、字号约束、窄屏和减少动画处理，不是上游库本体；Neo 的示例搜索框由该文件补充样式。
- `assets/showcase.js`：本项目编写的页面内筛选、收藏状态和明暗切换。不写入存储，也不请求网络。
- `sources.lock.json`：静态来源档案接口。记录 repo、精确 SHA、下载 ZIP 的 SHA-256、每个本地资产的上游路径、原始 SHA-256、本地 SHA-256、字节数和适配说明。所有路径相对于本目录；它不属于正式应用 API。

## 离线适配与许可

三个库均为 MIT，原版权与许可全文分别保存在各自 `assets/` 子目录。

仅做了两项运行适配，原始 `upstream/` 文件保持不变：

1. Halfmoon 本地 CSS 副本移除了最后的 `sourceMappingURL` 注释，避免查找未随最小资产保存的调试映射；CSS 样式声明不变。
2. Neo 的 `variables.css` 本地副本移除了首行 Google Fonts `@import`，避免打开页面时请求外网。字体使用系统回退。其余样式声明不变，原始 showcase 的外部字体链接和远程占位图也没有引入本地展示页。

不要对上游资产子目录运行 Prettier 或全局格式化；任何字节变化都需要重新核对并更新 `sources.lock.json`。无需安装或执行上游的 `package.json` 脚本。未来重新获取完整源码时，使用锁档中的 `archiveUrl` 和 `archiveSha256`，下载到新的空目录，检查 ZIP 条目路径后再解压，避免覆盖旧档案。

## 可体验的行为

- 三页均可输入「证据」筛选阅读片段，清空后恢复；没有匹配时显示空结果。
- 收藏按钮有 `aria-pressed` 和可见反馈，刷新页面后重置，不代表正式收藏功能。
- Halfmoon / Pico 可切换原库明暗主题；Neo 展示原库描边、标签与硬阴影。
- `details` 展开参考说明，外部 GitHub 链接仅在用户主动点击时访问。

## 验证与接手

本次已核对完整源码 ZIP 的 commit 根目录、实际 package 版本、15 个运行 CSS／许可证文件的摘要及 CSS 中的远程导入。未安装第三方依赖、未运行上游安装或构建脚本、未连接真实学习数据。浏览器尺寸、资源请求与交互检查记录见[本轮验证记录](../VALIDATION.md)。

其他 AI 接手顺序：先读本文件，再读 `sources.lock.json`、[本轮参考说明](../REFERENCES.md) 和选中设计的 `HANDOFF.md` / `design.json`。正式实现应复用应用现有 React 组件和桌面桥接；本参考台的静态交互不能作为产品功能交付记录。
