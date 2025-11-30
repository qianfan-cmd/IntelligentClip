chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setPopup({ popup: "popup.html" })
})
