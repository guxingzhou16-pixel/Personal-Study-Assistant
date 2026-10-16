# Code signing policy / 代码签名政策

2026-10-15最新状态：用户提供后续审核邮件正文，**SignPath Foundation本次未批准申请**，理由是项目当前公开使用/独立引用和社区信誉信号不足，并非软件质量判断。用户随后明确只通过GitHub下载软件，保持NSIS、不走商店。首发按未签名预览版/SHA-256透明说明，可信签名不再是此次首发前提。14日收件回执保留为历史；无证书、获批签名策略或可信签名，不重复Captcha或相同申请。付费未授权，三项实际分发条件继续处理，详见[审核结果与用户决定](signpath-review-2026-10-15.md)。

核对日期：2026-10-15。**源码已按授权公开；SignPath Foundation未批准本次申请，可信签名未完成。** 当前没有可发布的已签名安装器；此文件是政策与交接材料，不是证书或服务授权证明。

## 当前发行决定（2026-10-15）

用户已要求以完成并发布首版为主要目标、简化流程；当前采用**Windows x64 NSIS，允许明确标为未签名的公开发行**。不再以取得可信签名、SignPath获批或切换Store为首版门槛，按[首版发布执行计划](v1-release-plan.md)处理具体分发条件和最终包必要验证后交付。SignPath本次未批准，不继续等待同一次审核或重复相同申请。

未签名不保证所有Windows设备均可运行；发布说明如实提示SmartScreen/设备策略可能阻止，不要求关闭安全保护或导入自签根证书。未来选择可信签名发行时，才执行下方证书、三文件签名、时间戳与回执要求；已有签名入口保留，不改造成绕过检查后宣称签名成功。[微软说明](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)

## 签名范围与负责人（签名发行时适用）

- 项目：拾知 / Study Companion；Windows x64，Electron + React + TypeScript，自有代码 MIT。
- 代码库：[guxingzhou16-pixel/Personal-Study-Assistant](https://github.com/guxingzhou16-pixel/Personal-Study-Assistant)，已公开；当前完整源码在[`codex/structured-notes`](https://github.com/guxingzhou16-pixel/Personal-Study-Assistant/tree/codex/structured-notes)，默认main未合并。
- Authors / Reviewers / Approvers：维护者 `guxingzhou16-pixel`。AI 审查是辅助证据，不替代维护者的账户验证、每次签名审批或发布责任。
- 仅签本次源码构建的 `StudyCompanion.exe`、NSIS 卸载器与最终安装器；保留第三方已有签名和许可，不重新签署第三方 DLL / Node 扩展。
- 签名不证明回答正确、知识已掌握或第三方条件已完成。

## 已实现的本机证书入口

使用现有 Windows `CurrentUser/My` 或 `LocalMachine/My` 的代码签名证书，不创建证书、不导出私钥、不修改信任根。证书必须唯一、未过期、非自签、带私钥，并通过 Windows 代码签名证书链检查。

```powershell
$env:STUDY_COMPANION_SIGNING_CERT_SHA1 = '<证书公开指纹，40位十六进制>'
npm run desktop:dist:signed
```

命令先预检，失败不编译或创建输出目录；通过后才构建。仅 SHA-256，要求 RFC 3161 时间戳。回调复用锁定的 electron-builder 26.15.3，路径限定三个确切文件。NSIS 仍纯文件提取卸载器，不在宿主运行临时安装器。

主程序实际验证成功后才更新两份 `build-info.json` 的 `signed`。三个文件均须为指定证书的 `Valid` / `Authenticode`、具备代码签名用途与时间戳，构建结束重新核对摘要；否则不生成成功清单，不降级报成功。

成功输出额外保存 `signing-receipt.json` 和 `signing-artifacts/` 中的签名卸载器，回执路径指向实际保留文件；最终清单/摘要对应签名后字节。还须在干净 Windows 验证公开信任及安装行为，本机信任根不能证明其他机器信任。

本机没有上述证书。规则测试与真实签名文件只读正/负检查已完成，**自有证书签名构建未执行**。SignPath 密钥在其 HSM，本机命令不能冒充已接入云签名。

## 零预算路线研究

| 路线                    | 官方确认的零预算部分                              | 下一步及限制                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SignPath Foundation     | 合资格开源项目可申请免费签名，基金会保管证书/私钥 | 本次信誉审核未批准，当前不可用；积累真实公开认可后可重新申请。付费订阅未授权，不能继续等同一次审核或重复申请 |
| Microsoft Store 的 MSIX | 个人新注册免费，商店在审核后免费签名MSIX/AppX     | 可保留私有源码；本人完成账户/身份验证，取得应用身份后制作MSIX并另验数据位置、升级/卸载、CPU/PDF。旧NSIS验收不覆盖MSIX，把现有EXE上传商店仍需自备签名                                                    |

依据：[SignPath 条件](https://signpath.org/terms.html)、[申请入口](https://signpath.org/apply.html)、[微软免费个人注册公告](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/)、[微软签名路线](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)、[商店账户步骤](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account)。实际申请前再核对资格与费用。

自签适用于受控开发测试，不作为公众信任签名；摘要、Git签名或构建证明不能替代Windows签名。不为本项目购买证书或付费服务。

## SignPath 申请材料与实际提交状态

已使用用户提供的显示姓名/邮箱填写[官方表单](https://signpath.org/apply.html)，说明新项目/暂无外部用户信誉/无正式发布/仍在补分发条件，并请求资格预审与DirectML例外确认；必要行为/数据条款勾选，营销未选。一次自动提交返回“Failed to validate Captcha”，用户随后也报告同错误，**没有成功回执、账号批准或签名授权**。页面重连后原标签已丢失，个人填写材料保留在本机忽略目录的`signpath-application-paste.txt`。后续打开系统默认浏览器被工具策略阻止，未通过其他命令绕过；维护者可直接在日常浏览器打开上述官方链接，按材料重新填写。姓名/邮箱不公开，不经API绕过验证码，MFA及身份仍由本人完成。

上段为首次申请的历史记录。2026-10-14本轮重试按用户最新顺序执行：正常页面Submit仍返回Captcha错误，随后用户手动提交成功并提供邮件回执。邮件确认申请已经收到、会审核及后续邮件联系；没有提供审核批准、组织/项目/签名策略ID或证书。无需再次申请；等待服务方回复，有补充问题时由维护者提供真实材料。姓名、邮箱和邮件跟踪链接不进入仓库。

2026-10-15用户提供审核结论：本次未批准，原因是公开信誉信号不足。上段“等待回复”已结束；后续条件变化后的新申请或转商店路线另作决定，不提交原表单重试。证据为用户提供正文，不冒称直接邮箱读回或审核通过。

- Project name：Study Companion / 拾知。
- Description：A local-first Windows study assistant connecting PDF/Markdown reading, source-grounded retrieval, notes, study plans and focus sessions. It supports local models and user-configured remote endpoints. Agent writes require explicit preview and confirmation.
- License：MIT for project-owned code; upstream components retain their own terms. Current distribution review is not yet complete.
- Repository / homepage：现有公开GitHub仓库及上述功能分支；无正式安装包发布，Download URL留空，不提供虚构下载地址或用户数量。
- Build：锁文件、固定Electron/builder、Windows CI、Git SHA、静态审计、原字节通知、安装器SHA-256；签名仅限三文件。
- Roles：维护者负责代码、审查和每次签名审批；MFA尚未核对。
- Privacy：下一节；无自动同步，远程发送须确认。
- 待服务方确认：资格、DirectML例外、三个自有PE的签名/NSIS组装方案。官方支持PE/ZIP等格式，但本项目NSIS递归签名未核对，不能只签外壳就声称内层也已签。

获批后才根据真实组织/项目/策略ID接入[官方接口](https://docs.signpath.io/powershell/Submit-SigningRequest)和[来源验证](https://docs.signpath.io/projects)，令牌只放GitHub Secrets。审批、返回文件、三个实际签名及干净Windows验收均成功后再更新本页。“Free code signing provided by SignPath.io, certificate by SignPath Foundation”只在实际获批使用后作为有效归属声明。

## 隐私与系统行为

应用自身没有新增遥测、广告或自动资料上传。本地资料/数据库/记忆/密钥在当前用户本机保存，本地检索用独立CPU进程。用户主动下载模型时访问设置所列来源；连接检查/生成访问用户选定地址，远程资料/笔记/记忆请求须预览确认。云服务费用及隐私由所选服务确定。

第三方行为单独说明：DirectML EULA描述其可能收集数据，[微软隐私政策](https://privacy.microsoft.com/privacystatement)继续适用，不无依据承诺全部第三方绝不联网。当前只在Windows机器学习应用中使用，保留原通知，不单独分发DirectML；见[分发进展](distribution-closeout-2026-10-13.md)。

当前NSIS为当前用户安装，不自动启动应用、安装模型/运行库/服务或更改系统信任根；卸载保留学习数据。[旧v13限定验收](../testing/installed-v13-2026-10-12.md)不自动覆盖新签名包/MSIX。

## 授权边界

2026-10-15最新政策允许未签名NSIS首版发行，替代历史“可信签名完成后才首次发布”的前置约定；不得标成已签名或公众信任版本。已有公开/指定分支推送/条件齐全后发布授权继续按实际范围适用，不重复询问；本次只更新文档，不执行上传、标签、main合并、付费或身份提交。

用户于2026-10-13要求完成签名/分发/发布，随后明确选择“保留NSIS，公开开源并申请SignPath”，并提供申请账户显示姓名。授权公开已执行并读回`private=false`，授权分支已推送且精确源码CI通过；首次申请失败见[历史验证](../testing/signed-distribution-2026-10-13.md)，2026-10-14用户提供确认邮件说明重试申请已收到、待审核。用户另明确允许一条BGE许可询证评论及两条Canvas/Sharp issue，均已发送并读回，范围见[后续核对](../testing/native-distribution-followup-2026-10-14.md)；不扩展为追加消息或其它联系人授权。不再重复询问上述授权。未授权付费、提交身份证明、合并main或建设展示网站；未齐条件的安装器不能发布为可信正式版。

2026-10-15用户在审核未批准后明确要求只让用户在GitHub下载软件，保持NSIS。首发采用明确标示未签名的预览发布；原可信签名正式版门槛不再阻塞这次预览，但不冒称真签名完成。商店账号、身份验证和打包不开展。既有源码公开/分支推送授权有效，分发所需许可/通知/源码及实际产物核对仍须完成。
