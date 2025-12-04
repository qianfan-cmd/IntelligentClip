export const config = { matches: ["<all_urls>"] } // 匹配所有页面，作为内容脚本注入

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
          __clipOriginal.forEach((v, n) => { try { n.nodeValue = v } catch {} })
          __clipOriginal.clear()
          try {
            document.querySelectorAll('[data-clip-translated]').forEach((el) => (el as HTMLElement).removeAttribute('data-clip-translated'))
          } catch {}
          try {
            document.querySelectorAll('[data-clip-translated-below]').forEach((el) => { try { el.parentElement?.removeChild(el) } catch {} })
          } catch {}
          isTranslatorActive = false
          __clipFirstReported = false
          try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
          try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*") } catch {}
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
          __clipOriginal.forEach((v, n) => {
            try { n.nodeValue = v } catch {}
            try { (n.parentElement as HTMLElement | null)?.removeAttribute('data-clip-translated-below') } catch {}
            try { (n.parentElement as HTMLElement | null)?.removeAttribute('data-clip-translated') } catch {}
          })
          __clipOriginal.clear()
          isTranslatorActive = false
          __clipFirstReported = false
          try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
          try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*") } catch {}
        } catch {}
      }, 0)
    } catch {}
  }
})
// 全局翻译状态
let isTranslatorActive = false
let observer: IntersectionObserver | null = null
const __clipOriginal = new Map<Node, string>()
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
})(512)

let __clipFirstReported = false

export async function translateCurrentPage(targetLang = 'zh-CN') { // 启动整页翻译，目标语言默认中文
  if (isTranslatorActive) return
  isTranslatorActive = true

  if (observer) observer.disconnect();//IntersectionObserver的实例方法，做懒加载，当父块进入视口时才触发该块的翻译。disconnect()方法用于停止观察所有目标元素的变化。
  observer = null
//翻译前做环境清理，移除之前的翻译结果
  try {
    document.querySelectorAll('[data-clip-translated-below]').forEach((el) => { try { el.parentElement?.removeChild(el) } catch {} })
  } catch {}
  try {
    document.querySelectorAll('[data-clip-translated]').forEach((el) => (el as HTMLElement).removeAttribute('data-clip-translated'))
  } catch {}

  const textNodes = getTextNodes(document.body);//获取可翻译文本节点
  if (!textNodes.length) { isTranslatorActive = false; return }

  const elementMap = new Map<HTMLElement, Node[]>() // 父块与其文本节点映射
  const getBlockAncestor = (el: HTMLElement | null) => {
    const blockTags = ['P','DIV','ARTICLE','SECTION','LI','H1','H2','H3','H4','H5','H6','MAIN','ASIDE'];
    while(el) { if(blockTags.includes(el.tagName)) return el; el=el.parentElement }//向上寻找返回所有块级标签
    return null
  }

  textNodes.forEach(node => {
    const rawParent = node.parentElement as HTMLElement | null
    const parent = getBlockAncestor(rawParent) || rawParent
    if(parent && !parent.dataset.clipTranslated){
      if(!elementMap.has(parent)) elementMap.set(parent, []);//如果父块不在映射中，添加空数组
      elementMap.get(parent)?.push(node)
    }
  })

  const renderMode: 'below' | 'replace' = 'replace'

  const batchTranslateNodes = (element: HTMLElement, nodes: Node[]) => runTask(async () => { // 单个父块的并发翻译任务
    const texts = nodes.map(n => (n.nodeValue||'').trim())
    const validIdx: number[] = []
    const payload: string[] = []
    for(let i=0;i<texts.length;i++){
      const t=texts[i]
      if(!t || t.length<=1 || /^[\d\s\.\-\/\:]+$/.test(t)) continue
      const enCount = (t.match(/[A-Za-z]/g)||[]).length
      const zhCount = (t.match(/[\u4e00-\u9fa5]/g)||[]).length
      const isZhTarget = /^zh/i.test(targetLang)
      const isEnTarget = /^en/i.test(targetLang)
      if (isZhTarget) { if (enCount < 1) continue }
      else if (isEnTarget) { if (zhCount < 1) continue }
      validIdx.push(i)
      payload.push(t)
    }
    if(!payload.length) return

    const SEP = "|||CLIP_SEP|||"
    try {
      const CHUNK = 24
      const results: string[] = new Array(payload.length)
      const jobs: Promise<void>[] = []
      for (let start = 0; start < payload.length; start += CHUNK) {
        const end = Math.min(start + CHUNK, payload.length)
        const sub = payload.slice(start, end)
        jobs.push((async () => {
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
          for (let i = 0; i < parts.length; i++) {
            const globalIdx = start + i
            results[globalIdx] = parts[i]
            const nodePos = validIdx[globalIdx]
            if (renderMode === 'replace' && nodePos !== undefined) {
              if (!__clipOriginal.has(nodes[nodePos])) __clipOriginal.set(nodes[nodePos], texts[nodePos])
              nodes[nodePos].nodeValue = parts[i] || texts[nodePos]
            }
          }
          if (!__clipFirstReported && parts.length > 0) {
            __clipFirstReported = true
            try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
            try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
          }
        })())
      }
      await Promise.all(jobs)
      if (renderMode === 'replace') {
        for (let k = 0; k < validIdx.length; k++) {
          const idx = validIdx[k]
          if (!__clipOriginal.has(nodes[idx])) __clipOriginal.set(nodes[idx], texts[idx])
          nodes[idx].nodeValue = results[k] || texts[idx]
        }
        if (!__clipFirstReported) {
          __clipFirstReported = true
          try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
          try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
        }
      } else {
        if (element.getAttribute('data-clip-translated-below') !== 'true') {
          const container = document.createElement('div')
          container.setAttribute('data-clip-translated-below', 'true')
          const cs = window.getComputedStyle(element)
          container.style.marginTop = '4px'
          container.style.fontSize = cs.fontSize || 'inherit'
          container.style.lineHeight = cs.lineHeight || 'inherit'
          container.style.color = cs.color || 'inherit'
          container.style.background = '#519e17'
          container.textContent = results.join(' ')
          try { console.log('[ClipTranslate] block', { items: validIdx.length, sources: __clipTrace }) } catch {}
          element.insertAdjacentElement('afterend', container)
          if (!__clipFirstReported) {
            __clipFirstReported = true
            try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
            try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
          }
        }
      }
    } catch(e) { /* ignore */ }
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
  }, { rootMargin:'300px 0px 300px 0px', threshold:0.01 })

  elementMap.forEach((_,el)=>observer?.observe(el))

  try {
    const entries: Array<{ el: HTMLElement; nodes: Node[] }> = []
    elementMap.forEach((nodes, el) => entries.push({ el, nodes }))
    const SLICE = 50
    let idx = 0
    const pump = () => {
      const end = Math.min(idx + SLICE, entries.length)
      for (let i = idx; i < end; i++) {
        const { el, nodes } = entries[i]
        el.dataset.clipTranslated = 'true'
        batchTranslateNodes(el, nodes)
        observer?.unobserve(el)
        elementMap.delete(el)
      }
      idx = end
      if (idx < entries.length) requestAnimationFrame(pump)
    }
    requestAnimationFrame(pump)
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
}

function requestTranslation(text: string, lang: string): Promise<string> {
  return new Promise((resolve) => {
    const targetLang = (lang === 'zh' ? 'zh-CN' : lang)
    let finished = false
    const finish = (v: string) => { if (!finished) { finished = true; resolve(v) } }

    const directGtx = (async () => {
      try {
        const srcLang = /^zh/i.test(targetLang) ? 'en' : 'zh-CN'
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(srcLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
        const res = await fetch(url)
        if (!res.ok) return text
        const data = await res.json()
        let out = ""
        if (Array.isArray(data) && Array.isArray(data[0])) {
          for (const seg of data[0]) { if (Array.isArray(seg) && typeof seg[0] === "string") out += seg[0] }
        }
        __clipTrace.direct_gtx++
        return (out || "").trim() || text
      } catch { return text }
    })().then((v) => {
      if (finished) return
      const isZhTarget = /^zh/i.test(targetLang)
      const hasTarget = isZhTarget ? /[\u4e00-\u9fa5]/.test(v) : /[A-Za-z]/.test(v)
      if (hasTarget && v !== text) finish(v)
    }).catch(() => {})

    try {
      if (chrome.runtime?.id) {
        chrome.storage.local.get("clipper_api_config").then((cfg) => {
          const apiKey = cfg?.clipper_api_config?.apiKey
          const sourceLang = /^zh/i.test(targetLang) ? 'en' : 'zh-CN'
          chrome.runtime.sendMessage({ action: "translate-text", text, targetLang, sourceLang, apiKey }, (resp) => {
            if (chrome.runtime.lastError || !resp?.success) return
            const v = resp.data || text
            const s = resp?.source
            if (!finished) {
              if (s === "llm") __clipTrace.backend_llm++
              else if (s === "gtx") __clipTrace.backend_gtx++
              else __clipTrace.original++
              finish(v)
            }
          })
        }).catch(() => {})
      }
    } catch {}

    setTimeout(() => { if (!finished) finish(text) }, 10000)
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
