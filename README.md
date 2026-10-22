# 私人学习助手（拾知 / Study Companion）

拾知是一款 Windows 桌面学习助手：阅读本地资料，依据原文提问，写笔记、做练习，并安排任务与专注。采用 Electron + React + TypeScript；支持本机 Ollama 与兼容 OpenAI 的接口。

## 先从这里开始

- **直接体验当前代码：**双击根目录的 **`打开拾知（本地最新版）.cmd`**。它会编译当前本地代码再启动；更新后先保存并关闭旧窗口，再重新打开。
- **查看怎么使用：**[使用指南](docs/usage.md)。
- **理解整体架构：**[架构与维护评估](docs/CODEMAPS/architecture.md)，再看[前端](docs/CODEMAPS/frontend.md)、[主进程](docs/CODEMAPS/backend.md)和[数据](docs/CODEMAPS/data.md)。
- **查找文档：**[文档索引](docs/README.md)；协作开发先读 [AGENTS.md](AGENTS.md)。

快捷入口默认保留体验数据于 `user-data/local-preview/`，与安装版数据分开；下次打开继续使用。它不自动拉取 Git、安装依赖或下载模型。首次使用 AI 仍需在设置中选择模型，本地模型需先启动 Ollama。

## 功能实现与验收状态

首版 **0.1.1 未签名 Windows x64 预览版已公开交付**：[下载页面](https://github.com/guxingzhou16-pixel/Personal-Study-Assistant/releases/tag/v0.1.1-preview.1)。交付对象为 `f84285f`，安装与下载证据见[最终交付回执](docs/testing/github-preview-release-2026-10-15.md)。

当前维护工作区另有尚未发布的审查修复与体验优化；以 `git status` 和实际源码为准，不能把已发布安装包当成当前源码。详见[全局修复交接](docs/testing/full-code-review-fixes-2026-10-16.md)与[试用优化交接](docs/testing/user-trial-fixes-2026-10-16.md)。

| 能力     | 当前范围                                                    |
| -------- | ----------------------------------------------------------- |
| 资料阅读 | PDF、UTF-8 Markdown，本机副本、阅读位置、选文引用与阅读侧栏 |
| 学习助手 | 流式聊天、资料问答、关键词／本地 BGE 混合检索、出处跳转     |
| 学习作品 | 结构化笔记、AI 笔记反馈、卡片／短测验、作答与手动复习安排   |
| 学习路线 | 有引用的步骤建议，完整预览后确认写入任务或学习意向          |
| 学习安排 | 项目、每日任务、独立专注计时与复盘、日历和三种主题          |
| 数据维护 | 已保存内容的完整备份／恢复，历史查看与 Markdown 导出        |

模型回答、有效编号、计时或签到均不等于知识已掌握。真实模型质量、安装包及测试结论只覆盖各自记录中的版本和场景。OCR、更多资料格式、云同步与展示网站仍不属于当前交付范围。

## 界面与设计维护

当前整合采用晴岛视觉，同时保留已交付的笔记、计划、专注、阅读侧栏和复习；不能沿用旧设计稿把这些能力标为规划中。界面变更参考[晴岛规范](docs/design/SUNNY_ISLE.md)及[设计档案](design-lab/README.md)，日常代码位置仍以[前端地图](docs/CODEMAPS/frontend.md)为准。设计实验不进入软件运行时，也不代表已经发布新版安装器。

## 本地运行

要求：Windows 10/11、Node.js **24.16 或更新的受支持版本**、npm。当前使用预编译 Electron，不需要 Rust 或 C++ 编译工具。维护分支为 `codex/structured-notes`；已有该工作区无需重新下载项目。

首次准备依赖：

```powershell
npm ci
node node_modules/electron/install.js
```

随后双击 `打开拾知（本地最新版）.cmd`。如需开发时的界面热更新：

```powershell
$env:STUDY_COMPANION_DATA_DIR = Join-Path $PWD 'user-data/local-preview'
npm run desktop:dev
```

修改 `electron/` 后重启开发进程。`npm run dev` 仅为浏览器界面预览，不具备本地文件、数据库与系统密钥能力。

| 命令                                             | 作用                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| `npm run desktop:dev`                            | 启动 Vite 和真实 Electron 开发窗口                     |
| `npm run desktop:build`                          | 类型检查并编译界面、主进程、preload 与三个 worker      |
| `npm run desktop:start`                          | 打开现有构建，不重新编译                               |
| `npm run typecheck`                              | 两套 TypeScript 检查                                   |
| `npm test`                                       | Vitest 核心测试；测试位置见[测试说明](tests/README.md) |
| `npm run test:e2e`                               | 构建并执行常规 Electron 流程；含耗时场景，按需运行     |
| `npm run test:embedding`                         | 独立真实 BGE 门禁，需要既有评测权重                    |
| `npm run eval:retrieval` / `npm run eval:hybrid` | 固定检索回归；逐题结果比退出码更重要                   |
| `npm run desktop:pack` / `npm run desktop:dist`  | 目录包／NSIS 候选构建，不自动发布                      |

依赖、首次 Electron 下载、打包与许可边界见[依赖与构建地图](docs/CODEMAPS/dependencies.md)。普通改动只运行相关检查，不默认重跑全部历史验收。

## 目录地图

```text
src/
  App.tsx                 工作台与页面导航
  components/             按功能分组的页面、子组件与配套样式
  lib/                    桌面桥接、共享类型、纯规则及界面 hook
electron/
  main.ts / preload.ts    权限边界、应用生命周期与固定 IPC
  core/                   业务服务、存储、检索与数据校验
    __tests__/            后端核心测试
  *-worker.ts             资料解析、检索／嵌入、备份后台入口
tests/                    Electron 流程、真实模型门禁与合成 fixtures
scripts/                  开发、构建、评测与发行工具
docs/                     使用说明、架构地图、测试／发布记录与历史归档
public/                   本机静态资产；PDF.js 文件由准备脚本生成
```

`node_modules/`、`dist/`、`dist-electron/`、`artifacts/`、`release/`、`coverage/`、`test-results/` 是依赖或生成物；`user-data/` 是本地体验数据。它们不是业务源码，不纳入提交，也不因整理目录自动删除。

本机未追踪的第三方下载和辅助脚本保留各自归属，不视为应用已集成的功能。每次新增文件先按职责放入已有目录，避免重新把页面堆回 `components/` 顶层。

## 数据与维护约定

- 主库 v13、活动库 v1、派生索引 v2；当前完整备份支持真实 12/1 与 13/1。
- API 密钥通过 Windows 系统加密单独保存，不进入学习数据库或导出备份。
- 备份只包含已保存内容，未加密，不包含密钥、模型和派生缓存；恢复整份替换，不合并。
- 默认只提交本地 Git；推送、合并与发布按用户明确授权执行。

详细数据位置与恢复边界见[数据地图](docs/CODEMAPS/data.md)，实际操作见[使用指南](docs/usage.md)。

## 历史记录与许可

2026-10-21 整理前的完整 [README 快照](docs/archive/README-history-2026-10-21.md)和 [AGENTS 快照](docs/archive/AGENTS-history-2026-10-21.md)已归档，原阶段规划、失败、验收范围及未提交维护说明均保留。历史文档中的旧路径和“待验收”只代表当时状态，当前目录以本页与架构地图为准。

项目自有代码采用 [MIT](LICENSE)。第三方保持各自许可与分发条件，见[第三方说明](docs/third-party-licenses.md)及[当前首版发布政策](docs/releases/v1-release-plan.md)。可信签名后续处理，未签名预览版的下载与提示按实际发布记录说明。
