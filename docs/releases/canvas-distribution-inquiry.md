# Canvas 1.0.9 Windows 分发材料询证记录

日期：2026-10-14。**用户已单独授权，两条中的这一条已创建并全文读回；尚无覆盖缺口的答复。** 实际 [issue1360](https://github.com/Brooooooklyn/canvas/issues/1360)，账号 `guxingzhou16-pixel`，创建于 `2026-10-14T07:31:39Z`；正文 SHA-256 `1afc9f9fc61b74c42beaded59b3969f59cb6251895b12a302fb71b8211ea8317`，取自已审阅提交 `e4b89ad64e8fdb694c0863c6be996fd524c5dd84`。下方为实际已发送全文，不含申请姓名、邮箱或本机路径。已有 [1343](https://github.com/Brooooooklyn/canvas/issues/1343) 针对旧 0.1.100 的请求没有评论，不能作为本版本答复。

连接器首次返回403“Resource not accessible by integration”，未创建。随后核对已有Git登录的实际账号、仓库ID/公开/issue可用及本人无同正文/标题重复项，只POST一次；按issue number再次GET核对账号、完整正文/标题/摘要。没有保存凭据，未追加评论或扩大联系范围。本机回执 `upstream-inquiry-0-result.json` 留在本轮忽略证据目录。

## 标题

1.0.9 Windows x64: producer source/notice mapping for Skia and static runtimes

## 正文

Hello, thank you for maintaining Canvas. We are preparing third-party materials for a small MIT-licensed Windows study application using `@napi-rs/canvas-win32-x64-msvc@1.0.9` through PDF.js. We are asking for producer build/notice information, rather than a commercial-use guarantee or a new license grant.

### Exact artifact and evidence already obtained

- Source: `b2723ffae4e74e8c9df752902b137ec4061530e9`.
- Shipped `skia.win32-x64-msvc.node`: 27,436,032 bytes; SHA-256 `f69cac8093b0a4914d41a01add30a08cb739ecc254ad1d124b1804384af16586`. This matches the [v1.0.9 release asset](https://github.com/Brooooooklyn/canvas/releases/tag/v1.0.9).
- [Producer CI run 34340650671](https://github.com/Brooooooklyn/canvas/actions/runs/34340650671), Windows x64 job `102430380104`: the available log records Rust 1.98.1 / `48a229ceaefd4985c50990b14116b6d856af0985`, `--locked`, and downloads of the ten static libraries from `skia-a9c42c9f`. The Rust commit also appears in the shipped binary.
- The fixed Canvas tree points to Skia `a9c42c9fce77cd748805df0ec67ef5718800b1e9`. We obtained that source, DEPS, Windows GN flags, and existing external-library notices. We have not rebuilt Skia or claimed that resolving declared targets proves the final linked object set.
- The original committed Cargo.lock and checksum-matched crate archives are retained. An offline Windows normal/build graph selects 83 dependencies; seven missing standalone notices were mapped to their fixed VCS manifests and original workspace licenses.
- We preserve original notices, including the vendored Rust AVIF/AOM path separately from Skia's disabled AVIF option, and FreeType/Chromium zlib embedded notices.

### Remaining questions

1. Is there a producer dependency/object/source list or notice index for the ten `skia-a9c42c9f` Windows x64 static libraries and this final `.node`? We need to identify remaining embedded C/C++ notices without substituting glue-code/root licenses for separately licensed source.
2. Which original notice material should accompany the Rust standard-library/out-of-tree runtime components and the statically linked Windows C/C++ runtime? We obtained the fixed Rust base/Unicode notices; the standard-library and documentation archives did not contain the detailed `COPYRIGHT-library.html` mentioned by Rust's COPYRIGHT file. A pointer to appropriate producer material is sufficient.
3. Does an existing release/source record document the applicable redistribution terms for the static runtime portions in this exact Windows artifact? Please point us to it, or identify any additional downstream condition we should retain.

We will keep third-party terms distinct from our application MIT license and preserve the original bytes. If the producer metadata was not retained, confirmation of that limitation would also help. Thank you.

## 收到答复后

核对答复作者、版本/目标/实物摘要与所覆盖组件；保存原文 URL，取得指定通知并核对来源/摘要。缺少生产记录不能由今天重建的图替代；未得到明确覆盖的部分继续保留在分发门槛中。这一条已授权并发送；不授权追加消息、其它维护者或 BGE 已发送评论的再次提交。
