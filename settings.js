document.addEventListener('DOMContentLoaded', loadSettings);

async function loadSettings() {
    const data = await browser.storage.local.get([CLASSROOM_PATHS_STORAGE_KEY, DEFAULT_DOWNLOAD_PATH_STORAGE_KEY]);
    const paths = data[CLASSROOM_PATHS_STORAGE_KEY] || {};
    const defaultPath = data[DEFAULT_DOWNLOAD_PATH_STORAGE_KEY] || '';

    renderClassroomList(paths);
    document.getElementById('default-path-input').value = defaultPath; // Set default path input value
}

function renderClassroomList(paths) {
    const listContainer = document.getElementById('classroom-paths-list');
    listContainer.innerHTML = ''; // Clear existing list

    const classroomIds = Object.keys(paths);
    if (classroomIds.length === 0) {
        listContainer.innerHTML = '<p id="no-classrooms">No classrooms configured yet.</p>';
        return;
    }

    classroomIds.forEach(classroomId => {
        const entry = paths[classroomId];
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('classroom-entry');
        entryDiv.dataset.id = classroomId; // Add data-id to the entry div

        entryDiv.innerHTML = `
            <div class="name">${entry.name || 'Unknown Name'}</div>
            <div class="id">ID: ${classroomId}</div>
            <div class="path-display">Path: <span class="editable-path">${entry.path}</span></div>
            <div class="actions">
                <button data-id="${classroomId}" class="edit-btn">Edit</button>
                <button data-id="${classroomId}" class="delete-btn">Delete</button>
            </div>
        `;
        listContainer.appendChild(entryDiv);
    });

    // Add event listeners for edit and delete buttons
    listContainer.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', handleEditClick);
    });
    listContainer.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDeleteClick);
    });
}

async function handleEditClick(event) {
    const classroomId = event.target.dataset.id;
    const entryDiv = event.target.closest('.classroom-entry');
    const pathDisplaySpan = entryDiv.querySelector('.editable-path');
    const currentPath = pathDisplaySpan.textContent;
    const classroomName = entryDiv.querySelector('.name').textContent; // Get name from display

    try {
        const savedPath = await createPathInputDialog(classroomId, classroomName, currentPath);
        // If dialog resolves, it means path was saved, so reload settings
        console.log(`Path edited for ${classroomId} (${classroomName}). New path: ${savedPath}`);
        loadSettings();
    } catch (error) {
        console.log(`Edit dialog cancelled or error: ${error.message}`);
        loadSettings(); // Reload to revert any temporary UI changes
    }
}

async function handleDeleteClick(event) {
    const classroomId = event.target.dataset.id;
    // No confirmation dialog as per user request
    const data = await browser.storage.local.get(CLASSROOM_PATHS_STORAGE_KEY);
    const paths = data[CLASSROOM_PATHS_STORAGE_KEY] || {};
    delete paths[classroomId];
    await browser.storage.local.set({ [CLASSROOM_PATHS_STORAGE_KEY]: paths });
    loadSettings(); // Reload list
}

// Manual Save/Update Logic - now handled by createPathInputDialog
document.getElementById('add-classroom-btn').addEventListener('click', async () => {
    try {
        // Pass empty strings for ID and Name to signify a new entry
        const savedPath = await createPathInputDialog('', '', '');
        console.log(`New classroom added/edited. Path: ${savedPath}`);
        loadSettings();
    } catch (error) {
        console.log(`Add dialog cancelled or error: ${error.message}`);
        loadSettings(); // Reload to revert any temporary UI changes
    }
});


// New Default Path Save Logic
const defaultPathInput = document.getElementById('default-path-input');
const saveDefaultPathButton = document.getElementById('save-default-path');

saveDefaultPathButton.addEventListener('click', async () => {
    const path = defaultPathInput.value.trim();
    await browser.storage.local.set({ [DEFAULT_DOWNLOAD_PATH_STORAGE_KEY]: path });
    alert('Default path saved!');
});

defaultPathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveDefaultPathButton.click();
    }
});