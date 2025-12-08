import { createLlm } from "@/utils/llm"
console.log("🚀 Clip Extension background service worker loading...")
// 初始化复习调度器
import { initReviewScheduler } from "./background/review-scheduler"

initReviewScheduler()
console.log("📅 Review scheduler initialized")
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Failed to create tab:", message)
    })
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openHistory") {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
      .then(() => sendResponse({ success: true }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        sendResponse({ success: false, error: message })
      })
    return true
  }

  if (request.action === "translate-text") {
    const handleTranslation = async () => {
      try {
        if (!request.text) { sendResponse({ success: false, error: "No text provided" }); return }
        const translated = await fetchTranslation(request.text, request.targetLang, request.sourceLang, request.apiKey)
        if (translated.error === 'RATE_LIMIT') {
          sendResponse({ success: false, error: "RATE_LIMIT" })
          return
        }
        sendResponse({ success: true, data: translated.text, source: translated.source, errorDetails: translated.error })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        sendResponse({ success: false, error: message })
      }
    }
    handleTranslation().catch(()=>{})
    return true
  }

  if (request.action === "translate-text-llm") {
    const run = async () => {
      try {
        if (!request.text) { sendResponse({ success: false, error: "No text provided" }); return }
        const out = await llmLimiter(() => translateWithIFLow(request.text, request.targetLang, request.apiKey))
        sendResponse({ success: true, data: out, source: "llm" })
      } catch (err: unknown) {
        const e: any = err
        const status = e?.status || e?.response?.status
        if (status === 429 || status === 449) { sendResponse({ success: false, error: "RATE_LIMIT" }); return }
        if (status === 400) { sendResponse({ success: false, error: "BAD_REQUEST" }); return }
        if (status === 401) { sendResponse({ success: false, error: "UNAUTHORIZED" }); return }
        if (status === 404) { sendResponse({ success: false, error: "NOT_FOUND" }); return }
        if (status === 503 || status === 504) { sendResponse({ success: false, error: "RETRYABLE" }); return }
        const message = err instanceof Error ? err.message : String(err)
        sendResponse({ success: false, error: message })
      }
    }
    run().catch(()=>{})
    return true
  }

  // translate-html removed (Youdao disabled)

  if (request.action === "diagnose-llm") {
    const run = async () => {
      try {
        const raw = await chrome.storage.local.get("clipper_api_config")
        const apiKey = raw?.clipper_api_config?.apiKey?.trim()
        const hasKey = !!apiKey
        let status: number | null = null
        let body: string | null = null
        let errorMsg: string | null = null
        if (!hasKey) {
          body = "No API key"
        } else {
          try {
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
            body = completion.choices?.[0]?.message?.content || "OK"
          } catch (e: any) {
            status = e?.status || e?.response?.status || 500
            errorMsg = e?.message || String(e)
            body = errorMsg
          }
        }
        try { sendResponse({ hasKey, status, body, error: errorMsg }) } catch {}
      } catch (err: any) {
        const msg = err?.message || String(err)
        try { sendResponse({ hasKey: false, status: null, body: msg }) } catch {}
      }
    }
    run().catch(()=>{})
    return true
  }

  if (request.action === "ping") { try { sendResponse({ ok: true }) } catch {}; return true }
  
  if (request.type === "TRANSLATE_PAGE" || request.action === "translate-page") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TRANSLATE_PAGE", translateLang: request.translateLang || request.targetLang || "zh-CN" })
      try { sendResponse({ ok: true }) } catch {}
    })
    return true
  }

  // 兼容旧消息类型
  if (request.type === "clip:open-history") {
    const historyUrl = chrome.runtime.getURL("tabs/history.html")
    const targetUrl = historyUrl + (request.clipId ? `?id=${request.clipId}` : "")
    chrome.tabs.query({}).then(tabs => {
      const existingTab = tabs.find(tab => tab.url && tab.url.startsWith(historyUrl))
      if (existingTab?.id) {
        chrome.tabs.update(existingTab.id, { url: targetUrl, active: true })
        if (existingTab.windowId) chrome.windows.update(existingTab.windowId, { focused: true })
      } else {
        chrome.tabs.create({ url: targetUrl })
      }
    })
    return false
  }
  if (request.type === "clip:open-options") { chrome.runtime.openOptionsPage(); return false }
  if (request.type === "clip:capture-screen") {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) { sendResponse({ error: chrome.runtime.lastError.message }) }
      else { sendResponse({ dataUrl }) }
    });
    return true
  }
  if (request.type === "clip:start-screenshot") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "clip:start-screenshot" })
    })
    return false
  }

  return false
})

console.log("✅ Clip Extension background service worker loaded successfully")

const translateCache = new Map<string, string>()
const llmLimiter = (function createLimit(concurrency: number) {
  const queue: (() => Promise<void>)[] = []
  let active = 0
  const next = () => { if (active < concurrency && queue.length) { active++; queue.shift()?.() } }
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    const run = async () => { try { resolve(await fn()) } catch(e) { reject(e) } finally { active--; next() } }
    queue.push(run)
    next()
  })
})(5) // Raise LLM concurrency to improve speed when GTX unavailable

const gtxLimiter = (function createLimit(concurrency: number) {
  const queue: (() => Promise<void>)[] = []
  let active = 0
  const next = () => { if (active < concurrency && queue.length) { active++; queue.shift()?.() } }
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    const run = async () => { try { resolve(await fn()) } catch(e) { reject(e) } finally { active--; next() } }
    queue.push(run)
    next()
  })
})(128)

let gtxFailStreak = 0
let gtxEverSuccess = false

async function sha256Hex(input: string) {
  const buf = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", buf)
  const bytes = new Uint8Array(digest)
  let out = ""
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0")
  return out
}

async function translateWithGtx(text: string, sourceLang = "en", targetLang = "zh-CN") {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
  const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("GTX request error " + res.status)
    const data = await res.json();
    let out = ""; if (Array.isArray(data) && Array.isArray(data[0])) { for (const seg of data[0]) { if (Array.isArray(seg) && typeof seg[0] === "string") out += seg[0] } }
    return (out || "").trim()
  } catch (e) {
    clearTimeout(timeoutId);
    throw e
  }
}

async function translateWithIFLow(text: string, targetLang = "zh-CN", apiKey?: string) {
  const keyFromStorage = (await chrome.storage.local.get("clipper_api_config"))?.clipper_api_config?.apiKey
  const key = (typeof apiKey === "string" && apiKey.trim() ? apiKey : keyFromStorage)?.trim()
  if (!key) throw new Error("No iFlow API key found")
  const llm = createLlm(key, "qwen3-max")
  const hasSep = text.includes("|||CLIP_SEP|||")
  const systemPrompt = hasSep
    ? `你是一个翻译助手。将输入按分隔符|||CLIP_SEP|||切分为多段，并将每一段准确翻译成${targetLang}。必须保持顺序与段数完全一致，翻译完输出之前一定要检查一遍是否全部文本均为对应语言，如果不是重新翻译后才能输出给我。严格以JSON数组输出译文（仅数组，元素为字符串），不要输出其他任何文本。`
    : `你是一个翻译助手。将文本准确翻译成${targetLang}。必须翻译完整文本，翻译完输出之前一定要检查一遍是否全部文本均为对应语言，如果不是重新翻译后才能输出给我，只输出译文。`
  const completion = await llm.chat.completions.create({
    model: "qwen3-max",
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text }
    ],
    max_tokens: 8000,
    response_format: hasSep ? { type: "json_object" } as any : undefined
  } as any)
  const raw = completion.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error("IFLow empty translation")
  if (hasSep) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.every(x => typeof x === "string")) return JSON.stringify(arr)
    } catch {}
  }
  return raw
}

function mapToVolcLang(lang: string) { const s = (lang || "").toLowerCase(); if (s.startsWith("zh")) return "zh"; if (s.startsWith("en")) return "en"; return "auto" }

async function hmacSha256Hex(key: Uint8Array | string, msg: string) {
  const rawKey = typeof key === "string" ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg))
  const bytes = new Uint8Array(sig)
  let out = ""; for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0")
  return out
}

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

function hexToBytes(hex: string) { const out = new Uint8Array(hex.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16); return out }

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

async function fetchTranslation(text: string, targetLang = "zh-CN", sourceLang = "en", apiKey?: string) {
  const src = (text || "").trim(); if (!src) return { text: "", source: "empty" }
  const key = `${targetLang}|${src}`
  const cached = translateCache.get(key)
  if (cached && cached !== src) return { text: cached, source: 'cache' }

  const tryGtx = async () => {
    if (gtxFailStreak >= 5) return null
    try {
      const r = await gtxLimiter(() => translateWithGtx(src, sourceLang || 'en', targetLang))
      if (r && r !== src) { gtxFailStreak = 0; gtxEverSuccess = true; return r }
      gtxFailStreak++; return null
    } catch { gtxFailStreak++; return null }
  }
  const tryLlm = async () => {
    try { const r = await llmLimiter(() => translateWithIFLow(src, targetLang, apiKey)); return (r && r !== src) ? r : null } catch (e: any) { return e?.status === 429 || e?.status === 449 ? '__RATE_LIMIT__' : null }
  }

  const strategyRaw = (await chrome.storage.local.get('translate_strategy'))?.translate_strategy
  const preferGtxOnly = gtxEverSuccess && gtxFailStreak < 5
  const dynamicPref = gtxFailStreak < 5 ? 'gtx_first' : 'llm_first'
  const strategy = preferGtxOnly ? 'gtx_only' : (typeof strategyRaw === 'string' && strategyRaw !== 'gtx_only' && strategyRaw !== 'llm_only' ? dynamicPref : (typeof strategyRaw === 'string' ? strategyRaw : dynamicPref))

  let out: string | null = null; let source = 'original'; let error: string | undefined

  if (strategy === 'gtx_only') {
    const gVal = await tryGtx()
    if (gVal) { out = gVal; source = 'gtx' }
    else { out = null; source = 'original' }
  } else if (strategy === 'race') {
    const [g, l] = await Promise.allSettled([tryGtx(), tryLlm()])
    const pick = (v: PromiseSettledResult<string | null>) => (v.status === 'fulfilled' ? v.value : null)
    const gVal = pick(g)
    const lVal = pick(l)
    
    if (gVal) { out = gVal; source = 'gtx' }
    else if (lVal === '__RATE_LIMIT__') { error = 'RATE_LIMIT' }
    else if (lVal) { out = lVal; source = 'llm' }
  } else if (strategy === 'gtx_first') {
    const gVal = await tryGtx()
    if (gVal) { out = gVal; source = 'gtx' }
    else { out = null; source = 'original' }
  } else if (strategy === 'gtx_only') {
    const gVal = await tryGtx()
    if (gVal) { out = gVal; source = 'gtx' }
  } else { // llm_first
    if (gtxFailStreak >= 5) {
      const lVal = await tryLlm()
      if (lVal === '__RATE_LIMIT__') { error = 'RATE_LIMIT' }
      else if (lVal) { out = lVal; source = 'llm' }
    } else {
      const [lRes, gRes] = await Promise.allSettled([tryLlm(), tryGtx()])
      const lVal = lRes.status === 'fulfilled' ? lRes.value : null
      const gVal = gRes.status === 'fulfilled' ? gRes.value : null
      if (gVal) { out = gVal; source = 'gtx' }
      else if (lVal === '__RATE_LIMIT__') { error = 'RATE_LIMIT' }
      else if (lVal) { out = lVal; source = 'llm' }
    }
  }

  if (out && out !== src) { translateCache.set(key, out); return { text: out, source } }
  return { text: src, source: 'original', error }
}

(globalThis as any).__clipTestTranslate = (text: string, targetLang = "zh-CN") => fetchTranslation(text, targetLang, "auto")
