import { api, modalTemplate } from '../utils.js';
import { currentUser } from '../auth.js';

function renderFeatureBadges(features) {
    if (!features) return '<span class="bg-canvas text-neutral-600 border border-ink/40 text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase">Base</span>';
    
    const badges = [];
    if (features.full_events) badges.push('<span class="bg-cyan text-ink border border-ink text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase shadow-[1px_1px_0_0_#0b0b0b]">Events</span>');
    if (features.posts) badges.push('<span class="bg-success text-ink border border-ink text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase shadow-[1px_1px_0_0_#0b0b0b]">Posts</span>');
    if (features.certificates) badges.push('<span class="bg-warning text-ink border border-ink text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase shadow-[1px_1px_0_0_#0b0b0b]">Certs</span>');
    if (features.api_access) badges.push('<span class="bg-ink text-cyan border border-ink text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase">API</span>');
    if (features.transactions) badges.push('<span class="bg-emerald-300 text-ink border border-ink text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase shadow-[1px_1px_0_0_#0b0b0b]">Rev</span>');
    if (features.ctf) badges.push('<span class="bg-purple-300 text-ink border border-ink text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase shadow-[1px_1px_0_0_#0b0b0b]">CTF</span>');
    if (features.display_on_main_site) badges.push('<span class="bg-blue-300 text-ink border border-ink text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase shadow-[1px_1px_0_0_#0b0b0b]">Listed</span>');

    return badges.length ? `<div class="flex flex-wrap gap-1">${badges.join('')}</div>` : '<span class="bg-canvas text-neutral-600 border border-ink/40 text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase">Base</span>';
}

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
            
            <div class="mt-6 pt-4 border-t-2 border-ink flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    ${renderFeatureBadges(c.features)}
                </div>
                <span class="font-mono text-xs font-bold uppercase text-ink underline group-hover:text-cyan transition-colors whitespace-nowrap self-end sm:self-auto">Manage →</span>
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
            <form onsubmit="handleCreateCommunity(event)" class="space-y-4 font-mono">
                <div>
                    <label class="label" for="comm-name">Community Name</label>
                    <input type="text" id="comm-name" name="name" placeholder="e.g. Mumbai Chapter" class="input" required>
                </div>
                <div>
                    <label class="label" for="comm-owner">Owner User ID</label>
                    <input type="text" id="comm-owner" name="ownerId" placeholder="e.g. user_abc123" class="input" required>
                    <p class="font-mono text-[11px] text-neutral-600 mt-1 font-semibold">User ID of the designated community manager.</p>
                </div>

                <div class="border-2 border-ink p-3 bg-canvas mt-4">
                    <div class="font-black text-xs uppercase text-ink mb-2 flex items-center gap-2">
                        <i class="fas fa-sliders-h text-cyan"></i> Feature Entitlements (RBAC)
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <label class="flex items-center gap-2 p-2 bg-white border border-ink cursor-pointer">
                            <input type="checkbox" name="feat_full_events" checked class="w-4 h-4 accent-cyan border-2 border-ink">
                            <span><b>Full Events</b> (Public/Tickets)</span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-white border border-ink cursor-pointer">
                            <input type="checkbox" name="feat_posts" checked class="w-4 h-4 accent-cyan border-2 border-ink">
                            <span><b>Social Posts</b></span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-white border border-ink cursor-pointer">
                            <input type="checkbox" name="feat_certificates" checked class="w-4 h-4 accent-cyan border-2 border-ink">
                            <span><b>Certificates Designer</b></span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-white border border-ink cursor-pointer">
                            <input type="checkbox" name="feat_api_access" class="w-4 h-4 accent-cyan border-2 border-ink">
                            <span><b>API Access &amp; Keys</b></span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-white border border-ink cursor-pointer">
                            <input type="checkbox" name="feat_transactions" class="w-4 h-4 accent-cyan border-2 border-ink">
                            <span><b>Revenue &amp; Ledgers</b></span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-white border border-ink cursor-pointer">
                            <input type="checkbox" name="feat_ctf" class="w-4 h-4 accent-cyan border-2 border-ink">
                            <span><b>CTF Challenges</b></span>
                        </label>
                        <label class="flex items-center gap-2 p-2 bg-white border border-ink cursor-pointer col-span-1 sm:col-span-2">
                            <input type="checkbox" name="feat_display_on_main_site" class="w-4 h-4 accent-cyan border-2 border-ink">
                            <span><b>List on Main Site</b> (Display events on haxnation.org)</span>
                        </label>
                    </div>
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
    const features = {
        full_events: fd.get('feat_full_events') === 'on',
        posts: fd.get('feat_posts') === 'on',
        certificates: fd.get('feat_certificates') === 'on',
        api_access: fd.get('feat_api_access') === 'on',
        transactions: fd.get('feat_transactions') === 'on',
        ctf: fd.get('feat_ctf') === 'on',
        display_on_main_site: fd.get('feat_display_on_main_site') === 'on',
    };
    const body = {
        name: fd.get('name'),
        ownerId: fd.get('ownerId'),
        features
    };
    const res = await api('/community', 'POST', body);
    if (res && res.success !== false) {
        window.closeModal('create-community');
        renderDashboard();
    } else {
        alert(res?.error || 'Failed to create community');
    }
}

window.handleCreateCommunity = handleCreateCommunity;