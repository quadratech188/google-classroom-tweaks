document.addEventListener('DOMContentLoaded', loadPopupSettings);

async function loadPopupSettings() {
    const classroomInfoDiv = document.getElementById('classroom-info');
    const pathEditorDiv = document.getElementById('path-editor');
    const noClassroomMessageDiv = document.getElementById('no-classroom-message');
    const errorMessage = document.getElementById('error-message');
    const infoMessage = document.getElementById('info-message');
    const newPathInput = document.getElementById('new-path-input');
    const savePathBtn = document.getElementById('save-path-btn');

    errorMessage.textContent = '';
    infoMessage.textContent = '';

    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        let classroomId = null;
        const urlMatch = currentTab.url.match(/classroom\.google\.com\/(u\/\d+\/)?c\/([a-zA-Z0-9_-]+)/);
        if (urlMatch) {
            classroomId = urlMatch[2]; // The actual ID is in the second capturing group
        }

        if (classroomId) {
            const data = await browser.storage.local.get(CLASSROOM_PATHS_STORAGE_KEY);
            const paths = data[CLASSROOM_PATHS_STORAGE_KEY] || {};
            const entry = paths[classroomId];

            let classroomName = 'Unknown Name';
            let currentPath = 'Not set';

            // Request classroom name from content script
            try {
                const response = await browser.tabs.sendMessage(currentTab.id, { action: 'getClassroomName' });
                if (response && response.name) {
                    classroomName = response.name;
                }
            } catch (e) {
                console.warn("Could not get classroom name from content script:", e);
            }

            if (entry) {
                // If name is already in storage, use it. Otherwise, use the one from content script.
                classroomName = entry.name || classroomName;
                currentPath = entry.path;
            }
            // If classroomId is found in URL but not in storage, classroomName remains 'Unknown Name' and currentPath 'Not set'

            document.getElementById('classroom-id').textContent = classroomId;
            document.getElementById('classroom-name').textContent = classroomName;
            document.getElementById('current-path').textContent = currentPath;

            // Show editor, hide no-classroom message
            classroomInfoDiv.style.display = 'block';
            pathEditorDiv.style.display = 'block';
            noClassroomMessageDiv.style.display = 'none';

            try {
                const savedPath = await createPathInputDialog(classroomId, classroomName, currentPath);
                infoMessage.textContent = 'Path saved!';
                document.getElementById('current-path').textContent = savedPath;
            } catch (error) {
                console.log(`Dialog cancelled or error: ${error.message}`);
                errorMessage.textContent = 'Path not saved.';
            }

        } else {
            // No classroom ID found in URL
            classroomInfoDiv.style.display = 'none';
            pathEditorDiv.style.display = 'none';
            noClassroomMessageDiv.style.display = 'block';
        }

    } catch (e) {
        console.error("Error in popup.js:", e);
        errorMessage.textContent = 'An error occurred.';
        classroomInfoDiv.style.display = 'none';
        pathEditorDiv.style.display = 'none';
        noClassroomMessageDiv.style.display = 'block';
    }
}