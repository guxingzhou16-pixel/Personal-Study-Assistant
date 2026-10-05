# 私人学习助手：项目说明与 AI 开发协作指南

本文件适用于仓库内的开发、文档、验证与交接工作，帮助第一次接手的开发者或 AI 在没有聊天记录的情况下继续项目。请先读本文件，再读 `README.md` 的执行规划书，并核对实际代码与 Git 状态。

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

## 2. 项目身份、目标与交付形态

| 项目项 | 约定 |
| --- | --- |
| 项目名称 | 私人学习助手 / Study Companion；当前界面使用“拾知”作为名称 |
| 仓库 | `https://github.com/guxingzhou16-pixel/Personal-Study-Assistant` |
| 仓库可见性 | README 记录为私有；公开发布前重新核对并取得明确授权 |
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

## 3. 当前状态与接手快照

本节核对日期：**2026-10-05**。接手时重新检查，不将下面的提交号、测试数量或工作区状态写成实时结果。

### 3.1 已交付并有历史验收记录

- `7a4198a`：Electron 桌面骨架、首页、空资料库、设置及基础导航。
- SQLite 保存昵称、每日学习目标、回应风格及两套模型服务配置，关闭重开后恢复。
- Ollama 与兼容 OpenAI 的模型列表检测、模型选择、连接错误提示。
- Windows 系统加密的密钥保存、按服务地址绑定、重启读取与删除。
- TypeScript 检查、桌面构建、Windows GitHub Actions 配置。
- 2026-10-01 首页月历、每日签到、真实手动学习计时已通过功能验收：8 项相关核心测试、1 项真实 Electron 流程及类型检查、桌面构建通过。首页两列与下方签到／时长两列均为 4:5；签到和时长重启后保留。这是基础累计计时，番茄钟仍待实现。
- README 记录此版本在 2026-09-30 本机通过 17 项核心测试及 2 项真实 Electron 测试，模型接口使用模拟服务和测试密钥。

上述测试是**历史基线**。后续新增代码和测试后，不能直接沿用数量或声称当前所有测试通过；GitHub Actions 的执行结果也需另行核对。

### 3.2 已交付的资料导入与基础阅读

- `0ed6eea` 实现导入与阅读；后续改为独立解析进程，`a3dee7d` 修复 Electron utility 进程的 PDF.js Node 环境识别，`3d5036a` 修复首个书签不在第一页时的初始锚点。RED/GREEN 检查点保留，最终验证以 README 为准。
- 原生文件选择、本机副本、SHA-256 去重、逐文件失败、后台进度与取消、搜索/格式过滤、首页真实最近阅读已接入。
- PDF 原页、可选文字、书签/页码目录、翻页、缩放；Markdown 标题、表格和代码；护眼及独立阅读位置重启恢复已接入。
- 选中同页/同章节原文可复制含资料名、页码/标题行号和来源标识的引用。该阶段主库版本 2 保存资料与文字段落；当时尚无聊天、FTS/向量索引或 RAG。当前聊天与关键词 RAG 见 3.4、3.5。
- 本阶段核心测试 34 项及定向 PDF 锚点修复验证通过；合并后的 5 条真实 Electron 流程通过，覆盖设置、日历、阅读、引用及取消。资料由测试生成，不使用私人文件、真实模型或收费 API；用户真实复杂中文 PDF 与安装包待验证。

先读 `documents.test.ts`、`document-storage.test.ts` 与 `reading.spec.ts`，维护已有行为，不删测试或降低断言来冒充修复。`a541eed` 的中间提交说明曾提前写入桌面通过，实际 PDF 环境修复后才通过；不要引用中间描述代替验收记录。

### 3.3 日历功能与并行工作区

日历功能在 `codex/home-calendar` 分支完成验证，相关模块为：

- `src/components/StudyCalendar.tsx`、`src/lib/calendar.ts`：学习日历、月份切换、签到显示和学习计时界面。
- `electron/core/study.ts`、`electron/core/study-storage.ts`：学习计时与按日记录存储。
- `electron/main.ts`、`electron/preload.ts`、`src/lib/types.ts`、`src/lib/desktop.ts`、`src/App.tsx`、`src/styles.css`：对应接口与界面接入。
- README 约定包含只提交本地、文档同步维护及普通功能采用基础验证。
- 根目录存在未追踪的 `markitdown-0.1.8/`。目前不是已确认的应用架构或依赖，不要自动纳入提交、运行其中安装脚本或宣称已集成。

日历提交 `069600a` 与资料阅读已在独立工作区合并验收，保留双方 IPC、共享类型、首页入口、独立活动库与样式。用户已确认其他文档任务结束，完成版合回原目录；第三方下载保持原状，不属于应用。阶段验收通过不代表将来每次改动都自动通过，开始新任务仍需检查分支与未提交改动。

### 3.4 已交付的流式聊天基础

- 2026-10-01：普通多轮聊天、Ollama NDJSON / 兼容 OpenAI SSE、逐段输出、停止、新建/切换会话、模型/风格接入与重启恢复。聊天不读取资料库。
- 主库版本 3 新增 `conversations`、`chat_turns`，升级前备份，保留旧设置、资料、锚点与阅读位置。生成中每 500 毫秒保存，正常退出标记中断；异常退出恢复未完成轮次，不自动重发。
- 远程发送确认绑定地址/模型/接口，主进程复核服务地址；仅兼容接口读取对应密钥。模型文本不执行 HTML、不加载图片或外链。
- 26 项相关核心测试、生产构建与类型检查、3 条真实 Electron 流程（聊天、原有设置/密钥/导航、开发模式）通过；追加聊天流程确认退出保留部分回答与地址变化后重新确认。修复迟到更新复活已完成回答的状态问题，保留复现测试。
- 此为模拟服务与假密钥的协议验收；默认本机 Ollama 当时不可达，真实模型质量与云服务仍待验证。阅读/日历完整桌面流程未在此次重跑。详细覆盖范围见 README。

### 3.5 已交付的关键词 RAG

- 2026-10-02：指定资料/全部资料的 FTS5 中文检索、原文预览、流式资料问答、有效引用跳回 PDF 页码/Markdown 标题、返回问答与重启引用恢复。空证据直接保存本地说明，不请求模型。阅读器“问这份资料”新建会话并限定资料。
- 主库版本 4 为 `chat_turns` 增加 `mode`/`evidence`，升级前备份并保留旧轮次/资料/阅读位置；活动库仍是版本 1。派生全文索引独立保存，后台增量建立与重建，支持进度、取消；重建成功才替换旧文件。
- 主进程缓存预览 UUID、问题、范围和最多 4 个确切片段，不接受 renderer 自造证据。预览及引用打开前核对副本完整性，原文/位置/资料名逐项匹配。远程发送确认绑定本次预览与模型，只发送当前问题和证据；普通聊天历史排除资料问答。
- 37 项相关核心测试、类型检查、生产桌面构建与修改文件格式检查通过。6 条相关真实 Electron 流程验证 RAG、原有聊天/设置/开发模式/阅读/解析取消；RAG 追加索引取消规格按 preload 解包/抛错契约修正后单条重跑通过。本次未重跑完整日历桌面流程、真实模型、规模性能、安装包或远端 CI。
- `npm run eval:retrieval`：6 份合成资料、15 个固定问题，12 个可回答问题 Hit@4 = 100%、Mean Recall@4 = 87.5%、MRR@4 = 1；3 个不可回答/范围不符问题为空。3 个跨段落或换说法问题未完整命中；逐题报告可重复生成。只评测检索锚点，不能作为真实模型回答/引用语义准确性。
- `codex/keyword-rag` 保留 RED/GREEN，验收代码 `75a9c73`；只提交本地。该历史阶段尚无向量/混合，后续见 3.6；真实生成质量仍未验收。

### 3.6 已交付的本地嵌入与混合检索

- 2026-10-02：设置主动下载固定 BGE 中文 Q8，进度/取消、文件完整性校验、独立 CPU 进程、本地向量缓存与 RRF 融合。云端聊天不依赖 Ollama；缺少/损坏模型、推理故障或语义进程退出/超时，明确保留关键词结果。用户取消不触发降级重试。
- 权重与配置约 23.3 MiB，固定 revision/SHA-256；Transformers.js 4.3.0、ONNX Runtime Node 1.30.0 的 Windows 预编译绑定，无 C++ 编译。本机真实权重验证通过；其他机器和安装包尚未验证。
- 原主库版本 4、活动库版本 1 不变；派生索引首次向量检索事务升级到版本 2。模型标识含输入/权重/运行时版本，批次事务保存，可恢复部分索引，重建成功才替换旧文件。
- 固定 15 题未改动：关键词 Mean Recall@4 = 87.5%，混合 = 95.83%，Target Precision@4 = 100%，空证据 3/3，仍有 `cache-multi` 不完整。数据集参与开发调参，不是独立质量测试；不等于真实回答/引用准确性。CPU 样本和原始指标定义见 README。
- `codex/local-hybrid-retrieval` 保留 RED/GREEN：8 个相关核心文件 37 项、4 条常规桌面与 1 条真实 BGE 门禁、类型检查/生产构建通过。门禁使用真实 BGE 与模拟回答，不调用收费 API。未跑全局回归/完整日历/完整独立阅读/普通聊天桌面；README 保存具体范围。默认仅本地提交。

### 3.7 已实现、待独立功能验收的结构化笔记

- 2026-10-04：用户明确将测试留给其他对话，本对话继续主线开发。已接入笔记创建/编辑/保存、资料关联、标题搜索、阅读往返、另存新笔记、确认删除、Markdown 导出与未保存提醒；不依赖 AI。
- 主库 v5 新增 `notes`，保留设置/资料/阅读/聊天/证据；v4 升级前 `before-v5-*` 备份，迁移事务中完成。活动库 v1、派生索引 v2 不变。本轮未打开用户数据，迁移与恢复仍待测试。
- 四部分为理解/依据/问题/下一步，模板/限额/Markdown 集中于 `src/lib/notes.ts`；标题 120、每部分 20000 字符，最多 1000 份。手写依据不等于受验证 RAG 引用，也不自动进索引或创建任务。
- 版本号绑定保存/删除/导出；冲突保留草稿，用户可另存新笔记。编辑组件保持挂载；切换笔记显示保存/放弃/取消，正常退出由主进程确认。未保存内容仍可能因强退/界面重载丢失，不宣称自动保存。
- 类型与生产构建、修改源码格式及 diff 检查通过，未新增/修改/执行功能测试；不引用旧测试次数或称笔记已验收。实现提交 `7dff94f`，在共享 `codex/structured-notes` 分支，仅本地、未推送。测试对话的迁移、CRUD、导出与桌面交接清单在 README；保留其 RAG/独立评测提交及未提交文件，不擅自切换共享分支。

### 3.8 已实现、待独立验收的 AI 笔记反馈

- 2026-10-04：从已保存笔记核对关注问题，原有后台检索、笔记/证据预览、远程确认、流式反馈/停止、历史与原文往返已接入；提示要求有依据的理解、知识缺口和一个练习，不代表真实模型效果已经验证。
- 主库 v6 增加 `conversations.note_id` 与 `chat_turns.note_snapshot`，普通会话/旧轮次补 NULL。每份笔记有一个专用会话，不进入普通列表或上下文；轮次仍为 `mode = sources`，可选 `noteSnapshot` 明确反馈用途。删除笔记级联删除专用会话/轮次，生成中由主进程拒绝删除；活动库 v1/派生索引 v2 不变。
- `NoteFeedbackService` 只从主库取保存版本，预览绑定 ID/revision/关注问题/范围，10 份/10 分钟；渲染端不能传笔记正文、提示或证据。发送复核版本与模型配置，远程确认针对笔记+本次问题+片段；空证据不请求模型或读取密钥。
- `ChatService` 复用两协议、单活动请求、500ms 保存、退出/中断恢复及 citation 校验，不创建第二套流式管线。`ModelAnswer` 共用受限 Markdown，`NoteFeedbackPanel` 用 revision 保留早到更新、拒绝迟到初始快照。旧反馈显示原笔记版本，反馈不覆盖作品、不写计划/进度/记忆。
- 标题/四部分合计 12000 字符、关注问题 1000；明确拒绝超长，不自动截断。每笔记 100 次反馈，会话总数 500 含专用反馈。正文导出不含反馈，卡片/短测验、结构化评分和采纳写入仍未实现。
- 类型与生产构建、修改源码格式及 diff 检查通过，功能/真实质量验收交其他对话，未打开个人数据、未调用真实模型或收费接口。实现提交 `da48373` 在共享 `codex/structured-notes`，仅本地、未推送；迁移/删除/恢复/双协议/远程确认/引用/状态竞争清单见 README，保留其他对话的未提交改动。

### 3.9 已实现、待独立验收的受控学习路线

- 2026-10-04：目标/检索词/范围/时间预算 → 一次本地检索 → 完整预览/远程确认 → 一次模型起草 → 原文/新笔记入口，支持停止、独立历史与重启恢复。建议由用户实际执行，不显示虚构完成或掌握记录。
- 主库 v7 增加 `conversations.purpose`（`chat/note-feedback/learning-agent`），旧笔记会话回填用途；`chat_turns.learning_request` 可空 JSON，旧行 NULL。单一路线会话使用唯一部分索引，最多 100 份草稿，全局 500 会话含三类；v6 升级前 `before-v7-*` 一致性备份。活动库 v1/派生索引 v2 不变，迁移仍待测试。
- `LearningAgentService` 缓存完整请求/证据，UUID/10份/10分钟，发送只能传 ID/配置签名/远程确认；`learning-input.ts` 共用 IPC 与恢复校验，目标和检索词各 1000、预算整数 10～180 分钟，`src/lib/learning.ts` 集中限额/比较。
- `ChatService.send` 的第二参数改为仅主进程可用的判别联合（笔记或学习请求），不接任意消息/工具。路线沿用 sources 模式、两协议、单活动请求、500ms 保存/停止/恢复及引用；普通列表/get/send 不访问专用会话，旧草稿不进入新提示。双快照不可共存。
- 固定工作流，不解析模型文本里的工具命令，不自动多次检索/重试；语义故障仍可按现有政策降级关键词，取消不重试。Markdown 四部分与时间合计依赖模型遵循提示，程序未做结构化评分/预算求和，真实效果待验收。空证据只保存本地说明，不读密钥或请求模型。
- `AgentPage` 保持挂载，用每轮 revision 与活动事件版本防迟到更新；预览输入变化失效，确认绑定模型/地址/预览。出处返回路线，新笔记只带关联资料并沿用未保存确认，不自动保存正文。无计划/进度/记忆写入工具，未新增依赖/功能测试，未访问用户数据库/真实模型/收费接口；类型/生产构建/修改源码格式/diff 与静态审查通过，功能验收见 README。实现提交 `db795b1` 在共享 `codex/structured-notes`，仅本地、未推送。

### 3.10 已实现、待独立验收的长期记忆与确认写入

- 2026-10-05：新增 `MemoryPage` 的手动创建/搜索/编辑/保存/另存/删除确认，保留来源/时间/revision；默认 local 范围，另有 disabled 和允许本机/远程路线的 remote。标题100/内容1000/总500条，每次路线最多手选5条，默认不选；普通聊天/资料问答/笔记反馈不读记忆。
- 主库 v8 增加 `memories` 表与 `chat_turns.learning_memories` 可空JSON，旧行NULL；v7升级前 `before-v8-*` 一致性备份，仍事务迁移，不重建旧表。活动库v1/派生索引v2不变。历史保留所选快照，不复用其参与新请求；删除不改写既往快照/回答/备份、不撤回已发数据，但旧未发送预览不能再用。
- `memory-storage.ts` 共用运行时/恢复校验、参数化CRUD/冲突、来源保护、范围与版本复核；`memories.ts` 集中限额/文案/本机地址政策。来源 manual/learning-route 由主进程写，renderer不能伪造或改来源。
- `memory-proposals.ts` 从有学习请求/证据/答案的completed路线读取保存目标，确定性起草学习意向；不复制模型评价，不推断掌握、不请求新模型。10份/10分钟预览，同路线重准备撤销旧ID；编辑只能标题/内容/scope，最终预览后确认只收UUID，复核来源revision并同步单次写入，取消清缓存。
- `LearningAgentService` 预览绑定实际provider/地址/model与完整记忆快照，检索前后及send复核内容/revision/scope；模型变化/删除/禁用/编辑后重新准备。本机记忆不得沿用缓存发送远程。`ChatService` 可信learning上下文包含记忆，提示仅当用户自述/偏好；外发仅本次所选内容，不作为资料引用或工具权限。
- `AgentPage/MemoryProposalPanel` 展示完整预览、远程确认、当时快照与实际写入结果，输入/选择/配置变化失效；隐藏/换路线清理未确认提议、拒收迟到结果。已提交的确认不能因随后切页被当作撤销。记忆页保持挂载，脏稿切换/刷新先放弃确认；无自动保存/关闭拦截，关闭或重载可能丢未保存记忆。
- `npm run desktop:build`（双TypeScript/Vite/Electron）、17份本轮源码Prettier与diff检查通过；TypeScript reviewer和code-reviewer静态审查通过。Vite仍有已有大块警告，未测性能/安装包。未改功能测试/依赖，未启动应用/读取个人DB/请求模型。功能与真实质量交测试方，新增 `docs/testing/memory-acceptance.md` 均未执行；实现 `ffd4815` 在共享 `codex/structured-notes` 仅本地、未推送，保留其他改动。

### 3.11 已实现、待独立验收的学习项目与每日任务

- 2026-10-05：学习计划页面支持项目创建/编辑/归档恢复，指定日期任务的创建/编辑/改期/项目关联/另存、手动完成/重新打开和确认删除。不调用模型、不自动签到或增加学习时间，不把预计分钟当实际时长，不推断掌握；Agent 任务提议与番茄钟仍待开发。
- 主库 v9 新增 `study_projects`、`daily_tasks` 及索引，关联项目外键 RESTRICT，无旧表重建/旧行改写；v8 升级前 `before-v9-*` 一致性备份，迁移仍事务。保留 v1～v8 全部数据，活动库 v1/派生索引 v2 不变。实际迁移、备份和恢复待独立验证，本轮不打开个人DB。
- `planning-storage.ts` 负责输入/恢复校验、参数化SQL与revision冲突；`planning.ts` 集中限额与日期纯校验。项目最多200、任务5000，标题120、目标2000、详情4000，预计整数5～480分钟；日期是合法0001～9999的YYYY-MM-DD，不按UTC解释或随完成时间重算。
- 项目本阶段只归档/恢复、不删除；归档不级联或改变任务。禁止新建/改关联进入归档项目，现有相同关联可编辑/改期/完成/重新打开/解除/删除。任务save不接status/completedAt，创建todo、编辑保留状态；setCompleted生成真实时刻，重开清NULL，同状态请求仍查revision但不变时间/版本。
- `PlanningPage` 保持挂载，统一编辑区与脏稿确认、删除前完整保存记录预览；异步刷新不能覆盖新写入，busy防重复，失败保留稿、不提前显示完成。切页保留编辑，无自动保存/关闭拦截，关闭或重载可能丢失未保存项目/任务。日期变化前明确处理草稿，不做逾期自动结转/重复任务/子任务。
- 最终 `npm run desktop:build`（双TypeScript/Vite/Electron）、11份本轮源码Prettier与暂存diff检查通过；TypeScript reviewer及code-reviewer静态批准。已有Vite大块警告保留，性能/安装包待验收。未改功能测试/依赖/配置，未运行应用/个人DB/模型。
- 功能测试沿用户分工交独立对话，清单 `docs/testing/planning-acceptance.md` 全部待执行；同步README/AGENTS，不称整阶段或首版完成。实现 `4a40b27` 在共享分支 `codex/structured-notes`，仅本地提交、不推送，保留他人文档/脚本/资料。

### 3.12 仍待开发或验收的主要能力

笔记、AI反馈、路线、记忆管理/确认与手动项目/任务的独立验收，真实聊天/引用语义与规模验证；会话/路线管理、Agent任务写入确认、番茄钟、主题、备份、卡片/短测验、OCR、更多格式、安装包与展示网站待开发。

独立合成集 `synthetic-retrieval-v2`（`tests/fixtures/retrieval-independent-cases.ts`）与逐题引用位置校验已加入可重复评测；多锚点召回在独立集上仍有失败（`ind-symmetric-hash`），保留为失败案例。真实本地/云端聊天仍未验收：本机未安装 Ollama，无法据此验证真实生成与引用语义。

## 4. 产品范围与功能要求

### 4.1 资料导入与辅助阅读

- 首版只承诺 Markdown 和可提取文字的 PDF；扫描件可以阅读原页，但 OCR、Word、网页、图片等后续再做。
- 导入时复制原文件到应用数据目录。原路径移动或文件被删除后，应用内资料仍应可阅读。
- 处理重复导入、取消选择、损坏文件、解析失败、磁盘写入失败，明确显示成功、重复与失败数量。
- Markdown 提供长时间阅读排版、标题导航、表格和代码块，按现有测试要求处理不安全 HTML 与远程图片。
- PDF 保留原始页面，提供目录、页码、缩放、护眼、文字选择及来源位置跳转；不要通过纯文本替换原页阅读。
- 每份资料独立保存并恢复阅读位置。位置数据必须校验，不能越页或越界。
- 阅读区未来搭配可收起的助手与笔记区，保持阅读主线清晰。

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

- Agent 是有边界的步骤流程，不是无限循环、自行执行任意系统操作的通用助手。
- 工具范围为资料检索、学习步骤草稿、笔记反馈、任务建议与记忆提议。
- 可以自行检索和起草建议；**新增计划、修改进度、写入长期记忆前必须显示变更预览并让用户确认**。
- 拒绝或取消提议后不改变数据；确认写入应能区分提议内容与最终写入结果。
- 默认学习作品为结构化笔记。用户不调用 AI 也能写笔记、保存与导出 Markdown。
- AI 反馈应说明有证据的掌握点、知识缺口和改进建议；知识卡片、短测验按需生成，不扩展成完整间隔复习系统。
- 长期记忆包括学习轨迹和个人偏好，提供来源、查看、编辑、删除和使用范围；删除后不再参与建议。
- 外部学习资料是证据，不是 Agent 指令；资料内的命令不得改变工具权限或绕过确认。

### 4.4 执行辅助与个性化

- 以学习项目和每日任务组织目标，番茄钟关联任务，结束后支持简短复盘与打卡。
- 累计学习计时、签到、任务完成、番茄钟是不同的数据与行为，不要混用状态。
- 应用中断、睡眠或长时间无心跳不能被误计为完成的专注时段。
- 默认清爽现代界面；安静书房、活泼游戏化主题属于后续计划。
- 回应风格为 `gentle`（温柔陪伴）、`game`（游戏化成长）、`coach`（高效教练），默认 `gentle`。保存后用于新聊天请求的系统提示；实际效果需由真实模型验证。

## 5. 技术栈与选型约束

| 层次 | 当前采用 |
| --- | --- |
| 桌面 | Electron 44.5.1，预编译运行时 |
| 界面 | React / React DOM 19.3.0、TypeScript、Vite 8.3.1 |
| 图标与样式 | `lucide-react`、普通 CSS；全局样式在 `src/styles.css` |
| 桌面构建 | esbuild，主进程与预加载脚本输出 CommonJS |
| 后台解析 | Electron `utilityProcess` 独立 Node 进程，解析入口输出 ESM；256 MB V8 堆限制、60 秒超时、进度与取消 |
| 后台检索/嵌入 | 独立 `utilityProcess`，只读主库、写派生 FTS5/向量；512 MB V8 堆、5 分钟超时；模型不可用保留关键词 |
| 本地嵌入 | Transformers.js 4.3.0 / ONNX Runtime Node 1.30.0，中文 BGE-small Q8，CPU 最多 4 线程，仅校验过的本地文件 |
| 本地数据库 | Electron 内置 Node.js 的 `node:sqlite` / `DatabaseSync` |
| 密钥 | Electron `safeStorage`，Windows DPAPI 系统加密 |
| 模型请求 | 主进程 `fetch`、运行时参数校验、结构化错误 |
| 阅读依赖 | PDF.js 6.3.289、`react-markdown`、`remark-gfm`、`remark-parse`、`unified`、`mdast-util-to-string`；资源本机加载，无 CDN |
| 测试 | Vitest 核心测试；Playwright `_electron` 真实窗口测试 |
| 格式化 | Prettier，单引号，尾逗号，行宽 100 |
| 版本与 CI | Git、GitHub；Windows Actions 配置在 `.github/workflows/check.yml` |

具体安装版本以 `package-lock.json` 为准，依赖范围与脚本以 `package.json` 为准，不凭旧文档猜接口。

2026-09-30 经用户选择，从 Tauri + Rust 改为 Electron + React + TypeScript。理由是集中使用 TypeScript，便于学习、维护与解释项目；接受安装包和内存占用通常较大的代价。当前不要求 Rust 或微软 C++ 构建工具。新增原生依赖前评估是否破坏这个开发与分发约束，优先使用预编译方案。

## 6. 代码目录与职责

| 路径 | 职责与修改时的注意事项 |
| --- | --- |
| `README.md` | 面向项目使用与交接的简介、运行方式、完整规划、真实验证记录 |
| `AGENTS.md` | 面向 AI 开发者的项目约定、模块边界、工作流程与接手信息 |
| `src/App.tsx` | 工作台、导航、启动加载、页面切换和学习首页 |
| `src/components/SettingsPage.tsx` | 偏好及模型表单、连接检测、密钥操作；输入密钥只作必要的临时传递 |
| `src/components/EmbeddingSettings.tsx` | 独立模型下载/取消、进度和文件状态；不改变聊天配置 |
| `src/components/NotesPage.tsx` | 笔记列表/四部分编辑、保存/另存、资料关联、导出/删除及草稿确认；切换页面保持挂载 |
| `src/components/NoteFeedbackPanel.tsx` | 保存版本/证据预览、远程确认、流式/停止与反馈历史，旧版本提示、引用及返回笔记 |
| `src/components/ModelAnswer.tsx` | 聊天/反馈共用安全 Markdown、受限引用；无 HTML、图片、外链执行 |
| `src/components/AgentPage.tsx`、`src/lib/learning.ts` | 目标/范围/预算、预览/确认、路线历史与人工执行入口；共享输入限额和比较 |
| `src/components/MemoryPage.tsx`、`MemoryProposalPanel.tsx` | 记忆编辑/版本/范围/删除确认，学习意向提议的编辑/最终预览/确认/拒绝与实际结果 |
| `src/lib/memories.ts` | 记忆限额/类别/范围文案与本机地址政策，主进程复用纯函数 |
| `src/components/PlanningPage.tsx`、`src/lib/planning.ts` | 指定日期任务/项目编辑、归档与完成/删除确认；集中限额/日期纯校验/空稿，页面保持挂载 |
| `src/components/PlanningEditor.tsx` | 无状态项目/任务表单，接收实际记录与草稿；不读数据库/直接调用桌面接口 |
| `src/components/LibraryPage.tsx` | 文件选择、导入状态、失败、搜索/格式筛选与真实资料列表 |
| `src/components/ReadingPage.tsx`、`PdfPage.tsx` | 原页/排版、引用复制、保存、受验证的出处跳转及资料问答入口 |
| `src/components/RecentReadings.tsx` | 首页从主库读取实际最近阅读，不用示例数据 |
| `src/components/StudyCalendar.tsx` | 已验收的日历、签到及学习计时界面 |
| `src/components/ChatPage.tsx` | 普通/资料问答、检索预览、停止、绑定配置及预览的远程确认；用 revision 拒绝迟到更新 |
| `src/components/EvidenceCards.tsx`、`src/lib/citations.ts` | 折叠原文与出处按钮；把有效编号转换为受限跳转，未知编号及外链不跳转 |
| `src/lib/types.ts` | 共享数据类型、`DesktopApi`、`Reply<T>`、默认设置 |
| `src/lib/desktop.ts` | 界面调用桌面桥接的唯一入口、错误文本与地址比较 |
| `src/lib/calendar.ts` | 本地日期键、月历网格、相邻月份计算 |
| `src/lib/notes.ts` | 四部分模板/笔记与反馈限额、纯草稿工具与 Markdown 格式；不读文件/数据库 |
| `src/styles.css` | 全局样式、响应式布局、焦点与减少动画支持 |
| `electron/main.ts` | 应用与窗口生命周期、IPC 注册、调用方校验、数据目录；当前也有学习心跳及睡眠暂停接入 |
| `electron/preload.ts` | 沙箱内通过 `contextBridge` 暴露明确的桌面方法 |
| `electron/core/settings.ts` | 运行时设置、地址、服务类型与模型配置校验 |
| `electron/core/storage.ts` | 主库版本 9、迁移前备份，保留旧数据并新增项目/每日任务；不改活动库版本 |
| `electron/core/planning-storage.ts` | 项目/任务表、严格CRUD/恢复校验、revision与归档关联、完成状态时间边界；不调用模型/活动计时 |
| `electron/core/memory-storage.ts`、`memory-proposals.ts` | 记忆CRUD/恢复校验、来源/版本/使用复核，学习意向预览缓存与单次确认 |
| `electron/core/note-storage.ts` | 笔记表/校验/CRUD、关联来源存在检查与 revision 冲突；不调用模型 |
| `electron/core/note-export.ts` | Markdown 选址后的路径保护/暂存替换，不给 renderer 任意路径能力 |
| `electron/core/note-feedback.ts` | 保存版本/预览缓存/受控发送与反馈提示，复用检索/聊天，不信任手写依据 |
| `electron/core/learning-agent.ts`、`learning-input.ts` | 一次检索/一次起草编排、请求缓存/提示；IPC 和恢复共用运行时校验，不分派模型工具命令 |
| `electron/core/chat-storage.ts` | 普通/笔记会话、轮次/快照与异常中断恢复；专用会话不允许普通入口打开；通过 `Storage.chat` 共用主数据库 |
| `electron/core/chat-stream.ts` | Ollama NDJSON / 兼容 OpenAI SSE、UTF-8 拆包、大小/超时边界与错误映射 |
| `electron/core/chat.ts` | 单活动请求、设置/密钥快照、上下文、远程确认、停止、定期保存与退出处理 |
| `electron/core/retrieval.ts` | 精确偏移分块、中文查询词、FTS5 索引事务、范围与排序；同步实现仅在后台进程或测试运行 |
| `electron/core/embedding-model.ts` | 固定模型 revision/文件摘要、输入/分块/融合政策与下载时限 |
| `electron/core/embedding-files.ts` | 主动下载/状态、SHA-256 校验、暂存替换；不上传资料、无聊天密钥 |
| `electron/core/embeddings.ts` | `EmbeddingEncoder` 及 ONNX CPU 适配器，只负责编码和释放；禁止远程加载 |
| `electron/core/vector-index.ts`、`vector-retrieval.ts` | 派生 v2 表、增量批次/恢复、模型隔离、余弦候选、RRF 与显式降级 |
| `electron/core/search.ts` | 单索引进程、取消/重建文件替换、主进程预览缓存、证据/副本验证和保存引用解析 |
| `electron/search-worker.ts` | 固定独立检索入口，只读主库、写派生索引，不访问密钥 |
| `electron/core/documents.ts` | 文件复制/去重/限额、解析进程、完整性检查、引用验证；原生对话框路径不由 renderer 提供 |
| `electron/core/document-parser.ts` | PDF 每页文字、书签定位与 Markdown 标题/文字结构提取 |
| `electron/document-worker.ts` | 固定独立解析入口，只读本次副本，不访问密钥与数据库 |
| `electron/core/credentials.ts` | 按地址管理密钥密文、系统加解密、原子替换文件 |
| `electron/core/models.ts` | 两类模型列表检测、响应解析、大小限制与错误映射 |
| `electron/core/errors.ts` | `AppError` 与安全的对外错误结构 |
| `electron/core/study.ts` | 计时状态、心跳结算、跨日分配与中断处理 |
| `electron/core/study-storage.ts` | 独立学习记录数据库，签到与累计时间 |
| `electron/core/*.test.ts` | 数据迁移、设置、密钥、连接与资料迁移规格 |
| `tests/desktop.spec.ts` | 已有桌面流程与开发模式验证 |
| `tests/calendar.spec.ts` | 已验收的月历、4:5 布局、签到、计时和重启恢复流程 |
| `tests/reading.spec.ts` | 已验收的导入、阅读、原文引用、重启恢复与独立解析取消 |
| `tests/chat.spec.ts` | 双协议流式回答、停止/断流、迟到事件、退出恢复、密钥使用及目标地址确认 |
| `tests/rag.spec.ts` | 中文/英文检索、无证据、PDF/Markdown 出处跳转、重启引用与实际索引进程取消/重建 |
| `tests/fixtures/retrieval-cases.ts`、`tests/retrieval-evaluation.ts` | 固定合成题、关键词/混合指标与逐题失败；只在混合模式调用真实本地嵌入 |
| `tests/embedding.spec.ts` | 模拟下载的 UI/取消流程，保留关键词路径 |
| `tests/embedding.real.ts`、`playwright.embedding.config.ts` | 独立真实 BGE 门禁：离线中文同义检索、引用、重启缓存、索引取消、损坏降级 |
| `tests/fixtures/reading-files.ts` | 自动生成测试资料，不使用私人学习文件 |
| `scripts/build-electron.mjs` | 构建主进程、预加载、独立解析/检索入口到 `dist-electron/` |
| `scripts/eval-retrieval.mjs`、`download-embedding.mjs` | 固定关键词/混合评测；开发模型缓存/报告写 `artifacts/`，不使用用户数据 |
| `scripts/prepare-pdf-assets.mjs` | 开发/构建时复制 PDF.js CMap、字库与 WASM 到生成资源目录 |
| `scripts/dev.mjs` | 启动 Vite 与 Electron，处理开发进程退出 |
| `vite.config.ts` | Vite、CSP 注入与 Vitest 文件匹配 |
| `playwright.config.ts` | Electron 测试配置及本地 Vite 服务 |
| `.github/workflows/check.yml` | Windows 安装、格式检查、核心与桌面流程验证 |

`node_modules/`、`dist/`、`dist-electron/`、`public/pdfjs/`、`coverage/`、`artifacts/`、`test-results/` 是依赖、生成文件或测试产物，不当作可维护源码。

## 7. 进程、接口与错误边界

调用链：**React 界面 → `src/lib/desktop.ts` → `window.studyCompanion` → preload → IPC → 主进程业务模块 → 文件/SQLite/模型服务。**

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

检索方法：`prepareQuestion(question, sourceId | null)`、`cancelRetrieval`、`rebuildIndex`、`onRetrievalProgress`、`resolveCitation(turnId, number)`。只接受受限问题、资料哈希、保存轮次 UUID 和整数编号；主进程持有实际范围/片段，缓存上限 10 份、10 分钟有效，问题变化须重新检索。取消只结束索引子进程，不修改原资料/主库；新索引完成后同步原子替换旧文件。引用解析从保存轮次查证，不接受 renderer 提供路径、锚点或原文。进度订阅只传数据并返回取消监听函数。

本地模型方法：`embeddingStatus`、`downloadEmbedding`、`cancelEmbeddingDownload`、`onEmbeddingProgress`。不接受地址、路径、模型 ID 或资料；下载主进程固定的公开模型，使用 Electron 系统网络配置，公开 CDN 可重定向，逐文件校验，无聊天密钥。一次下载、15 分钟上限、不续传；全部就绪后替换，取消不破坏旧副本。`rebuildIndex` 现在返回说明字符串，包括语义降级；不能收到成功就宣称向量完整建立。模型候选路径由主进程给后台，后台再次核对摘要。

笔记方法：`listNotes`、`getNote`、`saveNote`、`deleteNote`、`exportNote`、`setNoteDraftDirty`、`onShowNotes`。只接受 UUID、校验过的四部分/标题/来源 ID 和 revision，不接受导出路径。新笔记为 `id = null, revision = 0`，已有笔记须匹配保存版本；标题/正文在主进程校验，SQL 参数化。导出主进程读取已保存内容与来源名、显示 native 保存对话框，只允许 `.md`，校验目录链接后禁止应用数据目录，暂存完成后替换目标。正常关闭时 dirty 笔记默认继续编辑，明确放弃才能退出；事件只通知回笔记，不暴露 Electron event。Agent 不得借这些接口默认修改用户笔记。

反馈方法：`listNoteFeedback(noteId)`、`prepareNoteFeedback(noteId, revision, question)`、`sendNoteFeedback({ retrievalId, expectedProfile, consentEndpoint? })`。范围来自保存笔记关联资料，未关联则全库；不接受自造正文/证据/角色/路径。预览核对检索期间与发送时版本，确认绑定实际配置/预览。复用停止/进度/更新/引用，无任意工具入口。`ChatService.send` 可信第二参数为主进程判别联合 `{ kind: 'note', note } | { kind: 'learning', request, memories }`，不能桥接。专用会话不进入普通列表/get/send，ChatPage只显示活动状态。

路线方法：`listLearningDrafts()`、`prepareLearningDraft({ goal, query, sourceId, minutes }, memoryIds?)`、`sendLearningDraft({ retrievalId, expectedProfile, consentEndpoint? })`。运行时限制字段/文本/来源/预算与最多5条记忆ID；请求/证据/记忆只从主进程预览读。输入/范围/预算/记忆/模型变化重新准备，成功send后预览不可重用；空证据不调用模型。提示只含本次目标/时间/检索词/片段/所选记忆，无旧历史/笔记/日历。主进程绑定实际模型签名并核对记忆范围，不能仅靠renderer checkbox保证隐私。停止/进度/更新/引用共用，新笔记仅导航。

记忆方法：`listMemories()`、`saveMemory({ id, revision, title, content, kind, scope })`、`deleteMemory(id, revision)`、`prepareMemoryProposal(turnId, edit?)`、`confirmMemoryProposal(proposalId)`、`discardMemoryProposal(proposalId)`。手动创建来源manual，编辑保留来源、不接受origin字段。提议edit只允许title/content/scope，最终内容/来源由主进程缓存；确认只收UUID，同步复核/写入后消费，取消/过期/重复不写。提议不是模型工具调用，已发送数据不能通过取消或删除撤回。

计划方法：`planningOverview(day)`、`saveStudyProject({ id, revision, title, goal, archived })`、`saveDailyTask({ id, revision, title, details, projectId, day, minutes })`、`setDailyTaskCompleted(id, revision, completed)`、`deleteDailyTask(id, revision)`。overview取指定日期任务及全部项目；新记录id=null/revision=0，已有须版本匹配，未知字段拒绝。安排日期可由用户指定，和只能签到今天/不接日期时长的活动接口分开；completed必须boolean，不接受伪造状态/时间。仅用户手动操作，Agent不接任意CRUD工具，后续提议须主进程最终预览/确认边界。

## 8. 本地数据、迁移与密钥

默认数据目录：`%APPDATA%\StudyCompanion\`。

| 文件或目录 | 内容与约束 |
| --- | --- |
| `study-companion.sqlite3` | 主库版本 9：保留设置/阅读/聊天/笔记/反馈/路线/记忆，新增项目/每日任务；v5～v9迁移待功能验收 |
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
| `credentials.enc.json` | 独立密钥密文文件，按规范化地址的 SHA-256 键索引，不是学习备份内容 |

数据库规则：

- 使用参数化 SQL，不拼接用户输入到查询语句。
- 迁移使用事务，保持已存数据，不删除个人数据库来解决版本问题。
- 当前迁移只有前向升级，无逆向迁移/自动恢复；不通过手改user_version降级。故障恢复先关闭应用、保留完整当前数据，再核对一致性备份与兼容应用版本；旧备份不含升级后的新记录。独立验收验证备份可读与回滚，不能在主线运行个人库恢复。
- 拒绝用旧版本应用打开更新的数据格式；损坏设置应报错，不能悄悄重置成默认值。
- 启动探测 FTS5；首次检索才增量建派生索引。DDL 与内容写入用事务，重建在新文件完成；不可直接重建主库。源文字不可变，新哈希成为新资料。
- 未来迁移先读保留/备份规格，不能把版本9当空库重建。旧断言/桥接清单交测试方同步；降user_version模拟旧格式须还原真实结构，包含v5表、v6列/索引/外键、v7用途/快照/部分索引，低于v8时去掉记忆表/列/索引、低于v9时去掉项目/任务表/索引，不用IF NOT EXISTS掩盖错误夹具。
- 当前已有资料/阅读/聊天/证据、笔记/反馈、学习路线、记忆/提议及ProjectDraft/StudyProject/ProjectSaveRequest/TaskDraft/DailyTask/TaskSaveRequest/PlanningOverview。笔记/反馈/路线/记忆/手动项目任务已实现待测试；Agent任务写入工具及FocusSession仍规划中。
- `notes` 保存 UUID、来源哈希、标题/四部分、revision 与创建/更新时间；关联来源采用外键，未来删除来源先设计笔记关联处理，不默默级联删除作品。导出读取保存快照，选址期间版本改变要拒绝导出。删除有确认、无回收站；原文依据为手动文字，不是可信检索证据。
- v6 的 `conversations.note_id` 唯一且可空；普通/路线会话为 NULL，非空关联笔记并 `ON DELETE CASCADE`。`chat_turns.note_snapshot` 可空 JSON，按笔记边界运行时校验；不扩展旧 mode 的 CHECK，反馈仍 sources，普通旧轮次不伪装成反馈。删除笔记会连同其会话/轮次删除，主进程先拒绝活动反馈；删除来源仍不能静默删作品。
- v7 的 `purpose` 明确三用途，普通列表/读取/发送仅 chat，反馈和路线各有主进程专用 getter；部分唯一索引限制单一路线会话。`learning_request` 非空必须有效 JSON、与 note_snapshot 互斥且 mode=sources，恢复复用输入校验。路线请求保存稳定来源 ID，不依赖后续用户表单，不向模型发送旧路线或推断已完成学习。用途权限不得改回一个绕过全部隔离的布尔值。
- v8 `memories` 保存UUID、title/content/kind/scope、不可由renderer指定的origin/origin_turn_id、revision与时间。来源轮次ID是溯源标识，不级联删除记忆或回填当前内容。`learning_memories`非NULL须依附learning_request且经恢复校验最多5条；旧NULL不读当前表回填。历史只查看、不进新提示；删除阻止后续选择/缓存使用，既往快照/备份保留。
- v9 `study_projects` 保存标题/目标/archived/revision/时间，`daily_tasks` 保存内容、project_id可空RESTRICT外键、安排日期/预计分钟、status/完成时刻与revision/时间。CHECK约束todo对应NULL、completed对应非NULL；归档不删除历史任务。普通save保留完成状态，另存创建todo；完成只表示用户标记，无实际时长或知识证明。
- 聊天轮次状态为 `streaming/completed/stopped/error/interrupted`，保存部分回答与错误提示。主进程退出先取消聊天并保存，再关库；重启将残留的 streaming 标记为 interrupted。保存失败须向界面报告，不能冒充成功。单会话限 100 轮、会话总数限 500，未来会话管理/清理需保留恢复边界。
- 来源锚点为 `page-N` 或 `md-line-N`，绑定内容哈希。资料问答轮次保存证据编号、资料名/类型、标题/页码/行号、UTF-16 偏移与原文；打开核对保存原文、元数据和副本哈希，不猜位置。复制 URI 尚未注册系统协议；应用内引用编号走受限 IPC，不依赖系统协议。
- 当前分块最多 800 字符、重叠 120 字符，不拆开代理对；中文分词/汉字二元词入 FTS5。查询最多 24 个非停用词，BM25 前 40 候选经至少 50% 字面关键词覆盖过滤、排序/去重取最多 4 片段。阈值不证明证据充分，跨段落/同义表达可能遗漏；调整须保留固定评测失败案例。
- 向量窗口 384/重叠 64、标题最多 64、批次 8；BGE CLS/归一化/查询指令，禁止静默 token 截断。长问题分窗口并平均。模型标识包括权重 revision、维数、池化、指令、窗口/标题政策和运行时；阈值调整不要求重做同一编码，输入政策变化必须换缓存标识。向量主键是模型/来源/锚点/偏移，不使用易变化的 FTS rowid。
- 逐批事务提交，来源全部编码后才标记完成，取消后的增量任务可恢复；重建仍用新文件。线性余弦扫描当前模型；全局门槛 0.6，关键词支持资料内门槛 0.5，RRF 常数 60，最多 4 个去重片段。不混用模型，不自动切换云服务，不把门槛当证据充分概率。只有嵌入错误降级；SQL/磁盘失败仍报错。
- 导入上限：20 文件/批；PDF 50 MB、1000 页、500 万提取字符；Markdown 5 MB、UTF-8；60 秒/文件。Markdown 原始 HTML/脚本和全部图片不加载，外链不自动打开。扫描件仅原页；密码 PDF 先解锁。新格式与更高限额先评估体验和内存。
- PDF.js 对 utility 类型的 Node 识别需要 `document-worker.ts` 的进程内兼容提示；只影响解析子进程。升级 PDF.js/Electron 时实测此入口、资源路径、取消与正常打开，不能只运行 Node 单元测试。
- 学习日历用本地日历日期，存储毫秒、对外展示秒；计时使用单调时钟，跨日分配，超过 30 秒心跳缺失视为中断。每秒保存；退出或睡眠时暂停，重启不自动计时。异常退出可能丢失最后约一秒。这些核心行为已做专项验证，不代表番茄钟或任务完成记录已实现。

密钥规则：

- 只在主进程加解密。用户输入时可临时通过桥接传递，保存后清空输入框；不把已保存密钥回传界面。
- `safeStorage` 不可用时拒绝保存，不降级为明文。
- 密钥按规范化服务地址绑定，地址改变时不得将另一地址的密钥发过去。
- 密文由 Windows 账户保护，不是跨机器通用备份；后续导出明确排除密钥及密文临时文件。
- 密文丢失或损坏、账户不匹配要给出明确反馈，不把损坏文件静默覆盖为空配置。

开发/测试专用环境变量：`STUDY_COMPANION_DATA_DIR` 指定隔离的数据目录，`STUDY_COMPANION_DEV_URL` 目前仅接受 `http://127.0.0.1:1420`；打包模式不使用这些覆盖。不要将测试路径或开发服务写进生产分发配置。

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
npx install-electron --no
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
| `npm run build:electron` | 生成 main/preload 及解析/检索 worker；检索运行时依赖留在 node_modules，不把原生库打包进 JS |
| `npm run desktop:build` | 构建界面和 Electron 代码，尚不生成安装包 |
| `npm run desktop:start` | 打开已经构建的桌面版本，不自动构建 |
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

**当前分工（用户2026-10-04指定，本轮延续）：主线实现与类型/构建基础检查；功能测试及真实模型验收交其他对话。** 笔记/反馈/路线/记忆/项目任务均未运行功能测试或改规格；2026-10-05新增 `docs/testing/memory-acceptance.md`、`docs/testing/planning-acceptance.md` 详细清单（不是已执行测试）。测试方补齐v5～v9真实结构迁移/保留、CRUD/冲突/关联、导出/取消、协议/确认/恢复/引用、记忆隐私/单次确认及任务状态和计时签到隔离，更新旧断言/桥接清单；构建成功不等于功能通过。

日常开发以当前功能的基础验证为准，选择最小但有效的检查。纯文档改动核对事实、路径、命令和 diff 即可，不启动桌面或完整测试。与代码无关的已有 RED 规格要记录，不借文档任务扩大范围修复。

相关测试示例：

```powershell
npx vitest run electron/core/models.test.ts
npx vitest run electron/core/storage.test.ts
npx vitest run electron/core/credentials.test.ts
npx vitest run electron/core/document-storage.test.ts
npx vitest run electron/core/documents.test.ts
npx vitest run src/lib/calendar.test.ts electron/core/study.test.ts
npx vitest run electron/core/chat.test.ts electron/core/chat-stream.test.ts
npx vitest run electron/core/retrieval.test.ts electron/core/search.test.ts electron/core/rag.test.ts src/lib/citations.test.ts
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
- 适配减少动画偏好；大文件、后台索引及模型推理不阻塞阅读、计时与取消操作。
- 新增依赖先复用已有组件和模块，避免仅为视觉修饰引入复杂框架。

## 13. 后续阶段与完成标准

| 阶段 | 交付内容 | 验收重点 |
| --- | --- | --- |
| 0 | 桌面骨架、数据库、空资料库、偏好保存 | 历史验收已完成，新增改动按实际情况再验证 |
| 1 | PDF/Markdown 导入与阅读，基础版本已交付 | 去重、损坏反馈、原文件复制、原页/排版、重启位置恢复、扫描件提示、取消与引用复制 |
| 2 | 聊天协议、可追溯 RAG、本地嵌入/混合检索与对比已交付；真实聊天质量待做 | 本地/云端真实同资料问答、引用语义质量、独立数据、规模与安装包 |
| 3 | 笔记/反馈/固定路线/记忆管理与确认已实现，独立验收仍待完成 | 独立写笔记、有出处、取消不写入、删除不再新使用、本机记忆不外发 |
| 4 | 手动项目/每日任务已实现待验收；Agent任务确认、番茄钟、主题、备份待开发 | 数据重启恢复、任务不混签到时长、中断不误完成、备份往返且无密钥 |
| 5 | 全流程与异常验证、RAG 对比、安装包、发布文档 | 新用户按说明完成学习闭环、发布包对应 Git 标签、公开发布有授权 |
| 6 | 静态展示网站 | 软件稳定后才建设，展示真实功能、评测与下载 |

用户 2026-10-04 将测试安排到其他对话，主线进入阶段 3；阶段 2 的未验收项继续保留。测试对话可继续独立验收，不为机械阶段编号停止主线实现；不冒称整阶段或首版已完成。

主线下一步是阶段4 Agent任务提议预览确认：手动项目/每日任务基础已实现，先读planning-storage、memory-proposals、learning-agent与ChatService，具体任务/项目/日期/版本由主进程缓存并复核，明确确认后才写，不把模型建议自动变进度。之后接任务关联番茄钟，保持一次检索/一次起草、不推断掌握。测试对话继续笔记/反馈/路线/记忆/项目任务与真实质量验收，使用README及docs/testing/memory-acceptance.md、docs/testing/planning-acceptance.md，保留既有失败。阶段3/4不能因构建通过勾为已验收；网站最后。

## 14. Git、隐私与协作流程

### 开始工作

- 查看 `git status --short --branch`、近期提交、README 的阶段状态和本任务涉及的文件。
- 分清已提交代码、未提交实现、未追踪资料和测试规格；工作区不干净不代表可以丢弃或重做。
- 只在任务需要时创建新分支；当前分支有其他工作时不擅自切换、变基、合并或清理。
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
