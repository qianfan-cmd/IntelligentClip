console.log("🚀 Clip Extension background service worker loading...") // 后台 Service Worker 启动日志

// 点击扩展图标打开历史页面
chrome.action.onClicked.addListener(() => { // 点击扩展图标时打开历史页
  console.log("🎯 Extension icon clicked, opening history page...")
  chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") }) // 创建标签页
    .then(() => console.log("✅ History tab created")) // 成功日志
    .catch((err: unknown) => { // 失败日志
      const message = err instanceof Error ? err.message : String(err)
      console.error("❌ Failed to create tab:", message)
    })
})

// 消息监听
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => { // 后台统一消息入口

  // 打开历史页面
  if (request.action === "openHistory") { // 打开历史页（异步返回）
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
      .then(() => sendResponse({ success: true }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        sendResponse({ success: false, error: message })
      })
    return true
  }

  // 翻译文本（异步返回结果）
  if (request.action === "translate-text") { // 文本翻译入口（异步 sendResponse）
    (async () => {
      try {
        if (!request.text) { // 入参校验：缺少文本
          sendResponse({ success: false, error: "No text provided" })
          return
        }

        const translated = await fetchTranslation( // 调用后台翻译调度（速度优先 GTX→LLM）
          request.text,
          request.targetLang,
          request.sourceLang,
          request.apiKey
        )

        sendResponse({ success: true, data: translated.text, source: translated.source }) // 返回译文与来源标记
      } catch (err: unknown) {
        console.error("❌ Translation failed:", err)
        const message = err instanceof Error ? err.message : String(err)
        sendResponse({ success: false, error: message })
      }
    })()

    return true // 告诉浏览器这是异步响应
  }

  // 页面翻译触发指令（不需要返回异步结果）
  if (request.type === "TRANSLATE_PAGE") { // 页面翻译触发指令（只需同步确认）
    console.log("🔵 Received TRANSLATE_PAGE command", request.translateLang)
    sendResponse({ ok: true }) // 同步响应，避免消息通道关闭报错
    return false
  }

  return false
})

// 键盘快捷键
if (chrome.commands) {
  chrome.commands.onCommand.addListener((command) => {
    console.log("⌨️ Keyboard command:", command)
    if (command === "open-history") {
      chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
    }
  })
} else {
  console.log("⚠️ chrome.commands API not available")
}

console.log("✅ Clip Extension background service worker loaded successfully") // 启动完成日志

// ---------------------------
// 页面翻译功能
// ---------------------------
async function translateWithIFLow(text: string, targetLang = "zh-CN", apiKey?: string) { // 调用 iFlow LLM（qwen3-max）
  const keyFromStorage = (await chrome.storage.local.get("clipper_api_config"))?.clipper_api_config?.apiKey // 从存储读取 APIKey
  const key = (typeof apiKey === "string" && apiKey.trim() ? apiKey : keyFromStorage)?.trim() // 优先使用入参
  if (!key) throw new Error("No iFlow API key found") // 未配置 Key 则报错

  const systemPrompt = `你是一个专业的翻译助手。任务：将用户提供的文本准确翻译成 ${targetLang}。要求：严格保持原句顺序；尽可能保持原格式（换行、标点、符号）；不要添加任何解释或扩展内容；不要润色，保持原意；文本中出现分隔符 |||CLIP_SEP||| 时必须原样保留；只输出翻译后的纯文本。` // 系统提示：要求保留分隔符与纯文本输出

  console.log("[IFLow] request", { len: text.length, targetLang }) // 诊断日志：请求长度与目标语言
  const res = await fetch("https://apis.iflow.cn/v1/chat/completions", { // 直连 iFlow chat/completions
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "qwen3-max",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      max_tokens: 8192,
    })
  })

  if (!res.ok) throw new Error("IFLow request error " + res.status) // HTTP 非 200 时抛错
  const data = await res.json() as { choices?: { message?: { content?: string } }[] } // 解析 JSON
  const output = data?.choices?.[0]?.message?.content?.trim() // 取第一条消息内容
  console.log("[IFLow] response", { ok: !!output, outLen: output?.length })
  if (!output) throw new Error("IFLow returned empty translation") // 结果为空则报错
  return output
}

async function translateWithGtx(text: string, sourceLang = "en", targetLang = "zh-CN") { // 调用谷歌 GTX（速度快）
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("GTX request error " + res.status)
  const data = await res.json() // 解析响应
  let out = "" // 拼接所有片段
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (const seg of data[0]) {
      if (Array.isArray(seg) && typeof seg[0] === "string") out += seg[0]
    }
  }
  return (out || "").trim() // 返回拼接的译文
}

async function fetchTranslation(text: string, targetLang = "zh-CN", sourceLang = "en", apiKey?: string) { // 速度优先：先 GTX 后 LLM
  const src = (text || "").trim()
  if (!src) return ""
  try {
    const gtx = await translateWithGtx(src, sourceLang, targetLang) // 尝试 GTX
    if (gtx && gtx !== src) {
      console.log("[Translate] GTX ok")
      return { text: gtx, source: "gtx" }
    }
    console.log("[Translate] GTX returned original, giving src")
  } catch {}
  try {
    const llm = await translateWithIFLow(src, targetLang, apiKey) // 尝试 LLM
    if (llm && llm !== src) {
      console.log("[Translate] LLM ok")
      return { text: llm, source: "llm" }
    }
    console.log("[Translate] LLM returned original, giving src")
  } catch {}
  return { text: src, source: "original" }
}
