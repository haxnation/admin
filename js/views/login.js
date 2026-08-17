import { login } from '../auth.js';

export function renderLogin() {
    document.getElementById('app').innerHTML = `
        <div class="h-[80vh] flex items-center justify-center">
            <div class="text-center">
                <h1 class="text-4xl font-bold mb-4">Admin Portal</h1>
                <p class="text-ink/50 mb-8">Manage communities, events, and attendees.</p>
                <button onclick="login()" class="btn-primary">
                    Login with SSO
                </button>
            </div>
        </div>
    `;
}