# Sharp Windows 0.35.5 分发材料询证记录

2026-10-14最新：维护者已将[432](https://github.com/lovell/sharp-libvips/issues/432)关闭为not planned、标llm-generated，回复要求官方真人Question模板；没有提供许可答复。用户选择暂不追加，继续现有材料。自动API/LLM再提交可能使账户被维护者屏蔽，不能继续原自动询证；[人工资料与边界](sharp-human-followup-facts.md)及[源码安排](sharp-source-distribution-plan.md)是接手入口。下方保留当时真实发送记录，不再将其“尚无答复”当当前等待状态。

日期：2026-10-14。**用户已单独授权，两条中的这一条已创建并全文读回；尚无覆盖缺口的答复。** 实际 [issue432](https://github.com/lovell/sharp-libvips/issues/432)，账号 `guxingzhou16-pixel`，创建于 `2026-10-14T07:32:33Z`；正文 SHA-256 `e5722002e1494468a458364906a9d6db4f9aba937d28631300c580fd62f21523`，取自已审阅提交 `e4b89ad64e8fdb694c0863c6be996fd524c5dd84`。已有 [401](https://github.com/lovell/sharp-libvips/issues/401) 针对旧 Darwin 1.3.2，不能作为 Windows 当前库的答复。

连接器首次返回403“Resource not accessible by integration”，未创建。随后核对已有Git登录账号、仓库ID/公开/issue可用及本人无同正文/标题重复项，只POST一次；按issue number再次GET核对账号、完整正文/标题/摘要。没有保存凭据，未联系被转介的其它仓库。本机回执 `upstream-inquiry-1-result.json` 留在本轮忽略证据目录。

## 标题

Windows 0.35.5 / libvips 8.18.7: corresponding source and combined-library notice mapping

## 正文

Hello, thank you for maintaining Sharp/libvips. We are preparing third-party distribution material for a small MIT-licensed Windows study application. We use `@img/sharp-win32-x64@0.35.5`; we are asking for exact producer source/notice pointers, not a new license grant or a commercial-use guarantee.

### Exact artifacts

- `libvips-42.dll`: 19,018,240 bytes, SHA-256 `06dab07cc386748513337a31672b1d5269fbc770a14ff403080575665bf0813f`.
- `libvips-cpp-8.18.7.dll`: 333,312 bytes, SHA-256 `25001dbd05305a0a29119ab49933622c70b4a20ea12ef1d5d20ca40181db53bf`.
- `sharp-win32-x64-0.35.5.node`: 443,904 bytes, SHA-256 `971048779f9c8598df14641dfc03c625885c93f473a788e65ca2deb50d0b083e`.

### Evidence already obtained

The core DLL exactly matches the member in the official [`vips-dev-x64-web-8.18.7-static.zip`](https://github.com/libvips/build-win64-mxe/releases/tag/v8.18.7), whose archive SHA-256 is `a736af61d3b46499760efa606e469cb14e060445b1f6fd36a1fa2e75009e1197`.

We retained `build-win64-mxe@ef19ca09af2453d127453d677c849ccb37cf5694`, its MXE base `c36160b231e66e1cbe032ed54aef7617e8b259da`, fixed rules/patches, 28 checksum-matched main source archives, GVDB, the candidate librsvg crate archives and the pinned 2026-09-24 Rust source. The original 29-library table and applicable GPL/LGPL texts are preserved. We distinguish the old BSD libimagequant fork and the build patches that remove GRegex/PCRE and selected librsvg image codecs.

In an isolated Windows VM, we also verified the shared-library loading mechanism by changing one version-table byte in a copy of the core DLL: the unchanged native addon read `8.18.7 → 8.18.8 → 8.18.7` across three new processes, with identical PNG output/pixels and restored original DLL digest. This was a genuine binary modification/load/restore test, **not a source rebuild** or a claim to have tested arbitrary ABI changes.

### Remaining questions

1. Is there an immutable source/build record or SBOM mapping the actual core DLL to its librsvg 2.63.2 crate resolution, `-Zbuild-std` runtime components, embedded source notices and compiler runtime? Our candidate archives are a superset; we do not want to present that as the exact final linked set.
2. Which exact original source/notice material should accompany the MSVC C++ bridge DLL built for Sharp 0.35.5, and the compiler/runtime/header portions in these three binaries? A pointer to the matching published source bundle/build recipe would help.
3. For the combined static dependencies inside the core DLL, is there already published same-build Corresponding Source and, where applicable, an uncombined-library form or documented distribution route? We intend to preserve modification/relinking and debugging rights and to supply the material required by the selected LGPL route. Please identify any material missing from the producer release rather than treating our load test as a complete distribution review.

We are retaining all third-party terms separately from the application MIT license. Existing release material or confirmation of missing producer metadata is sufficient. Thank you.

## 收到答复后

核对答复与上述确切 Windows 版本/摘要对应；保存所指定原文、源包、必要构建材料与组合分发条件。替换测试结果只证明该副本在当前 ABI 下加载/运行，不能替代来源、源码重建或组合库义务。未覆盖的部分不关闭；这一条已授权并发送，不授权追加消息或联系其它仓库。
