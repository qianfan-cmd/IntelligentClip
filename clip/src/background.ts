import { createLlm } from "@/utils/llm" // 引入 LLM 创建工具函数
console.log("🚀 Clip Extension background service worker loading...") // 打印背景服务加载日志

// 初始化复习调度器
import { initReviewScheduler } from "./background/review-scheduler"

initReviewScheduler() // 启动复习调度器
console.log("📅 Review scheduler initialized") // 打印调度器初始化完成日志

/**
 * 监听扩展图标点击事件
 * 点击后打开历史记录页面
 */
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") }) // 创建新标签页打开历史记录
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Failed to create tab:", message) // 捕获并打印错误
    })
})

/**
 * 监听来自 Content Script 或 Popup 的消息
 * 处理翻译请求、历史记录打开、屏幕截图等操作
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 处理打开历史记录页面的请求
  if (request.action === "openHistory") {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
      .then(() => sendResponse({ success: true })) // 成功响应
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        sendResponse({ success: false, error: message }) // 失败响应
      })
    return true // 保持消息通道开启以进行异步响应
  }

  // 处理通用文本翻译请求 (智能策略：GTX/LLM 自动切换)
  if (request.action === "translate-text") {
    const handleTranslation = async () => {
      try {
        if (!request.text) { sendResponse({ success: false, error: "No text provided" }); return } // 校验文本是否存在
        // 调用核心翻译函数，传入文本、目标语言、源语言和API Key
        const translated = await fetchTranslation(request.text, request.targetLang, request.sourceLang, request.apiKey)
        
        // 处理速率限制错误
        if (translated.error === 'RATE_LIMIT') {
          sendResponse({ success: false, error: "RATE_LIMIT" })
          return
        }
        // 返回翻译结果
        sendResponse({ success: true, data: translated.text, source: translated.source, errorDetails: translated.error })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        sendResponse({ success: false, error: message }) // 捕获并返回错误
      }
    }
    handleTranslation().catch(()=>{}) // 执行异步翻译任务
    return true // 保持消息通道开启
  }

  // 处理强制使用 LLM 的翻译请求
  if (request.action === "translate-text-llm") {
    const run = async () => {
      try {
        if (!request.text) { sendResponse({ success: false, error: "No text provided" }); return } // 校验文本
        // 使用限流器调用 iFlow (LLM) 翻译
        const out = await llmLimiter(() => translateWithIFLow(request.text, request.targetLang, request.apiKey))
        sendResponse({ success: true, data: out, source: "llm" }) // 返回结果
      } catch (err: unknown) {
        // 详细的错误处理逻辑
        const e: any = err
        const status = e?.status || e?.response?.status
        if (status === 429 || status === 449) { sendResponse({ success: false, error: "RATE_LIMIT" }); return } // 限流
        if (status === 400) { sendResponse({ success: false, error: "BAD_REQUEST" }); return } // 请求错误
        if (status === 401) { sendResponse({ success: false, error: "UNAUTHORIZED" }); return } // 未授权
        if (status === 404) { sendResponse({ success: false, error: "NOT_FOUND" }); return } // 未找到
        if (status === 503 || status === 504) { sendResponse({ success: false, error: "RETRYABLE" }); return } // 服务不可用，可重试
        const message = err instanceof Error ? err.message : String(err)
        sendResponse({ success: false, error: message }) // 其他错误
      }
    }
    run().catch(()=>{})
    return true
  }

  // 块级 HTML 翻译（保留标签与结构）
  if (request.action === "translate-html") {
    const run = async () => {
      try {
        const raw = await chrome.storage.local.get("clipper_api_config")
        const apiKey = raw?.clipper_api_config?.apiKey?.trim()
        if (!apiKey) { sendResponse({ success: false, error: "NO_KEY" }); return }

        const llm = createLlm(apiKey, "qwen3-max")
        const html = String(request.html || "")
        const targetLang = String(request.targetLang || "zh-CN")

        const completion = await llmLimiter(() => llm.chat.completions.create({
          model: "qwen3-max",
          messages: [
            { role: "system", content: `You are a strict HTML-preserving translator. Translate visible text in the HTML to ${targetLang}. Keep all tags, attributes, classes, data-*, code blocks, inline code, URLs and formatting unchanged. Return ONLY the translated HTML.` },
            { role: "user", content: html }
          ],
          temperature: 0,
          max_tokens: 4000
        }))

        const out = completion?.choices?.[0]?.message?.content || html
        sendResponse({ success: true, data: out })
      } catch (err: any) {
        const msg = err?.message || String(err)
        sendResponse({ success: false, error: msg })
      }
    }
    run().catch(()=>{})
    return true
  }

  // translate-html removed (Youdao disabled) - 旧的 HTML 翻译逻辑已移除

  // 处理 LLM 连通性诊断请求
  if (request.action === "diagnose-llm") {
    const run = async () => {
      try {
        // 从本地存储获取 API 配置
        const raw = await chrome.storage.local.get("clipper_api_config")
        const apiKey = raw?.clipper_api_config?.apiKey?.trim()
        const hasKey = !!apiKey
        let status: number | null = null
        let body: string | null = null
        let errorMsg: string | null = null
        
        if (!hasKey) {
          body = "No API key" // 没有 Key
        } else {
          try {
            // 创建 LLM 实例并发送简单的 ping 请求
            const llm = createLlm(apiKey, "qwen3-max")
            const completion = await llm.chat.completions.create({
              model: "qwen3-max",
              messages: [
                { role: "system", content: "You are a translator." },
                { role: "user", content: "ping" }
              ],
              temperature: 0,
              max_tokens: 5
            })
            status = 200
            body = completion.choices?.[0]?.message?.content || "OK" // 获取响应
          } catch (e: any) {
            // 捕获诊断过程中的错误
            status = e?.status || e?.response?.status || 500
            errorMsg = e?.message || String(e)
            body = errorMsg
          }
        }
        try { sendResponse({ hasKey, status, body, error: errorMsg }) } catch {} // 返回诊断结果
      } catch (err: any) {
        const msg = err?.message || String(err)
        try { sendResponse({ hasKey: false, status: null, body: msg }) } catch {}
      }
    }
    run().catch(()=>{})
    return true
  }

  // 简单的 Ping 接口，用于检测后台是否存活
  if (request.action === "ping") { try { sendResponse({ ok: true }) } catch {}; return true }
  
  // 处理整页翻译请求（由 Popup、快捷键或其他脚本发起）
  // 兼容两种字段：
  // - request.type === "TRANSLATE_PAGE"：旧版/内容脚本惯用的消息类型字段
  // - request.action === "translate-page"：新版/后台统一的动作字段
  // 命中任一条件即触发“把指令转发给当前激活的标签页”的流程。
  if (request.type === "TRANSLATE_PAGE" || request.action === "translate-page") {
    // 查询当前窗口中处于激活状态的标签页；
    // chrome.tabs.query 返回 Promise<[Tab, ...]>，这里通过解构只取第一项（当前激活页）。
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      // 构造并发送内容脚本可识别的指令：
      // - type 固定为 "TRANSLATE_PAGE"，让 content script 的监听器接收并执行整页翻译逻辑；
      // - translateLang 为目标语言，按优先级依次取 request.translateLang → request.targetLang → 默认 "zh-CN"。
      //   这样无论调用方传入的是 translateLang 还是 targetLang 都能兼容，最终落到中文。
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TRANSLATE_PAGE", translateLang: request.translateLang || request.targetLang || "zh-CN" })
      // 回复调用方一个“已受理”的结果。
      // sendResponse 必须在异步回调内调用；为避免 Service Worker 通道已关闭导致异常，这里使用 try/catch。
      try { sendResponse({ ok: true }) } catch {}
    })
    // 返回 true 告诉浏览器：这是一次异步响应，消息通道需要在 then 回调里调用 sendResponse 后再结束。
    // 若不返回 true，sendResponse 可能在 Promise 回调执行时通道已关闭而报错。
    return true
  }

  // 兼容旧消息类型：打开历史记录
  if (request.type === "clip:open-history") {
    const historyUrl = chrome.runtime.getURL("tabs/history.html")
    const targetUrl = historyUrl + (request.clipId ? `?id=${request.clipId}` : "") // 支持带参数打开
    chrome.tabs.query({}).then(tabs => {
      // 查找是否已经打开了历史记录页
      const existingTab = tabs.find(tab => tab.url && tab.url.startsWith(historyUrl))
      if (existingTab?.id) {
        // 如果已打开，激活该标签页
        chrome.tabs.update(existingTab.id, { url: targetUrl, active: true })
        if (existingTab.windowId) chrome.windows.update(existingTab.windowId, { focused: true })
      } else {
        // 否则创建新标签页
        chrome.tabs.create({ url: targetUrl })
      }
    })
    return false
  }
  // 打开选项页
  if (request.type === "clip:open-options") { chrome.runtime.openOptionsPage(); return false }
  
  // 屏幕截图功能
  if (request.type === "clip:capture-screen") {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) { sendResponse({ error: chrome.runtime.lastError.message }) }
      else { sendResponse({ dataUrl }) }
    });
    return true
  }
  
  // 启动截图流程
  if (request.type === "clip:start-screenshot") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "clip:start-screenshot" })
    })
    return false
  }

  return false // 默认返回 false
})

console.log("✅ Clip Extension background service worker loaded successfully") // 加载完成日志

// 翻译结果缓存，避免重复翻译相同文本
const translateCache = new Map<string, string>()

/**
 * LLM 并发限流器
 * 用于控制同时发起的 LLM 请求数量，避免触发 API 速率限制或浏览器资源耗尽
 */
const llmLimiter = (function createLimit(concurrency: number) {
  const queue: (() => Promise<void>)[] = [] // 任务队列
  let active = 0 // 当前活跃任务数
  // 执行下一个任务
  const next = () => { if (active < concurrency && queue.length) { active++; queue.shift()?.() } }
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    // 包装任务
    const run = async () => { try { resolve(await fn()) } catch(e) { reject(e) } finally { active--; next() } }
    queue.push(run) // 入队
    next() // 尝试执行
  })
})(5) // 将 LLM 并发数设置为 5，以在 GTX 不可用时提高速度

/**
 * GTX (Google Translate) 并发限流器
 * Google Translate 接口通常支持较高的并发
 */
const gtxLimiter = (function createLimit(concurrency: number) {
  const queue: (() => Promise<void>)[] = []
  let active = 0
  const next = () => { if (active < concurrency && queue.length) { active++; queue.shift()?.() } }
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    const run = async () => { try { resolve(await fn()) } catch(e) { reject(e) } finally { active--; next() } }
    queue.push(run)
    next()
  })
})(128) // 设置较高的并发数 128

// GTX 失败计数器，用于故障熔断
let gtxFailStreak = 0
// 标记 GTX 是否曾经成功过，用于判断网络环境
let gtxEverSuccess = false

/**
 * 计算 SHA-256 哈希值
 * 用于签名等场景
 */
async function sha256Hex(input: string) {
  const buf = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", buf)
  const bytes = new Uint8Array(digest)
  let out = ""
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0")
  return out
}

/**
 * 使用 Google Translate (GTX) 接口进行翻译
 * 这是一个免费的非官方接口，可能会有速率限制或不稳定的情况
 * @param text 待翻译文本
 * @param sourceLang 源语言
 * @param targetLang 目标语言
 */
async function translateWithGtx(text: string, sourceLang = "en", targetLang = "zh-CN") {
  // 构造请求 URL
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
  const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("GTX request error " + res.status)
    const data = await res.json();
    let out = ""; 
    // 解析返回的 JSON 结构提取译文
    if (Array.isArray(data) && Array.isArray(data[0])) { for (const seg of data[0]) { if (Array.isArray(seg) && typeof seg[0] === "string") out += seg[0] } }
    return (out || "").trim()
  } catch (e) {
    clearTimeout(timeoutId);
    throw e // 抛出错误供上层处理
  }
}

/**
 * 使用 iFlow (LLM) 进行翻译
 * 通过 OpenAI 兼容接口调用大模型进行翻译
 * @param text 待翻译文本
 * @param targetLang 目标语言
 * @param apiKey API Key
 */
async function translateWithIFLow(text: string, targetLang = "zh-CN", apiKey?: string) {
  // 获取 API Key
  const keyFromStorage = (await chrome.storage.local.get("clipper_api_config"))?.clipper_api_config?.apiKey
  const key = (typeof apiKey === "string" && apiKey.trim() ? apiKey : keyFromStorage)?.trim()
  if (!key) throw new Error("No iFlow API key found")
  
  const llm = createLlm(key, "qwen3-max") // 创建 LLM 客户端
  const hasSep = text.includes("|||CLIP_SEP|||") // 检查是否包含分隔符（用于批量翻译）
  
  // 根据是否批量翻译构建不同的系统提示词 (System Prompt)
  const systemPrompt = hasSep
    ? `你是一个翻译助手。将输入按分隔符|||CLIP_SEP|||切分为多段，并将每一段准确翻译成${targetLang}。必须保持顺序与段数完全一致，翻译完输出之前一定要检查一遍是否全部文本均为对应语言，如果不是重新翻译后才能输出给我。严格以JSON数组输出译文（仅数组，元素为字符串），不要输出其他任何文本。`
    : `你是一个翻译助手。将文本准确翻译成${targetLang}。必须翻译完整文本，翻译完输出之前一定要检查一遍是否全部文本均为对应语言，如果不是重新翻译后才能输出给我，只输出译文。`
  
  // 发送请求
  const completion = await llm.chat.completions.create({
    model: "qwen3-max",
    temperature: 0, // 温度设为 0 保证结果稳定性
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text }
    ],
    max_tokens: 8000,
    response_format: hasSep ? { type: "json_object" } as any : undefined // 如果是 JSON 模式则强制 JSON 输出
  } as any)
  
  const raw = completion.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error("IFLow empty translation")
  
  // 如果是批量翻译，验证 JSON 格式
  if (hasSep) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.every(x => typeof x === "string")) return JSON.stringify(arr)
    } catch {}
  }
  return raw
}

/**
 * 映射语言代码到火山引擎支持的格式
 */
function mapToVolcLang(lang: string) { const s = (lang || "").toLowerCase(); if (s.startsWith("zh")) return "zh"; if (s.startsWith("en")) return "en"; return "auto" }

/**
 * HMAC-SHA256 签名辅助函数
 */
async function hmacSha256Hex(key: Uint8Array | string, msg: string) {
  const rawKey = typeof key === "string" ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg))
  const bytes = new Uint8Array(sig)
  let out = ""; for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0")
  return out
}

/**
 * 火山引擎 API 签名函数 (AWS Signature V4 风格)
 */
async function volcSign(ak: string, sk: string, method: string, url: URL, body: string, now: Date) {
  const xDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  const dateStamp = xDate.slice(0, 8)
  const region = "cn-north-1"
  const service = "translate"
  const canonicalUri = url.pathname || "/"
  const qs = url.searchParams
  const queryKeys = Array.from(qs.keys()).sort()
  const canonicalQuery = queryKeys.map(k => encodeURIComponent(k) + "=" + encodeURIComponent(qs.get(k) || "")).join("&")
  const canonicalHeaders = "content-type:application/json\n" + `host:${url.host}\n` + `x-date:${xDate}\n`
  const signedHeaders = "content-type;host;x-date"
  const payloadHash = await sha256Hex(body)
  const canonicalRequest = [method.toUpperCase(), canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n")
  const algorithm = "HMAC-SHA256"
  const credentialScope = `${dateStamp}/${region}/${service}/request`
  const stringToSign = [algorithm, xDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n")
  const kDate = await hmacSha256Hex(new TextEncoder().encode("VOLC" + sk), dateStamp)
  const kRegion = await hmacSha256Hex(hexToBytes(kDate), region)
  const kService = await hmacSha256Hex(hexToBytes(kRegion), service)
  const kSigning = await hmacSha256Hex(hexToBytes(kService), "request")
  const signature = await hmacSha256Hex(hexToBytes(kSigning), stringToSign)
  const authorization = `${algorithm} Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return { xDate, authorization }
}

/**
 * 16进制字符串转字节数组
 */
function hexToBytes(hex: string) { const out = new Uint8Array(hex.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16); return out }

/**
 * 使用火山引擎进行翻译 (备用接口)
 */
async function translateWithVolc(text: string, targetLang = "zh-CN", sourceLang = "auto") {
  const cfg = await chrome.storage.local.get("volc_credentials")
  const ak = cfg?.volc_credentials?.ak || ""
  const sk = cfg?.volc_credentials?.sk || ""
  if (!ak || !sk) throw new Error("No Volc credentials")
  const endpoint = new URL("https://translate.volcengineapi.com/")
  endpoint.searchParams.set("Action", "TranslateText")
  endpoint.searchParams.set("Version", "2020-06-01")
  const bodyObj: any = { TargetLanguage: mapToVolcLang(targetLang), TextList: [text] }
  const srcLangCode = mapToVolcLang(sourceLang)
  if (srcLangCode !== "auto") bodyObj.SourceLanguage = srcLangCode
  const payload = JSON.stringify(bodyObj)
  const now = new Date()
  const { xDate, authorization } = await volcSign(ak, sk, "POST", endpoint, payload, now)
  const res = await fetch(endpoint.toString(), { method: "POST", headers: { "Content-Type": "application/json", "X-Date": xDate, "Authorization": authorization }, body: payload })
  if (!res.ok) throw new Error("Volc request error " + res.status)
  const data = await res.json()
  const list = Array.isArray(data?.TranslationList) ? data.TranslationList : []
  const out = list[0]?.Translation || ""
  return out?.trim() || text
}

/**
 * 核心翻译调度函数
 * 根据配置的策略和当前网络状况，智能选择 GTX 或 LLM 进行翻译
 * @param text 待翻译文本
 * @param targetLang 目标语言
 * @param sourceLang 源语言
 * @param apiKey 可选的 API Key
 */
async function fetchTranslation(text: string, targetLang = "zh-CN", sourceLang = "en", apiKey?: string) {
  const src = (text || "").trim(); if (!src) return { text: "", source: "empty" }
  const key = `${targetLang}|${src}`
  // 检查缓存
  const cached = translateCache.get(key)
  if (cached && cached !== src) return { text: cached, source: 'cache' }

  // 尝试 GTX 翻译的封装函数
  const tryGtx = async () => {
    if (gtxFailStreak >= 5) return null // 如果连续失败超过5次，跳过 GTX (熔断)
    try {
      const r = await gtxLimiter(() => translateWithGtx(src, sourceLang || 'en', targetLang))
      if (r && r !== src) { gtxFailStreak = 0; gtxEverSuccess = true; return r } // 成功则重置失败计数
      gtxFailStreak++; return null
    } catch { gtxFailStreak++; return null }
  }

  // 尝试 LLM 翻译的封装函数
  const tryLlm = async () => {
    try { const r = await llmLimiter(() => translateWithIFLow(src, targetLang, apiKey)); return (r && r !== src) ? r : null } catch (e: any) { return e?.status === 429 || e?.status === 449 ? '__RATE_LIMIT__' : null }
  }

  // 获取用户配置的翻译策略
  const strategyRaw = (await chrome.storage.local.get('translate_strategy'))?.translate_strategy
  // 如果 GTX 稳定，优先使用 GTX
  const preferGtxOnly = gtxEverSuccess && gtxFailStreak < 5
  // 动态偏好：如果 GTX 失败次数少，优先尝试 GTX，否则优先 LLM
  const dynamicPref = gtxFailStreak < 5 ? 'gtx_first' : 'llm_first'
  // 最终策略决定
  const strategy = preferGtxOnly ? 'gtx_only' : (typeof strategyRaw === 'string' && strategyRaw !== 'gtx_only' && strategyRaw !== 'llm_only' ? dynamicPref : (typeof strategyRaw === 'string' ? strategyRaw : dynamicPref))

  let out: string | null = null; let source = 'original'; let error: string | undefined

  // 根据策略执行翻译
  if (strategy === 'gtx_only') {
    const gVal = await tryGtx()
    if (gVal) { out = gVal; source = 'gtx' }
    else { out = null; source = 'original' }
  } else if (strategy === 'race') {
    // 竞速模式：同时请求，谁快用谁
    const [g, l] = await Promise.allSettled([tryGtx(), tryLlm()])
    const pick = (v: PromiseSettledResult<string | null>) => (v.status === 'fulfilled' ? v.value : null)
    const gVal = pick(g)
    const lVal = pick(l)
    
    if (gVal) { out = gVal; source = 'gtx' } // 优先 GTX 结果 (通常更快且免费)
    else if (lVal === '__RATE_LIMIT__') { error = 'RATE_LIMIT' }
    else if (lVal) { out = lVal; source = 'llm' }
  } else if (strategy === 'gtx_first') {
    // 优先 GTX，失败则放弃 (此处逻辑似乎未回退到 LLM，可能是为了节省 Token 或用户设置)
    // 修正：如果 gtx_first 失败，应该通常回退到 LLM，但这里代码似乎意图是 "Try GTX primarily"
    // 下面的 dynamicPref 逻辑更完整
    const gVal = await tryGtx()
    if (gVal) { out = gVal; source = 'gtx' }
    else { out = null; source = 'original' }
  } else if (strategy === 'gtx_only') {
    const gVal = await tryGtx()
    if (gVal) { out = gVal; source = 'gtx' }
  } else { // llm_first (默认或 fallback)
    if (gtxFailStreak >= 5) {
      // GTX 挂了，直接用 LLM
      const lVal = await tryLlm()
      if (lVal === '__RATE_LIMIT__') { error = 'RATE_LIMIT' }
      else if (lVal) { out = lVal; source = 'llm' }
    } else {
      // 否则并行尝试，但逻辑上可能更倾向于等待 LLM? 
      // 实际上 Promise.allSettled 是并行的
      const [lRes, gRes] = await Promise.allSettled([tryLlm(), tryGtx()])
      const lVal = lRes.status === 'fulfilled' ? lRes.value : null
      const gVal = gRes.status === 'fulfilled' ? gRes.value : null
      // 这里虽然叫 llm_first，但如果 GTX 成功了还是会用 GTX (免费)，除非 GTX 失败
      // 或者这里逻辑是：只要 GTX 有值就用 GTX？
      if (gVal) { out = gVal; source = 'gtx' }
      else if (lVal === '__RATE_LIMIT__') { error = 'RATE_LIMIT' }
      else if (lVal) { out = lVal; source = 'llm' }
    }
  }

  // 写入缓存并返回
  if (out && out !== src) { translateCache.set(key, out); return { text: out, source } }
  return { text: src, source: 'original', error }
}

// 暴露全局测试函数，用于在 Service Worker 控制台调试
(globalThis as any).__clipTestTranslate = (text: string, targetLang = "zh-CN") => fetchTranslation(text, targetLang, "auto")
