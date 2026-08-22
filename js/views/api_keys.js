import { api, modalTemplate, escapeHtml } from '../utils.js';

let state = {
    keys: []
};

export async function renderApiKeys(communityId) {
    state.communityId = communityId;
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 gap-4 font-mono">
            <div class="w-10 h-10 bg-ink border-4 border-cyan shadow-[4px_4px_0_0_#5ce1e6] animate-[spin_1s_steps(4)_infinite]"></div>
            <p class="text-xs uppercase font-bold text-ink tracking-widest animate-pulse">[ LOADING API KEYS... ]</p>
        </div>`;

    await loadKeys();

    app.innerHTML = `
        <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-ink pb-6 font-mono">
            <div class="flex items-center gap-4">
                <a href="#/community/${encodeURIComponent(state.communityId)}" class="btn-secondary !px-3 !py-2" aria-label="Back to community">
                    <i class="fas fa-arrow-left"></i>
                </a>
                <div>
                    <h1 class="text-3xl sm:text-5xl font-black tracking-tighter uppercase leading-none text-ink">
                        API Keys<span class="inline-block w-3 h-[0.7em] bg-cyan animate-pulse align-baseline ml-2"></span>
                    </h1>
                    <p class="text-xs text-neutral-700 font-bold mt-1">Manage API credentials & certificate generation credits (certificates valid & stored for 2 years).</p>
                </div>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                <a href="api-docs.html" target="_blank" class="btn-secondary">
                    <i class="fas fa-book mr-1"></i> API Docs
                </a>
                <button onclick="window.openBuyCredits()" class="btn-primary !bg-warning hover:!bg-yellow-400 text-ink">
                    <i class="fas fa-coins mr-1"></i> Buy Credits
                </button>
                <button onclick="window.openCreateKeyModal()" class="btn-primary">
                    <i class="fas fa-key mr-1"></i> + New API Key
                </button>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono" id="keys-list">
            ${renderKeysList()}
        </div>
    `;

    // Inject Modals
    const modals = document.getElementById('modals');
    modals.innerHTML = `
        ${modalTemplate('create-key-modal', 'Create New API Key', `
            <form id="create-key-form" class="space-y-4 font-mono text-xs">
                <div>
                    <label class="label" for="key-name">Key Name</label>
                    <input type="text" id="key-name" placeholder="e.g. Production Frontend" class="input" required>
                </div>
                <div id="domain-input-container">
                    <label class="label" for="key-domains">Allowed Domains (Optional)</label>
                    <input type="text" id="key-domains" placeholder="e.g. *.haxnation.org, http://localhost:*" class="input">
                    <p class="text-[11px] text-neutral-600 mt-1 font-bold">Comma-separated. Supports wildcards (*). Leave empty to allow any origin.</p>
                </div>
                <div>
                    <label class="label" for="key-type">Key Type</label>
                    <select id="key-type" class="input bg-white font-bold">
                        <option value="PUBLIC">PUBLIC - Read-only access (Safe for client frontend)</option>
                        <option value="PRIVATE">PRIVATE - Full access including cert generation (Keep secret)</option>
                    </select>
                </div>
                <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                    <button type="button" onclick="closeModal('create-key-modal')" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">Generate Key</button>
                </div>
            </form>
        `)}

        ${modalTemplate('new-key-modal', 'API Key Generated', `
            <div class="space-y-4 font-mono">
                <div class="p-4 bg-yellow-50 border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b]">
                    <p class="text-xs text-ink font-bold uppercase"><i class="fas fa-exclamation-triangle mr-1 text-warning"></i> Copy this key now! It will never be displayed again.</p>
                </div>
                <div class="flex items-center gap-2 bg-ink border-2 border-ink p-3 shadow-[4px_4px_0_0_#0b0b0b]">
                    <code id="new-key-value" class="flex-1 text-cyan text-xs break-all font-mono font-bold select-all"></code>
                    <button type="button" onclick="window.toggleKeyVisibility()" class="text-white hover:text-cyan px-2 cursor-pointer" aria-label="Toggle key visibility">
                        <i class="fas fa-eye" id="key-visibility-icon"></i>
                    </button>
                    <button type="button" onclick="window.copyNewKey()" class="text-white hover:text-cyan px-2 cursor-pointer" aria-label="Copy key">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="pt-4 border-t-2 border-ink flex justify-end">
                    <button type="button" onclick="window.closeModal('new-key-modal')" class="btn-secondary">
                        <i class="fas fa-check mr-1"></i> I Have Copied It
                    </button>
                </div>
            </div>
        `)}

        ${modalTemplate('buy-credits-modal', 'Buy Certificate Credits', `
            <form id="buy-credits-form" class="space-y-4 font-mono text-xs">
                <div>
                    <label class="label" for="credit-quantity">Number of Certificates</label>
                    <input type="number" id="credit-quantity" min="100" value="100" class="input" required>
                    <p class="text-[11px] text-neutral-600 mt-1 font-bold">Minimum order batch: 100 certificates</p>
                </div>
                <p class="text-[11px] text-neutral-600 font-bold">Policy: Certificates generated with credits are valid and stored for 2 years from date of issue.</p>
                <div class="bg-canvas border-2 border-ink p-4 shadow-[2px_2px_0_0_#0b0b0b]">
                    <div class="flex justify-between mb-2">
                        <span class="text-xs text-neutral-700 font-bold uppercase">Rate per cert:</span>
                        <span id="price-per-cert" class="font-black text-ink">₹2.00</span>
                    </div>
                    <div class="flex justify-between border-t-2 border-ink pt-2 mt-2">
                        <span class="font-black uppercase text-ink">Total Amount:</span>
                        <span id="total-price" class="font-black text-base text-ink">₹200.00</span>
                    </div>
                </div>
                <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                    <button type="button" onclick="closeModal('buy-credits-modal')" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-lock mr-1"></i> Pay with PhonePe
                    </button>
                </div>
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
        return `<div class="col-span-full card-static text-center py-12 font-mono font-bold uppercase text-neutral-600">No API keys created yet.</div>`;
    }

    return state.keys.map(k => `
        <div class="bg-white border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] overflow-hidden flex flex-col justify-between font-mono ${k.status === 'REVOKED' ? 'opacity-70 bg-neutral-100' : ''}">
            <div class="p-5 flex-1">
                <div class="flex justify-between items-start mb-3 gap-2">
                    <h3 class="text-base font-black uppercase tracking-tight text-ink">${escapeHtml(k.name)}</h3>
                    ${k.status === 'REVOKED' ? '<span class="badge bg-danger text-white">REVOKED</span>' : '<span class="badge bg-success text-ink">ACTIVE</span>'}
                </div>
                <p class="text-[11px] text-neutral-600 mb-3 font-semibold">Created: ${escapeHtml(new Date(k.createdAt).toLocaleDateString())}</p>
                
                <div class="mb-3">
                    <span class="badge bg-canvas text-neutral-800">TYPE: ${escapeHtml(k.keyType || 'PUBLIC')}</span>
                </div>
                <div class="text-xs text-neutral-700 mt-2">
                    <span class="font-bold uppercase">Domains:</span> ${k.allowedDomains ? `<code class="bg-canvas border border-ink/40 px-1 py-0.5 text-[11px]">${escapeHtml(k.allowedDomains)}</code>` : '<span class="italic font-bold">Any origin (*)</span>'}
                </div>
            </div>
            ${k.status !== 'REVOKED' ? `
            <div class="bg-canvas p-3 border-t-2 border-ink">
                <button onclick="window.revokeKey('${escapeHtml(k.hash)}')" class="w-full btn-danger !text-xs !py-2">
                    <i class="fas fa-trash mr-1"></i> Delete Key
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
            
            if (res.data.key) {
                state.keys.unshift(res.data.key);
                document.getElementById('keys-list').innerHTML = renderKeysList();
            } else {
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

        const btn = e.target.querySelector('button[type="submit"]');
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
    window.openModal('create-key-modal');
};

window.revokeKey = async (hash) => {
    if (!confirm("Are you sure you want to completely delete this key? Any integrations using it will break immediately.")) return;
    const res = await api(`/community/${state.communityId}/apikeys/${hash}`, 'DELETE');
    if (res?.data) {
        await loadKeys();
        document.getElementById('keys-list').innerHTML = renderKeysList();
    } else {
        alert(res?.error || 'Failed to revoke key');
    }
};

