# 2026-10-18 晴岛正式 UI 交接

## 用户授权与范围

用户明确要求直接采用第一轮 **03 晴岛原版**替换原 UI，并保存设计文档和交接文档供后续更换、维护。对应设计 ID 为 `shizhi.sunny-isle.v1`，并非第二轮的玄墨、赤陶或蓝调。

正式 UI 已落地，桌面构建与本次选取的 6 条 Electron 流程通过。此结论限定于下方实际覆盖范围，不表示完整回归或真实模型质量已验证。

本次范围是现有 Electron + React 桌面软件的视觉与布局。原有资料导入、PDF/Markdown 阅读、聊天、检索引用、设置、加密密钥、模型下载、签到和累计计时沿用现有业务链；无新后端、IPC 方法、数据库迁移或服务 API。项目仍是 Windows 桌面应用。

## 接手入口

- [正式设计规范](../design/SUNNY_ISLE.md)：布局、真实数据、token、状态、与 demo 的差异及更换方法。
- [选定方案 JSON](../../design-lab/selected-design.json)：稳定的机器可读入口，路径相对于仓库根目录。
- [原版概念稿](../../design-lab/2026-10-17-three-directions/03-island/index.html) 与 [历史档案](../../design-lab/2026-10-17-three-directions/03-island/HANDOFF.md)：帮助核对视觉来源，不代表正式功能。

## 改动与维护位置

| 文件／模块                              | 本次职责                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/App.tsx`                           | 左品牌、中间胶囊主导航、右设置入口；薄荷欢迎横幅；宽资料列与窄月历／计时列；保留规划中入口 |
| `src/components/RecentReadings.tsx`     | 将真实最近资料排为主阅读卡和后续列表；保留失败、空态和实际打开入口                         |
| `src/components/StudyCalendar.tsx`      | 将完整月历与签到放在白卡，真实累计计时放在下方灰紫卡；保留原日期和计时逻辑                 |
| `src/styles/tokens.css`                 | 晴岛基础语义 token 集中定义；局部装饰色和尺寸仍需核对对应样式及 SVG                        |
| `src/styles.css`                        | 壳、欢迎区、通用控件及现有资料库／阅读／助手／设置的统一视觉                               |
| `src/styles/study-home.css`             | 真实首页资料、月历、签到、计时布局                                                         |
| `src/main.tsx`                          | 样式载入                                                                                   |
| `src/assets/sunny-isle-plant.svg`       | 复用首轮晴岛原创静态叠书植物，不是用户学习成长数据                                         |
| `README.md`、`AGENTS.md`、`design-lab/` | 正式方案入口、选定状态与维护约定；历史 demo 原样保留                                       |

首页不沿用概念稿的固定资料、进度、时长或签到。原版同屏阅读助手没有随着视觉替换自动成为已实现功能。学习计划、笔记、番茄钟仍明确标记为规划中；本次没有新增主题选择器。

## 不可破坏的边界

1. **聊天常驻：**`ChatPage` 在启动成功后持续挂载，离开页面只隐藏；`visible`、`revision`、停止、会话与部分回答恢复契约保留。不能让切页或打开引用重新创建聊天组件。
2. **原文与引用：**PDF 必须保留原页和文字层；Markdown 安全规则、护眼、每份资料独立位置保留。引用仍通过 `resolveCitation` 核对保存证据并跳转，保留“返回问答”和“问这份资料”。
3. **签到与计时：**签到今天和手动累计计时是不同操作，日期与时长由主进程决定；保留心跳、睡眠暂停、跨日与恢复边界。计时不是番茄钟，不能用假数填充视觉空白。
4. **设置与密钥：**昵称、目标、回应风格和模型配置保留保存／恢复；远程发送确认必须继续绑定实际地址、模型与预览。密钥继续由主进程系统加密，不能为了预览或截图写入静态文件。
5. **导入与检索：**原生文件选择、逐文件错误、取消、完整性检查、后台进度和关键词降级保留。renderer 不获得文件路径、任意频道或 SQL 权限。
6. **样式隔离：**不导入 `design-lab` 的 demo JS／CSS 或第二轮上游 UI 库。只从正式 token 和组件样式修改外观；聊天 `hidden` 不能被 `display` 覆盖。

## 本次验证记录

- 已执行 `npm run desktop:build` 并通过，包含 renderer／Electron 两套 TypeScript 检查、生产界面构建及全部 Electron 入口构建。
- 以下定向命令在视觉修复后最终重跑 **6 passed（30.3 秒）**，覆盖桌面导航／设置密钥／开发桥接、月历签到与计时持久化、双协议聊天、资料阅读重启恢复和 RAG 原文出处跳转。

```powershell
npx playwright test tests/desktop.spec.ts tests/calendar.spec.ts tests/reading.spec.ts tests/chat.spec.ts tests/rag.spec.ts --grep "desktop navigation|development window|sunny island layout|imports local files|real desktop streams|desktop retrieves"
```

- 流程实际启动 Electron，使用自动生成的资料、模拟模型服务和假密钥；未读取用户私人资料或调用付费服务。
- 本次未运行完整核心测试套件、完整桌面回归、真实聊天模型、真实 BGE 门禁或安装包验证；不引用历史版本或静态 demo 的测试数量作为本次成绩。
- 主执行者检查了真实 Electron 的首页空态／三份合成资料、资料库、Markdown 阅读、聊天和设置截图，覆盖 1280×900 与 900×640；9 次截图均无横向溢出或 renderer 异常。修复独立 SVG 解码、外层重复滚动条和矮窗口聊天空态裁切，并增加图片解码及聊天标题／输入框可见性回归断言。
- [首页快照](../design/assets/sunny-isle-home.png)与[最小窗口助手快照](../design/assets/sunny-isle-chat-900.png)纳入设计档案；其他本机截图及检查数据在忽略的 `artifacts/ui-design/sunny-app/`。未覆盖其他系统缩放、所有错误状态或完整 WCAG 审计。
- 代码与 TypeScript 专项审查已完成，发现的读屏辅助类遗漏已恢复，没有未解决的实质问题。
- 修改的源码、测试和新增档案通过 Prettier 检查，SVG 按 HTML parser 检查；选定 JSON 的源码路径、文档本地链接与 `git diff --check` 通过。

## 后续维护

先读 `design-lab/selected-design.json` 与设计规范，再核对 Git 状态和实际源码。只改颜色时从 token 开始；改首页排版时优先 `study-home.css`，改框架再触碰 `App.tsx`。保留其他人的工作，不因换视觉重建业务组件或删除数据。

后续检查重点为真实长中文资料名、空资料库、错误消息、900×640 和系统缩放。扩展同屏助手、真正番茄钟或主题切换需独立需求与功能验证，不从历史 demo 推断授权或完成状态。Git 默认只在本地提交；本交接不声称已推送或发布安装包。
