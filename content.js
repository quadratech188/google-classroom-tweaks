function transformGoogleDriveUrl(originalUrlString) {
  try {
    const originalUrl = new URL(originalUrlString);
    if (originalUrl.hostname !== 'drive.google.com') { return originalUrlString; }
    const pathParts = originalUrl.pathname.split('/');
    const fileIdIndex = pathParts.indexOf('d');
    if (fileIdIndex === -1 || fileIdIndex + 1 >= pathParts.length) { return originalUrlString; }
    const fileId = pathParts[fileIdIndex + 1];
    const authUser = originalUrl.searchParams.get('authuser');
    let newUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
    if (authUser) { newUrl += `&authuser=${authUser}`; }
    return newUrl;
  } catch (e) {
    console.error("Error transforming URL:", e);
    return originalUrlString;
  }
}

function get_classroom_name() {
  const nameElement = document.getElementById('UGb2Qe'); // Use the provided ID
  if (!nameElement) { return 'Unknown Classroom'; }
  return nameElement.textContent.trim();
}

// showPathDialog function is removed and replaced by createPathInputDialog from common_ui.js

function triggerDownload(downloadUrl, destinationFolderPath) {
  browser.runtime.sendMessage({
    action: 'createDownload',
    downloadUrl: downloadUrl,
    destinationFolderPath: destinationFolderPath
  });
}

async function onDownloadClick(downloadUrl, classroomId) {
  const data = await browser.storage.local.get(CLASSROOM_PATHS_STORAGE_KEY);
  const paths = data[CLASSROOM_PATHS_STORAGE_KEY] || {};

  // Get classroom name here, as it's needed for the dialog
  const classroomName = get_classroom_name();

  if (paths[classroomId] && paths[classroomId].path) { // Check if path exists in the object
    console.log(`Path found for ${classroomId} (${paths[classroomId].name}). Triggering download.`);
    triggerDownload(downloadUrl, paths[classroomId].path); // Use stored path
    return;
  }

  console.log(`Path not found for ${classroomId}. Showing dialog.`);
  try {
    // Call the common UI function to create and manage the dialog
    const savedPath = await createPathInputDialog(classroomId, classroomName);
    // If dialog resolves, it means path was saved, so retry download
    console.log(`Dialog resolved with path: ${savedPath}. Retrying download.`);
    triggerDownload(downloadUrl, savedPath); // Use saved path
  } catch (error) {
    console.log(`Dialog cancelled or error: ${error.message}`);
    // Do not trigger download if dialog was cancelled
  }
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

function processPage() {
  const containers = document.querySelectorAll('div.luto0c:not(.has-download-button)');
  containers.forEach(container => {
    container.classList.add('has-download-button');
    const link = container.querySelector('a.VkhHKd.e7EEH.nQaZq');
    if (!link) { return; }

    const button = document.createElement('button');
    button.textContent = 'Download';
    button.classList.add('my-custom-button');

    button.addEventListener('click', () => {
      const downloadUrl = transformGoogleDriveUrl(link.href);
      const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
      const classroomId = match ? match[1] : null;
      if (classroomId) {
        onDownloadClick(downloadUrl, classroomId);
      }
    });
    container.appendChild(button);
  });
}

const debouncedProcessPage = debounce(processPage, 100);
const observer = new MutationObserver(() => { debouncedProcessPage(); });
observer.observe(document.body, { childList: true, subtree: true, attributes: true });
processPage();

// Listener for messages from popup.js
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'getClassroomName') { return; }
  const name = get_classroom_name();
  sendResponse({ name: name });
});