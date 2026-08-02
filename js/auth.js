import { api } from './utils.js';

export let currentUser = null;

export async function checkAuth() {
    const res = await api('/auth/me');
    if (res && res.authenticated) {
        currentUser = res.user;
        updateNavUser(currentUser);
        return true;
    }
    currentUser = null;
    return false;
}


export async function login() {
    const currentPath = window.location.pathname + window.location.search;
    const res = await api(`/auth/login?returnTo=${encodeURIComponent(currentPath)}`);
    if (res && res.url) window.location.href = res.url;
}

export async function logout() {
    await api('/auth/logout', 'POST');
    window.location.reload();
}

function updateNavUser(user) {
    const nav = document.getElementById('nav-user');
    const name = document.getElementById('user-name');
    if (nav && name) {
        nav.classList.remove('hidden');
        name.innerText = user.name;
    }
    const b2bNav = document.getElementById('nav-b2b-admin');
    if (b2bNav && user.platformRole === 'SUPER_ADMIN') {
        b2bNav.classList.remove('hidden');
    }
}

// Export auth functions to window for HTML access
window.login = login;
window.logout = logout;