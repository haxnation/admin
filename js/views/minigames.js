import { api, modalTemplate, escapeHtml } from '../utils.js';
import { currentUser } from '../auth.js';
import { API_URL } from '../config.js';

let currentGames = [];
let selectedGames = new Set();

export async function renderMiniGames() {
    if (!currentUser) return;
    const isSuperAdmin = currentUser.platformRole === 'SUPER_ADMIN';
    
    document.getElementById('app').innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 gap-4 font-mono">
            <div class="w-10 h-10 bg-ink border-4 border-cyan shadow-[4px_4px_0_0_#5ce1e6] animate-[spin_1s_steps(4)_infinite]"></div>
            <p class="text-xs uppercase font-bold text-ink tracking-widest animate-pulse">[ LOADING MINI-GAMES... ]</p>
        </div>
    `;
    
    const data = await api('/minigames');
    if (!data) return;
    currentGames = data.data.games || [];
    selectedGames.clear();

    const gamesHtml = currentGames.map(g => {
        const statusBadge = g.status === 'APPROVED' ? '<span class="badge bg-success text-ink">APPROVED</span>' : '<span class="badge bg-warning text-ink">PENDING</span>';
        const expText = g.expiresAt ? `<span class="bg-danger text-white border border-ink text-[10px] font-mono font-bold px-1.5 py-0.5 ml-2 shadow-[1px_1px_0_0_#0b0b0b]">Expires &lt; 1hr</span>` : '';
        
        return `
        <div class="bg-white border-2 border-ink p-5 shadow-[4px_4px_0_0_#0b0b0b] flex flex-col sm:flex-row justify-between items-start gap-4 font-mono">
            <div class="flex items-start gap-4">
                ${isSuperAdmin ? `<input type="checkbox" class="game-checkbox w-5 h-5 mt-1 accent-cyan border-2 border-ink cursor-pointer" value="${escapeHtml(g.id)}" onchange="toggleGameSelection(this)" aria-label="Select ${escapeHtml(g.name)}">` : ''}
                <div>
                    <h3 class="font-black text-lg text-ink uppercase flex items-center flex-wrap gap-2">
                        ${escapeHtml(g.name)} 
                        ${statusBadge}
                        ${expText}
                    </h3>
                    <div class="text-xs font-semibold text-neutral-700 mt-2 flex flex-wrap gap-2 items-center">
                        <span class="bg-canvas border border-ink/40 px-2 py-0.5 font-bold">Diff: ${escapeHtml(g.difficulty)}</span>
                        <span class="bg-canvas border border-ink/40 px-2 py-0.5 font-bold">Cat: ${escapeHtml((g.category || []).join(', '))}</span>
                        ${isSuperAdmin ? `<span class="bg-cyan/20 text-ink border border-ink/40 px-2 py-0.5 font-bold">Pts: ${escapeHtml(g.points || 0)}</span>` : ''}
                    </div>
                    ${isSuperAdmin ? `<p class="text-[11px] text-neutral-500 font-mono mt-1.5 select-all">ID: ${escapeHtml(g.gameId || g.id)}</p>` : ''}
                </div>
            </div>
            <div class="flex flex-wrap sm:flex-col gap-2 w-full sm:w-auto justify-end">
                ${isSuperAdmin ? `
                    <button onclick="openEditModal('${escapeHtml(g.id)}')" class="btn-secondary !text-xs !px-3 !py-1.5">
                        <i class="fas fa-edit mr-1"></i> Review / Edit
                    </button>
                    <button onclick="generateJson('${escapeHtml(g.id)}')" class="btn-secondary !text-xs !px-3 !py-1.5">
                        <i class="fas fa-file-code mr-1"></i> Quick JSON
                    </button>
                ` : '<span class="text-xs font-bold text-neutral-500 bg-canvas border border-ink px-2.5 py-1">Read Only</span>'}
            </div>
        </div>`;
    }).join('');

    document.getElementById('app').innerHTML = `
        <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-4 border-ink pb-6 font-mono">
            <div>
                <p class="text-xs uppercase tracking-widest text-ink font-bold mb-1">[ MODULE: MINIGAMES REPOSITORY ]</p>
                <h1 class="text-3xl sm:text-5xl font-black tracking-tighter uppercase leading-none text-ink">
                    Mini-Games<span class="inline-block w-3 h-[0.7em] bg-cyan animate-pulse align-baseline ml-2"></span>
                </h1>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                ${isSuperAdmin ? `
                    <button onclick="exportSelected()" class="btn-secondary">
                        <i class="fas fa-file-archive mr-1"></i> Export Selected
                    </button>
                    <button onclick="scheduleDeleteSelected()" class="btn-danger">
                        <i class="fas fa-trash mr-1"></i> Delete Selected
                    </button>
                ` : ''}
                <button onclick="openCreateModal()" class="btn-primary">
                    <i class="fas fa-plus mr-1"></i> Submit Mini-Game
                </button>
            </div>
        </div>

        ${isSuperAdmin && currentGames.length > 0 ? `
        <div class="flex items-center gap-3 mb-6 bg-white p-4 border-2 border-ink shadow-[3px_3px_0_0_#0b0b0b] font-mono">
            <input type="checkbox" id="selectAll" class="w-5 h-5 accent-cyan border-2 border-ink cursor-pointer" onchange="toggleAllGames(this)">
            <label for="selectAll" class="text-xs uppercase font-bold text-ink cursor-pointer select-none">Select All Mini-Games</label>
        </div>
        ` : ''}

        <div class="flex flex-col gap-4 font-mono">
            ${gamesHtml || '<div class="card-static text-center py-12 font-mono font-bold uppercase text-neutral-600">No mini-games found.</div>'}
        </div>
        <div id="minigame-modals"></div>
    `;

    setupModals(isSuperAdmin);
}

function setupModals(isSuperAdmin) {
    const adminFields = isSuperAdmin ? `
        <div class="border-2 border-ink bg-yellow-50/70 p-4 mt-4 font-mono shadow-[2px_2px_0_0_#0b0b0b]">
            <h4 class="font-black text-xs text-ink uppercase mb-3 flex items-center gap-1.5">
                <span class="w-2 h-2 bg-warning border border-ink"></span> SuperAdmin Overrides
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div><label class="label">Override Global ID</label><input type="text" name="gameId" id="mg-gameId" class="input !p-2 text-xs"></div>
                <div><label class="label">Points</label><input type="number" name="points" id="mg-points" class="input !p-2 text-xs"></div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div><label class="label">Start Date</label><input type="datetime-local" name="startDate" id="mg-startDate" class="input !p-2 text-xs"></div>
                <div><label class="label">End Date</label><input type="datetime-local" name="endDate" id="mg-endDate" class="input !p-2 text-xs"></div>
            </div>
            <div>
                <label class="label">Approval Status</label>
                <select name="status" id="mg-status" class="input bg-white !p-2 text-xs font-bold">
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                </select>
            </div>
        </div>
    ` : '';

    document.getElementById('minigame-modals').innerHTML = modalTemplate('mg-modal', 'Mini-Game Details', `
        <form onsubmit="handleSaveMiniGame(event, ${isSuperAdmin})" class="space-y-4 font-mono text-xs">
            <input type="hidden" name="id" id="mg-id">
            <div>
                <label class="label" for="mg-name">Name</label>
                <input type="text" name="name" id="mg-name" class="input" required>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="label" for="mg-category">Category (comma separated)</label>
                    <input type="text" name="category" id="mg-category" placeholder="Cryptography, Web" class="input" required>
                </div>
                <div>
                    <label class="label" for="mg-difficulty">Difficulty</label>
                    <select name="difficulty" id="mg-difficulty" class="input bg-white">
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="label" for="mg-description">Description (HTML allowed)</label>
                <textarea name="description" id="mg-description" class="input h-24" required></textarea>
            </div>
            <div>
                <label class="label" for="mg-authors">Authors (Name, URL per line)</label>
                <textarea name="authors" id="mg-authors" placeholder="John Doe, https://github.com/john" class="input h-16"></textarea>
            </div>
            <div>
                <label class="label" for="mg-flag">Flag</label>
                <input type="text" name="flag" id="mg-flag" placeholder="aurum{...}" class="input" required>
            </div>
            <div>
                <label class="label" for="mg-assets">Assets (URLs, comma separated)</label>
                <input type="text" name="assets" id="mg-assets" class="input">
            </div>
            ${adminFields}
            <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                <button type="button" onclick="closeModal('mg-modal')" class="btn-secondary">Cancel</button>
                <button type="submit" class="btn-primary">Save Mini-Game</button>
            </div>
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
        const res = await api('/minigames/export', 'POST', { ids });

        if (!res || !res.success) throw new Error(res?.error || "Export failed.");

        const byteCharacters = atob(res.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/zip' });

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
        renderMiniGames();
    } else {
        alert(res?.error || 'Failed to schedule deletion.');
    }
};