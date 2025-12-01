chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setPopup({ popup: "popup.html" })
})

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "clip:open-history") {
    const historyUrl = chrome.runtime.getURL("tabs/history.html")
    const targetUrl = historyUrl + (msg.clipId ? `?id=${msg.clipId}` : "")
    
    // Query all tabs and manually filter to be robust
    const tabs = await chrome.tabs.query({})
    const existingTab = tabs.find(tab => tab.url && tab.url.startsWith(historyUrl))

    if (existingTab && existingTab.id) {
      // Update URL and activate existing tab
      await chrome.tabs.update(existingTab.id, { url: targetUrl, active: true })
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true })
      }
    } else {
      // Create new tab
      chrome.tabs.create({ url: targetUrl })
    }
  }
  if (msg.type === "clip:open-options") {
    chrome.runtime.openOptionsPage()
  }
})
