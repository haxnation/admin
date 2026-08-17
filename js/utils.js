import { API_URL } from './config.js';

// --- API WRAPPER ---
export async function api(endpoint, method = 'GET', body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // Send Cookies
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_URL}${endpoint}`, opts);
    if (res.status === 401) {
        // Redirect to login if unauthorized and prevent infinite loops
        if (window.location.hash !== '#/' && window.location.hash !== '') {
            window.location.hash = '/';
            setTimeout(() => window.location.reload(), 100); // Force reload to clear in-memory user state
        }
        return null;
    }
    return res.json();
}

// --- UI HELPERS ---
export function modalTemplate(id, title, content) {
    return `
    <div id="${id}" class="fixed inset-0 bg-ink/50 z-50 hidden flex items-center justify-center p-4">
        <div class="card w-full max-w-md relative">
            <button onclick="closeModal('${id}')" class="absolute top-4 right-4 text-ink/50 hover:text-ink">&times;</button>
            <h2 class="text-xl font-bold mb-4">${title}</h2>
            ${content}
        </div>
    </div>`;
}

// Export to window so HTML onclick works
window.openModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');