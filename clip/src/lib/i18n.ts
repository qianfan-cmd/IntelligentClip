// 自定义国际化工具，用于支持动态语言切换

import { LanguageCode } from "./atoms/language";

// 语言文件缓存
const languageCache: Record<string, Record<string, string>> = {};

// 获取用户选择的语言
async function getUserLanguage(): Promise<LanguageCode> {
  const stored = await chrome.storage.local.get(["preferredLocale", "languageConfig"]);
  
  // 优先使用 languageConfig 中的语言设置
  if (stored.languageConfig && stored.languageConfig.language) {
    return stored.languageConfig.language as LanguageCode;
  }
  
  // 兼容旧的 preferredLocale 设置
  if (stored.preferredLocale) {
    return stored.preferredLocale as LanguageCode;
  }
  
  // 默认使用简体中文
  return "zh_CN";
}

// 加载语言文件
async function loadLanguageFile(languageCode: LanguageCode): Promise<Record<string, string>> {
  // 如果语言文件已经在缓存中，直接返回
  if (languageCache[languageCode]) {
    return languageCache[languageCode];
  }

  try {
    // 加载语言文件
    //content script不能用fetch，能用chorome.runtime.sendMessage
    //const response = await fetch(chrome.runtime.getURL(`_locales/${languageCode}/messages.json`));
    
    const res = await chrome.runtime.sendMessage({
      type: "GET_LOCALE",
      lang: languageCode
    })

    //如果响应无效，且当前请求的不是简体中文时，尝试请求简体中文；如果失败则返回空对象，不再递归
    if (!res.ok || !res.data) {
      if (languageCode !== 'zh_CN') {
        const fallback = await chrome.runtime.sendMessage({
          type: "GET_LOCALE",
          lang: "zh_CN"
        });
        if (fallback?.ok || fallback.data) {
          const translations: Record<string, string> = {};
          for (const key in fallback.data) {
            const v = fallback.data[key]?.message;
            if (typeof v === 'string') translations[key] = v;
          }
          languageCache['zh_CN'] = translations;//缓存语言
          return translations;
        }
      }
      throw new Error(`Failed to load language file for ${languageCode}`);
    }

    //响应成功，解析数据
    const languageData = res.data;
    // 构建翻译映射
    const translations: Record<string, string> = {};
    for (const key in languageData) {
      const v = languageData[key]?.message;
      if (typeof v === "string") {
        translations[key] = v;
      }
    }

    // 缓存语言文件
    languageCache[languageCode] = translations;
    return translations;
  } catch (error) {
    console.log(`Failed to load language file for ${languageCode}:`, error);
    //console.error(`Failed to load language file for ${languageCode}:`, error);
    // 如果加载失败，返回默认语言（简体中文）
    // if (languageCode !== 'zh_CN') {
    //   return loadLanguageFile("zh_CN");
    // }
    //throw error;
  }
}

// 自定义 getMessage 函数
async function getMessage(messageName: string): Promise<string> {
  try {
    // 获取用户选择的语言
    const language = await getUserLanguage();
    
    // 加载相应的语言文件
    const translations = await loadLanguageFile(language);
    
    // 返回翻译文本，如果没有找到则使用默认的 chrome.i18n.getMessage()
    return translations[messageName] || chrome.i18n.getMessage(messageName) || messageName;
  } catch (error) {
    console.error(`Failed to get message ${messageName}:`, error);
    // 如果出错，使用默认的 chrome.i18n.getMessage()
    return chrome.i18n.getMessage(messageName) || messageName;
  }
}

// 立即执行函数，预加载默认语言
(async () => {
  const defaultLanguage = await getUserLanguage();
  await loadLanguageFile(defaultLanguage);
})();

export { getMessage, getUserLanguage, loadLanguageFile };
