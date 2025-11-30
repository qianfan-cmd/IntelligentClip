chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setPopup({ popup: "" })
})

chrome.runtime.onStartup.addListener(async () => {
  await chrome.action.setPopup({ popup: "" })
})

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "clip:toggle-float" })
  } catch (e) {}
})
