import { api, modalTemplate } from '../utils.js';
import { currentUser } from '../auth.js';

export async function renderCommunity(id) {
    document.getElementById('app').innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 gap-4">
            <div class="w-10 h-10 bg-ink border-4 border-cyan shadow-[4px_4px_0_0_#5ce1e6] animate-[spin_1s_steps(4)_infinite]"></div>
            <p class="font-mono text-xs uppercase font-bold text-ink tracking-widest animate-pulse">[ LOADING COMMUNITY DATA... ]</p>
        </div>
    `;
    
    // --- 1. FETCH DATA (Community + Transactions) ---
    try {
        const res = await api(`/community/${id}`);
        if(!res || !res.success) {
            document.getElementById('app').innerHTML = '<div class="card-static border-2 border-danger text-danger text-center font-mono font-bold uppercase p-8 my-8">Community not found</div>';
            return;
        }

        const { community, team, events, posts, permissions } = res.data;

        let transactions = [];
        let usages = [];
        if (community.communityType === 'SUPER') {
            const txnRes = await api(`/community/${id}/transactions`);
            if (txnRes && txnRes.success) transactions = txnRes.data.transactions || [];
        } else {
            const usagesRes = await api(`/community/${id}/apikeys/usages`);
            if (usagesRes && usagesRes.success) usages = usagesRes.data.usages || [];
        }
        
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
            <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border-2 border-ink shadow-[3px_3px_0_0_#0b0b0b] mb-3 hover:translate-x-[1px] hover:translate-y-[1px] transition-all gap-4">
                <div>
                    <div class="font-black text-lg text-ink font-mono uppercase flex items-center flex-wrap gap-2">
                        ${e.name}
                        ${e.certificateSettings?.enabled ? '<span title="Certificates Enabled" class="bg-warning text-ink border-2 border-ink text-[10px] font-mono font-bold px-1.5 py-0.5 shadow-[1px_1px_0_0_#0b0b0b]">📜 CERTIFICATE</span>' : ''}
                        ${e.eventType === 'API_ONLY' ? '<span class="bg-ink text-cyan border-2 border-ink text-[10px] font-mono font-bold px-1.5 py-0.5">API-ONLY</span>' : ''}
                    </div>
                    <div class="text-xs font-mono font-semibold text-neutral-700 flex flex-wrap gap-3 mt-1.5">
                        <span><i class="far fa-calendar text-ink mr-1"></i> ${e.date ? e.date.replace('T', ' ') : 'N/A'}</span>
                        <span><i class="fas fa-globe text-ink mr-1"></i> ${e.timezone || 'UTC'}</span>
                        <span><i class="fas fa-map-marker-alt text-ink mr-1"></i> ${e.location || 'Online'}</span>
                        ${e.eventType !== 'API_ONLY' ? `<span><i class="fas fa-users text-ink mr-1"></i> Cap: ${e.capacity || '∞'}</span>` : ''}
                    </div>
                </div>
                
                <div class="flex items-center gap-2 self-end sm:self-center">
                    ${canManageEvents ? `
                        <a href="#/community/${id}/event/${e.PK.split('#')[1]}" class="btn-secondary !text-xs !px-4 !py-2">
                            Manage <i class="fas fa-arrow-right ml-1"></i>
                        </a>
                    ` : '<span class="text-xs font-mono font-bold text-neutral-500 bg-canvas border border-ink px-2.5 py-1">Read Only</span>'}
                </div>
            </div>
        `).join('');

        // --- 4. RENDER POSTS ---
        const postsHtml = (posts || []).map(p => `
            <div class="border-2 border-ink p-4 mb-3 bg-white shadow-[2px_2px_0_0_#0b0b0b]">
                <div class="font-sans font-medium text-ink text-sm leading-relaxed">${p.content}</div>
                <div class="font-mono text-xs font-bold text-neutral-700 mt-3 pt-2 border-t border-ink/20 flex justify-between items-center">
                    <span><i class="far fa-clock text-ink mr-1"></i> Scheduled: ${p.scheduledDate || 'Immediate'}</span>
                    <span class="px-2 py-0.5 bg-canvas border border-ink text-ink uppercase text-[10px]">${p.status || 'DRAFT'}</span>
                </div>
            </div>
        `).join('');


        // --- 6. RENDER TEAM MANAGEMENT (Owners Only) ---
        let rolesHtml = '';
        if (canManageTeam) {
            const rolesList = (team || []).map(member => `
                <div class="flex justify-between items-start p-3 border-b-2 border-ink/20 last:border-0 hover:bg-canvas transition">
                    <div>
                        <div class="font-bold text-sm text-ink font-mono">${member.name}</div>
                        <div class="text-xs text-neutral-700 font-sans">${member.email}</div>
                        <div class="text-[11px] text-neutral-500 font-mono mt-0.5 select-all">ID: ${member.id}</div>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] uppercase font-mono font-bold tracking-wider bg-cyan border-2 border-ink text-ink px-2 py-0.5 mb-1 inline-block shadow-[1px_1px_0_0_#0b0b0b]">
                            ${member.role.replace(/_/g, ' ')}
                        </span>
                        <br>
                        <button onclick="handleRemoveRole('${id}', '${member.id}')" class="btn-danger !text-[10px] !px-2 !py-0.5 mt-1">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `).join('');

            rolesHtml = `
                <div class="bg-white border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] mb-6 overflow-hidden">
                    <div class="p-4 bg-canvas border-b-2 border-ink flex justify-between items-center">
                        <h3 class="font-mono font-bold text-xs text-ink uppercase tracking-wider">Team Members (${(team || []).length})</h3>
                        <button onclick="openModal('add-team-member')" class="btn-primary !text-xs !px-3 !py-1.5">
                            <i class="fas fa-plus"></i> Add Member
                        </button>
                    </div>
                    <div>
                        ${rolesList.length ? rolesList : '<p class="p-6 text-neutral-600 text-xs font-mono italic text-center">No additional team members assigned.</p>'}
                    </div>
                </div>
            `;
        }

        // --- 7. MAIN LAYOUT ASSEMBLY ---
        document.getElementById('app').innerHTML = `
            <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-ink pb-6">
                <div class="flex items-center gap-4">
                    <a href="#/dashboard" class="btn-secondary !px-3 !py-2" aria-label="Back to dashboard">
                        <i class="fas fa-arrow-left"></i>
                    </a>
                    <div>
                        <h1 class="text-2xl sm:text-4xl font-black font-mono text-ink uppercase tracking-tight flex items-center flex-wrap gap-2">
                            ${community.name}
                            ${community.communityType === 'SUPER' ? '<span class="bg-warning text-ink border-2 border-ink text-xs px-2.5 py-1 font-mono font-black tracking-wider uppercase shadow-[2px_2px_0_0_#0b0b0b]"><i class="fas fa-crown text-ink mr-1"></i> SUPER</span>' : '<span class="bg-canvas text-ink border-2 border-ink text-xs px-2.5 py-1 font-mono font-bold tracking-wider uppercase shadow-[2px_2px_0_0_#0b0b0b]">STANDARD</span>'}
                        </h1>
                        <p class="text-xs text-neutral-700 font-mono font-bold mt-1">ID: ${id}</p>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    ${(currentUser.platformRole === 'SUPER_ADMIN' && community.communityType !== 'SUPER') ? `
                        <button onclick="window.promoteCommunity('${id}')" class="btn-primary !bg-warning hover:!bg-yellow-400 text-ink">
                            <i class="fas fa-crown mr-1"></i> Promote to SUPER
                        </button>
                    ` : ''}
                    ${canManageTemplates ? `
                        <button onclick="window.openModal('community-settings-modal')" class="btn-secondary">
                            <i class="fas fa-cog mr-1"></i> Settings
                        </button>
                        <a href="#/community/${id}/design" class="btn-primary">
                            <i class="fas fa-palette mr-1"></i> Default Template
                        </a>
                    ` : ''}
                </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                <div class="lg:col-span-2 space-y-8">
                    
                    <!-- Metrics Card -->
                    <div class="bg-white border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] overflow-hidden">
                        ${community.communityType === 'SUPER' ? `
                        <div class="p-4 bg-canvas border-b-2 border-ink flex justify-between items-center font-mono">
                            <h2 class="font-black text-sm uppercase text-ink flex items-center gap-2">
                                💰 Revenue &amp; Transactions
                            </h2>
                            <a href="#/community/${id}/transactions"
                               class="text-xs font-bold text-ink hover:text-cyan underline flex items-center gap-1.5 uppercase transition">
                                View All <i class="fas fa-arrow-right text-[10px]"></i>
                            </a>
                        </div>
                        <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono">
                            <div class="bg-canvas border-2 border-ink p-4 shadow-[2px_2px_0_0_#0b0b0b]">
                                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Total Revenue</p>
                                <p class="text-3xl font-black text-success">₹${totalRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                <p class="text-xs text-neutral-600 mt-1 font-semibold">${completedTxns.length} completed payment${completedTxns.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div class="bg-canvas border-2 border-ink p-4 shadow-[2px_2px_0_0_#0b0b0b]">
                                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">All Transactions</p>
                                <p class="text-3xl font-black text-ink">${transactions.length}</p>
                                <p class="text-xs text-neutral-600 mt-1 font-semibold">across all statuses</p>
                            </div>
                        </div>
                        <div class="border-t-2 border-ink p-4 flex flex-col sm:flex-row gap-3">
                            <a href="#/community/${id}/transactions"
                               class="btn-secondary flex-1">
                                <i class="fas fa-table"></i> Open Transactions
                            </a>
                            ${canManageTemplates ? `
                            <button onclick="openApiIntegrations('${id}')" class="btn-secondary flex-1">
                                <i class="fas fa-code"></i> API Integrations
                            </button>
                            ` : ''}
                        </div>
                        ` : community.communityType === 'B2B' ? `
                        <div class="p-4 bg-canvas border-b-2 border-ink flex justify-between items-center font-mono">
                            <h2 class="font-black text-sm uppercase text-ink flex items-center gap-2">
                                🔑 Credits &amp; API Usage
                            </h2>
                        </div>
                        <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono">
                            <div class="bg-canvas border-2 border-ink p-4 shadow-[2px_2px_0_0_#0b0b0b]">
                                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Remaining Credits</p>
                                <p class="text-3xl font-black text-cyan">${community.credits || 0}</p>
                                <p class="text-xs text-neutral-600 mt-1 font-semibold">available for API</p>
                            </div>
                            <div class="bg-canvas border-2 border-ink p-4 shadow-[2px_2px_0_0_#0b0b0b]">
                                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Certificates Generated</p>
                                <p class="text-3xl font-black text-ink">${usages.length}</p>
                                <p class="text-xs text-neutral-600 mt-1 font-semibold">deducted via API</p>
                            </div>
                        </div>
                        <div class="border-t-2 border-ink p-4 flex flex-col sm:flex-row gap-3">
                            ${canManageTemplates ? `
                            <button onclick="openApiIntegrations('${id}')" class="btn-secondary flex-1">
                                <i class="fas fa-code"></i> Manage API Integrations
                            </button>
                            ` : ''}
                            <a href="#/community/${id}/api-usage" class="btn-secondary flex-1">
                                <i class="fas fa-list-alt"></i> View Detailed Logs
                            </a>
                        </div>
                        ` : `
                        <div class="p-4 bg-canvas border-b-2 border-ink flex justify-between items-center font-mono">
                            <h2 class="font-black text-sm uppercase text-ink flex items-center gap-2">
                                📊 Events &amp; Attendees
                            </h2>
                        </div>
                        <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono">
                            <div class="bg-canvas border-2 border-ink p-4 shadow-[2px_2px_0_0_#0b0b0b]">
                                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Total Events</p>
                                <p class="text-3xl font-black text-cyan">${events.length}</p>
                                <p class="text-xs text-neutral-600 mt-1 font-semibold">hosted by community</p>
                            </div>
                            <div class="bg-canvas border-2 border-ink p-4 shadow-[2px_2px_0_0_#0b0b0b]">
                                <p class="text-xs text-neutral-700 uppercase tracking-wider font-bold mb-1">Total Attendees</p>
                                <p class="text-3xl font-black text-ink">${events.reduce((sum, e) => sum + (parseInt(e.stats?.registered) || 0), 0)}</p>
                                <p class="text-xs text-neutral-600 mt-1 font-semibold">across all events</p>
                            </div>
                        </div>
                        `}
                    </div>

                    <!-- Events List -->
                    <div class="bg-white border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] p-6">
                        <div class="flex justify-between items-center mb-6 border-b-2 border-ink pb-4">
                            <h2 class="font-mono font-black text-xl text-ink uppercase">Events (${events.length})</h2>
                            ${canManageEvents ? `
                                <button onclick="openModal('create-event')" class="btn-primary !text-xs !px-4 !py-2">
                                    <i class="fas fa-plus"></i> New Event
                                </button>
                            ` : ''}
                        </div>
                        <div>
                            ${eventsHtml.length ? eventsHtml : `
                                <div class="text-center py-12 text-neutral-600 font-mono font-bold uppercase border-2 border-dashed border-ink p-6">
                                    <i class="far fa-calendar-times text-3xl mb-3 text-ink"></i><br>No events found for this community
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Social Posts Section -->
                    ${community.features?.posts ? `
                        <div class="bg-white border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] p-6">
                            <div class="flex justify-between items-center mb-6 border-b-2 border-ink pb-4">
                                <h2 class="font-mono font-black text-xl text-ink uppercase">Social Posts</h2>
                                ${canManagePosts ? `
                                    <button onclick="openModal('create-post')" class="btn-primary !text-xs !px-4 !py-2">
                                        <i class="fas fa-pen"></i> Create Post
                                    </button>
                                ` : '<span class="text-xs font-mono font-bold text-neutral-500 bg-canvas border border-ink px-2 py-1">View Only</span>'}
                            </div>
                            <div>
                                ${postsHtml.length ? postsHtml : `
                                    <div class="text-center py-12 text-neutral-600 font-mono font-bold uppercase border-2 border-dashed border-ink p-6">
                                        <i class="far fa-comment-alt text-3xl mb-3 text-ink"></i><br>No social posts yet
                                    </div>
                                `}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Right Sidebar -->
                <div class="lg:col-span-1">
                    ${rolesHtml}
                    
                    <div class="bg-white p-6 border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] font-mono">
                        <h4 class="font-black text-base text-ink uppercase mb-4 pb-2 border-b-2 border-ink">Community Details</h4>
                        
                        <div class="mb-4">
                            <span class="block text-xs font-bold text-neutral-700 uppercase tracking-wide mb-1">Owner</span>
                            <div class="flex items-center gap-3 bg-canvas border-2 border-ink p-3 shadow-[2px_2px_0_0_#0b0b0b]">
                                <div class="w-8 h-8 bg-cyan border-2 border-ink flex items-center justify-center text-ink font-black text-sm">
                                    ${community.ownerDetails?.name?.charAt(0) || 'U'}
                                </div>
                                <div class="overflow-hidden">
                                    <span class="font-bold text-ink text-xs uppercase block truncate">${community.ownerDetails?.name || 'Unknown'}</span>
                                    <span class="text-[11px] text-neutral-700 block truncate">${community.ownerDetails?.email || ''}</span>
                                </div>
                            </div>
                        </div>

                        <div class="mb-4">
                            <span class="block text-xs font-bold text-neutral-700 uppercase tracking-wide mb-1.5">Your Capabilities</span>
                            <div class="flex flex-wrap gap-1.5">
                                ${myPerms.length ? myPerms.map(p => `
                                    <span class="bg-canvas text-ink border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase shadow-[1px_1px_0_0_#0b0b0b]">
                                        ${p}
                                    </span>
                                `).join('') : '<span class="text-neutral-600 text-xs italic">Read Only</span>'}
                            </div>
                        </div>

                        ${canManageTemplates ? `
                        <div class="mt-4 pt-4 border-t-2 border-ink">
                            <span class="block text-xs font-bold text-neutral-700 uppercase tracking-wide mb-2">B2B API Access</span>
                            <div class="flex items-center justify-between bg-canvas border-2 border-ink p-3">
                                <span class="font-black text-xs uppercase ${ community.b2bStatus === 'APPROVED' ? 'text-success' : community.b2bStatus === 'PENDING' ? 'text-warning bg-ink px-1.5 py-0.5' : community.b2bStatus === 'REJECTED' || community.b2bStatus === 'REVOKED' ? 'text-danger' : 'text-neutral-700' }">${community.b2bStatus || 'UNAPPLIED'}</span>
                                
                                ${(!community.b2bStatus || community.b2bStatus === 'UNAPPLIED') ? `
                                    <button onclick="window.applyForB2B('${id}')" class="btn-primary !text-[10px] !px-2.5 !py-1">Apply Now</button>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div class="mt-4 pt-4 border-t-2 border-ink">
                            <span class="block text-xs font-bold text-neutral-700 uppercase tracking-wide mb-2">Account Credits</span>
                            <div class="flex items-center justify-between bg-canvas border-2 border-ink p-3">
                                <span class="font-black text-lg text-ink"><i class="fas fa-coins text-yellow-500 mr-1.5"></i>${community.credits || 0}</span>
                                <a href="#/community/${id}/api-keys" class="btn-secondary !text-[10px] !px-2.5 !py-1">Manage Keys</a>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Modals -->
            ${modalTemplate('create-event', 'Create New Event', `
                <form onsubmit="handleCreateEvent(event, '${id}')" class="space-y-4 font-mono">
                    <div>
                        <label class="label" for="ev-name">Event Name</label>
                        <input type="text" id="ev-name" name="name" placeholder="e.g. CyberSecurity Summit 2026" class="input" required>
                    </div>
                    
                    ${community.communityType === 'SUPER' ? `
                        <div class="bg-canvas border-2 border-ink p-3 my-3">
                            <label class="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="isApiOnly" id="is-api-only-toggle" onchange="window.toggleEventTypeUI()" class="w-4 h-4 accent-cyan border-2 border-ink"> 
                                <span class="text-xs font-bold text-ink uppercase">API-Only Event</span>
                            </label>
                            <p class="text-[11px] text-neutral-700 mt-1 ml-7">Hides public pages and check-ins. Tailored for headless API-driven certificate generation.</p>
                        </div>
                    ` : `
                        <div class="bg-canvas border-2 border-ink p-3 my-3">
                            <span class="text-xs font-bold text-ink uppercase flex items-center gap-2"><i class="fas fa-info-circle text-cyan"></i> Standard Community Mode</span>
                            <p class="text-[11px] text-neutral-700 mt-1">Standard communities can only create API-Only events. Upgrade to SUPER for full-featured ticketed events.</p>
                            <input type="hidden" name="isApiOnly" value="on">
                        </div>
                    `}

                    <div id="full-feature-fields" class="${community.communityType !== 'SUPER' ? 'hidden' : ''}">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div>
                                <label class="label" for="input-event-date">Date & Time</label>
                                <input type="datetime-local" id="input-event-date" name="date" class="input !p-2" ${community.communityType === 'SUPER' ? 'required' : ''}>
                            </div>
                            <div>
                                <label class="label" for="ev-timezone">Timezone</label>
                                <select id="ev-timezone" name="timezone" class="input !p-2 bg-white">
                                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">New York (EST)</option>
                                </select>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="label" for="ev-location">Location / Venue</label>
                            <input type="text" id="ev-location" name="location" placeholder="e.g. IIT Bombay, Auditorium 1 or Online" class="input">
                        </div>

                        <div class="mb-3">
                            <label class="label" for="input-custom-slug">Custom Link</label>
                            <div class="flex">
                                <span class="bg-canvas border-2 border-r-0 border-ink p-3 text-ink text-xs font-bold select-none">haxnation.org/</span>
                                <input type="text" name="customSlug" id="input-custom-slug" placeholder="my-event-slug" class="input !border-l-0" ${community.communityType === 'SUPER' ? 'required' : ''}>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3 my-3 bg-canvas border-2 border-ink p-3">
                            <label class="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-ink">
                                <input type="checkbox" name="requiresApproval" class="w-4 h-4 accent-cyan border-2 border-ink"> 
                                <span>Approval Required</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-ink">
                                <input type="checkbox" name="enableWaitlist" class="w-4 h-4 accent-cyan border-2 border-ink"> 
                                <span>Enable Waitlist</span>
                            </label>
                        </div>

                        <div class="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <label class="label" for="ev-cap">Capacity</label>
                                <input type="number" id="ev-cap" name="capacity" placeholder="e.g. 100 (Blank = ∞)" class="input">
                            </div>
                            <div>
                                <label class="label" for="ev-price">Ticket Price (INR)</label>
                                <input type="number" id="ev-price" name="ticketPrice" placeholder="0 = Free" class="input">
                            </div>
                        </div>

                        <div class="bg-canvas border-2 border-ink p-3 mb-3">
                            <label class="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-ink">
                                <input type="checkbox" name="isCertificateOnly" class="w-4 h-4 accent-cyan border-2 border-ink"> 
                                <span>Certificate-Only Event</span>
                            </label>
                        </div>
                    </div>

                    <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                        <button type="button" onclick="closeModal('create-event')" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Create Event</button>
                    </div>
                </form>
            `)}

            ${modalTemplate('create-post', 'Create Social Post', `
                <form onsubmit="handleCreatePost(event, '${id}')" class="space-y-4 font-mono">
                    <div>
                        <label class="label" for="post-content">Post Content</label>
                        <textarea id="post-content" name="content" placeholder="Share updates with your community..." class="input h-32" required></textarea>
                    </div>
                    <div>
                        <label class="label" for="post-date">Schedule Date</label>
                        <input type="date" id="post-date" name="scheduledDate" class="input">
                        <p class="font-mono text-[11px] text-neutral-600 mt-1">Leave blank to publish immediately.</p>
                    </div>
                    <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                        <button type="button" onclick="closeModal('create-post')" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Publish Post</button>
                    </div>
                </form>
            `)}

            ${modalTemplate('add-team-member', 'Add Team Member', `
                <form onsubmit="handleAssignRole(event, '${id}')" class="space-y-4 font-mono">
                    <div>
                        <label class="label" for="input-user-id">Lookup User</label>
                        <div class="flex gap-2">
                            <input type="text" id="input-user-id" name="userId" placeholder="Enter User ID (e.g. user_...)" class="input flex-1" required>
                            <button type="button" onclick="verifyUser('${id}')" class="btn-secondary">
                                Verify
                            </button>
                        </div>
                        <div id="user-verify-result" class="text-xs mt-2 min-h-[20px]"></div>
                    </div>

                    <div>
                        <label class="label" for="member-role">Assign Role</label>
                        <select id="member-role" name="role" class="input bg-white">
                            <option value="COMMUNITY_MANAGER">Community Manager (Events, Posts, Settings)</option>
                            <option value="USER_MANAGER">User Manager (Approve/Reject Attendees)</option>
                            <option value="SOCIAL_MEDIA_MANAGER">Social Media Manager (Posts Only)</option>
                            <option value="CHECKIN_MANAGER">Check-in Manager (Gate Access Only)</option>
                            <option value="CTF_MAKER">CTF Maker (Create Challenges)</option>
                            <option value="CTF_APPROVER">CTF Approver (Create &amp; Approve Challenges)</option>
                            <option value="CTF_SPECTATOR">CTF Spectator (View Stats Only)</option>
                        </select>
                    </div>

                    <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                        <button type="button" onclick="closeModal('add-team-member')" class="btn-secondary">Cancel</button>
                        <button id="btn-add-member" type="submit" class="btn-primary opacity-50 cursor-not-allowed" disabled>
                            Add Member
                        </button>
                    </div>
                </form>
            `)}

            ${modalTemplate('community-settings-modal', 'Community Settings', `
                <form onsubmit="handleSaveCommunitySettings(event, '${id}')" class="space-y-4 font-mono">
                    <div>
                        <label class="label" for="cert-prefix">Custom Certificate URL Prefix</label>
                        <input type="text" id="cert-prefix" name="customCertificateUrlPrefix" value="${community.settings?.customCertificateUrlPrefix || ''}" placeholder="e.g. https://my-domain.com/validate?id=" class="input">
                        <p class="font-mono text-[11px] text-neutral-600 mt-1.5">Overrides the default verification link embedded on generated certificates for API-Only events.</p>
                    </div>
                    <div class="pt-4 border-t-2 border-ink flex justify-end gap-3">
                        <button type="button" onclick="closeModal('community-settings-modal')" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Save Settings</button>
                    </div>
                </form>
            `)}
        `;

    } catch(e) {
        console.error(e);
        document.getElementById('app').innerHTML = '<div class="card-static border-2 border-danger text-danger text-center font-mono font-bold uppercase p-8 my-8">Error loading community data.</div>';
    }
}

// --- HANDLERS (Attached to Window) ---

window.verifyUser = async (cid) => {
    const input = document.getElementById('input-user-id');
    const resultDiv = document.getElementById('user-verify-result');
    const addBtn = document.getElementById('btn-add-member');
    
    if (!input.value) {
        resultDiv.innerHTML = '<span class="text-danger font-mono font-bold text-xs">Please enter an ID first.</span>';
        return;
    }

    resultDiv.innerHTML = '<span class="text-ink font-mono text-xs font-bold flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i> Searching user records...</span>';
    
    const res = await api('/users/lookup', 'POST', { userId: input.value });
    
    if (res && res.success) {
        resultDiv.innerHTML = `
            <div class="flex items-start gap-3 bg-white border-2 border-success p-2.5 mt-2 font-mono shadow-[2px_2px_0_0_#0b0b0b]">
                <div class="text-success text-sm mt-0.5"><i class="fas fa-check-circle"></i></div>
                <div>
                    <div class="font-black text-ink text-xs uppercase">${res.data.name}</div>
                    <div class="text-[11px] text-neutral-700">${res.data.email}</div>
                </div>
            </div>`;
        addBtn.disabled = false;
        addBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        resultDiv.innerHTML = `
            <div class="text-danger font-mono font-bold text-xs mt-1">
                <i class="fas fa-times-circle"></i> User not found. Please verify the User ID.
            </div>`;
        addBtn.disabled = true;
        addBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
};

window.handleCreateEvent = async (e, cid) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.eventType = (body.isApiOnly === 'on' || body.isApiOnly === true) ? 'API_ONLY' : 'FULL';
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

window.handleSaveCommunitySettings = async (e, id) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    
    const res = await api(`/community/${id}/settings`, 'PUT', body);
    if (res && res.success) {
        window.closeModal('community-settings-modal');
        renderCommunity(id);
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
    window.location.hash = `/community/${cid}/api-keys`;
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

window.toggleEventTypeUI = () => {
    const isApiOnly = document.getElementById('is-api-only-toggle').checked;
    const fullFields = document.getElementById('full-feature-fields');
    const slugInput = document.getElementById('input-custom-slug');
    const dateInput = document.getElementById('input-event-date');
    if (isApiOnly) {
        fullFields.classList.add('hidden');
        if (slugInput) slugInput.required = false;
        if (dateInput) dateInput.required = false;
    } else {
        fullFields.classList.remove('hidden');
        if (slugInput) slugInput.required = true;
        if (dateInput) dateInput.required = true;
    }
};

window.promoteCommunity = async (id) => {
    if(!confirm("Promote this community to SUPER?")) return;
    const res = await api(`/community/${id}/type`, 'PUT');
    if(res && res.success) {
        renderCommunity(id);
    } else alert(res?.error || 'Failed to promote');
};