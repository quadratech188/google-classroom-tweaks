const tabToDestinationPathMap = new Map(); // Map<tabId, destinationFolderPath>

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'createDownload') { return; }

  browser.tabs.create({ url: request.downloadUrl, active: false }).then(tab => {
    console.log(`Created tab ${tab.id} for download. Associating with destinationFolderPath: ${request.destinationFolderPath}`);
    tabToDestinationPathMap.set(tab.id, request.destinationFolderPath);
  });
});

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    console.log(`webRequest.onHeadersReceived for tab ${details.tabId}. URL: ${details.url}`);
    if (!tabToDestinationPathMap.has(details.tabId)) { return; }

    const contentDispositionHeader = details.responseHeaders.find(
      header => header.name.toLowerCase() === 'content-disposition'
    );

    if (!contentDispositionHeader || !contentDispositionHeader.value.toLowerCase().includes('attachment')) { return; }

    const destinationFolderPath = tabToDestinationPathMap.get(details.tabId);
    const filenameMatch = contentDispositionHeader.value.match(/filename="([^"]+)"/);
    let filename = 'unknown_filename';
    if (filenameMatch) {
      const rawFilename = filenameMatch[1];
      try {
        filename = decodeURIComponent(rawFilename);
      } catch (e) {
        console.warn("decodeURIComponent failed, trying mojibake fix:", e);
        // Mojibake fix: assume it's UTF-8 interpreted as Latin-1
        try {
          filename = new TextDecoder('utf-8').decode(
            new Uint8Array(rawFilename.split('').map(char => char.charCodeAt(0)))
          );
        } catch (mojibakeError) {
          console.error("Mojibake fix failed:", mojibakeError);
          filename = rawFilename; // Fallback to raw if all else fails
        }
      }
    }

    const fullDestinationPath = `${destinationFolderPath}/${filename}`; // Use destinationFolderPath

    console.log('File download detected! Sending info to daemon on download start.');
    console.log(`Sending to daemon: filename=${filename}, fullDestinationPath=${fullDestinationPath}`);
    try {
      const port = browser.runtime.connectNative("gct_download_manager");
      port.postMessage({
        filename: filename,
        fullDestinationPath: fullDestinationPath
      });
      port.onMessage.addListener(response => {
        console.log("Daemon response:", response);
      });
      port.onDisconnect.addListener(() => {
        if (port.error) {
          console.error(`Native messaging disconnected: ${port.error.message}`);
        }
      });
    } catch (e) {
      console.error("Failed to connect to native app:", e);
    }

    // Clean up and close the tab - REMOVED FOR NOW
    tabToDestinationPathMap.delete(details.tabId);
    setTimeout(() => {
      browser.tabs.remove(details.tabId);
    }, 1500);
  },
  { urls: ["*://drive.usercontent.google.com/*"] },
  ["responseHeaders"]
);