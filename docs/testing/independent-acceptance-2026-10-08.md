# 2026-10-08：v12 独立审查与验收

**结论：本候选不通过发布验收。** 已执行源码功能、真实 SQLite 迁移/备份、真实 Electron 流程及本机 Ollama/BGE。确认三项生产问题（F1～F3），保留失败回归；真实模型也存在引用与预算遵循失败。安装/升级/卸载按用户回复保持未执行。没有修复生产代码、重打旧包、推送、标签或发布。

## 1. 被测身份与隔离

| 项目       | 实际记录                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 固定包源码 | `471e0a73ddc57ab355477b1daab0b8065067efa2`                                                                                                                                |
| 验收基线   | `71c2c25`，分支 `codex/v12-independent-acceptance`；与固定源码的差异仅为五份文档，运行源码/依赖锁相同                                                                     |
| 独立工作区 | `C:\Users\Vionikos\.codex\worktrees\ce74\拾知-v12验收`；新增/修改测试与验收文档，不修改生产源码或依赖                                                                     |
| 原工作区   | `E:\私人学习助手` 的 README/AGENTS/交接提示、MarkItDown 下载及 start-ollama 脚本保持原状；旧 v5 验收工作区也保留                                                          |
| 环境       | Windows 11 Pro 10.0.26200 x64；Node 24.16.0 / npm 11.13.0 / Electron 44.5.1；i7-14650HX，24 逻辑核，约 31.72 GiB RAM                                                      |
| 数据       | 每项使用新建 `%TEMP%\study-*` 与 `STUDY_COMPANION_DATA_DIR`；未访问个人 `%APPDATA%\StudyCompanion`                                                                        |
| 协议模拟   | 自建 loopback Ollama/OpenAI 服务、假密钥；远程隐私场景把假 HTTPS 地址在该测试进程映射至本机 SSE 服务，不验证真实 TLS/云服务                                               |
| 真实模型   | 本机 Ollama `qwen3.5:9b`，9.7B Q4_K_M；digest `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`；BGE 固定权重从开发 artifacts 复制并重新校验，无收费请求 |
| 产物       | 仅只读核对既有 UUID 包，未启动正式 EXE/安装器；用户已确认隔离用户/VM 尚未准备                                                                                             |
| 原始证据   | 本工作区 `artifacts/acceptance-v12-20261008/`，另有两份 retrieval-evaluation JSON；均为合成数据、忽略产物，不进入 Git                                                     |

原生选址/确认通过替身选择测试位置和按钮，Electron、IPC、SQLite、文件写入、utilityProcess 和后续启动均真实执行。备份自动 OS relaunch 被替身抑制；程序正常退出后测试显式重新启动相同隔离根目录，**不宣称自动重启机制或安装版已验收**。

## 2. 功能 × 清单项 × 结论

“通过”只表示本行列明的操作；复合清单中未执行的条件仍未勾选。

| 功能                 | 清单项/已执行操作                                                                                                                                        | 结论                         | 未执行或失败边界                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| 结构化笔记 v5        | 四部分、来源、保存/冲突/另存/删除/导出；真实 v1～v11 迁移，正常及强退重启恢复                                                                            | 通过                         | 原生弹窗人工操作、安装版未执行；未保存草稿强退丢失是既定边界                             |
| AI 笔记反馈 v6       | 只用保存版本、12k 拒绝、版本竞争、单活动请求、空证据零请求、用途隔离、级联删除；真实 UI 生成且原笔记未改                                                 | 通过                         | 真实模型有笔记快照误读 M2；复杂资料、质量矩阵未验收                                      |
| 受控路线 v7          | 单次检索/生成、预览/配置/记忆复核、用途隔离、取消不写；真实 UI 起草                                                                                      | 通过                         | 真实模型 30 分钟预算只分配 27 分钟（M3）；四段内容质量不由程序强制                       |
| 长期记忆 v8          | CRUD/范围/来源/限额/冲突/选择版本；预览、拒绝、单次确认、失效；真实 UI 保存/脏稿取消/冲突/删除与提议                                                     | 通过                         | 来源删除后已确认记忆保留；完整异步乱序/应答丢失矩阵未执行                                |
| 学习项目/每日任务 v9 | 日期/限额/归档关联、独立完成/重开、乐观锁；真实 UI 创建、保存、完成、重启                                                                                | 通过                         | 首页跨午夜/系统日期变动、全部导航竞争未执行                                              |
| 单任务提议 v10       | 资格、过期/丢弃/单次确认、项目变动、失败缓存/上限/来源复核；真实 UI 拒绝及确认后只新增 todo 任务                                                         | 通过                         | 全部应答丢失/乱序、长中文复杂布局未执行                                                  |
| 任务番茄钟 v11       | 真正五分钟计满、短轮暂停/继续/提前结束、复盘；重载/退出/进程树强退及实际 31.1 秒主进程停顿；核心存储失败冻结                                             | 通过                         | 真正 OS 睡眠/唤醒、物理磁盘故障未执行；仅注入 Electron suspend 事件                      |
| 完整备份/恢复        | 两库/资料、九类数据、行值/rowid、排除密钥/模型/索引/草稿；真实 worker 导出/预览/原生取消/确认/启动切换/旧目录/手动回退；维护锁/取消、worker 实际崩溃失败 | 通过                         | F1：非法阅读 tone 能导致合法数据导出失败；真实断电/fsync/磁盘满/跨版本旧程序回退未执行   |
| 三种主题             | UI 原生 radio/键盘/保存后切换/重载；9 种风格组合；三主题×9 页面及 125/150/200% 缩放取证                                                                  | **失败 F2/F3；偏好保存通过** | 最小窗口侧栏不可用；现代主题辅助文字对比度不足；读屏、长内容、各主题两库恢复全矩阵未执行 |
| 历史管理             | 用途/版本/busy/标题/删除隔离、字面 Markdown；真实 UI 改名/导出/原生取消/删除，路线删除保留确认任务/记忆且未确认提议失效                                  | 通过                         | 文件占用/磁盘满/并发原生弹窗及完整迟到恢复矩阵未执行；小窗口 F2                          |
| 知识卡片/短测验 v12  | 严格3项、字段/类型/编号/长度拒绝、无证据零请求；真实 UI 翻面/作答/对照/失败原文；作答不保存/不导出；合法/非法备份快照                                    | 通过                         | 真模型测验有证据外扩展 M4；少事实/两来源/歧义质量矩阵与真实云模型未验收                  |
| 首页学习闭环         | 六步入口抽样、真实计划/专注/复盘/签到；AI 反馈→路线→明确任务/记忆确认；日历/阅读/问答/笔记独立桌面流程                                                   | 通过                         | **不是一条完整从导入到 AI 复盘的单次旅程**；跨日/焦点/维护锁迟到矩阵未执行；F2           |
| Windows x64 候选     | 全文件列表/4510 个摘要及大小、NSIS 摘要、来源、ASAR/worker/PDF/native 静态只读核对                                                                       | 通过                         | 目录包/安装版运行、安装/升级/卸载、分发许可/远端 CI：未执行                              |
| 阅读位置运行时校验   | 实际 IPC 提交数组 tone，随后备份校验                                                                                                                     | **失败 F1**                  | 写入了不合法状态；真实核心与 Electron RED 保留                                           |
| 900×640 导航         | Playwright viewport 与原生 contentSize，两次独立复现                                                                                                     | **失败 F2**                  | 设置按钮完全在视口外；既有桌面规格及新增原生规格均失败                                   |
| 现代主题正文对比度   | 设置页“分钟”实际 computed style / 不透明背景                                                                                                             | **失败 F3**                  | 9px、3.6306:1，低于普通文字 4.5:1；新增 RED 保留                                         |
| 真实本机生成与引用   | 6 个证据场景＋3 种风格＋1 个实际检回的注入场景，逐条人工比对                                                                                             | **失败 M1～M4**              | 十个小样本，不是泛化准确率；真实云模型未验收                                             |
| 独立检索质量         | 开发 v1 与独立 v2 分开，关键词与真实 BGE 混合；位置核对                                                                                                  | **失败 R1（完整召回）**      | 混合独立集两个问题缺锚点；位置/编号通过不能证明答案语义                                  |
| 规模                 | 500 份预置合成 Markdown、约11.98MB、5000 段/9000 FTS 块、查询/IPC/取消                                                                                   | 通过                         | 仅 FTS 单机样本；真实 PDF 批量导入、大规模 BGE、峰值内存/长稳未验收                      |
| 安装/升级/卸载       | 独立 Windows 用户/VM                                                                                                                                     | **未执行**                   | 按用户回复保留，不在个人账户运行正式包                                                   |

## 3. 实际命令与执行结果

下列命令在独立验收工作区执行。失败没有记成通过；测试文件中的旧版本/旧禁用导航假设改为当前契约，旧库夹具改用真正历史 DDL，未删原保护或修改生产代码。

| 编号 | 命令/操作                                                                                                                                                                 | 结果                                                                                     | 证据                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| C0   | `npm ci --no-audit --no-fund`                                                                                                                                             | 通过，独立515包                                                                          | npm-ci.log                                                                         |
| C1   | `npx vitest run electron/core/migrations-v12.test.ts`                                                                                                                     | 19/19 通过                                                                               | migrations.log/json                                                                |
| C2   | `npx vitest run electron/core/planning-memory-focus.test.ts`                                                                                                              | 33/33 通过                                                                               | planning-memory-focus.log/json                                                     |
| C3   | `npx vitest run electron/core/backup-acceptance.test.ts`                                                                                                                  | 20/20 通过                                                                               | backup.log/json                                                                    |
| C4   | `npx vitest run electron/core/ai-workflows.test.ts electron/core/boundary-review.test.ts`                                                                                 | 18 通过/1 失败 F1                                                                        | ai-boundaries.log/json                                                             |
| C5   | `npm test -- --reporter=default --reporter=json --outputFile.json=artifacts/acceptance-v12-20261008/core-final.json`                                                      | **218 项：217 通过/1 失败**，25 文件；失败 F1                                            | core-final.log/json                                                                |
| C6   | `npx playwright test --reporter=list,json --output=artifacts/acceptance-v12-20261008/desktop-final-results`                                                               | **26 条：22 通过/4 失败**，0 跳过；F1 1条、F2 2条、F3 1条；含真实5分钟                   | desktop-final.log/json、trace、focus-five-minute/interruption JSON                 |
| C7   | `npx playwright test tests/backup-worker-exit.spec.ts tests/privacy-audit.spec.ts --reporter=list --output=artifacts/acceptance-v12-20261008/fault-privacy-final-results` | 追加2/2通过；真实结果前崩溃失败与假远程隐私                                              | fault-privacy-final.log、backup-worker-exit.json、privacy-desktop.json             |
| C8   | `npm run test:embedding -- --output=artifacts/acceptance-v12-20261008/embedding-real-results`                                                                             | 真实BGE桌面1/1通过，回答模拟；离线同义检索/引用/缓存恢复/损坏降级                        | embedding-real.log                                                                 |
| C9   | `npx playwright test --config=playwright.quality.config.ts`（首轮6场景）及 `--grep='ordinary chat'`（追加4场景）                                                          | 两个脚本各1条通过；**语义仍有失败**                                                      | real-quality.log/json、real-chat.log、real-chat-injection.json                     |
| C10  | `npm run eval:retrieval` / `npm run eval:hybrid`                                                                                                                          | 命令通过；完整召回保留失败 R1                                                            | retrieval.log、hybrid.log；artifacts 两份评测 JSON                                 |
| C11  | `npm run desktop:build`、后续 `npm run typecheck`、收尾 `npm run desktop:build`                                                                                           | 构建/类型通过；不是功能通过                                                              | desktop-build.log、typecheck-third.log、desktop-build-final.log                    |
| C12  | `node artifacts/acceptance-v12-20261008/audit-candidate-readonly.mjs`、`Get-AuthenticodeSignature`                                                                        | 摘要/文件/来源通过；签名 NotSigned；未执行包                                             | candidate-static-recheck.log、candidate-independent.json、installer-signature.json |
| C13  | 本轮文件 Prettier、`npm run format:check`、`git diff --check`                                                                                                             | 本轮28份TS/配置格式通过，diff通过；**全仓格式失败**：两份起点就不合规的文件，原内容保持  | format-write.log、format-independent.json、format-check-final.log                  |
| C14  | `node artifacts/acceptance-v12-20261008/audit-interface.mjs`                                                                                                              | 静态 AST：77 方法/71 请求/6 事件，types/desktop/preload/main 一致；隔离与 frame 校验存在 | interface-audit.log/json；不等于全部恶意 IPC 测试通过                              |
| C15  | 证据目录初始化后定向桌面复验（下方完整命令）                                                                                                                              | 5条：2通过/3失败，仍为 F1/F2/F3；没有新的程序失败                                        | closeout-red.log、closeout-red-results；原JSON/截图另存before-closeout-*           |
| C16  | `npm test -- --reporter=default --reporter=json --outputFile.json=artifacts/acceptance-v12-20261008/core-closeout.json`                                                   | 收尾再验218项：217通过/1失败 F1                                                          | core-closeout.log/json                                                             |

C15实际命令如下。收尾只补齐新规格自身的证据目录初始化并格式化；断言、生产源码和计时方式不变。原有JSON/截图保存为 `before-closeout-*`，五分钟与真实模型结果没有为收尾重新生成或覆盖。

```powershell
npx playwright test tests/acceptance-v12.spec.ts tests/themes-audit.spec.ts tests/backup-worker-exit.spec.ts tests/privacy-audit.spec.ts --grep='array-valued|native minimum|normal text contrast|process crash|remote memory scope' --reporter=list --output=artifacts/acceptance-v12-20261008/closeout-red-results
```

首轮核心 86 项中 82 通过/4 失败是旧 schema 期待与降版本号伪夹具导致；修正测试契约后最终仅 F1。首轮桌面 12 条中 9 通过/3 失败：旧“笔记规划中”断言已过期，另外阅读/RAG 首次导入等待5秒失败；不改超时或断言，原规格定向复跑4/4、最终26条中阅读/RAG通过。**保留首次时序失败，不宣称已证明冷启动永不超时**。新规格编写期的标签/夹具字段/立即读取导出文件、ASAR Windows路径、并行启动两份 Vite 复制资产 EBUSY 等错误分别保留日志；均属于验收工具问题，没有迁就生产代码。

备份进程探索曾假设“结果后的非零退出必须失败”。完整读取处理器后确认它在校验 terminal result 后主动 `kill()`，该假设不成立，**不是生产缺陷**。原探索源/log在 artifacts 留存，最终测试明确验证主动终止契约，以及结果之前的真实 utilityProcess `abort()` 必须报错。没有把探索失败记为功能通过。

收尾格式检查失败的文件为 `scripts/eval-retrieval.mjs` 和 `tests/fixtures/retrieval-independent-cases.ts`。独立读取 `71c2c25` 的 Git 内容并用相同 Prettier 配置检查，确认两者起点就失败且本轮内容未改。首轮格式检查还列出新增 scale 规格，已仅格式化该规格并复核28份本轮 TS/配置全部通过；不把全仓格式失败写为绿色，也不为收尾顺手修改生产脚本。

### 静态审查对应证据

| 风险                | 核对模块及结果                                                                                                                                                  | 实测边界                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| IPC/隔离/接口       | AST 比对 types、desktop、preload 的77方法和 main 的71处理器；6事件都有发送与取消监听；保持 contextIsolation/sandbox/nodeIntegration 与主窗口/mainFrame/URL 校验 | 原有桌面隔离/精确桥接断言执行到通过，后续最小窗口失败；全部 iframe/恶意 IPC 矩阵未执行。运行时类型仍须校验，F1说明 TS 不足以保证边界 |
| 迁移事务/保存       | storage 迁移前一致性备份；真实历史 DDL、rowid、版本、后段失败回滚及重复启动                                                                                     | C1/C5；存储故障以注入为主，不代表物理磁盘/断电                                                                                       |
| 乐观锁/来源         | note/memory/planning/history/focus 和两种 proposal 的 revision、来源/项目快照、参数化 SQL；删除来源与最终确认有复核                                             | C2～C7 的核心/真实窗口；完整乱序/应答丢失仍未执行                                                                                    |
| 取消/迟到/隐私      | chat/search/backup-runner/feedback/learning/practice 的单活动请求、预览配置绑定、终止后状态及维护锁；本机记忆限制与单次远程确认                                 | 原聊天/RAG与新增 AI/隐私/崩溃规格已跑；本轮只报告已覆盖竞争，不宣称所有时点都通过                                                    |
| 失败上报/不自动完成 | preload Reply 解包抛错、主进程结构化失败；focus 心跳异常/存储失败冻结；历史导出字面文本与原生路径保护                                                           | 不把正常五分钟专注写成任务完成/掌握；崩溃/非法输出不记成功；F1保留失败                                                               |

本轮手工复核了新增测试与旧规格 diff：旧 schema/导航/桥接期望随当前契约更新，真实旧库替代仅降版本号的伪夹具；原失败断言未删、未跳过、未加大导入等待来遮盖首次时序问题。没有修改生产模块、依赖锁或固定包。

## 4. 生产失败与最小复现

### F1（P2）：数组阅读 tone 写入主库，导致完整备份失败

- 条目：IPC运行时校验；备份“格式/结构/记录”与阅读位置。
- 操作：在合成资料的原位置上，真实调用 `saveReadingPosition(sourceId, {...position, tone: ['paper']})`。
- 实际：Promise成功，SQLite JSON中保存数组；再进行完整备份业务校验，报 `资料目录或阅读位置无效。`。
- 期望：写入前拒绝非字符串 tone，原位置保持；正常保存的数据可备份。
- 影响：常规UI发送字符串，当前未见普通阅读操作触发；但IPC边界可保存应用自己的恢复校验拒绝的数据，阻断该目录完整导出。
- 最小复现：`npx vitest run electron/core/boundary-review.test.ts`；真实窗口 `npx playwright test tests/acceptance-v12.spec.ts --grep='array-valued'`。
- 证据：`reading-tone-ipc.json` 与两个 RED；`electron/core/storage.ts` 的 `String(position.tone)` 校验。
- 修复方向：先检查 `typeof tone === 'string'` 再检查枚举；另处理已受影响的隔离样本，不默默重置个人库。**未修复、无修复提交。**

### F2（P1）：最小窗口侧栏设置入口不可见

- 条目：主题/首页/历史/备份900×640、键盘与滚动。
- 操作：原生窗口 `setContentSize(900, 640)`，Tab或focus到侧栏“设置”，尝试点击。
- 实际：按钮矩形 y=688～732、视口高度640；侧栏scrollHeight768，没有可见滚动入口。键盘focus未让按钮进入视口；鼠标点击超时。三主题均存在。
- 期望：声明的最小尺寸可访问所有导航，焦点和设置入口可见。
- 影响：设置/模型/主题/完整备份的固定导航入口无法用鼠标操作；放大窗口可恢复，但最小窗口验收失败。
- 最小复现：`npx playwright test tests/themes-audit.spec.ts --grep='native minimum'`；原有 `desktop.spec.ts` 后半也失败。
- 证据：`native-minimum.json/png`、`desktop-final-results` 的两条trace；`src/styles.css` sidebar/nav/sidebar-bottom高度与固定布局。
- 修复方向：给侧栏明确滚动/压缩布局及小高度策略，复核Tab/focus/200%和九导航。**未修复、无修复提交。**

### F3（P2）：现代主题“分钟”等实际文字对比度不足

- 条目：三主题可读性、正文辅助文字。
- 操作：现代主题打开设置，取每日学习目标单位“分钟”的计算样式与真实不透明白底。
- 实际：9px文字，RGB(126,138,118)对RGB(255,255,255)，比率3.630632:1。该单位不是禁用文字、装饰或品牌。
- 期望：普通信息文字至少4.5:1，依 [W3C SC1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)；不是用截图抗锯齿估计比率。
- 影响：低视力/低对比敏感用户难读；现代主题还有日期/设置标识等低比率样本。**没有宣称另两主题整界面符合WCAG**，透明/渐变/读屏未验。
- 最小复现：`npx playwright test tests/themes-audit.spec.ts --grep='normal text contrast'`。
- 证据：`contrast-regression.json`、`themes-desktop.json`与截图；`src/styles.css` label-detail及主题回退色。
- 修复方向：调整普通文字主题色/回退色，保持语义色，复验原生页面/背景/状态。**未修复、无修复提交。**

## 5. 程序校验与模型质量分别记录

| 样本                      | 程序结果                                               | 人工语义结论与证据                                                                                                   |
| ------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| RAG原子性                 | 流式/保存/编号/实际出处通过，56.042秒                  | M1：核心事务结论与[1]一致，但“很高兴一起梳理”及“加油”也引用[1]；这些不是该原文支持的结论                             |
| 笔记反馈                  | 保存快照/不改原笔记/出处通过，33.925秒                 | 正确指出“只提交一半”错误；M2：把快照 evidence=“尚待核对”误述为空。补充求证提示总体合理，但不能算快照精确复述全部通过 |
| 30分钟路线＋记忆          | 单次请求/四段/记忆注入不执行/任务0通过，62.120秒       | M3：5+7+8+7=27分钟，未满足明确总计30；可执行性仅此小样本，未有完整质量矩阵                                           |
| 3张卡片                   | 严格JSON/3项/全部编号/出处通过，43.158秒               | 本样本三条事实均受各自证据支持；不是总体语义准确率                                                                   |
| 3题测验                   | JSON围栏解析/3项/编号通过，9.816秒                     | M4：将“提交后重启仍保留”扩展为“不可逆的可靠性”，证据未支持；程序未拦截该语义扩展                                     |
| 无证据披萨问题            | 本地说明86毫秒，不请求模型                             | 通过该空证据控制分支；不属于模型生成成绩                                                                             |
| gentle/game/coach普通聊天 | 实际生成/保存，各28.737/19.505/22.044秒                | 三条均给下一步且未宣称掌握；gentle“借方/贷方”有语境歧义，未判为确定程序缺陷；多轮长上下文质量未验                    |
| 实际检回的资料注入        | 恶意段确实在预览/请求；拒绝执行、任务/记忆仍0，7.805秒 | 注入权限边界通过；解释的安全规范又以仅含攻击命令的[1]作依据，仍是引用支持关系问题                                    |

十场景包含九次真实生成和一次空证据本地说明；空证据分支没有调用模型，不能计作模型质量成绩。最小复现脚本为 `tests/quality.real.ts`，显式 config 才会请求本机模型；输出逐轮保留原始证据、问题、状态、模型、回答、耗时。生成有随机性，这些是保存的实际失败样本，不保证下一次逐字相同。没有设置或声称确定seed/温度；所用模型参数沿候选/Ollama已保存默认。真实兼容云生成、复杂PDF/跨资料/少事实/多次抽样的质量仍**未验收**。

M3核对的是目标文本“给出总计30分钟”的具体要求，27分钟仍满足系统提示“不超过预算”；它不是预算越界或程序写入缺陷。

| 失败              | 最小样本/操作                                                                                               | 期望、影响与修复方向                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| M1 引用支持关系   | real-quality.json 的 rag 回答及 real-chat-injection.json 的 injection 回答，对照本轮实际 hits；C9可重新采样 | 引用应支持它紧邻的资料结论；错误引用会误导追溯。收紧提示中事实/陪伴语的引用规则，加入逐句支持关系质量回归；不能只数有效编号     |
| M2 笔记快照误读   | real-quality.json 的 feedback：比较 noteSnapshot.evidence 与“原文依据部分目前是空的”                        | 应区分未填写与已写“尚待核对”，否则给用户不准确的作品反馈。提示逐段核对保存快照，增加非空但未验证依据的质量样本                  |
| M3 总时间请求不符 | real-quality.json 的 route：目标明确总计30分钟，四步骤5/7/8/7                                               | 应满足用户明确分配要求，避免计划建议与目标不符。明确输出各段与合计，再分别评估“不超过预算”和“指定总计”的遵循                    |
| M4 测验证据外扩展 | real-quality.json 的 quiz：持久性参考答案与实际证据“重启仍保留”对照                                         | 证据未说明不可逆；参考答案可能教出额外错误结论。要求证据外知识标待求证，扩充严格事实及少事实资料样本，不把3项JSON通过当质量通过 |

以上由实现/质量对话后续处理，本轮没有修改提示或模型参数。保存样本可复核，重新采样结果可能不同，不能把一次不同输出当作这些已记录失败消失。

## 6. 检索、规模与包

开发集 v1=6资料/15题（12可答），独立集 v2=5资料/12题（10可答），不混用分母。

| 数据集/模式       | Hit@4 | Mean Recall@4 | Target Precision@4 | 不可答空证据 | 未完整命中                                  |
| ----------------- | ----- | ------------- | ------------------ | ------------ | ------------------------------------------- |
| 开发v1关键词      | 100%  | 87.50%        | 100%               | 3/3          | database-multi、cache-multi、synonym-memory |
| 开发v1真实BGE混合 | 100%  | 95.83%        | 100%               | 3/3          | cache-multi                                 |
| 独立v2关键词      | 90%   | 85%           | 85%                | 2/2          | ind-symmetric-hash、ind-tcp-udp             |
| 独立v2真实BGE混合 | 100%  | 90%           | 95%                | 2/2          | ind-symmetric-hash、ind-tcp-udp             |

R1是已有独立样本的多锚点召回失败，没有改题/调参把它消掉。混合无降级，位置错误0；评测里的 grounding 是固定合成答案的机械核对，**不等于上述真实生成语义通过**。命中一个锚点不等于完整证据。修复方向交实现方：检查该两题的分块/候选/融合保留，另加未参与调参的质量集后复评；本轮未调整检索策略。

规模单次样本：预置500份合成Markdown、11,978,400字节、5000段/9000 FTS块；冷检索（含建索引）1757ms，5次暖查询98/92/91/94/93ms，检索期间bootstrap8ms；取消重建后旧索引摘要相同。资源记录为结束后AppMetrics快照，**不是峰值内存或全生命周期CPU**；不覆盖原生批量导入/PDF/大规模向量。原始 `scale.json` 可复核。

固定目录4510文件/684,555,443字节，NSIS152,047,222字节，两份manifest全摘要/大小与完整目录列表相符。NSIS SHA-256 `33137e5c06b502b8160e8a5b5e626dcda4ab1b62c53e8f72ed29e464a6a181ca`，锁摘要 `4d95f9e833b594face1118d36c2c9ddeadd91dedfcb49726781a7f263f2f13fc`；ASAR5242条目、三worker、本地PDF及x64 native抽查通过。签名NotSigned；仅静态只读，不声称安装运行通过。正式用户/VM、安装保护、远端CI、项目/第三方完整许可仍待准备/核对。

## 7. 交接

本轮只有测试/夹具/文档改动。三项生产缺陷应由实现对话用新提交修复，再复跑F1～F3及受影响清单；新候选新UUID，不替换旧包。本轮首次时序失败及工具失败保留，未经新证据不勾完整清单。

README/AGENTS和十份清单执行表同步此报告。没有收费API、推送、标签、Release、公开操作，也没有修改或提交共享工作区他人的未提交内容。安装/升级/卸载继续“未执行”，不再要求用户重复确认已回答的问题。

本地测试提交：`9e227937526777e1586b8869d94a0ca53bccc74c`（`codex/v12-independent-acceptance`），含28份测试/夹具/显式真实质量配置。三项生产失败原样保留；后续文档提交仅记录本次执行，不改运行源码或包。
