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
    <div id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" class="fixed inset-0 bg-ink/75 backdrop-blur-xs z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white border-2 border-ink shadow-[8px_8px_0_0_#0b0b0b] w-full max-w-lg relative max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-75">
            <button type="button" onclick="closeModal('${id}')" aria-label="Close dialog" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center font-mono font-black text-sm bg-white hover:bg-danger hover:text-white border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer">
                &times;
            </button>
            <div class="mb-6 border-b-2 border-ink pb-3 flex items-center gap-2">
                <div class="w-2.5 h-2.5 bg-cyan border border-ink"></div>
                <h2 id="${id}-title" class="font-mono text-lg font-black uppercase text-ink tracking-tight">${title}</h2>
            </div>
            ${content}
        </div>
    </div>`;
}

// Global modal management
export function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('flex');
    // Set focus to the first focusable element inside the modal
    const focusable = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
}

export function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
}

// Close active modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('[role="dialog"]:not(.hidden)');
        openModals.forEach(m => closeModal(m.id));
    }
});

// Export to window so HTML onclick works
window.openModal = openModal;
window.closeModal = closeModal;