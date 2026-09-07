import { api, modalTemplate, escapeHtml } from './utils.js';

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export function newIdempotencyKey() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replaceAll('-', '');
    return 'ac-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14).replace(/[^a-z0-9]/gi, '');
}

// Single-shot verify can hit gateway settlement delay (provider still PENDING)
// or a transient poll failure even though money left the account. Poll
// retryable states instead of showing a hard error on attempt #1.
export async function verifyPaymentWithRetry(communityId, orderId, onAttempt) {
    const delays = [2000, 3000, 5000, 8000, 8000, 10000];
    let lastErr = 'Unknown error';
    for (let attempt = 0; attempt < delays.length + 1; attempt++) {
        if (onAttempt) onAttempt(attempt + 1, delays.length + 1);
        let res = null;
        try {
            res = await api(`/community/${communityId}/apikeys/verify-payment`, 'POST', { orderId });
        } catch (e) {
            lastErr = e?.message || 'Network error';
            if (attempt < delays.length) { await sleep(delays[attempt]); continue; }
            return { ok: false, error: lastErr, retryable: true, orderId };
        }
        if (!res) return { ok: false, error: 'Unauthorized. Please log in and retry verification.', retryable: true, orderId };
        const st = res?.data?.status;
        if (res?.data && (st === 'COMPLETED' || st === undefined)) return { ok: true, res };
        if (res?.data?.retryable || st === 'PENDING' || st === 'UNKNOWN') {
            lastErr = res?.data?.message || 'Payment is still processing';
            if (attempt < delays.length) { await sleep(delays[attempt]); continue; }
            return { ok: false, error: lastErr + ` (order ${orderId})`, retryable: true, orderId };
        }
        const errMsg = res?.error || res?.data?.message || 'Verification failed';
        if (/not successful|still processing|could not confirm|failed to verify transaction|in progress/i.test(errMsg)) {
            lastErr = errMsg;
            if (attempt < delays.length) { await sleep(delays[attempt]); continue; }
            return { ok: false, error: lastErr + ` (order ${orderId})`, retryable: true, orderId };
        }
        return { ok: false, error: errMsg, retryable: false, orderId };
    }
    return { ok: false, error: lastErr, retryable: true, orderId };
}

export function buyCreditsModalTemplate() {
    return modalTemplate('buy-credits-modal', 'Buy Certificate Credits', `
        <form id="buy-credits-form" class="space-y-4 font-mono text-xs">
            <div>
                <label class="label" for="credit-quantity">Number of Certificates</label>
                <input type="number" id="credit-quantity" min="100" value="100" class="input" required>
                <p class="text-[11px] text-neutral-600 mt-1 font-bold">Minimum order batch: 100 certificates</p>
            </div>
            <p class="text-[11px] text-neutral-600 font-bold">Policy: Certificates generated with credits are valid and stored for 2 years from date of issue.</p>
            <div class="bg-canvas border-2 border-ink p-4 shadow-[2px_2px_0_0_#0b0b0b]">
                <div class="flex justify-between mb-2">
                    <span class="text-xs text-neutral-700 font-bold uppercase">Rate per cert:</span>
                    <span id="price-per-cert" class="font-black text-ink">₹2.00</span>
                </div>
                <div class="flex justify-between border-t-2 border-ink pt-2 mt-2">
                    <span class="font-black uppercase text-ink">Total Amount:</span>
                    <span id="total-price" class="font-black text-base text-ink">₹200.00</span>
                </div>
            </div>
            <div>
                <label class="label">Payment Gateway</label>
                <div class="space-y-2" id="credit-gateways">
                    <p class="text-[11px] text-neutral-600 font-bold animate-pulse">[ LOADING GATEWAYS... ]</p>
                </div>
            </div>
            <div class="pt-3 border-t-2 border-ink flex justify-end gap-3">
                <button type="button" onclick="closeModal('buy-credits-modal')" class="btn-secondary">Cancel</button>
                <button type="submit" class="btn-primary">
                    <i class="fas fa-lock mr-1"></i> Proceed to Pay
                </button>
            </div>
        </form>
    `);
}

async function loadGateways(communityId) {
    const container = document.getElementById('credit-gateways');
    if (!container) return;
    let gateways = { cashfree: true, phonepe: true };
    try {
        const res = await api(`/community/${communityId}/apikeys/gateways`);
        if (res?.data?.gateways) gateways = { ...gateways, ...res.data.gateways };
    } catch (e) {
        console.error('Failed to fetch gateways, defaulting to all enabled', e);
    }
    const options = [];
    if (gateways.phonepe) options.push({ value: 'PHONEPE', label: 'PhonePe', desc: 'UPI, Cards, NetBanking' });
    if (gateways.cashfree) options.push({ value: 'CASHFREE', label: 'Cashfree', desc: 'Cards, UPI, NetBanking' });
    if (options.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-danger font-bold">No payment gateways are currently enabled. Please contact support.</p>`;
        return;
    }
    container.innerHTML = options.map((o, i) => `
        <label class="flex items-center gap-3 border-2 border-ink bg-white p-2.5 shadow-[2px_2px_0_0_#0b0b0b] cursor-pointer hover:bg-neutral-50 transition-colors">
            <input type="radio" name="credit-gateway" value="${o.value}" ${i === 0 ? 'checked' : ''} class="w-4 h-4 text-cyan focus:ring-cyan border-ink">
            <div class="flex-1">
                <span class="font-mono font-bold uppercase text-xs block">${o.label}</span>
                <span class="text-[10px] text-neutral-500">${o.desc}</span>
            </div>
        </label>`).join('');
}

function priceForQty(qty) {
    if (qty >= 10000) return 1.5;
    if (qty >= 1000) return 1.75;
    return 2.0;
}

// Attaches pricing + submit handlers. Call after the modal HTML is in the DOM.
// onCredited() runs after a successful top-up so the host page can refresh.
export function initBuyCredits(communityId, onCredited) {
    const qtyInput = document.getElementById('credit-quantity');
    const form = document.getElementById('buy-credits-form');
    if (!qtyInput || !form || form.dataset.bcInit === '1') return;
    form.dataset.bcInit = '1';

    qtyInput.addEventListener('input', () => {
        const qty = parseInt(qtyInput.value) || 0;
        const price = priceForQty(qty);
        document.getElementById('price-per-cert').innerText = '₹' + price.toFixed(2);
        document.getElementById('total-price').innerText = '₹' + (qty * price).toFixed(2);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const qty = parseInt(document.getElementById('credit-quantity').value);
        if (qty < 100) return alert('Minimum order quantity is 100');

        const selectedGateway = e.target.querySelector('input[name="credit-gateway"]:checked')?.value;
        if (!selectedGateway) return alert('No payment gateway available. Please try again later.');
        const btn = e.target.querySelector('button[type="submit"]');
        const restoreBtn = () => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-lock mr-1"></i> Proceed to Pay';
        };
        btn.disabled = true;
        btn.innerText = 'Processing...';

        // One UUID per buy attempt: backend replays the stored order on retry
        // instead of charging twice.
        const idempotencyKey = newIdempotencyKey();
        const res = await api(`/community/${communityId}/apikeys/buy-credits`, 'POST', { quantity: qty, gateway: selectedGateway, idempotencyKey });
        if (!res?.data) {
            alert(res?.error || 'Failed to initiate payment');
            restoreBtn();
            return;
        }

        if (selectedGateway !== 'CASHFREE' || !res.data.payment_session_id) {
            if (!res.data.redirect_url) {
                alert('Failed to initiate payment: no checkout URL returned');
                restoreBtn();
                return;
            }
            window.location.href = res.data.redirect_url;
            return;
        }

        try {
            if (typeof Cashfree === 'undefined') {
                throw new Error('Cashfree SDK failed to load. Please check your connection and retry.');
            }
            btn.innerText = 'Waiting for payment...';
            const cashfree = Cashfree({ mode: window.CASHFREE_MODE || 'sandbox' });
            const result = await cashfree.checkout({
                paymentSessionId: res.data.payment_session_id,
                redirectTarget: '_modal'
            });
            if (result?.error) {
                throw new Error(result.error.message || 'Payment was cancelled or failed');
            }
            btn.innerText = 'Verifying... (this can take ~30s while the gateway settles)';
            const out = await verifyPaymentWithRetry(communityId, res.data.order_id, (a, n) => {
                btn.innerText = `Verifying... ${a}/${n}`;
            });
            if (out.ok) {
                window.closeModal('buy-credits-modal');
                alert('✅ Payment verified! Credits have been added to your account.');
                if (onCredited) await onCredited();
            } else if (out.retryable) {
                alert('⏳ ' + out.error + '. If you were charged, retry verification from Transactions with order ' + res.data.order_id);
            } else {
                alert('⚠️ Payment verification failed: ' + out.error);
            }
        } catch (err) {
            console.error('Cashfree checkout failed', err);
            alert('⚠️ ' + (err?.message || 'Payment failed. Please try again.'));
        }
        restoreBtn();
    });
}

export async function openBuyCredits(communityId, onCredited) {
    const qty = document.getElementById('credit-quantity');
    if (qty) {
        qty.value = 100;
        qty.dispatchEvent(new Event('input'));
    }
    window.openModal('buy-credits-modal');
    await loadGateways(communityId);
    initBuyCredits(communityId, onCredited);
}

window.openBuyCreditsShared = openBuyCredits;
export { escapeHtml };
