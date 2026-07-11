# The Garden

A personal digital garden built as a course website project.

## Greenhouse AI configuration

The Greenhouse Seed Gardener calls DeepSeek from the server through `POST https://api.deepseek.com/chat/completions`. Create `.env.local` in the project root, then set:

```text
DEEPSEEK_API_KEY=your_key_here
```

The server uses `deepseek-v4-flash` with thinking mode disabled. Before making a real API call, create a key on the DeepSeek platform and make sure the account has available balance. Never commit `.env.local` or any real secret; `.gitignore` excludes local environment files. Without the variable, the Greenhouse UI remains usable and the API returns a safe configuration error instead of a simulated AI result.

## Documentation

- `AGENTS.md` — instructions for Codex
- `docs/MASTER_SPEC.md` — technical and product source of truth
- `docs/CONTENT.md` — confirmed visitor-facing copy and content
- `docs/TODO.md` — phased implementation checklist

## Recommended first Codex prompt

```text
请先阅读：

- AGENTS.md
- docs/MASTER_SPEC.md
- docs/CONTENT.md
- docs/TODO.md

暂时不要编写页面代码。

请先完成以下工作：

1. 检查规格中是否存在技术冲突、缺失依赖或无法实现的要求。
2. 提出推荐的 Next.js 项目结构。
3. 列出 Version 1 需要安装的最少依赖。
4. 将开发工作拆分为清晰阶段。
5. 标出任何需要我补充、但禁止你自行编造的内容。
6. 不得扩大 Version 1 范围。

最后给出一份实施方案，等我确认后再开始 Phase 1。
```

## Phase 1 prompt

```text
开始 Phase 1 — Foundation。

严格遵守 AGENTS.md、docs/MASTER_SPEC.md、docs/CONTENT.md 和 docs/TODO.md。

本阶段只完成：

- 创建 Next.js + TypeScript 项目
- 建立基础目录结构
- 创建共享类型与内容数据
- 建立全局字体、配色、间距、按钮、卡片和状态系统
- 实现 TopBar、Garden Guide 和 Footer
- 创建所有主页面的稳定占位路由

完成后：

- 运行 lint
- 运行 TypeScript 检查
- 运行 production build
- 更新 docs/TODO.md
- 总结修改文件与检查结果

不要提前开发 Phase 2。
```
