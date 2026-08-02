import { api, modalTemplate } from '../utils.js';

let state = {
    applications: [],
    communities: []
};

export async function renderB2BAdmin() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mx-auto"></div>';

    await loadData();

    app.innerHTML = `
        <div class="mb-6 border-b pb-4">
            <h1 class="text-3xl font-bold text-gray-800">SuperAdmin: B2B Management</h1>
            <p class="text-sm text-gray-500">Manage B2B API applications and Community Credits</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="bg-white rounded-xl shadow border border-gray-200 p-5">
                <h2 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Pending Applications</h2>
                <div class="space-y-3" id="applications-list">
                    ${renderApplications()}
                </div>
            </div>

            <div class="bg-white rounded-xl shadow border border-gray-200 p-5">
                <h2 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Approved Communities</h2>
                <div class="space-y-3" id="approved-communities-list">
                    ${renderApproved()}
                </div>
            </div>
        </div>
    `;

    const modals = document.getElementById('modals');
    modals.innerHTML = `
        ${modalTemplate('override-credits-modal', 'Override Community Credits', `
            <form id="override-credits-form">
                <input type="hidden" id="override-community-id">
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Adjust Credits (Add/Remove)</label>
                    <input type="number" id="override-quantity" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required placeholder="e.g. 500 or -100">
                    <p class="text-xs text-gray-500 mt-1">Positive number to add, negative to remove.</p>
                </div>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Update Credits</button>
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
    if (state.applications.length === 0) return `<p class="text-gray-500 text-sm italic">No pending applications.</p>`;

    return state.applications.map(app => `
        <div class="border rounded-lg p-3 flex justify-between items-center bg-gray-50">
            <div>
                <p class="font-bold text-gray-800">${app.name}</p>
                <p class="text-xs text-gray-500 font-mono">ID: ${app.id}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="window.updateB2BStatus('${app.id}', 'APPROVED')" class="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded font-bold transition">Approve</button>
                <button onclick="window.updateB2BStatus('${app.id}', 'REJECTED')" class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded font-bold transition">Reject</button>
            </div>
        </div>
    `).join('');
}

function renderApproved() {
    if (state.communities.length === 0) return `<p class="text-gray-500 text-sm italic">No approved communities.</p>`;

    return state.communities.map(comm => `
        <div class="border rounded-lg p-3 flex justify-between items-center bg-white">
            <div>
                <p class="font-bold text-gray-800">${comm.name}</p>
                <p class="text-xs text-gray-500 font-mono mb-1">ID: ${comm.id}</p>
                <span class="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Credits: ${comm.credits || 0}</span>
            </div>
            <div class="flex flex-col gap-2">
                <button onclick="window.openOverrideCredits('${comm.id}')" class="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-2 py-1 rounded font-bold transition whitespace-nowrap">Manage Credits</button>
                <button onclick="window.updateB2BStatus('${comm.id}', 'REVOKED')" class="bg-red-100 text-red-700 hover:bg-red-200 text-[10px] px-2 py-1 rounded font-bold transition">Revoke Access</button>
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

            const res = await api(\`/b2b/communities/\${cid}/credits\`, 'POST', { quantity });
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
    
    const res = await api(\`/b2b/communities/\${cid}/status\`, 'PUT', { status });
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
