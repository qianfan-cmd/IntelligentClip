/**
 * AI 复习卡片生成器
 * 
 * 使用 AI 为剪藏内容生成复习卡片，包括：
 * - 问答题 (qa): 关键问题和答案
 * - 填空题 (cloze): 挖空关键概念
 * - 摘要回顾 (summary): 核心观点复述
 * - 要点回顾 (keypoint): 关键要点问答
 */

import type { ReviewCard, ReviewWithClip } from "./types"

// 卡片生成 Prompt 模板（含 few-shot）
const CARD_GENERATION_PROMPT = `你是一位教育专家，擅长基于给定内容生成高质量、针对性的复习卡片。请结合标题、摘要、关键要点和原文片段，生成 4 张卡片，覆盖不同题型。不要输出与内容无关的通用问题。

【内容】
标题: {title}
摘要: {summary}
关键要点: {keyPoints}
原文片段: {raw}

【生成要求】
1) 共 4 张卡片，类型覆盖：qa、cloze、summary、keypoint，各 1 张。
2) 问题必须引用内容中的具体事实、数字、名称、因果或结论；避免“主要内容是什么”这类空洞问题。
3) cloze：只挖空一个关键词/数字/关键名词，用 ___，句子保持可读。
4) summary：要求用户复述核心结论或因果链，而非笼统概述。
5) keypoint：聚焦一个关键要点，追问细节/影响/数据。
6) 如关键要点不足，可从原文片段里抽取新的关键信息作为题目来源。

【输出格式，严格 JSON】
{ "cards": [ { "type": "qa", "question": "...", "answer": "...", "hint": "可选" } ] }

【示例（请仿照结构而非内容）】
{
  "cards": [
    {"type":"qa","question":"作者提到的三项核心改进是什么？","answer":"A/B/C","hint":"按列举顺序回答"},
    {"type":"cloze","question":"模型在 ___ 数据集上将错误率降至 3.2%","answer":"ImageNet"},
    {"type":"summary","question":"用两句话复述文中提出的成本下降原因链路。","answer":"示例答案"},
    {"type":"keypoint","question":"文中提到的关键瓶颈是什么，它如何影响部署？","answer":"示例答案"}
  ]
}

请输出 JSON：`

/**
 * 生成复习卡片
 * 
 * @param reviewData 复习数据（包含剪藏信息）
 * @returns 生成的复习卡片数组
 */
export async function generateReviewCards(
  reviewData: ReviewWithClip,
  t: (key: string, options?: Record<string, any>) => string
): Promise<ReviewCard[]> {
  const { clip } = reviewData
  let rawFull = clip.rawTextFull
  let rawSnippet = clip.rawTextSnippet
  
  // 如果两者都不存在，尝试从数据库重新获取完整的 Clip 对象
  if (!rawFull && !rawSnippet) {
    console.log("[CardGenerator] rawText missing, fetching full clip from DB...")
    try {
      const { clipDB } = await import("@/lib/clip-db")
      const fullClip = await clipDB.clips.get(clip.id)
      if (fullClip) {
        rawFull = fullClip.rawTextFull
        rawSnippet = fullClip.rawTextSnippet
        console.log("[CardGenerator] fetched from DB", {
          hasRawFull: !!rawFull,
          rawFullLen: rawFull?.length,
          hasRawSnippet: !!rawSnippet,
          rawSnippetLen: rawSnippet?.length
        })
      }
    } catch (err) {
      console.error("[CardGenerator] failed to fetch full clip:", err)
    }
  }
  
  console.log("[CardGenerator] clip data", {
    hasRawFull: !!rawFull,
    rawFullLen: rawFull?.length,
    hasRawSnippet: !!rawSnippet,
    rawSnippetLen: rawSnippet?.length,
    title: clip.title,
    hasSummary: !!clip.summary,
    hasKeyPoints: !!clip.keyPoints
  })
  
  // 构建提示内容
  const rawText = rawFull?.slice(0, 1200) || rawSnippet || "无原文片段"
  const prompt = CARD_GENERATION_PROMPT
    .replace("{title}", clip.title || "无标题")
    .replace("{summary}", clip.summary || "无摘要")
    .replace("{keyPoints}", clip.keyPoints?.join("\n") || "无关键要点")
    .replace("{raw}", rawText)
  
  console.log("[CardGenerator] using rawText", {
    source: rawFull ? "rawTextFull" : (rawSnippet ? "rawTextSnippet" : "fallback"),
    length: rawText.length,
    preview: rawText.slice(0, 100) + "..."
  })
  
  try {
    // 获取 API 配置（从 chrome.storage.local，key 为 clipper_api_config）
    const result = await chrome.storage.local.get("clipper_api_config")
    const apiConfig = result["clipper_api_config"]
    
    const rawKey = apiConfig?.apiKey
    const apiKey = (typeof rawKey === "string" && rawKey.trim()) ? rawKey.trim() : undefined
    const baseUrl = apiConfig?.baseUrl || "https://apis.iflow.cn/v1"
    
    // 根据 baseUrl 推断模型（iFlow 用 qwen3-max，OpenAI 用 gpt-4o-mini）
    const isIFlow = baseUrl?.includes("iflow.cn")
    const model = isIFlow ? "qwen3-max" : "gpt-4o-mini"
    
    console.log("[CardGenerator] config", { 
      hasKey: !!apiKey,
      keyLen: apiKey?.length,
      keyPrefix: apiKey?.slice(0, 10) + "...",
      hasConfig: !!apiConfig,
      configKeys: apiConfig ? Object.keys(apiConfig) : [],
      baseUrl, 
      model,
      isIFlow
    })
    
    if (!apiKey) {
      console.warn("[CardGenerator] No OpenAI API key configured")
      return generateFallbackCards(clip, t)
    }
    
    // 调用 OpenAI API
    const requestBody = {
      model,
      messages: [
        {
          role: "system",
          content: "你是一位教育专家，擅长创建有效的复习材料。请严格按照要求的 JSON 格式输出，并确保问题紧贴输入内容。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.35,
      top_p: 0.9,
      max_tokens: 1400,
      response_format: { type: "json_object" }
    }
    
    console.log("[CardGenerator] requesting", { url: `${baseUrl}/chat/completions`, model })
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })
    
    console.log("[CardGenerator] response", { status: response.status, ok: response.ok })
    if (!response.ok) {
      const errorText = await response.text().catch(() => "(no body)")
      console.error("[CardGenerator] API error response:", errorText)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText.slice(0, 200)}`)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("No content in response")
    }
    
    // 解析 JSON 响应
    const parsed = parseCardsFromResponse(content)
    
    if (parsed.length === 0) {
      console.warn("[CardGenerator] No cards parsed, using fallback")
      return generateFallbackCards(clip, t)
    }
    
    console.log(`[CardGenerator] Generated ${parsed.length} cards`)
    return parsed
    
  } catch (error) {
    console.error("[CardGenerator] Failed to generate cards:", error)
    return generateFallbackCards(clip, t)
  }
}

/**
 * 从 AI 响应中解析卡片
 */
function parseCardsFromResponse(content: string): ReviewCard[] {
  try {
    // 尝试直接解析 JSON
    let parsed: any
    
    // 尝试提取 JSON 部分
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      parsed = JSON.parse(content)
    }
    
    const cards = parsed.cards || parsed
    
    if (!Array.isArray(cards)) {
      return []
    }
    
    // 验证并清理卡片数据
    return cards
      .filter((card: any) => 
        card && 
        typeof card.type === 'string' &&
        typeof card.question === 'string' &&
        typeof card.answer === 'string'
      )
      .map((card: any) => ({
        type: card.type as ReviewCard['type'],
        question: card.question.trim(),
        answer: card.answer.trim(),
        hint: card.hint?.trim()
      }))
      
  } catch (error) {
    console.error("[CardGenerator] Failed to parse cards:", error)
    return []
  }
}

/**
 * 生成后备卡片（当 AI 不可用时）
 */
function generateFallbackCards(clip: ReviewWithClip['clip'], t: (key: string, options?: Record<string, any>) => string): ReviewCard[] {
  const cards: ReviewCard[] = []
  const rawSnippet = (clip as any)?.rawTextSnippet as string | undefined
  
  const summaryQuestion = `${t("cardGeneratorSummaryQuestionLeft")}${clip.title || t("cardGeneratorThisContent")}${t("cardGeneratorSummaryQuestionRight")}`
  // Summary 卡
  cards.push({
    type: 'summary',
    // questionText: `请用自己的话复述《${clip.title || '该内容'}》的核心结论或关键因果链（避免只回答“主要内容是什么”）。`,
    // answerText: clip.summary || rawSnippet || '请参考原文回顾。',
    question: summaryQuestion,
    answer: clip.summary || rawSnippet || t('cardGeneratorReferToOriginal')
  })
  
  // QA 卡：基于摘要或原文具体细节
  const detailSource = clip.keyPoints?.[0] || clip.summary || rawSnippet || clip.title || t('cardGeneratorThisContent')
  cards.push({
    type: 'qa',
    // questionText: `这篇内容的关键细节/数据/结论是什么？请回答要点。`,
    question: t('cardGeneratorQADetailQuestion'),
    answer: detailSource.length > 220 ? detailSource.slice(0, 220) + '...' : detailSource
  })
  
  // Keypoint 卡：取一个关键要点或原文里的具体事实
  const kp = clip.keyPoints && clip.keyPoints.length > 0 ? clip.keyPoints[0] : (rawSnippet || clip.summary || '')
  const keypointQuestion = `${t("cardGeneratorKeypointQuestionLeft")}${clip.title || t('cardGeneratorThisContent')}${t("cardGeneratorKeypointQuestionRight")}`
  cards.push({
    type: 'keypoint',
    //question: `关于《${clip.title || '该内容'}》，哪个关键要点最能体现其价值/影响？`,
    // answer: kp || '请参考原文中的关键要点。',
    question: keypointQuestion,
    answer: kp || t('cardGeneratorReferToOriginalKeypoints')
  })
  
  // Cloze 卡：在摘要/原文中挖空一个关键词
  const sourceForCloze = clip.summary || rawSnippet || ''
  if (sourceForCloze) {
    const words = sourceForCloze.split(/\s+/)
    if (words.length > 6) {
      const mid = Math.floor(words.length / 2)
      const target = words[mid]
      words[mid] = '___'
      cards.push({
        type: 'cloze',
        question: words.join(' '),
        answer: target,
        // hint: '填空为原文中的关键词'
        hint: t('cardGeneratorClozeHint')
      })
    }
  }
  
  // 兜底
  if (cards.length === 0) {
    cards.push({
      type: 'qa',
      // question: '这篇内容的核心观点是什么？',
      // answer: clip.title || '请参考原文。',
      question: t('cardGeneratorQACoreQuestion'),
      answer: clip.title || t('cardGeneratorReferToOriginal')
    })
  }
  
  return cards
}

/**
 * 检查卡片缓存是否有效
 * 卡片生成24小时后过期
 */
export function isCardsCacheValid(generatedAt?: number): boolean {
  if (!generatedAt) return false
  
  const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24小时
  return Date.now() - generatedAt < CACHE_DURATION
}

/**
 * 获取卡片类型的显示名称
 */
export function getCardTypeLabel(type: ReviewCard['type'], t?: (key: string) => string): string {
  if (t) {
    const labels: Record<ReviewCard['type'], string> = {
      qa: t('cardGeneratorCardTypeQA'),
      cloze: t('cardGeneratorCardTypeCloze'),
      summary: t('cardGeneratorCardTypeSummary'),
      keypoint: t('cardGeneratorCardTypeKeypoint')
    }
    return labels[type] || t('cardGeneratorCardTypeUnknown')
  }
  // 回退到硬编码文本（用于不支持国际化的场景）
  const labels: Record<ReviewCard['type'], string> = {
    qa: '问答题',
    cloze: '填空题',
    summary: '摘要回顾',
    keypoint: '要点回顾'
  }
  return labels[type] || '未知类型'
}

/**
 * 获取卡片类型的图标
 */
export function getCardTypeIcon(type: ReviewCard['type']): string {
  const icons: Record<ReviewCard['type'], string> = {
    qa: '❓',
    cloze: '📝',
    summary: '📋',
    keypoint: '🎯'
  }
  return icons[type] || '📄'
}
