import { api } from '../utils.js';

export async function renderApiUsage(communityId) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="flex items-center gap-3 mb-6 pb-4 border-b">
            <a href="#/community/${communityId}" class="text-gray-400 hover:text-gray-700 transition">
                <i class="fas fa-arrow-left"></i>
            </a>
            <div>
                <h1 class="text-2xl font-bold text-gray-800">Credits & API Usage</h1>
                <p class="text-xs text-gray-400 font-mono mt-0.5">Community: ${communityId}</p>
            </div>
        </div>
        <div class="text-center py-16 text-gray-400">
            <i class="fas fa-spinner fa-spin text-2xl mb-3"></i>
            <p class="text-sm">Loading usage logs...</p>
        </div>`;

    const res = await api(`/community/${communityId}/apikeys/usages`);
    if (!res || !res.success) {
        app.innerHTML += `<div class="text-red-500 text-center mt-10">Failed to load API usage logs.</div>`;
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
            <a href="#/community/${communityId}" class="text-gray-400 hover:text-gray-700 transition">
                <i class="fas fa-arrow-left"></i>
            </a>
            <div>
                <h1 class="text-2xl font-bold text-gray-800">Credits & API Usage</h1>
                <p class="text-xs text-gray-400 font-mono mt-0.5">Community: ${communityId}</p>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Total Credits Purchased</p>
                <p class="text-2xl font-black text-green-600">${totalCreditsPurchased}</p>
                <p class="text-xs text-gray-400 mt-1">across ${creditPurchases.length} transaction(s)</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Certificates Generated</p>
                <p class="text-2xl font-black text-gray-800">${totalCertsGenerated}</p>
                <p class="text-xs text-gray-400 mt-1">credits deducted</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Total Log Entries</p>
                <p class="text-2xl font-black text-blue-500">${allLogs.length}</p>
                <p class="text-xs text-gray-400 mt-1">combined history</p>
            </div>
        </div>

        <!-- Filters Bar -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 p-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <!-- Search -->
                <div class="lg:col-span-2 relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    <input id="usage-search" type="text" placeholder="Search recipient, event ID, order ID..."
                        class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                </div>
                <!-- Type Filter -->
                <select id="usage-type" class="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                    <option value="">All Actions</option>
                    <option value="CREDIT_PURCHASE">💰 Credits Added</option>
                    <option value="CERTIFICATE_USAGE">📜 Certificate Generated</option>
                </select>
                <!-- Event Filter -->
                <select id="usage-event" class="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                    <option value="">All Events</option>
                    ${eventIds.map(e => `<option value="${e}">${e}</option>`).join('')}
                </select>
            </div>
        </div>

        <!-- Data Table -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-gray-50 border-b text-gray-500 text-xs uppercase tracking-wider">
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
            <div id="usage-footer" class="p-4 text-center text-gray-500 text-xs bg-gray-50 border-t"></div>
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
                <td colspan="4" class="py-12 text-center text-gray-400">
                    <i class="fas fa-folder-open text-3xl mb-3 text-gray-300"></i>
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
            actionHtml = `<span class="bg-green-100 text-green-800 text-[10px] uppercase px-2 py-0.5 rounded font-bold whitespace-nowrap"><i class="fas fa-plus"></i> Credits Added</span>`;
            detailsHtml = `
                <div class="font-medium text-gray-800">Order ID: <span class="font-mono text-xs text-gray-500">${log.SK?.replace('TXN#', '')}</span></div>
                <div class="text-xs text-gray-500 mt-0.5">Gateway: ${log.gateway} | Amount: ₹${log.amount}</div>
            `;
            impactHtml = `<span class="text-green-600 font-bold">+${log.quantity} Credits</span>`;
        } else if (log.type === 'CERTIFICATE_USAGE') {
            actionHtml = `<span class="bg-blue-100 text-blue-800 text-[10px] uppercase px-2 py-0.5 rounded font-bold whitespace-nowrap"><i class="fas fa-file-invoice"></i> Cert Generated</span>`;
            detailsHtml = `
                <div class="font-medium text-gray-800">Recipient: ${log.recipientName || 'Unknown'}</div>
                <div class="text-xs text-gray-500 mt-0.5">Event: <span class="font-mono text-xs text-gray-500">${log.eventId || 'N/A'}</span></div>
            `;
            impactHtml = `<span class="text-red-500 font-bold">-${log.creditsDeducted || 1} Credit</span>`;
        } else {
            actionHtml = `<span class="bg-gray-100 text-gray-800 text-[10px] uppercase px-2 py-0.5 rounded font-bold">${log.type}</span>`;
            detailsHtml = `<div class="text-gray-500 text-xs break-all">${JSON.stringify(log)}</div>`;
            impactHtml = `<span class="text-gray-500">-</span>`;
        }

        return `
            <tr class="hover:bg-gray-50 transition">
                <td class="py-3 px-4 whitespace-nowrap text-gray-600">${dateStr}</td>
                <td class="py-3 px-4">${actionHtml}</td>
                <td class="py-3 px-4">${detailsHtml}</td>
                <td class="py-3 px-4 whitespace-nowrap">${impactHtml}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    footer.innerHTML = `Showing ${logs.length} record(s)`;
}
