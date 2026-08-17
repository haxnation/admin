import { api, modalTemplate } from '../utils.js';
import { currentUser } from '../auth.js';

let currentAttendees = [];
let currentEvent = null;
let currentCommunityId = null;
let html5QrcodeScanner = null;
let ctfChallenges = [];
let ctfSubmissions = [];
let currentAST = null;

export async function renderEvent(communityId, eventId) {
    const container = document.getElementById('app');
    container.innerHTML = '<div class="text-center mt-10">Loading Event Details...</div>';

    if (!document.getElementById('html5-qrcode-script')) {
        const script1 = document.createElement('script');
        script1.src = 'https://unpkg.com/qrcode@1.5.1/build/qrcode.js';
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.id = 'html5-qrcode-script';
        script2.type = 'text/javascript';
        script2.src = 'https://unpkg.com/html5-qrcode';
        document.head.appendChild(script2);
    }

    if (!document.getElementById('chartjs-script')) {
        const script3 = document.createElement('script');
        script3.id = 'chartjs-script';
        script3.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        document.head.appendChild(script3);
    }

    try {
        const data = await api(`/community/${communityId}/event/${eventId}`);
        if (!data) {
            container.innerHTML = '<div class="text-danger">Error loading event.</div>';
            return;
        }

        currentEvent = data.data.event;
        currentAttendees = data.data.attendees || [];
        currentCommunityId = communityId;
        
        const certSettings = currentEvent.certificateSettings || { enabled: false, cost: 20 };
        const ctf = currentEvent.ctfSettings || { status: 'NONE' };
        
        const isSuperAdmin = currentUser.platformRole === 'SUPER_ADMIN';
        let dateValue = '';
        if (currentEvent.date) {
            const d = new Date(currentEvent.date);
            if (!isNaN(d.getTime())) {
                dateValue = d.toISOString().slice(0, 16);
            }
        }

        if (ctf.status === 'APPROVED') {
            const [chalRes, subRes] = await Promise.all([
                api(`/community/${communityId}/event/${eventId}/ctf/challenges`),
                api(`/community/${communityId}/event/${eventId}/ctf/submissions`)
            ]);
            ctfChallenges = chalRes?.data?.challenges || [];
            ctfSubmissions = subRes?.data?.submissions || [];
        }

        container.innerHTML = `
            <div class="mb-6">
                <a href="#/community/${communityId}" class="text-cyan hover:underline">&larr; Back to Community</a>
            </div>
            
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h1 class="text-3xl font-bold text-ink flex items-center gap-2">
                        ${currentEvent.name}
                        ${currentEvent.eventType === 'API_ONLY' ? '<span class="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 border border-purple-200 uppercase font-black tracking-widest"><i class="fas fa-network-wired"></i> API-ONLY</span>' : ''}
                    </h1>
                    <span class="inline-block bg-cyan/20 text-cyan px-3 py-1 text-sm mt-2">${currentEvent.status || 'Active'}</span>
                </div>
                <button onclick="openModal('edit-event')" class="text-ink/50 hover:text-ink bg-canvas px-4 py-2 border">⚙️ Edit Details</button>
            </div>

            ${currentEvent.eventType !== 'API_ONLY' ? `
            <div class="bg-indigo-900 text-white p-6 border border-indigo-800 mb-8">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold flex items-center gap-2">🚩 CTF Management</h2>
                    ${renderCtfStatusBadge(ctf.status)}
                </div>
                ${renderCtfDashboard(ctf, isSuperAdmin, communityId, eventId)}
            </div>
            ` : ''}


            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class="bg-card p-6 border border-ink">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold flex items-center gap-2">
                            📜 Certificates
                            ${certSettings.enabled ? '<span class="bg-success text-ink border-2 border-ink text-xs px-2 py-0.5">Active</span>' : '<span class="bg-canvas text-ink/70 text-xs px-2 py-0.5">Disabled</span>'}
                        </h2>
                        <a href="#/event/${eventId}/design" class="bg-indigo-600 text-white px-3 py-1.5 text-sm hover:bg-indigo-700 flex items-center gap-2">
                            <span>🎨</span> Designer
                        </a>
                    </div>
                    <form onsubmit="handleCertSettings(event, '${eventId}')" class="flex flex-wrap items-end gap-4 bg-canvas p-3 border">
                        <div>
                            <label class="block text-xs font-bold text-ink/50 mb-1">ENABLED</label>
                            <select name="enabled" class="border p-2 w-24 bg-card text-sm text-black">
                                <option value="true" ${certSettings.enabled ? 'selected' : ''}>Yes</option>
                                <option value="false" ${!certSettings.enabled ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                        ${currentEvent.eventType !== 'API_ONLY' ? `
                        <div>
                            <label class="block text-xs font-bold text-ink/50 mb-1">COST (INR)</label>
                            <input type="number" name="cost" value="${certSettings.cost}" class="border p-2 w-24 bg-card text-black text-sm ${!isSuperAdmin ? 'bg-canvas cursor-not-allowed' : ''}" ${!isSuperAdmin ? 'readonly' : ''}>
                        </div>
                        ` : ''}
                        <div class="w-full mt-2">
                            <label class="block text-xs font-bold text-ink/50 mb-1">CUSTOM URL PREFIX</label>
                            <input type="text" name="customCertificateUrlPrefix" value="${certSettings.customCertificateUrlPrefix || ''}" placeholder="e.g. https://my-frontend.com/validate?id=" class="w-full border p-2 bg-card text-black text-sm">
                        </div>
                        <button type="submit" class="bg-slate-800 text-white px-4 py-2 text-sm hover:bg-slate-900 ml-auto">Save</button>
                    </form>
                </div>
                ${currentEvent.eventType !== 'API_ONLY' ? `
                <div class="bg-card p-6 border border-ink text-black">
                    <h2 class="text-xl font-bold mb-4 border-b pb-2">Event Stats</h2>
                    <div class="space-y-2 text-sm">
                        <p><span class="text-ink/50 w-24 inline-block">Date:</span> <strong>${new Date(currentEvent.date).toLocaleString()}</strong></p>
                        <p><span class="text-ink/50 w-24 inline-block">Approval:</span> <strong>${currentEvent.settings?.requiresApproval ? 'Required' : 'Auto-Approve'}</strong></p>
                    </div>
                    <div class="pt-4 mt-4 border-t flex justify-between px-4">
                        <div class="text-center"><span class="block text-2xl font-bold">${currentAttendees.length}</span><span class="text-xs text-ink/50">Registered</span></div>
                        <div class="text-center"><span class="block text-2xl font-bold text-success">${currentAttendees.filter(a => a.checkedIn).length}</span><span class="text-xs text-ink/50">Checked In</span></div>
                        <div class="text-center"><span class="block text-2xl font-bold">${currentEvent.capacity || '∞'}</span><span class="text-xs text-ink/50">Capacity</span></div>
                    </div>
                </div>
                ` : `
                <div class="bg-purple-50 p-6 border border-purple-200 text-purple-900 flex flex-col justify-center items-center text-center">
                    <i class="fas fa-network-wired text-4xl mb-4 text-purple-400"></i>
                    <h2 class="text-xl font-bold mb-2">API-Only Mode Active</h2>
                    <p class="text-sm opacity-80">This event is running in headless mode. Public pages, check-ins, and ticket sales are disabled.</p>
                </div>
                `}
            </div>

            ${(currentEvent.settings?.isCertificateOnly || currentEvent.eventType === 'API_ONLY') ? `
            <div class="bg-card border border-ink mb-8 p-6 text-black">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 class="text-xl font-bold">Bulk Upload & Certificate Requirements</h2>
                    <button onclick="saveCertificateRequirements('${communityId}', '${eventId}')" class="bg-indigo-600 text-white px-4 py-2 text-sm font-bold hover:bg-indigo-700">Save Requirements</button>
                </div>
                
                <div class="mb-6">
                    <h3 class="text-lg font-bold mb-2 text-ink">Upload Filters (Logic Builder)</h3>
                    <p class="text-xs text-ink/50 mb-4">Define rules to filter rows before uploading. Only rows matching these rules will be added.</p>
                    <div id="requirements-builder" class="space-y-4 text-sm mb-4">
                    </div>
                </div>

                <div class="mb-4 border-t pt-4">
                    <h3 class="text-lg font-bold mb-2 text-ink">Select File</h3>
                    <input type="file" id="bulk-upload-file" accept=".csv, .xlsx, .xls" class="border p-2 w-full bg-canvas text-sm" onchange="handleBulkFileChange()">
                </div>
                
                <div id="bulk-upload-ui" class="hidden space-y-6">
                    <div class="flex gap-4 p-4 bg-canvas border">
                        <div class="flex-1">
                            <label class="block text-xs font-bold text-ink/50 mb-1">Email Column (Required)</label>
                            <select id="bulk-email-col" class="border p-2 w-full bg-card text-sm"></select>
                        </div>
                        <div class="flex-1">
                            <label class="block text-xs font-bold text-ink/50 mb-1">Name Column (Optional)</label>
                            <select id="bulk-name-col" class="border p-2 w-full bg-card text-sm"></select>
                        </div>
                    </div>

                    <div class="flex gap-2 justify-end border-t pt-4">
                        <button onclick="previewBulkUpload()" class="btn-secondary">Preview</button>
                        <button id="btn-upload-save" onclick="processBulkUpload('${communityId}', '${eventId}')" class="btn-primary">Upload & Save</button>
                    </div>
                    <div id="bulk-upload-preview" class="text-sm bg-canvas p-2 max-h-48 overflow-y-auto font-mono text-xs hidden"></div>
                </div>
            </div>
            ` : ''}

            <div class="bg-card border border-ink flex flex-col min-h-[500px]">
                <div class="p-4 border-b flex justify-between items-center bg-canvas -t-lg">
                    <h2 class="text-xl font-bold text-black">Attendee Management</h2>
                    <div class="flex gap-2">
                        <input type="text" id="search-attendees" placeholder="Search name or email..." class="border p-2 text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500 text-black" onkeyup="handleSearch()">
                        <button onclick="openQrScanner()" class="btn-primary">
                            📷 Scan QR
                        </button>
                    </div>
                </div>
                
                <div class="overflow-y-auto flex-1 p-4">
                    <table class="w-full text-left border-collapse text-black">
                        <thead>
                            <tr class="text-xs text-ink/50 uppercase border-b">
                                <th class="pb-2 font-bold">Attendee</th>
                                <th class="pb-2 font-bold">Status</th>
                                <th class="pb-2 font-bold">Check-In</th>
                                <th class="pb-2 font-bold">Certificate</th>
                                <th class="pb-2 font-bold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody id="attendee-list-container"></tbody>
                    </table>
                </div>
            </div>

            <div id="modal-container">
                ${modalTemplate('qr-modal', 'Scan Participant QR Code', `
                    <div id="qr-reader" class="w-full mx-auto" style="max-width: 400px; min-height: 250px;"></div>
                    <button onclick="closeQrScanner()" class="btn-secondary">Cancel & Close</button>
                `)}
            </div>
        `;

        document.getElementById('modal-container').innerHTML += modalTemplate('edit-event', 'Edit Event Details', `
            <form onsubmit="handleEditEvent(event, '${communityId}', '${eventId}')" class="text-black">
                <div class="space-y-4">
                    <div><label class="block text-xs font-bold text-ink/50 uppercase mb-1">Event Name</label><input type="text" name="name" value="${currentEvent.name || ''}" class="w-full border p-2" required></div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="block text-xs font-bold text-ink/50 uppercase mb-1">Date & Time</label><input type="datetime-local" name="date" value="${dateValue}" class="w-full border p-2 text-sm" required></div>
                        <div><label class="block text-xs font-bold text-ink/50 uppercase mb-1">Timezone</label><select name="timezone" class="w-full border p-2 text-sm bg-card"><option value="UTC" selected>UTC</option><option value="Asia/Kolkata">Asia/Kolkata</option></select></div>
                    </div>
                    <div><label class="block text-xs font-bold text-ink/50 uppercase mb-1">Location</label><input type="text" name="location" value="${currentEvent.location || ''}" class="w-full border p-2"></div>
                    <div><label class="block text-xs font-bold text-ink/50 uppercase mb-1">Event Status</label>
                        <select name="status" class="w-full border p-2 text-sm bg-card">
                            <option value="ACTIVE" ${(!currentEvent.status || currentEvent.status === 'ACTIVE') ? 'selected' : ''}>Active</option>
                            <option value="FINISHED" ${currentEvent.status === 'FINISHED' ? 'selected' : ''}>Finished (Ready for Certificates)</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>
        `);
        
        if (ctf.status === 'APPROVED' && currentEvent.eventType !== 'API_ONLY') {
            document.getElementById('modal-container').innerHTML += modalTemplate('add-ctf', 'Add CTF Challenge', `
                <form onsubmit="handleCreateCtfChallenge(event, '${communityId}', '${eventId}')" class="text-black">
                    <div class="space-y-3">
                        <div><label class="block text-xs font-bold text-ink/50 uppercase">Name</label><input type="text" name="name" class="w-full border p-2" required></div>
                        <div class="grid grid-cols-2 gap-2">
                            <div><label class="block text-xs font-bold text-ink/50 uppercase">Category</label><input type="text" name="category" placeholder="Web, Crypto" class="w-full border p-2" required></div>
                            <div><label class="block text-xs font-bold text-ink/50 uppercase">Difficulty</label><select name="difficulty" class="w-full border p-2 bg-card"><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select></div>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div><label class="block text-xs font-bold text-ink/50 uppercase">Scoring</label><select name="scoringType" class="w-full border p-2 bg-card"><option value="STATIC">Static</option><option value="DYNAMIC">Dynamic</option></select></div>
                            <div><label class="block text-xs font-bold text-ink/50 uppercase">Base Points</label><input type="number" name="points" class="w-full border p-2"></div>
                        </div>
                        <div><label class="block text-xs font-bold text-ink/50 uppercase">Description</label><textarea name="description" class="w-full border p-2 h-20" required></textarea></div>
                        <div><label class="block text-xs font-bold text-ink/50 uppercase">Flag</label><input type="text" name="flag" placeholder="aurum{...}" class="w-full border p-2" required></div>
                        <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-3 mt-2">Create Challenge</button>
                    </div>
                </form>
            `);
            setTimeout(renderCtfChart, 500);
        }
        
        renderAttendeeList(currentAttendees);

        if (currentEvent.settings?.isCertificateOnly || currentEvent.eventType === 'API_ONLY') {
            // Render the AST builder with existing requirements or a default empty group
            const existingReqs = currentEvent.settings?.certificateRequirements;
            currentAST = existingReqs || { logic: 'AND', conditions: [] };
            renderASTBuilder();
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="text-danger p-4">Error loading event data.</div>';
    }
}

function renderCtfStatusBadge(status) {
    if (status === 'APPROVED') return '<span class="bg-success/100 text-white px-3 py-1 text-xs rounded-none">Active</span>';
    if (status === 'PENDING_APPROVAL') return '<span class="bg-yellow-500 text-white px-3 py-1 text-xs rounded-none">Pending SuperAdmin</span>';
    return '<span class="bg-ink text-white px-3 py-1 text-xs rounded-none">Disabled</span>';
}

function renderCtfDashboard(ctf, isSuperAdmin, cid, eid) {
    if (ctf.status === 'NONE') {
        return `
            <div class="text-center py-6">
                <p class="text-indigo-200 mb-4">Enhance your event by hosting a Capture The Flag competition!</p>
                <button onclick="requestCtf('${cid}', '${eid}')" class="bg-card text-indigo-900 px-6 py-2 font-bold hover:bg-canvas transition">
                    Request CTF Feature
                </button>
            </div>`;
    }

    if (ctf.status === 'PENDING_APPROVAL') {
        let adminHtml = isSuperAdmin ? `
            <div class="mt-6 bg-indigo-950 p-4 border border-indigo-700 inline-block text-left">
                <p class="text-sm font-bold mb-2">SuperAdmin Approval Needed</p>
                <form onsubmit="approveCtf(event, '${cid}', '${eid}')" class="flex items-end gap-2 text-black">
                    <div>
                        <label class="block text-xs text-indigo-300 mb-1">Challenge Cap (0 = Unlimited)</label>
                        <input type="number" name="challengeCap" value="20" class="w-32 border p-2 text-sm">
                    </div>
                    <button class="bg-success/100 text-white px-4 py-2 text-sm font-bold hover:bg-green-600">Approve</button>
                </form>
            </div>` : '';
            
        return `<div class="text-center py-6 text-yellow-300"><i class="fas fa-clock text-2xl mb-2 block"></i> Waiting for SuperAdmin Approval...${adminHtml}</div>`;
    }

    if (ctf.status === 'APPROVED') {
        const challengesList = ctfChallenges.map(c => `
            <div class="flex justify-between items-center bg-indigo-800 p-3 mb-2 border border-indigo-700">
                <div>
                    <span class="font-bold text-sm">${c.name}</span>
                    <span class="text-xs text-indigo-300 ml-2 border border-indigo-600 px-1">${c.scoringType}</span>
                </div>
                <div class="text-sm">
                    ${c.status === 'APPROVED' ? '<span class="text-success">✅ Approved</span>' : `<button onclick="approveChallenge('${cid}', '${eid}', '${c.id}')" class="bg-yellow-500 text-black px-2 py-1 text-xs">Approve</button>`}
                </div>
            </div>
        `).join('');

        return `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-indigo-950 p-4 border border-indigo-800">
                    <h3 class="font-bold border-b border-indigo-800 pb-2 mb-3">Settings</h3>
                    <form onsubmit="saveCtfSettings(event, '${cid}', '${eid}')" class="space-y-3 text-sm">
                        <div class="grid grid-cols-2 gap-4">
                            <label class="flex items-center gap-2"><input type="checkbox" name="autoOpen" ${ctf.autoOpen ? 'checked' : ''}> Auto Open</label>
                            <label class="flex items-center gap-2"><input type="checkbox" name="autoClose" ${ctf.autoClose ? 'checked' : ''}> Auto Close</label>
                        </div>
                        <div class="grid grid-cols-2 gap-4 text-black">
                            <input type="datetime-local" name="startTime" value="${ctf.startTime || ''}" class="w-full p-1.5" title="Start Time">
                            <input type="datetime-local" name="endTime" value="${ctf.endTime || ''}" class="w-full p-1.5" title="End Time">
                        </div>
                        <div class="flex justify-between items-center border-t border-indigo-800 pt-3 mt-3">
                            <label class="flex items-center gap-2"><input type="checkbox" name="requireCheckIn" ${ctf.requireCheckIn ? 'checked' : ''}> <span class="text-indigo-200">Require Check-In to Play</span></label>
                            <label class="flex items-center gap-2 bg-red-900 px-3 py-1 border border-red-700"><input type="checkbox" name="isLive" ${ctf.isLive ? 'checked' : ''}> <span class="font-bold text-red-200">Force Live</span></label>
                        </div>
                        <button class="btn-primary w-full mt-2">Save Settings</button>
                    </form>
                </div>
                
                <div class="bg-indigo-950 p-4 border border-indigo-800 flex flex-col">
                    <div class="flex justify-between items-center border-b border-indigo-800 pb-2 mb-3">
                        <h3 class="font-bold">Challenges (${ctfChallenges.length}/${ctf.challengeCap || '∞'})</h3>
                        <button onclick="openModal('add-ctf')" class="text-xs bg-card text-indigo-900 px-2 py-1 font-bold">+ Add</button>
                    </div>
                    <div class="flex-1 overflow-y-auto max-h-[200px]">
                        ${challengesList || '<p class="text-indigo-400 text-sm italic">No challenges yet.</p>'}
                    </div>
                </div>
                
                <div class="col-span-1 lg:col-span-2 bg-indigo-950 p-4 border border-indigo-800">
                    <h3 class="font-bold mb-3">Spectator Timeline</h3>
                    <div style="height: 250px; width: 100%;">
                        <canvas id="ctfChart"></canvas>
                    </div>
                </div>
            </div>`;
    }
}

// Global actions exposed
window.requestCtf = async (cid, eid) => {
    if(confirm('Request CTF feature for this event?')) {
        await api(`/community/${cid}/event/${eid}/ctf/request`, 'POST');
        renderEvent(cid, eid);
    }
};

window.approveCtf = async (e, cid, eid) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api(`/community/${cid}/event/${eid}/ctf/approve`, 'POST', { challengeCap: fd.get('challengeCap') });
    renderEvent(cid, eid);
};

window.saveCtfSettings = async (e, cid, eid) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
        autoOpen: fd.get('autoOpen') === 'on',
        autoClose: fd.get('autoClose') === 'on',
        startTime: fd.get('startTime'),
        endTime: fd.get('endTime'),
        requireCheckIn: fd.get('requireCheckIn') === 'on',
        isLive: fd.get('isLive') === 'on'
    };
    await api(`/community/${cid}/event/${eid}/ctf/settings`, 'PUT', body);
    alert("CTF Settings Saved");
};

window.handleCreateCtfChallenge = async (e, cid, eid) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    const res = await api(`/community/${cid}/event/${eid}/ctf/challenges`, 'POST', body);
    if(res && res.success) {
        window.closeModal('add-ctf');
        renderEvent(cid, eid);
    } else alert(res?.error || 'Failed to create challenge');
};

window.approveChallenge = async (cid, eid, challengeId) => {
    await api(`/community/${cid}/event/${eid}/ctf/challenges/${challengeId}`, 'PUT', { status: 'APPROVED' });
    renderEvent(cid, eid);
};

function renderCtfChart() {
    const ctx = document.getElementById('ctfChart');
    if (!ctx || typeof Chart === 'undefined') return;
    
    // Group submissions by hour
    const counts = {};
    ctfSubmissions.forEach(sub => {
        const timeKey = sub.sk.split('#')[0].substring(0, 13) + ":00"; // Strip to hour
        counts[timeKey] = (counts[timeKey] || 0) + 1;
    });
    
    const labels = Object.keys(counts).sort();
    const data = labels.map(l => counts[l]);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Solves per Hour',
                data: data.length ? data : [0],
                borderColor: '#4ade80',
                backgroundColor: 'rgba(74, 222, 128, 0.2)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, ticks: { color: '#a5b4fc' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { ticks: { color: '#a5b4fc' }, grid: { display: false } }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}

// ... [Keep renderAttendeeList, handleSearch, viewAttendee, doCheckIn, updateStatus, QR logic as they were originally] ...

function renderAttendeeList(list) {
    const container = document.getElementById('attendee-list-container');
    if (!container) return;
    
    if (list.length === 0) {
        container.innerHTML = '<tr><td colspan="4" class="text-center text-ink/40 py-10">No attendees found.</td></tr>';
        return;
    }

    container.innerHTML = list.map(a => {
        const uid = a.UserID.replace('USER#', '');
        const statusColor = a.status === 'APPROVED' ? 'bg-green-100 text-green-700' : a.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
                            
        return `
            <tr class="border-b hover:bg-canvas transition text-black">
                <td class="py-3">
                    <div class="font-medium text-ink">${a.userInfo?.name || a.userInfo?.Name || a.userInfo?.['Full Name'] || 'Unknown User'}</div>
                    <div class="text-xs text-ink/40">${a.userInfo?.email || a.userInfo?.Email || 'No Email'}</div>
                </td>
                <td class="py-3"><span class="text-[10px] font-bold px-2 py-1 rounded-none uppercase ${statusColor}">${a.status || 'PENDING'}</span></td>
                <td class="py-3">${a.checkedIn ? '<span class="text-success font-bold text-sm">✅ Checked In</span>' : '<span class="text-ink/40 text-sm">Not Checked In</span>'}</td>
                <td class="py-3">${a.certificateIssuedAt ? '<span class="text-success font-bold text-sm">Yes</span>' : '<span class="text-ink/40 text-sm">No</span>'}</td>
                <td class="py-3 text-right">
                    <button onclick="viewAttendee('${uid}')" class="btn-secondary text-cyan">View Details</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.handleSearch = () => {
    const term = document.getElementById('search-attendees').value.toLowerCase();
    const filtered = currentAttendees.filter(a => {
        const name = (a.userInfo?.name || a.userInfo?.Name || a.userInfo?.['Full Name'] || '').toLowerCase();
        const email = (a.userInfo?.email || a.userInfo?.Email || '').toLowerCase();
        return name.includes(term) || email.includes(term);
    });
    renderAttendeeList(filtered);
};

window.viewAttendee = (userId) => {
    const user = currentAttendees.find(a => a.UserID.replace('USER#', '') === userId);
    if (!user) return alert("User not found.");

    let actionButtons = '';
    const status = user.status || 'PENDING';
    
    if (currentEvent.settings?.requiresApproval && status === 'PENDING') {
        actionButtons += `
            <div class="flex gap-2 w-full mb-3 pb-3 border-b">
                <button onclick="updateStatus('${userId}', 'APPROVED')" class="flex-1 bg-green-600 text-white py-2 font-bold hover:bg-green-700">Approve</button>
                <button onclick="updateStatus('${userId}', 'REJECTED')" class="flex-1 bg-red-600 text-white py-2 font-bold hover:bg-red-700">Reject</button>
            </div>
        `;
    }

        if (status === 'APPROVED' || !currentEvent.settings?.requiresApproval) {
            if (!user.checkedIn) {
                actionButtons += `<button onclick="doCheckIn('${userId}', true)" class="btn-primary">✅ Check In User</button>`;
            } else {
                actionButtons += `
                    <div class="w-full flex justify-between items-center bg-success/10 border border-success p-3 mt-2">
                        <span class="text-green-700 font-bold">✅ Checked In</span>
                        <button onclick="doCheckIn('${userId}', false)" class="text-sm bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 font-bold">Undo Check-In</button>
                    </div>
                `;
            }
        }

        if (user.certificateIssuedAt) {
            actionButtons += `
                <div class="w-full flex justify-between items-center bg-yellow-50 border border-yellow-200 p-3 mt-2">
                    <span class="text-yellow-700 font-bold">📜 Certificate Issued</span>
                    <button onclick="invalidateCertificate('${userId}')" class="text-sm bg-red-600 text-white hover:bg-red-700 px-3 py-1 font-bold">Invalidate</button>
                </div>
            `;
        }

    const modalHtml = modalTemplate('attendee-modal', 'Attendee Details', `
        <div class="space-y-4 text-black">
            <div class="flex items-center gap-4 p-4 bg-canvas border">
                <div><h3 class="font-bold text-lg text-ink">${user.userInfo?.name || user.userInfo?.Name || user.userInfo?.['Full Name'] || 'Unknown'}</h3><p class="text-sm text-ink/50">${user.userInfo?.email || user.userInfo?.Email || ''}</p></div>
            </div>
            <div class="pt-4 mt-2">${actionButtons}</div>
        </div>
    `);

    const existingModal = document.getElementById('attendee-modal');
    if (existingModal) existingModal.remove();
    document.getElementById('modal-container').insertAdjacentHTML('beforeend', modalHtml);
    openModal('attendee-modal');
};

window.doCheckIn = async (userId, isCheckingIn) => {
    await api(`/community/${currentCommunityId}/event/${currentEvent.id || currentEvent.SK.replace('METADATA', '')}/attendee/${userId}/checkin`, 'PUT', { checkedIn: isCheckingIn });
    closeModal('attendee-modal');
    renderEvent(currentCommunityId, currentEvent.id || currentEvent.SK.replace('METADATA', '')); 
};

window.invalidateCertificate = async (userId) => {
    if (confirm('Are you sure you want to invalidate this certificate?')) {
        await api(`/community/${currentCommunityId}/event/${currentEvent.id || currentEvent.SK.replace('METADATA', '')}/attendee/${userId}/certificate/invalidate`, 'POST', {});
        closeModal('attendee-modal');
        renderEvent(currentCommunityId, currentEvent.id || currentEvent.SK.replace('METADATA', '')); 
    }
};

window.updateStatus = async (userId, newStatus) => {
    await api(`/community/${currentCommunityId}/event/${currentEvent.id || currentEvent.SK.replace('METADATA', '')}/attendee/${userId}/status`, 'PUT', { status: newStatus });
    closeModal('attendee-modal');
    renderEvent(currentCommunityId, currentEvent.id || currentEvent.SK.replace('METADATA', ''));
};

window.openQrScanner = () => {
    if (typeof Html5Qrcode === 'undefined') return alert("QR Library is loading.");
    openModal('qr-modal');
    setTimeout(() => {
        if (!html5QrcodeScanner) html5QrcodeScanner = new Html5Qrcode("qr-reader");
        html5QrcodeScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
            (text) => { closeQrScanner(); viewAttendee(text.replace('USER#', '').trim()); },
            () => {}
        ).catch((err) => {
            const el = document.getElementById('qr-reader');
            if (el) el.innerHTML = `<p class="text-danger">Camera failed: ${err}</p>`;
        });
    }, 200);
};

window.closeQrScanner = () => {
    if (html5QrcodeScanner) html5QrcodeScanner.stop().then(() => { html5QrcodeScanner.clear(); html5QrcodeScanner = null; });
    closeModal('qr-modal');
};

window.handleEditEvent = async (e, cid, eid) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    const res = await api(`/community/${cid}/event/${eid}`, 'PUT', body);
    if (res && res.success) { window.closeModal('edit-event'); renderEvent(cid, eid); }
};

window.handleCertSettings = async (e, eventId) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api(`/event/${eventId}/certificate-settings`, 'PUT', { 
        communityId: currentCommunityId, 
        enabled: fd.get('enabled') === 'true', 
        cost: fd.get('cost'),
        customCertificateUrlPrefix: fd.get('customCertificateUrlPrefix')
    });
    alert('Certificate settings updated.');
    renderEvent(currentCommunityId, currentEvent.id || currentEvent.SK.replace('METADATA', ''));
};

// --- BULK UPLOAD LOGIC ---
let parsedBulkData = [];
let bulkHeaders = [];

window.handleBulkFileChange = async () => {
    const fileInput = document.getElementById('bulk-upload-file');
    const file = fileInput.files[0];
    if (!file) {
        document.getElementById('bulk-upload-ui').classList.add('hidden');
        return;
    }
    
    document.getElementById('bulk-upload-ui').classList.remove('hidden');
    
    // Parse headers
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                bulkHeaders = results.meta.fields || [];
                parsedBulkData = results.data;
                populateBulkDropdowns(bulkHeaders);
            }
        });
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.SheetNames[0];
            const roa = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {header: 1});
            if(roa.length > 0) {
                bulkHeaders = roa[0].map(h => String(h).trim());
                parsedBulkData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {defval: ""});
                populateBulkDropdowns(bulkHeaders);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        alert('Unsupported file format. Please use CSV or Excel.');
    }
};

function populateBulkDropdowns(headers) {
    const emailSel = document.getElementById('bulk-email-col');
    const nameSel = document.getElementById('bulk-name-col');
    
    emailSel.innerHTML = '<option value="">-- Select Column --</option>';
    nameSel.innerHTML = '<option value="">-- Select Column --</option>';
    
    headers.forEach(h => {
        const opt1 = document.createElement('option');
        opt1.value = h; opt1.textContent = h;
        emailSel.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = h; opt2.textContent = h;
        nameSel.appendChild(opt2);
    });
    
    // Auto-select obvious headers
    const lower = headers.map(h => h.toLowerCase());
    let emailIdx = lower.findIndex(h => h.includes('email'));
    if (emailIdx > -1) emailSel.selectedIndex = emailIdx + 1;
    let nameIdx = lower.findIndex(h => h.includes('name'));
    if (nameIdx > -1) nameSel.selectedIndex = nameIdx + 1;
}

function evaluateRow(row, node) {
    if (!node) return true;
    
    if (node.logic) {
        if (!node.conditions || node.conditions.length === 0) return true;
        if (node.logic === 'AND') {
            return node.conditions.every(child => evaluateRow(row, child));
        } else if (node.logic === 'OR') {
            return node.conditions.some(child => evaluateRow(row, child));
        }
        return true;
    } else {
        if (!node.field) return true;
        
        let fieldName = Object.keys(row).find(k => k.toLowerCase() === node.field.toLowerCase());
        let rowVal = fieldName ? row[fieldName] : undefined;
        if (rowVal === undefined || rowVal === null) rowVal = '';
        
        let val1 = !isNaN(Number(rowVal)) && rowVal !== '' ? Number(rowVal) : String(rowVal).toLowerCase().trim();
        let val2 = !isNaN(Number(node.value)) && node.value !== '' ? Number(node.value) : String(node.value).toLowerCase().trim();

        switch (node.operator) {
            case '==': return val1 == val2;
            case '!=': return val1 != val2;
            case '>': return val1 > val2;
            case '<': return val1 < val2;
            case '>=': return val1 >= val2;
            case '<=': return val1 <= val2;
            default: return false;
        }
    }
}

function getProcessedBulkData() {
    const emailCol = document.getElementById('bulk-email-col').value;
    const nameCol = document.getElementById('bulk-name-col').value;
    if (!emailCol) return { error: "Please select an Email column." };
    
    let processed = [];
    let rejected = 0;
    
    for (let row of parsedBulkData) {
        let finalRow = { ...row }; // keep custom fields
        finalRow.email = row[emailCol];
        if (nameCol) finalRow.name = row[nameCol];
        
        if (finalRow.email) {
            if (currentAST && (currentAST.conditions && currentAST.conditions.length > 0)) {
                if (evaluateRow(row, currentAST)) {
                    processed.push(finalRow);
                } else {
                    rejected++;
                }
            } else {
                processed.push(finalRow);
            }
        }
    }
    
    return { data: processed, rejected };
}

window.previewBulkUpload = () => {
    const res = getProcessedBulkData();
    const previewDiv = document.getElementById('bulk-upload-preview');
    previewDiv.classList.remove('hidden');
    
    if (res.error) {
        previewDiv.innerHTML = `<span class="text-danger">${res.error}</span>`;
        return;
    }
    
    let sample = res.data.slice(0, 3);
    previewDiv.innerHTML = `<div><strong>Found ${res.data.length} allowed users based on filter.</strong> ${res.rejected > 0 ? `<span class="text-danger font-bold ml-2">(${res.rejected} rejected by Logic Builder filters)</span>` : ''}</div><br/>Preview of first few:<br/><pre id="bulk-upload-pre"></pre>`;
    document.getElementById('bulk-upload-pre').textContent = JSON.stringify(sample, null, 2);
};

window.processBulkUpload = async (cid, eid) => {
    const res = getProcessedBulkData();
    if (res.error) return alert(res.error);
    if (res.data.length === 0) return alert('No users matched your criteria.');
    
    const btn = document.getElementById('btn-upload-save');
    btn.innerText = "Uploading...";
    btn.disabled = true;
    
    try {
        await saveCertificateRequirements(cid, eid, true);
        
        const chunkSize = 50;
        for (let i = 0; i < res.data.length; i += chunkSize) {
            const chunk = res.data.slice(i, i + chunkSize);
            await api(`/community/${cid}/event/${eid}/allowed-users`, 'POST', chunk);
        }
        alert(`Successfully allowed ${res.data.length} users!`);
        
        // Reset UI
        document.getElementById('bulk-upload-file').value = '';
        document.getElementById('bulk-upload-ui').classList.add('hidden');
        document.getElementById('bulk-upload-preview').classList.add('hidden');
        
        // Refresh Table
        renderEvent(cid, eid);
    } catch (e) {
        alert("Upload failed partially or fully.");
    }
    btn.innerText = "Upload & Save";
    btn.disabled = false;
};

// --- AST LOGIC BUILDER ---
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

window.renderASTBuilder = () => {
    const container = document.getElementById('requirements-builder');
    if (!container) return;
    container.innerHTML = window.renderASTNode(currentAST, []);
};

window.renderASTNode = (node, path) => {
    const pathStr = JSON.stringify(path);
    if (node.logic) {
        // It's a group
        const conditionsHtml = (node.conditions || []).map((child, idx) => {
            return `<div class="ml-6 mt-2 border-l-2 border-ink pl-4">${window.renderASTNode(child, [...path, 'conditions', idx])}</div>`;
        }).join('');

        return `
            <div class="bg-canvas p-4 border border-ink">
                <div class="flex gap-2 items-center mb-2">
                    <select onchange='updateASTNode(${pathStr}, "logic", this.value)' class="border p-1 font-bold text-xs bg-card">
                        <option value="AND" ${node.logic === 'AND' ? 'selected' : ''}>AND</option>
                        <option value="OR" ${node.logic === 'OR' ? 'selected' : ''}>OR</option>
                    </select>
                    <span class="text-xs text-ink/50 font-bold uppercase">Group</span>
                    <div class="ml-auto flex gap-2">
                        <button onclick='addASTNode(${pathStr})' class="text-xs bg-cyan/20 text-cyan px-2 py-1 font-bold hover:bg-cyan/30">+ Rule</button>
                        <button onclick='addASTGroup(${pathStr})' class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 font-bold hover:bg-indigo-200">+ Group</button>
                        ${path.length > 0 ? `<button onclick='removeASTNode(${pathStr})' class="text-xs bg-red-100 text-red-700 px-2 py-1 font-bold hover:bg-red-200">Remove</button>` : ''}
                    </div>
                </div>
                <div>${conditionsHtml}</div>
            </div>
        `;
    } else {
        // It's a rule
        const safeField = escapeHTML(node.field || '');
        const safeValue = escapeHTML(node.value || '');
        return `
            <div class="flex gap-2 items-center bg-card p-2 border border-ink">
                <input type="text" placeholder="Field (e.g. score)" value="${safeField}" onchange='updateASTNode(${pathStr}, "field", this.value)' class="border p-1.5 text-xs w-32 outline-none">
                <select onchange='updateASTNode(${pathStr}, "operator", this.value)' class="border p-1.5 text-xs bg-card w-24">
                    <option value="==" ${node.operator === '==' ? 'selected' : ''}>==</option>
                    <option value="!=" ${node.operator === '!=' ? 'selected' : ''}>!=</option>
                    <option value=">" ${node.operator === '>' ? 'selected' : ''}>></option>
                    <option value="<" ${node.operator === '<' ? 'selected' : ''}><</option>
                    <option value=">=" ${node.operator === '>=' ? 'selected' : ''}>>=</option>
                    <option value="<=" ${node.operator === '<=' ? 'selected' : ''}><=</option>
                </select>
                <input type="text" placeholder="Value (e.g. 50)" value="${safeValue}" onchange='updateASTNode(${pathStr}, "value", this.value)' class="border p-1.5 text-xs flex-1 outline-none">
                <button onclick='removeASTNode(${pathStr})' class="text-ink/40 hover:text-danger font-bold px-2">✕</button>
            </div>
        `;
    }
};

function getASTNodeRef(path) {
    let ref = currentAST;
    for (let p of path) {
        ref = ref[p];
    }
    return ref;
}

window.updateASTNode = (path, key, value) => {
    const ref = getASTNodeRef(path);
    ref[key] = value;
};

window.addASTNode = (path) => {
    const ref = getASTNodeRef(path);
    if (!ref.conditions) ref.conditions = [];
    ref.conditions.push({ field: '', operator: '==', value: '' });
    window.renderASTBuilder();
};

window.addASTGroup = (path) => {
    const ref = getASTNodeRef(path);
    if (!ref.conditions) ref.conditions = [];
    ref.conditions.push({ logic: 'AND', conditions: [] });
    window.renderASTBuilder();
};

window.removeASTNode = (path) => {
    const parentPath = path.slice(0, -2);
    const idx = path[path.length - 1];
    const parent = getASTNodeRef(parentPath);
    parent.conditions.splice(idx, 1);
    window.renderASTBuilder();
};

window.saveCertificateRequirements = async (cid, eid, silent = false) => {
    try {
        const payload = {
            name: currentEvent.name,
            date: currentEvent.date,
            timezone: currentEvent.timezone,
            description: currentEvent.description || "",
            location: currentEvent.location || "",
            capacity: currentEvent.capacity || 0,
            ticketPrice: currentEvent.settings?.ticketPrice || 0,
            requiresApproval: currentEvent.settings?.requiresApproval || false,
            enableWaitlist: currentEvent.settings?.enableWaitlist || false,
            isCertificateOnly: currentEvent.settings?.isCertificateOnly || false,
            status: currentEvent.status || "ACTIVE",
            certificateRequirements: currentAST
        };
        const res = await api(`/community/${cid}/event/${eid}`, 'PUT', payload);
        if (!silent) {
            if (res && res.success) {
                alert('Certificate requirements saved successfully!');
                renderEvent(cid, eid);
            } else {
                alert(res?.error || 'Failed to save requirements.');
            }
        }
    } catch (e) {
        console.error('Save of requirements failed:', e);
        if (!silent) alert('An error occurred.');
    }
};