import { sendToBackground } from "@plasmohq/messaging"

/**
 * Comparison function used to sort tracks by priority
 */
function compareTracks(track1, track2) {
  const langCode1 = track1.languageCode
  const langCode2 = track2.languageCode

  if (langCode1 === "en" && langCode2 !== "en") {
    return -1 // English comes first
  } else if (langCode1 !== "en" && langCode2 === "en") {
    return 1 // English comes first
  } else if (track1.kind !== "asr" && track2.kind === "asr") {
    return -1 // Non-ASR comes first
  } else if (track1.kind === "asr" && track2.kind !== "asr") {
    return 1 // Non-ASR comes first
  }

  return 0 // Preserve order if both have same priority
}

/**
 * Strategy 0: Extract transcript from DOM (Most reliable method)
 * This method reads already-rendered transcript segments from the page
 * Inspired by: YouTube Transcript Copier extension
 */
async function extractTranscriptFromDOM(): Promise<any> {
  console.log("📄 Strategy 0: Attempting to extract transcript from DOM...")
  
  try {
    // Helper function to check for transcript button with retries
    const checkTranscriptButton = async (attempt = 0): Promise<HTMLElement | null> => {
      const transcriptSelectors = [
        "ytd-video-description-transcript-section-renderer button",
        "button[aria-label*='transcript' i]",
        "button[aria-label*='transcrição' i]",
        "button[aria-label*='transcripción' i]",
        "[aria-label*='Show transcript' i]"
      ]
      
      let button = null
      for (const selector of transcriptSelectors) {
        button = document.querySelector(selector)
        if (button) {
          console.log(`✅ Found transcript button with selector: ${selector}`)
          return button as HTMLElement
        }
      }

      if (attempt < 10) {
        console.log(`⏳ Transcript button check attempt ${attempt + 1}/10`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        return checkTranscriptButton(attempt + 1)
      }
      
      return null
    }

    const transcriptButton = await checkTranscriptButton()
    
    if (transcriptButton && !document.querySelector("ytd-transcript-segment-renderer")) {
      console.log("🖱️ Clicking transcript button to open panel...")
      transcriptButton.click()
      
      // Wait for transcript panel to load with polling
      const waitForContent = async (attempt = 0): Promise<boolean> => {
        const segmentSelectors = [
          "ytd-transcript-segment-renderer",
          ".ytd-transcript-segment-renderer"
        ]
        
        for (const selector of segmentSelectors) {
          if (document.querySelector(selector)) {
            return true
          }
        }

        if (attempt < 10) { // Wait up to 5 seconds (10 * 500ms)
          await new Promise(resolve => setTimeout(resolve, 500))
          return waitForContent(attempt + 1)
        }
        return false
      }

      await waitForContent()
    }
    
    // Now extract the transcript segments
    const segmentSelectors = [
      "ytd-transcript-segment-renderer",
      ".ytd-transcript-segment-renderer"
    ]
    
    let transcriptItems = []
    for (const selector of segmentSelectors) {
      transcriptItems = Array.from(document.querySelectorAll(selector))
      if (transcriptItems.length > 0) {
        console.log(`✅ Found ${transcriptItems.length} transcript segments`)
        break
      }
    }
    
    if (transcriptItems.length === 0) {
      console.warn("⚠️ No transcript segments found in DOM")
      return null
    }
    
    // Parse segments into our expected format
    const events = []
    let lastTimestamp = 0
    
    for (const segment of transcriptItems) {
      const textElement = segment.querySelector("[class*='segment-text']") || 
                         segment.querySelector("#content") ||
                         segment.querySelector("#text") ||
                         segment.querySelector("yt-formatted-string")
      
      const timestampElement = segment.querySelector("[class*='segment-timestamp']") ||
                              segment.querySelector("#timestamp") ||
                              segment.querySelector(".segment-timestamp")
      
      const text = textElement ? textElement.textContent.trim() : ''
      const timestampStr = timestampElement ? timestampElement.textContent.trim() : ''
      
      if (!text) continue
      
      // Parse timestamp (format: "0:00", "1:23", "1:23:45")
      let tStartMs = lastTimestamp
      if (timestampStr) {
        const parts = timestampStr.split(':').map(p => parseInt(p) || 0)
        if (parts.length === 2) {
          // MM:SS
          tStartMs = (parts[0] * 60 + parts[1]) * 1000
        } else if (parts.length === 3) {
          // HH:MM:SS
          tStartMs = ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000
        }
        lastTimestamp = tStartMs
      }
      
      events.push({
        tStartMs: tStartMs,
        dDurationMs: 3000, // Default duration
        segs: [{ utf8: text }]
      })
    }
    
    if (events.length > 0) {
      console.log(`✅ Successfully extracted ${events.length} transcript events from DOM`)
      return { events }
    }
    
    return null
  } catch (error) {
    console.warn("⚠️ DOM extraction failed:", error.message)
    return null
  }
}

/**
 * Inject script into page context to read ytInitialPlayerResponse AND fetch captions
 * This is necessary because content scripts run in an isolated environment
 * and cannot directly access page variables
 */
function injectPageScript(fetchCaptions = false, captionUrl = null): Promise<any> {
  return new Promise((resolve, reject) => {
    const messageId = `youtube-data-${Date.now()}`
    
    const messageHandler = (event: MessageEvent) => {
      if (event.source !== window) return
      if (event.data?.messageId === messageId) {
        window.removeEventListener("message", messageHandler)
        if (event.data.error) {
          reject(new Error(event.data.error))
        } else {
          resolve(event.data)
        }
      }
    }
    
    window.addEventListener("message", messageHandler)
    
    const script = document.createElement("script")
    script.textContent = `
      (function() {
        try {
          const playerResponse = window.ytInitialPlayerResponse;
          if (!playerResponse) {
            window.postMessage({
              messageId: "${messageId}",
              error: "ytInitialPlayerResponse not found"
            }, "*");
            return;
          }
          
          // If we need to fetch captions from page context (to use page's cookies/auth)
          if (${fetchCaptions} && "${captionUrl}") {
            fetch("${captionUrl}")
              .then(res => res.ok ? res.text() : Promise.reject('HTTP ' + res.status))
              .then(captionData => {
                window.postMessage({
                  messageId: "${messageId}",
                  playerResponse: playerResponse,
                  captionData: captionData
                }, "*");
              })
              .catch(err => {
                // Still send player response even if caption fetch fails
                window.postMessage({
                  messageId: "${messageId}",
                  playerResponse: playerResponse,
                  captionError: err.toString()
                }, "*");
              });
          } else {
            window.postMessage({
              messageId: "${messageId}",
              playerResponse: playerResponse
            }, "*");
          }
        } catch (e) {
          window.postMessage({
            messageId: "${messageId}",
            error: e.message
          }, "*");
        }
      })();
    `
    document.documentElement.appendChild(script)
    script.remove()
    
    // Timeout after 10 seconds (increased for caption fetching)
    setTimeout(() => {
      window.removeEventListener("message", messageHandler)
      reject(new Error("Timeout waiting for player response"))
    }, 10000)
  })
}

/**
 * Helper function to fetch with retry logic
 * Addresses issues with temporary network glitches or empty responses
 */
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<string | null> {
  for (let i = 0; i < retries; i++) {
    try {
      // Use background script to fetch to avoid CORS and header issues
      // The background script has host permissions for all URLs
      const response = await sendToBackground({
        name: "fetch-transcript",
        body: {
          captionUrl: url
        }
      })
      
      if (response && response.success && response.data) {
        return response.data
      }
      
      console.warn(`⚠️ Attempt ${i + 1}: Background fetch failed - ${response?.error || 'Unknown error'}`)
    } catch (error) {
      console.warn(`⚠️ Attempt ${i + 1}: Communication error - ${error.message}`)
    }
    
    if (i < retries - 1) {
      console.log(`⏳ Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  return null
}

export async function getVideoData(id: string) {
  console.log("🔍 Getting video data for:", id)
  
  try {
    let player = null;

    // Method 1: Fetch page HTML and extract ytInitialPlayerResponse (Recommended)
    // This method is reliable even when ads are playing because it fetches fresh data
    console.log("🌐 Method 1: Fetching video page HTML...")
    try {
      const response = await fetch(`https://www.youtube.com/watch?v=${id}`);
      const html = await response.text();
      
      const splitStr = 'var ytInitialPlayerResponse =';
      if (html.includes(splitStr)) {
        const jsonStr = html.split(splitStr)[1].split(';var')[0];
        player = JSON.parse(jsonStr);
        
        // Verify we got the correct video (not an ad)
        if (player.videoDetails?.videoId === id) {
          console.log("✅ Successfully extracted player data from HTML (video ID verified)")
        } else {
          console.warn("⚠️ Video ID mismatch in HTML response, expected:", id, "got:", player.videoDetails?.videoId)
          // Still use it as it should be correct from direct fetch
        }
      } else {
        console.warn("⚠️ ytInitialPlayerResponse not found in HTML")
      }
    } catch (e) {
      console.warn("⚠️ Method 1 failed:", e.message)
    }

    // Method 2: Inject script (Fallback) - but verify video ID
    if (!player || !player.videoDetails) {
      console.log("💉 Method 2: Injecting script to read player data...")
      try {
        const response = await injectPageScript(false, null)
        const injectedPlayer = response.playerResponse
        
        // Check if we're currently showing an ad
        if (injectedPlayer?.videoDetails?.videoId !== id) {
          console.warn("⚠️ Page context has different video ID (possibly ad playing)")
          console.warn("   Expected:", id, "Got:", injectedPlayer?.videoDetails?.videoId)
          
          // Wait a bit and retry - ads usually have a different video ID
          console.log("⏳ Waiting for ad to finish or retrying fetch...")
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Try fetching from HTML again
          const response2 = await fetch(`https://www.youtube.com/watch?v=${id}`);
          const html2 = await response2.text();
          const splitStr = 'var ytInitialPlayerResponse =';
          if (html2.includes(splitStr)) {
            const jsonStr = html2.split(splitStr)[1].split(';var')[0];
            player = JSON.parse(jsonStr);
            console.log("✅ Got correct video data from retry fetch")
          }
        } else {
          player = injectedPlayer
          console.log("✅ Got player response from page context (video ID verified)")
        }
      } catch (e) {
        console.warn("⚠️ Method 2 failed:", e.message)
      }
    }

    // Method 3: Use YouTube's oEmbed API as a last resort for metadata
    if (!player || !player.videoDetails) {
      console.log("🔗 Method 3: Trying oEmbed API for basic metadata...")
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
        const oembedResponse = await fetch(oembedUrl)
        if (oembedResponse.ok) {
          const oembedData = await oembedResponse.json()
          // Create a minimal player object
          player = {
            videoDetails: {
              videoId: id,
              title: oembedData.title,
              author: oembedData.author_name,
              lengthSeconds: "0",
              viewCount: "0"
            }
          }
          console.log("✅ Got basic metadata from oEmbed API")
        }
      } catch (e) {
        console.warn("⚠️ Method 3 failed:", e.message)
      }
    }

    if (!player || !player.videoDetails) {
      console.error("❌ Invalid player data")
      return {
        metadata: {
          title: "Error: Could not load video data",
          duration: "0",
          author: "Unknown",
          views: "0"
        },
        transcript: null
      }
    }

    // Extract metadata
    const metadata = {
      title: player.videoDetails.title,
      duration: player.videoDetails.lengthSeconds,
      author: player.videoDetails.author,
      views: player.videoDetails.viewCount
    }

    console.log("📝 Metadata:", metadata)
    console.log("🎤 Captions available:", !!player.captions)
    console.log("🎤 Caption tracks:", player.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length || 0)

    // Check if captions are available
    if (!player.captions || !player.captions.playerCaptionsTracklistRenderer) {
      console.warn("⚠️ No captions found for this video")
      return { metadata, transcript: null }
    }

    const tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks
    if (!tracks || tracks.length === 0) {
      console.warn("⚠️ No caption tracks available")
      return { metadata, transcript: null }
    }

    console.log("📜 Found", tracks.length, "caption track(s)")
    console.log("📜 Track details:", tracks.map(t => ({ 
      lang: t.languageCode, 
      name: t.name?.simpleText, 
      kind: t.kind 
    })))
    
    // Sort tracks by priority (English, non-ASR first)
    tracks.sort(compareTracks)
    const selectedTrack = tracks[0]
    
    console.log("✅ Selected track:", {
      lang: selectedTrack.languageCode,
      name: selectedTrack.name?.simpleText,
      kind: selectedTrack.kind
    })

    // Wait for DOM to update to the new video ID
    const waitForDOMToUpdate = async (videoId: string, maxAttempts = 20): Promise<void> => {
      console.log(`⏳ Waiting for DOM to update to video ${videoId}...`)
      for (let i = 0; i < maxAttempts; i++) {
        const currentVideoId = document.querySelector('ytd-watch-flexy')?.getAttribute('video-id')
        if (currentVideoId === videoId) {
          console.log("✅ DOM updated to new video")
          return
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      console.warn("⚠️ Timeout waiting for DOM update, proceeding anyway...")
    }

    await waitForDOMToUpdate(id)

    // Only use Strategy 0: Extract transcript from DOM
    const domTranscript = await extractTranscriptFromDOM()
    if (domTranscript && domTranscript.events && domTranscript.events.length > 0) {
      console.log("✅ Successfully extracted transcript from DOM (Strategy 0)")
      return { metadata, transcript: domTranscript }
    }

    console.warn("⚠️ Strategy 0 did not yield transcript. Skipping other strategies by request.")
    return { metadata, transcript: null }
    
  } catch (error) {
    console.error("❌ Error in getVideoData:", error.message)
    console.error("Stack trace:", error.stack)
    
    return {
      metadata: {
        title: "Error loading video",
        duration: "0",
        author: "Unknown",
        views: "0"
      },
      transcript: null
    }
  }
}

export function cleanJsonTranscript(transcript) {
  const chunks = []
  let currentChunk = ""
  let currentStartTime = transcript.events[0].tStartMs
  let currentEndTime = currentStartTime

  transcript.events.forEach((event) => {
    event.segs?.forEach((seg) => {
      const segmentText = seg.utf8.replace(/\n/g, " ")
      currentEndTime = event.tStartMs + (seg.tOffsetMs || 0)
      if ((currentChunk + segmentText).length > 300) {
        chunks.push({
          text: currentChunk.trim(),
          startTime: currentStartTime,
          endTime: currentEndTime
        })
        currentChunk = segmentText
        currentStartTime = currentEndTime
      } else {
        currentChunk += segmentText
      }
    })
  })

  if (currentChunk) {
    chunks.push({
      text: currentChunk.trim(),
      startTime: currentStartTime,
      endTime: currentEndTime
    })
  }

  return chunks
}

export function cleanTextTranscript(transcript) {
  // Initialize variables to hold lines of text and temporary segment text
  let textLines = []
  let tempText = ""
  let lastTime = 0

  // Loop through each event in the transcript
  transcript.events.forEach((event) => {
    // Check if there's a significant gap (5 seconds or more) between events
    if (event.tStartMs - lastTime > 5000 && tempText) {
      textLines.push(tempText.trim())
      tempText = ""
    }

    // Process each segment in the current event
    event.segs?.forEach((seg) => {
      const currentText = seg.utf8

      // If we're at the start of a new sentence (capital letter) and tempText is not empty, push it to textLines
      if (/^[A-Z]/.test(currentText) && tempText) {
        textLines.push(tempText.trim())
        tempText = currentText
      } else {
        // Otherwise, accumulate the text in tempText
        tempText += currentText
      }
    })

    // Update the last event time
    lastTime = event.tStartMs
  })

  // Push any remaining accumulated text to textLines
  if (tempText) {
    textLines.push(tempText.trim())
  }

  return textLines.join("\n")
}
