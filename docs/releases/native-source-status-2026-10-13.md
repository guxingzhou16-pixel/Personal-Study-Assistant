# 原生组件源码材料：实际取得范围与剩余缺口

日期：2026-10-13。对应应用候选源码 `2111b3cc38c931b99618f6337874a8718b3b028a`。本页帮助接手者复用已取得的文件；**材料归档不是三项许可待办已关闭，也不是原生库重建成功。** 不重复下载通过校验的同一对象。

## 已取得、校验并保留的初始库存

2026-10-14后续复用原归档，补取固定Skia完整源、官方Rust std/docs及Sharp static dev ZIP。Canvas实物/生产日志与编译器提交已核对，Sharp官方core DLL与候选同字节；新原文三份4634字节与既有Apache复用后，临时通知生成700通过。真实沙盒core DLL修改/加载/恢复已通过，未源码重建或关闭全部分发条件。新精确来源见[native-windows-provenance-0.1.1.json](native-windows-provenance-0.1.1.json)，接手先读[后续记录](../testing/native-distribution-followup-2026-10-14.md)；旧准备ZIP未加入新对象，保留原字节/摘要。

| 材料                 | 实际结果                                                         | 来源和边界                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sharp/libvips主库源  | 28/28完整归档，合计144170343字节，固定构建规则SHA-256全匹配      | 对应实物29库表；libnsgif在libvips内部，不另下载；不执行Make/编译器                                                                                                                              |
| 固定构建工程         | wrapper `ef19ca09`、基础MXE `c36160b2`完整归档                   | 原构建Docker基础环境并非全部锁定，不能声称重现相同二进制                                                                                                                                        |
| 原始主库通知         | 96候选；去重、排除空pixman AUTHORS后，92份原文进入新包           | 唯一Latin-1的LCMS AUTHORS保持原字节并声明编码；其余UTF-8。包含部分源工具/测试通知，不能全称为实际链接库                                                                                         |
| GVDB                 | revision `2b42fc75f09dbe1cd1057580b5782b08f2dcb400`完整源码/许可 | 24716字节；SHA `069a00aa1fc893f18423602f4e095583be5a220429f6e8a58d70511490b4b019`；GLib实际使用的嵌套源                                                                                         |
| librsvg Rust候选超集 | 353/353 registry归档，全匹配Cargo checksum；38515537字节         | 原366锁项扣除补丁移除项后，包含开发/其他平台；实际Windows链接子集未验证                                                                                                                         |
| Cargo原文通知        | 634候选及5份固定上游补充                                         | 11包无独立具名许可文件，部分可由源头部/固定VCS补证；不能用通用模板自拟版权                                                                                                                      |
| Rust运行时源         | 2026-09-24 nightly完整源，263102648字节                          | SHA `f2c139528ba025f1141935df4f634e18db614b9b3b1cf2ea59e3675a6ade89f3`；单次取得、未安装/编译；包含std/panic_abort等需继续映射                                                                  |
| Canvas Rust候选超集  | 固定`b2723ffa` Cargo.lock的93/93归档                             | 30对象复用上面缓存，仅首次下载差集11083306字节；实际Windows链接子集未验证                                                                                                                       |
| Canvas附加原文       | 158份唯一候选，788917字节                                        | 原文来自校验后的Cargo/vendor目录；原包尚未携带此新增部分                                                                                                                                        |
| Canvas工程/Skia DEPS | 固定Canvas工程归档及Skia `a9c42c9` DEPS                          | Canvas归档29943548字节/SHA `4a231fcaea205c8f80b98faa53eac7de84dd0e85e1997dcd71df7567917fbef9`；DEPS10719字节/SHA `ebb0e737f98dab08499afcf0f0ed87f9de0c6e8c25a31fc4fb5283baab42a9d6`，未执行工程 |

本机目录：`artifacts/signed-distribution-7ff696bd-f0c1-450f-a1d6-ad8db0bb9681/`，全部是本轮UUID拥有的素材/记录，不是用户学习数据。源码原文不格式化，不把首次失败覆盖为成功。

仓库中的[native-sources-0.1.1.json](native-sources-0.1.1.json)保留450条可复用来源/大小/摘要和通知成员：28主归档、416唯一Cargo归档（353/93候选共享30对象）、5构建/运行时归档及1份Skia元数据。所有来源都是公开上游，未公开本机绝对路径或个人联系资料；`compiledInclusionVerified=false`明确说明仍是候选超集，不是完整实物SBOM或相应源码提供承诺。

### 关键纠正

- imagequant实际是`lovell/libimagequant@v2.4.1`的BSD旧fork，SHA `47d2a84b7b1052975c9d50a3d4e3cacbf57b43d84a4c3131210848ead9964dfb`；1851字节COPYRIGHT含Jef Poskanzer原许可，不套用当前主线GPL商业双许可。
- `glib-2-without-gregex.patch`删除GRegex/PCRE链接，旧构建注释已经过时；不能将未打补丁的wrap当实际链接组件。
- librsvg补丁移除`color_quant@1.1.0`、`gif@0.14.2`、`image-webp@0.2.4`、`weezl@0.1.12`，并关Cairo PDF/PS；不能把原锁全部当实物组件。
- Canvas的Rust AVIF路径包含`libavif-sys@0.17.0+libavif.1.0.4`和`libaom-sys@0.17.2+libaom.3.11.0`，与Sharp的aom3.15.1分别记录；mimalloc的两个原vendor许可也已取得。Skia禁用自身AVIF并不代表Canvas没有AVIF。
- 保留本地路径问题及3次TLS EOF的原失败记录；前者只修复短文件名库存，未重新下载，后者一次定向重试取得匹配checksum。官方libxml2旧目录404后用官方2.15目录取得相同预期SHA，没有关闭TLS检查。

## 可复用的归档

`native-source-preservation-0.1.1.zip`，**462204248字节**，SHA-256 `a90a42e48e5b5022ad08f5f21108a1b879c1f614f9525638f698dd7be983e26a`，809成员，ZIP CRC检查通过。源归档及通知保持原字节；`source-files.json`含逐文件大小/摘要。没有本应用安装器、模型权重、用户数据库或用户密钥。

这是**尚未公开上传的准备归档**，包括28主库、GVDB、构建工程、两套Cargo超集、nightly源及通知；Canvas工程/Skia DEPS是随后另取得，尚未加入该冻结ZIP。不手工改已有ZIP/摘要。最终分发材料需补齐下节后另作新归档，不能把这个准备包当完整Corresponding Source承诺。

### 精确接手文件

- `sharp-source-scope-f269d6aa-88f3-4fbf-b761-fef7e50da015/sources-fetched.json`：28主归档、每次真实URL/SHA、原失败。
- `source-graph-candidates.json`、`selected-build-patches.json`：固定构建覆盖和16补丁候选。
- `cargo-sources-final.json`、`cargo-licenses-inventory.json`、`cargo-packages-without-named-license-files.json`：353超集、原文位置和具体缺口。
- `cargo-fixed-upstream-notice-records.json`、`rust-nightly-source-record.json`：后补固定上游和nightly原始对照。
- `sharp-native-linkage.json`：实际三个原生文件的PE导入/摘要，不是替换运行证明。
- `canvas-source-scope-root/sources-inventory.json`：93候选、复用/下载及158通知。
- 根证据目录的`source-bundle-index.json`、`source-bundle-receipt.json`：冻结ZIP的逐文件原始摘要。

## 仍须完成的具体事项

### Sharp/LGPL

1. 将原库/Rust/运行时头部版权与实际Windows构建组件映射，补齐非独立LICENSE文件对应的明确依据；源码超集不能冒充实物全链接列表。
2. 核对适用LGPL共享库/组合分发方式，准备同批可取得的相应源码、必要通知及修改/调试与替换说明。源码、应用MIT和库许可分开。
3. 包中的`sharp-win32-x64-0.35.5.node`依赖`libvips-42.dll`和`libvips-cpp-8.18.7.dll`，路径为`resources/app.asar.unpacked/node_modules/@img/sharp-win32-x64/lib/`。2026-10-14已在真实沙盒对core DLL副本修改版本表一byte，三新进程读到8.18.7→8.18.8→8.18.7，像素/PNG/原addon不变，恢复原摘要。此项实际修改/加载/恢复通过，不能用复制原DLL替代，也不必重做；尚未源码重建C++ bridge或关闭组合库及相应源码义务。

### Canvas

1. 沿固定Skia DEPS与Windows GN参数核对Skia/ICU/FreeType/JPEG/PNG/zlib等实际静态组合；现有52补充和新增Cargo通知各有范围。
2. 已取得的Rust/vendor通知已按原字节/来源/SHA接入50da0f5的388补充，695输出核对通过；继续核对候选与实际Windows组件的对应、剩余未取得的头部版权，旧2111的472输出不改写。
3. 补齐实际编译运行时及源头部版权覆盖；Node解析两页PDF只证明当前样本可加载，不能关闭分发条件。

### 固定量化BGE

原revision/五文件不变。[固定Xenova模型卡](https://huggingface.co/Xenova/bge-small-zh-v1.5/blob/75c43b069aac4d136ba6bc1122f995fedcfd2781/README.md)没有LICENSE/明确量化授权；BAAI基座卡为MIT不等于本项目已取得量化发布者的缺失证明。权重不进入安装器/本源码ZIP。已核对[维护者的相关模型许可讨论](https://github.com/huggingface/transformers.js/issues/1487)及[BGE现有量化更新讨论](https://huggingface.co/Xenova/bge-small-zh-v1.5/discussions/1)，没有可用于关闭本固定版本的明确答复。用户已单独授权，实际[五文件询证评论](https://github.com/huggingface/transformers.js/issues/1487#issuecomment-6147791372)已发送并读回，全文与范围见[询证记录](bge-license-inquiry.md)；等待答复和对应原始通知，不暗换模型/hash/向量缓存标识。

## 本轮继续：原始次级通知接入

校验793个Sharp/Canvas候选通知成员，全部字节/摘要匹配、UTF-8且无NUL；按内容摘要复用完全相同的原文，新增223份唯一资产，共674323字节，新增267个确切原生包的归属引用。未执行上游源码、未改写原文，`reviewIssues`仍为3。原始候选数量与去重后文件数量分别保留，不伪称全部候选实际链接进Windows二进制。

新增内容已进入现有`manifest.json`和`source-records.json`，冻结`50da0f53fae63d1fb9539ff4129ed0ed14f0d7bb`的干净NSIS构建及695输出核对通过，388补充包含新增223原文。主程序/ASAR/9原生文件与2111字节一致，没有重复旧CPU/PDF或安装测试；setup实际NotSigned，3pending保留。旧2111仍472输出，不追写其已含新223文件。本机`rust-notice-copy-plan.json`、`added-rust-notice-assets.json`及`rust-notice-candidate-final-location.json`保留逐项来源/新候选摘要，详见[验证记录](../testing/signed-distribution-2026-10-13.md)。

### 2026-10-14 增量：Canvas 声明图与缺失原文

复用93份归档，离线Cargo图选出83个Windows普通/构建依赖；7项未带独立LICENSE的原manifest均与固定VCS源码匹配，补取得两份工作区许可共3200字节，napi-sys同Git blob复用。图解析不执行/编译源码，后续固定许可核对用了网络。新清单与[声明依赖图](canvas-rust-graph-0.1.1.json)保留来源/摘要，不代表Skia C++或运行时及发布DLL实际全覆盖。两份新原文已入77acd64的697输出/390补充实物，与提交/源字节一致，11运行文件与2111相同；首次MIT复制EBUSY失败及新UUID打包重试成功均保留，不重跑旧功能。旧50包不追写新两份，见[增量验证](../testing/native-notice-followup-2026-10-14.md)。

所有完成/剩余门槛以[分发收尾](distribution-closeout-2026-10-13.md)为准；签名申请依[政策与真实状态](code-signing-policy.md)处理，不重复已足够的旧软件/安装测试。
