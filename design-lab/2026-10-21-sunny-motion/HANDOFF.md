# 晴岛动效演示交接

方案 ID：`shizhi.sunny-motion.v1`。用户已确认将顺滑克制的动效接入当前 main 的全部可用功能，同时保留独立演示。

## 入口与职责

- `index.html`／`lab.css`／`lab.js`：设计室外壳、合成示例与可操作场景。外壳保持暖白、薄荷、灰紫和系统字体。
- `assets/runtime.js`／`assets/motion.css`：正式动效源码的生成副本，不能手动编辑；生成脚本是仓库 `scripts/build-motion-demo.mjs`。
- `assets/sources.json`：两份源码的 SHA-256，用于验证演示与正式实现一致。
- `design.json`／`handoff.schema.json`：本轮动效交接接口，schema v2；是静态档案，不是运行时 API。
- `previews/`：合成示例截图和 WebM。`validation.json` 记录离线与交互检查。

## 交互范围

12 场景包括导航、启动重试、最近阅读、月份签到、计时状态、导入取消、搜索筛选、阅读目录/护眼/翻页/复制/出处、流式聊天停止、证据折叠、设置与错误、下载取消。

演示中的定时反馈用于可控展示，不代表真实进度；离开场景或重置时取消所有示例定时器。停止聊天和取消下载可以立即操作。半速仅改变本页时长变量，减少动态效果同时关闭位移、缩放、循环和正在进行的 WAAPI 动画。

不能将 lab.js 的示例 HTML 或合成状态复制到正式组件。正式产品的数据、错误、取消、阅读恢复和模型请求保持原业务链。[正式规范](../../docs/design/SUNNY_MOTION.md)记录接入位置与维护规则。

## 验证与限制

正式 Electron 的 10 条相关流程已通过；浏览器演示与最终审查结果见本轮 validation.json 和[实施交接](../../docs/handoffs/2026-10-21-sunny-motion.md)。不宣称覆盖全体硬件、系统 DPI、真实模型或安装包。
