const tabToClassroomMap = new Map(); // Map<tabId, classroomId>

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openTab') {
    browser.tabs.create({ url: request.url, active: false }).then(tab => {
      console.log(`Created tab ${tab.id} for download. Associating with classroomId: ${request.classroomId}`);
      if (request.classroomId) {
        tabToClassroomMap.set(tab.id, request.classroomId);
      }
    });
  }
});

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    console.log(`webRequest.onHeadersReceived for tab ${details.tabId}. URL: ${details.url}`);
    if (tabToClassroomMap.has(details.tabId)) {
      const contentDispositionHeader = details.responseHeaders.find(
        header => header.name.toLowerCase() === 'content-disposition'
      );

      if (contentDispositionHeader && contentDispositionHeader.value.toLowerCase().includes('attachment')) {
        const classroomId = tabToClassroomMap.get(details.tabId);
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

        // Get the full destination path from storage
        browser.storage.local.get(CLASSROOM_PATHS_STORAGE_KEY).then(data => {
          const classroomPaths = data.classroomPaths || {};
          const classroomInfo = classroomPaths[classroomId]; // This is the object {name, path}

          if (classroomInfo && classroomInfo.path) { // Check if object and path property exist
            const fullDestinationPath = `${classroomInfo.path}/${filename}`; // Use classroomInfo.path

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

          } else {
            console.error(`Base path not found for classroom ID: ${classroomId}. Cannot send to daemon.`);
          }
        });

        // Clean up and close the tab
        tabToClassroomMap.delete(details.tabId);
        setTimeout(() => {
          browser.tabs.remove(details.tabId);
        }, 1500);
      }
    }
  },
  { urls: ["*://drive.usercontent.google.com/*"] },
  ["responseHeaders"]
);