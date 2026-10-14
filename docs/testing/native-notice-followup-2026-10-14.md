# Canvas 固定来源通知与候选包补验

日期：2026-10-14。只补尚缺的许可材料及其包装验证，不重复已完成的功能、模型或安装验收。可信签名与正式发布仍未完成，三项分发条件保持未关闭。

## 已完成的来源核对

- 沿用已校验的 Canvas `b2723ffae4e74e8c9df752902b137ec4061530e9` 工程与 93 份 Cargo 归档；原始 `Cargo.lock` SHA-256 为 `a4cb753b26f4b1b173d6b9f3e41771075d54e5986c5110f69ca83d07d05df80a`。不重复下载已取得对象。
- 在独立临时 Cargo 目录中运行 `cargo tree --locked --offline --target x86_64-pc-windows-msvc --edges normal,build --prefix none --no-dedupe --format '{p}|{l}'`，使用固定工程的默认 features；退出 0，选出 83 个普通/构建依赖、排除当前目标下的 10 个候选。没有编译、运行 build.rs 或执行上游源码。
- [声明依赖图与来源摘要](../releases/canvas-rust-graph-0.1.1.json)保留工具版本、目标、源归档摘要、许可候选和核对范围。包括构建辅助及过程宏依赖；它不能作为发布 DLL 的实际链接清单，也不覆盖 Skia C++ 外部库或编译运行时。
- 其中 7 个选中 crate 未带独立 LICENSE。核对 `.cargo_vcs_info.json`，取得对应固定 Git 提交的 7 份 `Cargo.toml`，全部与归档内 `Cargo.toml.orig` 原字节一致；两份工作区许可全文核对 Git blob、大小与 SHA-256 后原字节保留，没有使用当前 main 的文字替代。
- raw 端点的原失败回执保留；改用官方 GitHub blob API，未关闭 TLS 检查。Cargo 图解析本身完全离线，后续许可来源核对使用了网络，二者分别记录。

| 固定来源 | 对应 crate | 新增原文 | 字节与 SHA-256 |
| --- | --- | --- | --- |
| `Nugine/simd@d74c030d9dc4f3cae02146d1f497ff62726ef09a` | base64-simd 0.8.0、vsimd 0.8.0 | [LICENSE](../../scripts/licenses/assets/canvas-rust-simd-d74c030d-LICENSE.txt) | 1062；`71674605ec4c087fe9eb534e3e4f9e26eb2e4aabcd76a29fd156c6a844d44b3d` |
| `napi-rs/napi-rs@956e4525fea6a676ea3680b711382f167b899af9` | napi-build 2.4.1、napi-derive-backend 6.1.2、napi-derive 3.6.3、napi 3.12.1 | [LICENSE](../../scripts/licenses/assets/canvas-rust-napi-rs-956e4525-LICENSE.txt) | 2138；`3f1ce66533302df3a32edbfdfc0b78f0dd34659e4c1f5817162e5ea3c2297215` |
| `napi-rs/napi-rs@679eb79f5cf3c7c6b2850f4ab46092126f23dc5c` | napi-sys 3.3.0 | 与上一行完全相同的 Git blob，复用原文 | `7fe7e35eff46457f65a4e30a717fada632de9e03`；没有重复下载 |

两份新增原文共 3200 字节，接入原有 `manifest.json` 和 `source-records.json` 的确切 Canvas 原生包归属。图中 7 项已逐项记录固定上游通知依据；旧 223 份资产及其来源不改写。

## 候选包与验证清单

干净冻结源码 `77acd642c1eea6221ee0d80444140e51feffe691`，0.1.1，锁 SHA-256 仍为 `c8a2a811877bda4e2fd0623b5553bad26165d5b0773970f3a8458412a08bdd8e`。双 TypeScript/Vite/Electron 构建通过，首次打包在复制 MIT 文件时返回 `EBUSY`；失败日志、原输出及回执保留。随后源/目标 MIT 均可读且 1075 字节摘要相同，独立复制探针通过，没有定位到具体占用者。源码/编译结果未变，只重试打包到新 UUID，不重复编译或功能测试；afterPack/NSIS 成功。未运行安装器、应用或个人数据库。

新实物：`release/nsis-canvas-notices-254f9869-6f74-45a2-8a3e-8770fd40a3f7/StudyCompanion-0.1.1-win-x64-setup.exe`，**140664359 字节**，SHA-256 **`926f585f1efe170a2c5fc154d50a5b9ccc8dd745c6f29639fd3a27da01b89e86`**。4776 个 ASAR 项；147 元数据/158 许可/390 补充/2 生成索引，共 **697** 份通知输出，全部独立大小与摘要核对。两份新增原文与固定源/提交 Git blob/实物完全相同，包内确切 Canvas 1.0.9 归属核对通过；此前 223 份原文仍保留。

主程序、完整 ASAR 与 9 个原生文件共 11 份运行文件，实际逐 SHA 与已验 2111 原文件比较一致。没有重复 CPU/PDF、完整 UI 或安装链；只沿用相同运行字节的已有[限定证据](signed-distribution-2026-10-13.md)。项目 MIT 原字节 1075、五份保留产物与构建来源复制摘要通过；只读签名实际为 `NotSigned`，三项 pending 和构建时 `functionalAcceptance=pending` 保持原字节。新包的检查不追写到旧 50da0f5/695、2111/472 或 25b/385 候选。

本轮新增数据与通知的独立 code review 为 APPROVE/0 问题，核对了 7 份固定 manifest、83/93 声明范围、139 个原始通知候选成员及两份新增字节。应用/测试/打包 JS/CI/锁文件相对 2111 没有修改。远端 CI 按最终授权推送的精确 SHA/run 另核对，回执 `canvas-notice-ci-final-jobs.json` 和 `canvas-notice-ci-final-job.log`；不预填未知 run 为成功。

- [x] 固定 Windows 声明依赖图、93 → 83 的范围及 7 份原 manifest 核对。
- [x] 两份固定 Git blob 许可全文取得、来源/字节/摘要与确切包归属核对。
- [x] 新提交的干净 NSIS 构建与两份新增原文实物核对；首次 `EBUSY` 失败原样保留。
- [x] 697 份包内通知输出的独立大小/摘要、项目 MIT 原字节及三项 pending 保留。
- [x] 11 份运行文件与已验 2111 实物的摘要比较，相同字节不重复旧验收。
- [x] 新安装器只读签名状态 `NotSigned`、五份保留产物复制摘要。

## 外部依赖与剩余事项

2026-10-14 只读核对 [BGE 询证所在讨论](https://github.com/huggingface/transformers.js/issues/1487#issuecomment-6147791372)，已发送评论仍在，尚无针对固定 BGE 五文件的答复；其他模型的回复不能关闭本项。没有发送第二条消息。

SignPath 的自动和用户提交均曾遭 Captcha 拒绝；当前没有成功回执、批准或可信证书。手动申请字段仅保留在本机忽略目录，使用[官方申请表](https://signpath.org/apply.html)，不绕过验证码。默认浏览器打开请求被工具策略拦截，实际未打开。

Canvas 的 Skia/实际静态组件与运行时、Sharp 的编译对应/剩余版权及 LGPL 相应源码和修改库替换、固定量化 BGE 许可仍须闭合。三文件真签名及最终签名包的干净 Windows 验证依赖真实证书或服务配置；完整门槛见[分发收尾](../releases/distribution-closeout-2026-10-13.md)。

本机原始回执：`canvas-cargo-graph-preparation.json`、`canvas-windows-cargo-tree.log`、`canvas-fixed-upstream-notice-recovery.json`、`added-canvas-fixed-notice-assets.json`、`canvas-fixed-notice-build-first-failure.json`、`canvas-fixed-notice-candidate-final-location.json`、`canvas-fixed-notice-candidate-signature.json`，都在已忽略的本轮证据目录；来源代码/归档/凭据及个人资料不提交。
