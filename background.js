const downloadUrlToDestinationPathMap = new Map(); // Map<downloadUrl, {destinationFolderPath, tabId}>

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'createDownload') { return; }

  // Store the mapping from download URL to destination folder path and tabId
  browser.tabs.create({ url: request.downloadUrl, active: false }).then(tab => {
    console.log(`Created tab ${tab.id} for download. Associated with URL: ${request.downloadUrl}`);
    downloadUrlToDestinationPathMap.set(request.downloadUrl, { destinationFolderPath: request.destinationFolderPath, tabId: tab.id });
  });
});

browser.downloads.onCreated.addListener((downloadItem) => {
  console.log(`Download created: ${downloadItem.id}, URL: ${downloadItem.url}, Filename: ${downloadItem.filename}`);

  // Check if this download URL is in our map
  if (!downloadUrlToDestinationPathMap.has(downloadItem.url)) { return; }

  const storedData = downloadUrlToDestinationPathMap.get(downloadItem.url);
  const destinationFolderPath = storedData.destinationFolderPath;
  const tabId = storedData.tabId;

  const fullFilenamePath = downloadItem.filename; // This is the full path from Firefox

  // Extract just the base filename from the full path
  const baseFilename = fullFilenamePath.substring(fullFilenamePath.lastIndexOf('/') + 1);

  const fullDestinationPath = `${destinationFolderPath}/${baseFilename}`;

  console.log('File download detected! Sending info to daemon on download start.');
  console.log(`Sending to daemon: filename=${fullFilenamePath}, fullDestinationPath=${fullDestinationPath}`);
  try {
    const port = browser.runtime.connectNative("gct_download_manager");
    port.postMessage({
      filename: fullFilenamePath,
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

  // Clean up the map entry
  downloadUrlToDestinationPathMap.delete(downloadItem.url);

  // Close the tab associated with the download if it was opened by us
  browser.tabs.remove(tabId);
});