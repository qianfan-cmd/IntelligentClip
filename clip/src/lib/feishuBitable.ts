import type { FeishuConfig } from "@/lib/atoms/feishu"
import { storage } from "@/lib/atoms/storage"

import type { Clip } from "./clip-store"

export interface FeishuRecordResponse {
  code: number
  msg: string
  data?: {
    record: {
      record_id: string
      fields: Record<string, unknown>
    }
  }
}

interface TenantAccessTokenResponse {
  code: number
  msg: string
  tenant_access_token?: string
  expire?: number
}

// Token 缓存：避免频繁请求
let cachedToken: string | null = null
let tokenExpireTime: number = 0

/**
 * 自动获取 tenant_access_token
 * 会缓存 token，在过期前复用，减少 API 调用
 */
async function getTenantAccessToken(
  appId: string,
  appSecret: string
): Promise<string> {
  // 如果缓存的 token 还有效（剩余时间 > 5 分钟），直接返回
  const now = Date.now()
  if (cachedToken && tokenExpireTime > now + 5 * 60 * 1000) {
    console.log("✅ 使用缓存的 tenant_access_token")
    return cachedToken
  }

  console.log("🔄 获取新的 tenant_access_token...")

  try {
    const response = await fetch(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret
        })
      }
    )

    const data: TenantAccessTokenResponse = await response.json()

    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(
        `获取 tenant_access_token 失败: ${data.msg || "未知错误"}`
      )
    }

    // 缓存 token 和过期时间（expire 单位是秒）
    cachedToken = data.tenant_access_token
    tokenExpireTime = now + (data.expire || 7200) * 1000

    console.log(`✅ 成功获取 tenant_access_token，有效期 ${data.expire} 秒`)
    return cachedToken
  } catch (error) {
    console.error("❌ 获取 tenant_access_token 失败:", error)
    throw new Error(`获取访问令牌失败: ${(error as Error).message}`)
  }
}

// ---------- 多维表格字段获取与映射 ----------
interface BitableFieldItem {
  field_id: string
  field_name: string // 字段的显示名称
  type?: number
}

interface TableFieldsResponse {
  code: number
  msg: string
  data?: {
    items: BitableFieldItem[]
  }
}

interface CreateFieldResponse {
  code: number
  msg: string
  data?: {
    field: BitableFieldItem
  }
}

// 需要的字段定义（按顺序）
const REQUIRED_FIELDS = [
  { name: "标题", type: 1 }, // 多行文本
  { name: "链接", type: 15 }, // 超链接
  { name: "摘要", type: 1 }, // 多行文本
  { name: "正文", type: 1 }, // 多行文本
  { name: "来源", type: 1 }, // 多行文本
  { name: "创建时间", type: 5 }, // 日期
  { name: "标签", type: 1 }, // 多行文本
  { name: "关键要点", type: 1 } // 多行文本
] as const

// 逻辑字段与可能的名称候选（支持中英文，多加一些默认列名以提升命中率）
const LOGICAL_FIELD_NAME_CANDIDATES: Record<string, string[]> = {
  title: ["Title", "标题", "名称", "记录名", "记录名称", "Name"],
  url: ["URL", "链接"],
  summary: ["Summary", "摘要"],
  fullText: ["Full Text", "正文", "原文", "内容"],
  source: ["Source", "来源"],
  createdAt: ["Created At", "创建时间", "剪藏时间"],
  tags: ["Tags", "标签"],
  keyPoints: ["Key Points", "要点", "关键要点"]
}

/**
 * 获取表格字段列表并返回 name -> field_id 映射
 */
async function fetchFieldMap(
  appToken: string,
  tableId: string,
  tenantAccessToken: string
): Promise<{ map: Map<string, string>; items: BitableFieldItem[] }> {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`
    }
  })
  const data: TableFieldsResponse = await response.json()
  console.log("📥 获取表格字段列表响应:", data)
  if (data.code !== 0 || !data.data) {
    console.warn("⚠️ 获取字段列表失败", data)
    throw new Error(`获取字段列表失败：${data.msg}`)
  }
  const map = new Map<string, string>()
  for (const item of data.data.items) {
    map.set(item.field_name, item.field_id)
  }
  return { map, items: data.data.items }
}

/**
 * 创建单个字段
 */
async function createField(
  appToken: string,
  tableId: string,
  tenantAccessToken: string,
  fieldName: string,
  fieldType: number
): Promise<void> {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      field_name: fieldName,
      type: fieldType
    })
  })

  const data: CreateFieldResponse = await response.json()
  if (data.code !== 0) {
    throw new Error(`创建字段 "${fieldName}" 失败: ${data.msg}`)
  }
  console.log(`✅ 成功创建字段: ${fieldName}`)
}

/**
 * 确保必需的字段存在，不存在则按顺序创建
 */
async function ensureRequiredFields(
  appToken: string,
  tableId: string,
  tenantAccessToken: string,
  existingFields: BitableFieldItem[]
): Promise<void> {
  const existingFieldNames = new Set(existingFields.map((f) => f.field_name))
  const missingFields = REQUIRED_FIELDS.filter(
    (f) => !existingFieldNames.has(f.name)
  )

  if (missingFields.length === 0) {
    console.log("✅ 所有必需字段已存在")
    return
  }

  console.log(`🔧 检测到 ${missingFields.length} 个缺失字段，开始自动创建...`)

  // 按顺序创建缺失的字段
  for (const field of missingFields) {
    try {
      await createField(
        appToken,
        tableId,
        tenantAccessToken,
        field.name,
        field.type
      )
      // 添加短暂延迟避免请求过快
      await new Promise((resolve) => setTimeout(resolve, 300))
    } catch (e) {
      console.warn(`⚠️ 创建字段 "${field.name}" 失败:`, e)
      // 继续创建其他字段
    }
  }

  console.log("✅ 字段创建完成")
}

/**
 * 根据表结构与逻辑字段构建记录字段对象，仅包含存在的字段。
 * 使用字段名称作为键（与飞书多维表格 API 约定一致）。
 */
function buildRecordFields(
  fieldMap: Map<string, string>,
  items: BitableFieldItem[],
  clip: Clip
): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  const missingLogical: string[] = []

  const addIfExists = (logical: string, value: unknown) => {
    const candidates = LOGICAL_FIELD_NAME_CANDIDATES[logical]
    const foundName = candidates.find((name) => fieldMap.has(name))
    if (foundName) {
      // 使用实际字段名称作为键
      record[foundName] = value
    } else {
      missingLogical.push(logical)
    }
  }

  addIfExists("title", clip.title)
  addIfExists("url", clip.url)
  addIfExists("summary", clip.summary)
  addIfExists("fullText", clip.rawTextFull || clip.rawTextSnippet)
  addIfExists("source", clip.source)
  addIfExists("createdAt", new Date(clip.createdAt).toISOString())
  addIfExists("tags", clip.tags?.join(", ") || "")
  addIfExists("keyPoints", clip.keyPoints?.join("\n") || "")

  if (missingLogical.length > 0) {
    console.warn(
      "⚠️ 以下逻辑字段在多维表格中未找到对应列，将被跳过:",
      missingLogical
    )
  }
  // 如果完全没有匹配到任何字段，回退：将内容写入首列（主字段）以避免空记录
  if (Object.keys(record).length === 0 && items.length > 0) {
    const primary = items[0] // 通常第一个为主字段
    // 优先写入标题，若无标题则回退摘要，再回退原文片段
    const fallbackValue =
      clip.title || clip.summary || clip.rawTextSnippet || ""
    if (fallbackValue) {
      // 回退也使用字段名称
      record[primary.field_name] = fallbackValue
      console.warn(
        "ℹ️ 未匹配到任何目标列，已回退将内容写入主字段:",
        primary.field_name
      )
    }
  }
  return record
}

/**
 * Creates a record in Feishu/Lark Base from a Clip.
 * Reads configuration from secure storage.
 */
export async function createRecordFromClip(clip: Clip): Promise<string> {
  console.log("📤 Exporting clip to Feishu:", clip.title)

  // 从存储读取配置
  const config = await storage.get<FeishuConfig>("feishuConfig")

  if (
    !config ||
    !config.appToken ||
    !config.tableId ||
    !config.appId ||
    !config.appSecret
  ) {
    console.warn("⚠️ Feishu configuration missing in settings.")
    throw new Error(
      "飞书配置缺失。请前往扩展设置页面配置 App Token、Table ID、App ID 和 App Secret。"
    )
  }

  // 自动获取 tenant_access_token
  const tenantAccessToken = await getTenantAccessToken(
    config.appId,
    config.appSecret
  )

  // 调用多维表格 API 创建记录
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`
  // 获取字段映射，构建仅包含有效字段的记录内容
  let fields: Record<string, unknown>
  try {
    const { items } = await fetchFieldMap(
      config.appToken,
      config.tableId,
      tenantAccessToken
    )

    // 确保必需字段存在，不存在则自动创建
    await ensureRequiredFields(
      config.appToken,
      config.tableId,
      tenantAccessToken,
      items
    )

    // 重新获取字段列表（可能已创建新字段）
    const { map: updatedFieldMap, items: updatedItems } = await fetchFieldMap(
      config.appToken,
      config.tableId,
      tenantAccessToken
    )

    fields = buildRecordFields(updatedFieldMap, updatedItems, clip)
  } catch (e) {
    console.warn("⚠️ 获取字段映射失败，回退到名称直接匹配方式", e)
    // 回退：使用原始字段名（可能导致 FieldNameNotFound）
    fields = {
      Title: clip.title,
      URL: clip.url,
      Summary: clip.summary,
      "Full Text": clip.rawTextFull || clip.rawTextSnippet,
      Source: clip.source,
      "Created At": new Date(clip.createdAt).toISOString(),
      Tags: clip.tags?.join(", ") || "",
      "Key Points": clip.keyPoints?.join("\n") || ""
    }
  }

  try {
    console.log("🔍 请求详情:", {
      url,
      appToken: config.appToken,
      tableId: config.tableId,
      hasToken: !!tenantAccessToken
    })
    console.log("📦 即将写入字段:", Object.keys(fields))

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tenantAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: fields
      })
    })

    const data: FeishuRecordResponse = await response.json()

    console.log("📥 飞书 API 响应:", data)

    if (data.code !== 0) {
      // 提供更详细的错误信息和解决方案
      let errorMessage = `飞书 API 错误 (code: ${data.code}): ${data.msg}`

      if (
        data.msg === "Forbidden" ||
        data.code === 403 ||
        data.code === 99991663
      ) {
        errorMessage = `权限不足 (Forbidden)。请检查：
1. 飞书应用是否已添加到该多维表格的协作者中
2. 应用权限中是否已开启 "查看、评论和编辑文档" 权限
3. 应用权限中是否已开启 "bitable:record" 相关权限（创建、编辑记录）
4. App Token (${config.appToken}) 和 Table ID (${config.tableId}) 是否正确

详细步骤：
- 打开多维表格 -> 右上角「···」-> 添加协作者 -> 搜索你的应用名称并添加
- 飞书开放平台 -> 权限管理 -> 开启所需权限并重新发布应用版本`
      } else if (data.code === 99991401) {
        errorMessage = `Token 无效。App ID 或 App Secret 可能配置错误，请检查设置。`
      } else if (data.code === 99991400) {
        errorMessage = `参数错误。请检查 App Token 和 Table ID 是否正确。`
      } else if (data.code === 1254045 || /FieldNameNotFound/i.test(data.msg)) {
        // 字段名未找到：尝试获取实际字段列表以提供更明确的提示
        let actualFieldsInfo = ""
        try {
          const { items } = await fetchFieldMap(
            config.appToken,
            config.tableId,
            tenantAccessToken
          )
          const fieldNames = items.map((f) => f.field_name).join(", ")
          actualFieldsInfo = `\n\n📋 表中实际存在的字段名：\n${fieldNames}\n\n请确保上述字段名与以下任一候选名称匹配（注意大小写和空格）：\n  标题/Title/名称, 链接/URL, 摘要/Summary, 正文/Full Text/原文/内容, 来源/Source, 创建时间/Created At, 标签/Tags, 关键要点/Key Points/要点`
        } catch (e) {
          console.warn("无法获取字段列表", e)
          actualFieldsInfo =
            "\n\n💡 提示：打开浏览器 Console 查看「📦 即将写入字段」日志，确认字段名是否与表中列名完全一致。"
        }

        errorMessage = `字段名未找到 (FieldNameNotFound)。可能原因：
1. 尝试写入的字段名在表中不存在或名称不完全匹配
2. 字段名大小写、空格、标点符号不一致
3. 字段被删除或隐藏${actualFieldsInfo}

解决方案：
• 方式 1：在表中创建对应列（使用上述候选名称之一）
• 方式 2：将现有列重命名为候选名称之一
• 方式 3：告诉开发者你的列名，让我们添加到映射中`
      }

      throw new Error(errorMessage)
    }

    if (!data.data?.record?.record_id) {
      throw new Error("飞书 API 返回数据格式异常：缺少 record_id")
    }

    console.log("✅ 成功创建飞书记录:", data.data.record.record_id)
    return data.data.record.record_id
  } catch (error) {
    console.error("❌ 导出到飞书失败:", error)
    throw error
  }
}
