# 2026-10-16 全局审查问题：编码修复交接

## 范围与起点

- 对应审查：`docs/testing/full-code-review-2026-10-16.md` 的 R-01～R-09、Q-01/Q-02。
- 修复目录：`E:\私人学习助手`，起点 `24efad1ef0e1c329557e29808cc7515281b92e85`；改动仍在工作区，未 commit、push、reset、checkout 或安装依赖。
- 当前 Codex 工作树仍是旧 `95c2666`；本轮没有把旧工作树当成待修复源码。
- 开始时 README/AGENTS 已有他人修改，原内容先保存到本轮忽略产物目录，修复只补充维护说明。既有 `.codex/`、第三方下载和未追踪脚本不属于本次修复。
- 本文是编码代理的自检和交接记录，供独立窗口审查；已发布的 `v0.1.1-preview.1` 附件没有更新。

## 根因、修复与文件

| 编号 | 根因与当前行为 | 修改文件（仓库相对路径） |
| --- | --- | --- |
| R-01 | `decodeTurn` 直接断言 JSON 类型。现在 `get/getTurn` 校验基本字段及证据数组、元素、位置和偏移；坏记录抛出 `chatCorrupt`，不替换成空数组。坏默认会话不再让整个界面白屏。 | `electron/core/chat-storage.ts` |
| R-02 | 异步出处解析没有导航意图边界。现在普通/笔记/路线/复习共用受请求序号约束的跳转；导航、换资料、返回选文和切换/关闭侧栏使旧结果及旧错误失效。 | `src/App.tsx` |
| R-03 | 测验的作答版本只在首次挂载时读取。现在提供“读取最新作答（保留当前输入）”，显示最新内容供比较；用户明确选择载入或保留草稿后才更新编辑基线，不自动重发保存。 | `src/components/PracticeResult.tsx` |
| R-04 | 解析缺少 GFM，表格/列表边界与可见文本不同；外链说明也会混入选文。新导入按 GFM 提取单元格、列表项、块和硬换行。旧资料副本经核验，在独立解析进程生成一次映射，返回原有存储文本的精确偏移，不改旧段落、历史证据或索引。外链提示仍可见，改为 CSS 生成文字，不进入原文选区。 | `electron/core/document-parser.ts`、`electron/core/documents.ts`、`electron/main.ts`、`src/components/ReadingPage.tsx`、`src/styles.css` |
| R-05 | 发出 kill 即解锁，没有等退出，也遗漏启动前取消。现在等实际 `exit` 后解锁、清理并替换重建文件；启动前的取消在 `spawn` 补发 kill。5 秒未确认退出则报 `indexExitTimeout`，继续保持忙碌锁，禁止新索引/备份，迟到事件不能释放新请求的锁。 | `electron/core/search.ts` |
| R-06 | 路线行动、作品、限制及出处拼合后超过任务 4000 字限制。共享 `planningLimits.details` 调至 8000；已有界面、写入和备份读取均引用此约定，不截断路线或来源信息。 | `src/lib/planning.ts` |
| R-07 | 完成态练习有输出解析，完成态结构化路线没有。备份校验现复用 `parseLearningPlan` 检查 JSON、字段、引用和总预算；旧 Markdown、空证据说明及未完成部分输出保留。指令保护仅豁免“确切本地回答 + 确切提示 + 对应指令证据”，不能靠伪造提示跳过校验。 | `electron/core/backup-data.ts`、`electron/core/evidence-policy.ts`、`electron/core/chat.ts` |
| R-08 | 只限每批 20 份，与完整备份的 10000 份总量不一致。现在新解析前、资料提交事务内都检查总数；重复不占额度，失败不写入。旧超限库仍可读取，拒绝新增并明确提示退出后完整复制学习数据目录留存、联系维护者处理；不删除原数据，也不放宽备份校验。 | `electron/core/documents.ts`、`electron/core/storage.ts` |
| R-09 | 真实 BGE 门禁使用旧按钮名。改用“模型文件已校验”，追加 disabled 和 `embeddingStatus.state=ready` 校验，保留后续真实 CPU、离线同义检索、出处、取消、重启缓存及损坏降级断言。 | `tests/embedding.real.ts` |
| Q-01 | 解释性问题的相关定义页因整体覆盖率不足被丢弃。至多补一页同一 PDF、相邻页码且包含首要概念的上下文；没有强候选时不扩展，不改资料或期望锚点。 | `electron/core/retrieval.ts` |
| Q-02 | “用”等共享文字和向量相似度让不含明确技术名称的片段混入。关键词和向量候选均核对问题中的显式名称，可使用资料名和标题上下文，保留比较问题原有主题处理。 | `electron/core/retrieval.ts`、`electron/core/vector-retrieval.ts` |

新增规格：`electron/core/full-review-regressions.test.ts`、`tests/full-review-fixes.spec.ts`。

扩展规格：`electron/core/search.test.ts`、`electron/core/documents.test.ts`、`electron/core/retrieval.test.ts`、`electron/core/vector-retrieval.test.ts`。RAG 和历史导出规格中的合成证据补齐真实文字长度/行号；任务限额负例改为共享上限加一。对应文件为 `electron/core/rag.test.ts`、`electron/core/history-acceptance.test.ts`、`electron/core/planning-memory-focus.test.ts`，原行为断言保留。

## 复现与自检证据

本轮唯一证据目录：

```text
E:\私人学习助手\artifacts\bugfix-20261016-9c8fd866-7fb9-4c9c-b1de-785b1e5ad17e
```

- `core-contracts.json`：用审查者冻结的同 HEAD 源码重跑原五项复现，五项均确认。未修改审查者的固定 source 或原 JSON。
- `ui-contracts.json` 与截图：重现迟到跳转、跨页作答冲突和表格/列表失败；原第四项因白屏导致采集器超时，如实保留，后续用正常 Electron 回归检查结构化错误及导航。
- 新增核心规格首轮 14 项中 10 项因报告问题失败、4 项兼容分支通过；随后逐项修复。检索新增四项先失败后通过。受控取消规格覆盖延迟退出、kill=false、启动前取消和迟到事件。
- `ui-red.log`：原四条新桌面规格为 3 失败/1 通过；`embedding-red.log` 保留旧按钮超时。
- `embedding-second.log`、`worker-exit-red.log`：等退出后的真实启动前取消暴露 `indexExitTimeout`，补充 `spawn` 收口后完整门禁通过。`markdown-links-red.log` 保留外链说明混入原文的补充失败。
- 原有 PDF 核心规格在默认 5 秒预算下曾超时，未改规格或删除断言；按原全局审查命令使用 `--testTimeout=30000` 后验证。
- 新增跨引用采集器曾把 Electron evaluate 的模块参数当用户参数，并尝试操作阅读侧栏隐藏的历史列表；修正采集器参数及正常“提问选中原文”入口，不为这些测试设置问题修改业务逻辑。失败日志均保留。

### 最终验证

核心测试在主目录执行；桌面构建、Electron 和评测在上述目录的 `runtime` 子目录执行。`runtime` 是本次源码的普通文件副本，复用主目录已安装的 `node_modules` 和既有评测权重 junction，没有新建 Git checkout 或重新安装依赖。没有覆盖共享 `dist/dist-electron`，不属于洁净锁安装或正式包验收。

| 命令 | 本轮结果 | 范围 |
| --- | --- | --- |
| `npm test -- --testTimeout=30000` | 33 文件，388/388 通过 | `core-final.log`；含新增数据、容量、任务和恢复回归 |
| `npm run typecheck` | 通过 | renderer 与 Electron/测试两套 strict TypeScript |
| `npm run format:check`、`git diff --check` | 通过 | 原格式门禁保留，仅格式化本次修改源码 |
| `npm run desktop:build` | 通过 | `runtime-build-green-2.log`；保留既有大资源块提示 |
| `node node_modules/@playwright/test/cli.js test tests/full-review-fixes.spec.ts tests/reading-workspace.spec.ts tests/reviews.spec.ts tests/rag.spec.ts --output='../desktop-final-results'` | 10/10 通过，23.6 秒 | `desktop-final.log`；7 条新增真实 Electron 场景及 3 条相关旧流程 |
| `npm run test:embedding -- --output='../embedding-green-results'` | 1/1 通过 | `embedding-green.log`；真实固定 BGE CPU + 合成聊天服务，无新下载或收费 API |
| `npm run eval:retrieval`、`npm run eval:hybrid` | 两种模式均无未完整命中、无降级 | `retrieval-green.json`、`hybrid-green.json`；逐题与下表一起看 |

### 检索固定回归前后

题目、标注、资料和干扰片段未改；两套合计 27 题。本轮使用这些案例开发修复，不能继续称为新的独立测试集或真实模型语义准确率。

| 模式/数据集 | Mean Recall@4 修复前 → 后 | Mean Target Precision@4 修复前 → 后 | 空证据准确率（前/后） |
| --- | --- | --- | --- |
| 关键词 v1（15题） | 95.83% → 100% | 100% → 100% | 100% / 100% |
| 关键词 v2（12题） | 100% → 100% | 95% → 100% | 100% / 100% |
| 真实 BGE 混合 v1 | 100% → 100% | 100% → 100% | 100% / 100% |
| 真实 BGE 混合 v2 | 100% → 100% | 95% → 100% | 100% / 100% |

## 独立窗口待验证与风险

1. **运行时/恢复输入（R-01、R-07）：**核对损坏证据及字段均返回结构化错误，合法历史、旧 Markdown、空证据、指令本地说明和部分输出兼容；重算摘要的无效结构化路线必须在完整备份校验中拒绝。
2. **导航并发（R-02）：**核对普通、笔记、路线、复习四种出处，尤其迟到错误、连续点击、返回选文、关侧栏和换资料，确认较新的操作优先。
3. **作答（R-03）：**读取不会丢草稿或自动提交；两个明确选择及日期/疑问字段均需核对。服务端乐观锁必须继续阻止重复跨入口覆盖。
4. **原文兼容（R-04）：**旧段落/历史证据/向量缓存不重写；对新旧资料核对表格、列表、链接、软/硬换行、跨节拒绝与精确偏移。内部 `Documents.selection/citation` 变为异步，IPC 应完整 await；不新增 renderer 权限。复杂大 Markdown 和真实复杂 PDF 的代表性补验仍未执行。
5. **进程并发（R-05，需人工审查）：**核对启动前/后的 kill、无退出时的锁、迟到消息、异常退出、语义降级和重建替换。不能在超时后为“恢复可用”直接解除仍活着的进程锁。
6. **长度兼容（R-06，需人工审查）：**任务说明上限为 8000。数据库结构未变，但旧软件可能拒绝新增的超过 4000 字任务；回退前保留原数据，不能把本轮格式兼容性当成旧版读取承诺。
7. **旧超限库（R-08）：**10001 条元数据注入验证了保留读取和明确限制；没有生成 10001 个真实资料副本。旧超限库仍不能通过完整备份校验，临时方案是退出应用后完整保留数据目录、由维护者处理；本轮未实现拆分/删除资料功能。
8. **质量（Q-01/Q-02）：**邻页补充及显式名称约束是有界启发式，需检查未参与调参的问题、同义/多主题/缩写及召回精度。27 题成绩不证明真实聊天回答或跨学科语义正确。
9. **范围：**未重跑全部普通桌面套件、正式 NSIS 安装/升级/恢复链、远端 CI、不同机器、收费云服务或真实聊天语义评测。独立窗口完成审查后再决定提交、重新构建发行包与发布；本窗口没有最终审查结论。
