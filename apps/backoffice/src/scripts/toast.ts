export type ToastType = 'success' | 'error' | 'info';

const ICONS = {
    success: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`,
    error: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>`,
    info: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
};

const STYLES = {
    success: { wrap: 'bg-emerald-950/95 border-emerald-500/25', icon: 'text-emerald-400 bg-emerald-500/15', text: 'text-emerald-50' },
    error:   { wrap: 'bg-rose-950/95 border-rose-500/25',       icon: 'text-rose-400 bg-rose-500/15',       text: 'text-rose-50' },
    info:    { wrap: 'bg-[#0D0D0F]/95 border-indigo-500/20',    icon: 'text-indigo-400 bg-indigo-500/10',   text: 'text-white' },
};

export function showToast(message: string, type: ToastType = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const s = STYLES[type];
    const toast = document.createElement('div');
    toast.className = `toast-enter flex items-center gap-3 pl-3 pr-5 py-3 rounded-2xl border shadow-2xl pointer-events-auto backdrop-blur-xl ${s.wrap}`;
    toast.innerHTML = `
        <div class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${s.icon}">${ICONS[type]}</div>
        <span class="text-[13px] font-bold ${s.text} whitespace-nowrap">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-exit');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
        // fallback si animationend ne fire pas (reduced-motion)
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
