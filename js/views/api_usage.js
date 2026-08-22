import { api, escapeHtml } from '../utils.js';

export async function renderApiUsage(communityId) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 gap-4 font-mono">
            <div class="w-10 h-10 bg-ink border-4 border-cyan shadow-[4px_4px_0_0_#5ce1e6] animate-[spin_1s_steps(4)_infinite]"></div>
            <p class="text-xs uppercase font-bold text-ink tracking-widest animate-pulse">[ LOADING API USAGE LOGS... ]</p>
        </div>`;

    const res = await api(`/community/${communityId}/apikeys/usages`);
    if (!res || !res.success) {
        app.innerHTML = `<div class="card-static border-2 border-danger text-danger text-center font-mono font-bold uppercase p-8 my-8">Failed to load API usage logs.</div>`;
        return;
    }

    const allLogs = res.data.usages || [];
    renderView(communityId, allLogs);
}

function renderView(communityId, allLogs) {
    const app = document.getElementById('app');

    // Summary stats
    const creditPurchases = allLogs.filter(t => t.type === 'CREDIT_PURCHASE');
    const certUsages = allLogs.filter(t => t.type === 'CERTIFICATE_USAGE');
    
    const totalCreditsPurchased = creditPurchases.reduce((s, t) => s + (parseInt(t.quantity) || 0), 0);
    const totalCertsGenerated = certUsages.length;

    // Derive unique events and types for filter dropdowns
    const eventIds = [...new Set(certUsages.map(t => t.eventId).filter(Boolean))].sort();

    app.innerHTML = `
        <!-- Header -->
        <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-ink pb-6 font-mono">
            <div class="flex items-center gap-4">
                <a href="#/community/${encodeURIComponent(communityId)}" class="btn-secondary !px-3 !py-2" aria-label="Back to community">
                    <i class="fas fa-arrow-left"></i>
                </a>
                <div>
                    <h1 class="text-3xl sm:text-5xl font-black tracking-tighter uppercase leading-none text-ink">
                        Credits & Usage<span class="inline-block w-3 h-[0.7em] bg-cyan animate-pulse align-baseline ml-2"></span>
                    </h1>
                    <p class="text-xs text-neutral-700 font-bold mt-1">Community ID: ${escapeHtml(communityId)}</p>
                </div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 font-mono">
            <div class="bg-white border-2 border-ink p-5 shadow-[4px_4px_0_0_#0b0b0b]">
                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Total Credits Purchased</p>
                <p class="text-2xl font-black text-success">${totalCreditsPurchased}</p>
                <p class="text-[11px] text-neutral-600 mt-1 font-semibold">across ${creditPurchases.length} transaction(s)</p>
            </div>
            <div class="bg-white border-2 border-ink p-5 shadow-[4px_4px_0_0_#0b0b0b]">
                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Certificates Generated</p>
                <p class="text-2xl font-black text-ink">${totalCertsGenerated}</p>
                <p class="text-[11px] text-neutral-600 mt-1 font-semibold">credits deducted</p>
            </div>
            <div class="bg-white border-2 border-ink p-5 shadow-[4px_4px_0_0_#0b0b0b]">
                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Total Log Entries</p>
                <p class="text-2xl font-black text-cyan">${allLogs.length}</p>
                <p class="text-[11px] text-neutral-600 mt-1 font-semibold">combined telemetry records</p>
            </div>
        </div>

        <!-- Filters Bar -->
        <div class="bg-white border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] mb-6 p-5 font-mono">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <!-- Search -->
                <div class="lg:col-span-2 relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs"></i>
                    <input id="usage-search" type="text" placeholder="Search recipient, event ID, order ID..."
                        class="input !py-2 !pl-8 text-xs">
                </div>
                <!-- Type Filter -->
                <div>
                    <select id="usage-type" class="input bg-white !py-2 text-xs font-bold" aria-label="Filter by Action">
                        <option value="">All Actions</option>
                        <option value="CREDIT_PURCHASE">💰 Credits Added</option>
                        <option value="CERTIFICATE_USAGE">📜 Certificate Generated</option>
                    </select>
                </div>
                <!-- Event Filter -->
                <div>
                    <select id="usage-event" class="input bg-white !py-2 text-xs font-bold" aria-label="Filter by Event">
                        <option value="">All Events</option>
                        ${eventIds.map(e => `<option value="${e}">${e}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>

        <!-- Data Table -->
        <div class="bg-white border-2 border-ink shadow-[6px_6px_0_0_#0b0b0b] overflow-hidden font-mono">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr class="bg-ink text-white uppercase tracking-wider border-b-2 border-ink select-none">
                            <th class="py-3.5 px-4 font-bold">Date & Time</th>
                            <th class="py-3.5 px-4 font-bold">Action</th>
                            <th class="py-3.5 px-4 font-bold">Details</th>
                            <th class="py-3.5 px-4 font-bold">Impact</th>
                        </tr>
                    </thead>
                    <tbody id="usage-table-body" class="divide-y-2 divide-ink/10 text-ink">
                        <!-- rows -->
                    </tbody>
                </table>
            </div>
            <!-- Pagination / Empty State Footer -->
            <div id="usage-footer" class="p-3 text-center text-neutral-700 font-bold text-xs bg-canvas border-t-2 border-ink"></div>
        </div>
    `;

    // Filter Logic
    const searchInput = document.getElementById('usage-search');
    const typeSelect  = document.getElementById('usage-type');
    const eventSelect = document.getElementById('usage-event');

    const filterAndRender = () => {
        const q = searchInput.value.toLowerCase();
        const t = typeSelect.value;
        const e = eventSelect.value;

        const filtered = allLogs.filter(log => {
            if (t && log.type !== t) return false;
            if (e && log.eventId !== e) return false;
            if (q) {
                const searchStr = `${log.SK || ''} ${log.recipientName || ''} ${log.eventId || ''} ${log.gateway || ''}`.toLowerCase();
                if (!searchStr.includes(q)) return false;
            }
            return true;
        });

        renderTableBody(filtered);
    };

    searchInput.addEventListener('input', filterAndRender);
    typeSelect.addEventListener('change', filterAndRender);
    eventSelect.addEventListener('change', filterAndRender);

    // Initial render
    filterAndRender();
}

function renderTableBody(logs) {
    const tbody = document.getElementById('usage-table-body');
    const footer = document.getElementById('usage-footer');

    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="py-12 text-center text-neutral-600 font-mono font-bold uppercase">
                    <i class="fas fa-folder-open text-3xl mb-3 text-ink"></i>
                    <p class="font-black text-sm">No usage logs found</p>
                    <p class="text-xs text-neutral-500 mt-1">No activity matches the selected filter parameters.</p>
                </td>
            </tr>`;
        footer.innerHTML = '-';
        return;
    }

    const rowsHtml = logs.map(log => {
        const dateObj = new Date(log.timestamp);
        const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : 'Unknown Date';

        let actionHtml = '';
        let detailsHtml = '';
        let impactHtml = '';

        if (log.type === 'CREDIT_PURCHASE') {
            actionHtml = `<span class="badge bg-success text-ink whitespace-nowrap"><i class="fas fa-plus mr-1"></i> Credits Added</span>`;
            detailsHtml = `
                <div class="font-black text-ink uppercase">Order ID: <span class="font-mono text-xs text-neutral-700 font-bold select-all">${escapeHtml(log.SK?.replace('TXN#', ''))}</span></div>
                <div class="text-[11px] text-neutral-600 mt-0.5 font-bold">Gateway: ${escapeHtml(log.gateway)} | Amount: ₹${escapeHtml(log.amount)}</div>
            `;
            impactHtml = `<span class="text-success font-black text-sm">+${escapeHtml(log.quantity)} Credits</span>`;
        } else if (log.type === 'CERTIFICATE_USAGE') {
            actionHtml = `<span class="badge bg-cyan text-ink whitespace-nowrap"><i class="fas fa-file-invoice mr-1"></i> Cert Generated</span>`;
            detailsHtml = `
                <div class="font-black text-ink uppercase">Recipient: ${escapeHtml(log.recipientName || 'Unknown')}</div>
                <div class="text-[11px] text-neutral-600 mt-0.5 font-bold">Event ID: <span class="font-mono text-neutral-700 font-bold select-all">${escapeHtml(log.eventId || 'N/A')}</span></div>
            `;
            impactHtml = `<span class="text-danger font-black text-sm">-${escapeHtml(log.creditsDeducted || 1)} Credit</span>`;
        } else {
            actionHtml = `<span class="badge bg-canvas text-neutral-800">${escapeHtml(log.type)}</span>`;
            detailsHtml = `<div class="text-neutral-700 text-xs break-all font-mono">${escapeHtml(JSON.stringify(log))}</div>`;
            impactHtml = `<span class="text-neutral-600 font-bold">-</span>`;
        }

        return `
            <tr class="hover:bg-canvas transition-colors">
                <td class="py-3 px-4 whitespace-nowrap text-neutral-800 font-bold">${dateStr}</td>
                <td class="py-3 px-4">${actionHtml}</td>
                <td class="py-3 px-4">${detailsHtml}</td>
                <td class="py-3 px-4 whitespace-nowrap">${impactHtml}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    footer.innerHTML = `Showing ${logs.length} record(s)`;
}

