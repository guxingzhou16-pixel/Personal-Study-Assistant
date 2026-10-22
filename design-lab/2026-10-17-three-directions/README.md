# 三种学习空间 · 第一轮 UI 设计

日期：2026-10-17。状态：用于选风格的本地概念 demo，尚未选择、接入或替换正式界面。

## 先看效果

打开 [三套设计总览](index.html)，或者直接双击下列页面：

| 方向                 | 气质与结构                                                   | 交互页面                     | AI 接手档案                                                  |
| -------------------- | ------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------ |
| 01 纸间 / Paper Room | 暖纸、苔绿、衬线标题；侧栏 + 主阅读 + 轻量日历               | [纸间](01-paper/index.html)  | [说明](01-paper/HANDOFF.md) / [JSON](01-paper/design.json)   |
| 02 深潜 / Deep Work  | 墨色、酸橙绿、等宽数据；图标轨 + 导航 + 工作区 + 证据助手    | [深潜](02-deep/index.html)   | [说明](02-deep/HANDOFF.md) / [JSON](02-deep/design.json)     |
| 03 晴岛 / Sunny Isle | 鼠尾草绿、杏色、灰紫；顶部胶囊导航 + 柔和拼色 + 原创植物插画 | [晴岛](03-island/index.html) | [说明](03-island/HANDOFF.md) / [JSON](03-island/design.json) |

采用相同的三份合成资料、相同的阅读章节和问答示例，便于比较布局，而不是被不同内容影响判断。全部不使用真实学习记录或私人文件。

## 运行与交互

没有依赖或构建步骤。直接打开 `index.html`，或在本目录运行：

```powershell
python -m http.server 4317 --bind 127.0.0.1
```

浏览器访问 `http://127.0.0.1:4317/`。关闭服务不会影响直接打开本地 HTML。

可尝试：

1. 顶部切换三套风格；应用导航切换今日、资料库、阅读工作台。
2. 资料库按 PDF / Markdown 筛选、按名称/主题搜索；按 `/` 聚焦搜索。
3. 打开第一份资料，切换目录或护眼底色，展开/收起示例助手。
4. 点击助手的 `[1]` 或来源卡片，定位并高亮原文片段。
5. 点击示例签到、开始/暂停计时；刷新即重置，不写本地学习记录。
6. 导入、设置、另外两份资料和问答提交会明确解释演示范围。

宽屏阅读会自动展开助手；小于 1240px 时助手由按钮展开为侧浮层。`Escape` 可收起浮层，弹窗使用浏览器原生 dialog 的键盘行为。支持键盘焦点与减少动画偏好。

## 其他 AI 如何接手

读取顺序：

1. 项目根 `AGENTS.md` / `README.md`，确认真实产品状态。
2. 本轮 [designs.json](designs.json)，选择设计 ID。
3. 对应 `HANDOFF.md` 与 `design.json`，结合截图和实际 HTML。
4. [REFERENCES.md](REFERENCES.md)，确认借鉴点与素材来源。

`handoff.schema.json` 是三份 `design.json` 的统一结构契约。`schemaVersion: 1` 表示本轮格式，`id` 作为稳定标识；更新既有方向时保留 ID，新增方向则新增目录和注册项。`status: concept`、`runtime: static-html` 和 `sampleDataOnly: true` 防止把演示当成功能交付。

```text
index.html                  三套方案的可视化总览
shared/demo.css             共享基础与三套独立布局/视觉 token
shared/demo.js              示例内容、三套首页、切页/筛选/计时/引用交互
01-paper/                   纸间的入口、设计说明与 JSON 档案
02-deep/                    深潜的入口、设计说明与 JSON 档案
03-island/                  晴岛的入口、设计说明与 JSON 档案
previews/                   总览、三个首页与三个阅读界面截图
designs.json                机器可读设计目录
handoff.schema.json         静态设计档案接口定义
REFERENCES.md               官方参考、借鉴点和原创资产说明
VALIDATION.md               本次实际检查结果与限制
```

正式实施时，用已选方案的 token 和布局重建 React 组件；不要把整个 demo 或示例数据接到主应用。三套是独立方向，尚未实现主题切换系统。资料问答、进度、设置和引用继续走现有 `DesktopApi`，不新增第二套后端。

## 验证边界

实际结果见 [VALIDATION.md](VALIDATION.md)。本次只检查静态 demo，没有验证 Electron、真实模型、持久化或安装包。纸张封面、RAG 流程图和植物是本 demo 中的原创 CSS / inline SVG；无下载字体、远程图片或新增依赖。
