// Background service worker for handling extension events

console.log("🚀 Clip Extension background service worker loading...")

// Handle extension icon click - open history page
chrome.action.onClicked.addListener(() => {
  console.log("🎯 Extension icon clicked, opening history page...")
  chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
    .then(() => console.log("✅ History tab created"))
    .catch((err) => console.error("❌ Failed to create tab:", err))
})

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📬 Message received:", request, "from:", sender.tab?.url)
  
  if (request.action === "openHistory") {
    console.log("📜 Opening history page via message...")
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
      .then(() => {
        console.log("✅ History tab created successfully")
        sendResponse({ success: true })
      })
      .catch((err) => {
        console.error("❌ Failed to create history tab:", err)
        sendResponse({ success: false, error: err.message })
      })
    return true // Keep channel open for async response
  }
  
  return false
})

// Handle keyboard shortcut (if configured in manifest)
// Only add listener if chrome.commands is available
if (chrome.commands) {
  chrome.commands.onCommand.addListener((command) => {
    console.log("⌨️ Keyboard command:", command)
    if (command === "open-history") {
      chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
    }
  })
} else {
  console.log("⚠️ chrome.commands API not available")
}

console.log("✅ Clip Extension background service worker loaded successfully")
