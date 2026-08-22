import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCommunity } from './views/community.js';
import { renderEvent } from './views/event.js';
import { renderCertificateDesigner } from './views/certificate_designer.js';
import { renderMiniGames } from './views/minigames.js';
import { renderTransactions } from './views/transactions.js';
import { renderApiUsage } from './views/api_usage.js';
import { currentUser } from './auth.js';

export function router() {
    const hash = window.location.hash.slice(1) || '/';
    
    // Redirect to dashboard if logged in and at root
    if (hash === '/' && currentUser) {
        window.location.hash = '/dashboard';
        return;
    }
    // Redirect to login if not logged in
    if (!currentUser && hash !== '/') {
        renderLogin();
        return;
    }
    // Render Login if at root
    if (hash === '/') {
        renderLogin();
        return;
    }

    // --- Dynamic Routes ---

    // 1. Transactions view
    const txnMatch = hash.match(/^\/community\/([^/]+)\/transactions$/);
    if (txnMatch) {
        renderTransactions(txnMatch[1]);
        return;
    }

    // 1.5. API Usage view
    const apiUsageMatch = hash.match(/^\/community\/([^/]+)\/api-usage$/);
    if (apiUsageMatch) {
        renderApiUsage(apiUsageMatch[1]);
        return;
    }

    // 2. Certificate Designer (Community Level)
    const commDesignMatch = hash.match(/^\/community\/([^/]+)\/design$/);
    if (commDesignMatch) {
        renderCertificateDesigner('community', commDesignMatch[1]);
        return;
    }

    // 3. Certificate Designer (Event Level)
    const eventDesignMatch = hash.match(/^\/event\/([^/]+)\/design$/);
    if (eventDesignMatch) {
        renderCertificateDesigner('event', eventDesignMatch[1]);
        return;
    }
    
    // 3. Community Details
    const commMatch = hash.match(/^\/community\/([^/]+)$/);
    if (commMatch) {
        renderCommunity(commMatch[1]);
        return;
    }

    // 4. Event Details
    const eventMatch = hash.match(/^\/community\/([^/]+)\/event\/([^/]+)$/);
    if (eventMatch) {
        renderEvent(eventMatch[1], eventMatch[2]);
        return;
    }

    // --- Static Routes ---
    if (hash === '/dashboard') {
        renderDashboard();
        return;
    }

    // Added Route
    if (hash === '/minigames') {
        renderMiniGames();
        return;
    }
    
    // B2B SuperAdmin Dashboard
    if (hash === '/b2b-admin') {
        import('./views/b2b_admin.js').then(m => m.renderB2BAdmin());
        return;
    }
    
    // API Keys List (Scoped to Community)
    const apiKeyMatch = hash.match(/^\/community\/([^/]+)\/api-keys$/);
    if (apiKeyMatch) {
        import('./views/api_keys.js').then(m => m.renderApiKeys(apiKeyMatch[1]));
        return;
    }

    // 404 Fallback
    document.getElementById('app').innerHTML = `
        <div class="card-static max-w-lg mx-auto text-center py-12 my-12 font-mono">
            <div class="w-12 h-12 bg-danger text-white border-2 border-ink flex items-center justify-center font-black mx-auto mb-4 shadow-[2px_2px_0_0_#0b0b0b]">!</div>
            <h2 class="text-2xl font-black uppercase text-ink mb-2">404 - Not Found</h2>
            <p class="text-xs text-neutral-700 font-bold mb-6">The requested module or resource was not found on this system.</p>
            <a href="#/dashboard" class="btn-primary">Return to Dashboard</a>
        </div>
    `;
}