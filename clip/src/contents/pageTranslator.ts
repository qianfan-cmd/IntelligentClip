export const config = { matches: ["<all_urls>"] } // 匹配所有页面，作为内容脚本注入

try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*" ) } catch {}

// content script 接收翻译指令
// 接收浮动按钮翻译指令
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "TRANSLATE_PAGE") {//扩展的翻译请求
    console.log("🔵 收到翻译触发指令, 正在翻译页面...", msg.translateLang)


    // ⚠️ 同步回复，避免 channel closed 收到响应发送信息，发送true表示消息已收到 返回false表示同步响应，在监听函数返回true表示在异步操作完成后调用sendResponse
    sendResponse({ ok: true })

    // 异步翻译
    translateCurrentPage(msg.translateLang).catch(err => {
      console.error("页面翻译异常：", err)
    })

    return false
  }
  if (msg?.type === "TRANSLATE_RESTORE") {
    try {
      try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORE_ACK" }) } catch {}
      try { window.postMessage({ source: "clip", type: "clip:translate-restore-ack" }, "*") } catch {}
      sendResponse({ ok: true })
      setTimeout(() => {
        try {
          observer?.disconnect(); observer = null
          try { mutObserver?.disconnect() } catch {}
          mutObserver = null
          __clipOriginal.forEach((v, n) => { try { n.nodeValue = v } catch {} })
          __clipOriginal.clear()
          __clipPending.clear()
          try { __clipElementHtmlOriginal.forEach((v, el) => { try { el.innerHTML = v } catch {} }); __clipElementHtmlOriginal.clear() } catch {}
          try { __clipElementHtmlTranslated.clear() } catch {}
          try { __clipLexicon.clear() } catch {}
          try {
            document.querySelectorAll('[data-clip-translated]').forEach((el) => (el as HTMLElement).removeAttribute('data-clip-translated'))
          } catch {}
          try {
            document.querySelectorAll('[data-clip-translated-below]').forEach((el) => { try { el.parentElement?.removeChild(el) } catch {} })
          } catch {}
          isTranslatorActive = false
          __clipFirstReported = false
          try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
          try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*" ) } catch {}
          try { if (__clipRushTimer) { clearTimeout(__clipRushTimer); __clipRushTimer = null } } catch {}
          try { if (__clipRushScrollHandler) { window.removeEventListener('scroll', __clipRushScrollHandler as any); __clipRushScrollHandler = null } } catch {}
          try { if (__clipRushTimer) { clearTimeout(__clipRushTimer); __clipRushTimer = null } } catch {}
          try { if (__clipRushScrollHandler) { window.removeEventListener('scroll', __clipRushScrollHandler as any); __clipRushScrollHandler = null } } catch {}
        } catch {}
      }, 0)
    } catch {
      sendResponse({ ok: false })
    }
    return false
  }
  
  return false
})

// 页面事件：恢复原文
window.addEventListener("message", (e: MessageEvent) => { // 页面事件总线：用于恢复原文的双通道
  const d = e?.data as any
  if (!d || d.source !== "clip") return
  if (d.type === "clip:translate-restore") {
    try {
      try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORE_ACK" }) } catch {}
      try { window.postMessage({ source: "clip", type: "clip:translate-restore-ack" }, "*") } catch {}
      setTimeout(() => {
        try {
          observer?.disconnect(); observer = null
          try { mutObserver?.disconnect() } catch {}
          mutObserver = null
          __clipOriginal.forEach((v, n) => {
            try { n.nodeValue = v } catch {}
            try { (n.parentElement as HTMLElement | null)?.removeAttribute('data-clip-translated-below') } catch {}
            try { (n.parentElement as HTMLElement | null)?.removeAttribute('data-clip-translated') } catch {}
          })
          __clipOriginal.clear()
          __clipPending.clear()
          try { __clipElementHtmlOriginal.forEach((v, el) => { try { el.innerHTML = v } catch {} }); __clipElementHtmlOriginal.clear() } catch {}
          try { __clipElementHtmlTranslated.clear() } catch {}
          try { __clipLexicon.clear() } catch {}
          isTranslatorActive = false
          __clipFirstReported = false
          try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
          try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*" ) } catch {}
        } catch {}
      }, 0)
    } catch {}
  }
  if (d.type === "clip:diagnose-llm") {
    try {
      chrome.runtime.sendMessage({ action: "diagnose-llm" }, (resp) => {
        try { console.log("[LLM Diagnose]", resp) } catch {}
        try { window.postMessage({ source: "clip", type: "clip:diagnose-llm-result", payload: resp }, "*") } catch {}
      })
    } catch {}
  }
})
// 全局翻译状态
let isTranslatorActive = false
let observer: IntersectionObserver | null = null
let mutObserver: MutationObserver | null = null
const __clipOriginal = new Map<Node, string>()
const __clipTranslated = new Map<Node, string>()
const __clipPending = new Set<Node>()
const __clipElementHtmlOriginal = new Map<HTMLElement, string>()
const __clipElementHtmlTranslated = new Map<HTMLElement, string>()
const __clipLexicon = new Map<string, string>()
const norm = (s: string) => (s || '').trim().replace(/\s+/g, ' ')
let __clipSkipGtx = false
let __clipTargetLang = 'zh-CN'
let __clipSweepDelayMs = 8000
let __clipLastUrl = location.href
let __clipRushTimer: number | null = null
let __clipRushDeadline = 0
let __clipGtxFailStreak = 0
let __clipGtxEverSuccess = false
let __clipStrategy = 'gtx_first'
let __clipRushScrollHandler: ((this: Window, ev: Event) => any) | null = null

function stopTranslationForUrlChange() {
  try {
    try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORE_ACK" }) } catch {}
    try { window.postMessage({ source: "clip", type: "clip:translate-restore-ack" }, "*") } catch {}
    observer?.disconnect(); observer = null
    try { mutObserver?.disconnect() } catch {}
    mutObserver = null
    isTranslatorActive = false
    __clipGtxFailStreak = 0
    __clipGtxEverSuccess = false
    __clipOriginal.clear()
    __clipTranslated.clear()
    __clipPending.clear()
    __clipElementHtmlOriginal.clear(); __clipElementHtmlTranslated.clear()
    try { __clipLexicon.clear() } catch {}
    try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
    try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*" ) } catch {}
    try { if (__clipRushTimer) { clearTimeout(__clipRushTimer); __clipRushTimer = null } } catch {}
    try { if (__clipRushScrollHandler) { window.removeEventListener('scroll', __clipRushScrollHandler as any); __clipRushScrollHandler = null } } catch {}
  } catch {}
}

try {
  const notifyUrlChange = () => {
    const href = location.href
    if (href !== __clipLastUrl) {
      __clipLastUrl = href
      stopTranslationForUrlChange()
    }
  }
  window.addEventListener('popstate', notifyUrlChange)
  window.addEventListener('hashchange', notifyUrlChange)
  const origPush = history.pushState
  const origReplace = history.replaceState
  history.pushState = function(...args: any[]) { const r = origPush.apply(history, args as any); notifyUrlChange(); return r }
  history.replaceState = function(...args: any[]) { const r = origReplace.apply(history, args as any); notifyUrlChange(); return r }
} catch {}
const runTask = (function createLimit(concurrency: number) {
  const queue: (() => Promise<void>)[] = []
  let active = 0
  const next = () => { if (active < concurrency && queue.length) { active++; queue.shift()?.() } }
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    const run = async () => {
      try { resolve(await fn()) } catch(e) { reject(e) } finally { active--; next() }
    }
    queue.push(run)
    next()
  })
})(128)

let __clipFirstReported = false
const isTranslatableText = (t: string) => {
  const s = (t || '').trim()
  if (!s) return false
  if (s.length <= 1) return false
  if (/^[\d\s\.\-\/\:]+$/.test(s)) return false
  return true
}
const hasZh = (s: string) => /[\u4e00-\u9fa5]/.test(s || '')
const hasLatin = (s: string) => /[A-Za-z]/.test(s || '')
const isTranslatableForTarget = (t: string, targetLang: string) => {
  const s = (t || '').trim()
  if (!isTranslatableText(s)) return false
  const isZhTarget = /^zh/i.test(targetLang)
  return isZhTarget ? hasLatin(s) : hasZh(s)
}
const __clipGetTop = (el: HTMLElement) => { try { return el.getBoundingClientRect().top } catch { return 1e9 } }

export async function translateCurrentPage(targetLang = 'zh-CN') { // 启动整页翻译，目标语言默认中文
  if (isTranslatorActive) return
  isTranslatorActive = true
  try { console.log("[Clip] 翻译第1轮/4") } catch {}
  __clipGtxFailStreak = 0
  __clipGtxEverSuccess = false

  if (observer) observer.disconnect();//IntersectionObserver的实例方法，做懒加载，当父块进入视口时才触发该块的翻译。disconnect()方法用于停止观察所有目标元素的变化。
  observer = null
  if (mutObserver) mutObserver.disconnect()
  mutObserver = null
//翻译前做环境清理，移除之前的翻译结果
  try {
    document.querySelectorAll('[data-clip-translated-below]').forEach((el) => { try { el.parentElement?.removeChild(el) } catch {} })
  } catch {}
  try {
    document.querySelectorAll('[data-clip-translated]').forEach((el) => (el as HTMLElement).removeAttribute('data-clip-translated'))
  } catch {}

  const textNodes = getTextNodes(document.body);//获取可翻译文本节点
  if (!textNodes.length) { isTranslatorActive = false; return }
  __clipTargetLang = targetLang

  try {
    const strategyRaw = (await chrome.storage.local.get('translate_strategy'))?.translate_strategy
    const strategy = typeof strategyRaw === 'string' ? strategyRaw : 'gtx_first'
    __clipSkipGtx = strategy === 'llm_first'
    __clipStrategy = strategy
  } catch {}

  const elementMap = new Map<HTMLElement, Node[]>() // 父块与其文本节点映射
  const getBlockAncestor = (el: HTMLElement | null) => {
    const blockTags = ['P','DIV','ARTICLE','SECTION','LI','H1','H2','H3','H4','H5','H6','MAIN','ASIDE'];
    while(el) { if(blockTags.includes(el.tagName)) return el; el=el.parentElement }//向上寻找返回所有块级标签
    return null
  }

  const MAX_HTML_LEN = 100000
  const MAX_CHILDREN = 2000
  const isInteractive = (el: HTMLElement) => {
    try {
      if (el.isContentEditable) return true
      if (/^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL|FORM|IFRAME|VIDEO|AUDIO|CANVAS)$/i.test(el.tagName)) return true
      return !!el.querySelector('a,button,input,select,textarea,label,form,iframe,video,audio,canvas')
    } catch { return true }
  }
  const isHtmlEligible = (el: HTMLElement) => {
    try {
      if (!el) return false
      const len = (el.innerHTML || '').length
      const children = el.childNodes?.length || 0
      if (len > MAX_HTML_LEN) return false
      if (children > MAX_CHILDREN) return false
      if (isInteractive(el)) return false
      return true
    } catch { return false }
  }

  textNodes.forEach(node => {
    const rawParent = node.parentElement as HTMLElement | null
    const parent = getBlockAncestor(rawParent) || rawParent
    if(parent && !parent.dataset.clipTranslated){
      if(!elementMap.has(parent)) elementMap.set(parent, []);//如果父块不在映射中，添加空数组
      elementMap.get(parent)?.push(node)
    }
  })

  try {
    let applied = 0
    for (const n of textNodes) {
      const t = (n.nodeValue || '').trim()
      if (!isTranslatableForTarget(t, targetLang)) continue
      const cached = __clipLexicon.get(norm(t))
      if (cached && cached !== t) {
        if (!__clipOriginal.has(n)) __clipOriginal.set(n, t)
        try { n.nodeValue = cached } catch {}
        __clipTranslated.set(n, cached)
        applied++
        try { const p = (n as any).parentElement as HTMLElement | null; if (p) p.dataset.clipTranslated = 'true' } catch {}
      }
    }
    if (applied > 0 && !__clipFirstReported) {
      __clipFirstReported = true
      try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
      try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
    }
  } catch {}

  const renderMode: 'below' | 'replace' = 'replace'
  const useHtmlTranslate = false

  const runTaskHtml = (function createLimitHtml(concurrency: number) {
    const queue: (() => Promise<void>)[] = []
    let active = 0
    const next = () => { if (active < concurrency && queue.length) { active++; queue.shift()?.() } }
    return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
      const run = async () => { try { resolve(await fn()) } catch(e) { reject(e) } finally { active--; next() }
      }
      queue.push(run)
      next()
    })
  })(16)

  const batchTranslateNodes = (element: HTMLElement, nodes: Node[]) => runTask(async () => { // 单个父块的并发翻译任务
    if (!isTranslatorActive) return
    if (useHtmlTranslate && isHtmlEligible(element)) {
      try {
        const html = element.innerHTML || ""
        const resp = await new Promise<any>((res) => {
          try {
            chrome.runtime.sendMessage({ action: 'translate-html', html, targetLang }, (r) => { const err = chrome.runtime.lastError; if (err) { res(null); return } res(r) })
          } catch { res(null) }
        })
        if (resp?.success && typeof resp.data === 'string') {
          if (!__clipElementHtmlOriginal.has(element)) __clipElementHtmlOriginal.set(element, html)
          element.dataset.clipTranslated='true'
          element.innerHTML = resp.data
          __clipElementHtmlTranslated.set(element, resp.data)
          if (!__clipFirstReported) {
            __clipFirstReported = true
            try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
            try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
          }
        }
      } catch {}
      return
    }
    const texts = nodes.map(n => (n.nodeValue||'').trim())
    const validIdx: number[] = []
    const payload: string[] = []
    for(let i=0;i<texts.length;i++){
      const t = texts[i]
      if (!isTranslatableText(t)) continue
      const cached = __clipLexicon.get(norm(t))
      if (cached && cached !== t) {
        if (!__clipOriginal.has(nodes[i])) __clipOriginal.set(nodes[i], t)
        try { nodes[i].nodeValue = cached } catch {}
        __clipTranslated.set(nodes[i], cached)
        continue
      }
      validIdx.push(i)
      payload.push(t)
    }
    if(!payload.length) return

    // Mark as pending
    validIdx.forEach(idx => __clipPending.add(nodes[idx]))

    const SEP = "|||CLIP_SEP|||"
    try {
      const CHUNK = 16
      const results: string[] = new Array(payload.length)
      const jobs: Promise<void>[] = []
      for (let start = 0; start < payload.length; start += CHUNK) {
        const end = Math.min(start + CHUNK, payload.length)
        const sub = payload.slice(start, end)
        jobs.push((async () => {
          if (!isTranslatorActive) return
          try {
            const translated = await requestTranslation(sub.join(SEP), targetLang)
            const normalized = translated.replace(/｜/g, "|")
            let parts = normalized.split(SEP).map(s => s.trim())
            if (parts.length === 1) {
              const alt1 = normalized.split("\n" + SEP + "\n").map(s => s.trim())
              if (alt1.length > 1) parts = alt1
            }
            if (parts.length === 1) {
              const alt2 = normalized.split(" " + SEP + " ").map(s => s.trim())
              if (alt2.length > 1) parts = alt2
            }
            const isZhTarget = /^zh/i.test(targetLang)
            const hasTarget = (s: string) => isZhTarget ? /[\u4e00-\u9fa5]/.test(s) : /[A-Za-z]/.test(s)
            const allOriginal = parts.length === sub.length && parts.every((p, i) => p === sub[i] && !hasTarget(p))
            if (parts.length !== sub.length || allOriginal) {
              const per: string[] = []
              for (let i = 0; i < sub.length; i++) {
                const src = sub[i]
                try {
                  const r = await requestTranslation(src, targetLang)
                  per.push(r && r.trim().length > 0 ? r : src)
                } catch {
                  per.push(src)
                }
              }
              parts = per
            }
            if (!isTranslatorActive) return
            for (let i = 0; i < parts.length; i++) {
              const globalIdx = start + i
              results[globalIdx] = parts[i]
              const nodePos = validIdx[globalIdx]
              if (renderMode === 'replace' && nodePos !== undefined) {
                if (!__clipOriginal.has(nodes[nodePos])) __clipOriginal.set(nodes[nodePos], texts[nodePos])
                const val = parts[i] || texts[nodePos]
                const isZhTarget = /^zh/i.test(targetLang)
                const hasTargetVal = isZhTarget ? /[\u4e00-\u9fa5]/.test(val) : /[A-Za-z]/.test(val)
                if (hasTargetVal || val !== texts[nodePos]) {
                  try { nodes[nodePos].nodeValue = val } catch {}
                  __clipTranslated.set(nodes[nodePos], val)
                  if (texts[nodePos] && hasTargetVal) __clipLexicon.set(norm(texts[nodePos]), val)
                }
              }
            }
            if (isTranslatorActive && !__clipFirstReported && parts.length > 0) {
              __clipFirstReported = true
              try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
              try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
            }
          } catch (e) { /* ignore requestTranslation error */ }
        })())
      }
      await Promise.all(jobs)
      if (!isTranslatorActive) return
      if (renderMode === 'replace') {
        for (let k = 0; k < validIdx.length; k++) {
          const idx = validIdx[k]
          const node = nodes[idx]
          if (!__clipOriginal.has(node)) __clipOriginal.set(node, texts[idx])
          if (!__clipTranslated.has(node)) {
            const val = results[k] || texts[idx]
            const isZhTarget = /^zh/i.test(targetLang)
            const hasTargetVal = isZhTarget ? /[\u4e00-\u9fa5]/.test(val) : /[A-Za-z]/.test(val)
            if (hasTargetVal || val !== texts[idx]) {
              try { node.nodeValue = val } catch {}
              __clipTranslated.set(node, val)
              if (texts[idx] && hasTargetVal) __clipLexicon.set(norm(texts[idx]), val)
            }
          }
        }
        if (isTranslatorActive && !__clipFirstReported) {
          __clipFirstReported = true
          try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
          try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
        }
      }
    } catch(e) { /* ignore */ }
    finally {
      // Remove from pending
      validIdx.forEach(idx => __clipPending.delete(nodes[idx]))
    }
  })

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        const element = entry.target as HTMLElement
        const nodes = elementMap.get(element)
        if(nodes?.length){
          element.dataset.clipTranslated='true'
          batchTranslateNodes(element,nodes)
          elementMap.delete(element)
        }
        observer?.unobserve(element)
      }
    })
  }, { rootMargin:'800px 0px 800px 0px', threshold:0 })

  elementMap.forEach((_,el)=>observer?.observe(el))

  try {
    const entries: Array<{ el: HTMLElement; nodes: Node[] }> = []
    elementMap.forEach((nodes, el) => entries.push({ el, nodes }))
    const vpH = window.innerHeight, vpW = window.innerWidth, margin = 300
    const isNear = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return r.bottom >= -margin && r.top <= vpH + margin && r.right >= -margin && r.left <= vpW + margin
    }
    const visible = entries.filter(e => isNear(e.el)).sort((a, b) => __clipGetTop(a.el) - __clipGetTop(b.el))
    const hidden = entries.filter(e => !isNear(e.el)).sort((a, b) => __clipGetTop(a.el) - __clipGetTop(b.el))
    const collectVisible: Node[] = []
    for (let i = 0; i < visible.length; i++) {
      const { el, nodes } = visible[i]
      el.dataset.clipTranslated = 'true'
      nodes.forEach(n => collectVisible.push(n))
      observer?.unobserve(el)
      elementMap.delete(el)
    }
    if (collectVisible.length) await runBulkRound(collectVisible, targetLang)
    if (hidden.length) {
      const collectHidden: Node[] = []
      for (let i = 0; i < hidden.length; i++) {
        const { el, nodes } = hidden[i]
        el.dataset.clipTranslated = 'true'
        nodes.forEach(n => collectHidden.push(n))
        observer?.unobserve(el)
        elementMap.delete(el)
      }
      await runBulkRound(collectHidden, targetLang)
    }
  } catch {}


  const vpH=window.innerHeight, vpW=window.innerWidth, margin=300
  const isNearViewport=(el:HTMLElement)=>{
    const r=el.getBoundingClientRect()
    return r.bottom>=-margin && r.top<=vpH+margin && r.right>=-margin && r.left<=vpW+margin
  }
  elementMap.forEach((nodes,el)=>{
    if(isNearViewport(el)){
      el.dataset.clipTranslated='true'
      batchTranslateNodes(el,nodes)
      observer?.unobserve(el)
      elementMap.delete(el)
    }
  })

  console.log("✅ 可视区域监听已启动")

  try {
    const continuousSweep = async (round = 1) => {
      try {
        if (!isTranslatorActive) return
        
        // Find untranslated nodes
        const leftover = new Map<HTMLElement, Node[]>()
        let count = 0
        getTextNodes(document.body).forEach(n => {
          const t = (n.nodeValue || '').trim()
          if (!__clipTranslated.has(n) && !__clipPending.has(n) && isTranslatableForTarget(t, __clipTargetLang)) {
             const el = getBlockAncestor((n as any).parentElement) || (n as any).parentElement
             if (el) {
               if (!leftover.has(el as HTMLElement)) leftover.set(el as HTMLElement, [])
               leftover.get(el as HTMLElement)!.push(n)
               count++
             }
          }
        })

        if (count > 0) {
           try { console.log(`[Clip] 补漏翻译第${round}轮: 发现${count}个未翻译节点`) } catch {}
           const arr: Array<{ el: HTMLElement; nodes: Node[] }> = []
           leftover.forEach((nodes, el) => arr.push({ el, nodes }))
           arr.sort((a, b) => __clipGetTop(a.el) - __clipGetTop(b.el))
           for (const { el, nodes } of arr) { el.dataset.clipTranslated = 'true'; batchTranslateNodes(el, nodes) }
           setTimeout(() => continuousSweep(round + 1), __clipSweepDelayMs)
        } else {
           if (__clipPending.size > 0) {
             try { console.log(`[Clip] 等待进行中的翻译任务：${__clipPending.size}，继续轮询`) } catch {}
             setTimeout(() => continuousSweep(round + 1), Math.max(6000, __clipSweepDelayMs))
           } else {
             try { console.log(`[Clip] 所有内容已覆盖，停止补漏轮询 (第${round}轮)`) } catch {}
           }
        }
      } catch {}
    }
    // Start first sweep after 8s
    setTimeout(() => continuousSweep(1), 8000)
  } catch {}

  try {
    const rushSchedule = () => {
      __clipRushDeadline = Date.now() + 10000
      if (__clipRushTimer) return
      const run = async () => {
        if (!isTranslatorActive) { __clipRushTimer = null; return }
        const vpH=window.innerHeight, vpW=window.innerWidth, margin=300
        const near=(el:HTMLElement)=>{ const r=el.getBoundingClientRect(); return r.bottom>=-margin && r.top<=vpH+margin && r.right>=-margin && r.left<=vpW+margin }
        const leftover = new Map<HTMLElement, Node[]>()
        getTextNodes(document.body).forEach(n => {
          const t=(n.nodeValue||'').trim()
          const p = (n as any).parentElement as HTMLElement | null
          const el = getBlockAncestor(p) || p
          if (el && near(el) && !__clipTranslated.has(n) && !__clipPending.has(n) && isTranslatableForTarget(t, targetLang)) {
            if (!leftover.has(el)) leftover.set(el, [])
            leftover.get(el)!.push(n)
          }
        })
        const arr: Array<{ el: HTMLElement; nodes: Node[] }> = []
        leftover.forEach((nodes, el) => arr.push({ el, nodes }))
        arr.sort((a,b)=>__clipGetTop(a.el)-__clipGetTop(b.el))
        const collect: Node[] = []
        for (const { el, nodes } of arr) { el.dataset.clipTranslated='true'; nodes.forEach(n=>collect.push(n)) }
        if (collect.length) await runBulkRound(collect, targetLang)
        if (Date.now() < __clipRushDeadline) { __clipRushTimer = window.setTimeout(run, 2000) } else { __clipRushTimer = null }
      }
      __clipRushTimer = window.setTimeout(run, 200)
    }
    __clipRushScrollHandler = rushSchedule
    window.addEventListener('scroll', __clipRushScrollHandler, { passive: true })
    rushSchedule()
  } catch {}

  try {
    const tick = () => {
      try {
        if (location.href !== __clipLastUrl) {
          __clipLastUrl = location.href
          observer?.disconnect(); observer = null
          try { mutObserver?.disconnect() } catch {}
          mutObserver = null
          isTranslatorActive = false
          __clipGtxFailStreak = 0
          __clipGtxEverSuccess = false
          __clipOriginal.clear()
          __clipTranslated.clear()
          __clipPending.clear()
          __clipElementHtmlOriginal.clear(); __clipElementHtmlTranslated.clear()
          try { __clipLexicon.clear() } catch {}
          try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
          try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*" ) } catch {}
          try { if (__clipRushTimer) { clearTimeout(__clipRushTimer); __clipRushTimer = null } } catch {}
          try { if (__clipRushScrollHandler) { window.removeEventListener('scroll', __clipRushScrollHandler as any); __clipRushScrollHandler = null } } catch {}
        }
      } catch {}
      setTimeout(tick, 1000)
    }
    setTimeout(tick, 1000)
  } catch {}

  try {
    mutObserver = new MutationObserver((recs) => {
      if (!isTranslatorActive) return
      try { __clipElementHtmlTranslated.forEach((h, el) => { if (el && el.innerHTML !== h) el.innerHTML = h }) } catch {}
      const targets = new Map<HTMLElement, Node[]>()
      const addNode = (n: Node) => {
        if (!n || !(n as any).parentElement) return
        const rawParent = (n as any).parentElement as HTMLElement | null
        const parent = getBlockAncestor(rawParent) || rawParent
        if (!parent) return
        if (!targets.has(parent)) targets.set(parent, [])
        targets.get(parent)!.push(n)
      }
      for (const r of recs) {
        if (r.type === 'characterData') {
          const t = r.target as Node
          const saved = __clipTranslated.get(t)
          const cur = t.nodeValue || ''
          const mapped = __clipLexicon.get((cur || '').trim().replace(/\s+/g, ' '))
          if (!saved && mapped && mapped !== cur) { try { t.nodeValue = mapped } catch {}; __clipTranslated.set(t, mapped); continue }
          if (saved && saved !== cur) { try { t.nodeValue = saved } catch {}; continue }
          try {
            const el = getBlockAncestor((t as any).parentElement) || (t as any).parentElement
            if (el) { /* queue only */ }
          } catch {}
          addNode(t)
        }
        if (r.type === 'childList') {
          r.addedNodes.forEach(an => {
            getTextNodes(an).forEach(n => {
              const cur = n.nodeValue || ''
              const mapped = __clipLexicon.get((cur || '').trim().replace(/\s+/g, ' '))
              if (mapped && mapped !== cur) { try { n.nodeValue = mapped } catch {}; __clipTranslated.set(n, mapped) }
              else addNode(n)
            })
          })
        }
      }
      const arr: Array<{ el: HTMLElement; nodes: Node[] }> = []
      targets.forEach((nodes, el) => {
        const un = nodes.filter(n => !__clipTranslated.has(n))
        if (un.length) arr.push({ el, nodes: un })
      })
      arr.sort((a, b) => __clipGetTop(a.el) - __clipGetTop(b.el))
      for (const { el, nodes } of arr) { el.dataset.clipTranslated = 'true'; batchTranslateNodes(el, nodes) }
    })
    mutObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
  } catch {}
}

function requestTranslation(text: string, lang: string): Promise<string> {
  return new Promise((resolve) => {
    const targetLang = (lang === 'zh' ? 'zh-CN' : lang)
    let finished = false
    const finish = (v: string) => { if (!finished) { finished = true; resolve(v) } }
    if (!isTranslatorActive) { finish(text); return }

    ;(async () => {
      if (__clipStrategy === 'race') {
        const srcLang = /^zh/i.test(targetLang) ? 'en' : 'zh-CN'
        const gtxPromise = (async () => {
          try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(srcLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 4000)
            const res = await fetch(url, { signal: controller.signal })
            clearTimeout(timeoutId)
            if (!res.ok) throw new Error('gtx bad')
            const data = await res.json()
            let out = ""
            if (Array.isArray(data) && Array.isArray(data[0])) {
              for (const seg of data[0]) { if (Array.isArray(seg) && typeof seg[0] === "string") out += seg[0] }
            }
            const v = (out || "").trim()
            const isZhTarget = /^zh/i.test(targetLang)
            const hasTarget = isZhTarget ? /[\u4e00-\u9fa5]/.test(v) : /[A-Za-z]/.test(v)
            if (hasTarget && v && v !== text) { __clipTrace.direct_gtx++; __clipGtxFailStreak = 0; __clipGtxEverSuccess = true; return v }
            __clipGtxFailStreak++
            return null
          } catch {
            __clipGtxFailStreak++
            return null
          }
        })()
        const llmPromise = (async () => {
          try {
            if (!isTranslatorActive) return null
            const resp = await new Promise<any>((res) => {
              try {
                chrome.runtime.sendMessage({ action: 'translate-text-llm', text, targetLang, sourceLang: 'auto' }, (r) => {
                  const err = chrome.runtime.lastError
                  if (err) { res(null); return }
                  res(r)
                })
              } catch { res(null) }
            })
            if (resp?.success && typeof resp.data === 'string') {
              const v = String(resp.data || '').trim()
              const isZhTarget = /^zh/i.test(targetLang)
              const hasTarget = isZhTarget ? /[\u4e00-\u9fa5]/.test(v) : /[A-Za-z]/.test(v)
              if (hasTarget && v !== text) return v
            }
            return null
          } catch { return null }
        })()
        const [gRes, lRes] = await Promise.allSettled([gtxPromise, llmPromise])
        const gVal = gRes.status === 'fulfilled' ? gRes.value : null
        const lVal = lRes.status === 'fulfilled' ? lRes.value : null
        if (gVal) { finish(gVal); return }
        if (lVal) { finish(lVal); return }
        finish(text); return
      }
      if (__clipStrategy === 'race') {
        const srcLang = /^zh/i.test(targetLang) ? 'en' : 'zh-CN'
        const gtxPromise = (async () => {
          try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(srcLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 4000)
            const res = await fetch(url, { signal: controller.signal })
            clearTimeout(timeoutId)
            if (!res.ok) throw new Error('gtx bad')
            const data = await res.json()
            let out = ""
            if (Array.isArray(data) && Array.isArray(data[0])) {
              for (const seg of data[0]) { if (Array.isArray(seg) && typeof seg[0] === "string") out += seg[0] }
            }
            const v = (out || "").trim()
            const isZhTarget = /^zh/i.test(targetLang)
            const hasTarget = isZhTarget ? /[\u4e00-\u9fa5]/.test(v) : /[A-Za-z]/.test(v)
            if (hasTarget && v && v !== text) { __clipTrace.direct_gtx++; __clipGtxFailStreak = 0; __clipGtxEverSuccess = true; return v }
            __clipGtxFailStreak++
            return null
          } catch {
            __clipGtxFailStreak++
            return null
          }
        })()
        const llmPromise = (async () => {
          try {
            const resp = await new Promise<any>((res) => {
              try {
                chrome.runtime.sendMessage({ action: 'translate-text-llm', text, targetLang, sourceLang: 'auto' }, (r) => {
                  const err = chrome.runtime.lastError
                  if (err) { res(null); return }
                  res(r)
                })
              } catch { res(null) }
            })
            if (resp?.success && typeof resp.data === 'string') {
              const v = String(resp.data || '').trim()
              const isZhTarget = /^zh/i.test(targetLang)
              const hasTarget = isZhTarget ? /[\u4e00-\u9fa5]/.test(v) : /[A-Za-z]/.test(v)
              if (hasTarget && v !== text) return v
            }
            return null
          } catch { return null }
        })()
        const [gRes, lRes] = await Promise.allSettled([gtxPromise, llmPromise])
        const gVal = gRes.status === 'fulfilled' ? gRes.value : null
        const lVal = lRes.status === 'fulfilled' ? lRes.value : null
        if (gVal) { finish(gVal); return }
        if (lVal) { finish(lVal); return }
        finish(text); return
      }
      // 1) 先尝试 GTX（2s 超时）
      try {
        if (__clipGtxFailStreak < 5) {
          const srcLang = /^zh/i.test(targetLang) ? 'en' : 'zh-CN'
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(srcLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 4000)
          try {
            const res = await fetch(url, { signal: controller.signal })
            clearTimeout(timeoutId)
            if (res.ok) {
              const data = await res.json()
              let out = ""
              if (Array.isArray(data) && Array.isArray(data[0])) {
                for (const seg of data[0]) { if (Array.isArray(seg) && typeof seg[0] === "string") out += seg[0] }
              }
              const v = (out || "").trim()
              const isZhTarget = /^zh/i.test(targetLang)
              const hasTarget = isZhTarget ? /[\u4e00-\u9fa5]/.test(v) : /[A-Za-z]/.test(v)
              if (hasTarget && v && v !== text) { __clipTrace.direct_gtx++; __clipGtxFailStreak = 0; __clipGtxEverSuccess = true; finish(v); return }
              // 无有效译文则视为失败，进入 LLM 判断
              __clipGtxFailStreak++
            } else {
              __clipGtxFailStreak++
            }
          } catch {
            clearTimeout(timeoutId)
            __clipGtxFailStreak++
          }
        }
      } catch { __clipGtxFailStreak++ }

      // 2) 再判断是否允许 LLM（仅在 GTX 连续失败 >=5 或策略强制且会话未成功 GTX）
      try {
        let allowLlm = (__clipGtxFailStreak >= 5) || __clipSkipGtx
        if (__clipGtxEverSuccess) allowLlm = (__clipGtxFailStreak >= 5)
        if (allowLlm && chrome.runtime?.id) {
          if (!isTranslatorActive) { finish(text); return }
          const resp = await new Promise<any>((res) => {
            try {
              chrome.runtime.sendMessage({ action: 'translate-text-llm', text, targetLang, sourceLang: 'auto' }, (r) => {
                const err = chrome.runtime.lastError
                if (err) { res(null); return }
                res(r)
              })
            } catch { res(null) }
          })
          if (resp?.success && typeof resp.data === 'string') {
            const v = resp.data
            const isZhTarget = /^zh/i.test(targetLang)
            const hasTarget = isZhTarget ? /[\u4e00-\u9fa5]/.test(v) : /[A-Za-z]/.test(v)
            if (hasTarget && v !== text) { finish(v); return }
          }
          // RATE_LIMIT 等错误由补漏继续处理
        }
      } catch {}

      // 3) 兜底：返回原文（等待补漏）
      finish(text)
    })().catch(() => {})

    setTimeout(() => { if (!finished) finish(text) }, 12000)
  })
}

function getTextNodes(element: Node): Node[] {
  let nodes: Node[] = []
  const invalidTags=['SCRIPT','STYLE','NOSCRIPT','CODE','PRE','SVG','TEXTAREA','INPUT','SELECT','OPTION','META','LINK','AUDIO','VIDEO','IMG','IFRAME']
  if(element.nodeType===Node.ELEMENT_NODE){//如果是元素节点
    const el=element as HTMLElement
    if(invalidTags.includes(el.tagName)||el.isContentEditable||el.style?.display==='none'||el.style?.visibility==='hidden') return nodes
    if(el.className && typeof el.className==='string' && (el.className.includes('code')||el.className.includes('hljs'))) return nodes
  }
  element.childNodes.forEach(n=>{
    if(n.nodeType===Node.TEXT_NODE && n.nodeValue?.trim()) nodes.push(n)
    else nodes=nodes.concat(getTextNodes(n));//非文本节点数组递归拼接结果
  })
  return nodes
}
const __clipTrace = { backend_llm: 0, backend_gtx: 0, direct_gtx: 0, original: 0 }
const __clipGtxDisabledUntil = 0
const __clipGtxFailCount = 0
async function runBulkRound(nodes: Node[], targetLang: string) {
  if (!isTranslatorActive) return
  const texts = nodes.map(n => (n.nodeValue || '').trim())
  const valid: number[] = []
  const payload: string[] = []
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]
    if (!isTranslatableText(t)) continue
    valid.push(i)
    payload.push(t)
    __clipPending.add(nodes[i])
  }
  if (!payload.length) return
  const SEP = "|||CLIP_SEP|||"
      const CHUNK = 16
      for (let start = 0; start < payload.length; start += CHUNK) {
        const end = Math.min(start + CHUNK, payload.length)
        const sub = payload.slice(start, end)
        await new Promise<void>((resolve) => {
          try {
        if (!isTranslatorActive) { resolve(); return }
        chrome.runtime.sendMessage({ action: 'translate-text-llm', text: sub.join(SEP), targetLang }, (resp) => {
          const err = chrome.runtime.lastError
          if (err || !resp?.success || typeof resp.data !== 'string') {
            const code = resp?.error
            if (code === 'RATE_LIMIT') {
              __clipSweepDelayMs = Math.min(20000, Math.floor(__clipSweepDelayMs * 1.5))
              const promises: Promise<void>[] = []
              for (let i = 0; i < sub.length; i++) {
                const gi = start + i
                const ni = valid[gi]
                if (ni === undefined) continue
                promises.push(new Promise<void>((done) => {
                  try {
                    if (!isTranslatorActive) { __clipPending.delete(nodes[ni]); done(); return }
                    const delay = Math.min(2000 + Math.floor(Math.random() * 2000), __clipSweepDelayMs)
                    setTimeout(() => {
                      try {
                        chrome.runtime.sendMessage({ action: 'translate-text-llm', text: sub[i], targetLang }, (resp2) => {
                          const err2 = chrome.runtime.lastError
                          const node = nodes[ni]
                          const srcText = texts[ni]
                          let val = srcText
                          if (!err2 && resp2?.success && typeof resp2.data === 'string') {
                            const out = String(resp2.data || '').trim()
                            if (out) val = out
                          }
                          if (!__clipOriginal.has(node)) __clipOriginal.set(node, srcText)
                          const isZhTarget = /^zh/i.test(targetLang)
                          const hasTargetVal = isZhTarget ? /[\u4e00-\u9fa5]/.test(val) : /[A-Za-z]/.test(val)
                          if (hasTargetVal || val !== srcText) {
                            try { node.nodeValue = val } catch {}
                            __clipTranslated.set(node, val)
                            if (srcText && hasTargetVal) __clipLexicon.set(norm(srcText), val)
                          }
                          __clipPending.delete(node)
                          done()
                        })
                      } catch { __clipPending.delete(nodes[ni]); done() }
                    }, delay)
                  } catch { __clipPending.delete(nodes[ni]); done() }
                }))
              }
              Promise.all(promises).then(() => { resolve() })
              return
            }
            if (code === 'RETRYABLE') {
              const promises: Promise<void>[] = []
              for (let i = 0; i < sub.length; i++) {
                const gi = start + i
                const ni = valid[gi]
                if (ni === undefined) continue
                promises.push(new Promise<void>((done) => {
                  try {
                    if (!isTranslatorActive) { __clipPending.delete(nodes[ni]); done(); return }
                    chrome.runtime.sendMessage({ action: 'translate-text-llm', text: sub[i], targetLang }, (resp2) => {
                      const err2 = chrome.runtime.lastError
                      const node = nodes[ni]
                      const srcText = texts[ni]
                      let val = srcText
                      if (!err2 && resp2?.success && typeof resp2.data === 'string') {
                        const out = String(resp2.data || '').trim()
                        if (out) val = out
                      }
                      if (!__clipOriginal.has(node)) __clipOriginal.set(node, srcText)
                      const isZhTarget = /^zh/i.test(targetLang)
                      const hasTargetVal = isZhTarget ? /[\u4e00-\u9fa5]/.test(val) : /[A-Za-z]/.test(val)
                      if (hasTargetVal || val !== srcText) {
                        try { node.nodeValue = val } catch {}
                        __clipTranslated.set(node, val)
                        if (srcText && hasTargetVal) __clipLexicon.set(norm(srcText), val)
                      }
                      __clipPending.delete(node)
                      done()
                    })
                  } catch { __clipPending.delete(nodes[ni]); done() }
                }))
              }
              Promise.all(promises).then(() => { __clipSweepDelayMs = 8000; resolve() })
              return
            }
            for (let i = 0; i < sub.length; i++) { const gi = start + i; const ni = valid[gi]; if (ni !== undefined) __clipPending.delete(nodes[ni]) }
            resolve(); return
          }
          let parts: string[] = []
          try {
            const maybeJson = resp.data.trim()
            if (maybeJson.startsWith("[") || maybeJson.startsWith("{")) {
              const arr = JSON.parse(maybeJson)
              if (Array.isArray(arr)) parts = arr.map((x: any) => String(x || "").trim())
            }
          } catch {}
          if (!parts.length) {
            const normalized = resp.data.replace(/｜/g, "|")
            parts = normalized.split(SEP).map(s => s.trim())
          }
          if (!isTranslatorActive) { __clipSweepDelayMs = 8000; resolve(); return }
          for (let i = 0; i < parts.length; i++) {
            const gi = start + i
            const ni = valid[gi]
            if (ni !== undefined) {
              const node = nodes[ni]
              if (!__clipOriginal.has(node)) __clipOriginal.set(node, texts[ni])
              const val = parts[i] || texts[ni]
              const isZhTarget = /^zh/i.test(targetLang)
              const hasTargetVal = isZhTarget ? /[\u4e00-\u9fa5]/.test(val) : /[A-Za-z]/.test(val)
              if (hasTargetVal || val !== texts[ni]) {
                try { node.nodeValue = val } catch {}
                __clipTranslated.set(node, val)
                if (texts[ni] && hasTargetVal) __clipLexicon.set(norm(texts[ni]), val)
              }
              __clipPending.delete(node)
            }
          }
          if (isTranslatorActive && !__clipFirstReported && parts.length > 0) {
            __clipFirstReported = true
            try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
            try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
          }
          __clipSweepDelayMs = 8000
          resolve()
        })
      } catch { resolve() }
    })
  }
}
