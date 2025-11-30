/**
 * clip-tagging.ts - AI 交互式打标功能
 * 
 * 包含：
 * 1. 打标系统提示词 (CLIP_TAGGING_SYSTEM_PROMPT)
 * 2. 打标结果解析工具函数
 * 3. 打标数据验证函数
 */

import type { ClipTagsResult } from "./clip-store"

/**
 * AI 打标系统提示词
 * 
 * 角色定义：内容标注助手
 * 输出格式：自然语言 + <clip_tags> JSON
 */
export const CLIP_TAGGING_SYSTEM_PROMPT = `你是一个智能内容标注助手。你的任务是：
1. 根据用户提供的剪藏内容（标题、摘要、原文）进行对话和问答
2. 当用户要求打标签、评分、分类时，帮助用户完成内容标注

## 打标规则

当用户的消息中包含以下意图时，你需要输出打标结果：
- 要求打标签、加标签
- 要求评分、打分
- 要求分类、归类
- 要求记录感想、评论
- 要求修改已有的标签/评分/分类/感想

## 输出格式

你的每次回复必须包含两部分：

1. **自然语言回复**：用友好的中文回复用户，解释你做了什么
2. **机器可读的打标 JSON**：用 <clip_tags> 标签包裹，格式如下：

<clip_tags>
{
  "shouldUpdate": true,
  "categories": ["分类1", "分类2"],
  "scenarios": ["场景1", "场景2"],
  "personalComment": "用户的个人感想或评论",
  "rating": 4,
  "tags": ["标签1", "标签2", "标签3"]
}
</clip_tags>

## 字段说明

- **shouldUpdate**: 布尔值。只有当用户明确要求打标/评分/分类时才设为 true；如果只是闲聊问答，设为 false
- **categories**: 内容分类数组，如 "公司介绍"、"技术文档"、"教程"、"财经分析"、"新闻资讯" 等
- **scenarios**: 适用场景数组，如 "工作参考"、"备考复习"、"投资研究"、"技术学习"、"休闲阅读" 等
- **personalComment**: 用户的个人感想或一句话评论（由用户口述，你帮忙记录）
- **rating**: 1-5 的整数评分
- **tags**: 关键词标签数组，如人名、公司名、技术名词等

## 重要规则

1. 如果用户没有要求打标相关操作，shouldUpdate 必须为 false，其他字段可以省略或为空
2. 只更新用户明确提到的字段，未提及的字段不要擅自填写
3. 评分必须是 1-5 的整数
4. 标签应该简洁，每个标签 2-6 个字为宜
5. 分类和场景可以有多个，但建议不超过 3 个
6. 如果用户说"改成xxx"，表示要替换现有值；如果说"加上xxx"，表示要追加

## 示例

用户："帮我打几个标签和评分"
你的回复：
好的，根据这篇内容的主题，我帮你打了以下标签和评分：

<clip_tags>
{
  "shouldUpdate": true,
  "categories": ["技术文档"],
  "scenarios": ["技术学习"],
  "rating": 4,
  "tags": ["React", "前端开发", "TypeScript"]
}
</clip_tags>

---

用户："我觉得这篇一般，打 3 星吧"
你的回复：
好的，已将评分更新为 3 星。

<clip_tags>
{
  "shouldUpdate": true,
  "rating": 3
}
</clip_tags>

---

用户："这篇文章讲了什么？"（普通问答，不涉及打标）
你的回复：
这篇文章主要讲述了...（正常回答问题）

<clip_tags>
{
  "shouldUpdate": false
}
</clip_tags>
`

/**
 * 从 AI 回复中提取 <clip_tags> JSON 内容
 * 
 * @param aiResponse AI 的完整回复文本
 * @returns 解析后的打标结果，如果没有找到或解析失败则返回 null
 */
export function extractClipTags(aiResponse: string): ClipTagsResult | null {
  // 使用正则匹配 <clip_tags> ... </clip_tags> 内容
  const tagPattern = /<clip_tags>\s*([\s\S]*?)\s*<\/clip_tags>/i
  const match = aiResponse.match(tagPattern)
  
  if (!match || !match[1]) {
    console.log("[ClipTagging] No <clip_tags> found in AI response")
    return null
  }
  
  const jsonStr = match[1].trim()
  
  try {
    const parsed = JSON.parse(jsonStr) as ClipTagsResult
    
    // 验证必要字段
    if (typeof parsed.shouldUpdate !== "boolean") {
      console.warn("[ClipTagging] Invalid shouldUpdate field, defaulting to false")
      parsed.shouldUpdate = false
    }
    
    // 验证评分范围
    if (parsed.rating !== undefined) {
      if (typeof parsed.rating !== "number" || parsed.rating < 1 || parsed.rating > 5) {
        console.warn("[ClipTagging] Invalid rating value, must be 1-5")
        parsed.rating = Math.max(1, Math.min(5, Math.round(parsed.rating) || 3))
      }
    }
    
    // 确保数组字段是数组
    if (parsed.categories && !Array.isArray(parsed.categories)) {
      parsed.categories = [String(parsed.categories)]
    }
    if (parsed.scenarios && !Array.isArray(parsed.scenarios)) {
      parsed.scenarios = [String(parsed.scenarios)]
    }
    if (parsed.tags && !Array.isArray(parsed.tags)) {
      parsed.tags = [String(parsed.tags)]
    }
    
    console.log("[ClipTagging] Parsed clip tags:", parsed)
    return parsed
    
  } catch (error) {
    console.error("[ClipTagging] Failed to parse clip tags JSON:", error)
    console.error("[ClipTagging] Raw JSON string:", jsonStr)
    return null
  }
}

/**
 * 从 AI 回复中移除 <clip_tags> 部分，只保留自然语言
 * 
 * @param aiResponse AI 的完整回复文本
 * @returns 移除打标 JSON 后的纯文本回复
 */
export function removeClipTagsFromResponse(aiResponse: string): string {
  // 移除 <clip_tags>...</clip_tags> 及其内容
  const cleaned = aiResponse.replace(/<clip_tags>\s*[\s\S]*?\s*<\/clip_tags>/gi, "")
  // 清理多余的空行
  return cleaned.replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * 合并新的打标结果到现有剪藏数据
 * 只更新 ClipTagsResult 中有值的字段
 * 
 * @param existing 现有的剪藏打标数据
 * @param updates 新的打标结果
 * @returns 合并后的数据
 */
export function mergeClipTags(
  existing: Partial<ClipTagsResult>,
  updates: ClipTagsResult
): Partial<ClipTagsResult> {
  const result = { ...existing }
  
  // 只更新有值的字段
  if (updates.categories !== undefined && updates.categories.length > 0) {
    result.categories = updates.categories
  }
  if (updates.scenarios !== undefined && updates.scenarios.length > 0) {
    result.scenarios = updates.scenarios
  }
  if (updates.personalComment !== undefined && updates.personalComment.trim() !== "") {
    result.personalComment = updates.personalComment
  }
  if (updates.rating !== undefined) {
    result.rating = updates.rating
  }
  if (updates.tags !== undefined && updates.tags.length > 0) {
    result.tags = updates.tags
  }
  
  return result
}
