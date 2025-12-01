import { atomWithPlasmoStorage } from "./atom-with-plasmo-storage"

export interface FeishuConfig {
  appToken: string // 多维表格 Base 的 App Token (bascn...)
  tableId: string // 表格 ID (tbl...)
  appId: string // 飞书应用的 App ID
  appSecret: string // 飞书应用的 App Secret
}

export const feishuConfigAtom = atomWithPlasmoStorage<FeishuConfig>(
  "feishuConfig",
  {
    appToken: "",
    tableId: "",
    appId: "",
    appSecret: ""
  }
)
