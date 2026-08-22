import { api, modalTemplate, escapeHtml } from '../utils.js';

let state = {
    applications: [],
    communities: []
};

export async function renderB2BAdmin() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 gap-4 font-mono">
            <div class="w-10 h-10 bg-ink border-4 border-cyan shadow-[4px_4px_0_0_#5ce1e6] animate-[spin_1s_steps(4)_infinite]"></div>
            <p class="text-xs uppercase font-bold text-ink tracking-widest animate-pulse">[ LOADING B2B CONSOLE... ]</p>
        </div>`;

    await loadData();

    app.innerHTML = `
        <div class="mb-8 border-b-4 border-ink pb-6 font-mono">
            <p class="text-xs uppercase tracking-widest text-ink font-bold mb-1">[ SUPERADMIN CONSOLE ]</p>
            <h1 class="text-3xl sm:text-5xl font-black tracking-tighter uppercase leading-none text-ink">
                B2B Management<span class="inline-block w-3 h-[0.7em] bg-cyan animate-pulse align-baseline ml-2"></span>
            </h1>
            <p class="text-xs text-neutral-700 font-bold mt-2">Manage enterprise API applications and override community credit quotas.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 font-mono">
            <div class="bg-white border-2 border-ink p-6 shadow-[6px_6px_0_0_#0b0b0b]">
                <div class="flex items-center gap-2 border-b-2 border-ink pb-3 mb-4">
                    <div class="w-2.5 h-2.5 bg-warning border border-ink"></div>
                    <h2 class="font-black text-sm uppercase text-ink">Pending Applications (${state.applications.length})</h2>
                </div>
                <div class="space-y-3" id="applications-list">
                    ${renderApplications()}
                </div>
            </div>

            <div class="bg-white border-2 border-ink p-6 shadow-[6px_6px_0_0_#0b0b0b]">
                <div class="flex items-center gap-2 border-b-2 border-ink pb-3 mb-4">
                    <div class="w-2.5 h-2.5 bg-success border border-ink"></div>
                    <h2 class="font-black text-sm uppercase text-ink">Approved Communities (${state.communities.length})</h2>
                </div>
                <div class="space-y-3" id="approved-communities-list">
                    ${renderApproved()}
                </div>
            </div>
        </div>
    `;

    const modals = document.getElementById('modals');
    modals.innerHTML = `
        ${modalTemplate('override-credits-modal', 'Override Community Credits', `
            <form id="override-credits-form" class="space-y-4 font-mono text-xs">
                <input type="hidden" id="override-community-id">
                <div>
                    <label class="label" for="override-quantity">Adjust Credits (Add/Remove)</label>
                    <input type="number" id="override-quantity" class="input" required placeholder="e.g. 500 or -100">
                    <p class="text-[11px] text-neutral-600 mt-1 font-bold">Enter a positive number to add credits, or negative to deduct.</p>
                </div>
                <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                    <button type="button" onclick="closeModal('override-credits-modal')" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">Update Credits</button>
                </div>
            </form>
        `)}
    `;

    setupListeners();
}

async function loadData() {
    try {
        const [appRes, commRes] = await Promise.all([
            api('/b2b/applications'),
            api('/b2b/communities')
        ]);
        
        state.applications = appRes?.data || [];
        state.communities = commRes?.data || [];
    } catch (e) {
        console.error("Failed to load B2B data:", e);
    }
}

function renderApplications() {
    if (state.applications.length === 0) return `<div class="card-static text-center py-8 font-mono text-xs font-bold uppercase text-neutral-500">No pending applications.</div>`;

    return state.applications.map(app => `
        <div class="border-2 border-ink p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-canvas shadow-[3px_3px_0_0_#0b0b0b]">
            <div>
                <p class="font-black text-sm text-ink uppercase">${escapeHtml(app.name)}</p>
                <p class="text-[11px] text-neutral-600 font-mono mt-0.5 font-bold">ID: ${escapeHtml(app.id)}</p>
            </div>
            <div class="flex gap-2 w-full sm:w-auto justify-end">
                <button onclick="window.updateB2BStatus('${escapeHtml(app.id)}', 'APPROVED')" class="btn-primary !text-xs !px-3 !py-1">
                    <i class="fas fa-check mr-1"></i> Approve
                </button>
                <button onclick="window.updateB2BStatus('${escapeHtml(app.id)}', 'REJECTED')" class="btn-danger !text-xs !px-3 !py-1">
                    <i class="fas fa-times mr-1"></i> Reject
                </button>
            </div>
        </div>
    `).join('');
}

function renderApproved() {
    if (state.communities.length === 0) return `<div class="card-static text-center py-8 font-mono text-xs font-bold uppercase text-neutral-500">No approved communities.</div>`;

    return state.communities.map(comm => `
        <div class="border-2 border-ink p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white shadow-[3px_3px_0_0_#0b0b0b]">
            <div>
                <p class="font-black text-sm text-ink uppercase">${escapeHtml(comm.name)}</p>
                <p class="text-[11px] text-neutral-600 font-mono mb-2 font-bold">ID: ${escapeHtml(comm.id)}</p>
                <span class="badge bg-cyan text-ink">Credits: ${escapeHtml(comm.credits || 0)}</span>
            </div>
            <div class="flex flex-wrap sm:flex-col gap-2 w-full sm:w-auto justify-end">
                <button onclick="window.openOverrideCredits('${escapeHtml(comm.id)}')" class="btn-secondary !text-xs !px-3 !py-1 whitespace-nowrap">
                    <i class="fas fa-coins mr-1"></i> Manage Credits
                </button>
                <button onclick="window.updateB2BStatus('${escapeHtml(comm.id)}', 'REVOKED')" class="btn-danger !text-xs !px-3 !py-1">
                    <i class="fas fa-ban mr-1"></i> Revoke Access
                </button>
            </div>
        </div>
    `).join('');
}

function setupListeners() {
    const form = document.getElementById('override-credits-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cid = document.getElementById('override-community-id').value;
            const quantity = parseInt(document.getElementById('override-quantity').value);

            if (!cid || isNaN(quantity)) return;

            const res = await api(`/b2b/communities/${cid}/credits`, 'POST', { quantity });
            if (res && res.success) {
                window.closeModal('override-credits-modal');
                renderB2BAdmin();
            } else {
                alert(res?.error || 'Failed to update credits');
            }
        });
    }
}

window.updateB2BStatus = async (cid, status) => {
    if (status === 'REVOKED' && !confirm("Are you sure you want to revoke this community's B2B access? API integrations will stop working.")) return;
    
    const res = await api(`/b2b/communities/${cid}/status`, 'PUT', { status });
    if (res && res.success) {
        renderB2BAdmin();
    } else {
        alert(res?.error || 'Failed to update status');
    }
};

window.openOverrideCredits = (cid) => {
    document.getElementById('override-community-id').value = cid;
    document.getElementById('override-quantity').value = '';
    window.openModal('override-credits-modal');
};

