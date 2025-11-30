import type { Clip } from "./clip-store"
import { storage } from "@/lib/atoms/storage"
import type { FeishuConfig } from "@/lib/atoms/feishu"

export interface FeishuRecordResponse {
  code: number
  msg: string
  data?: {
    record: {
      record_id: string
      fields: any
    }
  }
}

/**
 * Creates a record in Feishu/Lark Base from a Clip.
 * Reads configuration from secure storage.
 */
export async function createRecordFromClip(clip: Clip): Promise<string> {
  console.log("📤 Exporting clip to Feishu:", clip.title)

  // Read configuration from storage
  const config = await storage.get<FeishuConfig>("feishuConfig")

  if (!config || !config.appToken || !config.tableId || !config.personalBaseToken) {
    console.warn("⚠️ Feishu configuration missing in settings.")
    throw new Error("Feishu configuration missing. Please go to Extension Settings to configure App Token, Table ID, and Personal Base Token.")
  }

  // Real API call implementation
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`
  
  const fields = {
    "Title": clip.title,
    "URL": clip.url,
    "Summary": clip.summary,
    "Full Text": clip.rawTextFull || clip.rawTextSnippet,  // Use full text for export
    "Source": clip.source,
    "Created At": new Date(clip.createdAt).toISOString(),
    "Tags": clip.tags?.join(", ") || "",
    "Key Points": clip.keyPoints?.join("\n") || ""
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.personalBaseToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: fields
      })
    })

    const data: FeishuRecordResponse = await response.json()

    if (data.code !== 0) {
      throw new Error(`Feishu API Error: ${data.msg}`)
    }

    if (!data.data?.record?.record_id) {
      throw new Error("Invalid response from Feishu API")
    }

    return data.data.record.record_id

  } catch (error) {
    console.error("❌ Failed to export to Feishu:", error)
    throw error
  }
}
