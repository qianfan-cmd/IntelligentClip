import { atomWithPlasmoStorage } from "./atom-with-plasmo-storage"

export type LanguageCode = "zh_CN" | "zh_TW" | "en"

export interface LanguageConfig {
  language: LanguageCode
}

export const languageConfigAtom = atomWithPlasmoStorage<LanguageConfig>(
  "languageConfig",
  {
    language: "zh_CN" // 默认语言为简体中文
  }
)
