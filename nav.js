// nav.js — Shared Navigation & Role Switcher Component
// Injected into every page. Handles: nav rendering, active state, role switching.

(function() {

    const PAGES = [
        { href: 'index.html',         icon: 'layout-dashboard', label: 'Dashboard' },
        { href: 'analytics.html',     icon: 'bar-chart-2',      label: 'Analytics History' },
        { href: 'reports.html',       icon: 'file-text',        label: 'Reports' },
        { href: 'stakeholder.html',   icon: 'users',            label: 'Stakeholder Views' },
        { href: 'sensor-health.html', icon: 'cpu',              label: 'Sensor Health' },
        { href: 'audit-log.html',     icon: 'shield-check',     label: 'Audit Log' },
        { href: 'support.html',       icon: 'life-buoy',        label: 'Support' },
        { href: 'settings.html',      icon: 'settings',         label: 'Settings' },
    ];

    const ROLES = [
        { id: 'operator',   label: 'Operator',     avatar: 'OP', bg: '0077b6', desc: 'Full technical access' },
        { id: 'executive',  label: 'Executive',    avatar: 'EX', bg: '6a4c93', desc: 'KPI & financial overview' },
        { id: 'regulator',  label: 'Regulator',    avatar: 'RE', bg: '2d6a4f', desc: 'Compliance read-only' },
    ];

    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    const savedRole   = localStorage.getItem('aquaRole') || 'operator';

    // ── Build sidebar nav ──────────────────────────────────────────────────────
    function buildNav() {
        const nav = document.querySelector('aside.sidebar nav');
        if (!nav) return;
        nav.innerHTML = PAGES.map(p => {
            const isActive = currentFile === p.href ? ' active' : '';
            return `<a href="${p.href}" class="nav-item${isActive}"><i data-lucide="${p.icon}"></i> ${p.label}</a>`;
        }).join('');
    }

    // ── Build role switcher (replaces profile img) ─────────────────────────────
    function buildRoleSwitcher() {
        const containers = document.querySelectorAll('.user-profile');
        const role = ROLES.find(r => r.id === savedRole) || ROLES[0];

        containers.forEach(container => {
            container.style.position = 'relative';
            container.innerHTML = `
                <button id="role-btn" title="Switch Role" style="
                    display:flex;align-items:center;gap:8px;
                    background:rgba(255,255,255,0.05);border:1px solid var(--border-glass);
                    border-radius:24px;padding:6px 12px 6px 6px;cursor:pointer;
                    color:var(--text-primary);font-family:inherit;font-size:13px;
                    transition:0.2s;
                " onclick="toggleRoleMenu(this)">
                    <div style="width:30px;height:30px;border-radius:50%;background:#${role.bg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">${role.avatar}</div>
                    <span style="font-weight:600;">${role.label}</span>
                    <i data-lucide="chevron-down" style="width:14px;height:14px;opacity:0.6;"></i>
                </button>
                <div id="role-menu" style="
                    display:none;position:absolute;right:0;top:calc(100% + 8px);
                    background:var(--bg-panel);border:1px solid var(--border-glass);
                    border-radius:12px;padding:8px;min-width:210px;z-index:9999;
                    backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(0,0,0,0.4);
                ">
                    <div style="font-size:11px;color:var(--text-secondary);padding:4px 10px 8px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border-glass);margin-bottom:6px;">Switch Role</div>
                    ${ROLES.map(r => `
                        <button onclick="switchRole('${r.id}')" style="
                            display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;
                            border-radius:8px;border:none;background:${r.id === savedRole ? 'rgba(0,210,255,0.08)' : 'transparent'};
                            color:var(--text-primary);font-family:inherit;font-size:13px;cursor:pointer;
                            transition:0.15s;text-align:left;
                        " onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='${r.id === savedRole ? 'rgba(0,210,255,0.08)' : 'transparent'}'">
                            <div style="width:28px;height:28px;border-radius:50%;background:#${r.bg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;">${r.avatar}</div>
                            <div>
                                <div style="font-weight:600;">${r.label} ${r.id === savedRole ? '<span style="color:var(--accent-blue);font-size:11px;">✓ Active</span>' : ''}</div>
                                <div style="font-size:11px;color:var(--text-secondary);">${r.desc}</div>
                            </div>
                        </button>
                    `).join('')}
                </div>
            `;
        });
    }

    // ── Global helpers ────────────────────────────────────────────────────────
    window.toggleRoleMenu = function(btn) {
        const menu = document.getElementById('role-menu');
        if (!menu) return;
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    };

    window.switchRole = function(roleId) {
        localStorage.setItem('aquaRole', roleId);
        window.location.reload();
    };

    // Close on outside click
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('role-menu');
        const btn  = document.getElementById('role-btn');
        if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });

    // ── Init ──────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        buildNav();
        buildRoleSwitcher();
        // Re-create lucide icons after injection
        if (window.lucide) lucide.createIcons();
    });

})();
