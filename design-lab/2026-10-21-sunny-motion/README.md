# 晴岛全功能动效设计室

日期：2026-10-21。保持晴岛原版外观，以轻移、淡入、连贯选中和操作反馈覆盖当前 main 的可用功能。

**[双击打开离线演示](index.html)** · [预览录像](previews/motion-overview.webm) · [正式动效规范](../../docs/design/SUNNY_MOTION.md) · [交接](HANDOFF.md) · [机器档案](design.json)

12 组场景可以直接操作，或使用“播放主动作”“重置场景”。支持半速与减少动态效果预览，也跟随系统偏好。全部资料、日期、时长、聊天和结果是示例；不调用桌面桥接、网络、剪贴板或模型，不保存学习数据。

演示复用正式动画控制器和样式的生成副本：

```powershell
node scripts/build-motion-demo.mjs
```

从仓库根目录运行。源码变化后重新生成，摘要保存在 `assets/sources.json`。HTML 使用经典脚本，可在 `file://` 下打开；不需要 npm dev server。根目录 `designs.json` 登记本轮唯一方案，`handoff.schema.json` 约束新增动效档案；不改旧轮 schema。

截图、WebM 及 `validation.json` 是合成示例的设计资产。正式软件是否通过验证，以[实施交接](../../docs/handoffs/2026-10-21-sunny-motion.md)为准，不由演示动画推断真实功能完成。
