const downloadUrlToDestinationPathMap = new Map(); // Map<downloadUrl, destinationFolderPath>

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'createDownload') { return; }

  // Store the mapping from download URL to destination folder path
  downloadUrlToDestinationPathMap.set(request.downloadUrl, request.destinationFolderPath);

  // Trigger the download by creating a new tab (this will trigger downloads.onCreated)
  browser.tabs.create({ url: request.downloadUrl, active: false }).then(tab => {
    console.log(`Created tab ${tab.id} for download. Associated with URL: ${request.downloadUrl}`);
  });
});

browser.downloads.onCreated.addListener((downloadItem) => {
  console.log(`Download created: ${downloadItem.id}, URL: ${downloadItem.url}, Filename: ${downloadItem.filename}`);

  // Check if this download URL is in our map
  if (!downloadUrlToDestinationPathMap.has(downloadItem.url)) { return; }

  const destinationFolderPath = downloadUrlToDestinationPathMap.get(downloadItem.url);
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
  // This part needs to be handled carefully, as downloadItem.tabId might not always be the tab we created.
  // For now, we'll assume the tab is closed by the browser after download, or we'll need a more robust tab tracking.
  // Removed setTimeout and browser.tabs.remove for now.
});
