import React from "react"
import { History, Settings, BookOpen } from "lucide-react"
import "./style.css"

function IndexPopup() {
  const openHistoryPage = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
  }

  return (
    <div className="w-80 p-4 bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100">
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-1">📚 Clip Extension</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Smart content clipper with AI
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={openHistoryPage}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-left group"
        >
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
            <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Clip History</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              View all your saved clips
            </div>
          </div>
        </button>

        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-left group"
        >
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
            <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Settings</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Configure your preferences
            </div>
          </div>
        </button>

        <a
          href="https://github.com/your-repo"
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-left group"
        >
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
            <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <div className="font-medium">Documentation</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Learn how to use
            </div>
          </div>
        </a>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
        <p className="text-xs text-center text-gray-400">
          Version 0.0.1 • Made with ❤️
        </p>
      </div>
    </div>
  )
}

export default IndexPopup

