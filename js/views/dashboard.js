import { api, modalTemplate } from '../utils.js';
import { currentUser } from '../auth.js';

export async function renderDashboard() {
    if (!currentUser) return;
    document.getElementById('app').innerHTML = '<div class="text-center">Loading Dashboard...</div>';
    
    const data = await api('/dashboard');
    if (!data) return;

    const communities = data.data.communities || [];
    const isSuperAdmin = currentUser.platformRole === 'SUPER_ADMIN';

    const listHtml = communities.map(c => `
        <a href="#/community/${c.PK.split('#')[1]}" class="block bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition border border-gray-200">
            <h3 class="font-bold text-lg">${c.name}</h3>
            <div class="mt-2 text-xs text-gray-400">ID: ${c.PK.split('#')[1]}</div>
            <div class="mt-2">
                ${c.features?.posts ? '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Posts Enabled</span>' : ''}
            </div>
        </a>
    `).join('');

    document.getElementById('app').innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-2xl font-bold">Dashboard</h1>
            ${isSuperAdmin ? `
                <button onclick="openModal('create-community')" class="bg-slate-800 text-white px-4 py-2 rounded text-sm hover:bg-slate-900">
                    + New Community
                </button>
            ` : ''}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${listHtml || '<p class="text-gray-500">No communities found.</p>'}
        </div>
        ${modalTemplate('create-community', 'Create Community', `
            <form onsubmit="handleCreateCommunity(event)">
                <input type="text" name="name" placeholder="Name" class="w-full border p-2 rounded mb-4" required>
                <input type="text" name="ownerId" placeholder="Owner User ID" class="w-full border p-2 rounded mb-4" required>
                <label class="flex items-center gap-2 mb-6">
                    <input type="checkbox" name="postFeature"> Enable Social Posts
                </label>
                <button class="w-full bg-blue-600 text-white py-2 rounded">Create</button>
            </form>
        `)}
    `;
}

// Handler
async function handleCreateCommunity(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { name: fd.get('name'), ownerId: fd.get('ownerId'), postFeature: fd.get('postFeature') === 'on' };
    await api('/community', 'POST', body);
    window.closeModal('create-community');
    renderDashboard();
}

window.handleCreateCommunity = handleCreateCommunity;