async function createPathInputDialog(classroomId, classroomName) {
  return new Promise(async (resolve, reject) => {
    // Remove existing dialog if any
    const existingDialog = document.getElementById('gct-path-dialog');
    if (existingDialog) { 
      console.warn("Path input dialog already open.");
      return reject(new Error("Dialog already open."));
    }

    const dialog = document.createElement('div');
    dialog.id = 'gct-path-dialog';
    dialog.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background-color: rgba(0,0,0,0.5); z-index: 9999; display: flex;
      align-items: center; justify-content: center;
    `;

    const dialogContent = document.createElement('div');
    dialogContent.style.cssText = `
      background: white; padding: 20px; border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    `;

    dialogContent.innerHTML = `
      <h3>Set Download Path for Classroom</h3>
      <p><b>Classroom:</b> ${classroomName} (ID: ${classroomId})</p>
      <p>Enter the absolute path for downloads in this classroom:</p>
      <input type="text" id="${PATH_INPUT_ID}" style="width: 300px; margin-bottom: 10px;">
      <button id="${SAVE_BUTTON_ID}">Save</button>
      <button id="${CANCEL_BUTTON_ID}">Cancel</button>
    `;

    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);

    const pathInput = document.getElementById(PATH_INPUT_ID);
    const saveButton = document.getElementById(SAVE_BUTTON_ID);
    const cancelButton = document.getElementById(CANCEL_BUTTON_ID);

    // Fetch existing path or default path
    const data = await browser.storage.local.get(CLASSROOM_PATHS_STORAGE_KEY);
    const paths = data[CLASSROOM_PATHS_STORAGE_KEY] || {};
    let currentPath = paths[classroomId] ? paths[classroomId].path : '';

    if (!currentPath) {
      const defaultPathData = await browser.storage.local.get(DEFAULT_DOWNLOAD_PATH_STORAGE_KEY);
      currentPath = defaultPathData[DEFAULT_DOWNLOAD_PATH_STORAGE_KEY] || '';
    }
    pathInput.value = currentPath;

    // Auto-focus the input field
    pathInput.focus();

    // Add Enter key submission
    pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveButton.click();
      }
    });

    cancelButton.addEventListener('click', () => {
      dialog.remove();
      reject(new Error('Dialog cancelled'));
    });

    saveButton.addEventListener('click', async () => {
      const path = pathInput.value.trim();
      if (!path) {
        // Optionally, show an error message in the dialog itself
        alert('Path cannot be empty.');
        return; // Early return if path is empty
      }

      const data = await browser.storage.local.get(CLASSROOM_PATHS_STORAGE_KEY);
      const paths = data[CLASSROOM_PATHS_STORAGE_KEY] || {};
      
      // Store name and path as an object
      paths[classroomId] = { name: classroomName, path: path };
      
      await browser.storage.local.set({ [CLASSROOM_PATHS_STORAGE_KEY]: paths });
      
      dialog.remove();
      resolve(path); // Resolve with the saved path
    });
  });
}