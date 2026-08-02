import { checkAuth } from './auth.js';
import { router } from './router.js';

window.addEventListener('hashchange', router);

window.addEventListener('load', async () => {
    await checkAuth();
    router();
});