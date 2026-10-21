# 拾知全局代码审查与测试交接：2026-10-16

**结论：本轮确认 8 项功能／异常边界问题、1 项测试门禁问题，另列 2 项仍可复现的检索质量问题。现有核心和普通桌面套件通过，不覆盖下述补充失败。本文供另一个窗口逐项修复，本窗口没有修改业务代码、既有测试或候选包。**

## 1. 审查对象与执行边界

| 项目       | 本轮实际对象                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| 主工作区   | E:\私人学习助手，分支 codex/structured-notes                                                                  |
| 固定 HEAD  | 24efad1ef0e1c329557e29808cc7515281b92e85                                                                      |
| 应用／数据 | 0.1.1；主库 v13、活动库 v1、派生索引 v2；备份 format 1 接受 12/1 与 13/1                                      |
| 阅读入口   | AGENTS → README → 发布总表及各功能清单 → 当前发布计划；旧快照不覆盖当前状态                                   |
| 审查方法   | production-audit 的本地证据流程；静态审查权限／数据／异步／UI边界，执行完整核心、真实源码 Electron 和补充复现 |
| 独立构建   | 本次 artifacts 下的 source 为同 HEAD 的 detached worktree；独立生成 dist/dist-electron，未覆盖共享构建        |
| 依赖限制   | 测试 worktree 通过 junction 使用主目录已有 node_modules，并非重新 npm ci 的洁净安装验收                       |
| 数据与网络 | 仅合成资料、内存 SQLite／唯一临时目录与 STUDY_COMPANION_DATA_DIR；无个人学习库、真实密钥或收费 API            |
| 模型       | 混合评测实际使用固定本地 BGE；聊天／功能回答使用模拟服务。未重跑真实聊天语义评测                              |
| Git／安装  | 未修改生产代码、既有测试或他人 README/AGENTS；未 push、建标签、发布或执行正式安装器                           |
| 交付物     | 本文及独立忽略目录中的脚本、JSON、截图和测试产物；不偷换旧候选源码或包                                        |

审查覆盖自有 renderer、主进程、三个 worker、存储／迁移／备份、preload／共享类型／桌面封装、模型协议／检索、项目／任务／记忆／复习／专注，以及构建／分发脚本和 CI。清点 src 66、electron 77、scripts 18、工作流 2 份代码／样式文件（含相关测试、不含固定许可资产与 tests 目录）。对第三方预编译依赖、未追踪 markitdown、私人脚本与本机 .codex 配置不做逐行源码审计。

本文只将有证据的问题列为“确认”。条件性故障注入、真实桌面操作与历史质量限制分别标明；未证明远程可利用的问题不称为远程漏洞，未观察到的数据破坏不写成已经发生。审查不能承诺穷尽所有潜在缺陷。

## 2. 实际检查与结果

| 功能／检查                                       | 命令或项目                                                                                                                                      | 实际结果                           | 证明范围                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| 全部核心规格                                     | npm test -- --testTimeout=30000                                                                                                                 | **32 文件、356/356，通过**         | 参数、迁移、持久化、恢复、版本及已有边界                                                  |
| 打包／分发／签名／卸载器规则                     | node --test scripts/package-notices.test.mjs scripts/verify-package.test.mjs scripts/windows-signing.test.mjs scripts/nsis-uninstaller.test.mjs | **20/20，通过**                    | 纯文件／规则及负例；没有真实签名或安装动作                                                |
| 类型／规范                                       | npm run typecheck；npm run format:check                                                                                                         | **通过**                           | 两套 TypeScript 与源码格式                                                                |
| 生产构建                                         | 独立 worktree 内 npm run test:e2e 的 build 阶段                                                                                                 | **通过**                           | Vite／main／preload／三个 worker；保留已有大资源块提示                                    |
| 普通真实桌面                                     | npm run test:e2e                                                                                                                                | **36/36，通过，7.9 分钟**          | 源码 Electron／IPC／utility；含真实五分钟、迁移恢复、强退、模拟协议、主题／键盘／最小窗口 |
| 接口连接                                         | interface-wiring.test.ts，已包含于356项                                                                                                         | **90方法＝84请求＋6事件，通过**    | 类型／封装／preload／处理器对应、无重复频道、事件解除监听                                 |
| 关键词回归                                       | npm run eval:retrieval                                                                                                                          | 命令退出0；**逐题仍有 Q-01/Q-02**  | 27题合成回归集，不能称全部质量通过                                                        |
| 真实本地混合回归                                 | npm run eval:hybrid                                                                                                                             | 无降级、退出0；**逐题仍有 Q-02**   | 真实固定 BGE／Node CPU；无聊天生成，不替代 Electron CPU 门禁                              |
| 真实嵌入桌面门禁                                 | npm run test:embedding                                                                                                                          | **0/1，失败 R-09**                 | 在旧按钮定位器处停止，后续推理／重启／损坏路径未在这条规格完成                            |
| 补充核心复现                                     | core-contracts.ts                                                                                                                               | 5个边界均确认问题                  | 详见 R-01、05～08；取消退出时序使用受控模拟进程                                           |
| 补充桌面复现                                     | ui-contracts.ts、corrupt-confirmed.ts                                                                                                           | 4个场景确认问题                    | R-01～04；初次损坏会话采集器超时原样保留，后续独立取证                                    |
| 无效路线完整备份                                 | backup-route.ts                                                                                                                                 | 导出和 verifyBackup **错误地接受** | R-07；真实两库、资料和完整清单／摘要                                                      |
| 修改检查                                         | git diff --check                                                                                                                                | 通过                               | 不代表功能正确                                                                            |
| 正式包安装／升级／卸载、本轮远端CI、真实聊天质量 | 本轮未执行                                                                                                                                      | **未执行／未验收**                 | 不沿用历史次数为本轮背书                                                                  |

上次2026-10-12报告中的硬换行、格式拆分编号和两份格式阻断已由后续代码修正，不再列为待修复。当前新增问题如下，各项均独立交接。

## 3. 确认问题总表

P2 表示应安排修复的功能／可靠性问题；不将条件性数据故障或测试过期夸大为已证实的远程攻击。

| 编号 | 级别 | 类型               | 问题                                                        | 证据                                            |
| ---- | ---- | ------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| R-01 | P2   | 数据边界／故障恢复 | 非数组证据越过 ChatStorage 解码，默认会话可使整个界面白屏   | CORE-CHAT-DECODE、corrupt-chat-confirmed.json   |
| R-02 | P2   | 异步导航           | 迟到的引用解析覆盖用户后续页面选择                          | UI-LATE-CITATION                                |
| R-03 | P2   | 跨页面状态连接     | 轻量复习更新后，测验页持续用旧 revision；刷新会话仍无法保存 | UI-REVIEW-CONFLICT                              |
| R-04 | P2   | 阅读／引用连接     | 同章节表格行与多列表项不能复制引用／提问／加入笔记          | UI-MARKDOWN-SELECTION                           |
| R-05 | P2   | 子进程生命周期     | 检索取消在实际退出前解锁，可启动第二个索引进程              | CORE-CANCEL                                     |
| R-06 | P2   | 跨模块限额         | 合法路线合成任务说明后超4000字，无法生成批量预览            | CORE-BATCH-LIMIT                                |
| R-07 | P2   | 恢复输入校验       | 已完成 steps-v1 路线的无效输出可以导出并通过完整备份校验    | CORE-RESTORE-ROUTE、malformed-route-backup.json |
| R-08 | P2   | 容量／备份连接     | 资料导入未限制总数，超过10000后完整备份被拒绝               | CORE-SOURCE-CAP                                 |
| R-09 | P2   | 测试维护           | 真实 BGE Electron 门禁仍等待已不存在的“模型已就绪”按钮      | embedding.real.ts:61及trace                     |

### R-01：会话证据缺乏运行时解码校验，可造成全界面白屏

- **位置：** electron/core/chat-storage.ts:42、59、72；src/components/ModelAnswer.tsx 的引用转换；src/lib/citations.ts 的 evidence.some。
- **触发条件：** 本地某轮 evidence 是合法 JSON 对象 {}，而非证据数组。SQLite 的 json_valid 约束允许该值；这是受控损坏数据／历史数据异常注入，不是通过当前正常发送接口制造的记录。
- **最小复现：** 在临时库建立普通会话和一轮 sources/completed 回答，答案含 [1]，将 evidence 置为 {}；调用 storage.chat.get，该值原样返回。再以该会话为默认记录启动源码 Electron。
- **实际：** 主进程成功返回非数组；renderer 抛出 t.some is not a function。实际 bodyText=""、主导航数量0，preload仍存在，但软件界面白屏；尚未点击学习助手也可能在隐藏 ChatPage 初始化时发生。
- **期望：** 主进程读取时返回 chatCorrupt 等结构化错误，保留导航和数据恢复入口；不要将坏记录伪装为 []。
- **影响：** 一份异常会话可阻断整个工作台的使用；没有证据表明个人数据被删除或攻击者获得系统权限。
- **修复方向：** 给持久化聊天轮次补充与其实际使用一致的 evidence／基本字段校验，取消未经验证的类型断言；界面错误边界可作为附加兜底。不能降低完整备份对坏证据的拒绝规则。
- **复验：** get/getTurn 对 {}、null、null数组元素和字段缺失给明确错误；真实 Electron 仍可导航／管理其余数据，正常历史与引用不受影响。
- **证据：** core-contracts.json → CORE-CHAT-DECODE；corrupt-chat-confirmed.json；corrupt-chat-startup.png。初次 UI 采集器因导航已消失而超时，ui-contracts.json 保留该失败；最终取证使用新启动、无后续按钮点击。

### R-02：迟到的引用解析抢回页面，覆盖用户的新导航

- **位置：** src/App.tsx:189～206；复习出处的同类回调 src/App.tsx:565～574。
- **最小复现：** 在合成资料问答中点击有效“引用1”；令原有、包含权限及来源校验的 resolve-citation IPC 结果延迟1500ms；在它返回前点击“学习计划”。
- **实际：** 学习计划先正常显示，迟到结果随后 setSourceId/setPage，界面回到“版式验收”的资料阅读；planningVisible=false。截图显示资料库已成为当前页面。
- **期望：** 较新的明确导航应保留；过期跳转不覆盖当前页面。连续点击不同出处也应按最新意图收口。
- **影响：** 慢磁盘或较大文件的摘要核对期间，用户会被带离正在操作的页面，可能误操作后续界面。
- **修复方向：** 在顶层导航建立轻量请求序号／意图校验，所有导航及返回操作使旧解析失效；普通、笔记、路线、复习出处一并核对。不要只在一个按钮禁用界面。
- **复验：** 延迟解析期间导航、连续点击两个出处、阅读侧栏关闭／换资料、失败返回；均不覆盖较新的操作，错误也不污染新页面。
- **证据：** ui-contracts.json → UI-LATE-CITATION；late-citation.png。原采集器的 readerVisible 使用了错误的.reader-page选择器，不作为结论依据；结论依据是先显示计划的断言、最终planningVisible=false、h1与真实截图。

### R-03：复习与测验页没有共享作答更新，形成持续版本冲突

- **位置：** src/components/PracticeResult.tsx:32～67、75；src/components/ModelAnswer.tsx 以 turn.id 为 key，页面保持挂载。
- **最小复现：** 在学习助手为测验第1题保存“第一份作答”（revision1）→去轻量复习保存“第二份作答”（revision2）→返回原测验，输入“第三份作答”并保存→点击“刷新会话”后再次保存。
- **实际：** 测验仍显示第一份内容，提交旧revision1；两次均提示“作答已更新，请先重新读取”。当前草稿保留、数据库仍是第二份，乐观锁正确；界面没有重读作答的入口，刷新会话也没有触发 listReviews。
- **期望：** 页面重新可见时安全读取当前作答版本，或提供保留草稿的明确冲突重读／比较流程；不能长期停留在无法提交的状态。
- **影响：** 同一个应用内部的正常跨页操作即可触发，用户需要离开整个会话或重启才能重建作答组件，草稿处理成本高。
- **修复方向：** 将实际作答更新／可见性传到 PracticeResult，或增加明确读取作答动作。保留新输入并要求用户决定覆盖，不自动使用新revision重发旧内容。
- **复验：** 上述完整顺序、未保存草稿、已有日期／疑问、返回引用、同一题双入口更新；保证不会静默覆盖新值。
- **证据：** ui-contracts.json → UI-REVIEW-CONFLICT；stale-review.png。实际数据库revision2、第二份内容；第三份输入仍保留。

### R-04：Markdown解析与阅读渲染不一致，表格／列表选文无法核对

- **位置：** electron/core/document-parser.ts:18、43；src/components/ReadingPage.tsx:384 附近的 remarkGfm 渲染和193～235选文动作；electron/core/documents.ts:selection。
- **最小复现：** 同一个章节内放表格“方法｜行动／主动回忆｜独立回答”与列表“- 先阅读／- 再复述”；阅读时选中表格一行的两格，或两个列表项，点击“复制引用”。
- **实际：** 界面选文分别是“主动回忆\\t独立回答\\n”“先阅读\\n再复述”；存储段落的表格仍含Markdown竖线／分隔行，列表却被合并为“先阅读再复述”。两种合法同章节选文均报“请选择同一页或同一章节内的原文，再复制引用”。
- **期望：** 读者看到的同章节连续选文能映射到同一套原文文本及精确偏移；确实跨章节／改写的文字仍拒绝。
- **影响：** 复制引用、提问选中原文、加入笔记草稿共用该校验，都会受影响，限制了已支持的Markdown表格／列表阅读。
- **修复方向：** 统一GFM解析和可见文字提取，正确保留块／列表项／单元格边界；若更新段落或派生内容，设计已有资料与检索缓存的兼容处理。不能靠移除来源校验或宽松删除全部标点解决。
- **复验：** 表格跨格、列表跨项、强调／链接文字、段落换行、单元格、跨章节拒绝，检查真实偏移、重启引用与缓存行为。
- **证据：** ui-contracts.json → UI-MARKDOWN-SELECTION；markdown-selection.png；本轮实际 parser 的输出也已核对。

### R-05：检索取消在进程真正退出前解除忙碌锁

- **位置：** electron/core/search.ts:200～214，finish 内 worker.kill 后立即清空 active；与 exit 分支的时机不一致。
- **最小复现：** 受控launcher模拟“kill请求已发出，但exit尚未到达”的合法进程状态；启动prepare→cancel→等待第一次Promise返回cancelled→立即再次prepare。
- **实际：** 此时busy=false、workerExited=false，而workerCount已变为2。原进程仍未退出，第二次索引已经获准启动。
- **期望：** 待旧进程exit后才能解锁新索引／依赖空闲状态的维护操作，且迟到事件不影响新请求。
- **影响：** 允许两个索引写入生命周期重叠，可能引出SQLite占用、重建替换及备份空闲判断竞态。本轮证明的是状态／启动次序错误，**未观测到真实旧索引已经损坏**。
- **修复方向：** 分离“已请求取消”与“已退出”，等待实际exit后结算锁／清理，类似现有BackupRunner的退出收口；保留有界超时及无法结束时的明确错误。
- **复验：** 延迟exit、kill返回false、取消后立即重建／提问／备份、迟到result、异常exit及已有语义降级。不要只增加固定sleep。
- **证据：** core-contracts.json → CORE-CANCEL；这是明确标记的受控时序测试，不冒充真实Windows进程退出测量。

### R-06：路线与任务字段上限不一致，合法编辑无法转任务

- **位置：** src/lib/learning-plan.ts:3～10、70～81；electron/core/task-proposals.ts:122～135；src/lib/planning.ts:details=4000。
- **最小复现：** 有效steps-v1路线共2步、每步5分钟，总预算10；每步action2000字、artifact500字，limitations2000字，每步关联真实[1]。输出总7168字符，parseLearningPlan成功；选择两步调用prepareBatch。
- **实际：** 任务details把行动、作品、共同limitations、来源和说明拼在一起，超过4000字；抛出“任务说明格式不正确或过长”，没有预览。
- **期望：** 被路线编辑器判为合法的内容应可预览为任务，或提前明确说明该步骤转换后的超限位置与剩余容量，而不是全部核对后才失败。
- **影响：** 长步骤或较长待求证范围可以正常完成路线校验，却阻断规划到任务的主流程。
- **修复方向：** 对最终任务草稿统一核算限制，协调路线字段与任务字段容量；保留用户文字，不静默截断。无需为此重构通用任务框架。
- **复验：** 正好4000／4001、多个来源、长资料名、多步共同限制、部分步骤选择；事务仍应全成或全不成。
- **证据：** core-contracts.json → CORE-BATCH-LIMIT。

### R-07：完整备份校验没有核对已完成结构化路线的输出

- **位置：** electron/core/backup-data.ts:186～230，完成态只对practice调用parsePractice；普通模型路线没有对应parseLearningPlan检查。
- **最小复现：** 临时v13库内放一轮合法普通资料证据、learningRequest.format=steps-v1、minutes10、status=completed，但answer="this is not route JSON"；它不是空证据或指令保护说明。提供真实两库和对应资料，执行writeBackup，再对完整目录执行verifyBackup。
- **实际：** 生成时的parseLearningPlan明确拒绝该答案；inspectDatabases、完整导出和完整verifyBackup却全部接受该轮，counts.turns=1。
- **期望：** 真正的已完成模型结构化路线遵守与生成完成相同的形状、引用、预算约束；恢复前拒绝无效输出。
- **影响：** 摘要和schema均正确的损坏备份仍可夹带“完成但无效”的路线，恢复后失去结构化编辑／任务入口的一致性。
- **修复方向：** 对相应生成路线复用同一解析器，**保留旧Markdown、空证据说明及合法的本地指令保护说明兼容分支**；不能一律要求所有历史learning回答都是JSON。
- **复验：** 缺字段、预算错、未知编号、错误JSON；同时覆盖旧Markdown／旧版本备份、stopped/error/interrupted部分回答，以及上述合法本地说明。
- **证据：** core-contracts.json → CORE-RESTORE-ROUTE；malformed-route-backup.json。后者记录真实writeBackup与verifyBackup均接受的完整包，不仅是静态推断。

### R-08：导入总量无上限，与完整备份上限脱节

- **位置：** electron/core/documents.ts:import 只限制单批20份；electron/core/storage.ts:addSource未限制总量；electron/core/backup-data.ts:148与src/lib/backup.ts:files=10002。
- **最小复现：** 用实际Storage.addSource保存10001份不同hash的合成Markdown来源，再用SQLite一致性快照落盘并建立活动库；调用inspectDatabases。
- **实际：** 来源写入全部成功，listSources=10001；备份校验立即以“备份记录数量超过当前应用限制”拒绝，尚未检查资料文件。
- **期望：** 正常允许积累的资料量与完整备份能力一致；达到支持边界前应阻止继续导入并清楚解释，不能到备份时才暴露。
- **影响：** 长期资料库可经正常批量导入达到无法完整备份的状态；当前固定桥接也没有资料删除入口供用户自行回到限制内。
- **修复方向：** 协调导入与备份的容量政策，在导入提交边界计入现有数量；已经超限的数据须有保留原数据的处理方案，不能简单删除记录或降低备份断言。
- **复验：** 9999／10000／10001、包含重复资料的批次、失败和取消不占容量、旧超限库可阅读且错误明确。
- **证据：** core-contracts.json → CORE-SOURCE-CAP；10001条通过真实存储方法生成，备份count错误发生在资料副本验证前，不把未生成10001个物理副本写成大库完整导入验收。

### R-09：真实嵌入桌面门禁仍使用旧按钮文案

- **位置：** tests/embedding.real.ts:61；当前按钮为src/components/EmbeddingSettings.tsx:121的“模型文件已校验”。
- **最小复现：** 准备已有、逐摘要校验的固定BGE五文件，在本次独立构建中运行npm run test:embedding。
- **实际：** 0/1，退出1；在“模型已就绪”按钮等待5秒超时。实际无障碍快照显示“模型文件已校验”且disabled，文件状态为ready。
- **期望：** 门禁与已交付界面约定一致，随后真正执行原有CPU、同义检索、出处、取消、重启缓存和损坏降级断言。
- **影响：** 当前明确提供的真实BGE Electron测试命令不能完成，核心／36条普通桌面通过也无法代替这项门禁。
- **修复方向：** 更新过期定位器并结合真实文件状态校验；保留后续推理／重启等全部断言。不能删测试、skip，或把模型文件校验说成推理已通过。
- **复验：** 原完整单条规格通过，保留本次失败与修复后的新日志。Node下eval:hybrid本次确实执行成功，故此处是测试连接错误，不据此判定ONNX坏了。
- **证据：** commands-results.json 的realEmbedding；source/test-results/embedding.real.ts-real-CPU-7a75d-ors-and-survives-corruption/error-context.md与trace.zip。

## 4. 单独保留的检索质量问题

这些是本轮重新跑到的既有失败／干扰，均属于已参与开发的固定回归集，不能声称新独立成绩；也不是对真实模型自然语言结论的语义评分。

### Q-01：关键词模式缺少内存同义题的一个必要锚点

- **题目：** synonym-memory，“内存不够为什么还能运行程序？”
- **实际／期望：** 期望page-1和page-2，FTS只返回page-2，单题recall0.5、passed=false；v1均值Recall@4=95.83%。
- **影响：** 没有可用BGE时，关键词降级下该问题的证据不完整。
- **修复／复验方向：** 保留题目及标注，改善受限语义／关键词覆盖，不能删掉必要锚点。真实混合本轮已找全两锚点，不把它误写成混合也漏召回。
- **证据：** source/artifacts/retrieval-evaluation.json → datasets[v1].cases[synonym-memory]。

### Q-02：TCP可靠性题仍混入不回答问题的共享词片段

- **题目：** ind-tcp-reliable，“TCP用什么机制保证可靠传输？”
- **实际／期望：** 正确networking/md-line-1之外，还带回distractor/md-line-1的内容分发网络段。FTS和真实混合该题TargetPrecision均0.5；v2总体95%。
- **影响：** 无关片段增加错误归因风险；编号和位置都有效也不能证明结论受支持。
- **修复／复验方向：** 保留干扰资料与真实答案标注，改善相关性选择且核对是否牺牲其他多锚点题。数据集case.passed按覆盖条件计算，不能把true当作没有误召回。
- **证据：** source/artifacts/retrieval-evaluation.json与hybrid-retrieval-evaluation.json → datasets[v2].cases[ind-tcp-reliable]。

## 5. 代码规范、安全与接口审查说明

- 当前Prettier和两套strict TypeScript检查通过，没有把个人风格偏好或未引入某个lint工具单独当bug。修复不要顺手全库格式化／重构。
- 共享DesktopApi／desktop封装／preload／主进程90方法对应规格通过；contextIsolation、sandbox、nodeIntegration、主窗口／主frame及精确URL检查、导航阻止、权限默认拒绝仍在。
- 查看了模型地址／重定向／密钥绑定／固定worker、参数化SQL、导出路径保护与备份输入约束。此次没有验证出可复现的任意SQL／任意系统命令／远程HTML执行链，不能扩大为整个应用不存在安全漏洞。
- R-01、R-04、R-06、R-07、R-08反映同一类维护风险：UI表示、持久化结构、生成验证与恢复／转换边界的约定出现漂移。应在涉及的边界复用实际契约并增加有行为意义的回归，不需要重写全局架构。
- 既有大JS资源块提示仍存在，本轮正常桌面交互规格通过；没有足够性能证据把构建警告单独定为运行性能缺陷。

## 6. 证据、脚本与交接方法

本次唯一证据目录：

```text
E:\私人学习助手\artifacts\full-review-20261016-4989d909-0611-4807-886d-1e5bfc858bfa
```

重要文件：

| 文件                                              | 内容                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| start.json                                        | 起点HEAD／共享未提交清单                                                                     |
| commands-results.json                             | 核心、规则、类型格式、完整桌面结果说明、两种评测与真实门禁实际输出；说明保存的是哪些终端片段 |
| core-contracts.ts／core-contracts.json            | 五项核心边界复现与逐项观察                                                                   |
| ui-contracts.ts／ui-contracts.json                | 跨页保存、迟到导航、表格／列表，以及原始第四项采集失败                                       |
| corrupt-confirmed.ts／corrupt-chat-confirmed.json | 损坏会话最终独立桌面取证                                                                     |
| backup-route.ts／malformed-route-backup.json      | 无效完成路线的完整备份接受证明                                                               |
| *.png                                             | 实际截图，只有合成数据                                                                       |
| source/                                           | 固定HEAD的独立测试worktree、实际构建与被测规格                                               |
| source/artifacts/*retrieval-evaluation.json       | 关键词／真实混合逐题报告                                                                     |
| source/test-results/embedding.real.ts-*/trace.zip | 本次真实嵌入门禁的失败trace                                                                  |

原始ui-contracts进程退出1，因为第4项在白屏后仍尝试点击导航而超时；前三项观察有效，第四项以corrupt-confirmed的独立结果为准。后续一次取证脚本生成错误／reload失败没有算产品失败，原有观察也没有被改成通过。完整36项桌面的终端已实际显示通过、进程退出0；随后独立embedding运行将同一source/test-results/.last-run.json写成failed，不以这个最后单文件否定或冒充之前36项结果。两个套件结论在第2节分别记录。

复现脚本仅创建自己的合成临时数据、注入受控transport／延迟或坏行；生产TS从固定worktree读取并在内存打包。它们是观察收集器，脚本退出0不等于产品满足契约，应检查各项confirmed／actual与本文期望。ui-contracts的初始故障不能跳过或删掉。

可复跑（建议先复制证据目录或设置新输出目录，避免覆盖自己的旧JSON）：

```powershell
$env:STUDY_REVIEW_OUTPUT = '本次新的、已建立的证据目录'
node '上述证据目录\run-ts.mjs' core-contracts.ts
node '上述证据目录\run-ts.mjs' ui-contracts.ts
node '上述证据目录\run-ts.mjs' corrupt-confirmed.ts
node '上述证据目录\run-ts.mjs' backup-route.ts
```

run-ts.mjs 默认读取其同目录脚本、使用其source工作区；首次core-contracts会建立后续backup-route需要读取的core-contracts.json。修复后测试其他提交时，必须用自己的独立工作区及构建，不悄悄更换本次固定source。修复窗口应把所需复现整理为正常核心／Electron回归，再验证相关老规格，保留前后结果。

## 7. 建议修复顺序与验收约定

1. 先R-01与R-07，保证异常数据读取和恢复边界清楚、界面可恢复；保留所有合法历史分支。
2. R-02～R-04与R-06，补齐真实用户流程的导航、作答状态、选文和任务转换。
3. R-05与R-08，统一实际进程结束和容量边界；不得靠固定等待或删已有数据规避。
4. 修正R-09的测试连接并执行原完整门禁；Q-01/Q-02作为明确的质量改善单独处理，不靠改题或降低指标通过。

每项修复应有新提交、原最小复现的前后结果及适当回归；实际包如果包含修复，需重新固定源码构建并按影响复验。未获得本窗口的新分发授权前，不由本审查窗口上传／替换已发布附件。

README/AGENTS当前已有其他窗口未提交修改，本轮没有覆盖其内容；真实记录单独写入本文。未修改已有测试、未改变数据库／IPC契约、未生成修复提交。交接方可直接引用本文编号，不把本轮核心／桌面通过数量换成“全部功能或模型质量均无问题”。

未覆盖项：正式发行包在独立用户／VM的再验、不同机器／复杂真实PDF、真实收费云API、真实聊天跨学科语义、全容量向量规模及第三方依赖逐行审计。已有历史证据保留原版本与范围，未自动转换成本轮通过。
