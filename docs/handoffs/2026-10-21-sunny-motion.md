# 2026-10-21 晴岛全功能动效交接

## 交付范围

从 main `5ba3b1b` 创建 `codex/sunny-isle-motion`。用户确认顺滑克制、当前 main 的全部可用功能、正式软件与独立演示同时交付。保留原版晴岛视觉、Electron + React + TypeScript；不发布安装包，不引入新依赖。

- [正式设计规范](../design/SUNNY_MOTION.md)
- [独立离线演示](../../design-lab/2026-10-21-sunny-motion/index.html)
- [机器可读档案](../../design-lab/2026-10-21-sunny-motion/design.json)
- [演示维护交接](../../design-lab/2026-10-21-sunny-motion/HANDOFF.md)

正式界面覆盖启动、导航、首页资料、月历、签到、手动计时、导入/取消、搜索筛选、阅读目录/护眼/PDF翻页/复制/出处、会话/流式聊天/停止、资料问答/证据/取消、服务配置/检测/密钥/保存、模型下载/取消。演示提供 12 组场景，全部标记示例数据。

## 维护边界

动效代码在 `src/lib/motion.ts`，样式在 `src/styles/motion.css`。业务组件通过 data-motion 属性声明场景和语义状态；不是新的 IPC 或应用数据类型。生成演示副本的命令是 `node scripts/build-motion-demo.mjs`，无需安装额外依赖。

不将每秒计时、每次进度消息或每个流式片段作为动效 key；不把 ChatPage 放到随页面更换 key 的容器中；不覆盖 hidden 的布局语义；不变换 PDF.js 文字层。阅读目录折叠时立即 inert，浏览器完成离散退出后释放列宽。

其他 AI 更换动效时，先读正式规范和本轮 design.json。旧静态配色设计、原晴岛插画、业务接口、数据库、模型协议和用户文件未改动。

## 验证记录

- `npm run desktop:build` 通过，含两套 TypeScript 检查、Vite 与 Electron 入口构建。
- `npx playwright test tests/motion.spec.ts tests/desktop.spec.ts tests/calendar.spec.ts tests/reading.spec.ts tests/chat.spec.ts tests/rag.spec.ts tests/embedding.spec.ts`：最终重跑 **10 passed（53.1 秒）**。实际启动 Electron，使用临时数据、合成资料、模拟模型和测试密钥。
- 新增正常／减少动态效果两条动效回归：快速切页、同页不重播、真实签到与计时、轮询不重复动画、搜索、PDF 页和文字层、目录收起时禁止交互、原文折叠、最小窗口、动态切换系统偏好取消进行中动画。
- 现有聊天流程增加生成中切页／返回，确认问题输入 DOM 节点身份保持，回答保留且仍可停止。
- 初次动效测试在 Electron 首次导航完成前 reload 失败，已增加页面就绪条件；冷启动 PDF 解析超过默认 5 秒时仍处于真实解析，导入断言改为最多等待 15 秒，未降低导入结果断言。
- 独立演示以 file:// 离线运行，12 场景、半速（页面 token 480ms）、系统／本页减少动态效果，以及 1280×900／900×640／390×844 检查通过。无页面脚本异常或 HTTP 请求；已归档 4 张截图、WebM 和 validation.json。移动布局修复场景列表的 min-width 导致的横向溢出。
- 代码与 TypeScript 专项审查发现并修复：减少动态效果下 CSS hover／press 的瞬间变换、演示阅读器返回目标错误、出处强调与翻页复用动画 key。后两项加入浏览器检查，验证先定位出处再翻页可正常往返，返回资料库目标正确。未全局取消 PDF transform。
- 最终代码与 TypeScript 专项复核通过，无未解决实质问题；源码、测试、自写演示与文档的 Prettier 检查、JSON Schema v2、档案路径／文档链接、源码摘要／CSS 副本一致性及 `git diff --check` 通过。生成的 runtime.js 由构建脚本维护，不手动格式化。

未做完整核心回归、真实 BGE／聊天质量、所有 Windows 系统 DPI／硬件、安装包或远端 CI 验收。本次不会将先前 UI 或模型历史成绩当作新的测试结果。

## 接手下一步

当前工作是同一晴岛基线的动效扩展，不提供主题选择器或新学习功能。修改动效后运行相关桌面流程、重新生成演示、更新机器档案和录像；普通后端改动无需重做整轮视觉展示。默认本地 Git 提交，未收到当前任务明确推送要求不推送或合并 main。
