// kalimagic v2 공통 헤더
// head에서 동기 로드되므로 즉시 js-anim 플래그를 단다 → JS 꺼지면 .fade-in이 그냥 보임(progressive enhancement)
document.documentElement.classList.add('js-anim');

const LANDING_PAGES = [
    { key: 'home', label: '홈', href: 'index.html' },
    { key: 'about', label: '소개', href: 'about.html' },
    { key: 'works', label: '작품', href: 'works.html' },
    { key: 'video', label: '영상', href: 'video.html' },
    { key: 'intro', label: '입문', href: 'intro.html' },
    { key: 'reviews', label: '후기', href: 'reviews.html' },
    { key: 'playground', label: '기록소', href: 'playground.html' },
    { key: 'lesson', label: '레슨', href: 'lesson.html', cta: true },
];

const COMMUNITY_PAGES = [
    { key: 'playground', label: '전체 기록', href: 'playground.html', activeOn: ['playground', 'post', 'admin'] },
    { key: 'write', label: '기록 남기기', href: 'write.html' },
];

const COMMUNITY_PAGE_KEYS = new Set(['playground', 'post', 'write', 'mypage', 'admin']);
const NAV_PROFILE_CACHE_KEY = 'kali-nav-profile';

function renderNav(activePage) {
    const isCommunityPage = COMMUNITY_PAGE_KEYS.has(activePage);
    const pages = isCommunityPage ? COMMUNITY_PAGES : LANDING_PAGES;
    const links = pages.map(({ key, label, href, cta, activeOn }) => {
        const isActive = key === activePage || (activeOn || []).includes(activePage);
        const cls = ['nav-link', cta && 'nav-cta', isActive && 'active']
            .filter(Boolean).join(' ');
        return `<a href="${href}" class="${cls}">${label}</a>`;
    }).join('');

    const root = document.getElementById('nav-root');
    if (!root) return;  // nav-root 없는 페이지에서 null deref 가드
    root.className = 'main-nav';
    root.innerHTML = '<div class="nav-brand">' +
        '<a href="index.html" class="nav-logo">KALI</a>' +
        '<a href="playground.html" class="nav-brand-sub">마술문화 기록소</a>' +
        '</div><nav class="nav-links">' + links + '</nav>';
    if (isCommunityPage) renderLoggedInNavLinks(root, activePage);
}

function readCachedNavProfile(userId) {
    try {
        const cached = JSON.parse(window.sessionStorage.getItem(NAV_PROFILE_CACHE_KEY) || 'null');
        if (!cached || cached.userId !== userId || !cached.nickname) return null;
        return cached;
    } catch {
        return null;
    }
}

function writeCachedNavProfile(profile) {
    try {
        window.sessionStorage.setItem(NAV_PROFILE_CACHE_KEY, JSON.stringify(profile));
    } catch {
        // 저장소를 쓸 수 없어도 현재 페이지의 내비게이션은 계속 표시한다.
    }
}

async function fetchNavProfile(session) {
    const userId = session && session.user && session.user.id;
    const cached = readCachedNavProfile(userId);
    if (cached) return cached;

    const response = await fetch('/.netlify/functions/member-badges', {
        headers: { Authorization: 'Bearer ' + session.access_token }
    });
    if (!response.ok) throw new Error('내비게이션 프로필을 불러오지 못했습니다.');
    const data = await response.json();
    if (!data.nickname) throw new Error('닉네임이 없습니다.');
    const profile = {
        userId: data.userId || userId,
        nickname: data.nickname,
        preferredBadgeCode: data.preferredBadgeCode || null
    };
    writeCachedNavProfile(profile);
    return profile;
}

function renderNavProfile(link, profile) {
    link.textContent = '';
    if (profile.preferredBadgeCode) {
        if (window.KalisBadges && window.KalisBadges.imageBadgesHtml) {
            link.insertAdjacentHTML('beforeend', window.KalisBadges.imageBadgesHtml([profile.preferredBadgeCode]));
        } else {
            const badge = document.createElement('img');
            badge.className = 'kali-badge-img';
            badge.src = 'assets/playground/badges/' + encodeURIComponent(profile.preferredBadgeCode) + '.webp';
            badge.alt = '선호 배지';
            badge.loading = 'lazy';
            link.appendChild(badge);
        }
    }
    const nickname = document.createElement('span');
    nickname.className = 'nav-profile__nickname';
    nickname.textContent = profile.nickname;
    link.appendChild(nickname);
    link.title = profile.nickname;
}

async function renderLoggedInNavLinks(root, activePage) {
    if (!window.MagicAuth) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => renderLoggedInNavLinks(root, activePage), { once: true });
        }
        return;
    }

    try {
        const session = await window.MagicAuth.getSession();
        if (!session || root.querySelector('[data-nav-mypage]')) return;
        const nav = root.querySelector('.nav-links');
        if (!nav) return;
        const link = document.createElement('a');
        link.href = 'mypage.html';
        link.className = ['nav-link', 'nav-profile', activePage === 'mypage' && 'active'].filter(Boolean).join(' ');
        link.dataset.navMypage = 'true';
        link.textContent = '마이페이지';
        nav.appendChild(link);

        try {
            renderNavProfile(link, await fetchNavProfile(session));
        } catch {
            link.textContent = '마이페이지';
            link.removeAttribute('title');
        }
    } catch {
        // 세션 조회 실패는 비로그인 상태처럼 조용히 처리한다.
    }
}
