'use strict';

const CONFIG = {
    gists: {
        versions:       'https://gist.githubusercontent.com/EnriqueBrach/15bdd6f0fe09e568338fdad91603cbd2/raw',
        privacy:        'https://gist.githubusercontent.com/EnriqueBrach/4778e2fb19fd2bd265283c644bd41d1b/raw',
        'privacy-lite': 'https://gist.githubusercontent.com/EnriqueBrach/3d8dffeecffee4e3cb80594136495aaa/raw'
    },
    routes: {
        versions: {
            title:      'Versions — SunProt',
            icon:       'history',
            heading:    'SunProt Versions',
            subheading: 'Track the evolution of SunProt with our comprehensive version history and changelog.',
            theme:      'cyan'
        },
        privacy: {
            title:      'Privacy Policy — SunProt',
            icon:       'shield-check',
            heading:    'Privacy Policy',
            subheading: 'Your privacy matters. Learn how SunProt collects, uses, and protects your personal information.',
            theme:      'cyan',
            features: [
                { icon: 'lock',       label: 'Secure',      desc: 'Encrypted'   },
                { icon: 'eye',        label: 'Transparent', desc: 'Clear Terms' },
                { icon: 'file-check', label: 'Compliant',   desc: 'GDPR Ready'  }
            ]
        },
        'privacy-lite': {
            title:      'Privacy Policy — SunProt Lite',
            icon:       'file-text',
            heading:    'Privacy Policy Lite',
            subheading: 'Official privacy policy specifically for the SunProt Lite application.',
            theme:      'cyan',
            features: [
                { icon: 'feather',  label: 'Concise', desc: 'To the Point' },
                { icon: 'zap',      label: 'Fast',    desc: 'Quick Read'   },
                { icon: 'sparkles', label: 'Simple',  desc: 'No Jargon'   }
            ],
            note: true
        }
    },
    cacheDuration: 15 * 60 * 1000

};

const state = {
    currentRoute: 'versions',
    cache: new Map(),
    isLoading: false,
    lastError: null,
    menuOpen: false
};

function parseVersions(markdown) {
    if (!markdown) return [];
    const lines = markdown.split('\n');
    const versions = [];
    let current = null;
    let inList = false;

    for (const line of lines) {
        const vm = line.match(/^##?\s*\[?v?(\d+\.\d+(?:\.\d+)?)\]?\s*[-–]\s*(.+)$/i);
        if (vm) {
            if (current) versions.push(current);
            current = { version: vm[1], date: '', title: vm[2].trim(), changes: [] };
            inList = false;
        } else if (line.match(/^\*\*Date:\*\*|^Date:/i) && current) {
            const dm = line.match(/:\s*(.+)$/);
            if (dm) current.date = dm[1].trim();
        } else if ((line.trim().startsWith('- ') || line.trim().startsWith('* ')) && current) {
            current.changes.push(line.trim().substring(2));
            inList = true;
        } else if (line.trim() === '' && inList) {
            inList = false;
        }
    }
    if (current) versions.push(current);
    return versions;
}

function formatDate(str) {
    if (!str) return '';
    try {
        return new Date(str).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch { return str; }
}

function isCacheValid(key) {
    if (!state.cache.has(key)) return false;
    return (Date.now() - state.cache.get(key).timestamp) < CONFIG.cacheDuration;
}
const getCached = key => isCacheValid(key) ? state.cache.get(key).data : null;
const setCache = (key, val) => state.cache.set(key, { data: val, timestamp: Date.now() });

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderSanitizedMarkdown(md) {
    const rawHtml = marked.parse(md);
    return typeof window.DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;
}

function buildLoading() {
    return `
      <div class="state-container">
        <div style="text-align:center">
          <div class="spinner-wrap">
            <div class="spinner-ring"></div>
          </div>
          <p class="loading-text">Loading…</p>
        </div>
      </div>`;
}

function buildError(msg) {
    return `
      <div class="state-container">
        <div class="error-card card">
          <div class="error-icon-wrap">
            <i data-lucide="alert-circle"></i>
          </div>
          <h2 class="error-title">Could not load content</h2>
          <p class="error-msg">${escapeHtml(msg)}</p>
          <button onclick="app.retryLoad()" class="btn-retry">
            <i data-lucide="refresh-cw"></i>Retry
          </button>
        </div>
      </div>`;
}

function buildHero(route) {
    const words = route.heading.split(' ');
    const last = escapeHtml(words.pop());
    const rest = escapeHtml(words.join(' '));
    return `
      <section class="hero">
        <div class="hero-inner">
          <div class="hero-card">
            <div class="hero-icon">
              <i data-lucide="${escapeHtml(route.icon)}"></i>
            </div>
            <h1 class="hero-title">
              ${rest}${rest ? ' ' : ''}<span class="text-gradient">${last}</span>
            </h1>
            <p class="hero-subtitle">${escapeHtml(route.subheading)}</p>
          </div>
        </div>
      </section>`;
}

function buildFeatures(features) {
    return `
      <section class="features-section">
        <div class="features-inner">
          <div class="features-grid">
            ${features.map(f => `
              <div class="feature-card">
                <div class="feature-icon-wrap">
                  <i data-lucide="${escapeHtml(f.icon)}"></i>
                </div>
                <p class="feature-label">${escapeHtml(f.label)}</p>
                <p class="feature-desc">${escapeHtml(f.desc)}</p>
              </div>`).join('')}
          </div>
        </div>
      </section>`;
}

function buildTimeline(versions) {
    if (!versions.length) {
        return '<div class="empty-state">No version history available.</div>';
    }
    return `
      <div class="timeline">
        ${versions.map((v, i) => `
          <div class="timeline-item${i === 0 ? ' latest' : ''}">
            <div class="timeline-dot">
              <div class="timeline-dot-inner"></div>
            </div>
            <div class="timeline-card">
              <div class="timeline-meta">
                <span class="timeline-badge">v${escapeHtml(v.version)}</span>
                ${v.date ? `
                  <span class="timeline-date">
                    <i data-lucide="calendar"></i>
                    ${escapeHtml(formatDate(v.date))}
                  </span>` : ''}
                ${i === 0 ? '<span class="badge-latest">Latest</span>' : ''}
              </div>
              <h3 class="timeline-title">${escapeHtml(v.title)}</h3>
              ${v.changes.length ? `
                <ul class="changes-list">
                  ${v.changes.map(c => `
                    <li class="change-item">
                      <span class="change-dot" aria-hidden="true"></span>
                      <span>${escapeHtml(c)}</span>
                    </li>`).join('')}
                </ul>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
}

function buildNote() {
    return `
      <div class="note-box">
        <p>
          <strong>Note:</strong> This policy applies specifically to
          <strong>SunProt Lite</strong>. For the full app policy, see the
          <a href="#" onclick="app.navigate('privacy');return false;" class="note-link">
            Privacy Policy
          </a>.
        </p>
      </div>`;
}

const app = {
    init() {
        const yr = document.getElementById('current-year');
        if (yr) yr.textContent = new Date().getFullYear();

        this.setupNavigation();
        this.setupScrollBehavior();
        this.setupMobileMenu();

        const hash = window.location.hash.slice(1);
        const route = CONFIG.routes[hash] ? hash : 'versions';
        state.currentRoute = route;
        this.setActiveNav(route);
        this.loadRoute(route);
    },

    setupNavigation() {
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const route = btn.dataset.route;
                if (btn.classList.contains('mobile-nav-btn')) {
                    this.closeMobileMenu();
                }
                this.navigate(route);
            });
        });

        const logo = document.querySelector('.nav-logo');
        if (logo) {
            logo.addEventListener('click', e => {
                e.preventDefault();
                this.navigate('versions');
            });
        }
    },

    setupScrollBehavior() {
        const navbar = document.getElementById('navbar');
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    navbar.classList.toggle('scrolled', window.scrollY > 10);
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    },

    setupMobileMenu() {
        const btn = document.getElementById('mobile-menu-btn');
        const menu = document.getElementById('mobile-menu');
        const backdrop = document.getElementById('mobile-backdrop');

        btn.addEventListener('click', () => {
            state.menuOpen ? this.closeMobileMenu() : this.openMobileMenu();
        });

        backdrop.addEventListener('click', () => this.closeMobileMenu());

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && state.menuOpen) this.closeMobileMenu();
        });
    },

    openMobileMenu() {
        const btn = document.getElementById('mobile-menu-btn');
        const menu = document.getElementById('mobile-menu');

        state.menuOpen = true;
        menu.classList.add('is-open');
        menu.setAttribute('aria-hidden', 'false');
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');

        document.body.style.overflow = 'hidden';
    },

    closeMobileMenu() {
        const btn = document.getElementById('mobile-menu-btn');
        const menu = document.getElementById('mobile-menu');

        state.menuOpen = false;
        menu.classList.remove('is-open');
        menu.setAttribute('aria-hidden', 'true');
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');

        document.body.style.overflow = '';
    },

    navigate(route) {
        if (!CONFIG.routes[route]) return;
        if (route === state.currentRoute) return;

        state.currentRoute = route;
        history.pushState(null, '', `#${route}`);
        this.setActiveNav(route);
        this.loadRoute(route);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    setActiveNav(route) {
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
            const active = btn.dataset.route === route;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', String(active));
        });
    },

    async loadRoute(route) {
        const main = document.getElementById('main-content');
        const cfg = CONFIG.routes[route];
        if (!cfg || !main) return;

        document.title = cfg.title;
        main.innerHTML = buildLoading();
        state.isLoading = true;

        try {
            let md = getCached(route);
            if (!md) {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8000);
                const res = await fetch(CONFIG.gists[route], { signal: controller.signal });
                clearTimeout(timer);
                if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
                md = await res.text();
                setCache(route, md);
            }

            let html = buildHero(cfg);
            if (cfg.features) html += buildFeatures(cfg.features);
            html += '<section class="content-section"><div class="content-inner">';

            if (route === 'versions') {
                const versions = parseVersions(md);
                html += versions.length
                    ? buildTimeline(versions)
                    : `<div class="content-card markdown-content">${renderSanitizedMarkdown(md)}</div>`;
            } else {
                if (cfg.note) {
                    html += `<div class="content-card markdown-content">${renderSanitizedMarkdown(md)}${buildNote()}</div>`;
                } else {
                    html += `<div class="content-card markdown-content">${renderSanitizedMarkdown(md)}</div>`;
                }
            }

            html += '</div></section>';
            main.innerHTML = html;
            state.isLoading = false;
            state.lastError = null;

        } catch (err) {
            state.isLoading = false;
            state.lastError = err.message;
            main.innerHTML = buildError(err.message);
        }

        if (window.lucide) lucide.createIcons();
    },

    retryLoad() {
        state.cache.delete(state.currentRoute);
        this.loadRoute(state.currentRoute);
    }
};

function onReady(fn) {
    if (document.readyState !== 'loading') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
}

onReady(() => app.init());

window.addEventListener('popstate', () => {
    const hash = window.location.hash.slice(1) || 'versions';
    if (hash !== state.currentRoute) {
        state.currentRoute = hash;
        app.setActiveNav(hash);
        app.loadRoute(hash);
    }
});

window.app = app;
