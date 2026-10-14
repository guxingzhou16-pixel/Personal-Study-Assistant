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

最新已验实物仍为 [50da0f5 的 695 份通知候选](signed-distribution-2026-10-13.md)。上述两份新增原文尚未进入该旧包。待冻结新提交并构建后，在本节记录新候选自身的来源、安装器大小/摘要及实物结果；不预先将预期数量写作通过。

- [x] 固定 Windows 声明依赖图、93 → 83 的范围及 7 份原 manifest 核对。
- [x] 两份固定 Git blob 许可全文取得、来源/字节/摘要与确切包归属核对。
- [ ] 新提交的干净 NSIS 构建与两份新增原文实物核对。
- [ ] 全部包内通知输出的独立大小/摘要、项目 MIT 原字节及三项 pending 保留。
- [ ] 运行文件与已验 2111 实物的摘要比较，按实际变化决定相关检查范围。
- [ ] 新安装器只读签名状态、五份保留产物复制摘要与对应远端 CI。

## 外部依赖与剩余事项

2026-10-14 只读核对 [BGE 询证所在讨论](https://github.com/huggingface/transformers.js/issues/1487#issuecomment-6147791372)，已发送评论仍在，尚无针对固定 BGE 五文件的答复；其他模型的回复不能关闭本项。没有发送第二条消息。

SignPath 的自动和用户提交均曾遭 Captcha 拒绝；当前没有成功回执、批准或可信证书。手动申请字段仅保留在本机忽略目录，使用[官方申请表](https://signpath.org/apply.html)，不绕过验证码。默认浏览器打开请求被工具策略拦截，实际未打开。

Canvas 的 Skia/实际静态组件与运行时、Sharp 的编译对应/剩余版权及 LGPL 相应源码和修改库替换、固定量化 BGE 许可仍须闭合。三文件真签名及最终签名包的干净 Windows 验证依赖真实证书或服务配置；完整门槛见[分发收尾](../releases/distribution-closeout-2026-10-13.md)。

本机原始回执：`canvas-cargo-graph-preparation.json`、`canvas-windows-cargo-tree.log`、`canvas-fixed-upstream-notice-recovery.json`、`added-canvas-fixed-notice-assets.json`，都在已忽略的本轮证据目录；来源代码/归档/凭据及个人资料不提交。
