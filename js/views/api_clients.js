import { api, modalTemplate } from '../utils.js';

let state = {
    clients: [],
    selectedClient: null,
    keys: []
};

export async function renderApiClients(communityId) {
    state.communityId = communityId;
    const app = document.getElementById('app');
    app.innerHTML = '<div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mx-auto"></div>';

    await loadClients();

    app.innerHTML = `
        <div class="mb-6 flex justify-between items-center border-b pb-4">
            <div class="flex items-center gap-4">
                <button onclick="window.location.hash='#/community/${state.communityId}'" class="text-gray-400 hover:text-gray-700 transition"><i class="fas fa-arrow-left"></i></button>
                <div>
                    <h1 class="text-3xl font-bold text-gray-800">API Integrations</h1>
                    <p class="text-sm text-gray-500">Manage B2B Integrations for Community</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="window.openBuyCredits()" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition shadow-sm">
                    💳 Buy Credits
                </button>
                <button onclick="window.openModal('create-client-modal')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition">
                    + New API Client
                </button>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="clients-list">
            ${renderClientsList()}
        </div>
    `;

    // Inject Modals
    const modals = document.getElementById('modals');
    modals.innerHTML = `
        ${modalTemplate('create-client-modal', 'Create New API Client', `
            <form id="create-client-form">
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Application Name</label>
                    <input type="text" id="client-name" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Create</button>
            </form>
        `)}

        ${modalTemplate('manage-keys-modal', 'Manage API Keys', `
            <div class="mb-4">
                <button onclick="window.generateKey()" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mb-4">
                    + Generate New Key
                </button>
                <div id="new-key-display" class="hidden mb-4 p-4 bg-green-50 border border-green-200 rounded">
                    <p class="text-sm text-green-800 font-bold mb-2">Key generated! Copy it now, you won't see it again.</p>
                    <code id="new-key-value" class="block bg-black text-green-400 p-2 rounded text-xs break-all"></code>
                </div>
                <div id="keys-list" class="space-y-3 max-h-60 overflow-y-auto">
                    <!-- Keys go here -->
                </div>
            </div>
        `)}

        ${modalTemplate('buy-credits-modal', 'Buy Credits', `
            <form id="buy-credits-form">
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Number of Certificates</label>
                    <input type="number" id="credit-quantity" min="100" value="100" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                    <p class="text-xs text-gray-500 mt-1">Minimum order quantity: 100</p>
                </div>
                <div class="bg-gray-50 p-4 rounded mb-4">
                    <div class="flex justify-between mb-2">
                        <span class="text-sm text-gray-600">Price per cert:</span>
                        <span id="price-per-cert" class="font-bold">₹2.00</span>
                    </div>
                    <div class="flex justify-between border-t pt-2 mt-2">
                        <span class="font-bold">Total Amount:</span>
                        <span id="total-price" class="font-bold text-lg text-blue-600">₹200.00</span>
                    </div>
                </div>
                <button type="submit" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Pay with PhonePe</button>
            </form>
        `)}
    `;

    setupListeners();
}

async function loadClients() {
    const res = await api(`/community/${state.communityId}/apiclients`);
    state.clients = res?.data || [];
}

function renderClientsList() {
    if (state.clients.length === 0) {
        return `<div class="col-span-full text-center py-10 bg-white rounded shadow text-gray-500">No API clients created yet.</div>`;
    }

    return state.clients.map(client => `
        <div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col">
            <div class="p-5 border-b border-gray-100 flex-1">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-bold text-gray-800">${client.name}</h3>
                </div>
                <p class="text-xs text-gray-500 font-mono mb-4">ID: ${client.id}</p>
                <div class="flex gap-2">
                    <a href="#/community/${state.communityId}/api-clients/${client.id}/design" class="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm py-2 px-3 rounded font-medium transition">
                        🎨 Design Template
                    </a>
                </div>
            </div>
            <div class="bg-gray-50 p-3 flex gap-2">
                <button onclick="window.openManageKeys('${client.id}')" class="flex-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-sm py-1.5 px-3 rounded transition">
                    🔑 Manage Keys
                </button>
            </div>
        </div>
    `).join('');
}

function setupListeners() {
    document.getElementById('create-client-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('client-name').value;
        const res = await api(`/community/${state.communityId}/apiclients`, 'POST', { name });
        if (res?.data) {
            window.closeModal('create-client-modal');
            renderApiClients(state.communityId);
        } else {
            alert(res?.error || 'Failed to create client');
        }
    });

    const qtyInput = document.getElementById('credit-quantity');
    qtyInput.addEventListener('input', () => {
        const qty = parseInt(qtyInput.value) || 0;
        let price = 2.0;
        if (qty >= 10000) price = 1.5;
        else if (qty >= 1000) price = 1.75;
        
        document.getElementById('price-per-cert').innerText = '₹' + price.toFixed(2);
        document.getElementById('total-price').innerText = '₹' + (qty * price).toFixed(2);
    });

    document.getElementById('buy-credits-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const qty = parseInt(document.getElementById('credit-quantity').value);
        if (qty < 100) return alert('Minimum order quantity is 100');

        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = 'Processing...';

        const res = await api(`/community/${state.communityId}/apiclients/buy-credits`, 'POST', { quantity: qty, gateway: 'PHONEPE' });
        if (res?.data?.redirect_url) {
            window.location.href = res.data.redirect_url;
        } else {
            alert(res?.error || 'Failed to initiate payment');
            btn.disabled = false;
            btn.innerText = 'Pay with PhonePe';
        }
    });
}

// Global functions for inline handlers
window.openManageKeys = async (clientId) => {
    state.selectedClient = clientId;
    document.getElementById('new-key-display').classList.add('hidden');
    document.getElementById('keys-list').innerHTML = '<div class="text-center text-sm text-gray-500 py-4">Loading keys...</div>';
    window.openModal('manage-keys-modal');
    
    await loadKeys(clientId);
};

window.openBuyCredits = () => {
    document.getElementById('credit-quantity').value = 100;
    document.getElementById('credit-quantity').dispatchEvent(new Event('input'));
    window.openModal('buy-credits-modal');
};

window.generateKey = async () => {
    const clientId = state.selectedClient;
    const name = prompt("Enter a name for this API Key (e.g. 'Production'):");
    if (!name) return;

    const res = await api(`/community/${state.communityId}/apiclients/${clientId}/keys`, 'POST', { name, scopes: ['CERT_GENERATE'] });
    if (res?.data) {
        document.getElementById('new-key-display').classList.remove('hidden');
        document.getElementById('new-key-value').innerText = res.data.apiKey;
        await loadKeys(clientId);
    } else {
        alert(res?.error || 'Failed to generate key');
    }
};

window.revokeKey = async (hash) => {
    if (!confirm("Are you sure you want to revoke this key? Any integrations using it will break immediately.")) return;
    const res = await api(`/community/${state.communityId}/apiclients/${state.selectedClient}/keys/${hash}`, 'DELETE');
    if (res?.data) {
        await loadKeys(state.selectedClient);
    } else {
        alert(res?.error || 'Failed to revoke key');
    }
};

async function loadKeys(clientId) {
    const res = await api(`/community/${state.communityId}/apiclients/${clientId}/keys`);
    state.keys = res?.data || [];
    renderKeysList();
}

function renderKeysList() {
    const container = document.getElementById('keys-list');
    if (state.keys.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-500 py-4">No active keys</div>';
        return;
    }

    container.innerHTML = state.keys.map(k => `
        <div class="border rounded p-3 flex justify-between items-center ${k.status === 'REVOKED' ? 'bg-gray-100 opacity-60' : 'bg-white'}">
            <div>
                <p class="font-bold text-sm">${k.name} ${k.status === 'REVOKED' ? '<span class="text-red-500 text-xs ml-2 border border-red-500 rounded px-1">REVOKED</span>' : ''}</p>
                <p class="text-xs text-gray-500 mt-1">Created: ${new Date(k.createdAt).toLocaleDateString()}</p>
            </div>
            ${k.status !== 'REVOKED' ? `<button onclick="window.revokeKey('${k.hash}')" class="text-red-600 hover:text-red-800 text-xs font-bold px-2 py-1 bg-red-50 hover:bg-red-100 rounded">Revoke</button>` : ''}
        </div>
    `).join('');
}
