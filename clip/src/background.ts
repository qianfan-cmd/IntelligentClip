chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setPopup({ popup: "popup.html" })
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "clip:open-history") {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
  }
  if (msg.type === "clip:open-options") {
    chrome.runtime.openOptionsPage()
  }
})
