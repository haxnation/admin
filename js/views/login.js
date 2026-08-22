import { login } from '../auth.js';

export function renderLogin() {
    document.getElementById('app').innerHTML = `
        <div class="min-h-[75vh] flex items-center justify-center p-4">
            <div class="w-full max-w-md bg-white border-2 border-ink p-6 sm:p-8 shadow-[8px_8px_0_0_#0b0b0b] relative">
                
                <!-- Status tag -->
                <div class="absolute -top-4 -left-3 border-2 border-ink bg-ink text-white px-3 py-1 font-mono text-[10px] uppercase font-bold shadow-[2px_2px_0_0_#0b0b0b] flex items-center gap-2">
                    <div class="w-2 h-2 bg-cyan animate-pulse"></div>
                    SECURE ADMIN ACCESS
                </div>

                <div class="text-left mb-6 mt-2 border-b-2 border-ink pb-4">
                    <div class="bg-ink border-2 border-ink p-2.5 mb-5 inline-block shadow-[4px_4px_0_0_#5ce1e6]">
                        <img src="/logo.png" alt="Haxnation Logo" class="h-8 w-auto object-contain">
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-ink font-mono">Admin Portal</h1>
                    <p class="font-mono text-xs uppercase tracking-widest text-neutral-700 mt-2 font-bold">[ SYSTEM CLEARANCE LEVEL: 4 ]</p>
                </div>
                
                <p class="text-sm text-neutral-800 leading-relaxed font-sans mb-8">
                    Central administration console for community governance, event registration, certificate designer engines, and B2B API infrastructure.
                </p>

                <button onclick="login()" class="btn-primary w-full py-3.5 text-sm">
                    <i class="fas fa-shield-alt mr-2 text-ink"></i> Authenticate with SSO
                </button>

                <div class="mt-6 pt-4 border-t-2 border-ink flex items-center justify-between text-xs font-mono font-bold text-neutral-600">
                    <span>HAXNATION OPS</span>
                    <span>v2.5.0-PROD</span>
                </div>
            </div>
        </div>
    `;
}