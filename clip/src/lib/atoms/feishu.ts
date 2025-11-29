import { atomWithPlasmoStorage } from "./atom-with-plasmo-storage"

export interface FeishuConfig {
  appToken: string
  tableId: string
  personalBaseToken: string
}

export const feishuConfigAtom = atomWithPlasmoStorage<FeishuConfig>("feishuConfig", {
  appToken: "",
  tableId: "",
  personalBaseToken: ""
})
