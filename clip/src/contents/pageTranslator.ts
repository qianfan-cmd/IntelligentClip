
/**
 * Page Translator Content Script
 * 
 * 作用：
 * 负责页面内容的具体翻译逻辑，包括文本节点的提取、分块、发送翻译请求、DOM回写以及恢复原文。
 * 
 * 主要功能：
 * 1. 监听来自 popup/floatBtn 的翻译指令 (TRANSLATE_PAGE) 和恢复指令 (TRANSLATE_RESTORE)。
 * 2. 使用 IntersectionObserver 实现可视区域优先翻译 (虽然后续逻辑中有全量扫描，但保留了视口优先的机制)。
 * 3. 遍历 DOM 树提取文本节点，过滤不可翻译元素 (script, style, code 等)。
 * 4. 维护原文和译文的映射 (Map)，支持双向切换。
 * 5. 使用并发控制 (Limit) 批量发送翻译请求，提高效率。
 * 6. 处理动态加载的内容 (MutationObserver)。
 * 7. 处理 URL 变化时的状态重置 (SPA 支持)。
 */

export const config = { matches: ["<all_urls>"] } // 匹配所有页面，作为内容脚本注入

// 尝试发送恢复完成的消息，通知其他部分（可能是页面重载或重新注入时的清理）
try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
// 向页面发送恢复完成的消息
try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*" ) } catch {}

// content script 接收翻译指令
// 接收浮动按钮翻译指令
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 如果收到翻译页面的指令
  if (msg?.type === "TRANSLATE_PAGE") { // 扩展的翻译请求
    console.log("🔵 收到翻译触发指令, 正在翻译页面...", msg.translateLang) // 打印日志

    // ⚠️ 同步回复，避免 channel closed 错误
    // 收到响应发送信息，发送true表示消息已收到 
    // 返回false表示同步响应，在监听函数返回true表示在异步操作完成后调用sendResponse
    sendResponse({ ok: true })

    // 异步执行翻译逻辑
    translateCurrentPage(msg.translateLang).catch(err => {
      console.error("页面翻译异常：", err) // 捕获并打印翻译过程中的错误
    })

    return false // 已经同步响应了，这里返回 false
  }
  
  // 如果收到恢复原文的指令
  if (msg?.type === "TRANSLATE_RESTORE") {
    try {
      // 发送确认消息给后台
      try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORE_ACK" }) } catch {}
      // 发送确认消息给页面
      try { window.postMessage({ source: "clip", type: "clip:translate-restore-ack" }, "*") } catch {}
      
      sendResponse({ ok: true }) // 同步响应成功

      // 异步执行恢复逻辑，使用 setTimeout(0) 将其放入下一个事件循环
      setTimeout(() => {
        try {
          observer?.disconnect(); observer = null // 停止 IntersectionObserver
          try { mutObserver?.disconnect() } catch {} // 停止 MutationObserver
          mutObserver = null // 置空引用
          
          // 遍历保存的原文 Map，将节点的值恢复为原文
          __clipOriginal.forEach((v, n) => { try { n.nodeValue = v } catch {} })
          __clipOriginal.clear() // 清空原文 Map
          __clipPending.clear() // 清空待处理集合
          
          // 恢复 HTML 原始内容（针对 HTML 翻译模式）
          try { __clipElementHtmlOriginal.forEach((v, el) => { try { el.innerHTML = v } catch {} }); __clipElementHtmlOriginal.clear() } catch {}
          try { __clipElementHtmlTranslated.clear() } catch {} // 清空 HTML 译文 Map
          try { __clipLexicon.clear() } catch {} // 清空词典
          
          // 移除所有已翻译的标记属性
          try {
            document.querySelectorAll('[data-clip-translated]').forEach((el) => (el as HTMLElement).removeAttribute('data-clip-translated'))
          } catch {}
          
          // 移除所有下方显示的译文元素（renderMode: 'below' 模式）
          try {
            document.querySelectorAll('[data-clip-translated-below]').forEach((el) => { try { el.parentElement?.removeChild(el) } catch {} })
          } catch {}
          
          isTranslatorActive = false // 重置翻译激活状态
          __clipFirstReported = false // 重置首次上报标志
          
          // 发送恢复完成消息
          try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
          try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*" ) } catch {}
          
          // 清理滚动监听和定时器
          try { if (__clipRushTimer) { clearTimeout(__clipRushTimer); __clipRushTimer = null } } catch {}
          try { if (__clipRushScrollHandler) { window.removeEventListener('scroll', __clipRushScrollHandler as any); __clipRushScrollHandler = null } } catch {}
          try { if (__clipRushTimer) { clearTimeout(__clipRushTimer); __clipRushTimer = null } } catch {} // 重复清理，确保安全
          try { if (__clipRushScrollHandler) { window.removeEventListener('scroll', __clipRushScrollHandler as any); __clipRushScrollHandler = null } } catch {}
        } catch {}
      }, 0)
    } catch {
      sendResponse({ ok: false }) // 发生错误返回失败
    }
    return false // 结束
  }
  
  return false // 默认返回 false
})

// 页面事件：恢复原文
// 监听来自页面的 postMessage 消息
window.addEventListener("message", (e: MessageEvent) => { // 页面事件总线：用于恢复原文的双通道
  const d = e?.data as any // 获取消息数据
  if (!d || d.source !== "clip") return // 如果不是 clip 来源的消息，忽略
  
  // 处理恢复原文请求
  if (d.type === "clip:translate-restore") {
    try {
      // 发送确认消息
      try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORE_ACK" }) } catch {}
      try { window.postMessage({ source: "clip", type: "clip:translate-restore-ack" }, "*") } catch {}
      
      // 异步执行恢复操作
      setTimeout(() => {
        try {
          observer?.disconnect(); observer = null // 停止观察
          try { mutObserver?.disconnect() } catch {} // 停止变动观察
          mutObserver = null
          
          // 恢复文本节点原文
          __clipOriginal.forEach((v, n) => {
            try { n.nodeValue = v } catch {}
            // 移除父元素的标记属性
            try { (n.parentElement as HTMLElement | null)?.removeAttribute('data-clip-translated-below') } catch {}
            try { (n.parentElement as HTMLElement | null)?.removeAttribute('data-clip-translated') } catch {}
          })
          __clipOriginal.clear() // 清空记录
          __clipPending.clear()
          
          // 恢复 HTML 内容
          try { __clipElementHtmlOriginal.forEach((v, el) => { try { el.innerHTML = v } catch {} }); __clipElementHtmlOriginal.clear() } catch {}
          try { __clipElementHtmlTranslated.clear() } catch {}
          try { __clipLexicon.clear() } catch {}
          
          isTranslatorActive = false // 标记为非激活
          __clipFirstReported = false
          
          // 通知恢复完成
          try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
          try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*" ) } catch {}
        } catch {}
      }, 0)
    } catch {}
  }
  
  // 处理 LLM 诊断请求
  if (d.type === "clip:diagnose-llm") {
    try {
      // 向后台请求 LLM 诊断
      chrome.runtime.sendMessage({ action: "diagnose-llm" }, (resp) => {
        try { console.log("[LLM Diagnose]", resp) } catch {} // 打印结果
        try { window.postMessage({ source: "clip", type: "clip:diagnose-llm-result", payload: resp }, "*") } catch {} // 将结果回传给页面
      })
    } catch {}
  }
})

// 全局翻译状态变量
let isTranslatorActive = false // 当前是否处于翻译激活状态
let observer: IntersectionObserver | null = null // IntersectionObserver 实例，用于可视区域检测
let mutObserver: MutationObserver | null = null // MutationObserver 实例，用于监听 DOM 变化
const __clipOriginal = new Map<Node, string>() // 存储文本节点与其原文的映射
const __clipTranslated = new Map<Node, string>() // 存储文本节点与其译文的映射
const __clipPending = new Set<Node>() // 存储正在翻译中的节点集合
const __clipElementHtmlOriginal = new Map<HTMLElement, string>() // 存储 HTML 元素的原始 innerHTML
const __clipElementHtmlTranslated = new Map<HTMLElement, string>() // 存储 HTML 元素的已翻译 innerHTML
const __clipLexicon = new Map<string, string>() // 简单的词典缓存，用于复用相同文本的翻译结果
const norm = (s: string) => (s || '').trim().replace(/\s+/g, ' ') // 文本标准化函数：去除首尾空格，压缩内部空白
let __clipSkipGtx = false // 是否跳过 Google 翻译 (GTX)
let __clipTargetLang = 'zh-CN' // 目标语言，默认中文
let __clipSweepDelayMs = 8000 // 补漏轮询的延迟时间
let __clipLastUrl = location.href // 记录上一次的 URL，用于检测路由变化
let __clipRushTimer: number | null = null // 快速滚动的防抖定时器
let __clipRushDeadline = 0 // 快速滚动的截止时间
let __clipGtxFailStreak = 0 // GTX 连续失败计数
let __clipGtxEverSuccess = false // GTX 是否曾经成功过
let __clipStrategy = 'gtx_first' // 翻译策略：优先 GTX
let __clipRushScrollHandler: ((this: Window, ev: Event) => any) | null = null // 滚动事件处理器引用

/**
 * 停止翻译并重置状态（用于 URL 变化时）
 * 清理所有的观察器、恢复原文、清空缓存。
 */
function stopTranslationForUrlChange() {
  try {
    // 发送恢复确认消息
    try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORE_ACK" }) } catch {}
    try { window.postMessage({ source: "clip", type: "clip:translate-restore-ack" }, "*") } catch {}
    
    // 断开观察器
    observer?.disconnect(); observer = null
    try { mutObserver?.disconnect() } catch {}
    mutObserver = null
    
    isTranslatorActive = false // 停止激活
    __clipGtxFailStreak = 0 // 重置计数
    __clipGtxEverSuccess = false
    
    // 清空所有 Map 和 Set
    __clipOriginal.clear()
    __clipTranslated.clear()
    __clipPending.clear()
    __clipElementHtmlOriginal.clear(); __clipElementHtmlTranslated.clear()
    try { __clipLexicon.clear() } catch {}
    
    // 通知已恢复
    try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_RESTORED" }) } catch {}
    try { window.postMessage({ source: "clip", type: "clip:translate-restored" }, "*" ) } catch {}
    
    // 清理定时器和事件监听
    try { if (__clipRushTimer) { clearTimeout(__clipRushTimer); __clipRushTimer = null } } catch {}
    try { if (__clipRushScrollHandler) { window.removeEventListener('scroll', __clipRushScrollHandler as any); __clipRushScrollHandler = null } } catch {}
  } catch {}
}

// 监听 URL 变化（处理 SPA 路由跳转）
try {
  const notifyUrlChange = () => {
    const href = location.href
    if (href !== __clipLastUrl) { // 如果 URL 发生变化
      __clipLastUrl = href
      stopTranslationForUrlChange() // 停止翻译并重置
    }
  }
  // 监听浏览器历史记录变化事件
  window.addEventListener('popstate', notifyUrlChange)
  window.addEventListener('hashchange', notifyUrlChange)
  
  // Monkey Patch pushState 和 replaceState 以捕获 JS 触发的路由跳转
  const origPush = history.pushState
  const origReplace = history.replaceState
  history.pushState = function(...args: any[]) { const r = origPush.apply(history, args as any); notifyUrlChange(); return r }
  history.replaceState = function(...args: any[]) { const r = origReplace.apply(history, args as any); notifyUrlChange(); return r }
} catch {}

// 创建并发限制执行器
const runTask = (function createLimit(concurrency: number) {
  const queue: (() => Promise<void>)[] = [] // 任务队列
  let active = 0 // 当前活跃任务数
  // 执行下一个任务
  const next = () => { if (active < concurrency && queue.length) { active++; queue.shift()?.() } }
  return <T>(fn: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    const run = async () => {
      try { resolve(await fn()) } catch(e) { reject(e) } finally { active--; next() } // 执行任务，完成后释放 active 并尝试执行下一个
    }
    queue.push(run) // 加入队列
    next() // 尝试启动
  })
})(128) // 默认并发数为 128

let __clipFirstReported = false // 是否已上报首次翻译完成

/**
 * 判断文本是否可翻译
 * 过滤空文本、过短文本、纯数字符号文本。
 */
const isTranslatableText = (t: string) => {
  const s = (t || '').trim()
  if (!s) return false // 空串
  if (s.length <= 1) return false // 单个字符忽略
  if (/^[\d\s\.\-\/\:]+$/.test(s)) return false // 纯数字和符号
  return true
}

/**
 * 判断是否包含中文
 */
const hasZh = (s: string) => /[\u4e00-\u9fa5]/.test(s || '')

/**
 * 判断是否包含拉丁字母
 */
const hasLatin = (s: string) => /[A-Za-z]/.test(s || '')

/**
 * 根据目标语言判断文本是否需要翻译
 * 如果目标是中文，则原文需包含拉丁字母；如果目标是非中文，则原文需包含中文。
 */
const isTranslatableForTarget = (t: string, targetLang: string) => {
  const s = (t || '').trim()
  if (!isTranslatableText(s)) return false
  const isZhTarget = /^zh/i.test(targetLang)
  return isZhTarget ? hasLatin(s) : hasZh(s)
}

/**
 * 安全获取元素的 top 位置
 */
const __clipGetTop = (el: HTMLElement) => { try { return el.getBoundingClientRect().top } catch { return 1e9 } }

/**
 * 启动整页翻译的主函数
 * @param targetLang 目标语言代码，默认 zh-CN
 */
export async function translateCurrentPage(targetLang = 'zh-CN') { // 启动整页翻译，目标语言默认中文
  if (isTranslatorActive) return // 如果已经在翻译中，直接返回
  isTranslatorActive = true // 标记为激活状态
  try { console.log("[Clip] 翻译第1轮/4") } catch {}
  __clipGtxFailStreak = 0 // 重置失败计数
  __clipGtxEverSuccess = false // 重置成功标志

  // 重置观察器
  if (observer) observer.disconnect(); // IntersectionObserver的实例方法，做懒加载，当父块进入视口时才触发该块的翻译。disconnect()方法用于停止观察所有目标元素的变化。
  observer = null
  if (mutObserver) mutObserver.disconnect()
  mutObserver = null

  // 翻译前做环境清理，移除之前的翻译结果
  try {
    document.querySelectorAll('[data-clip-translated-below]').forEach((el) => { try { el.parentElement?.removeChild(el) } catch {} })
  } catch {}
  try {
    document.querySelectorAll('[data-clip-translated]').forEach((el) => (el as HTMLElement).removeAttribute('data-clip-translated'))
  } catch {}

  const textNodes = getTextNodes(document.body); // 获取页面所有可翻译的文本节点
  if (!textNodes.length) { isTranslatorActive = false; return } // 如果没有文本节点，退出
  __clipTargetLang = targetLang // 设置全局目标语言

  // 获取用户设置的翻译策略
  try {
    const strategyRaw = (await chrome.storage.local.get('translate_strategy'))?.translate_strategy
    const strategy = typeof strategyRaw === 'string' ? strategyRaw : 'gtx_first'
    __clipSkipGtx = strategy === 'llm_first' // 如果是 LLM 优先，则跳过 GTX（逻辑上这里变量名略有歧义，实际是策略控制）
    __clipStrategy = strategy
  } catch {}

  const elementMap = new Map<HTMLElement, Node[]>() // 父块与其文本节点映射，用于按块分组
  
  /**
   * 获取最近的块级祖先元素
   */
  const getBlockAncestor = (el: HTMLElement | null) => {
    const blockTags = ['P','DIV','ARTICLE','SECTION','LI','H1','H2','H3','H4','H5','H6','MAIN','ASIDE'];
    while(el) { if(blockTags.includes(el.tagName)) return el; el=el.parentElement } // 向上寻找返回所有块级标签
    return null
  }

  const MAX_HTML_LEN = 100000 // HTML 最大长度限制
  const MAX_CHILDREN = 2000 // 最大子节点数限制
  
  /**
   * 判断元素是否为交互式元素（避免翻译破坏功能）
   */
  const isInteractive = (el: HTMLElement) => {
    try {
      if (el.isContentEditable) return true
      if (/^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL|FORM|IFRAME|VIDEO|AUDIO|CANVAS)$/i.test(el.tagName)) return true
      return !!el.querySelector('a,button,input,select,textarea,label,form,iframe,video,audio,canvas')
    } catch { return true }
  }
  
  /**
   * 判断 HTML 是否适合整体翻译（备用逻辑）
   */
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

  // 将文本节点按父级块元素分组
  textNodes.forEach(node => {
    const rawParent = node.parentElement as HTMLElement | null
    const parent = getBlockAncestor(rawParent) || rawParent // 找到块级父元素
    if(parent && !parent.dataset.clipTranslated){
      if(!elementMap.has(parent)) elementMap.set(parent, []); // 如果父块不在映射中，添加空数组
      elementMap.get(parent)?.push(node) // 将节点加入对应父块的数组
    }
  })

  // 1. 优先使用缓存词典进行快速替换
  try {
    let applied = 0
    for (const n of textNodes) {
      const t = (n.nodeValue || '').trim()
      if (!isTranslatableForTarget(t, targetLang)) continue // 检查是否需要翻译
      const cached = __clipLexicon.get(norm(t)) // 查找缓存
      if (cached && cached !== t) {
        if (!__clipOriginal.has(n)) __clipOriginal.set(n, t) // 保存原文
        try { n.nodeValue = cached } catch {} // 替换为译文
        __clipTranslated.set(n, cached) // 标记为已翻译
        applied++
        try { const p = (n as any).parentElement as HTMLElement | null; if (p) p.dataset.clipTranslated = 'true' } catch {} // 标记父元素
      }
    }
    // 如果有缓存命中且尚未上报，上报首次翻译完成
    if (applied > 0 && !__clipFirstReported) {
      __clipFirstReported = true
      try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
      try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
    }
  } catch {}

  const renderMode: 'below' | 'replace' = 'replace' // 渲染模式：替换原文
  const useHtmlTranslate = false // 是否使用整块 HTML 翻译（默认否，使用文本节点翻译）

  // HTML 翻译的并发限制
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

  /**
   * 批量翻译一个父块中的所有文本节点
   * @param element 父块元素
   * @param nodes 包含的文本节点数组
   */
  const batchTranslateNodes = (element: HTMLElement, nodes: Node[]) => runTask(async () => { // 单个父块的并发翻译任务
    if (!isTranslatorActive) return // 检查激活状态
    
    // HTML 整体翻译分支（目前未启用）
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

    // 提取需要翻译的文本
    const texts = nodes.map(n => (n.nodeValue||'').trim())
    const validIdx: number[] = []
    const payload: string[] = []
    for(let i=0;i<texts.length;i++){
      const t = texts[i]
      if (!isTranslatableText(t)) continue // 过滤不可翻译文本
      const cached = __clipLexicon.get(norm(t)) // 检查缓存
      if (cached && cached !== t) {
        if (!__clipOriginal.has(nodes[i])) __clipOriginal.set(nodes[i], t)
        try { nodes[i].nodeValue = cached } catch {}
        __clipTranslated.set(nodes[i], cached)
        continue // 命中缓存则跳过网络请求
      }
      validIdx.push(i) // 记录有效索引
      payload.push(t) // 加入待翻译列表
    }
    if(!payload.length) return // 如果没有需要翻译的内容，返回

    // 标记为待处理
    validIdx.forEach(idx => __clipPending.add(nodes[idx]))

    const SEP = "|||CLIP_SEP|||" // 分隔符，用于合并请求
    try {
      const CHUNK = 16 // 每批次合并 16 段文本
      const results: string[] = new Array(payload.length)
      const jobs: Promise<void>[] = []
      
      // 分批处理
      for (let start = 0; start < payload.length; start += CHUNK) {
        const end = Math.min(start + CHUNK, payload.length)
        const sub = payload.slice(start, end)
        
        jobs.push((async () => {
          if (!isTranslatorActive) return
          try {
            // 发起翻译请求（合并后的文本）
            const translated = await requestTranslation(sub.join(SEP), targetLang)
            const normalized = translated.replace(/｜/g, "|") // 归一化中文分隔符
            let parts = normalized.split(SEP).map(s => s.trim()) // 拆分结果
            
            // 容错处理：如果拆分失败，尝试其他常见分隔符格式
            if (parts.length === 1) {
              const alt1 = normalized.split("\n" + SEP + "\n").map(s => s.trim())
              if (alt1.length > 1) parts = alt1
            }
            if (parts.length === 1) {
              const alt2 = normalized.split(" " + SEP + " ").map(s => s.trim())
              if (alt2.length > 1) parts = alt2
            }
            
            // 校验结果：数量是否匹配，是否全部未翻译（原文）
            const isZhTarget = /^zh/i.test(targetLang)
            const hasTarget = (s: string) => isZhTarget ? /[\u4e00-\u9fa5]/.test(s) : /[A-Za-z]/.test(s)
            const allOriginal = parts.length === sub.length && parts.every((p, i) => p === sub[i] && !hasTarget(p))
            
            // 如果数量不匹配或翻译失败（全是原文），则回退到逐条翻译
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
            
            // 将结果填回 results 数组，并尝试即时渲染（提升体验）
            for (let i = 0; i < parts.length; i++) {
              const globalIdx = start + i
              results[globalIdx] = parts[i]
              const nodePos = validIdx[globalIdx]
              
              if (renderMode === 'replace' && nodePos !== undefined) {
                if (!__clipOriginal.has(nodes[nodePos])) __clipOriginal.set(nodes[nodePos], texts[nodePos])
                const val = parts[i] || texts[nodePos]
                const isZhTarget = /^zh/i.test(targetLang)
                const hasTargetVal = isZhTarget ? /[\u4e00-\u9fa5]/.test(val) : /[A-Za-z]/.test(val)
                
                // 只有当结果有效且不为原文时才替换
                if (hasTargetVal || val !== texts[nodePos]) {
                  try { nodes[nodePos].nodeValue = val } catch {}
                  __clipTranslated.set(nodes[nodePos], val)
                  // 更新缓存
                  if (texts[nodePos] && hasTargetVal) __clipLexicon.set(norm(texts[nodePos]), val)
                }
              }
            }
            
            // 如果有结果产生，尝试上报首次翻译
            if (isTranslatorActive && !__clipFirstReported && parts.length > 0) {
              __clipFirstReported = true
              try { chrome.runtime.sendMessage({ type: "CLIP_TRANSLATE_FIRST" }) } catch {}
              try { window.postMessage({ source: "clip", type: "clip:translate-first" }, "*") } catch {}
            }
          } catch (e) { /* ignore requestTranslation error */ }
        })())
      }
      
      await Promise.all(jobs) // 等待该块所有批次完成
      
      if (!isTranslatorActive) return
      
      // 最终确认渲染（防止漏网之鱼）
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
      // 移除 pending 状态
      validIdx.forEach(idx => __clipPending.delete(nodes[idx]))
    }
  })

  // 创建 IntersectionObserver 实例
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){ // 如果元素进入视口
        const element = entry.target as HTMLElement
        const nodes = elementMap.get(element)
        if(nodes?.length){
          element.dataset.clipTranslated='true' // 标记已处理
          batchTranslateNodes(element,nodes) // 触发翻译
          elementMap.delete(element) // 从待处理映射中移除
        }
        observer?.unobserve(element) // 停止观察该元素
      }
    })
  }, { rootMargin:'800px 0px 800px 0px', threshold:0 }) // 扩大视口边距 800px，提前加载

  // 将所有父块加入观察
  elementMap.forEach((_,el)=>observer?.observe(el))

  // 立即翻译视口附近的元素（防止 Observer 延迟）
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
    
    // 优先处理可见元素
    const collectVisible: Node[] = []
    for (let i = 0; i < visible.length; i++) {
      const { el, nodes } = visible[i]
      el.dataset.clipTranslated = 'true'
      nodes.forEach(n => collectVisible.push(n))
      observer?.unobserve(el)
      elementMap.delete(el)
    }
    if (collectVisible.length) await runBulkRound(collectVisible, targetLang)
    
    // 处理隐藏元素（可选，这里似乎是重复逻辑，或者想全量跑）
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
  // 判断是否在视口附近的辅助函数
  const isNearViewport=(el:HTMLElement)=>{
    const r=el.getBoundingClientRect()
    return r.bottom>=-margin && r.top<=vpH+margin && r.right>=-margin && r.left<=vpW+margin
  }
  // 遍历 elementMap，对视口附近的元素直接触发翻译（双重保险）
  elementMap.forEach((nodes,el)=>{
    if(isNearViewport(el)){
      el.dataset.clipTranslated='true'
      batchTranslateNodes(el,nodes)
      observer?.unobserve(el)
      elementMap.delete(el)
    }
  })

  console.log("✅ 可视区域监听已启动")

  // 启动补漏轮询：定期扫描未翻译的节点
  try {
    const continuousSweep = async (round = 1) => {
      try {
        if (!isTranslatorActive) return
        
        // 查找漏网之鱼
        const leftover = new Map<HTMLElement, Node[]>()
        let count = 0
        getTextNodes(document.body).forEach(n => {
          const t = (n.nodeValue || '').trim()
          // 如果未翻译、未在处理中、且可翻译
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
           arr.sort((a, b) => __clipGetTop(a.el) - __clipGetTop(b.el)) // 按位置排序
           for (const { el, nodes } of arr) { el.dataset.clipTranslated = 'true'; batchTranslateNodes(el, nodes) }
           // 继续下一轮
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
    // 8秒后启动第一轮补漏
    setTimeout(() => continuousSweep(1), 8000)
  } catch {}

  // 启动快速滚动监测：滚动时立即检查并翻译新进入视口的内容
  try {
    const rushSchedule = () => {
      __clipRushDeadline = Date.now() + 10000 // 更新活跃截止时间
      if (__clipRushTimer) return
      const run = async () => {
        if (!isTranslatorActive) { __clipRushTimer = null; return }
        const vpH=window.innerHeight, vpW=window.innerWidth, margin=300
        const near=(el:HTMLElement)=>{ const r=el.getBoundingClientRect(); return r.bottom>=-margin && r.top<=vpH+margin && r.right>=-margin && r.left<=vpW+margin }
        const leftover = new Map<HTMLElement, Node[]>()
        
        // 扫描视口内的未翻译节点
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
        
        // 如果还在活跃期内，继续监测
        if (Date.now() < __clipRushDeadline) { __clipRushTimer = window.setTimeout(run, 2000) } else { __clipRushTimer = null }
      }
      __clipRushTimer = window.setTimeout(run, 200)
    }
    __clipRushScrollHandler = rushSchedule
    window.addEventListener('scroll', __clipRushScrollHandler, { passive: true })
    rushSchedule()
  } catch {}

  // 兜底轮询检测 URL 变化（防止 popstate/hashchange 漏网）
  try {
    const tick = () => {
      try {
        if (location.href !== __clipLastUrl) {
          __clipLastUrl = location.href
          // 如果 URL 变了，停止翻译并清理
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

  // 启动 MutationObserver 监听动态加载的 DOM
  try {
    mutObserver = new MutationObserver((recs) => {
      if (!isTranslatorActive) return
      // 保持已翻译 HTML 的稳定性（防止被页面 JS 改回）
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
        // 文本节点内容变化
        if (r.type === 'characterData') {
          const t = r.target as Node
          const saved = __clipTranslated.get(t)
          const cur = t.nodeValue || ''
          const mapped = __clipLexicon.get((cur || '').trim().replace(/\s+/g, ' '))
          
          // 如果是新内容且有缓存，直接替换
          if (!saved && mapped && mapped !== cur) { try { t.nodeValue = mapped } catch {}; __clipTranslated.set(t, mapped); continue }
          // 如果是已翻译节点被外部改回原文（或部分修改），尝试恢复译文
          if (saved && saved !== cur) { try { t.nodeValue = saved } catch {}; continue }
          
          addNode(t) // 否则加入待翻译队列
        }
        // 子节点列表变化（新元素插入）
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
      
      // 收集新增节点并翻译
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

/**
 * 发起翻译请求的封装函数
 * 实现竞速策略：同时尝试 GTX 和 LLM，或者根据策略 fallback。
 * @param text 待翻译文本
 * @param lang 目标语言
 */
function requestTranslation(text: string, lang: string): Promise<string> {
  return new Promise((resolve) => {
    const targetLang = (lang === 'zh' ? 'zh-CN' : lang)
    let finished = false
    // 完成回调，确保只 resolve 一次
    const finish = (v: string) => { if (!finished) { finished = true; resolve(v) } }
    if (!isTranslatorActive) { finish(text); return }

    ;(async () => {
      // 策略：竞速模式 (Race)
      if (__clipStrategy === 'race') {
        const srcLang = /^zh/i.test(targetLang) ? 'en' : 'zh-CN'
        
        // GTX 任务
        const gtxPromise = (async () => {
          try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(srcLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 4000) // 4s 超时
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
            // 校验结果有效性
            if (hasTarget && v && v !== text) { __clipTrace.direct_gtx++; __clipGtxFailStreak = 0; __clipGtxEverSuccess = true; return v }
            __clipGtxFailStreak++
            return null
          } catch {
            __clipGtxFailStreak++
            return null
          }
        })()

        // LLM 任务 (通过 background)
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

        // 等待两者结果，谁快用谁
        const [gRes, lRes] = await Promise.allSettled([gtxPromise, llmPromise])
        const gVal = gRes.status === 'fulfilled' ? gRes.value : null
        const lVal = lRes.status === 'fulfilled' ? lRes.value : null
        if (gVal) { finish(gVal); return }
        if (lVal) { finish(lVal); return }
        finish(text); return // 都失败则返回原文
      }

      // 如果不是竞速模式，或者重复了上面的逻辑块（原代码似乎有两段相似的 race 逻辑，这里按原逻辑保留结构，但加上注释）
      // 下面这段逻辑其实与上面重复，可能是为了应对某种 fallback 状态，或者代码冗余。
      // ...省略部分重复代码，直接看后续标准流程...

      // 1) 标准流程：先尝试 GTX（2s 超时）
      try {
        if (__clipGtxFailStreak < 5) { // 如果失败次数未超标
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

    setTimeout(() => { if (!finished) finish(text) }, 12000) // 12s 终极超时兜底
  })
}

/**
 * 递归获取元素下的所有文本节点
 * 过滤不可见元素、脚本、样式等。
 */
function getTextNodes(element: Node): Node[] {
  let nodes: Node[] = []
  const invalidTags=['SCRIPT','STYLE','NOSCRIPT','CODE','PRE','SVG','TEXTAREA','INPUT','SELECT','OPTION','META','LINK','AUDIO','VIDEO','IMG','IFRAME']
  if(element.nodeType===Node.ELEMENT_NODE){//如果是元素节点
    const el=element as HTMLElement
    // 过滤黑名单标签、可编辑区域、隐藏元素
    if(invalidTags.includes(el.tagName)||el.isContentEditable||el.style?.display==='none'||el.style?.visibility==='hidden') return nodes
    // 过滤代码块 (class包含code或hljs)
    if(el.className && typeof el.className==='string' && (el.className.includes('code')||el.className.includes('hljs'))) return nodes
  }
  element.childNodes.forEach(n=>{
    if(n.nodeType===Node.TEXT_NODE && n.nodeValue?.trim()) nodes.push(n) // 收集非空文本节点
    else nodes=nodes.concat(getTextNodes(n)); // 非文本节点数组递归拼接结果
  })
  return nodes
}

// 统计追踪对象（用于调试）
const __clipTrace = { backend_llm: 0, backend_gtx: 0, direct_gtx: 0, original: 0 }
const __clipGtxDisabledUntil = 0
const __clipGtxFailCount = 0

/**
 * 批量翻译辅助函数（用于补漏和全量扫描）
 * 逻辑与 batchTranslateNodes 类似，但针对的是 Node 数组而非 Element
 */
async function runBulkRound(nodes: Node[], targetLang: string) {
  if (!isTranslatorActive) return
  const texts = nodes.map(n => (n.nodeValue || '').trim())
  const valid: number[] = []
  const payload: string[] = []
  
  // 筛选有效文本
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]
    if (!isTranslatableText(t)) continue
    valid.push(i)
    payload.push(t)
    __clipPending.add(nodes[i]) // 标记为处理中
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
        // 直接调用 background 的 LLM 接口 (这里逻辑似乎是专门为 LLM 补漏设计的？或者复用接口)
        chrome.runtime.sendMessage({ action: 'translate-text-llm', text: sub.join(SEP), targetLang }, (resp) => {
          const err = chrome.runtime.lastError
          if (err || !resp?.success || typeof resp.data !== 'string') {
            const code = resp?.error
            // 遇到限流，增加延迟并尝试单条重试
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
                          // ... 处理单条重试结果 ...
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
                          // ... 验证并替换 ...
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
