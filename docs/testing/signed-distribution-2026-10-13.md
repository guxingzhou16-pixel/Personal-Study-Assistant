# 裁剪依赖、签名预检与公开源码：本轮验证

日期：2026-10-13。**签名预检/打包准备完成，自有可信签名与正式发布未完成。** 只补本轮变化影响路径；旧完整安装生命周期见[25b/v13记录](installed-v13-2026-10-12.md)，不重复计作本轮。

## 最新次级通知候选：50da0f5

- 干净冻结源码`50da0f53fae63d1fb9539ff4129ed0ed14f0d7bb`，0.1.1，锁与原生依赖版本未变。双TypeScript/Vite/Electron/afterPack/NSIS构建成功，只提取卸载器文件，未在宿主执行安装器/应用或用户数据库。
- 实物`release/nsis-rust-notices-f3a938dd-ad5d-439d-b9cf-e03b411d5aa1/StudyCompanion-0.1.1-win-x64-setup.exe`，140663578字节，SHA-256 `701e7baaf1515a6120bc83b40a3bfe700b1513c8c1485024598f622f5fec20e8`；五份保留产物与来源复制摘要一致。
- 4776ASAR项，无独立Web/GUID；147元数据/158许可/388补充/2生成索引，共695通知输出，全部独立大小/摘要核对。223新增原文共674323字节，暂存与包内原字节匹配；793候选成员去重/复用后新增267归属引用，超集不等于实际链接清单。
- 主程序、完整ASAR及9个原生文件，共11个运行文件与下方2111实物SHA完全一致。没有重复CPU/PDF推理，沿用相同运行字节的既有限定证据；不把此写成新完整UI/安装链或新SHA CI通过。相关15规则重新通过；Windows只读签名状态实际`NotSigned`，3pending保留。
- 本次许可资产含上游CRLF/空白，源/暂存/实物均按原始摘要检查；普通文档/清单diff检查通过，未格式化许可原文。450条公开源/元数据库存已提交，最初对应2111相同依赖，不等于完整实物SBOM或相应源码承诺。

回执：`rust-notice-candidate-final-location.json`、`rust-notice-candidate-signature.json`、`added-rust-notice-assets.json`；旧2111/25b及ZIP均未覆盖。当前代码与2111相比只有许可清单/原文和文档，应用/测试/打包JS/CI/锁文件没有改动。

## 已验裁剪候选：2111

- 干净源码`2111b3cc38c931b99618f6337874a8718b3b028a`，0.1.1；独立worktree复用锁完全相同的旧隔离npm依赖，物理复制、不使用junction，不重新下载已安装对象。
- `desktop:dist`的双TypeScript/Vite/Electron/afterPack/NSIS通过；原单次纯文件卸载器提取保持，不在宿主执行安装器。
- 新候选：`release/nsis-signing-prep-2edfb0b4-8afd-4289-9e31-1a628f8c2195/StudyCompanion-0.1.1-win-x64-setup.exe`。
- 140624396字节，SHA-256 `62329e3e16c1acf5fdf20d77de2062554a731a632923b0469e59328a2a8f8bc6`；锁SHA `c8a2a811877bda4e2fd0623b5553bad26165d5b0773970f3a8458412a08bdd8e`。独立读取大小/外层摘要及五份复制回执逐字节核对。
- 4776个ASAR项，147元数据/158许可通知/165补充，计472通知输出；项目MIT1075原字节保留。三个分发待办仍pending，构建时functionalAcceptance=pending原字节不改写。
- 旧25b的152411220字节/385输出/五项pending不变；新包实际未签名、未发布，不冒称已经重新安装/升级/卸载。

## 本机相关检查

| 检查             | 实际结果                                                           | 边界                                                                                                                 |
| ---------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 规则规格         | 15/15                                                              | 6签名 + 6通知 + 3包检查；缺证书/未知签名/错误用途/时间戳/版本/路径/编码等实际负例，不用测试证书冒充签署              |
| 缺证书新npm命令  | 退出1，release目录28→28                                            | 预检早于编译/输出；没有自有签名                                                                                      |
| Windows签名读取  | 官方微软VC文件Valid/Authenticode/EKU/时间戳；旧25b NotSigned被拒绝 | 只读，不执行微软安装器、导入证书或使用其身份签本应用                                                                 |
| 独立Web/GUID排除 | 新实际ASAR没有顶层/嵌套包                                          | Transformers其他分发文件中也未命中已知GUID标识，内嵌ONNX Web/Common通知仍保留                                        |
| 实物原生CPU      | 5模型文件先核对pin，3条512维向量有限且L2≈1                         | 导入实际包内模块的独立Node CLI，CPU样本145.7493ms；无应用/私人数据库，无global fetch请求；不当成检索召回或回答正确率 |
| PDF.js Node      | 自造两页PDF、两句原文解析匹配                                      | 实际包内Canvas/Sharp/ONNX均加载；不覆盖任意Type3/复杂私人PDF/完整阅读器UI                                            |
| 加载模块记录     | 包内Sharp/两个libvips、ONNX binding/runtime及Canvas实际出现        | 当前CPU样本没加载DirectML，不据此删DLL或称所有Windows都不需要它                                                      |
| 上游原文         | 92新增主库原文保留，唯一Latin-1明确声明                            | 路径/版本/摘要保持；空AUTHORS省略，源超集不冒充全部实际链接                                                          |

代码review与TypeScript review均批准当前签名/编码变更。修复预检JSON前有整数输出、EKU ObjectId字符串、卸载器回执指向已删除文件；摘要沿用流式读取。

## 对应远端CI

[run38376393781](https://github.com/guxingzhou16-pixel/Personal-Study-Assistant/actions/runs/38376393781)，job115225737889，分支`codex/structured-notes`，精确SHA为上述2111。整轮及Post实际success，日志核对：

- Node打包/签名15通过。
- 核心32文件356通过。
- 类型/生产构建与Electron36通过（9.7分钟），包含真五分钟。

这次CI因已授权推送触发，不在本机重复全局套件；没有把旧SHA绿灯移作新成绩。后续纯文档/材料提交不修改本候选字节，按自己的源码/运行记录说明。

## 公开与申请

用户明确授权公开开源并申请SignPath。公开前核对当前追踪内容和待公开可达127提交/883 blob，未发现私人学习资料、DB、模型、备份或实际密钥；两个历史文档的宿主用户路径在当前文字改环境变量，旧提交没有重写。第三方测试素材只在本机其他refs，不纳入推送。

仓库ID1397406382，实际GitHub读回`private=false`、默认main未变、远端功能分支2111，未合并main、未上传安装包或标签。申请表按用户显示姓名/邮箱填写，营销未勾选，说明新项目/无外部信誉/尚未发布及DirectML资格问题。一次自动提交返回Captcha失败，用户随后也反馈同错误；**没有成功回执、账号批准或签名授权**。不经提交API绕过校验，手动材料在本机忽略目录。

## 剩余清单

- [x] 构建新规则候选、确认无独立Web/GUID、核对原文通知和摘要。
- [x] 实际包内CPU与PDF相关最小检查，不读取用户DB。
- [x] 精确源码远端CI，公开源码授权与实际读回。
- [x] 后续50da0f5通知候选构建，695输出/223原文/五份复制产物及11运行文件相同字节核对。
- [x] 用户另授权BGE五文件询证，真实[评论6147791372](https://github.com/huggingface/transformers.js/issues/1487#issuecomment-6147791372)创建并读回；等待答复/通知，未关闭模型许可。
- [ ] Canvas/Sharp/固定量化BGE三项具体分发条件，见[源码材料状态](../releases/native-source-status-2026-10-13.md)。
- [ ] 日常浏览器有效提交SignPath申请、取得成功回执并等待基金会审核；提交不代表批准。
- [ ] 根据真实服务配置接入HSM或现有可信证书，三文件真签名/时间戳、干净Windows检查。
- [ ] 条件齐全后按已获授权正式发布，独立核对上传原字节；当前未发布。

本机证据目录：`artifacts/signed-distribution-7ff696bd-f0c1-450f-a1d6-ad8db0bb9681/`；`candidate-final-location.json`、`package-native-probe.json`、`ci-final-jobs.json`、`ci-final-job.log`、`github-visibility-make-public.json`和`signpath-application-result.json`各自保留真实范围。
