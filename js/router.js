import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCommunity } from './views/community.js';
import { renderEvent } from './views/event.js';
import { renderCertificateDesigner } from './views/certificate_designer.js';
import { renderMiniGames } from './views/minigames.js';
import { renderTransactions } from './views/transactions.js';
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
    
    // API Clients List (Scoped to Community)
    const apiClientMatch = hash.match(/^\/community\/([^/]+)\/api-clients$/);
    if (apiClientMatch) {
        import('./views/api_clients.js').then(m => m.renderApiClients(apiClientMatch[1]));
        return;
    }
    
    // API Client Designer (Scoped to Community)
    const apiDesignMatch = hash.match(/^\/community\/([^/]+)\/api-clients\/([^/]+)\/design$/);
    if (apiDesignMatch) {
        renderCertificateDesigner('apiclient', apiDesignMatch[2], apiDesignMatch[1]);
        return;
    }

    // 404 Fallback
    document.getElementById('app').innerHTML = '404 Not Found';
}