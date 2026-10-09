# 正式 Windows 包：隔离验收材料与人工流程

日期：2026-10-09。**状态：材料准备工具，实际 Sandbox、安装、升级、卸载和功能均未执行。** 不用源码窗口、临时 APPDATA、哨兵文件或旧日志替代正式包验收。

本机已实际生成 `artifacts/installation-acceptance-c26ae213-250e-4bb5-bfa4-a72dcb733d59/acceptance.wsb`：前候选ce9caae/当前3955e01均0.1.0，来源/实物摘要/签名及复制后核对通过，XML映射/默认Inspect与guest语法已检查，日志为空。仅 `prepared-not-executed`；应用候选3955e01与宿主工具修复4b3d25d分别记录，具体路径/摘要见[发布总表](release-readiness.md)。后续代码变更或换包须重新生成新UUID材料。

## 1. 先准备真实隔离环境

本机只读检查未发现已启用的 Windows Sandbox/Hyper-V 或可用 VM。现有 CodexSandbox 辅助账户未确认可用于交互验收，不自动使用。用户准备 Sandbox 或可恢复 Windows VM 后，才运行正式包；不在个人 Windows 账户运行安装器，不自行启用 OS 功能、创建账户或重启宿主。

本工具生成 Windows Sandbox 离线材料。关闭 Sandbox 会销毁内部安装与用户数据，因此一次首次安装→替换/升级→卸载→重装须在同一会话完成；宿主只有本次映射的日志持久保留。跨 OS 重启、真正睡眠、磁盘/权限故障和快照回退使用可恢复 VM，不能用 Sandbox 关闭后重新创建冒充重启恢复。

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

## 5. 替换/升级、卸载与重装

- [ ] 保存草稿、结束计时/专注并正常退出；用真实 UI 导出完整学习备份到沙盒内指定目录，确认内容仅来自合成学习数据。跨版本备份兼容按项目政策，不直接修改版本字段。
- [ ] 运行 InstallCurrent。同版明确记录“替换安装”；不同版本明确记录“前向升级”。记录当前包源码与实际版本，原数据路径不能悄悄变成另一空目录。
- [ ] 手动打开当前安装，逐项比对第4节的真实保存值，阅读/笔记/计划/专注/主题可继续操作；若确实涉及 schema 升级，记录真实旧结构、升级前一致性备份及新结构/旧数据保留证据，不能只看文件存在。
- [ ] 正常退出后 Record；用界面或系统文件管理器保留沙盒合成学习目录副本，随后 Uninstall。脚本精确匹配当前固定builder的HKCU GUID和“拾知 <实际版本>”项，核对NSIS实际InstallLocation、规范卸载文件名、无链接路径及包内appId/源码/锁摘要，再执行该项 quoted `/currentuser` 卸载器，不删除注册表或猜路径。InstallCurrent结束后须实际安装当前候选，不能沿用旧候选通过。
- [ ] 确认实际应用/开始菜单快捷方式移除；真实两库、sources、假密钥、本机缓存、恢复位置/旧目录和备份（存在的项目）按保存前状态保留。没有创建的类别保持“未覆盖”，不写全部通过。
- [ ] Record after-uninstall，再 ReinstallCurrent。手动启动并比对全部已创建记录；假密钥仅同一沙盒 Windows账户验解密，不推断跨用户/跨机可用。
- [ ] 记录所有取消、错误、运行中升级/单实例、睡眠和恢复重启尚未覆盖场景。应用只测试正常退出重开时，不声称 OS自动重启已验证。

运行日志与原始观察在 `C:\AcceptanceLogs`，持久回宿主本次 logs。截图/人工说明由操作者保存于该目录，不能带私人资料或真实密钥。脚本JSON始终 `functionalAcceptance=pending-manual-ui`；测试方另行写实际结果，文件摘要/退出码不自动勾选清单。

## 6. 目录包与可恢复 VM 的补充

本生成器只复制两个 NSIS，不把完整源码或现有 APPDATA 映射进去。正式目录包单独按 [Windows安装清单](packaging-acceptance.md) 准备完整 `win-unpacked` 与对应回执，在独立测试账户/VM内移离源码启动。不能只复制 EXE，不能把本 NSIS材料当目录包已验收。

可恢复 VM中使用专属测试用户并记录真实SID/profile，准备干净快照，执行安装前/保存后/升级后/卸载后各快照与恢复；实际磁盘/权限故障和 Windows重启另列证据。本Sandbox脚本刻意拒绝普通VM账户，不通过删除身份校验改用宿主；VM自动化如需增加，应独立设计并审查。

## 7. 执行记录（安装与功能仍待执行）

| 项目                      | 当前结果       | 证据                                        |
| ------------------------- | -------------- | ------------------------------------------- |
| 来源/复制/WSB/guest语法   | 已准备，未运行 | 本次材料、发布总表与verify-preparation.json |
| Sandbox真实身份与离线映射 | 未执行         | 环境准备后填写                              |
| 正式目录包启动/资源       | 未执行         | 完整目录包与回执                            |
| 首次NSIS安装/真实保存     | 未执行         | logs、UI截图与具体业务值                    |
| 同版候选替换              | 未执行         | 两来源/版本/数据前后对照                    |
| 真正跨版本升级/迁移       | 未执行         | 不同版本、真实旧结构与保留证据              |
| 卸载/数据保留/重装        | 未执行         | 实际注册项/快捷方式/业务值                  |
| VM重启/故障/回退          | 未执行         | 独立VM及快照                                |

验收与公开发布授权分别记录；本工具不推送、不上传、不创建标签/Release，也不称首版已完成。
