const CONTENT = {
  reviews: [
    { quote: "마술을 보기만 좋아하던 학생에서, 남들에게 보여줄 수 있는 마술이 많아졌어요", label: "형의 마술 배운 사람" },
    { quote: "기본기를 탄탄하게 다질 수 있었고, 그것을 바탕으로 독특한 기법들도 잘 다루게 됐어요", label: "형의 마술 배운 사람" },
    { quote: "마술을 이해하는 관점이 성숙해졌습니다", label: "형의 마술 배운 사람" },
    { quote: "도구 수집만 하고 실제로 마술을 하고 다닐 엄두가 안 났는데 이제야 진짜 마술을 하는 느낌입니다", label: "형의 마술 배운 사람" },
    { quote: "마술에 대한 태도가 더 진지해졌습니다", label: "형의 마술 배운 사람" },
  ],
  visitorCards: [
    { num: "01", title: "마술 처음인데<br>뭐부터 해야 해?", desc: "입문 강의 6편으로 딱 정리해뒀어. 커피 한 잔 값으로 오늘 시작할 수 있어", cta: "5,000원으로 시작하기 →", href: "intro.html" },
    { num: "02", title: "더 깊이 들어가고 싶어?", desc: "형이 직접 만든 작품이랑 도구.", cta: "형이 만든 것들 보기 →", href: "works.html" },
    { num: "03", title: "직접 배우고 싶어?", desc: "형이랑 1:1로 직접. 네 수준에 맞춰서, 빠르게.", cta: "레슨 신청하기 →", href: "lesson.html" },
  ],
  problemQuotes: [
    "나는 존재감이 없는 것 같아.",
    "이성 앞에서 자연스럽게 행동을 못 해.",
    "나만의 강점 하나가 있었으면 좋겠어.",
  ]
};

function renderContent() {
  var slots = {
    'reviews-desktop': function() {
      return CONTENT.reviews.map(function(r) {
        return '<div style="background:#261d18; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:28px;"><span style="display:inline-block; font-size:0.74rem; font-weight:700; color:var(--point-gold); border:1px solid rgba(224,144,78,0.4); border-radius:999px; padding:4px 12px; margin-bottom:16px;">✦ ' + r.label + '</span><p style="color:#ededed; font-size:1rem; line-height:1.75; margin:0;">"' + r.quote + '"</p></div>';
      }).join('') +
      '<div style="background:linear-gradient(135deg, rgba(224,144,78,0.12), rgba(255,255,255,0.02)); border:1px solid rgba(224,144,78,0.3); border-radius:8px; padding:28px; display:flex; flex-direction:column; justify-content:center;"><p style="font-family:\'Noto Serif KR\',serif; font-style:italic; color:var(--point-gold); font-size:1.15rem; line-height:1.6; margin:0;">너도 곧, 이 칸에<br>네 이야기를 쓰게 될 거야.</p></div>';
    },
    'reviews-mobile': function() {
      return CONTENT.reviews.map(function(r) {
        return '<div style="background:#241712; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:18px 20px;"><p style="color:#F0E2D5; font-size:14.5px; line-height:1.65; margin:0 0 10px;">"' + r.quote + '"</p><p style="color:#9A8775; font-size:11.5px; margin:0;">— ' + r.label + '</p></div>';
      }).join('');
    },
    'visitor-desktop': function() {
      return CONTENT.visitorCards.map(function(c) {
        return '<a href="' + c.href + '" style="display:flex; flex-direction:column; background:#261d18; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:30px 26px;" data-hover="transform:translateY(-5px); border-color:rgba(224,144,78,0.5)"><span style="font-family:\'Noto Serif KR\',serif; font-style:italic; color:var(--point-gold); font-size:1rem; margin-bottom:16px;">' + c.num + '</span><h4 style="font-size:1.2rem; font-weight:800; line-height:1.4; margin:0 0 12px;">' + c.title + '</h4><p style="color:#ab9f92; font-size:0.96rem; line-height:1.8; margin:0 0 22px; flex:1;">' + c.desc + '</p><span style="color:var(--point-gold); font-weight:700; font-size:0.92rem;">' + c.cta + '</span></a>';
      }).join('');
    },
    'visitor-mobile': function() {
      return CONTENT.visitorCards.map(function(c) {
        return '<a href="' + c.href + '" style="display:block; background:#241712; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:22px 20px; text-decoration:none;"><p style="font-family:\'Noto Serif KR\',serif; font-style:italic; color:var(--point-gold); font-size:14px; margin:0 0 10px;">' + c.num + '</p><h4 style="font-size:17px; font-weight:800; color:#F4E7DA; margin:0 0 8px; line-height:1.4;">' + c.title + '</h4><p style="color:#A99685; font-size:13.5px; line-height:1.72; margin:0 0 14px;">' + c.desc + '</p><span style="color:var(--point-gold); font-weight:700; font-size:13.5px;">' + c.cta + '</span></a>';
      }).join('');
    },
    'problem-desktop': function() {
      return CONTENT.problemQuotes.map(function(q) {
        return '<p style="margin:0; color:var(--point-gold); font-size:1.06rem; font-weight:500; font-family:\'Noto Serif KR\',serif; font-style:italic;">"' + q + '"</p>';
      }).join('');
    },
    'problem-mobile': function() {
      return CONTENT.problemQuotes.map(function(q) {
        return '<p style="margin:0; color:var(--point-gold); font-size:15px; font-weight:500; font-family:\'Noto Serif KR\',serif; font-style:italic;">"' + q + '"</p>';
      }).join('');
    }
  };

  Object.keys(slots).forEach(function(slotName) {
    var el = document.querySelector('[data-slot="' + slotName + '"]');
    if (el) el.innerHTML = slots[slotName]();
  });
}

renderContent();
