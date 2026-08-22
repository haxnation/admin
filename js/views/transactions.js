import { api } from '../utils.js';

export async function renderTransactions(communityId) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 gap-4 font-mono">
            <div class="w-10 h-10 bg-ink border-4 border-cyan shadow-[4px_4px_0_0_#5ce1e6] animate-[spin_1s_steps(4)_infinite]"></div>
            <p class="text-xs uppercase font-bold text-ink tracking-widest animate-pulse">[ LOADING TRANSACTIONS... ]</p>
        </div>`;

    const res = await api(`/community/${communityId}/transactions/all`);
    if (!res || !res.success) {
        app.innerHTML = `<div class="card-static border-2 border-danger text-danger text-center font-mono font-bold uppercase p-8 my-8">Failed to load transaction records.</div>`;
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

    app.innerHTML = `
        <!-- Header -->
        <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-ink pb-6 font-mono">
            <div class="flex items-center gap-4">
                <a href="#/community/${communityId}" class="btn-secondary !px-3 !py-2" aria-label="Back to community">
                    <i class="fas fa-arrow-left"></i>
                </a>
                <div>
                    <h1 class="text-3xl sm:text-5xl font-black tracking-tighter uppercase leading-none text-ink">
                        Transactions<span class="inline-block w-3 h-[0.7em] bg-cyan animate-pulse align-baseline ml-2"></span>
                    </h1>
                    <p class="text-xs text-neutral-700 font-bold mt-1">Community ID: ${communityId}</p>
                </div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 font-mono">
            <div class="bg-white border-2 border-ink p-5 shadow-[4px_4px_0_0_#0b0b0b]">
                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Total Revenue</p>
                <p class="text-2xl font-black text-success">₹${totalRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                <p class="text-[11px] text-neutral-600 mt-1 font-semibold">${completed.length} completed payment${completed.length !== 1 ? 's' : ''}</p>
            </div>
            <div class="bg-white border-2 border-ink p-5 shadow-[4px_4px_0_0_#0b0b0b]">
                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">All Transactions</p>
                <p class="text-2xl font-black text-ink">${allTxns.length}</p>
                <p class="text-[11px] text-neutral-600 mt-1 font-semibold">across all statuses</p>
            </div>
            <div class="bg-white border-2 border-ink p-5 shadow-[4px_4px_0_0_#0b0b0b]">
                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Pending</p>
                <p class="text-2xl font-black text-yellow-600">${pending.length}</p>
                <p class="text-[11px] text-neutral-600 mt-1 font-semibold">awaiting gateway settlement</p>
            </div>
            <div class="bg-white border-2 border-ink p-5 shadow-[4px_4px_0_0_#0b0b0b]">
                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Failed / Dropped</p>
                <p class="text-2xl font-black text-danger">${failed.length}</p>
                <p class="text-[11px] text-neutral-600 mt-1 font-semibold">did not complete</p>
            </div>
        </div>

        <!-- Filters Bar -->
        <div class="bg-white border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] mb-6 p-5 font-mono">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <!-- Search -->
                <div class="lg:col-span-2 relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs"></i>
                    <input id="txn-search" type="text" placeholder="Search user, event, order ID..."
                        class="input !py-2 !pl-8 text-xs">
                </div>
                <!-- Status Filter -->
                <div>
                    <select id="txn-status" class="input bg-white !py-2 text-xs font-bold" aria-label="Filter by Status">
                        <option value="">All Statuses</option>
                        <option value="COMPLETED">✅ Completed</option>
                        <option value="PENDING">🕐 Pending</option>
                        <option value="FAILED">❌ Failed</option>
                        <option value="USER_DROPPED">🚪 User Dropped</option>
                    </select>
                </div>
                <!-- Event Filter -->
                <div>
                    <select id="txn-event" class="input bg-white !py-2 text-xs font-bold" aria-label="Filter by Event">
                        <option value="">All Events</option>
                        ${eventNames.map(e => `<option value="${e}">${e}</option>`).join('')}
                    </select>
                </div>
                <!-- Date Range -->
                <div class="flex gap-2">
                    <input id="txn-date-from" type="date" title="From date"
                        class="input !py-2 !px-2 text-xs">
                    <input id="txn-date-to" type="date" title="To date"
                        class="input !py-2 !px-2 text-xs">
                </div>
            </div>
            <div class="flex items-center justify-between mt-4 pt-3 border-t-2 border-ink">
                <p id="txn-count" class="text-xs font-bold text-neutral-700">Showing all ${allTxns.length} transactions</p>
                <button id="txn-reset" class="btn-secondary !text-[10px] !px-2.5 !py-1">
                    <i class="fas fa-times-circle mr-1"></i> Reset Filters
                </button>
            </div>
        </div>

        <!-- Table -->
        <div class="bg-white border-2 border-ink shadow-[6px_6px_0_0_#0b0b0b] overflow-hidden font-mono">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead>
                        <tr class="bg-ink text-white uppercase tracking-wider border-b-2 border-ink select-none">
                            <th class="px-4 py-3.5 font-bold cursor-pointer hover:bg-neutral-800 transition" data-sort="timestamp">
                                Date <i class="fas fa-sort ml-1 text-white/50"></i>
                            </th>
                            <th class="px-4 py-3.5 font-bold cursor-pointer hover:bg-neutral-800 transition" data-sort="userName">
                                User <i class="fas fa-sort ml-1 text-white/50"></i>
                            </th>
                            <th class="px-4 py-3.5 font-bold cursor-pointer hover:bg-neutral-800 transition" data-sort="eventName">
                                Event <i class="fas fa-sort ml-1 text-white/50"></i>
                            </th>
                            <th class="px-4 py-3.5 font-bold">
                                Type
                            </th>
                            <th class="px-4 py-3.5 font-bold">
                                Order ID
                            </th>
                            <th class="px-4 py-3.5 font-bold cursor-pointer hover:bg-neutral-800 transition text-right" data-sort="amount">
                                Amount <i class="fas fa-sort ml-1 text-white/50"></i>
                            </th>
                            <th class="px-4 py-3.5 font-bold text-center">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody id="txn-tbody" class="divide-y-2 divide-ink/10 text-ink">
                    </tbody>
                </table>
            </div>
            <div id="txn-empty" class="hidden p-12 text-center text-neutral-600 font-mono font-bold uppercase">
                <i class="fas fa-search text-3xl mb-3 text-ink"></i>
                <p class="font-black text-sm">No transactions match your filters</p>
                <p class="text-xs text-neutral-500 mt-1">Try adjusting or clearing the filter inputs above</p>
            </div>
        </div>`;

    // --- State ---
    let sortKey = 'timestamp';
    let sortDir = -1;

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
        empty.classList.remove('hidden');
        empty.classList.add('hidden');

        tbody.innerHTML = filtered.map(t => {
            const date = t.timestamp ? new Date(t.timestamp).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true,
            }) : '—';

            const orderId = (t.SK || '').replace('TXN#', '') || t.orderId || '—';
            const shortOrderId = orderId.length > 16 ? orderId.slice(0, 16) + '…' : orderId;

            const typeBadge = {
                CERTIFICATE_PAYMENT: `<span class="bg-warning text-ink border border-ink px-2 py-0.5 text-[10px] font-black uppercase shadow-[1px_1px_0_0_#0b0b0b]">📜 Certificate</span>`,
                TICKET_PAYMENT:      `<span class="bg-cyan text-ink border border-ink px-2 py-0.5 text-[10px] font-black uppercase shadow-[1px_1px_0_0_#0b0b0b]">🎟 Ticket</span>`,
            }[t.type] || `<span class="bg-canvas text-neutral-700 border border-ink/40 px-2 py-0.5 text-[10px] font-mono">${t.type || '—'}</span>`;

            const statusBadge = {
                COMPLETED:    `<span class="badge bg-success text-ink">COMPLETED</span>`,
                PENDING:      `<span class="badge bg-warning text-ink">PENDING</span>`,
                FAILED:       `<span class="badge bg-danger text-white">FAILED</span>`,
                USER_DROPPED: `<span class="badge bg-canvas text-neutral-700">DROPPED</span>`,
            }[t.status] || `<span class="badge bg-canvas text-neutral-700">${t.status || '?'}</span>`;

            const amountClass = t.status === 'COMPLETED' ? 'text-success font-black text-sm' : 'text-neutral-500 font-semibold line-through text-xs';

            return `
                <tr class="hover:bg-canvas transition-colors">
                    <td class="px-4 py-3 text-neutral-800 whitespace-nowrap font-bold">${date}</td>
                    <td class="px-4 py-3">
                        <div class="font-black text-ink uppercase">${t.userName || '—'}</div>
                        <div class="text-[10px] text-neutral-600 font-mono">${t.userId || ''}</div>
                    </td>
                    <td class="px-4 py-3 text-neutral-800 font-bold max-w-[160px] truncate" title="${t.eventName || ''}">${t.eventName || '—'}</td>
                    <td class="px-4 py-3">${typeBadge}</td>
                    <td class="px-4 py-3">
                        <span class="font-mono text-[11px] text-neutral-600 font-bold select-all" title="${orderId}">${shortOrderId}</span>
                    </td>
                    <td class="px-4 py-3 text-right ${amountClass}">₹${parseFloat(t.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
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
            document.querySelectorAll('th[data-sort] i').forEach(i => {
                i.className = 'fas fa-sort ml-1 text-white/50';
            });
            th.querySelector('i').className = `fas fa-sort-${sortDir === -1 ? 'down' : 'up'} ml-1 text-cyan`;
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
            i.className = 'fas fa-sort ml-1 text-white/50';
        });
        applyFilters();
    });

    // Initial render
    applyFilters();
}

