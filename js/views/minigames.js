import { api, modalTemplate } from '../utils.js';
import { currentUser } from '../auth.js';
import { API_URL } from '../config.js';

let currentGames = [];
let selectedGames = new Set(); // Track selected items

export async function renderMiniGames() {
    if (!currentUser) return;
    const isSuperAdmin = currentUser.platformRole === 'SUPER_ADMIN';
    
    document.getElementById('app').innerHTML = '<div class="text-center mt-10">Loading Mini-Games...</div>';
    
    const data = await api('/minigames');
    if (!data) return;
    currentGames = data.data.games || [];
    selectedGames.clear(); // Reset selections on render

    const gamesHtml = currentGames.map(g => {
        const statusColor = g.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
        const expText = g.expiresAt ? `<span class="text-red-500 font-bold ml-2 text-xs">Expires < 1hr</span>` : '';
        
        return `
        <div class="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex justify-between items-start">
            <div class="flex items-start gap-4">
                ${isSuperAdmin ? `<input type="checkbox" class="game-checkbox w-5 h-5 mt-1 cursor-pointer" value="${g.id}" onchange="toggleGameSelection(this)">` : ''}
                <div>
                    <h3 class="font-bold text-lg text-gray-800">${g.name} <span class="text-xs px-2 py-1 rounded ml-2 ${statusColor}">${g.status}</span>${expText}</h3>
                    <p class="text-sm text-gray-500 mt-1">Difficulty: <span class="font-bold text-gray-700">${g.difficulty}</span> | Category: ${(g.category || []).join(', ')}</p>
                    ${isSuperAdmin ? `<p class="text-xs text-gray-400 mt-1">ID: ${g.gameId || g.id} | Points: ${g.points}</p>` : ''}
                </div>
            </div>
            <div class="flex flex-col gap-2">
                ${isSuperAdmin ? `
                    <button onclick="openEditModal('${g.id}')" class="bg-blue-50 text-blue-600 px-3 py-1 rounded text-sm font-bold border border-blue-200 hover:bg-blue-100 transition">Review / Edit</button>
                    <button onclick="generateJson('${g.id}')" class="bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-sm font-bold border border-indigo-200 hover:bg-indigo-100 transition">Quick JSON</button>
                ` : '<span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded text-center">Locked / Read Only</span>'}
            </div>
        </div>`;
    }).join('');

    document.getElementById('app').innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-2xl font-bold">Mini-Games</h1>
            <div class="flex gap-2 items-center">
                ${isSuperAdmin ? `
                    <button onclick="exportSelected()" class="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 transition font-bold">
                        Export Selected
                    </button>
                    <button onclick="scheduleDeleteSelected()" class="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition font-bold">
                        Delete Selected
                    </button>
                ` : ''}
                <button onclick="openCreateModal()" class="bg-slate-800 text-white px-4 py-2 rounded text-sm hover:bg-slate-900 transition font-bold">
                    + Submit Mini-Game
                </button>
            </div>
        </div>
        ${isSuperAdmin && currentGames.length > 0 ? `
        <div class="flex items-center gap-2 mb-4 bg-white p-3 rounded shadow-sm border border-gray-200">
            <input type="checkbox" id="selectAll" class="w-5 h-5 cursor-pointer" onchange="toggleAllGames(this)">
            <label for="selectAll" class="text-sm font-bold cursor-pointer">Select All Games</label>
        </div>
        ` : ''}
        <div class="flex flex-col gap-4">
            ${gamesHtml || '<p class="text-gray-500 text-center py-10">No mini-games found.</p>'}
        </div>
        <div id="minigame-modals"></div>
    `;

    setupModals(isSuperAdmin);
}

function setupModals(isSuperAdmin) {
    const adminFields = isSuperAdmin ? `
        <div class="border-t pt-4 mt-4">
            <h4 class="font-bold text-xs text-red-500 uppercase mb-3">Super Admin Overrides</h4>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Override Global ID</label><input type="text" name="gameId" id="mg-gameId" class="w-full border p-2 rounded text-sm"></div>
                <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Points</label><input type="number" name="points" id="mg-points" class="w-full border p-2 rounded text-sm"></div>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label><input type="datetime-local" name="startDate" id="mg-startDate" class="w-full border p-2 rounded text-sm"></div>
                <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">End Date</label><input type="datetime-local" name="endDate" id="mg-endDate" class="w-full border p-2 rounded text-sm"></div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Approval Status</label>
                <select name="status" id="mg-status" class="w-full border p-2 rounded text-sm bg-white">
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                </select>
            </div>
        </div>
    ` : '';

    document.getElementById('minigame-modals').innerHTML = modalTemplate('mg-modal', 'Mini-Game Details', `
        <form onsubmit="handleSaveMiniGame(event, ${isSuperAdmin})" class="overflow-y-auto max-h-[70vh] p-1">
            <input type="hidden" name="id" id="mg-id">
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                <input type="text" name="name" id="mg-name" class="w-full border p-2 rounded text-sm" required>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Category (comma separated)</label>
                    <input type="text" name="category" id="mg-category" placeholder="Cryptography, Web" class="w-full border p-2 rounded text-sm" required>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Difficulty</label>
                    <select name="difficulty" id="mg-difficulty" class="w-full border p-2 rounded text-sm bg-white">
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>
                </div>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Description (HTML allowed)</label>
                <textarea name="description" id="mg-description" class="w-full border p-2 rounded text-sm h-24" required></textarea>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Authors (Name, URL per line)</label>
                <textarea name="authors" id="mg-authors" placeholder="John Doe, https://github.com/john" class="w-full border p-2 rounded text-sm h-16"></textarea>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Flag</label>
                <input type="text" name="flag" id="mg-flag" placeholder="aurum{...}" class="w-full border p-2 rounded text-sm" required>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Assets (URLs, comma separated)</label>
                <input type="text" name="assets" id="mg-assets" class="w-full border p-2 rounded text-sm">
            </div>
            ${adminFields}
            <button type="submit" class="w-full bg-blue-600 text-white font-bold py-3 rounded mt-4 hover:bg-blue-700 transition">Save Mini-Game</button>
        </form>
    `);
}

window.openCreateModal = () => {
    document.getElementById('mg-id').value = '';
    document.getElementById('mg-name').value = '';
    document.getElementById('mg-category').value = '';
    document.getElementById('mg-description').value = '';
    document.getElementById('mg-authors').value = '';
    document.getElementById('mg-flag').value = '';
    document.getElementById('mg-assets').value = '';
    
    // Clear superadmin fields if they exist
    if (document.getElementById('mg-gameId')) {
        document.getElementById('mg-gameId').value = '';
        document.getElementById('mg-points').value = '';
        document.getElementById('mg-startDate').value = '';
        document.getElementById('mg-endDate').value = '';
        document.getElementById('mg-status').value = 'PENDING_APPROVAL';
    }
    window.openModal('mg-modal');
};

window.openEditModal = (id) => {
    const game = currentGames.find(g => g.id === id);
    if(!game) return;
    
    document.getElementById('mg-id').value = id;
    document.getElementById('mg-name').value = game.name || '';
    document.getElementById('mg-category').value = (game.category || []).join(', ');
    document.getElementById('mg-difficulty').value = game.difficulty || 'Easy';
    document.getElementById('mg-description').value = game.description || '';
    document.getElementById('mg-authors').value = (game.authors || []).map(a => `${a.name}, ${a.url}`).join('\n');
    document.getElementById('mg-flag').value = game.flag || '';
    document.getElementById('mg-assets').value = (game.assets || []).join(', ');
    
    if (document.getElementById('mg-gameId')) {
        document.getElementById('mg-gameId').value = game.gameId || '';
        document.getElementById('mg-points').value = game.points || '';
        document.getElementById('mg-startDate').value = game.startDate || '';
        document.getElementById('mg-endDate').value = game.endDate || '';
        document.getElementById('mg-status').value = game.status || 'PENDING_APPROVAL';
    }
    window.openModal('mg-modal');
};

window.handleSaveMiniGame = async (e, isSuperAdmin) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = fd.get('id');
    
    const rawAuthors = fd.get('authors').split('\n').filter(l => l.trim() !== '');
    const authors = rawAuthors.map(line => {
        const parts = line.split(',');
        return { name: parts[0]?.trim() || '', url: parts[1]?.trim() || '' };
    });

    const body = {
        name: fd.get('name'),
        category: fd.get('category'),
        difficulty: fd.get('difficulty'),
        description: fd.get('description'),
        authors: authors,
        flag: fd.get('flag'),
        assets: fd.get('assets'),
    };

    if (isSuperAdmin) {
        body.gameId = fd.get('gameId');
        body.points = fd.get('points');
        body.startDate = fd.get('startDate');
        body.endDate = fd.get('endDate');
        body.status = fd.get('status');
    }

    try {
        if (id) {
            await api(`/minigames/${id}`, 'PUT', body);
        } else {
            await api('/minigames', 'POST', body);
        }
        window.closeModal('mg-modal');
        renderMiniGames();
    } catch(err) {
        alert("Failed to save: " + err.message);
    }
};

window.generateJson = (id) => {
    const game = currentGames.find(g => g.id === id);
    if(!game) return;

    const exportJson = {
        id: game.gameId || game.id,
        name: game.name,
        category: game.category || [],
        difficulty: game.difficulty,
        authors: game.authors || [],
        description: game.description,
        hints: [],
        flags: [game.flag],
        assets: game.assets || [],
        deployment: { type: "static" }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportJson, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${exportJson.id}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
};

window.toggleGameSelection = (cb) => {
    if (cb.checked) selectedGames.add(cb.value);
    else selectedGames.delete(cb.value);
};

window.toggleAllGames = (cb) => {
    const checkboxes = document.querySelectorAll('.game-checkbox');
    checkboxes.forEach(c => {
        c.checked = cb.checked;
        if (cb.checked) selectedGames.add(c.value);
        else selectedGames.delete(c.value);
    });
};

window.exportSelected = async () => {
    const ids = Array.from(selectedGames);
    if (ids.length === 0) return alert('Select at least one game to export.');

    const btn = document.querySelector('button[onclick="exportSelected()"]');
    const origText = btn.innerText;
    btn.innerText = "Exporting...";
    btn.disabled = true;

    try {
        // Use the standardized api() function since backend now returns JSON
        const res = await api('/minigames/export', 'POST', { ids });

        if (!res || !res.success) throw new Error(res?.error || "Export failed.");

        // Convert the Base64 string back into binary data
        const byteCharacters = atob(res.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/zip' });

        // Trigger the download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || 'minigames-export.zip';
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        alert(e.message);
    } finally {
        btn.innerText = origText;
        btn.disabled = false;
    }
};

window.scheduleDeleteSelected = async () => {
    const ids = Array.from(selectedGames);
    if (ids.length === 0) return alert('Select at least one game to delete.');
    if (!confirm('This will mark the selected games for deletion in 1 hour. Proceed?')) return;

    const res = await api('/minigames/batch-delete', 'POST', { ids });
    if (res && res.success) {
        alert(res.message);
        renderMiniGames(); // Refresh the view to reflect TTL statuses
    } else {
        alert(res?.error || 'Failed to schedule deletion.');
    }
};