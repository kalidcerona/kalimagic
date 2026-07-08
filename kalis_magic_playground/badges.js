(function () {
  var BADGES = {
    expert: { label: '전문가', className: 'kali-badge--expert' },
    admin: { label: '칼리', className: 'kali-badge--kali' },
    kali: { label: '칼리', className: 'kali-badge--kali' }
  };

  function badgeHtml(role) {
    var key = String(role || '').trim().toLowerCase();
    var badge = BADGES[key];
    if (!badge) return '';
    return '<span class="kali-badge ' + badge.className + '">' + badge.label + '</span>';
  }

  window.KalisBadges = { badgeHtml: badgeHtml };
})();
