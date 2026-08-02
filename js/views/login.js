import { login } from '../auth.js';

export function renderLogin() {
    document.getElementById('app').innerHTML = `
        <div class="h-[80vh] flex items-center justify-center">
            <div class="text-center">
                <h1 class="text-4xl font-bold mb-4">Admin Portal</h1>
                <p class="text-gray-500 mb-8">Manage communities, events, and attendees.</p>
                <button onclick="login()" class="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 shadow-lg transition">
                    Login with SSO
                </button>
            </div>
        </div>
    `;
}