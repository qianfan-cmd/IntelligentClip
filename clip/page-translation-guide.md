# 页面翻译技术实现与优化（速度优先版）

> 适用代码文件：
> - `src/contents/floatBtn.tsx`
> - `src/contents/pageTranslator.ts`
> - `src/background.ts`
>
> 当前策略：速度优先（并发竞速 + 分块即时写回 + 全量调度），典型整页翻译用时约 2–5 秒，首段更快出现。

---

## 总览

- 目标：点击后尽快完成整页翻译，体验接近“瞬间完成”，并在任何异常情况下不“卡住”或“显示原文”。
- 架构分层：
  - 前端交互层：悬浮按钮（`floatBtn.tsx`）负责触发翻译/恢复、提示、语言切换与模式状态。
  - 页面执行层：内容脚本（`pageTranslator.ts`）负责节点扫描、并发调度、分批翻译、结果写回与恢复原文。
  - 后台服务层：后台脚本（`background.ts`）负责统一的后端翻译调度与来源埋点（GTX→LLM）。

---

## 用户体验流程

1. 点击悬浮按钮翻译
   - 显示 loading 提示“正在翻译可视区域…”。
   - 发送 `{ type: "TRANSLATE_PAGE", translateLang }` 到内容脚本；同时设 600ms 兜底，避免消息延迟时卡住。
2. 内容脚本启动翻译
   - 同步 `sendResponse({ ok: true })` 防止通道关闭报错。
   - 异步开始：扫描文本→按父块分组→全量调度每块翻译。
3. 分块翻译返回即写回
   - 每个分块返回后立刻写回对应节点（即时渲染）。
   - 首次写回时广播事件，按钮据此关闭 loading 提示。
4. 点击“显示原文”
   - 按钮立刻切回“翻译模式”提示；双通道触发恢复（运行时消息与页面事件），收到确认事件立即关闭 loading。
   - 恢复过程异步进行：恢复每个节点原文，并清理所有“已翻译标记”和“下方翻译容器”。
5. 再次翻译
   - 启动前再次清理旧标记与容器，保证块不被误判为“已处理”，完整覆盖所有块。

---

## 文件职责与关键实现

### 1) 悬浮按钮：`src/contents/floatBtn.tsx`

- 状态管理：
  - `translateLang`：当前翻译目标（`zh-CN`/`en-US`）。
  - `languageLang`：语言按钮提示显示的“下一次切换目标”（例如当前中文→提示显示 `en-US`）。
  - `isTranslated`：当前是否已翻译（影响按钮功能与提示文案）。
  - `isTranslating`：是否显示 loading 提示。

- 触发翻译/恢复：
  - 点击翻译：
    - 发送 `{ type: "TRANSLATE_PAGE", translateLang }`，并设 600ms 安全兜底，直接前端启动翻译。
    - 收到内容脚本事件 `CLIP_TRANSLATE_FIRST`/`clip:translate-first` 后关闭提示。
  - 点击显示原文：
    - 立即 `setIsTranslated(false)` 切回“翻译模式”提示。
    - 双通道触发恢复——运行时消息 `TRANSLATE_RESTORE` + 页面事件 `clip:translate-restore`。
    - 收到确认事件 `CLIP_TRANSLATE_RESTORE_ACK`/`clip:translate-restore-ack` 立即关闭提示。

- 提示文案：
  - 语言按钮提示显示“下一语言”：`languageLang`（当前中文→显示 `en-US`）。
  - 翻译按钮提示：未翻译显示“翻译为：xxx”，已翻译显示“显示原文”。

### 2) 内容脚本：`src/contents/pageTranslator.ts`

- 指令监听：
  - 翻译：`TRANSLATE_PAGE` → 同步 `sendResponse({ ok: true })`，异步调用 `translateCurrentPage(...)`。
  - 恢复：`TRANSLATE_RESTORE` 与页面事件 `clip:translate-restore` 双通道触发，立即确认，异步恢复原文。

- 并发调度与分块：
  - 调度器并发：`runTask(128)`（可在 `src/contents/pageTranslator.ts` 中调整）。
  - 分块大小：`CHUNK = 24`，可调 16/32/48 视网络与后端表现。

- 节点扫描与分组：
  - 递归扫描所有文本节点，过滤不可见与代码块等。
  - 按“父块（block-level）元素”分组，常见块如 `DIV/P/LI/Hx/...`。

- 翻译主流程：
  - 过滤有效文本：目标中文→需要发现英文字符；目标英文→需要发现中文字符。
  - 拼接分隔符 `|||CLIP_SEP|||`，分批并发翻译。
  - 容错拆分：归一化全角竖线，分隔符两侧空格/换行容错；数量不匹配或全部原文时逐条兜底。
  - 即时写回：分块返回后，直接写回对应节点；首段写回时广播事件。

- 恢复原文与清理：
  - 记录原文：在首次写回时把原文本保存到 `__clipOriginal`。
  - 恢复后清理所有 `data-clip-translated` 标记与 `data-clip-translated-below` 容器。
  - 开始翻译前再次清理，确保“再次翻译”不遗漏。

- 并发竞速（速度优先）请求：
  - `requestTranslation(text, lang)` 同时发起两条路径并抢最快结果：
    - 直连 GTX：`https://translate.googleapis.com/...`（快）
    - 后台 `translate-text`（GTX→LLM）：提供来源埋点与兼容性
  - 10 秒安全兜底，防止极端网络导致未返回时卡住。

- 事件与统计：
  - 首段写回事件：`CLIP_TRANSLATE_FIRST` 与 `clip:translate-first` → 关闭按钮提示。
  - 恢复确认与完成事件：`CLIP_TRANSLATE_RESTORE_ACK` / `CLIP_TRANSLATE_RESTORED` 与页面事件对应。

### 3) 后台脚本：`src/background.ts`

- 消息入口：`translate-text`
  - 接收 `{ text, targetLang, sourceLang, apiKey }` 并在后台进行翻译调度。

- 速度优先顺序
  - GTX（Google Translate）优先返回，可快速完成。
  - LLM（iFlow/qwen3-max）作为质量兜底。
  - 返回 `{ success, data, source: "gtx|llm|original" }`。

- 并发限制
  - GTX: 128 并发 (`gtxLimiter`)
  - LLM: 5 并发 (`llmLimiter`)，防止 API 限流。

- 一些实现要点：
  - iFlow 模型参数与系统提示要求保留分隔符、只输出纯文本。
  - GTX 拼接参数与结果解析。

---

## 关键策略与解决方案（问题回顾）

- 通道关闭错误（异步响应未返回）
  - 所有监听：同步返回 `ok` 或 `sendResponse`，并把可能的异步过程改为“异步启动 + 同步确认”。

- 提示体验不一致（发送指令后提示立即消失）
  - 由内容脚本“首段写回事件”来关闭提示，避免假完成；恢复原文采用“确认事件”即时关闭。

- 仍显示原文（模型未保留分隔符或原文返回）
  - 全角竖线归一化，多种拆分容错；数量不匹配或全部原文时逐条兜底翻译。

- 显示原文后再次翻译未覆盖完整
  - 恢复阶段与开始阶段都做全局清理，移除所有已翻译标记与下方容器，保证再次翻译不遗漏。

- 速度慢（22 秒 → 2-5 秒）
  - 并发与分块调优：`runTask(128)` + `CHUNK=24`，并对每分块返回即时写回。
  - 并发竞速：直连 GTX 与后台同时发起，谁快用谁，整体用时明显下降。

---

## 参数调优建议

- 并发（`runTask(N)`）
  - 建议区间：128–256，过高会加剧网络争用或后端速率限制。
- 分块大小（`CHUNK`）
  - 建议区间：16–32；过大可能拉长单次返回时间，过小会频繁请求。
- 目标语言与源语言选择
  - 目标中文时源语言设为 `en`；目标英文时源语言设为 `zh-CN`（`requestTranslation` 会自动选择）。

---

## 常见排查

- 提示不关闭：检查是否收到首段事件/恢复确认事件；安全兜底会在 500–600ms 内关闭。
- 仍显示原文：检查内容脚本是否走了兜底逐条翻译路径；后台是否返回原文；网络是否被屏蔽。
- 部分未翻译：确认是否清理了标记与旧容器；开始阶段已做清理，但自定义 DOM 动态追加的节点需要再次翻译触发。

---

## 附录：事件与消息

- 运行时消息（`chrome.runtime.sendMessage`）
  - `TRANSLATE_PAGE`：触发翻译，传 `translateLang`。
  - `TRANSLATE_RESTORE`：触发恢复原文。
  - `CLIP_TRANSLATE_FIRST`：首段写回完成。
  - `CLIP_TRANSLATE_RESTORE_ACK`：恢复确认（按钮立刻关闭提示）。
  - `CLIP_TRANSLATE_RESTORED`：恢复完成。

- 页面事件（`window.postMessage`）
  - `clip:translate-first`：首段写回完成。
  - `clip:translate-restore`：触发恢复原文。
  - `clip:translate-restore-ack`：恢复确认（按钮立刻关闭提示）。
  - `clip:translate-restored`：恢复完成。

---

## 结语

这套实现以“速度优先”为原则，结合并发竞速、分块即时写回与双通道恢复，能在大多数页面达到点击后快速完成的体验。你可以根据项目场景通过“并发/分块”微调来取得更佳的平衡。
