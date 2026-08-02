import { api } from '../utils.js';

export async function renderTransactions(communityId) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="flex items-center gap-3 mb-6 pb-4 border-b">
            <a href="#/community/${communityId}" class="text-gray-400 hover:text-gray-700 transition">
                <i class="fas fa-arrow-left"></i>
            </a>
            <div>
                <h1 class="text-2xl font-bold text-gray-800">Transactions</h1>
                <p class="text-xs text-gray-400 font-mono mt-0.5">Community: ${communityId}</p>
            </div>
        </div>
        <div class="text-center py-16 text-gray-400">
            <i class="fas fa-spinner fa-spin text-2xl mb-3"></i>
            <p class="text-sm">Loading transactions...</p>
        </div>`;

    const res = await api(`/community/${communityId}/transactions/all`);
    if (!res || !res.success) {
        app.innerHTML += `<div class="text-red-500 text-center mt-10">Failed to load transactions.</div>`;
        return;
    }

    const allTxns = res.data.transactions || [];
    renderView(communityId, allTxns);
}

function renderView(communityId, allTxns) {
    const app = document.getElementById('app');

    // Summary stats — only COMPLETED count toward revenue
    const completed = allTxns.filter(t => t.status === 'COMPLETED');
    const pending   = allTxns.filter(t => t.status === 'PENDING');
    const failed    = allTxns.filter(t => ['FAILED', 'USER_DROPPED'].includes(t.status));
    const totalRevenue = completed.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    // Derive unique events and types for filter dropdowns
    const eventNames = [...new Set(allTxns.map(t => t.eventName).filter(Boolean))].sort();
    const txnTypes   = [...new Set(allTxns.map(t => t.type).filter(Boolean))].sort();

    app.innerHTML = `
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6 pb-4 border-b">
            <a href="#/community/${communityId}" class="text-gray-400 hover:text-gray-700 transition">
                <i class="fas fa-arrow-left"></i>
            </a>
            <div>
                <h1 class="text-2xl font-bold text-gray-800">Transactions</h1>
                <p class="text-xs text-gray-400 font-mono mt-0.5">Community: ${communityId}</p>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Total Revenue</p>
                <p class="text-2xl font-black text-green-600">₹${totalRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                <p class="text-xs text-gray-400 mt-1">${completed.length} completed payment${completed.length !== 1 ? 's' : ''}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">All Transactions</p>
                <p class="text-2xl font-black text-gray-800">${allTxns.length}</p>
                <p class="text-xs text-gray-400 mt-1">across all statuses</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Pending</p>
                <p class="text-2xl font-black text-yellow-500">${pending.length}</p>
                <p class="text-xs text-gray-400 mt-1">awaiting completion</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Failed / Dropped</p>
                <p class="text-2xl font-black text-red-500">${failed.length}</p>
                <p class="text-xs text-gray-400 mt-1">did not complete</p>
            </div>
        </div>

        <!-- Filters Bar -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 p-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <!-- Search -->
                <div class="lg:col-span-2 relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    <input id="txn-search" type="text" placeholder="Search user, event, order ID..."
                        class="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                </div>
                <!-- Status Filter -->
                <select id="txn-status" class="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                    <option value="">All Statuses</option>
                    <option value="COMPLETED">✅ Completed</option>
                    <option value="PENDING">🕐 Pending</option>
                    <option value="FAILED">❌ Failed</option>
                    <option value="USER_DROPPED">🚪 User Dropped</option>
                </select>
                <!-- Event Filter -->
                <select id="txn-event" class="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                    <option value="">All Events</option>
                    ${eventNames.map(e => `<option value="${e}">${e}</option>`).join('')}
                </select>
                <!-- Date Range -->
                <div class="flex gap-2">
                    <input id="txn-date-from" type="date" title="From date"
                        class="w-full py-2 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                    <input id="txn-date-to" type="date" title="To date"
                        class="w-full py-2 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50">
                </div>
            </div>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <p id="txn-count" class="text-xs text-gray-400">Showing all ${allTxns.length} transactions</p>
                <button id="txn-reset" class="text-xs text-blue-600 hover:text-blue-800 font-medium transition">
                    <i class="fas fa-times-circle mr-1"></i>Reset Filters
                </button>
            </div>
        </div>

        <!-- Table -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none" data-sort="timestamp">
                                Date <i class="fas fa-sort ml-1 text-gray-300"></i>
                            </th>
                            <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none" data-sort="userName">
                                User <i class="fas fa-sort ml-1 text-gray-300"></i>
                            </th>
                            <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none" data-sort="eventName">
                                Event <i class="fas fa-sort ml-1 text-gray-300"></i>
                            </th>
                            <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Type
                            </th>
                            <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Order ID
                            </th>
                            <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition select-none text-right" data-sort="amount">
                                Amount <i class="fas fa-sort ml-1 text-gray-300"></i>
                            </th>
                            <th class="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody id="txn-tbody" class="divide-y divide-gray-100">
                    </tbody>
                </table>
            </div>
            <div id="txn-empty" class="hidden p-12 text-center text-gray-400">
                <i class="fas fa-search text-3xl mb-3"></i>
                <p class="font-medium">No transactions match your filters</p>
                <p class="text-xs mt-1">Try adjusting or resetting the filters above</p>
            </div>
        </div>`;

    // --- State ---
    let sortKey = 'timestamp';
    let sortDir = -1; // -1 = desc, 1 = asc

    // --- Render table rows ---
    function applyFilters() {
        const search   = document.getElementById('txn-search').value.toLowerCase().trim();
        const status   = document.getElementById('txn-status').value;
        const event    = document.getElementById('txn-event').value;
        const dateFrom = document.getElementById('txn-date-from').value;
        const dateTo   = document.getElementById('txn-date-to').value;

        let filtered = allTxns.filter(t => {
            if (status && t.status !== status) return false;
            if (event  && t.eventName !== event) return false;
            if (dateFrom && t.timestamp < dateFrom) return false;
            if (dateTo   && t.timestamp.slice(0,10) > dateTo) return false;
            if (search) {
                const haystack = [t.userName, t.userId, t.eventName, t.SK, t.orderId]
                    .join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });

        // Sort
        filtered.sort((a, b) => {
            let vA = a[sortKey] ?? '';
            let vB = b[sortKey] ?? '';
            if (sortKey === 'amount') { vA = parseFloat(vA)||0; vB = parseFloat(vB)||0; }
            if (vA < vB) return -sortDir;
            if (vA > vB) return  sortDir;
            return 0;
        });

        const tbody = document.getElementById('txn-tbody');
        const empty = document.getElementById('txn-empty');
        document.getElementById('txn-count').textContent =
            `Showing ${filtered.length} of ${allTxns.length} transaction${allTxns.length !== 1 ? 's' : ''}`;

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        tbody.innerHTML = filtered.map(t => {
            const date = t.timestamp ? new Date(t.timestamp).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true,
            }) : '—';

            // Extract order ID from SK (format TXN#order_xxx)
            const orderId = (t.SK || '').replace('TXN#', '') || t.orderId || '—';
            const shortOrderId = orderId.length > 16 ? orderId.slice(0, 16) + '…' : orderId;

            const typeBadge = {
                CERTIFICATE_PAYMENT: `<span class="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">📜 Certificate</span>`,
                TICKET_PAYMENT:      `<span class="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">🎟 Ticket</span>`,
            }[t.type] || `<span class="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-mono">${t.type || '—'}</span>`;

            const statusBadge = {
                COMPLETED:    `<span class="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-[10px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>COMPLETED</span>`,
                PENDING:      `<span class="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full text-[10px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block"></span>PENDING</span>`,
                FAILED:       `<span class="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>FAILED</span>`,
                USER_DROPPED: `<span class="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full text-[10px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"></span>DROPPED</span>`,
            }[t.status] || `<span class="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-mono">${t.status || '?'}</span>`;

            const amountColor = t.status === 'COMPLETED' ? 'text-green-600 font-bold' : 'text-gray-400 line-through';

            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">${date}</td>
                    <td class="px-4 py-3">
                        <div class="font-semibold text-gray-800 text-sm">${t.userName || '—'}</div>
                        <div class="text-[10px] text-gray-400 font-mono">${t.userId || ''}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-600 text-sm max-w-[160px] truncate" title="${t.eventName || ''}">${t.eventName || '—'}</td>
                    <td class="px-4 py-3">${typeBadge}</td>
                    <td class="px-4 py-3">
                        <span class="font-mono text-[10px] text-gray-400 select-all" title="${orderId}">${shortOrderId}</span>
                    </td>
                    <td class="px-4 py-3 text-right text-sm ${amountColor}">₹${parseFloat(t.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td class="px-4 py-3 text-center">${statusBadge}</td>
                </tr>`;
        }).join('');
    }

    // --- Sort on column header click ---
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (sortKey === key) sortDir *= -1;
            else { sortKey = key; sortDir = -1; }
            // Update sort icons
            document.querySelectorAll('th[data-sort] i').forEach(i => {
                i.className = 'fas fa-sort ml-1 text-gray-300';
            });
            th.querySelector('i').className = `fas fa-sort-${sortDir === -1 ? 'down' : 'up'} ml-1 text-blue-500`;
            applyFilters();
        });
    });

    // --- Filter listeners ---
    ['txn-search', 'txn-status', 'txn-event', 'txn-date-from', 'txn-date-to'].forEach(id => {
        document.getElementById(id).addEventListener('input', applyFilters);
    });

    // --- Reset button ---
    document.getElementById('txn-reset').addEventListener('click', () => {
        document.getElementById('txn-search').value   = '';
        document.getElementById('txn-status').value   = '';
        document.getElementById('txn-event').value    = '';
        document.getElementById('txn-date-from').value = '';
        document.getElementById('txn-date-to').value   = '';
        sortKey = 'timestamp'; sortDir = -1;
        document.querySelectorAll('th[data-sort] i').forEach(i => {
            i.className = 'fas fa-sort ml-1 text-gray-300';
        });
        applyFilters();
    });

    // Initial render
    applyFilters();
}
