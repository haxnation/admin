import { api, modalTemplate, escapeHtml } from '../utils.js';
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
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 gap-4">
            <div class="w-10 h-10 bg-ink border-4 border-cyan shadow-[4px_4px_0_0_#5ce1e6] animate-[spin_1s_steps(4)_infinite]"></div>
            <p class="font-mono text-xs uppercase font-bold text-ink tracking-widest animate-pulse">[ LOADING EVENT DETAILS... ]</p>
        </div>
    `;

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
        if (!data || !data.data) {
            container.innerHTML = '<div class="card-static border-2 border-danger text-danger text-center font-mono font-bold uppercase p-8 my-8">Error loading event data.</div>';
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
            <!-- Top navigation & header -->
            <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-ink pb-6 font-mono">
                <div class="flex items-center gap-4">
                    <a href="#/community/${encodeURIComponent(communityId)}" class="btn-secondary !px-3 !py-2" aria-label="Back to community">
                        <i class="fas fa-arrow-left"></i>
                    </a>
                    <div>
                        <h1 class="text-2xl sm:text-4xl font-black font-mono text-ink uppercase tracking-tight flex items-center flex-wrap gap-2">
                            ${escapeHtml(currentEvent.name)}
                            ${currentEvent.eventType === 'API_ONLY' ? '<span class="bg-ink text-cyan border-2 border-ink text-xs px-2.5 py-0.5 font-bold uppercase tracking-wider"><i class="fas fa-network-wired mr-1"></i> API-ONLY</span>' : ''}
                        </h1>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="badge bg-cyan text-ink">${escapeHtml(currentEvent.status || 'Active')}</span>
                            <span class="text-xs text-neutral-700 font-bold">ID: ${escapeHtml(eventId)}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="openModal('edit-event')" class="btn-secondary">
                        <i class="fas fa-cog mr-1"></i> Edit Details
                    </button>
                </div>
            </div>

            <!-- CTF Management Section -->
            ${currentEvent.eventType !== 'API_ONLY' ? `
            <div class="bg-white border-2 border-ink shadow-[6px_6px_0_0_#0b0b0b] mb-8 overflow-hidden">
                <div class="p-4 bg-ink text-white flex justify-between items-center border-b-2 border-ink font-mono">
                    <h2 class="text-lg font-black uppercase flex items-center gap-2 text-white">
                        <span class="text-cyan">🚩</span> CTF Management
                    </h2>
                    ${renderCtfStatusBadge(ctf.status)}
                </div>
                <div class="p-6">
                    ${renderCtfDashboard(ctf, isSuperAdmin, communityId, eventId)}
                </div>
            </div>
            ` : ''}

            <!-- 2-Column Grid: Certificate Settings & Event Stats -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 font-mono">
                <!-- Certificate Settings -->
                <div class="card-static flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-center mb-2 border-b-2 border-ink pb-3">
                            <h2 class="text-lg font-black uppercase text-ink flex items-center gap-2">
                                📜 Certificates
                                ${certSettings.enabled ? '<span class="bg-success text-ink border-2 border-ink text-[10px] px-2 py-0.5 font-bold uppercase shadow-[1px_1px_0_0_#0b0b0b]">Active</span>' : '<span class="bg-canvas text-neutral-600 border border-ink text-[10px] px-2 py-0.5 font-bold uppercase">Disabled</span>'}
                            </h2>
                            <a href="#/event/${eventId}/design" class="btn-primary !text-xs !px-3 !py-1.5">
                                <i class="fas fa-palette mr-1"></i> Designer
                            </a>
                        </div>
                        <p class="font-mono text-[11px] text-neutral-600 font-bold mb-4">Notice: Certificates are valid & stored for 2 years from date of issue.</p>
                        <form onsubmit="handleCertSettings(event, '${eventId}')" class="space-y-4">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="label">Status</label>
                                    <select name="enabled" class="input bg-white !p-2 text-xs font-bold">
                                        <option value="true" ${certSettings.enabled ? 'selected' : ''}>ENABLED</option>
                                        <option value="false" ${!certSettings.enabled ? 'selected' : ''}>DISABLED</option>
                                    </select>
                                </div>
                                ${currentEvent.eventType !== 'API_ONLY' ? `
                                <div>
                                    <label class="label">Cost (INR)</label>
                                    <input type="number" name="cost" value="${certSettings.cost || 0}" class="input !p-2 text-xs font-bold ${!isSuperAdmin ? 'bg-canvas cursor-not-allowed text-neutral-600' : ''}" ${!isSuperAdmin ? 'readonly' : ''}>
                                </div>
                                ` : '<div></div>'}
                            </div>
                            <div>
                                <label class="label">Custom Certificate URL Prefix</label>
                                <input type="text" name="customCertificateUrlPrefix" value="${certSettings.customCertificateUrlPrefix || ''}" placeholder="e.g. https://my-frontend.com/validate?id=" class="input !p-2 text-xs">
                            </div>
                            <div class="pt-2 flex justify-end">
                                <button type="submit" class="btn-secondary !text-xs !px-4 !py-2">
                                    <i class="fas fa-save mr-1"></i> Save Certificate Settings
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Event Stats -->
                ${currentEvent.eventType !== 'API_ONLY' ? `
                <div class="card-static flex flex-col justify-between">
                    <div>
                        <h2 class="text-lg font-black uppercase text-ink mb-4 border-b-2 border-ink pb-3">Event Stats</h2>
                        <div class="space-y-2 text-xs font-mono font-bold text-neutral-800">
                            <p class="flex justify-between border-b border-ink/20 pb-1.5"><span class="text-neutral-600 uppercase">Date:</span> <span>${new Date(currentEvent.date).toLocaleString()}</span></p>
                            <p class="flex justify-between border-b border-ink/20 pb-1.5"><span class="text-neutral-600 uppercase">Approval Mode:</span> <span class="uppercase">${currentEvent.settings?.requiresApproval ? 'Required' : 'Auto-Approve'}</span></p>
                            <p class="flex justify-between border-b border-ink/20 pb-1.5"><span class="text-neutral-600 uppercase">Location:</span> <span>${currentEvent.location || 'Online'}</span></p>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 pt-4 mt-4 border-t-2 border-ink text-center">
                        <div class="bg-canvas border-2 border-ink p-2 shadow-[2px_2px_0_0_#0b0b0b]">
                            <span class="block text-2xl font-black text-ink">${currentAttendees.length}</span>
                            <span class="text-[10px] font-bold text-neutral-700 uppercase">Registered</span>
                        </div>
                        <div class="bg-canvas border-2 border-ink p-2 shadow-[2px_2px_0_0_#0b0b0b]">
                            <span class="block text-2xl font-black text-success">${currentAttendees.filter(a => a.checkedIn).length}</span>
                            <span class="text-[10px] font-bold text-neutral-700 uppercase">Checked In</span>
                        </div>
                        <div class="bg-canvas border-2 border-ink p-2 shadow-[2px_2px_0_0_#0b0b0b]">
                            <span class="block text-2xl font-black text-ink">${currentEvent.capacity || '∞'}</span>
                            <span class="text-[10px] font-bold text-neutral-700 uppercase">Capacity</span>
                        </div>
                    </div>
                </div>
                ` : `
                <div class="card-static flex flex-col justify-center items-center text-center p-8 bg-canvas">
                    <i class="fas fa-network-wired text-4xl mb-4 text-ink"></i>
                    <h2 class="text-xl font-black uppercase text-ink mb-2">API-Only Mode Active</h2>
                    <p class="text-xs text-neutral-700 font-bold max-w-sm">This event operates in headless mode. Public landing pages, ticketing flows, and physical check-ins are disabled.</p>
                </div>
                `}
            </div>

            <!-- Bulk Upload & Logic Filter Builder (AST) -->
            ${(currentEvent.settings?.isCertificateOnly || currentEvent.eventType === 'API_ONLY') ? `
            <div class="card-static mb-8 font-mono">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b-2 border-ink pb-4">
                    <div>
                        <h2 class="text-xl font-black uppercase text-ink">Bulk Upload &amp; Certificate Filters</h2>
                        <p class="text-xs text-neutral-700 font-bold mt-1">Configure automated AST logic rules to validate rows during participant ingestion.</p>
                    </div>
                    <button onclick="saveCertificateRequirements('${communityId}', '${eventId}')" class="btn-primary !text-xs !px-4 !py-2">
                        <i class="fas fa-save mr-1"></i> Save Filter Rules
                    </button>
                </div>
                
                <div class="mb-6">
                    <h3 class="text-sm font-bold uppercase text-ink mb-2">Upload Rules (AST Logic Builder)</h3>
                    <div id="requirements-builder" class="space-y-4 mb-4"></div>
                </div>

                <div class="border-t-2 border-ink pt-6">
                    <h3 class="text-sm font-bold uppercase text-ink mb-2">Participant Data Ingestion</h3>
                    <input type="file" id="bulk-upload-file" accept=".csv, .xlsx, .xls" class="input !p-2 mb-4" onchange="handleBulkFileChange()">
                    
                    <div id="bulk-upload-ui" class="hidden space-y-4">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-canvas border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b]">
                            <div>
                                <label class="label">Email Column (Required)</label>
                                <select id="bulk-email-col" class="input bg-white !p-2 text-xs"></select>
                            </div>
                            <div>
                                <label class="label">Name Column (Optional)</label>
                                <select id="bulk-name-col" class="input bg-white !p-2 text-xs"></select>
                            </div>
                        </div>

                        <div class="flex gap-3 justify-end pt-2">
                            <button onclick="previewBulkUpload()" class="btn-secondary">Preview Ingestion</button>
                            <button id="btn-upload-save" onclick="processBulkUpload('${communityId}', '${eventId}')" class="btn-primary">Execute Ingestion</button>
                        </div>
                        <div id="bulk-upload-preview" class="text-xs bg-ink text-cyan p-4 border-2 border-ink max-h-56 overflow-y-auto font-mono hidden shadow-[4px_4px_0_0_#0b0b0b]"></div>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Attendee Management Table -->
            <div class="bg-white border-2 border-ink shadow-[6px_6px_0_0_#0b0b0b] flex flex-col min-h-[500px] font-mono">
                <div class="p-4 sm:p-6 border-b-2 border-ink flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-canvas">
                    <div>
                        <h2 class="text-xl font-black uppercase text-ink">Attendee Roster (${currentAttendees.length})</h2>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <div class="relative flex-1 sm:flex-initial">
                            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs"></i>
                            <input type="text" id="search-attendees" placeholder="Search name / email..." class="input !py-2 !pl-8 text-xs w-full sm:w-64" onkeyup="handleSearch()">
                        </div>
                        <button onclick="openQrScanner()" class="btn-primary !text-xs !py-2">
                            <i class="fas fa-qrcode"></i> Scan QR
                        </button>
                    </div>
                </div>
                
                <div class="overflow-x-auto flex-1">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="bg-ink text-white font-mono uppercase tracking-wider border-b-2 border-ink">
                                <th class="p-3.5 font-bold">Attendee</th>
                                <th class="p-3.5 font-bold">Status</th>
                                <th class="p-3.5 font-bold">Check-In</th>
                                <th class="p-3.5 font-bold">Certificate</th>
                                <th class="p-3.5 font-bold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody id="attendee-list-container" class="divide-y-2 divide-ink/10"></tbody>
                    </table>
                </div>
            </div>

            <!-- Modals Container -->
            <div id="modal-container">
                ${modalTemplate('qr-modal', 'Scan Participant QR Code', `
                    <div class="space-y-4">
                        <div id="qr-reader" class="w-full mx-auto border-2 border-ink bg-black" style="max-width: 380px; min-height: 250px;"></div>
                        <div class="flex justify-end">
                            <button onclick="closeQrScanner()" class="btn-secondary w-full">Cancel &amp; Close Scanner</button>
                        </div>
                    </div>
                `)}
            </div>
        `;

        document.getElementById('modal-container').innerHTML += modalTemplate('edit-event', 'Edit Event Details', `
            <form onsubmit="handleEditEvent(event, '${communityId}', '${eventId}')" class="space-y-4 font-mono">
                <div>
                    <label class="label" for="edit-ev-name">Event Name</label>
                    <input type="text" id="edit-ev-name" name="name" value="${currentEvent.name || ''}" class="input" required>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="label" for="edit-ev-date">Date &amp; Time</label>
                        <input type="datetime-local" id="edit-ev-date" name="date" value="${dateValue}" class="input !p-2" required>
                    </div>
                    <div>
                        <label class="label" for="edit-ev-tz">Timezone</label>
                        <select id="edit-ev-tz" name="timezone" class="input bg-white !p-2">
                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                            <option value="UTC" selected>UTC</option>
                            <option value="America/New_York">America/New_York</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="label" for="edit-ev-loc">Location</label>
                    <input type="text" id="edit-ev-loc" name="location" value="${currentEvent.location || ''}" class="input">
                </div>
                <div>
                    <label class="label" for="edit-ev-status">Event Status</label>
                    <select id="edit-ev-status" name="status" class="input bg-white">
                        <option value="ACTIVE" ${(!currentEvent.status || currentEvent.status === 'ACTIVE') ? 'selected' : ''}>Active</option>
                        <option value="FINISHED" ${currentEvent.status === 'FINISHED' ? 'selected' : ''}>Finished (Ready for Certificates)</option>
                    </select>
                </div>
                <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                    <button type="button" onclick="closeModal('edit-event')" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>
        `);
        
        if (ctf.status === 'APPROVED' && currentEvent.eventType !== 'API_ONLY') {
            document.getElementById('modal-container').innerHTML += modalTemplate('add-ctf', 'Add CTF Challenge', `
                <form onsubmit="handleCreateCtfChallenge(event, '${communityId}', '${eventId}')" class="space-y-3 font-mono">
                    <div>
                        <label class="label" for="ctf-chal-name">Challenge Name</label>
                        <input type="text" id="ctf-chal-name" name="name" class="input" required>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="label" for="ctf-chal-cat">Category</label>
                            <input type="text" id="ctf-chal-cat" name="category" placeholder="Web, Crypto, Reverse" class="input" required>
                        </div>
                        <div>
                            <label class="label" for="ctf-chal-diff">Difficulty</label>
                            <select id="ctf-chal-diff" name="difficulty" class="input bg-white">
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="label" for="ctf-chal-score">Scoring Type</label>
                            <select id="ctf-chal-score" name="scoringType" class="input bg-white">
                                <option value="STATIC">Static</option>
                                <option value="DYNAMIC">Dynamic</option>
                            </select>
                        </div>
                        <div>
                            <label class="label" for="ctf-chal-pts">Base Points</label>
                            <input type="number" id="ctf-chal-pts" name="points" placeholder="100" class="input">
                        </div>
                    </div>
                    <div>
                        <label class="label" for="ctf-chal-desc">Description</label>
                        <textarea id="ctf-chal-desc" name="description" class="input h-20" required></textarea>
                    </div>
                    <div>
                        <label class="label" for="ctf-chal-flag">Flag</label>
                        <input type="text" id="ctf-chal-flag" name="flag" placeholder="aurum{...}" class="input" required>
                    </div>
                    <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                        <button type="button" onclick="closeModal('add-ctf')" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Create Challenge</button>
                    </div>
                </form>
            `);
            setTimeout(renderCtfChart, 500);
        }
        
        renderAttendeeList(currentAttendees);

        if (currentEvent.settings?.isCertificateOnly || currentEvent.eventType === 'API_ONLY') {
            const existingReqs = currentEvent.settings?.certificateRequirements;
            currentAST = existingReqs || { logic: 'AND', conditions: [] };
            renderASTBuilder();
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="card-static border-2 border-danger text-danger text-center font-mono font-bold uppercase p-8 my-8">Error loading event data.</div>';
    }
}

function renderCtfStatusBadge(status) {
    if (status === 'APPROVED') return '<span class="bg-success text-ink border-2 border-ink font-mono text-xs font-bold px-2.5 py-1 uppercase shadow-[2px_2px_0_0_#0b0b0b]">Active</span>';
    if (status === 'PENDING_APPROVAL') return '<span class="bg-warning text-ink border-2 border-ink font-mono text-xs font-bold px-2.5 py-1 uppercase shadow-[2px_2px_0_0_#0b0b0b]">Pending SuperAdmin</span>';
    return '<span class="bg-canvas text-neutral-700 border-2 border-ink font-mono text-xs font-bold px-2.5 py-1 uppercase">Disabled</span>';
}

function renderCtfDashboard(ctf, isSuperAdmin, cid, eid) {
    if (ctf.status === 'NONE') {
        return `
            <div class="text-center py-8 font-mono">
                <p class="text-neutral-800 font-bold mb-4">Enhance your event by hosting a Capture The Flag cybersecurity competition!</p>
                <button onclick="requestCtf('${cid}', '${eid}')" class="btn-primary">
                    <i class="fas fa-flag mr-1"></i> Request CTF Module
                </button>
            </div>`;
    }

    if (ctf.status === 'PENDING_APPROVAL') {
        let adminHtml = isSuperAdmin ? `
            <div class="mt-6 bg-canvas p-4 border-2 border-ink inline-block text-left shadow-[4px_4px_0_0_#0b0b0b]">
                <p class="font-bold text-xs uppercase text-ink mb-2">SuperAdmin Approval Required</p>
                <form onsubmit="approveCtf(event, '${cid}', '${eid}')" class="flex flex-wrap items-end gap-3 font-mono">
                    <div>
                        <label class="label">Challenge Cap (0 = Unlimited)</label>
                        <input type="number" name="challengeCap" value="20" class="input !p-2 text-xs w-32">
                    </div>
                    <button class="btn-primary !text-xs !py-2">Grant Approval</button>
                </form>
            </div>` : '';
            
        return `<div class="text-center py-8 font-mono"><i class="fas fa-clock text-3xl mb-3 text-warning"></i><br><span class="font-bold text-sm uppercase">Waiting for SuperAdmin Authorization...</span>${adminHtml}</div>`;
    }

    if (ctf.status === 'APPROVED') {
        const challengesList = ctfChallenges.map(c => `
            <div class="flex justify-between items-center bg-canvas p-3 mb-2 border-2 border-ink font-mono shadow-[2px_2px_0_0_#0b0b0b]">
                <div>
                    <span class="font-black text-xs uppercase text-ink">${escapeHtml(c.name)}</span>
                    <span class="text-[10px] text-neutral-700 ml-2 border border-ink px-1.5 py-0.5 bg-white uppercase font-bold">${escapeHtml(c.scoringType)}</span>
                </div>
                <div>
                    ${c.status === 'APPROVED' ? '<span class="text-success font-black text-xs">APPROVED</span>' : `<button onclick="approveChallenge('${escapeHtml(cid)}', '${escapeHtml(eid)}', '${escapeHtml(c.id)}')" class="btn-primary !text-[10px] !px-2 !py-1">Approve</button>`}
                </div>
            </div>
        `).join('');

        return `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
                <!-- Settings Panel -->
                <div class="bg-canvas p-5 border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b]">
                    <h3 class="font-black text-sm uppercase text-ink border-b-2 border-ink pb-2 mb-4">Competition Settings</h3>
                    <form onsubmit="saveCtfSettings(event, '${cid}', '${eid}')" class="space-y-4 text-xs">
                        <div class="grid grid-cols-2 gap-4">
                            <label class="flex items-center gap-2 cursor-pointer font-bold uppercase"><input type="checkbox" name="autoOpen" ${ctf.autoOpen ? 'checked' : ''} class="w-4 h-4 accent-cyan border-2 border-ink"> Auto Open</label>
                            <label class="flex items-center gap-2 cursor-pointer font-bold uppercase"><input type="checkbox" name="autoClose" ${ctf.autoClose ? 'checked' : ''} class="w-4 h-4 accent-cyan border-2 border-ink"> Auto Close</label>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="label">Start Time</label>
                                <input type="datetime-local" name="startTime" value="${ctf.startTime || ''}" class="input !p-2 text-xs">
                            </div>
                            <div>
                                <label class="label">End Time</label>
                                <input type="datetime-local" name="endTime" value="${ctf.endTime || ''}" class="input !p-2 text-xs">
                            </div>
                        </div>
                        <div class="flex flex-wrap justify-between items-center border-t-2 border-ink pt-3 gap-2">
                            <label class="flex items-center gap-2 cursor-pointer font-bold uppercase"><input type="checkbox" name="requireCheckIn" ${ctf.requireCheckIn ? 'checked' : ''} class="w-4 h-4 accent-cyan border-2 border-ink"> Require Check-In</label>
                            <label class="flex items-center gap-2 cursor-pointer font-bold uppercase bg-danger/10 border border-danger px-2 py-1"><input type="checkbox" name="isLive" ${ctf.isLive ? 'checked' : ''} class="w-4 h-4 accent-danger"> <span class="text-danger">Force Live</span></label>
                        </div>
                        <button class="btn-primary w-full mt-2">Save CTF Configuration</button>
                    </form>
                </div>
                
                <!-- Challenges List -->
                <div class="bg-canvas p-5 border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b] flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-center border-b-2 border-ink pb-2 mb-3">
                            <h3 class="font-black text-sm uppercase text-ink">Challenges (${ctfChallenges.length}/${ctf.challengeCap || '∞'})</h3>
                            <button onclick="openModal('add-ctf')" class="btn-primary !text-[10px] !px-2.5 !py-1">+ Add</button>
                        </div>
                        <div class="overflow-y-auto max-h-[220px]">
                            ${challengesList || '<p class="text-neutral-600 text-xs italic text-center py-6">No challenges added yet.</p>'}
                        </div>
                    </div>
                </div>
                
                <!-- Spectator Timeline -->
                <div class="col-span-1 lg:col-span-2 bg-ink text-white p-5 border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b]">
                    <h3 class="font-black text-sm uppercase text-cyan mb-3">Solve Timeline (Spectator)</h3>
                    <div style="height: 240px; width: 100%;">
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
    
    const counts = {};
    ctfSubmissions.forEach(sub => {
        const timeKey = sub.sk.split('#')[0].substring(0, 13) + ":00";
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
                borderColor: '#5ce1e6',
                backgroundColor: 'rgba(92, 225, 230, 0.2)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.15)' } },
                x: { ticks: { color: '#ffffff' }, grid: { display: false } }
            },
            plugins: {
                legend: { labels: { color: '#ffffff', font: { family: 'JetBrains Mono' } } }
            }
        }
    });
}

function renderAttendeeList(list) {
    const container = document.getElementById('attendee-list-container');
    if (!container) return;
    
    if (list.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="text-center font-mono font-bold uppercase text-neutral-600 py-12">No attendees registered yet.</td></tr>';
        return;
    }

    container.innerHTML = list.map(a => {
        const uid = a.UserID ? a.UserID.replace('USER#', '') : '';
        const statusBadge = a.status === 'APPROVED' ? '<span class="badge bg-success text-ink">APPROVED</span>' : a.status === 'REJECTED' ? '<span class="badge bg-danger text-white">REJECTED</span>' : '<span class="badge bg-warning text-ink">PENDING</span>';
        const attendeeName = a.userInfo?.name || a.userInfo?.Name || a.userInfo?.['Full Name'] || 'Unknown';
        const attendeeEmail = a.userInfo?.email || a.userInfo?.Email || 'No Email';
                            
        return `
            <tr class="hover:bg-canvas transition text-ink font-mono">
                <td class="p-3.5">
                    <div class="font-black text-xs text-ink uppercase">${escapeHtml(attendeeName)}</div>
                    <div class="text-[11px] text-neutral-700">${escapeHtml(attendeeEmail)}</div>
                </td>
                <td class="p-3.5">${statusBadge}</td>
                <td class="p-3.5">${a.checkedIn ? '<span class="text-success font-black text-xs">✅ YES</span>' : '<span class="text-neutral-500 font-bold text-xs">NO</span>'}</td>
                <td class="p-3.5">${a.certificateIssuedAt ? '<span class="text-success font-black text-xs">📜 ISSUED</span>' : '<span class="text-neutral-500 font-bold text-xs">NO</span>'}</td>
                <td class="p-3.5 text-right">
                    <button onclick="viewAttendee('${escapeHtml(uid)}')" class="btn-secondary !text-[10px] !px-2.5 !py-1">Details</button>
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
            <div class="flex gap-3 w-full mb-3 pb-3 border-b-2 border-ink">
                <button onclick="updateStatus('${escapeHtml(userId)}', 'APPROVED')" class="btn-primary !bg-success text-ink flex-1">Approve</button>
                <button onclick="updateStatus('${escapeHtml(userId)}', 'REJECTED')" class="btn-danger flex-1">Reject</button>
            </div>
        `;
    }

    if (status === 'APPROVED' || !currentEvent.settings?.requiresApproval) {
        if (!user.checkedIn) {
            actionButtons += `<button onclick="doCheckIn('${escapeHtml(userId)}', true)" class="btn-primary w-full">✅ Check In User</button>`;
        } else {
            actionButtons += `
                <div class="w-full flex justify-between items-center bg-white border-2 border-success p-3 mt-2 shadow-[2px_2px_0_0_#0b0b0b]">
                    <span class="text-success font-black text-xs uppercase">✅ Checked In</span>
                    <button onclick="doCheckIn('${escapeHtml(userId)}', false)" class="btn-danger !text-[10px] !px-2.5 !py-1">Undo Check-In</button>
                </div>
            `;
        }
    }

    if (user.certificateIssuedAt) {
        actionButtons += `
            <div class="w-full flex justify-between items-center bg-white border-2 border-warning p-3 mt-2 shadow-[2px_2px_0_0_#0b0b0b]">
                <div>
                    <span class="text-ink font-black text-xs uppercase block">📜 Certificate Issued</span>
                    <span class="text-[10px] text-neutral-600 font-bold block">Issued: ${escapeHtml(new Date(user.certificateIssuedAt).toLocaleDateString())} (Valid 2 Yrs)</span>
                </div>
                <button onclick="invalidateCertificate('${escapeHtml(userId)}')" class="btn-danger !text-[10px] !px-2.5 !py-1">Invalidate</button>
            </div>
        `;
    }

    const modalHtml = modalTemplate('attendee-modal', 'Attendee Details', `
        <div class="space-y-4 font-mono">
            <div class="p-4 bg-canvas border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b]">
                <h3 class="font-black text-base uppercase text-ink">${escapeHtml(user.userInfo?.name || user.userInfo?.Name || user.userInfo?.['Full Name'] || 'Unknown')}</h3>
                <p class="text-xs text-neutral-700 mt-1">${escapeHtml(user.userInfo?.email || user.userInfo?.Email || 'No Email')}</p>
                <p class="text-[11px] text-neutral-500 mt-2 select-all">User ID: ${escapeHtml(userId)}</p>
            </div>
            <div class="pt-2">${actionButtons}</div>
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
            if (el) el.innerHTML = `<p class="text-danger p-4 font-mono font-bold text-xs">Camera error: ${err}</p>`;
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
    if (res && res.success !== false) { window.closeModal('edit-event'); renderEvent(cid, eid); }
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
        let finalRow = { ...row };
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
        previewDiv.innerHTML = `<span class="text-danger font-bold">${res.error}</span>`;
        return;
    }
    
    let sample = res.data.slice(0, 3);
    previewDiv.innerHTML = `<div><strong>Found ${res.data.length} valid rows.</strong> ${res.rejected > 0 ? `<span class="text-danger font-bold ml-2">(${res.rejected} rejected by AST Logic filters)</span>` : ''}</div><br/>Preview (first 3 records):<br/><pre id="bulk-upload-pre" class="mt-2"></pre>`;
    document.getElementById('bulk-upload-pre').textContent = JSON.stringify(sample, null, 2);
};

window.processBulkUpload = async (cid, eid) => {
    const res = getProcessedBulkData();
    if (res.error) return alert(res.error);
    if (res.data.length === 0) return alert('No users matched your criteria.');
    
    const btn = document.getElementById('btn-upload-save');
    btn.innerText = "Ingesting...";
    btn.disabled = true;
    
    try {
        await saveCertificateRequirements(cid, eid, true);
        
        const chunkSize = 50;
        for (let i = 0; i < res.data.length; i += chunkSize) {
            const chunk = res.data.slice(i, i + chunkSize);
            await api(`/community/${cid}/event/${eid}/allowed-users`, 'POST', chunk);
        }
        alert(`Successfully allowed ${res.data.length} users!`);
        
        document.getElementById('bulk-upload-file').value = '';
        document.getElementById('bulk-upload-ui').classList.add('hidden');
        document.getElementById('bulk-upload-preview').classList.add('hidden');
        
        renderEvent(cid, eid);
    } catch (e) {
        alert("Upload failed partially or fully.");
    }
    btn.innerText = "Execute Ingestion";
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
        const conditionsHtml = (node.conditions || []).map((child, idx) => {
            return `<div class="ml-4 sm:ml-6 mt-3 border-l-4 border-ink pl-3 sm:pl-4">${window.renderASTNode(child, [...path, 'conditions', idx])}</div>`;
        }).join('');

        return `
            <div class="bg-canvas p-4 border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b]">
                <div class="flex flex-wrap gap-2 items-center mb-3">
                    <select onchange='updateASTNode(${pathStr}, "logic", this.value)' class="input !w-24 !p-1.5 bg-white font-bold text-xs">
                        <option value="AND" ${node.logic === 'AND' ? 'selected' : ''}>AND</option>
                        <option value="OR" ${node.logic === 'OR' ? 'selected' : ''}>OR</option>
                    </select>
                    <span class="text-xs text-ink font-bold uppercase">Condition Group</span>
                    <div class="ml-auto flex gap-2">
                        <button onclick='addASTNode(${pathStr})' class="btn-primary !text-[10px] !px-2.5 !py-1">+ Rule</button>
                        <button onclick='addASTGroup(${pathStr})' class="btn-secondary !text-[10px] !px-2.5 !py-1">+ Group</button>
                        ${path.length > 0 ? `<button onclick='removeASTNode(${pathStr})' class="btn-danger !text-[10px] !px-2 !py-1">Remove</button>` : ''}
                    </div>
                </div>
                <div>${conditionsHtml}</div>
            </div>
        `;
    } else {
        const safeField = escapeHTML(node.field || '');
        const safeValue = escapeHTML(node.value || '');
        return `
            <div class="flex flex-wrap gap-2 items-center bg-white p-3 border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b]">
                <input type="text" placeholder="Field (e.g. score)" value="${safeField}" onchange='updateASTNode(${pathStr}, "field", this.value)' class="input !p-2 text-xs flex-1 min-w-[120px]">
                <select onchange='updateASTNode(${pathStr}, "operator", this.value)' class="input !p-2 text-xs bg-white !w-20">
                    <option value="==" ${node.operator === '==' ? 'selected' : ''}>==</option>
                    <option value="!=" ${node.operator === '!=' ? 'selected' : ''}>!=</option>
                    <option value=">" ${node.operator === '>' ? 'selected' : ''}>&gt;</option>
                    <option value="<" ${node.operator === '<' ? 'selected' : ''}>&lt;</option>
                    <option value=">=" ${node.operator === '>=' ? 'selected' : ''}>&gt;=</option>
                    <option value="<=" ${node.operator === '<=' ? 'selected' : ''}>&lt;=</option>
                </select>
                <input type="text" placeholder="Value (e.g. 50)" value="${safeValue}" onchange='updateASTNode(${pathStr}, "value", this.value)' class="input !p-2 text-xs flex-1 min-w-[120px]">
                <button onclick='removeASTNode(${pathStr})' class="btn-danger !text-xs !px-2.5 !py-2" aria-label="Delete rule">✕</button>
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
            if (res && res.success !== false) {
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