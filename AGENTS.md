# 私人学习助手：项目说明与 AI 开发协作指南

本文件适用于仓库内的开发、文档、验证与交接工作，帮助第一次接手的开发者或 AI 在没有聊天记录的情况下继续项目。请先读本文件，再读 `README.md` 和文档索引，并核对实际代码与 Git 状态。

上层运行环境的规则与用户当前的明确要求优先于本文件。目录中若有更具体的 `AGENTS.md`，同时遵守其适用范围。不要把本文中的历史快照当成永久不变的代码状态。

## 1. 最重要的约定

1. **先完成学习软件，展示网站最后建设。** 当前交付形态为 Windows 桌面应用，不要因为界面使用 React 就将项目改成官网或在线 SaaS。
2. **使用 Electron + React + TypeScript。** 用户已选择这条路线，不再沿用旧规划的 Tauri + Rust；重大技术路线变更先说明理由并与用户对齐。
3. **本地模型优先照顾，云端接口也完整支持。** 默认服务为 Ollama；支持用户自行配置兼容 OpenAI 的接口，不强制某一家模型服务。
4. **实际功能状态必须真实。** 模型列表检测成功不代表生成、RAG 或 Agent 已完成；新增依赖、测试规格、界面入口也不代表功能已交付。
5. **每完成一个可用功能，向用户报告。** 写明实际行为、验证方式、尚未验证的部分及下一步，用中文说明。
6. **默认只提交本地 Git。** 未收到用户明确的推送要求时，不执行 `git push`，包括功能分支、主分支与标签；不自行改变仓库可见性或公开发布。
7. **保持其他人的工作。** 开工检查已有修改，按文件或改动范围提交，不重置、覆盖、格式化或顺手提交无关改动。
8. **文档与代码同步维护。** 功能、目录、数据库、接口、命令或阶段状态变化时更新 README，并更新本文件中对应的稳定开发约定。
9. **普通功能只做相关的简单基础验证。** 不默认每次跑完整测试套件或全局测验；完整回归放在阶段验收、发布前或用户明确要求时。
10. **个人资料和密钥不得进入仓库。** 本机人格设定、数据库、模型缓存、备份及密钥不属于可提交的项目资产。
11. **项目自有代码使用MIT。** 用户于2026-10-11明确选择，全文为根目录`LICENSE`。后续包须带`resources/LICENSE.txt`原字节；第三方保持各自许可与未关闭的分发条件。
12. **当前主要目标是完成并发布首版 Windows 软件。** 2026-10-15用户要求简化流程；按`docs/releases/v1-release-plan.md`冻结现有功能并收尾。允许明确标为未签名的NSIS发行，可信签名/SignPath/Store不再是首版前置条件；实际分发许可、数据安全、最终包必要验证和下载可用性仍是门槛。不要新增统一SBOM/位同重建要求或默认重跑全部历史测试。

## 2. 项目身份、目标与交付形态

| 项目项 | 约定 |
| --- | --- |
| 项目名称 | 私人学习助手 / Study Companion；当前界面使用“拾知”作为名称 |
| 仓库 | `https://github.com/guxingzhou16-pixel/Personal-Study-Assistant` |
| 仓库可见性 | 2026-10-13用户明确授权公开开源/申请SignPath，GitHub实际读回public；历史私有快照不覆盖当前状态 |
| 主分支 | `main`；创建新的功能分支时默认使用 `codex/` 前缀 |
| 当前开发工作区 | Windows 下的 `E:\私人学习助手`；项目代码不可依赖这个绝对路径 |
| 首版平台 | Windows 10/11 桌面软件 |
| 初始用户 | 优先服务个人学习，以编程与技术资料验证体验，保留跨学科扩展空间 |
| 开发目的 | 可长期使用的学习软件，同时作为能写进简历、可解释和可评测的 RAG 实践项目 |
| 成本目标 | 开发者零持续服务预算，不向使用者收费；云端 API 由用户自行配置和承担费用 |
| 账户与同步 | 首版无注册账号、无自动跨设备同步，以本地保存和手动备份为主 |
| 发布目标 | 经验证的 Windows 安装包，通过 GitHub Releases 发布；展示网站最后作为介绍与下载入口 |

软件要帮助用户提升学习效率、理解资料、看见进步、得到温和的情绪支持，并保持学习动力。不要把学习时间或签到数量直接等同于知识掌握程度，也不要用虚构的进步或评价制造成就感。

核心学习流程：**设定目标 → 阅读资料 → 提问求证 → 写出作品 → 获得反馈 → 复盘并安排下一步。**

## 3. 当前状态与接手入口

本节核对日期：**2026-10-22**。当前软件为 Electron 桌面应用，首版 0.1.1 未签名预览已交付；发布对象与证据见 [最终交付回执](docs/testing/github-preview-release-2026-10-15.md)。后续修复、目录整理、晴岛界面／动效与设置更新入口已整合，未更新发行附件，先检查 Git 状态再判断当前版本。最新范围与验证见[更新与分支整合交接](docs/testing/updates-integration-2026-10-22.md)。

- 当前数据：主库 v13、活动库 v1、派生索引 v2；备份 format 1 支持真实 12/1 和 13/1。
- 日常阅读：根目录 README → [文档索引](docs/README.md) → [架构地图](docs/CODEMAPS/architecture.md)。
- 历史源码交接：[全局审查修复](docs/testing/full-code-review-fixes-2026-10-16.md)、[试用反馈优化](docs/testing/user-trial-fixes-2026-10-16.md)。当前独立审查及实际回归按最新整合报告解释，不借历史成绩覆盖未验证范围。
- 原 3.1～3.44 和完整接手快照保留在 [2026-10-21 归档](docs/archive/AGENTS-history-2026-10-21.md)。旧 pending、包、测试次数和授权均按原日期／对象解释，不覆盖本轮明确要求。

## 4. 产品范围与功能要求

### 4.1 资料导入与辅助阅读

- 首版只承诺 Markdown 和可提取文字的 PDF；扫描件可以阅读原页，但 OCR、Word、网页、图片等后续再做。
- 导入时复制原文件到应用数据目录。原路径移动或文件被删除后，应用内资料仍应可阅读。
- 处理重复导入、取消选择、损坏文件、解析失败、磁盘写入失败，明确显示成功、重复与失败数量。
- Markdown 提供长时间阅读排版、标题导航、表格和代码块，按现有测试要求处理不安全 HTML 与远程图片。
- PDF 保留原始页面，提供目录、页码、缩放、护眼、文字选择及来源位置跳转；不要通过纯文本替换原页阅读。
- 每份资料独立保存并恢复阅读位置。位置数据必须校验，不能越页或越界。
- 阅读区已接入可收起的助手/笔记侧栏，复用唯一ChatPage/NotesPage。选文由主进程核对确切原文/锚点/偏移；提问选文最多800字，不截断。原文往返保留位置与窗口内草稿，保存必须用户明确操作。

### 4.2 可追溯的 RAG

- 先检索真实证据，再组织回答；PDF 引用定位到页码，Markdown 引用定位到标题或片段。
- 分块保留文档 ID、页码或标题锚点、引用原文，不能丢失来源后再猜出处。
- 组合 SQLite FTS5 全文检索与本地向量检索，不要求用户部署外部数据库或向量服务。
- 本地嵌入模型独立于聊天模型。云端聊天用户不必因此安装 Ollama；嵌入下载或加载失败时保留关键词检索及阅读。
- 当前 BGE-small 中文 Q8 的版本/文件清单和向量政策集中在 `embedding-model.ts`；替换模型更新清单、缓存标识并跑固定对比和真实桌面门禁，记录中文/CPU/体积/许可证/分发条件。不要把不同模型向量混用，也不提前扩展多模型注册框架。
- 证据不足时说明限制；回答只引用实际取回的资料，不虚构文档、页码或引用。
- 保留固定评测集，包含可回答、跨段落、无法回答的问题。记录指标定义、检索命中率、引用准确性、关键词与混合检索对比及失败案例。
- 简历中的效果数据必须来自可重复运行的真实评测，不填写估计值作为成绩。

### 4.3 学习 Agent、笔记和记忆

新生成的路线learning_request.format为steps-v1（旧JSON无该字段仍读旧Markdown）；ChatService完成前共用learning-plan严格校验2～8步、行动/预期作品/实际引用及总预算，失败status=error且保留原答，不改写/重试/建任务。用户编辑只在窗口保留，所选确认内容进入任务。多步骤复用TaskProposalService同一UUID缓存与PlanningStorage事务，一次确认只收ID，事务内复核来源revision/status/用途及项目快照，整批成功才消费ID，失败回滚、取消零写入。新增prepareTaskBatch/confirmTaskBatch，discard沿用原接口；当前桥接93方法/87请求/6事件。多行JSON编号用结构校验，不能用普通Markdown的编号缺失判断；文字未知编号仍拒绝，编号有效不证明支持关系。

- Agent 是有边界的步骤流程，不是无限循环、自行执行任意系统操作的通用助手。
- 工具范围为资料检索、学习步骤草稿、笔记反馈、任务建议与记忆提议。
- 可以自行检索和起草建议；**新增计划、修改进度、写入长期记忆前必须显示变更预览并让用户确认**。
- 拒绝或取消提议后不改变数据；确认写入应能区分提议内容与最终写入结果。
- 默认学习作品为结构化笔记。用户不调用 AI 也能写笔记、保存与导出 Markdown。
- AI反馈核对有依据的理解、知识缺口与自拟建议；区分用户笔记、资料、规则和AI建议，不自动判断掌握。用户选择保存作答/疑问/手动日期，复习先回忆再看原答案，首轮不扩展复杂间隔复习。
- 长期记忆包括学习轨迹和个人偏好，提供来源、查看、编辑、删除和使用范围；删除后不再参与建议。
- 外部学习资料是证据，不是 Agent 指令；资料内的命令不得改变工具权限或绕过确认。

### 4.4 执行辅助与个性化

专注成果只收用户自述，不把时长作掌握证据；“编辑为笔记／下一项任务”经过唯一 NotesPage/PlanningPage 的脏稿确认，创建窗口内草稿而非自动写入，实际保存沿用原服务。成果按focus记录ID保留本次窗口草稿，关闭/重载可丢；休息提醒默认关、仅本次运行、应用内、只在观察到真实completed结束时提示，可关掉。不自动完成任务、签到、写记忆或请求模型，数据库版本仍v13。

- 以学习项目和每日任务组织目标，番茄钟关联任务，结束后支持简短复盘与打卡。
- 累计学习计时、签到、任务完成、番茄钟是不同的数据与行为，不要混用状态。
- 应用中断、睡眠或长时间无心跳不能被误计为完成的专注时段。
- 清爽现代/安静书房/活泼游戏化三种浅色主题已实现待独立验收，默认modern；主题只改变视觉，必须与回应风格、阅读护眼和真实学习记录分开。
- 回应风格为 `gentle`（温柔陪伴）、`game`（游戏化成长）、`coach`（高效教练），默认 `gentle`。保存后用于新聊天请求的系统提示；实际效果需由真实模型验证。

## 5. 技术栈与选型约束

| 层次 | 当前采用 |
| --- | --- |
| 桌面 | Electron 44.5.1，预编译运行时 |
| 界面 | React / React DOM 19.3.0、TypeScript、Vite 8.3.1 |
| 图标与样式 | `lucide-react`、普通 CSS；布局在 `src/styles.css`，主题配色/选择控件在 `src/themes.css` |
| 桌面构建 | esbuild，主进程与预加载脚本输出 CommonJS |
| Windows 候选包 | electron-builder26.15.3、@electron/asar4.3.1，x64目录/当前用户NSIS，静态检查/来源/摘要，无自动发布 |
| 后台解析 | Electron `utilityProcess` 独立 Node 进程，解析入口输出 ESM；256 MB V8 堆限制、60 秒超时、进度与取消 |
| 后台检索/嵌入 | 独立 `utilityProcess`，只读主库、写派生 FTS5/向量；512 MB V8 堆、5 分钟超时；模型不可用保留关键词 |
| 后台备份/恢复校验 | 固定 `utilityProcess`，SQLite backup API与文件流式复制/哈希；256 MB V8 堆、30 分钟超时，等待退出再清理 |
| 本地嵌入 | Transformers.js 4.3.0 / ONNX Runtime Node 1.30.0，中文 BGE-small Q8，CPU 最多 4 线程，仅校验过的本地文件 |
| 本地数据库 | Electron 内置 Node.js 的 `node:sqlite` / `DatabaseSync` |
| 密钥 | Electron `safeStorage`，Windows DPAPI 系统加密 |
| 模型请求 | 主进程 `fetch`、运行时参数校验、结构化错误 |
| 阅读依赖 | PDF.js 6.3.289、`react-markdown`、`remark-gfm`、`remark-parse`、`unified`、`mdast-util-to-string`；资源本机加载，无 CDN |
| 测试 | Vitest 核心测试；Playwright `_electron` 真实窗口测试 |
| 格式化 | Prettier，单引号，尾逗号，行宽 100 |
| 版本与 CI | Git、GitHub；基础检查 `.github/workflows/check.yml`、手动候选构建 `package-windows.yml`，远端均需实际核对 |

具体安装版本以 `package-lock.json` 为准，依赖范围与脚本以 `package.json` 为准，不凭旧文档猜接口。

2026-09-30 经用户选择，从 Tauri + Rust 改为 Electron + React + TypeScript。理由是集中使用 TypeScript，便于学习、维护与解释项目；接受安装包和内存占用通常较大的代价。当前不要求 Rust 或微软 C++ 构建工具。新增原生依赖前评估是否破坏这个开发与分发约束，优先使用预编译方案。

## 6. 代码目录与职责

| 路径 | 职责与维护入口 |
| --- | --- |
| `src/App.tsx` | 工作台、页面导航、阅读侧栏与跨页目标，不直接操作文件或模型 |
| `src/components/<功能>/` | 按 home/library/reader/chat/notes/agent/memory/planning/focus/reviews/settings/backup/shared 分组；规则见组件目录 README |
| `src/lib/` | 固定桌面桥接、共享类型和纯规则；`useBackupState.ts` 属于界面 hook |
| `electron/main.ts`、`preload.ts` | 应用生命周期、数据位置、原生窗口、权限和固定 IPC；不可暴露任意调用 |
| `electron/core/` | 资料／检索／聊天／学习工作流／存储／备份服务，保留现有文件名前缀 |
| `electron/core/__tests__/` | 后端 Vitest 规格；测试与业务文件分开，断言与 fixtures 保持原意 |
| `electron/*-worker.ts` | 独立资料解析、检索／嵌入和备份入口，构建位置不变 |
| `tests/` | Electron 流程、显式真实模型门禁和合成 fixtures；具体运行方式见测试目录 README |
| `scripts/` | 开发、构建、评测与发行工具；`licenses/` 中固定许可字节不可格式化或随意迁移 |
| `docs/` | 使用指南、架构地图、测试／发布报告及历史归档；先查文档索引 |
| `electron-builder.json`、`.github/` | Windows 分发与 CI 配置，入口路径按工具约定保留根目录 |
| `打开拾知（本地最新版）.cmd` | 本地双击入口，默认 `user-data/local-preview/`，代码更新后先关闭旧窗口 |

更具体的组件归属、业务服务与数据流见 [前端](docs/CODEMAPS/frontend.md)、[主进程](docs/CODEMAPS/backend.md)、[数据](docs/CODEMAPS/data.md)和[依赖／构建](docs/CODEMAPS/dependencies.md)地图。目录分组本身不引入新的运行时分层或依赖注入框架。

## 7. 进程、接口与错误边界

调用链：**React 界面 → `src/lib/desktop.ts` → `window.studyCompanion` → preload → IPC → 主进程业务模块 → 文件/SQLite/模型服务。**

- 首页TodayTasks复用planningOverview只读，按本机日期显示完整数量/前5项（待完成优先），明确预计分钟与手动状态，不写任务/计时/签到。挂载/恢复/手动刷新/日期变化读取；30秒定时只检查日期，不持续查询DB，effect清理拒迟到/离页结果，备份非idle暂停。任务点击跨日先刷新，计划/专注目标重读实际记录。HomeStudyFlow只是推荐步骤导航及已保存模型说明，无模型检测/生成/新建或掌握推断。
- PlanningPage的内部PlanningTarget为day/task与单个递增sequence；最新入站先于自动旧日期刷新，open-day和open-task复用实际读取/版本/脏稿确认，成功再应用日期/清filter/编辑器。普通侧栏保留原草稿，取消保留当前编辑；不新增桌面桥接或主进程工具权限。首页按钮移除后且activeElement为body时才focus主区，不抢目标页主动控件/确认的焦点，也不改首次Tab起点。
- 主进程承担有权限的本地操作；React 不直接访问文件系统、SQLite 或系统密钥，也不直接请求模型服务。
- 保持 `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`，不要为方便读取资料而解除隔离。
- preload 只暴露具体方法，不能提供任意频道调用、任意 SQL、任意路径读取或系统命令执行入口。
- IPC 校验调用来自本应用的主窗口和主 frame；开发 URL 与生产文件 URL 需分别正确识别。同一文档的锚点跳转不应破坏合法调用。
- 外部导航、新窗口和权限申请目前默认阻止。新增资料链接行为时明确设计，不直接把不可信内容放进有桥接能力的应用窗口。
- CSP 在 `index.html` / `vite.config.ts` 中维护，区分开发预加载与生产脚本限制。不要通过无限放宽 CSP 解决 PDF worker 或 Markdown 内容问题。
- TypeScript 类型不能替代 IPC 的运行时校验。对界面、外部响应、数据库恢复等输入在边界校验。
- IPC 返回 `Reply<T>`：成功值或结构化错误。preload 的 `call` 解包 `value`、失败时抛出 `error`，renderer 的 `DesktopApi` 返回成功值，不直接返回 Reply；测试取消/失败须捕获 Promise 错误。
- 失败不伪装成成功或空数据；不在错误文本、日志或截图中输出密钥及包含密钥的地址。
- 文件解析用独立进程，显示进度并允许取消；不要改回强制终止线程，曾观测到 Node 压缩组件崩溃。后续索引与嵌入也需避免阻塞主窗口。独立进程只隔离崩溃，不等于操作系统文件权限沙箱，V8 堆限额不等于总内存限额。

已有稳定方法：`bootstrap`、`saveSettings`、`storeApiKey`、`removeApiKey`、`hasApiKey`、`checkConnection`、`studyOverview`、`checkIn`、`setStudyRunning`。学习接口只允许读取月份、签到今天和切换计时状态，不接受界面传入日期或累计时长。新增方法同步修改共享类型、preload、主进程处理器与界面封装，不只添加前端按钮。

资料方法：`listSources`、`importSources`、`cancelImport`、`onImportProgress`、`openSource`、`saveReadingPosition`、`copyCitation`。界面只能提供校验过的 SHA-256 资料 ID 和受限位置，导入路径由主进程原生对话框选择；不暴露任意路径、任意频道或剪贴板读取。preload 将进度事件只转换为数据，返回取消监听函数。

聊天方法：`listConversations`、`createConversation`、`getConversation`、`sendChat`、`stopChat`、`activeChat`、`onChatUpdate`。请求只接受会话 UUID、问题、目标确认地址、模型配置签名和可选 `retrievalId`；实际设置、密钥、预览在主进程读取，界面不能传消息角色、系统提示或自造证据。`onChatUpdate` 只传轮次并提供取消监听；`revision` 单调增加，旧事件不得覆盖新文本/终止状态。页面切换时组件保持挂载；全应用只有一个活动模型请求。

历史方法：`previewHistory({ kind, id })`、`renameConversation(id, version, title)`、`deleteHistory(target, version)`、`exportHistory(target, version)`。kind只有conversation/learning；version由主进程对完整保存内容生成，不能把renderer回传的标题/答案/证据当预览。操作复核用途与目标无活动生成；删除必须主进程原生默认取消确认并再次verify。删除来源不级联任务/记忆，缺失来源允许导出/备份。导出只有原生选址路径，返回取消/文件名，不暴露路径。新的数据库写入入口应维护历史锁和快照核对；重启恢复后UI删除tombstone重新建立，不持久污染恢复的历史。

检索方法：`prepareQuestion(question, sourceId | null)`、`cancelRetrieval`、`rebuildIndex`、`onRetrievalProgress`、`resolveCitation(turnId, number)`。只接受受限问题、资料哈希、保存轮次 UUID 和整数编号；主进程持有实际范围/片段，缓存上限 10 份、10 分钟有效，问题变化须重新检索。取消只结束索引子进程，不修改原资料/主库；新索引完成后同步原子替换旧文件。引用解析从保存轮次查证，不接受 renderer 提供路径、锚点或原文。进度订阅只传数据并返回取消监听函数。

本地模型方法：`embeddingStatus`、`downloadEmbedding`、`cancelEmbeddingDownload`、`onEmbeddingProgress`。不接受地址、路径、模型 ID 或资料；下载主进程固定的公开模型，使用 Electron 系统网络配置，公开 CDN 可重定向，逐文件校验，无聊天密钥。一次下载、15 分钟上限、不续传；全部就绪后替换，取消不破坏旧副本。`rebuildIndex` 现在返回说明字符串，包括语义降级；不能收到成功就宣称向量完整建立。模型候选路径由主进程给后台，后台再次核对摘要。

笔记方法：`listNotes`、`getNote`、`saveNote`、`deleteNote`、`exportNote`、`setNoteDraftDirty`、`onShowNotes`。只接受 UUID、校验过的四部分/标题/来源 ID 和 revision，不接受导出路径。新笔记为 `id = null, revision = 0`，已有笔记须匹配保存版本；标题/正文在主进程校验，SQL 参数化。导出主进程读取已保存内容与来源名、显示 native 保存对话框，只允许 `.md`，校验目录链接后禁止应用数据目录，暂存完成后替换目标。正常关闭时 dirty 笔记默认继续编辑，明确放弃才能退出；事件只通知回笔记，不暴露 Electron event。Agent 不得借这些接口默认修改用户笔记。

反馈方法：`listNoteFeedback(noteId)`、`prepareNoteFeedback(noteId, revision, question)`、`sendNoteFeedback({ retrievalId, expectedProfile, consentEndpoint? })`。范围来自保存笔记关联资料，未关联则全库；不接受自造正文/证据/角色/路径。预览核对检索期间与发送时版本，确认绑定实际配置/预览。复用停止/进度/更新/引用，无任意工具入口。`ChatService.send` 可信第二参数为主进程判别联合 `{ kind: 'note', note } | { kind: 'learning', request, memories } | { kind: 'practice', request }`，不能桥接。专用会话不进入普通列表/get/send，ChatPage只显示活动状态。

路线方法：`listLearningDrafts()`、`prepareLearningDraft({ goal, query, sourceId, minutes }, memoryIds?)`、`sendLearningDraft({ retrievalId, expectedProfile, consentEndpoint? })`。运行时限制字段/文本/来源/预算与最多5条记忆ID；请求/证据/记忆只从主进程预览读。输入/范围/预算/记忆/模型变化重新准备，成功send后预览不可重用；空证据不调用模型。提示只含本次目标/时间/检索词/片段/所选记忆，无旧历史/笔记/日历。主进程绑定实际模型签名并核对记忆范围，不能仅靠renderer checkbox保证隐私。停止/进度/更新/引用共用，新笔记仅导航。

练习方法：`preparePractice({kind,topic,sourceId})`、`sendPractice({conversationId,retrievalId,expectedProfile,consentEndpoint?})`。主进程只缓存自身检索的确切请求/证据及模型签名，10份/10分钟，发送复核且成功才消费；不收renderer提示/答案/工具。普通chat用途允许sources练习，反馈/路线用途拒绝，普通上下文排除。界面撤销配置/输入/范围/类型/会话变化的旧预览与同意，取消与迟到成功按searchVersion失效；独立inFlight/cancelPending保证操作收口前不新开检索。主缓存未消费时仍仅代表其原请求，不声称所有界面编辑都广播删除缓存。空证据只保存本地说明；共用单活动模型管线/停止/500ms保存/恢复，完整三项结构通过才completed。

记忆方法：`listMemories()`、`saveMemory({ id, revision, title, content, kind, scope })`、`deleteMemory(id, revision)`、`prepareMemoryProposal(turnId, edit?)`、`confirmMemoryProposal(proposalId)`、`discardMemoryProposal(proposalId)`。手动创建来源manual，编辑保留来源、不接受origin字段。提议edit只允许title/content/scope，最终内容/来源由主进程缓存；确认只收UUID，同步复核/写入后消费，取消/过期/重复不写。提议不是模型工具调用，已发送数据不能通过取消或删除撤回。

计划方法：`planningOverview(day)`、`saveStudyProject({ id, revision, title, goal, archived })`、`saveDailyTask({ id, revision, title, details, projectId, day, minutes })`、`setDailyTaskCompleted(id, revision, completed)`、`deleteDailyTask(id, revision)`。overview取指定日期任务及全部项目；新记录id=null/revision=0，已有须版本匹配，未知字段拒绝。安排日期可由用户指定，和只能签到今天/不接日期时长的活动接口分开；completed必须boolean，不接受伪造来源/状态/时间。手动CRUD只由用户操作，Agent不接任意CRUD工具。

任务提议方法：`prepareTaskProposal(turnId, { day, projectId, edit?: { title, details, minutes } })`、`confirmTaskProposal(id)`、`discardTaskProposal(id)`。只接受受限字段、实际路线UUID与用户日期/项目选择，不收模型角色、来源版本/状态/完整项目快照。主进程读取来源及项目，缓存10份/10分钟的最终内容，确认只收UUID；同步复核并事务新增todo后消费。拒绝/过期/重复不写，修改重新预览，同路线新预览使旧ID失效；确认已发出不能靠切页撤回。实际成功结果供刷新/查看，跨重启预览无效，响应丢失不自动重发。

专注方法：`focusOverview()`、`getFocusSession(id)`、`startFocus({taskId,taskRevision,minutes})`、`controlFocus(id,revision,action)`、`saveFocusReview(id,revision,review)`。仅实际保存todo/版本匹配可开始，action为pause/resume/stop；来源/时间/elapsed/状态/原因由主进程生成，不接受renderer自造。elapsed心跳不增控制revision，状态/复盘才增；有活动/未修复故障禁止新轮。读/控制返回实际FocusOverview与递增version，单条读取返回实际FocusSession，复盘返回FocusReviewResult{session,overview}供确认成功和恢复核对，不把读取或选择当开始/完成/签到。

历史方法：`focusHistory({day, page})`，只有显式day(null或合法YYYY-MM-DD)/page(当前整数1～500)，固定historyPageSize=20，返回FocusHistoryPage的实际day/page/pageSize/total/sessions。主进程有界扫描终态ID/规范startedAt，按真实时刻与ID排序/按当前设备日期筛选，完整解码最多20条；不发SQL/limit/renderer时间、不调用tracker.overview或写记录。分页为每次读取快照，不能声称跨请求冻结或保存开始时原时区；列表刷新不覆盖筛选输入/父页旧复盘，详情按ID再次读取并沿用原revision/脏稿确认。新增接口后测试方补精确preload列表断言。

备份方法：`backupState()`、`exportBackup()`、`inspectBackup()`、`confirmRestore(id)`、`discardRestore(id)`、`cancelBackup()`、`onBackupUpdate(listener)`。选址/原生确认由主进程做，恢复只接本进程缓存UUID；不接路径、清单、数据库正文或新数据位置。处理时普通IPC全部拒绝，只允许backup-state/cancel-backup；业务必须空闲，focus暂停也不能开始备份。状态带revision，界面早到/迟到事件按版本合并；不能把pending准备当已恢复成功。预览期限在确认入口、原生批准后和文件校验后/commit前复核，expiresAt <= 当前时间即拒绝，不延长期限。最终commit/restart不取消，也不因随后到期撤销；失败或丢失应答先读取实际状态；事件只传数据并返回取消监听。正常退出清理未确认预览不能受计时/模型busy阻止，清理失败明确报告且不中断已确认结果。

## 8. 本地数据、迁移与密钥

默认应用数据根目录：`%APPDATA%\StudyCompanion\`。首次学习数据也在根目录；恢复后 `active-learning.json` 指向 `learning-restores/UUID/`，两库、sources及派生索引使用该目录，密钥/本机模型始终用根目录。路径来自主进程并用realpath/lstat校验，不让源码依赖本机绝对路径。以下库/资料路径相对于当前学习目录，密钥/模型和位置记录相对于根目录。

| 文件或目录 | 内容与约束 |
| --- | --- |
| `study-companion.sqlite3` | 当前主库v13：原学习记录及选择保存的practice_reviews；真实历史DDL迁移/备份和条件更新有本轮验收，旧包仍按原版本 |
| `study-activity.sqlite3` | 已验收的独立学习活动数据库，版本 1、`study_days` 表；备份须与主库一同导出 |
| `search-index.sqlite3` | 关键词版 v1；首次向量使用事务升级 v2，新增 `chunk_vectors`/`embedded_sources`，可重建、不代替原文 |
| `embedding-models/` | 固定版本模型/配置与下载暂存；摘要校验，只是可重新下载缓存，不进 Git/学习备份 |
| `search-index.*.sqlite3` | 重建暂存索引，成功才替换旧文件；取消/失败尽力清理，Windows 文件锁可能留下可丢弃的派生暂存 |
| `sources/` | 内容 SHA-256 命名的 `.pdf`/`.md` 副本；不修改原件；打开前核对内容哈希 |
| `study-companion.sqlite3.before-v2-*.sqlite3` | 版本 1 升级前的 SQLite 一致性备份；备份失败不继续迁移，不自动删除 |
| `study-companion.sqlite3.before-v3-*.sqlite3` | 版本 2 升级前的 SQLite 一致性备份，包含资料/段落/位置与设置；不自动删除 |
| `study-companion.sqlite3.before-v4-*.sqlite3` | 版本 3 升级前的完整主库备份，包括旧聊天与阅读；不自动删除 |
| `study-companion.sqlite3.before-v5-*.sqlite3` | 版本 4 增加笔记前的一致性主库备份；失败不继续迁移，不自动删除 |
| `study-companion.sqlite3.before-v6-*.sqlite3` | 版本 5 增加反馈关联/快照前的一致性主库备份；失败不继续迁移，不自动删除 |
| `study-companion.sqlite3.before-v7-*.sqlite3` | 版本 6 增加会话用途/路线请求前的一致性主库备份；失败不继续迁移，不自动删除 |
| `study-companion.sqlite3.before-v8-*.sqlite3` | 版本7增加记忆/所选快照前的一致性主库备份；失败不继续迁移，不自动删除 |
| `study-companion.sqlite3.before-v9-*.sqlite3` | 版本8增加项目/任务前的一致性主库备份；失败不继续迁移，不自动删除 |
| `study-companion.sqlite3.before-v10-*.sqlite3` | 版本9增加任务来源前的一致性主库备份；失败不继续迁移，不自动删除 |
| `study-companion.sqlite3.before-v11-*.sqlite3` | 版本10增加专注记录前的一致性主库备份；失败不继续迁移，不自动删除 |
| `study-companion.sqlite3.before-v12-*.sqlite3` | 版本11增加练习请求前的一致性主库备份；失败不继续迁移，不自动删除 |
| `study-companion.sqlite3.before-v13-*.sqlite3` | v12增加保存作答前的一致性备份；失败不继续升级，不自动清理 |

| `credentials.enc.json` | 独立密钥密文文件，按规范化地址的 SHA-256 键索引，不是学习备份内容 |
| `active-learning.json`、`pending-restore.json` | 当前学习位置与等待启动的恢复记录；JSON最多4096字节、严格字段/UUID，临时写入flush后rename，不等于备份正文 |
| `before-restore-UUID.json` | 准确旧active对象或null，结合保留的旧目录供退出应用后的手动回退；不可在运行中修改 |
| `learning-restores/UUID/` | 恢复隔离副本，校验与候选库成功打开后成为活动学习目录；拒绝链接/硬链接，不自动清理旧数据 |
| 外部 `拾知备份-时间-标识/` | format1严格核对真实主库12/13、活动1；v12作答数0，候选前向迁移成功才切位置。十类数量；未加密，不含密钥/模型/索引 |

数据库规则：

- 使用参数化 SQL，不拼接用户输入到查询语句。
- 迁移使用事务，保持已存数据，不删除个人数据库来解决版本问题。
- 当前迁移只有前向升级，无逆向迁移/自动恢复；不通过手改user_version降级。故障恢复先关闭应用、保留完整当前数据，再核对一致性备份与兼容应用版本；旧备份不含升级后的新记录。独立验收验证备份可读与回滚，不能在主线运行个人库恢复。
- 拒绝用旧版本应用打开更新的数据格式；损坏设置应报错，不能悄悄重置成默认值。
- 启动探测 FTS5；首次检索才增量建派生索引。DDL 与内容写入用事务，重建在新文件完成；不可直接重建主库。源文字不可变，新哈希成为新资料。
- 未来迁移先读保留/备份规格，不能把版本12当空库重建。旧断言/桥接清单交测试方同步；降user_version模拟旧格式须还原真实结构，包含v5表、v6列/索引/外键、v7用途/快照/部分索引，低于v8时去掉记忆表/列/索引、低于v9时去掉项目/任务表/索引、v9夹具去掉v10来源列/约束、v10及更低夹具去掉v11专注表/索引，v11及更低夹具去掉v12 practice_request列/约束，不用IF NOT EXISTS掩盖错误夹具。
- 当前跨进程类型在src/lib/types.ts；主库v13、活动v1、派生v2。练习请求与已保存作答、选择编辑的LearningPlan/Step及TaskBatchProposal复用现有服务，接口/版本与验收只按源码和README当前表核对，不能把早期“待测试”当当前结论。
- 偏好JSON中的theme只接受modern/study/playful，缺字段旧数据补modern但不自动回写；已有非法值报错，不连同其他设置重置。与responseStyle独立，沿用saveSettings/Storage及备份校验，无schema迁移。软件回退可能不识别新增字段，先保留完整数据；不要为单个可兼容的JSON偏好升级表或手改版本号。
- `notes` 保存 UUID、来源哈希、标题/四部分、revision 与创建/更新时间；关联来源采用外键，未来删除来源先设计笔记关联处理，不默默级联删除作品。导出读取保存快照，选址期间版本改变要拒绝导出。删除有确认、无回收站；原文依据为手动文字，不是可信检索证据。
- v6 的 `conversations.note_id` 唯一且可空；普通/路线会话为 NULL，非空关联笔记并 `ON DELETE CASCADE`。`chat_turns.note_snapshot` 可空 JSON，按笔记边界运行时校验；不扩展旧 mode 的 CHECK，反馈仍 sources，普通旧轮次不伪装成反馈。删除笔记会连同其会话/轮次删除，主进程先拒绝活动反馈；删除来源仍不能静默删作品。
- v7 的 `purpose` 明确三用途，普通列表/读取/发送仅 chat，反馈和路线各有主进程专用 getter；部分唯一索引限制单一路线会话。`learning_request` 非空必须有效 JSON、与 note_snapshot 互斥且 mode=sources，恢复复用输入校验。路线请求保存稳定来源 ID，不依赖后续用户表单，不向模型发送旧路线或推断已完成学习。用途权限不得改回一个绕过全部隔离的布尔值。
- v8 `memories` 保存UUID、title/content/kind/scope、不可由renderer指定的origin/origin_turn_id、revision与时间。来源轮次ID是溯源标识，不级联删除记忆或回填当前内容。`learning_memories`非NULL须依附learning_request且经恢复校验最多5条；旧NULL不读当前表回填。历史只查看、不进新提示；删除阻止后续选择/缓存使用，既往快照/备份保留。
- v9 `study_projects` 保存标题/目标/archived/revision/时间，`daily_tasks` 保存内容、project_id可空RESTRICT外键、安排日期/预计分钟、status/完成时刻与revision/时间。CHECK约束todo对应NULL、completed对应非NULL；归档不删除历史任务。普通save保留完成状态，另存创建todo；完成只表示用户标记，无实际时长或知识证明。
- v10 `daily_tasks` 新增origin/manual或learning-route、origin_turn_id、origin_turn_revision；manual必须双NULL，路线必须UUID/有效正版本，SQL组合约束及恢复校验同时维护。旧行manual，新手动/另存manual，编辑不接来源。来源不设轮次外键或级联，缺失来源不删除任务。确认创建用BEGIN IMMEDIATE复核完整项目快照/归档与总数并插入；失败回滚，不拿预览当已保存结果，不使用任务来源或完成状态作为模型新上下文。
- v11 focus_sessions保存任务ID/revision/标题/日期快照、预算/实际elapsed、状态/终止原因、复盘及自身revision/时间。taskId为溯源标识不级联，只有一个running/paused，恢复中断旧活动。正常心跳计满与睡眠/故障/退出中断分开；复盘不改状态/时长/任务。不要将专注加入首页study_ms，否则同时开启会重复计时；完整备份包含主库专注，排除密钥。
- v12 practice_request可空JSON，非空必须sources且与笔记/路线/记忆快照互斥，旧行NULL不改写。仅普通purpose=chat会话可有练习；ChatStorage与备份恢复同步验用途。请求kind/topic/sourceId共用运行时校验，completed且有证据需共享严格三项/真实编号解析；停止/失败/中断保留原文。旧completed/sources/空证据说明可能revision=0，备份仅此窄例外接受，新终态写revision=1，其余零版本拒绝。
- 完整备份是独立功能，不是仅主库的迁移前备份。业务暂停写入时SQLite backup API生成两库一致性快照、保留rowid；清单最后写。严格校验全sqlite_schema、版本/quick_check/外键、运行时记录与九类数量，不执行外部schema。每库2GiB/总50GiB/资料10000份/清单3MiB，资料仍受导入限额；复制分块256KiB、fsync，取消先等worker退出。散列只核对完整性，不证明来源可信。
- `schemaDefinition()` 仅主进程/固定worker用于备份的当前schema对照，不暴露给renderer。当前format1仅支持主库12/活动1；旧11/1文件夹由对应旧版在隔离环境恢复再升级，直接打开旧学习目录能迁移不代表恢复包兼容。未来数据库迁移必须同步备份版本/结构兼容政策与验收，不能只改backupLimits版本号来绕过校验或假称旧包兼容。已保存阅读位置只允许page/anchor/offset/zoom/tone五键，证据JSON须完整校验，不让成功恢复后正常读取/保存崩溃。
- 恢复前再次验证隔离副本，原子pending为确认消费边界；启动先校验/打开候选两库，再保存准确旧active并原子切换。active提交成功后不能按旧位置初始化Files/Search；剩余pending与active同ID只清理，不重复。切换前失败保留旧目录且隔离pending，当前位置损坏/库缺失拒绝空库fallback。只能删除本次未活动/未等待的UUID子目录，不能递归移除根目录、用户选择父目录或历史活动目录。强退遗留和旧目录不自动删，手动回退见README。
- 聊天轮次状态为 `streaming/completed/stopped/error/interrupted`，保存部分回答与错误提示。主进程退出先取消聊天并保存，再关库；重启将残留的 streaming 标记为 interrupted。保存失败须向界面报告，不能冒充成功。单会话限 100 轮、会话总数限 500，未来会话管理/清理需保留恢复边界。
- 来源锚点为 `page-N` 或 `md-line-N`，绑定内容哈希。资料问答轮次保存证据编号、资料名/类型、标题/页码/行号、UTF-16 偏移与原文；打开核对保存原文、元数据和副本哈希，不猜位置。复制 URI 尚未注册系统协议；应用内引用编号走受限 IPC，不依赖系统协议。
- 当前分块最多800字符、重叠120，不拆代理对；中文分词/汉字二元词入FTS5。查询最多24个非停用词、BM25前40候选、最多4片段。普通候选须整问至少50%字面覆盖；有限比较/并列形式按主题50%覆盖保留最佳代表、标题优先，主题有独有词时还须命中独有词，不能只靠共有词认领另一侧。额外候选仍须整问门槛；近邻去重不能丢失新增未覆盖主题，非比较沿用原去重。启发式不是通用拆题/充分性保证，调整保留固定评测失败与精度、不可答/范围回归。
- 向量窗口 384/重叠 64、标题最多 64、批次 8；BGE CLS/归一化/查询指令，禁止静默 token 截断。长问题分窗口并平均。模型标识包括权重 revision、维数、池化、指令、窗口/标题政策和运行时；阈值调整不要求重做同一编码，输入政策变化必须换缓存标识。向量主键是模型/来源/锚点/偏移，不使用易变化的 FTS rowid。
- 逐批事务提交，来源全部编码后才标记完成，取消后的增量任务可恢复；重建仍用新文件。线性余弦扫描当前模型；全局门槛 0.6，关键词支持资料内门槛 0.5，RRF 常数 60，最多 4 个去重片段。不混用模型，不自动切换云服务，不把门槛当证据充分概率。只有嵌入错误降级；SQL/磁盘失败仍报错。
- 导入上限：20 文件/批；PDF 50 MB、1000 页、500 万提取字符；Markdown 5 MB、UTF-8；60 秒/文件。Markdown 原始 HTML/脚本和全部图片不加载，外链不自动打开。扫描件仅原页；密码 PDF 先解锁。新格式与更高限额先评估体验和内存。
- PDF.js 对 utility 类型的 Node 识别需要 `document-worker.ts` 的进程内兼容提示；只影响解析子进程。升级 PDF.js/Electron 时实测此入口、资源路径、取消与正常打开，不能只运行 Node 单元测试。
- 学习日历用本地日历日期，存储毫秒、对外展示秒；计时使用单调时钟，跨日分配，超过 30 秒心跳缺失视为中断。每秒保存；退出或睡眠时暂停，重启不自动计时。异常退出可能丢失最后约一秒。这些是累计计时的历史专项验证；当前任务完成与番茄钟另有实现及独立待验收清单，不继承此前通过结果。

密钥规则：

- 只在主进程加解密。用户输入时可临时通过桥接传递，保存后清空输入框；不把已保存密钥回传界面。
- `safeStorage` 不可用时拒绝保存，不降级为明文。
- 密钥按规范化服务地址绑定，地址改变时不得将另一地址的密钥发过去。
- 密文由 Windows 账户保护，不是跨机器通用备份；完整导出排除密钥及密文临时文件，恢复保持根目录密钥不变。
- 密文丢失或损坏、账户不匹配要给出明确反馈，不把损坏文件静默覆盖为空配置。

开发/测试专用环境变量：`STUDY_COMPANION_DATA_DIR` 指定隔离的数据目录，`STUDY_COMPANION_DEV_URL` 目前仅接受 `http://127.0.0.1:1420`；打包模式不使用这些覆盖。不要将测试路径或开发服务写进生产分发配置。正式包安装/启动验收使用独立Windows用户或可恢复VM，使用该用户的APPDATA；不能靠临时环境变量在个人用户下试错，也不为测试放开正式包的数据目录覆盖。

## 9. 模型配置与网络行为

- 默认 `provider = ollama`，地址 `http://127.0.0.1:11434`，模型名为空，由用户检测后选择。
- 云端默认地址 `https://api.openai.com/v1` 只是可修改的初始值，不是开发者承担费用的内置服务。
- Ollama 检测请求基础地址加 `/api/tags`；兼容 OpenAI 检测请求基础地址加 `/models`，保留用户基础路径，如 `/v1`。
- 仅兼容 OpenAI 的请求携带其对应密钥；不要把云端密钥发给 Ollama。
- 模型列表检测超时 15 秒、响应上限 2 MiB。聊天使用 Ollama `/api/chat` 或兼容接口 `/chat/completions`；两类请求均禁止重定向。
- 聊天连续 120 秒无网络数据、总时长 10 分钟、总响应 8 MiB、单行/事件数据缓冲 1048576 字符、答案 64000 字符设有边界。未收到正常结束标记就断流时保留文本并报错；空回答报错；长度截断须明确提示。停止后拒收迟到文本，但不能保证远端服务立即停止计算/计费。
- 单问题限 4000 字符。普通聊天最多最近 6 轮已完成普通问答、历史不超 12000 字符，资料/失败/停止/中断轮次不进入普通上下文。资料问答每次独立检索，无旧历史。预算不是精确 token 数，不自动重试或切换服务。
- 普通远程聊天确认发送问题/近期会话；资料问答确认当前问题/预览片段，界面绑定地址、模型、接口与预览 ID，主进程复核配置与缓存预览。只发送实际片段，不上传整库/文件；空证据不发请求或读密钥。编号验证只能确认出处存在，不能保证每句结论被证据支持，未知或缺少编号需提示核对。
- 远程服务使用 HTTPS；`localhost`、`127.0.0.1`、`[::1]` 的本机服务允许 HTTP。
- 基础地址拒绝嵌入账号密码、查询参数和片段，避免混入密钥。
- 保留鉴权、地址、限流/额度、服务错误、不可达、超时、格式错误的区别；模型不在列表时明确说明，不报生成成功。
- 模拟服务能验证协议与错误路径，不能代替真实模型生成、服务商兼容性、费用或 RAG 质量验证。
- 代理仅作本机临时配置，不把某台机器的代理端口提交进仓库。安装下载所用代理不能意外影响本机测试服务；需要时仅对下载进程设置，并正确绕过回环地址。

## 10. 环境、启动与构建命令

开发需要 Windows、Node.js 24.16 或更新的受支持版本、npm 和 Git。依赖由 `package-lock.json` 锁定，使用 npm，不额外维护第二套包管理器锁文件。

首次安装与开发启动：

```powershell
npm ci
node node_modules/electron/install.js
npm run desktop:dev
```

构建后启动：

```powershell
npm run desktop:build
npm run desktop:start
```

命令范围：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 端口 1420 的 Vite 浏览器预览；没有桌面桥接，不能保存本地设置或检测模型 |
| `npm run desktop:dev` | 先构建 Electron 代码，再启动 Vite 与真实桌面窗口 |
| `npm run typecheck` | 检查界面与 Electron/测试的 TypeScript 类型 |
| `npm run build` | 类型检查与 Vite 界面生产构建 |
| `npm run build:electron` | 生成 main/preload 及解析/检索/备份 worker；检索运行时依赖留在 node_modules，不把原生库打包进 JS |
| `npm run desktop:build` | 构建界面和 Electron 代码，尚不生成安装包 |
| `npm run desktop:pack` | 先生产构建，再Windows x64目录候选/包检查/全部运行文件SHA-256；不启动应用 |
| `npm run desktop:dist` | 先生产构建，再Windows x64 NSIS候选/包检查/安装器SHA-256；不安装/启动/发布 |
| `node --test scripts/package-notices.test.mjs` | 纯文件许可生成规格，不运行应用/SQLite/模型；不代表法律或安装验收 |
| `node scripts/prepare-installation-acceptance.mjs --previous <NSIS目录> --current <NSIS目录>` | 核对两候选并生成离线Sandbox材料；替换占位路径，不自动启动或安装 |
| `npm run desktop:start` | 打开已经构建的桌面版本，不自动构建 |
| `打开拾知（本地最新版）.cmd` | 根目录双击入口；先构建当前源码再打开桌面，默认使用被忽略的 `user-data/local-preview/` 体验数据，不自动下载或安装；已有本地窗口需先关闭 |
| `npm run preview` | Vite 构建产物的浏览器预览 |
| `npm run format:check` | 检查项目配置、源码和测试的格式 |
| `npm run format` | 批量格式化；工作区有他人改动时优先只格式化自己的文件 |
| `npm test` | 当前所有 Vitest 核心测试，可能包含正在开发的 RED 规格 |
| `npm run eval:retrieval` | 6 份合成资料/15 固定问题的关键词检索评测；不调用模型、不读个人资料，报告保留未完整命中项 |
| `npm run model:download` | 下载校验开发评测权重至 `artifacts/embedding-model`，与用户数据独立 |
| `npm run eval:hybrid` | 同一固定题的真实 BGE 对比，缺权重时报错，无聊天/云 API，发生降级返回非零 |
| `npm run test:embedding` | 构建后、已有开发权重时运行独立真实 CPU/Electron 门禁，不自动下载 |
| `npm run test:e2e` | 完整桌面构建与常规 Playwright 测试；真实权重门禁单独执行，属于阶段/发布回归 |

React 界面支持热更新；修改 `electron/` 或 preload 后重启桌面开发命令。Electron 首次下载失败时检查网络，使用官方安装方式重试，不默认安装 C++ 工具或换框架。Vite 端口固定且严格占用，发生冲突时确认进程归属，不结束无关程序。

## 11. 验证方法与测试要求

**当前分工以用户本轮要求为准。** 安装验收只能在真实独立 Windows 用户／VM／Sandbox 中进行，不使用个人 APPDATA 或仅改环境变量。先读对应最新报告，只复验当前改动影响的路径；不借旧测试数量或历史分工扩大本轮任务。

日常开发以当前功能的基础验证为准，选择最小但有效的检查。纯文档改动核对事实、路径、命令和 diff 即可，不启动桌面或完整测试。与代码无关的已有 RED 规格要记录，不借文档任务扩大范围修复。

相关测试示例：

```powershell
npx vitest run electron/core/__tests__/models.test.ts
npx vitest run electron/core/__tests__/storage.test.ts
npx vitest run electron/core/__tests__/credentials.test.ts
npx vitest run electron/core/__tests__/document-storage.test.ts
npx vitest run electron/core/__tests__/documents.test.ts
npx vitest run src/lib/calendar.test.ts electron/core/__tests__/study.test.ts
npx vitest run electron/core/__tests__/chat.test.ts electron/core/__tests__/chat-stream.test.ts
npx vitest run electron/core/__tests__/retrieval.test.ts electron/core/__tests__/search.test.ts electron/core/__tests__/rag.test.ts src/lib/citations.test.ts
npm run eval:retrieval
npm run desktop:build
npx playwright test tests/reading.spec.ts
npx playwright test tests/calendar.spec.ts
npx playwright test tests/chat.spec.ts
npx playwright test tests/rag.spec.ts
```

按改动选择执行，不把上面全部命令当成每次提交的强制清单。阶段验收、发布前或用户明确要求时，再执行格式检查、核心测试、完整桌面流程与对应异常路径。

- 测试用临时数据目录和可生成的资料，不能访问或清空用户真实数据目录。
- 模型协议测试使用本机模拟服务和假密钥，不默认调用付费 API。
- 桌面界面用 Playwright Electron 验证，浏览器预览不能证明 IPC、本地保存或 Windows 加密可用。
- 优先测试迁移保留、阅读位置、引用锚点、检索评测、Agent 确认边界、计时中断和备份往返。
- 不为覆盖率写只重复实现的测试；不默默跳过、削弱断言或将失败记录为成功。
- 当前 `tests/reading.spec.ts` 已通过真实桌面验收；修改解析入口、资源路径或迁移时执行相关测试，不能以只在浏览器显示正常代替验收。
- 新增接口后检查现有桌面测试中对桥接方法列表的断言是否需要同步，保持隔离范围明确。测试 renderer 方法用 preload 解包后的值/结构化异常，不假设它返回原始 IPC Reply。
- 检索评测只测标注锚点，关键词模式不调用模型，混合模式使用真实本地 BGE；未完整命中不会使评测退出非零，嵌入降级则失败。不能把退出码 0 当每题通过，也不能把参与开发的 15 题当独立测试集。真实回答/引用语义质量仍待评测。真实权重门禁单独执行，普通 e2e 不自动联网获取模型。
- 测试截图与 trace 放在已忽略的产物目录；失败时报告具体未通过的功能和影响。
- GitHub Actions 配置存在不等于远端通过，推送后才会触发相应流程；不要为了验证 CI 自行突破推送约定。

## 12. 视觉、可访问性与性能

- 保持清爽、安静、适合反复使用的学习工作台；界面优先展示真实的学习操作。
- 中文文案简单清楚，错误消息说明恢复办法；产品界面不堆放无助于用户决策的技术实现细节。
- 不把规划中的按钮伪装成可用功能，不用假资料、假进度、假签到充当真实数据。
- 控件提供标签、可见焦点、键盘路径及状态提示；页面切换回到合理的阅读位置。
- 在当前最小窗口 900 × 640 下检查可操作性、文本换行和滚动，后续主题也检查对比度与缩放。
- 配色统一修改themes.css语义变量，默认modern依靠原色回退；新组件使用已有surface/line/accent/muted及语义槽，不能引入未定义槽或复制三份页面CSS。阅读正文/护眼、PDF原页及错误/删除等语义色有独立政策；改主题须核对，不能给危险确认按钮套普通accent。静态色值比率不证明全界面WCAG通过，真实界面另验。
- 适配减少动画偏好；大文件、后台索引及模型推理不阻塞阅读、计时与取消操作。
- 新增依赖先复用已有组件和模块，避免仅为视觉修饰引入复杂框架。

## 13. 后续阶段与完成标准

当前交付与未发布维护状态以 README、实际 Git 和对应报告为准。首版允许明确标识的未签名 NSIS，可信签名／SignPath／Store 不作为既有首版的追补前置条件；后续发布仍需实际分发许可、数据保护、必要包验证和明确授权。

- 优先维护现有功能、修复问题和改善可读性；网站、OCR、更多格式、云同步及复杂积分继续后置。
- 重构按实际修改范围验证，不默认重跑全部历史安装／模型验收。
- 新包的证据必须绑定自己的源码与产物，不能借旧候选的测试次数或签名状态。
- 历史阶段计划、候选与原分工见 [README 归档](docs/archive/README-history-2026-10-21.md)和 [AGENTS 归档](docs/archive/AGENTS-history-2026-10-21.md)。

## 14. Git、隐私与协作流程

### 开始工作

- 查看 `git status --short --branch`、近期提交、README 的阶段状态和本任务涉及的文件。
- 分清已提交代码、未提交实现、未追踪资料和测试规格；工作区不干净不代表可以丢弃或重做。
- 只在任务需要时创建新分支；当前分支有其他工作时不擅自切换、变基、合并或清理。
- 发布候选从明确提交的独立干净checkout/worktree安装锁定依赖和编译，不复用共享目录node_modules/dist；可复用下载工具缓存。保留完整HEAD/前后Git状态/锁摘要与包内来源，主目录的新文档提交不改变冻结源码；修改候选功能后须重新构建和相关复验。输出不自动清理，不因安装器存在默认执行它。
- 搜索优先使用 `rg` / `rg --files`。Windows 下给 `rg` 的文件匹配使用 `-g '*.test.ts'` 等方式，不假定 shell 会展开所有通配路径。

### 实现与提交

- 遵循现有 TypeScript strict 配置及格式；共享契约放在 `src/lib/types.ts`，业务规则放在主进程的相应模块。
- 增加能力时先定义输入校验、持久化和失败状态，再连接 UI；阅读/数据库演进要保留迁移与来源信息。
- 只修改本任务负责的文件，保留其他修改；不要用 `reset --hard`、`clean` 或恢复文件来获得“干净”工作区。
- 不在共享的脏工作区盲目 `git add .`；检查暂存清单，必要时按路径或改动块提交，只提交自己的变更。
- 提交信息说明实际变化，可沿用 `feat:`、`fix:`、`docs:`、`test:`、`chore:`；提交 RED 规格必须清楚标记其状态。
- 现有提交身份仅限本仓库配置，不更改全局 Git 用户信息。
- 默认只做本地提交。只有用户明确要求才推送；明确公开发布与仓库可见性后才能改变私有状态或发布到公众。

### 不得提交或复制进交接文档的内容

- 本机 `邻家大姐姐型_AI_陪伴人格_v6.md` 的内容；该文件留在本机，已被忽略。
- 用户资料、数据库、模型文件、缓存、备份、真实 API 密钥、密钥密文、`.env`、私钥和凭据。
- 无关第三方源码、下载压缩包、构建产物、日志和可能包含私人信息的截图。

新增持久化或缓存路径时及时检查 `.gitignore`。递归删除或移动前确认目标的绝对路径和归属，尤其是 `%APPDATA%`、测试临时目录与用户导入原文件；不要将清理测试变成删除学习数据。

## 15. 文档维护、交接与报告

README 保存完整产品简介、运行说明、执行规划及“最近交付与验证记录”；AGENTS 保存开发规则、模块边界和足够接手的项目上下文。两者有重叠时同步核对，不将旧快照当成事实。

每次功能任务结束，记录：

- 做了什么、用户现在能完成什么操作。
- 修改的文件与模块，数据库版本或接口变化。
- 实际执行的验证及结果，使用真实服务还是模拟服务。
- 已知限制、未通过或未验证的部分、下一步。
- 本地提交号；只有确实推送后才写“已同步 GitHub”。

本文件状态章节需在功能验收后更新：将已验收项移入已交付，将仍在开发的代码保持为开发中，删除过期分支快照。只做文档修改时说明是文档验证，不引用历史测试结果冒充本次运行。

向用户报告以中文为主，直接说明结果，少讲不影响理解的执行细节。遇到缺少外部信息时解释缺口，继续不依赖该信息的工作；用户已确认的产品约定不要反复询问。

## 16. 开发原则：AI 八荣八耻

- 以臆猜接口为耻，以查档求证为荣。
- 以模糊开工为耻，以对齐需求为荣。
- 以脑补业务为耻，以请示规则为荣。
- 以新增冗余为耻，以复用存量为荣。
- 以省略校验为耻，以完备测例为荣。
- 以乱改架构为耻，以恪守规范为荣。
- 以不懂装懂为耻，以坦诚存疑为荣。
- 以批量乱改为耻，以分步迭代为荣。

这里的“校验”按用户要求采用与本次功能相关的基础验证，不能解释成每次都跑完整回归；“对齐”不能解释成对已明确授权的常规实现反复请求确认。

## 17. 2026-10-16 修复后的边界约定

本轮编码交接与实际自检见 `docs/testing/full-code-review-fixes-2026-10-16.md`，仍待独立窗口审查，不作为已发布包的新验收。

- `ChatStorage.get/getTurn` 解码基本字段和证据数组/元素/位置/偏移，损坏返回 `chatCorrupt`，不默认为空。完成态 `steps-v1` 路线在备份检查中共用生成解析器；旧 Markdown、空证据、未完成部分输出与确切本地指令说明分别保留。
- 所有出处异步跳转受顶层导航意图序号约束，普通/笔记/路线/复习一致；较新的导航、换资料、返回选文及侧栏操作使旧结果和错误失效。作答冲突允许保留草稿读取最新内容，由用户选择编辑基线，不自动重发。
- Markdown 新导入共用 GFM 可见文本边界。旧段落、保存引用和派生索引保持原样；旧选文仅在副本核验后由独立解析进程返回临时偏移映射。`ParserResult.markdownSelections` 不持久化；`Documents.selection/citation` 内部返回 Promise，IPC 必须 await，外部桥接形状不变。
- 检索只有实际 `exit` 后才能解除 busy 或替换重建文件；启动前取消需在 `spawn` 补发 kill。5 秒未退出报 `indexExitTimeout` 并继续锁住新索引/备份，不能靠固定 sleep 或忽略忙碌状态放行。
- 任务说明统一使用 `planningLimits.details = 8000`，以容纳合法路线的完整转换；旧软件可能不接受新增长任务，回退前保留数据。主库 v13、活动 v1、备份 format 1 未改变。
- 资料总量上限从完整备份文件数政策推导，为 10000 份；重复不占额度，解析前与提交事务均复核。旧超限库保留读取并给出明确处理说明，不能删除记录或放宽备份断言冒充修复。
- 解释性问题的关键词补充至多取同一 PDF 的一页相邻、同首要概念上下文；显式技术名称对关键词/向量候选一致核对。当前 27 题已用于回归开发，不再算新独立评测，不保证一般语义质量。

## 18. 2026-10-16 试用反馈后的维护约定

实际范围及证据见 `docs/testing/user-trial-fixes-2026-10-16.md`，保留此前修复和发布记录各自的版本边界。

- 拉丁字母或首字母大写不直接等于技术名称。普通请求方式词参与查询去噪；`namedQueryTerms` 只对缩写、标识符及候选中可确认的命名形式建立强约束，关键词/向量一致。原 27 题及本轮新问句均为开发回归，不代表一般语义质量。
- 测验和轻量复习都提供保留输入的最新版本读取/比较；必须由用户选择编辑基线，继续手动保存，主进程乐观锁不可绕过。
- 同批任务同时间时按 `daily_tasks.rowid` 保留写入顺序；界面稳定排序，编辑已有任务时原位替换。未来备份、迁移或重建应继续保留 rowid，不用随机 UUID 或伪造创建时间补顺序；当前数据库版本不变。
- 首次引导位于首页上方，按固定示例原文摘要找回真实已导入记录，不因加载引导自动导入资料；没有把引导步骤等同于掌握程度。
- `GenerationStatus` 只对 streaming 请求显示从 `createdAt` 计算的经过时间、正文是否收到及停止入口；不添加百分比或内部推理，不把请求时间加入学习统计。时间变化不重复播报；聊天/练习、笔记反馈、路线共用显示。
- 路线步骤选择后直接校验并预览，最后仍须完整写入预览和明确确认；原有主进程版本、预算、项目、取消及防重放约束不变。资料移除/重命名与全局专注提示按本轮用户确认留待后续。

## 19. 目录维护约定（2026-10-21）

- 页面与专用子组件、样式放入 `src/components/<功能>/`，跨多个功能的展示组件放 `shared/`；不要把新文件重新堆回顶层。
- 后端核心规格放 `electron/core/__tests__/`；纯规则测试仍与 `src/lib` 中规则共置，Electron 端到端流程放 `tests/`。
- 目录移动需同步静态／动态导入、mock 路径、样式引用与当前文档；历史报告保留原测试对象和旧路径，并通过迁移清单查新位置。
- 模块位置改变不等于可以改业务规则、IPC、数据结构或构建产物路径；保持根目录本地启动入口可用。
- `.codex/`、第三方下载、私人设定、用户数据、历史构建与许可材料不随源码整理清理或纳入提交。
- Vite 热更新不监听 `artifacts/`、`release/`、测试输出、本地体验数据和第三方下载；不要让 Electron 缓存或数据库锁影响开发服务。

## 20. 晴岛视觉整合约定

- 默认视觉依据`docs/design/SUNNY_ISLE.md`与`design-lab/selected-design.json`，正式样式为`src/styles/tokens.css`、`src/styles.css`与`src/styles/study-home.css`，配套主题继续独立维护。
- `design-lab/`仅保留离线设计与原授权材料，不将demo脚本、远程资源或第二轮UI库加入运行时。
- 旧UI交接里的未实现/规划中属于当时快照；本次整合保留当前所有实际学习能力、导航意图保护、常驻聊天与阅读侧栏，功能目录以第6/19节为准。
- 改布局要核对900×640、真实长文本、所有导航入口、键盘focus/hidden和减少动画偏好，不以原6条UI成绩代替本轮合并验证。

- 动效规范见`docs/design/SUNNY_MOTION.md`，正式入口`src/lib/motion.ts`与`src/styles/motion.css`；不得影响PDF坐标、实际操作、hidden/焦点及系统减少动画偏好。

## 21. 软件更新与合并维护约定（2026-10-22）

- 设置的`AppUpdatesPanel`调用`getAppVersion()`、`checkAppUpdate(force?: boolean)`及`openAppUpdate('latest' | 'history')`；三项均为固定IPC，继续验证主窗口／主frame、来源URL与备份busy。不能提供任意URL、下载安装器或系统命令入口。
- `electron/core/app-updates.ts`仅匿名请求本项目GitHub发布API，最多30条含preview，15秒／512KiB上限，成功缓存5分钟并合并并发；只接收已上传且地址／版本匹配的Windows x64 NSIS附件。说明为有界纯文本，不渲染HTML或远程图片。
- 版本按实际安装包应用版本比较，保留历史`v0.1.1-preview.1`对应`0.1.1`的兼容；开发同号不能宣称源码等于发行包。后续发布必须同时递增`package.json`／锁文件版本，匹配标签核心版本与`StudyCompanion-版本-win-x64-setup.exe`，不要只重命名标签模拟升级。
- 新检查仍受备份busy入口保护；已经开始的纯发布元数据请求不计入学习文件操作锁，不阻塞本来空闲的备份。其他业务请求继续计数与互斥，不能借此放宽资料、模型、恢复或数据库操作。
- 升级只在用户点击后打开主进程构造的官方发布页，手动保存／退出／安装。当前未签名发行说明保留；源码合入main不等于发布新安装包。
- 旧Markdown兼容选区用同源AST范围及确切原始文本证明偏移，不使用全局`indexOf`猜位置；无法证明则拒绝。含图片／HTML的旧节保守停止兼容映射，直接原文匹配与持久段落不变。聊天问题与流片段写入前拒绝NUL，异常片段之前的正常内容仍可读回。
- 合并保留当前九项学习导航、三主题、阅读侧栏与草稿；小窗口导航可换行，动效选中背景跟随实际按钮的横纵位置。空会话保持提示顶部，只有实际轮次才跟随输出到底。
- 独立验收／修复历史分支若补丁已纳入，先核对对应内容再登记合并关系，保留原引用；本轮历史验收登记合并前后Git树完全相同。不用旧快照覆盖当前源码，不删除原分支或重写历史。
