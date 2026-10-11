# 正式 Windows 包：隔离验收材料与执行流程

补核日期：2026-10-11，实际执行日期保留2026-10-10。**状态：当前 b810→53 的同一Sandbox安装/升级/内部OS重启/资源子检查/独立恢复/卸载/目录启动/NSIS重装回看已完成限定范围验收；重装后的额外CPU门禁因BOM解析失败，尚未复验。** 本轮只补核已有证据，原Sandbox已关闭，不重复已完成链。旧b810→352局部记录及原失败保留。不用源码窗口、临时APPDATA、哨兵文件或旧日志替代正式包验收。当前结果见[整合记录](final-acceptance-2026-10-10.md#6-实际安装生命周期本轮限定范围通过)与[发布总表](release-readiness.md)。

历史准备记录（2026-10-09）：`artifacts/installation-acceptance-c26ae213-250e-4bb5-bfa4-a72dcb733d59/acceptance.wsb`，ce9caae/3955e01 均为 0.1.0，当时只完成来源/摘要/签名/映射/语法准备、尚未执行。后续已实际启动并保留安装/工具失败日志，不将原准备状态冒充执行结果，也不覆盖旧候选。应用源码与宿主工具修复分别记录，具体来源见发布总表。

当前 fresh 材料为 `artifacts/installation-acceptance-f0ff5020-3c1d-4854-b66c-5e170d849e6f/`，前候选 `b810f7520109d9994d4bf00e38712512f0ddaae5`（0.1.0），新候选 `53f66a65c30be92ba9671c869a5183722f9203c5`（0.1.1），类型 `version-upgrade`。只在真实 guest 中执行；后续代码变更或换包须生成新 UUID，不在旧 input/plan 内替换候选来源。

## 1. 先准备真实隔离环境

2026-10-09 的只读检查当时没有发现可用 Sandbox/VM；2026-10-10 用户已启用 Sandbox，本轮已核对真实 WDAGUtilityAccount SID/profile 后执行。现有 CodexSandbox 辅助账户仍未用作交互验收。不在个人 Windows 账户运行安装器，不自行启用 OS 功能、创建账户或重启宿主。

本工具生成 Windows Sandbox 离线材料。**关闭 Sandbox 会销毁内部安装、文件和用户数据；Windows 11 22H2 起，从 Sandbox 内发起的重启可保留状态。** 因此本轮 Win11 build 26100 可以验证 guest 内部真实 OS 重启；必须保留重启前后 `LastBootUpTime`、相同 SID/profile 和业务值比较。关闭后新建 Sandbox 不能冒充这一条件。[微软 Sandbox 文档](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/)

一次首次安装→升级→内部重启→卸载→重装在同一环境完成；宿主只有本次映射日志持久保留。真实睡眠、磁盘/权限故障、快照恢复和不支持内部重启的旧系统仍使用可恢复 VM。应用关闭重开、renderer 重载或注入 suspend 事件分别记录，不能代替 OS 重启/睡眠。

映射只允许本次 UUID 的只读 input 与可写 logs，网络、宿主剪贴板、音视频、打印机和 vGPU 分享关闭。logs 内容会写回宿主，只存合成资料的验收记录。配置依据 [微软 Windows Sandbox 配置文档](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file)。禁用 vGPU 使用软件绘制，本轮不据此评价正常硬件性能。

## 2. 生成材料，不启动程序

从仓库根运行，显式给出两个已成功的 NSIS 输出目录：

```powershell
node scripts/prepare-installation-acceptance.mjs --previous <上一候选NSIS目录> --current <当前候选NSIS目录>
```

`<...>` 是需替换的说明占位，不能原样运行。候选目录各自须含 setup、build-manifest、build-info、package-audit、SHA256SUMS。工具比对 Git 提交中的版本/安装政策/锁摘要、旁置回执、实物大小/SHA-256/Authenticode，复制后再校验 setup 摘要；拒绝 dirty、模式错误、不一致或降级。当前只接三段数字版本，不接受预发行版本。

输出在 `artifacts/installation-acceptance-UUID/`，包含只读输入材料、空 logs、`acceptance.wsb` 和 `preparation.json`。脚本不启动 Sandbox、安装器、应用或数据库；失败 UUID 保留，不自动清理。宿主 SID 只写入忽略的 input/plan.json，用于拒绝误在宿主运行。

两个版本都为 0.1.0 时，类型只能是 `same-version-replacement`：验证同版候选替换安装，**不叫跨版本升级或旧 schema 迁移**。真实版本升级须上一候选版本更低，实际保存数据再前向升级；旧数据库结构由真实旧应用生成或经独立规格验证，不能修改 PRAGMA 版本字段伪造。

## 3. 用户准备环境后的启动与身份检查

核对 `.wsb` 只有本次 input/logs 映射，再由操作者双击该文件。自动打开的 PowerShell 只执行 Inspect，**不自动安装或启动应用**。

沙盒脚本检查实际 WindowsIdentity、WDAGUtilityAccount 的本地账户 SID、ProfileList 与真实 KnownFolder，要求真实 profile 为 `C:\Users\WDAGUtilityAccount`、SID 与宿主不同，APPDATA 在该 profile；不能靠改环境变量通过。身份失败即停止，不运行安装器。`RemoteSigned` 仅用于该新 PowerShell 进程运行本地生成脚本，不改系统策略；执行被阻止则记录失败，不关闭 Defender/SmartScreen 或增加 bypass 回退。

本轮使用微软 `wsb.exe` 的 `exec --run-as ExistingLogin` 在**指定且已经核对的 Sandbox ID** 中执行上述步骤，返回值与结果写入本轮映射日志。用真实已登录 guest 用户，不使用 `System` 或宿主账户；任何重启/运行库安装只发生在该 guest。CLI 本身不证明命令业务通过，需读取对应结果。[微软 Sandbox CLI](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-cli)

离线验收辅助工具是受核对的独立 Node/Playwright 和 `installed-acceptance-smoke.mjs`，不进入应用包。正式应用仍使用安装目录的真实 EXE、`app.isPackaged=true`、真实 `%APPDATA%\StudyCompanion`，从与源码无关的 guest cwd 启动。

每次动作都重新检查身份，安装器执行前核对实际 SHA-256/签名。下面命令只在已通过身份检查的 Sandbox PowerShell 中执行；指定 `-Action` 就是操作者明确执行该动作，不再次要求输入批准口令。安装器/卸载器以可见窗口运行，实际取消和系统提示保持：

```powershell
& C:\AcceptanceInput\acceptance.ps1 -Action InstallPrevious
& C:\AcceptanceInput\acceptance.ps1 -Action Record -Stage previous-saved
& C:\AcceptanceInput\acceptance.ps1 -Action InstallCurrent
& C:\AcceptanceInput\acceptance.ps1 -Action Record -Stage current-saved
& C:\AcceptanceInput\acceptance.ps1 -Action Uninstall
& C:\AcceptanceInput\acceptance.ps1 -Action Record -Stage after-uninstall
& C:\AcceptanceInput\acceptance.ps1 -Action ReinstallCurrent
& C:\AcceptanceInput\acceptance.ps1 -Action Record -Stage after-reinstall
```

不要一次粘贴整段：每次安装后按下节完成真实 UI 操作并正常退出，才 Record 或继续。脚本仅启动明确的安装器/卸载器，不自动打开应用、写学习库或宣称业务验收成功。

## 4. 首次安装与真实保存

- [ ] 记录固定 Git 源码、两版本、setup SHA-256、实际签名状态、Windows版本和 Sandbox身份；未签名提示如实记录。
- [ ] 运行 InstallPrevious，观察安装结束不自动启动应用；真实 HKCU 卸载项、当前用户开始菜单“拾知”、无默认桌面快捷方式符合配置。
- [ ] Inspect记录实际安装 EXE ProductVersion/FileVersion、卸载 DisplayVersion、包内 resources/build-info 的源码/版本/锁摘要；手动核对一致，不能只读旁置manifest。当前 Windows ProductVersion 为四段 `0.1.0.0`，FileVersion/应用版本为 `0.1.0`，不把这一区别误判为版本失败。
- [ ] 手动从实际开始菜单或 Inspect显示的实际 EXE 路径启动，界面可用，不依赖源码/Node/Git/开发服务器。先核对数据在真实沙盒用户的 `%APPDATA%\StudyCompanion`。
- [ ] 在沙盒内记事本创建合成 Markdown，导入并阅读；保存独立阅读位置、结构化笔记、项目/任务、任务完成状态、主题、签到及专注/复盘。每项记录具体可比对的标题/内容/状态；使用真实界面，不用哨兵文件充数。
- [ ] 正常关闭重开后逐项核对上述保存值；结束活动、正常退出后 Record。文件摘要只作旁证，不证明表结构/行值或迁移正确。
- [ ] 需要 PDF/模型/更多合成数据时，先在准备材料中单独提供已核对的公开测试资产；当前自动材料不包含 PDF、模型或个人资料，网络关闭，不把这些未执行能力写为通过。

当前扩展流程提供两页生成 PDF 和精确核对的五份开发 BGE 权重，复制到 guest 的实际本机模型缓存。这是**离线预置权重**，不等于设置页联网下载已验收。旧 352 轮次 PDF 已实际通过，语义 stage 因运行库缺失失败；新 53 轮次分别记录完整结果。

### Windows 原生运行库准备与失败边界

本地语义检索的 ONNX x64 原生绑定需要 **Microsoft Visual C++ v14 x64 运行库**。使用[微软官方支持的下载](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)，本轮取得的固定文件为 `14.51.36247.0`、18731856 字节、SHA-256 `843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c`、Microsoft Corporation 签名 `Valid`。只在已核对的 guest 安装，不在宿主执行，不随应用安装器捆绑；重跑时重新核对实际版本、摘要和签名，不假定动态下载链接永久返回同一字节。

旧轮次运行库安装退出 0，五个 DLL 由缺失变为存在，真实安装目录的 Electron utility 诊断加载 Sharp/ONNX/Transformers 并 CPU 推理 `[1,13,512]` 通过；这不自动通过完整 UI 资源流程。当前 fresh 轮次先安装运行库，正式PDF/CPU混合子检查及独立恢复通过；未安装时的原生失败来自旧轮次，53新增安全错误提示的核心规格另验。运行库与编译工具分开，用户无需安装 C++ Build Tools。

### 实际 UI 辅助流程的替代与断言

`installed-acceptance-smoke.mjs` 通过正式 Electron 窗口操作设置、阅读、笔记、任务、专注、复盘和签到，并从真实 preload 读取业务快照、解密假密钥。每个 stage 保存独立结果与失败截图。文件/目录选择和恢复最终确认由受限对话框响应替代，并在 `dialogSubstitutions` 中明示；**原生文件选择器的鼠标操作不在该 UI stage 覆盖范围**。

恢复流程使用真实 backup worker、`app.relaunch`/退出、重新启动 PID 与窗口、活动位置 UUID、pending 清理和业务回看，不替换为仅打开源数据库或直接修改 active 指针。断言必须达到这些条件才记恢复通过。stage 名中的 `verify-replacement` 可用于前向升级后的比较，实际是否升级以 plan 的两个包版本为准，不因函数命名误报同版替换。

## 5. 替换/升级、卸载与重装

- [ ] 保存草稿、结束计时/专注并正常退出；用真实 UI 导出完整学习备份到沙盒内指定目录，确认内容仅来自合成学习数据。跨版本备份兼容按项目政策，不直接修改版本字段。
- [ ] 运行 InstallCurrent。同版明确记录“替换安装”；不同版本明确记录“前向升级”。记录当前包源码与实际版本，原数据路径不能悄悄变成另一空目录。
- [ ] 手动打开当前安装，逐项比对第4节的真实保存值，阅读/笔记/计划/专注/主题可继续操作；若确实涉及 schema 升级，记录真实旧结构、升级前一致性备份及新结构/旧数据保留证据，不能只看文件存在。
- [ ] 正常退出后 Record；用界面或系统文件管理器保留沙盒合成学习目录副本，随后 Uninstall。脚本精确匹配当前固定builder的HKCU GUID和“拾知 <实际版本>”项，核对NSIS实际InstallLocation、规范卸载文件名、无链接路径及包内appId/源码/锁摘要，再执行该项 quoted `/currentuser` 卸载器，不删除注册表或猜路径。InstallCurrent结束后须实际安装当前候选，不能沿用旧候选通过。
- [ ] 确认实际应用/开始菜单快捷方式移除；真实两库、sources、假密钥、本机缓存、恢复位置/旧目录和备份（存在的项目）按保存前状态保留。没有创建的类别保持“未覆盖”，不写全部通过。
- [ ] Record after-uninstall，再 ReinstallCurrent。手动启动并比对全部已创建记录；假密钥仅同一沙盒 Windows账户验解密，不推断跨用户/跨机可用。
- [ ] 记录所有取消、错误、运行中升级/单实例、睡眠和恢复重启尚未覆盖场景。Win11 22H2+ 内部 OS 重启须提供实际启动时间变化与保存值；只有正常应用退出重开时不声称 OS 已重启。

运行日志与原始观察在 `C:\AcceptanceLogs`，持久回宿主本次 logs。截图/人工说明由操作者保存于该目录，不能带私人资料或真实密钥。脚本JSON始终 `functionalAcceptance=pending-manual-ui`；测试方另行写实际结果，文件摘要/退出码不自动勾选清单。

## 6. 目录包与可恢复 VM 的补充

本生成器只复制两个 NSIS，不把完整源码或现有 APPDATA 映射进去。正式目录包单独按 [Windows安装清单](packaging-acceptance.md) 准备完整 `win-unpacked` 与对应回执，在独立测试账户/VM内移离源码启动。不能只复制 EXE，不能把本 NSIS材料当目录包已验收。

可恢复 VM中使用专属测试用户并记录真实SID/profile，准备干净快照，执行安装前/保存后/升级后/卸载后各快照与恢复；实际磁盘/权限故障和 Windows重启另列证据。本Sandbox脚本刻意拒绝普通VM账户，不通过删除身份校验改用宿主；VM自动化如需增加，应独立设计并审查。

## 7. 执行记录（区分历史与当前候选）

旧 352 轮次的局部结果位于 `artifacts/installation-acceptance-9b0913f9-6792-4e87-b0b9-2aec72d770c7/`：真实首次安装/保存/应用重开、b810→352 升级与内部 OS 重启通过；正式 PDF 通过、native stage 缺微软运行库失败，安装运行库后诊断通过；恢复、卸载、重装尚未执行。早轮卸载器退出 2 和所有工具/资源失败保留，不覆盖。

**当前 b810→53 fresh 生命周期已完成限定范围验收。** 2026-10-11补核原始记录并生成 `lifecycle-summary.json`，没有重复已完成安装或测试。以下表格只按明确的实际结果更新，文件生成/静态通过不打勾为业务通过；原Sandbox已关闭，当前 `wsb list` 为空。

当前 fresh 证据位于 `artifacts/installation-acceptance-f0ff5020-3c1d-4854-b66c-5e170d849e6f/`，Sandbox ID 为 `56899396-42d3-4b03-bf0c-77929093203a`。首次资源尝试端口 `EADDRINUSE` 失败，尚未执行模型/PDF/恢复；第二次资源 stage 的 PDF/真实 CPU 子检查通过，但恢复退出后脚本取已清理的 Playwright process 失败，两份原 `failed` 回执保留。

独立 `logs/ui-verify-restore-4514380f-a180-4c9e-8cd7-a697bf82690f/result.json` 为 `passed`：实际原 PID7120 退出0，新 PID6984/窗口、active `147f3310-3043-4cc7-851e-f08c5c8f595f`、previousId/旧目录保留和 pending 清除，重新打开后全部已创建保存值及假密钥解密通过，凭据与五份权重摘要未变。该门禁没有创建聊天/记忆/路线历史，也没有测试原生文件选择器鼠标操作、联网模型下载或实际睡眠。

随后正式卸载实际退出0，安装/卸载注册项、安装目录/EXE/卸载器和开始菜单均移除；82个学习文件的大小/SHA-256差异0，含模型、active位置和恢复目录。完整4878文件目录复制到guest独立目录后逐项核对并真实启动，保存值/UI/假密钥通过；首次目录计数脚本的PowerShell 5数组错误在复制/启动前停止，原日志保留，修正计数后才得到目录通过回执。NSIS重装实际退出0，版本/来源/开始菜单和 `verify-reinstall` 保存值/UI/假密钥比较通过。

额外 `verify-reinstall-resources` 原stage仍为 `failed`：保存值/UI/假密钥三项通过后，PowerShell 5输出JSON的BOM解析失败，active位置/模型/CPU未在此stage核对。辅助脚本已补BOM处理与真实数据根目录检查，未复验；卸载前后模型摘要未变不替代重装后推理。完整路径与26份原始证据摘要见同目录 `lifecycle-summary.json`，两次资源原FAIL、独立恢复PASS和本次BOM原FAIL分开记录。

| 项目                      | 当前结果                                    | 证据                                                                                         |
| ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 来源/复制/WSB/guest语法   | 当前53已准备/实物核对                       | fresh f0ff材料；新setup与卸载器来源/CRC，发布总表                                            |
| Sandbox真实身份与离线映射 | 实际通过                                    | WDAG SID/profile/KnownFolder；只读input/可写logs                                             |
| 正式目录包启动/资源       | 当前53目录启动与保存值回看通过              | 完整4878文件复制/摘要核对，离开源码、无安装项时真实UI/假密钥通过；不冒称所有目录资源路径重跑 |
| 首次NSIS安装/真实保存     | 当前fresh旧0.1.0实际通过                    | b810安装exit0、create/应用重开PASS，63数据文件记录                                           |
| 同版候选替换              | 历史准备/失败保留                           | 原ce9/3955均0.1.0，不能称跨版本升级                                                          |
| 真正跨版本升级/迁移       | 当前b810→53实际升级与保存值通过             | 0.1.0→0.1.1安装exit0、verify-replacement PASS；两者主v12，历史DDL迁移另验                    |
| PDF/本地CPU资源与完整恢复 | 当前53限定门禁通过                          | 第二次资源子检查PDF/CPU PASS；独立verify-restore PASS，两次stage原FAIL保留                   |
| 卸载/数据保留/重装        | 当前53限定范围通过                          | 实际卸载exit0与物理清理；82文件大小/摘要零差异；NSIS重装exit0和保存值/UI/假密钥PASS          |
| 重装后额外CPU门禁         | 原FAIL、未复验                              | PS5 BOM解析失败在模型验证前停止；脚本已修正，不把此前CPU/摘要保留移作重装后CPU通过           |
| OS重启/VM故障/回退        | 当前53 guest内部OS重启通过；VM/睡眠故障未验 | kernelRestartProven、相同SID/profile和verify-os-restart PASS；不可用重建Sandbox替代          |

源代码完整回归、真实模型语义失败与新包来源见[整合报告](final-acceptance-2026-10-10.md)。验收与公开发布授权分别记录；本工具不推送、不上传、不创建标签/Release，也不称首版已完成。
