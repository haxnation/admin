import { api, modalTemplate } from '../utils.js';

export async function renderCommunity(id) {
    document.getElementById('app').innerHTML = '<div class="text-center mt-10">Loading Community...</div>';
    
    // --- 1. FETCH DATA (Community + Transactions) ---
    try {
        const [res, txnRes] = await Promise.all([
            api(`/community/${id}`),
            api(`/community/${id}/transactions`)
        ]);

        if(!res) {
            document.getElementById('app').innerHTML = '<div class="text-red-500 text-center">Community not found</div>';
            return;
        }

        // Destructure response
        const { community, team, events, posts, permissions } = res.data;
        const transactions = txnRes?.data?.transactions || [];
        
        const completedTxns = transactions.filter(t => t.status === 'COMPLETED');
        const totalRevenue = completedTxns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        // --- 2. CAPABILITY CHECKS ---
        const myPerms = permissions || [];
        const has = (p) => myPerms.includes('ALL') || myPerms.includes(p);

        const canManageTeam   = has('MANAGE_TEAM');
        const canManageEvents = has('MANAGE_EVENTS');
        const canManagePosts  = has('MANAGE_POSTS') && community.features?.posts;
        // Check if user can manage templates (usually requires event/community management perms)
        const canManageTemplates = has('MANAGE_COMMUNITY') || has('ALL');

        // --- 3. RENDER EVENTS ---
        const eventsHtml = events.map(e => `
            <div class="flex justify-between items-center p-4 bg-white border rounded hover:bg-gray-50 mb-2 shadow-sm transition">
                <div>
                    <div class="font-bold text-gray-800">
                        ${e.name}
                        ${e.certificateSettings?.enabled ? '<span title="Certificates Enabled" class="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">📜</span>' : ''}
                    </div>
                    <div class="text-xs text-gray-500 flex gap-2 mt-1">
                        <span><i class="far fa-calendar"></i> ${e.date.replace('T', ' ')}</span>
                        <span><i class="fas fa-globe"></i> ${e.timezone || 'UTC'}</span>
                    </div>
                    <div class="text-xs text-gray-400 mt-1">
                         <i class="fas fa-map-marker-alt"></i> ${e.location || 'Online'} | <i class="fas fa-users"></i> Cap: ${e.capacity || '∞'}
                    </div>
                </div>
                
                <div class="flex items-center gap-2">
                    ${canManageEvents ? `
                        <a href="#/community/${id}/event/${e.PK.split('#')[1]}" class="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-2 rounded hover:bg-blue-100 transition">
                            MANAGE
                        </a>
                    ` : '<span class="text-xs text-gray-400 select-none bg-gray-100 px-2 py-1 rounded">View Only</span>'}
                </div>
            </div>
        `).join('');

        // --- 4. RENDER POSTS ---
        const postsHtml = (posts || []).map(p => `
            <div class="border p-3 rounded mb-2 text-sm bg-white shadow-sm">
                <div class="font-medium text-gray-800">${p.content}</div>
                <div class="text-xs text-gray-500 mt-2 flex justify-between">
                    <span><i class="far fa-clock"></i> Scheduled: ${p.scheduledDate || 'Immediate'}</span>
                    <span class="px-2 py-0.5 rounded bg-gray-100 text-gray-600">${p.status || 'DRAFT'}</span>
                </div>
            </div>
        `).join('');


        // --- 6. RENDER TEAM MANAGEMENT (Owners Only) ---
        let rolesHtml = '';
        if (canManageTeam) {
            const rolesList = (team || []).map(member => `
                <div class="flex justify-between items-start p-3 border-b last:border-0 hover:bg-gray-50 transition">
                    <div>
                        <div class="font-bold text-sm text-gray-800">${member.name}</div>
                        <div class="text-xs text-gray-500">${member.email}</div>
                        <div class="text-xs text-gray-400 font-mono mt-0.5 select-all">${member.id}</div>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] uppercase font-bold tracking-wider bg-blue-100 text-blue-800 px-2 py-1 rounded mb-1 inline-block">
                            ${member.role.replace(/_/g, ' ')}
                        </span>
                        <br>
                        <button onclick="handleRemoveRole('${id}', '${member.id}')" class="text-red-500 hover:text-red-700 text-xs font-bold mt-1 transition">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `).join('');

            rolesHtml = `
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
                    <div class="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <h3 class="font-bold text-xs text-gray-500 uppercase tracking-wider">Team Members</h3>
                        <button onclick="openModal('add-team-member')" class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition shadow-sm">
                            <i class="fas fa-plus"></i> Add Member
                        </button>
                    </div>
                    <div>
                        ${rolesList.length ? rolesList : '<p class="p-4 text-gray-400 text-xs italic text-center">No additional team members.</p>'}
                    </div>
                </div>
            `;
        }

        // --- 7. MAIN LAYOUT ASSEMBLY ---
        document.getElementById('app').innerHTML = `
            <div class="mb-8 flex justify-between items-center border-b pb-4">
                <div class="flex items-center gap-4">
                    <a href="#/dashboard" class="text-gray-400 hover:text-gray-700 transition"><i class="fas fa-arrow-left"></i></a>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-800">${community.name}</h1>
                        <p class="text-xs text-gray-400 font-mono mt-1">ID: ${id}</p>
                    </div>
                </div>
                ${canManageTemplates ? `
                    <a href="#/community/${id}/design" class="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 text-sm flex items-center gap-2 transition">
                        <span>🎨</span> Manage Default Template
                    </a>
                ` : ''}
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <div class="lg:col-span-2 space-y-8">
                    
                    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div class="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h2 class="font-bold text-gray-700 flex items-center gap-2">
                                💰 Revenue &amp; Transactions
                            </h2>
                            <a href="#/community/${id}/transactions"
                               class="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition">
                                View All <i class="fas fa-arrow-right text-[10px]"></i>
                            </a>
                        </div>
                        <div class="p-5 grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Total Revenue</p>
                                <p class="text-2xl font-black text-green-600">₹${totalRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                <p class="text-xs text-gray-400 mt-1">${completedTxns.length} completed payment${completedTxns.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">All Transactions</p>
                                <p class="text-2xl font-black text-gray-800">${transactions.length}</p>
                                <p class="text-xs text-gray-400 mt-1">across all statuses</p>
                            </div>
                        </div>
                        <div class="border-t border-gray-100 p-3 flex gap-2">
                            <a href="#/community/${id}/transactions"
                               class="flex items-center justify-center gap-2 w-1/2 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition">
                                <i class="fas fa-table"></i> Open Transactions
                            </a>
                            ${canManageTemplates ? `
                            <button onclick="openApiIntegrations('${id}')" class="flex items-center justify-center gap-2 w-1/2 py-2 text-sm font-semibold text-purple-600 hover:bg-purple-50 rounded-lg transition">
                                <i class="fas fa-code"></i> API Integrations
                            </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="font-bold text-lg text-gray-700">Events</h2>
                            ${canManageEvents ? `
                                <button onclick="openModal('create-event')" class="text-sm bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 transition shadow-sm">
                                    <i class="fas fa-plus text-blue-500"></i> New Event
                                </button>
                            ` : ''}
                        </div>
                        <div class="space-y-2">
                            ${eventsHtml.length ? eventsHtml : `
                                <div class="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
                                    <i class="far fa-calendar-times text-2xl mb-2"></i><br>No events found
                                </div>
                            `}
                        </div>
                    </div>

                    ${community.features?.posts ? `
                        <div class="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <div class="flex justify-between items-center mb-6">
                                <h2 class="font-bold text-lg text-gray-700">Social Posts</h2>
                                ${canManagePosts ? `
                                    <button onclick="openModal('create-post')" class="text-sm bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700 transition shadow-sm">
                                        <i class="fas fa-pen"></i> Create Post
                                    </button>
                                ` : '<span class="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded">View Only</span>'}
                            </div>
                            <div class="space-y-2">
                                ${postsHtml.length ? postsHtml : `
                                    <div class="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
                                        <i class="far fa-comment-alt text-2xl mb-2"></i><br>No posts yet
                                    </div>
                                `}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="lg:col-span-1">
                    ${rolesHtml}
                    
                    <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm text-sm text-gray-600">
                        <h4 class="font-bold text-gray-800 mb-4 pb-2 border-b">Community Details</h4>
                        
                        <div class="mb-4">
                            <span class="block text-xs text-gray-400 uppercase tracking-wide mb-1">Owner</span>
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                    ${community.ownerDetails?.name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                    <span class="font-medium text-gray-800 block">${community.ownerDetails?.name || 'Unknown'}</span>
                                    <span class="text-xs text-gray-400">${community.ownerDetails?.email || ''}</span>
                                </div>
                            </div>
                        </div>

                        <div class="mb-4">
                            <span class="block text-xs text-gray-400 uppercase tracking-wide mb-1">Your Capabilities</span>
                            <div class="flex flex-wrap gap-1">
                                ${myPerms.length ? myPerms.map(p => `
                                    <span class="bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded text-[10px] font-mono">
                                        ${p}
                                    </span>
                                `).join('') : '<span class="text-gray-400 text-xs">Read Only</span>'}
                            </div>
                        </div>

                        ${canManageTemplates ? `
                        <div class="mt-4 pt-4 border-t border-gray-100">
                            <span class="block text-xs text-gray-400 uppercase tracking-wide mb-2">B2B API Access</span>
                            <div class="flex items-center justify-between">
                                <span class="font-bold text-sm ${
                                    community.b2bStatus === 'APPROVED' ? 'text-green-600' :
                                    community.b2bStatus === 'PENDING' ? 'text-yellow-600' :
                                    community.b2bStatus === 'REJECTED' || community.b2bStatus === 'REVOKED' ? 'text-red-600' :
                                    'text-gray-500'
                                }">${community.b2bStatus || 'UNAPPLIED'}</span>
                                
                                ${(!community.b2bStatus || community.b2bStatus === 'UNAPPLIED') ? `
                                    <button onclick="window.applyForB2B('${id}')" class="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-1 rounded transition font-bold">Apply Now</button>
                                ` : ''}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            ${modalTemplate('create-event', 'Create New Event', `
                <form onsubmit="handleCreateEvent(event, '${id}')">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Event Name</label>
                            <input type="text" name="name" placeholder="e.g. Hackathon 2024" class="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" required>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Date & Time</label>
                                <input type="datetime-local" name="date" class="w-full border border-gray-300 p-2 rounded text-sm" required>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Timezone</label>
                                <select name="timezone" class="w-full border border-gray-300 p-2 rounded text-sm bg-white">
                                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">New York (EST)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                            <input type="text" name="location" placeholder="Venue Address or 'Online'" class="w-full border border-gray-300 p-2 rounded">
                        </div>

                        <div>
                             <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Custom Link</label>
                            <div class="flex">
                                 <span class="bg-gray-100 border border-r-0 border-gray-300 p-2 rounded-l text-gray-500 text-sm">haxnation.org/</span>
                                 <input type="text" name="customSlug" placeholder="my-event-slug" class="w-full border border-gray-300 p-2 rounded-r" required>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3">
                             <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Capacity</label>
                                <input type="number" name="capacity" placeholder="e.g. 100" class="w-full border border-gray-300 p-2 rounded">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Ticket Price</label>
                                <input type="number" name="ticketPrice" placeholder="0 = Free" class="w-full border border-gray-300 p-2 rounded">
                            </div>
                        </div>

                        <div class="flex gap-4 pt-2">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="requiresApproval" class="rounded text-blue-600 focus:ring-blue-500"> 
                                <span class="text-sm text-gray-700">Approval Required</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="enableWaitlist" class="rounded text-blue-600 focus:ring-blue-500"> 
                                <span class="text-sm text-gray-700">Enable Waitlist</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="isCertificateOnly" class="rounded text-blue-600 focus:ring-blue-500"> 
                                <span class="text-sm text-gray-700 font-bold">Certificate Only Event</span>
                            </label>
                        </div>

                        <button class="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition mt-2">Create Event</button>
                    </div>
                </form>
            `)}

            ${modalTemplate('create-post', 'Create Social Post', `
                <form onsubmit="handleCreatePost(event, '${id}')">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Post Content</label>
                            <textarea name="content" placeholder="What's happening?" class="w-full border border-gray-300 p-2 rounded h-32 focus:ring-2 focus:ring-slate-500 outline-none" required></textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Schedule Date</label>
                            <input type="date" name="scheduledDate" class="w-full border border-gray-300 p-2 rounded">
                            <p class="text-xs text-gray-400 mt-1">Leave blank to post immediately.</p>
                        </div>
                        <button class="w-full bg-slate-800 text-white font-bold py-3 rounded hover:bg-slate-900 transition">Schedule Post</button>
                    </div>
                </form>
            `)}

            ${modalTemplate('add-team-member', 'Add Team Member', `
                <form onsubmit="handleAssignRole(event, '${id}')">
                    <div class="mb-6">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Lookup User</label>
                        <div class="flex gap-2">
                            <input type="text" id="input-user-id" name="userId" placeholder="Enter User ID (e.g. user_...)" class="flex-1 border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" required>
                            <button type="button" onclick="verifyUser('${id}')" class="bg-gray-100 border border-gray-300 text-gray-700 px-4 rounded hover:bg-gray-200 text-sm font-medium transition">
                                Verify
                            </button>
                        </div>
                        <div id="user-verify-result" class="text-sm mt-2 min-h-[20px]"></div>
                    </div>

                    <div class="mb-6">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Assign Role</label>
                        <select name="role" class="w-full border border-gray-300 p-2 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="COMMUNITY_MANAGER">Community Manager (Events, Posts, Settings)</option>
                            <option value="USER_MANAGER">User Manager (Approve/Reject Attendees)</option>
                            <option value="SOCIAL_MEDIA_MANAGER">Social Media Manager (Posts Only)</option>
                            <option value="CHECKIN_MANAGER">Check-in Manager (Gate Access Only)</option>
                            <option value="CTF_MAKER">CTF Maker (Create Challenges)</option>
                            <option value="CTF_APPROVER">CTF Approver (Create & Approve Challenges)</option>
                            <option value="CTF_SPECTATOR">CTF Spectator (View Stats Only)</option>
                        </select>
                    </div>

                    <button id="btn-add-member" class="w-full bg-green-600 text-white font-bold py-3 rounded opacity-50 cursor-not-allowed transition" disabled>
                        Add Member
                    </button>
                </form>
            `)}
        `;

    } catch(e) {
        console.error(e);
        document.getElementById('app').innerHTML = '<div class="text-red-500 text-center mt-10">Error loading community data.</div>';
    }
}

// --- HANDLERS (Attached to Window) ---

window.verifyUser = async (cid) => {
    const input = document.getElementById('input-user-id');
    const resultDiv = document.getElementById('user-verify-result');
    const addBtn = document.getElementById('btn-add-member');
    
    if (!input.value) {
        resultDiv.innerHTML = '<span class="text-red-500 text-xs">Please enter an ID first.</span>';
        return;
    }

    resultDiv.innerHTML = '<span class="text-gray-500 flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i> Searching...</span>';
    
    const res = await api('/users/lookup', 'POST', { userId: input.value });
    
    if (res && res.success) {
        resultDiv.innerHTML = `
            <div class="flex items-start gap-3 bg-green-50 border border-green-200 p-2 rounded mt-2">
                <div class="text-green-600 mt-0.5"><i class="fas fa-check-circle"></i></div>
                <div>
                    <div class="font-bold text-green-800 text-sm">${res.data.name}</div>
                    <div class="text-xs text-green-600">${res.data.email}</div>
                </div>
            </div>`;
        addBtn.disabled = false;
        addBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        addBtn.classList.add('hover:bg-green-700');
    } else {
        resultDiv.innerHTML = `
            <div class="text-red-600 text-sm mt-1">
                <i class="fas fa-times-circle"></i> User not found. Check ID.
            </div>`;
        addBtn.disabled = true;
        addBtn.classList.add('opacity-50', 'cursor-not-allowed');
        addBtn.classList.remove('hover:bg-green-700');
    }
};

window.handleCreateEvent = async (e, cid) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    const res = await api(`/community/${cid}/event`, 'POST', body);
    if(res && res.success) {
        window.closeModal('create-event');
        renderCommunity(cid);
    } else alert(res?.error || 'Failed to create event');
};

window.handleCreatePost = async (e, cid) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    await api(`/community/${cid}/post`, 'POST', body);
    window.closeModal('create-post');
    renderCommunity(cid);
};

window.handleAssignRole = async (e, cid) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { communityId: cid, userId: fd.get('userId'), role: fd.get('role') };
    const res = await api('/role/assign', 'POST', body);
    if (res && res.success) {
        window.closeModal('add-team-member');
        renderCommunity(cid); 
    } else {
        alert(res?.error || 'Failed to assign role');
    }
};

window.handleRemoveRole = async (cid, uid) => {
    if(!confirm('Are you sure you want to remove this team member? Their access will be revoked immediately.')) return;
    const res = await api('/role/remove', 'POST', { communityId: cid, userId: uid });
    if (res && res.success) {
        renderCommunity(cid);
    } else {
        alert(res?.error || 'Failed to remove role');
    }
};

window.openApiIntegrations = (cid) => {
    window.location.hash = `/community/${cid}/api-clients`;
};

window.applyForB2B = async (cid) => {
    if(!confirm('Are you sure you want to apply for B2B API Access?')) return;
    const res = await api(`/community/${cid}/b2b/apply`, 'POST');
    if (res && res.success) {
        alert('Application submitted successfully!');
        renderCommunity(cid);
    } else {
        alert(res?.error || 'Failed to submit application');
    }
};