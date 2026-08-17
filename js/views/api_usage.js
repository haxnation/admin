import { api } from '../utils.js';

export async function renderApiUsage(communityId) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="flex items-center gap-3 mb-6 pb-4 border-b">
            <a href="#/community/${communityId}" class="text-ink/40 hover:text-ink transition">
                <i class="fas fa-arrow-left"></i>
            </a>
            <div>
                <h1 class="text-2xl font-black uppercase font-mono border-b-2 border-ink pb-2 inline-block mb-4 text-ink">Credits & API Usage</h1>
                <p class="text-xs text-ink/40 font-mono mt-0.5">Community: ${communityId}</p>
            </div>
        </div>
        <div class="text-center py-16 text-ink/40">
            <i class="fas fa-spinner fa-spin text-2xl mb-3"></i>
            <p class="text-sm">Loading usage logs...</p>
        </div>`;

    const res = await api(`/community/${communityId}/apikeys/usages`);
    if (!res || !res.success) {
        app.innerHTML += `<div class="text-danger text-center mt-10">Failed to load API usage logs.</div>`;
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
    // Current credits could be fetched from community metadata, but we'll show just the aggregates here.

    // Derive unique events and types for filter dropdowns
    const eventIds = [...new Set(certUsages.map(t => t.eventId).filter(Boolean))].sort();

    app.innerHTML = `
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6 pb-4 border-b">
            <a href="#/community/${communityId}" class="text-ink/40 hover:text-ink transition">
                <i class="fas fa-arrow-left"></i>
            </a>
            <div>
                <h1 class="text-2xl font-black uppercase font-mono border-b-2 border-ink pb-2 inline-block mb-4 text-ink">Credits & API Usage</h1>
                <p class="text-xs text-ink/40 font-mono mt-0.5">Community: ${communityId}</p>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div class="bg-card border border-ink p-5">
                <p class="text-xs text-ink/40 uppercase tracking-wider font-semibold mb-1">Total Credits Purchased</p>
                <p class="text-2xl font-black text-success">${totalCreditsPurchased}</p>
                <p class="text-xs text-ink/40 mt-1">across ${creditPurchases.length} transaction(s)</p>
            </div>
            <div class="bg-card border border-ink p-5">
                <p class="text-xs text-ink/40 uppercase tracking-wider font-semibold mb-1">Certificates Generated</p>
                <p class="text-2xl font-black text-ink">${totalCertsGenerated}</p>
                <p class="text-xs text-ink/40 mt-1">credits deducted</p>
            </div>
            <div class="bg-card border border-ink p-5">
                <p class="text-xs text-ink/40 uppercase tracking-wider font-semibold mb-1">Total Log Entries</p>
                <p class="text-2xl font-black text-cyan">${allLogs.length}</p>
                <p class="text-xs text-ink/40 mt-1">combined history</p>
            </div>
        </div>

        <!-- Filters Bar -->
        <div class="bg-card border border-ink mb-4 p-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <!-- Search -->
                <div class="lg:col-span-2 relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 text-xs"></i>
                    <input id="usage-search" type="text" placeholder="Search recipient, event ID, order ID..."
                        class="w-full pl-8 pr-3 py-2 text-sm border border-ink focus:outline-none focus:ring-2 focus:ring-blue-500 bg-canvas">
                </div>
                <!-- Type Filter -->
                <select id="usage-type" class="py-2 px-3 text-sm border border-ink focus:outline-none focus:ring-2 focus:ring-blue-500 bg-canvas">
                    <option value="">All Actions</option>
                    <option value="CREDIT_PURCHASE">💰 Credits Added</option>
                    <option value="CERTIFICATE_USAGE">📜 Certificate Generated</option>
                </select>
                <!-- Event Filter -->
                <select id="usage-event" class="py-2 px-3 text-sm border border-ink focus:outline-none focus:ring-2 focus:ring-blue-500 bg-canvas">
                    <option value="">All Events</option>
                    ${eventIds.map(e => `<option value="${e}">${e}</option>`).join('')}
                </select>
            </div>
        </div>

        <!-- Data Table -->
        <div class="bg-card border border-ink overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-canvas border-b text-ink/50 text-xs uppercase tracking-wider">
                            <th class="py-3 px-4 font-semibold">Date & Time</th>
                            <th class="py-3 px-4 font-semibold">Action</th>
                            <th class="py-3 px-4 font-semibold">Details</th>
                            <th class="py-3 px-4 font-semibold">Impact</th>
                        </tr>
                    </thead>
                    <tbody id="usage-table-body" class="text-sm divide-y">
                        <!-- rows -->
                    </tbody>
                </table>
            </div>
            <!-- Pagination / Empty State Footer -->
            <div id="usage-footer" class="p-4 text-center text-ink/50 text-xs bg-canvas border-t"></div>
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
                <td colspan="4" class="py-12 text-center text-ink/40">
                    <i class="fas fa-folder-open text-3xl mb-3 text-canvas"></i>
                    <p>No usage logs found for the selected filters.</p>
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
            actionHtml = `<span class="bg-success text-ink border-2 border-ink text-[10px] uppercase px-2 py-0.5 font-bold whitespace-nowrap"><i class="fas fa-plus"></i> Credits Added</span>`;
            detailsHtml = `
                <div class="font-medium text-ink">Order ID: <span class="font-mono text-xs text-ink/50">${log.SK?.replace('TXN#', '')}</span></div>
                <div class="text-xs text-ink/50 mt-0.5">Gateway: ${log.gateway} | Amount: ₹${log.amount}</div>
            `;
            impactHtml = `<span class="text-success font-bold">+${log.quantity} Credits</span>`;
        } else if (log.type === 'CERTIFICATE_USAGE') {
            actionHtml = `<span class="bg-cyan/20 text-cyan text-[10px] uppercase px-2 py-0.5 font-bold whitespace-nowrap"><i class="fas fa-file-invoice"></i> Cert Generated</span>`;
            detailsHtml = `
                <div class="font-medium text-ink">Recipient: ${log.recipientName || 'Unknown'}</div>
                <div class="text-xs text-ink/50 mt-0.5">Event: <span class="font-mono text-xs text-ink/50">${log.eventId || 'N/A'}</span></div>
            `;
            impactHtml = `<span class="text-danger font-bold">-${log.creditsDeducted || 1} Credit</span>`;
        } else {
            actionHtml = `<span class="bg-canvas text-ink text-[10px] uppercase px-2 py-0.5 font-bold">${log.type}</span>`;
            detailsHtml = `<div class="text-ink/50 text-xs break-all">${JSON.stringify(log)}</div>`;
            impactHtml = `<span class="text-ink/50">-</span>`;
        }

        return `
            <tr class="hover:bg-canvas transition">
                <td class="py-3 px-4 whitespace-nowrap text-ink/70">${dateStr}</td>
                <td class="py-3 px-4">${actionHtml}</td>
                <td class="py-3 px-4">${detailsHtml}</td>
                <td class="py-3 px-4 whitespace-nowrap">${impactHtml}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    footer.innerHTML = `Showing ${logs.length} record(s)`;
}
