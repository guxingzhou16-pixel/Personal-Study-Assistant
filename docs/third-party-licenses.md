# 第三方许可与分发说明

日期：2026-10-10。**状态：已接入58份许可与来源资产；下述来源/原生分发余项仍待核对，不能据此公开发行。** 这份文档记录工程证据，不作法律合规通过结论。项目本身的授权方式尚未选择，`package.json` 的 `private: true` 不代表已授予代码或二进制分发许可。

## 1. 安装包中如何查阅

目录包和安装版的 `resources/third-party/` 包含：

- `README.txt`：实际包名/版本、阅读方法、许可审阅状态及待办。
- `packages.json`：实际 ASAR 包清单，包含嵌套依赖和不同版本；记录原始许可表达式、仓库、元数据及许可文件位置/摘要。
- `metadata/`：各依赖原始 `package.json`，保留上游作者等信息，不编造版权年份。
- `licenses/`：实际包内许可、通知、作者文件的原始字节；包含 Electron/Chromium 文本。
- `supplements/`：本仓库固定版本和 SHA-256 的官方补充资产。标准参考模板明确标注来源和缺口，不冒充某依赖的上游版权通知。

包根原有 `LICENSE.electron.txt` / `LICENSES.chromium.html` 和 PDF 资源许可仍保留。许可文件不替代运行验收；安装后能读取这些文件也不代表每项分发条件已满足。

## 2. 可维护的资产与生成规则

源资产在 [scripts/licenses/assets](../scripts/licenses/assets)，来源记录在 [source-records.json](../scripts/licenses/assets/source-records.json)，打包清单在 [manifest.json](../scripts/licenses/manifest.json)。原49份资产增加9份，现为58份，分别记录官方 URL、固定 revision、SHA-256、大小或提取方式。DirectML 原 EULA 由官方 NuGet 许可页面的 `pre` 提取并解码，本轮与完整 NuGet 的 `LICENSE.txt` 原字节对照一致；新增 `LICENSE-CODE.txt` / `ThirdPartyNotices.txt` 保留 ZIP 成员原文，并记录整个压缩包的 URL、摘要、大小和成员路径。Sharp README/versions 是锁安装的原始本机文件，未冒称已重新下载对照。

Canvas 四项依赖的根通知来自官方 Gitiles 固定提交；新增 FreeType `264b5fb…` 的7份次级文件来自官方 FreeType GitHub 同一提交，API base64 解码后核对固定树的 Git blob。保留完整 `fthash.c/h`、内嵌 `zlib.h` 和4份 HarfBuzz 来源文件，不抽取或改写头部。完整源文件用于保存其内嵌许可与版权，不代表已重建 Canvas 或证明全部二进制覆盖。版本与修改来源 README 一并保留，不用许可日期猜 fork 版本。

[package-notices.mjs](../scripts/package-notices.mjs) 接在 `verify-package.mjs` 的 afterPack 中：

1. 按实际 ASAR 的规范包目录读取元数据，包含嵌套 `node_modules`，不抄开发顶层版本。
2. 许可归属以最近的实际包根确定，不能用子依赖许可替缺失的父包许可。
3. 补充项须匹配确切包名/版本；缺文件、摘要不符、路径穿越或链接均拒绝成功。
4. 将原文写入本次新输出并重新读取核对大小/摘要，不修改旧 ASAR、旧安装包或旧回执。
5. 将文件核对结果及 `reviewStatus` / `reviewIssues` 写入 `package-audit`，由最终目录/安装器清单覆盖这些文件。`static-copies-verified` 仅说明文件复制与摘要核对，不是合规认证。

历史 `ce9caae` ASAR 基线与 `3955e01` 候选均有150个实际依赖：147个顶层加3个嵌套包，其中 ONNX common 的稳定版和开发版分别记录。该目录包包含150份元数据、158份原始许可/通知（含Electron/Chromium）及49补充；359输出文件和引用摘要已独立核对，六项审阅待办保留。未改旧候选；完整产物及摘要以 [发布验收总表](testing/release-readiness.md) 为准。

2026-10-10 的源清单已增至58补充。按既有150包/158许可/150元数据计算，下次候选预期为368输出文件；本轮只接入材料并做纯文件测试，尚未生成或验收包含新增9份文件的新候选，不能将旧候选的359文件回执改写成新包已验证。

更新依赖时同步更新版本对应的资产/清单；不要放宽校验以接收旧版本通知。`.gitattributes` 禁止资产换行转换，`.prettierignore` 排除该目录，确保Git checkout与格式化保留上游原始字节和摘要。打包时不联网获取新的许可，网络失败不会偷偷换成其它版本。

## 3. 已补的具体说明

| 组件                         | 本轮资产及来源边界                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron / Chromium / PDF.js | 保留实际包内原始许可及 PDF CMap/字体/WASM 通知；Electron/Chromium 文本另列索引。                                                            |
| Sharp Windows x64 0.35.5     | 保留原生 README 的29库表、versions、sharp-libvips 1.3.4 通知、libvips 8.18.7 许可和 LGPL 2.1/3、GPL 3 全文。不能只写 Sharp 的 Apache 许可。 |
| Canvas Windows x64 1.0.9     | Canvas 发布提交、所 pin 的 Skia/ICU、Skia 模块及若干确切外部库许可；新增固定 FreeType 的7份内嵌许可源文件，完整二进制覆盖仍待核对。         |
| ONNX                         | common/node 1.30.0、web `8d85527…`、嵌套 common `2a43ec0…` 各自版本的 LICENSE / ThirdPartyNotices。                                         |
| DirectML 1.15.4              | 实际 NuGet EULA、完整包中的 LICENSE-CODE / ThirdPartyNotices 和独立的发布提交 NOTICE；原始 DLL 的证书差异准确记录，不替换软件分发条款。     |
| DXC 1.8.2502                 | 与实物 DLL 版本对应提交的 LICENSE.TXT / ThirdPartyNotices，覆盖 dxcompiler/dxil 的已取得通知。                                              |
| GUID TypeScript 1.0.9        | 原始 npm 元数据及明确标为参考的 SPDX ISC 模板；完整发布 tarball 的 integrity 已对照，确实没有上游许可全文，版权缺口保留。                   |
| BGE                          | 上游 FlagEmbedding **代码**许可作为明确区分的来源材料；不能将它当固定量化权重的许可授权。权重不随安装包分发。                               |

完整直接来源及摘要见清单，不用动态 `master/main` 链接替代已经固定的版本。

### DirectML 完整包的具体对照

本轮取得 [官方 Microsoft.AI.DirectML 1.15.4 NuGet](https://api.nuget.org/v3-flatcontainer/microsoft.ai.directml/1.15.4/microsoft.ai.directml.1.15.4.nupkg)，请求重定向至官方 `nuget.azure.cn`，包大小202292617字节、SHA-256 `4e7cb7ddce8cf837a7a75dc029209b520ca0101470fcdf275c1f49736a3615b9`。只读取 ZIP，未执行其中程序。`LICENSE-CODE.txt` 为1093字节、`ThirdPartyNotices.txt` 为4577字节，两个成员全文已接入；既有88339字节的 release NOTICE 是另一份文件，继续独立保留。

当前候选的 DirectML.dll 为18527584字节，NuGet x64 DLL 为18527776字节，原始摘要不同。两者 FileVersion 均为 `1.15.4+241025-1615.1.dml-1.15.fac7597`。按 [微软 PE 格式](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)，只排除文件尾部证书表并清零 checksum / Security Directory 后，剩余18517504字节完全相同，归一 SHA-256 `518c2f3fc40dd6e7ed2087bb21cf9b98296e8f0066e9c74d3d52b76766cdd4d7`。原始文件和归一结果均记录在 source-records；不能写成 raw SHA 相同、签名信任验证通过或分发条件通过。

## 4. 发布前尚需完成

- [ ] **GUID**：完整官方1.0.9 tarball 的 SHA-1/SHA-512 与上游元数据匹配，四份文件确实没有 LICENSE/NOTICE/版权文件。包声明 ISC/作者 nicolas，但精确 gitHead API 在重定向后返回422。仍须取得相应通知或确认可接受的替代方案；模板不会消除此缺口。
- [ ] **Canvas**：pin的FreeType `264b5fb`、libjpeg-turbo `e14cbfa`、libpng `d5515b5`、zlib `646b7f5` 主许可与FreeType/JPEG引用全文已补入，FreeType内嵌zlib/HarfBuzz/fthash的7份原文件也已保留。Chromium zlib 的 SIMD/Intel/contrib 次级材料本轮获取超时，仍须按实际二进制构建核对完整覆盖，不能用Google胶水代码BSD或根许可代替所有外部/嵌入代码。
- [ ] **Sharp/LGPL**：核对完整依赖版权、相应源码与实际构建、可替换库及适用分发条件。已确认 [build-win64-mxe固定提交](https://github.com/libvips/build-win64-mxe/commit/ef19ca09af2453d127453d677c849ccb37cf5694) 为8.18.7构建来源，并只读取得六份构建规则；sharp-libvips `ebb95f8…` 包装脚本选择 static ZIP 路线。完整依赖源码/补丁未齐，未重建或验证替换/重链接；表格、标准条款和部分脚本不等于全部对应材料已齐。
- [ ] **固定 BGE**：取得 Xenova revision `75c43b069aac4d136ba6bc1122f995fedcfd2781` 对应模型卡/版权材料并核对上游关系。本轮官方 raw/resolve/revision API 和 curl 未成功；上游当前模型卡的 MIT 声明和代码许可不足以冒称量化版本已全部核对。设置页已撤去无条件“MIT许可证”标记，说明来源与待办。
- [ ] **DirectML**：完整 NuGet 已核对，EULA、两份额外通知和独立 release NOTICE 均保留；发布前仍须核对适用分发条件和新候选通知覆盖。DLL 非证书内容匹配不等于签名信任或分发条件通过。
- [ ] **项目许可**：由用户选择自己的代码授权；第三方仍适用各自许可。选择许可不等于授权推送、公开仓库或发布安装包。

这些是已发现的实际缺口，保持在随包说明和发布门槛中。工程候选可用于隔离验收，公开发行继续待完成。

## 5. 本轮验证范围

2026-10-10 接入新增资产后，`node --test scripts/package-notices.test.mjs` 的5项纯文件测试通过，覆盖嵌套版本/归属、父包缺许可、补充版本/摘要、路径穿越、待审阅状态保留。规格使用合成文件，不能代替实际新候选的58份补充及全部输出回执；本轮未启动 Electron/安装器、SQLite 或模型。最终语法/构建、静态审查和新候选文件回执另记发布总表；原软件功能清单不因此自动通过。
