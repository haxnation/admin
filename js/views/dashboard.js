import { api, modalTemplate } from '../utils.js';
import { currentUser } from '../auth.js';

export async function renderDashboard() {
    if (!currentUser) return;
    document.getElementById('app').innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 gap-4">
            <div class="w-10 h-10 bg-ink border-4 border-cyan shadow-[4px_4px_0_0_#5ce1e6] animate-[spin_1s_steps(4)_infinite]"></div>
            <p class="font-mono text-xs uppercase font-bold text-ink tracking-widest animate-pulse">[ LOADING DASHBOARD... ]</p>
        </div>
    `;
    
    const data = await api('/dashboard');
    if (!data) return;

    const communities = data.data.communities || [];
    const isSuperAdmin = currentUser.platformRole === 'SUPER_ADMIN';

    const listHtml = communities.map(c => `
        <a href="#/community/${c.PK.split('#')[1]}" class="card flex flex-col justify-between group block">
            <div>
                <div class="flex items-start justify-between gap-3 mb-2">
                    <h3 class="font-mono font-black text-xl text-ink uppercase tracking-tight group-hover:text-cyan transition-colors">
                        ${c.name}
                    </h3>
                    <i class="fas fa-chevron-right text-ink/40 group-hover:text-ink group-hover:translate-x-1 transition-all mt-1"></i>
                </div>
                <div class="font-mono text-xs font-bold text-neutral-700 bg-canvas border border-ink/40 px-2 py-1 inline-block">
                    ID: ${c.PK.split('#')[1]}
                </div>
            </div>
            
            <div class="mt-6 pt-4 border-t-2 border-ink flex items-center justify-between">
                <div>
                    ${c.features?.posts ? '<span class="bg-success text-ink border-2 border-ink text-[10px] font-mono font-bold px-2 py-0.5 uppercase shadow-[2px_2px_0_0_#0b0b0b]">Posts Enabled</span>' : '<span class="bg-canvas text-neutral-600 border border-ink/40 text-[10px] font-mono font-bold px-2 py-0.5 uppercase">Standard</span>'}
                </div>
                <span class="font-mono text-xs font-bold uppercase text-ink underline group-hover:text-cyan transition-colors">Manage →</span>
            </div>
        </a>
    `).join('');

    document.getElementById('app').innerHTML = `
        <div class="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-4 border-ink pb-6">
            <div>
                <p class="font-mono text-xs uppercase tracking-widest text-ink font-bold mb-1">[ PLATFORM STATUS: ONLINE ]</p>
                <h1 class="text-4xl sm:text-6xl font-black tracking-tighter uppercase leading-none text-ink font-mono">
                    Dashboard<span class="inline-block w-3 h-[0.7em] bg-cyan animate-pulse align-baseline ml-2"></span>
                </h1>
            </div>
            ${isSuperAdmin ? `
                <button onclick="openModal('create-community')" class="btn-primary">
                    <i class="fas fa-plus"></i> New Community
                </button>
            ` : ''}
        </div>

        <div class="mb-6">
            <h2 class="font-mono text-sm font-bold uppercase tracking-widest text-ink mb-4 flex items-center gap-2">
                <span class="w-3 h-3 bg-ink inline-block"></span> Communities (${communities.length})
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${listHtml || '<div class="col-span-full card-static text-center py-12 font-mono text-sm font-bold uppercase text-neutral-600">No communities found.</div>'}
            </div>
        </div>

        ${modalTemplate('create-community', 'Create New Community', `
            <form onsubmit="handleCreateCommunity(event)" class="space-y-4">
                <div>
                    <label class="label" for="comm-name">Community Name</label>
                    <input type="text" id="comm-name" name="name" placeholder="e.g. Mumbai Chapter" class="input" required>
                </div>
                <div>
                    <label class="label" for="comm-owner">Owner User ID</label>
                    <input type="text" id="comm-owner" name="ownerId" placeholder="e.g. user_abc123" class="input" required>
                    <p class="font-mono text-[11px] text-neutral-600 mt-1 font-semibold">User ID of the designated community manager.</p>
                </div>
                <div class="bg-canvas border-2 border-ink p-3 my-4">
                    <label class="flex items-center gap-3 cursor-pointer font-mono text-xs font-bold uppercase text-ink">
                        <input type="checkbox" name="postFeature" class="w-4 h-4 accent-cyan border-2 border-ink"> 
                        Enable Social Posts Module
                    </label>
                    <p class="font-mono text-[10px] text-neutral-600 ml-7 mt-1">Allows community managers to publish and schedule updates.</p>
                </div>
                <div class="pt-2 flex justify-end gap-3 border-t-2 border-ink">
                    <button type="button" onclick="closeModal('create-community')" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">Create Community</button>
                </div>
            </form>
        `)}
    `;
}

// Handler
async function handleCreateCommunity(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { name: fd.get('name'), ownerId: fd.get('ownerId'), postFeature: fd.get('postFeature') === 'on' };
    const res = await api('/community', 'POST', body);
    if (res && res.success !== false) {
        window.closeModal('create-community');
        renderDashboard();
    } else {
        alert(res?.error || 'Failed to create community');
    }
}

window.handleCreateCommunity = handleCreateCommunity;