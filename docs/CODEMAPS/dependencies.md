# 依赖、构建与运行地图

<!-- Updated: 2026-10-21 | Source files scanned: 167 -->

版本以 `package.json`／锁文件为准，本图描述当前工作区，不代表包的普遍兼容性已验证。

| 作用           | 当前依赖／入口                                                               |
| -------------- | ---------------------------------------------------------------------------- |
| 窗口与本机能力 | Electron 44.5.1，内置 Node SQLite、safeStorage、utilityProcess               |
| 界面           | React 19.3、TypeScript、Vite，Lucide 图标                                    |
| Markdown       | react-markdown、remark-gfm、unified／remark-parse，禁用不可信 HTML／图片执行 |
| PDF            | PDF.js；`prepare-pdf-assets.mjs` 准备本机 CMap、字体和 WASM                  |
| 本地嵌入       | Transformers.js、ONNX Runtime，固定 BGE 中文 Q8，独立 CPU worker             |
| 聊天服务       | 本机 Ollama NDJSON／兼容 OpenAI SSE，用户自行配置                            |
| 验证           | Vitest 核心、Playwright Electron、Node 打包规则规格                          |

## 构建路径

```text
打开拾知（本地最新版）.cmd
  → npm run desktop:build
    → typecheck + Vite → dist/
    → scripts/build-electron.mjs → dist-electron/
  → Electron 当前项目

scripts/package-desktop.mjs + electron-builder.json
  → release/ 下独立候选；verify-package.mjs 检查包内容
```

开发模式由 `scripts/dev.mjs` 启动本地 1420 端口 Vite 和 Electron，退出时收口进程。构建后的本地入口直接加载本机 `dist/index.html`。

`vite.config.ts` 排除对测试产物、发行包、本地体验数据和第三方下载的监听。它们不是热更新源码；监听 Electron 正在使用的缓存文件会在 Windows 上造成 `EBUSY` 并使开发服务退出。

`scripts/eval-retrieval.mjs` 使用 `tests/retrieval-evaluation.ts` 和合成 fixtures；真实模型门禁由单独 Playwright 配置选择，不属于普通测试的自动下载步骤。

`scripts/licenses/` 和固定资产路径参与发行验证及摘要核对，本轮保持不动。第三方分发条件看[许可说明](../third-party-licenses.md)；没有因目录整理添加依赖、远程服务或安装步骤。
