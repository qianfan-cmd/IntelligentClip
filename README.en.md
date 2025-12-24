# Clip Plugin - Intelligent Clipping & AI Assistant Extension

This is a Chrome browser extension developed with the Plasmo framework, integrating web clipping, screenshot annotation, AI summarization/conversation, and content management features. The plugin's core functionality revolves around two axes: "convenient clipping + AI empowerment". When browsing web pages, users can trigger the clipping function with one click without switching software or copying/pasting, allowing them to accurately capture target content—whether it's key text, important images, complete paragraphs, or complex page fragments with multiple layers of links. All content is saved as-is to the plugin's local library, with support for personalized operations such as custom selection, highlighting key points, and adding personal notes to ensure clipped content meets individual needs.

## 🛠 Tech Stack

- **Framework**: [Plasmo](https://docs.plasmo.com/) (React + TypeScript) - A modern framework designed specifically for browser extension development.
- **UI Libraries**:
  - [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework.
  - [Radix UI](https://www.radix-ui.com/) / [Shadcn UI](https://ui.shadcn.com/) - Headless component libraries providing high-quality accessible components.
  - [React Icons](https://react-icons.github.io/react-icons/) - Icon library.
- **State Management**:
  - [Jotai](https://jotai.org/) - Atomic state management (for global configurations like API keys).
  - React Context - Component-level state sharing.
- **AI Integration**: OpenAI API (proxy requests via Background Service Worker).
- **Build Tool**: Parcel (built into Plasmo).

## 🏗 Software Architecture

The project adopts the typical Chrome Extension MV3 (Manifest V3) architecture, divided into **Content Scripts (UI Layer)**, **Background (Business Logic Layer)**, and **Popup/Options (Configuration Layer)**.

### 1. Core Module Division

#### A. Content Scripts Layer - `src/contents/`
Responsible for injecting UI into target web pages and interacting directly with the DOM.
- **SidebarFloatPanel.tsx**: Core interaction panel. Includes clipped history list, AI chat window, dark mode toggle, and other features. Uses Shadow DOM for style isolation.
- **screenshot-overlay.tsx**: Screenshot functionality module. Provides area selection, automatic DOM element snapping, annotation, and saving features.
- **floatBtn.tsx**: Floating trigger button, offering a quick entry to evoke the panel.
- **selection-clipper.tsx**: Listens for user-selected text and provides a shortcut to "send to AI for interpretation".

#### B. Core Logic Layer - `src/core/`
Uses the **Strategy Pattern** to handle content extraction from different types of web pages.
- **Extractors**: General extractors (e.g., `readability.ts`) for extracting main content from regular web pages.
- **Handlers**: Site-specific processors (`src/core/handlers/`):
  - `bilibili.ts`: Extracts Bilibili video information and subtitles.
  - `youtube.ts`: Extracts YouTube video metadata.
  - `baike.ts`: Optimizations for encyclopedia-style websites.
- **Index**: The `extractContent` function automatically routes to the corresponding Handler based on the URL.

#### C. Background Service Layer - `src/background/`
Handles cross-domain requests, AI conversation flows, context menus, and message routing.
- **Ports (`src/background/ports/`)**: Uses Plasmo's Port API for long connections (primarily for AI streaming conversations).
  - `chat.ts`: Manages OpenAI conversation context and handles streaming responses.
- **Messages (`src/background/messages/`)**: Processes one-time asynchronous requests (e.g., fetching video subtitles).

#### D. Data Storage Layer - `src/lib/`
- **ClipStore (`src/lib/clip-store.ts`)**: Wraps `chrome.storage.local` to provide CRUD interfaces for Clip objects.
- **Atoms (`src/lib/atoms/`)**: Defines Jotai Atoms for persisting user configurations (e.g., OpenAI Key, Feishu settings).

### 2. Data Flow

1. **User Interaction**: User inputs a query in `SidebarFloatPanel` or clicks the screenshot button.
2. **Message Delivery**:
   - **Short Messages**: UI sends commands (e.g., screenshot, save) via `chrome.runtime.sendMessage`.
   - **Long Connections**: AI conversations establish streaming communication via `port.postMessage`.
3. **Processing & Response**:
   - `Background` receives messages, calls the OpenAI API, or executes complex logic.
   - Results are returned to the UI via Message or Port.
4. **State Update**: UI receives data to update React State, or listens to `chrome.storage.onChanged` for automatic data refresh.

## 📂 Directory Structure

```
src/
├── background/         # Service Worker logic
│   ├── messages/       # One-time message handlers
│   └── ports/          # Long-connection (AI Chat) handlers
├── components/         # React components
│   ├── ui/             # Basic UI components (Button, Input, etc.)
│   └── ...             # Business components (Chat, Transcript, etc.)
├── contents/           # Content Scripts (UI injected into pages)
│   ├── SidebarFloatPanel.tsx  # Sidebar main panel
│   ├── screenshot-overlay.tsx # Screenshot overlay
│   └── ...
├── contexts/           # React Contexts
├── core/               # Core business logic
│   ├── extractors/     # General extractors
│   └── handlers/       # Site-specific adapters (Bilibili, YouTube)
├── lib/                # Utility library & storage
│   ├── atoms/          # Jotai state definitions
│   └── clip-store.ts   # Clipping data storage management
├── tabs/               # Standalone pages (e.g., history page)
└── style.css           # Global styles (Tailwind)
```

## ✨ Key Features

1. **Intelligent Clipping**: Automatically identifies page types (articles, videos) and extracts core content, metadata, and subtitles.
2. **AI Assistant**:
   - Context-aware: Answers questions based on current page content.
   - Multi-model support: Allows switching between different AI models.
3. **Advanced Screenshot**:
   - Automatic snapping: Intelligently recognizes web element boundaries.
   - Annotation & saving: Supports direct saving to the clipping library.
4. **Data Management**: Local storage with support for viewing history, searching, and exporting.
5. **Personalization**: Dark mode, interface dragging (simplified to fixed mode), and keyboard shortcut support.

## ☁️ Feishu Export Configuration
This plugin supports automatically syncing clipped content to Feishu Bitable (Base), enabling cloud-based data management. Please follow the steps below to complete the configuration:

1. Feishu Open Platform Settings
Go to the Feishu Open Platform, log in, click "Create App", and select "Custom App" (Enterprise Self-built App).

Enter the app details page. Go to "Permissions", search for and enable permissions related to Bitable (e.g., bitable:app:read and bitable:app:read_write).

Create and release an app version to make the permissions take effect.

On the "Credentials & Basic Info" page, copy the App ID and App Secret.

Open the plugin configuration page and enter these two values into the corresponding fields.

2. Bitable (Base) Document Settings
Create a new Bitable (Base) document in Feishu Docs.

Key Step: Click the "..." (More) button in the top right corner of the document -> "Add App". Search for the app created in Step 1 and add it as an Administrator for the document.

Get the Data Table Identifiers:

Table Token (App Token): Open the Bitable. In the browser URL, locate the string starting with base_ (e.g., bascnXXXXXXXX).

Table ID: Open the specific data table. In the browser URL, look for table=...&. Copy the content after the equals sign (=) and before the ampersand (&).

Enter the Table Token and Table ID into the plugin configuration page.

3. Finish Configuration
After saving all the above configurations, the plugin will be able to automatically write clipped content (Title, Link, Summary, Tags, etc.) to the specified Feishu data table via API.
