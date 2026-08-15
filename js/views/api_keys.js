import { api, modalTemplate } from '../utils.js';

let state = {
    keys: []
};

export async function renderApiKeys(communityId) {
    state.communityId = communityId;
    const app = document.getElementById('app');
    app.innerHTML = '<div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mx-auto"></div>';

    await loadKeys();

    app.innerHTML = `
        <div class="mb-6 flex justify-between items-center border-b pb-4">
            <div class="flex items-center gap-4">
                <button onclick="window.location.hash='#/community/${state.communityId}'" class="text-gray-400 hover:text-gray-700 transition"><i class="fas fa-arrow-left"></i></button>
                <div>
                    <h1 class="text-3xl font-bold text-gray-800">API Keys</h1>
                    <p class="text-sm text-gray-500">Manage API Keys for your Community</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="window.openBuyCredits()" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition shadow-sm">
                    💳 Buy Credits
                </button>
                <button onclick="window.openCreateKeyModal()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition">
                    + New API Key
                </button>
            </div>
        </div>



        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="keys-list">
            ${renderKeysList()}
        </div>
    `;

    // Inject Modals
    const modals = document.getElementById('modals');
    modals.innerHTML = `
        ${modalTemplate('create-key-modal', 'Create New API Key', `
            <form id="create-key-form">
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Key Name</label>
                    <input type="text" id="key-name" placeholder="e.g. Production Frontend" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <div class="mb-4" id="domain-input-container">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Allowed Domains (Optional)</label>
                    <input type="text" id="key-domains" placeholder="e.g. *.haxnation.org, http://localhost:*" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                    <p class="text-xs text-gray-500 mt-1">Comma-separated. Supports wildcards (*). Leave empty to allow any domain.</p>
                </div>
                <div class="mb-6">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Key Type</label>
                    <select id="key-type" class="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                        <option value="PUBLIC">PUBLIC - Read-only access (Safe for frontend)</option>
                        <option value="PRIVATE">PRIVATE - Full access including cert generation (Keep secret)</option>
                    </select>
                </div>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Generate Key</button>
            </form>
        `)}

        ${modalTemplate('new-key-modal', 'API Key Generated', `
            <div class="p-4 bg-yellow-50 border border-yellow-200 rounded shadow-sm mb-4">
                <p class="text-sm text-yellow-800 font-bold">Please copy this key now. You will not be able to see it again!</p>
            </div>
            <div class="flex items-center gap-2 bg-gray-900 p-3 rounded">
                <code id="new-key-value" class="flex-1 text-green-400 text-sm break-all font-mono"></code>
                <button type="button" onclick="window.toggleKeyVisibility()" class="text-gray-400 hover:text-white px-2"><i class="fas fa-eye" id="key-visibility-icon"></i></button>
                <button type="button" onclick="window.copyNewKey()" class="text-gray-400 hover:text-white px-2"><i class="fas fa-copy"></i></button>
            </div>
            <div class="mt-6 flex justify-end">
                <button type="button" onclick="window.closeModal('new-key-modal')" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition">I have copied it</button>
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

async function loadKeys() {
    const res = await api(`/community/${state.communityId}/apikeys`);
    state.keys = res?.data || [];
}

function renderKeysList() {
    if (state.keys.length === 0) {
        return `<div class="col-span-full text-center py-10 bg-white rounded shadow text-gray-500">No API keys created yet.</div>`;
    }

    return state.keys.map(k => `
        <div class="bg-white rounded-lg shadow-md border ${k.status === 'REVOKED' ? 'border-red-200 bg-red-50 opacity-75' : 'border-gray-200'} overflow-hidden flex flex-col">
            <div class="p-5 flex-1">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-bold text-gray-800">${k.name}</h3>
                    ${k.status === 'REVOKED' ? '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded">REVOKED</span>' : '<span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">ACTIVE</span>'}
                </div>
                <p class="text-xs text-gray-500 mb-4">Created: ${new Date(k.createdAt).toLocaleDateString()}</p>
                
                <div class="mb-2">
                    <span class="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-mono border">TYPE: ${k.keyType || 'PUBLIC'}</span>
                </div>
                <div class="text-sm text-gray-600 mt-2">
                    <span class="font-bold">Domains:</span> ${k.allowedDomains ? `<code class="bg-gray-100 px-1 rounded">${k.allowedDomains}</code>` : '<em>Any</em>'}
                </div>
            </div>
            ${k.status !== 'REVOKED' ? `
            <div class="bg-gray-50 p-3 border-t">
                <button onclick="window.revokeKey('${k.hash}')" class="w-full bg-white border border-red-300 hover:bg-red-50 text-red-600 text-sm py-1.5 px-3 rounded transition font-medium">
                    Revoke Key
                </button>
            </div>
            ` : ''}
        </div>
    `).join('');
}

function setupListeners() {
    const keyTypeSelect = document.getElementById('key-type');
    const domainContainer = document.getElementById('domain-input-container');
    if (keyTypeSelect && domainContainer) {
        keyTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'PRIVATE') {
                domainContainer.classList.add('hidden');
                document.getElementById('key-domains').value = '';
            } else {
                domainContainer.classList.remove('hidden');
            }
        });
    }

    document.getElementById('create-key-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('key-name').value;
        const allowedDomains = document.getElementById('key-domains').value;
        const keyType = document.getElementById('key-type').value;

        const res = await api(`/community/${state.communityId}/apikeys`, 'POST', { name, allowedDomains, keyType });
        if (res?.data) {
            document.getElementById('create-key-form').reset();
            window.closeModal('create-key-modal');
            
            window.generatedKey = res.data.apiKey;
            const el = document.getElementById('new-key-value');
            el.innerText = '*'.repeat(window.generatedKey.length);
            const icon = document.getElementById('key-visibility-icon');
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
            
            window.openModal('new-key-modal');
            
            // Manually add the key to the state to avoid DynamoDB GSI eventual consistency delays
            if (res.data.key) {
                state.keys.unshift(res.data.key);
                document.getElementById('keys-list').innerHTML = renderKeysList();
            } else {
                // Fallback
                await loadKeys();
                document.getElementById('keys-list').innerHTML = renderKeysList();
            }
        } else {
            alert(res?.error || 'Failed to create key');
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

        const res = await api(`/community/${state.communityId}/apikeys/buy-credits`, 'POST', { quantity: qty, gateway: 'PHONEPE' });
        if (res?.data?.redirect_url) {
            window.location.href = res.data.redirect_url;
        } else {
            alert(res?.error || 'Failed to initiate payment');
            btn.disabled = false;
            btn.innerText = 'Pay with PhonePe';
        }
    });
}

window.openBuyCredits = () => {
    document.getElementById('credit-quantity').value = 100;
    document.getElementById('credit-quantity').dispatchEvent(new Event('input'));
    window.openModal('buy-credits-modal');
};

window.toggleKeyVisibility = () => {
    const el = document.getElementById('new-key-value');
    const icon = document.getElementById('key-visibility-icon');
    if (el.innerText.includes('*')) {
        el.innerText = window.generatedKey;
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        el.innerText = '*'.repeat(window.generatedKey.length);
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

window.copyNewKey = () => {
    if (!window.generatedKey) return;
    navigator.clipboard.writeText(window.generatedKey).then(() => {
        alert('API Key copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy', err);
        alert('Failed to copy. Please try selecting the text manually.');
    });
};

window.openCreateKeyModal = () => {
    const form = document.getElementById('create-key-form');
    if (form) form.reset();
    
    const banner = document.getElementById('new-key-display');
    if (banner) {
        banner.classList.add('hidden');
        document.getElementById('new-key-value').innerText = '';
    }
    window.openModal('create-key-modal');
};

window.revokeKey = async (hash) => {
    if (!confirm("Are you sure you want to revoke this key? Any integrations using it will break immediately.")) return;
    const res = await api(`/community/${state.communityId}/apikeys/${hash}`, 'DELETE');
    if (res?.data) {
        await loadKeys();
        document.getElementById('keys-list').innerHTML = renderKeysList();
    } else {
        alert(res?.error || 'Failed to revoke key');
    }
};
