const memberContactPath = '/contact.html';
for (const link of document.querySelectorAll('[data-member-contact]')) {
  link.href = memberContactPath;
}
import('/member-policy-config.mjs').then(({EFFECTIVE_DATE}) => {
  const [year, month, day] = EFFECTIVE_DATE.split('-').map(Number);
  for (const time of document.querySelectorAll('[data-policy-date]')) {
    time.dateTime = EFFECTIVE_DATE;
    time.textContent = `${year}년 ${month}월 ${day}일`;
  }
}).catch(() => {});
