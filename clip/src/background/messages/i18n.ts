import type { PlasmoMessaging } from "@plasmohq/messaging"
import { getMessage, getUserLanguage, loadLanguageFile } from "@/lib/i18n"
import type { LanguageCode } from "@/lib/atoms/language"

/**
 * Background script handler for internationalization requests
 * This allows content scripts to access the current language and translations
 */
type I18nAction = 
  | "get-language"
  | "get-message"
  | "get-translations"

interface I18nRequest {
  action: I18nAction
  payload?: any
}

interface I18nResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

const handler: PlasmoMessaging.MessageHandler<I18nRequest, I18nResponse> = async (req, res) => {
  const { action, payload } = req.body || {} as I18nRequest
  
  if (!action) {
    res.send({ success: false, error: "Missing action" })
    return
  }
  
  try {
    let result: any
    
    switch (action) {
      case "get-language": {
        // 获取当前语言
        const language = await getUserLanguage()
        result = language
        break
      }
      
      case "get-message": {
        // 获取单个翻译文本
        const { messageName } = payload
        if (!messageName) {
          throw new Error("Missing messageName")
        }
        const translation = await getMessage(messageName)
        result = translation
        break
      }
      
      case "get-translations": {
        // 获取当前语言的所有翻译
        const language = await getUserLanguage()
        const translations = await loadLanguageFile(language)
        result = { language, translations }
        break
      }
      
      default:
        throw new Error(`Unknown action: ${action}`)
    }
    
    res.send({ success: true, data: result })
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[I18nHandler] Error in ${action}:`, errorMessage)
    res.send({ success: false, error: errorMessage })
  }
}

export default handler