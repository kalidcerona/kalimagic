-- 배지 시스템 v2: expert 후원 배지 3종 추가 + 9종 label/description을 기록소 세계관 이름으로 갱신

insert into public.badges (code, label, description)
values
  ('expert_3000', '은빛 봉인등', '신뢰 있는 답변자이자 기록소에 마음을 보탠 사람'),
  ('expert_10000', '금빛 기록등', '오래 남을 답변과 지식을 보관하는 안내자'),
  ('expert_50000', '오리할콘 수호등', '기록소를 지키는 상급 안내자')
on conflict (code) do nothing;

update public.badges set label = '브론즈 깃털', description = '첫 질문, 배움의 시작' where code = 'user';
update public.badges set label = '은빛 편지', description = '질문을 남기고 기록소에 작은 마음을 보탠 사람' where code = 'supporter_3000';
update public.badges set label = '금장 책갈피', description = '오래 남을 질문과 기록을 함께 쌓는 사람' where code = 'supporter_10000';
update public.badges set label = '오리할콘 열쇠', description = '기록소의 문을 함께 지키는 수호자' where code = 'supporter_50000';
update public.badges set label = '브론즈 촛불', description = '질문에 답을 비춰주는 첫 안내자' where code = 'expert';
update public.badges set label = '은빛 봉인등', description = '신뢰 있는 답변자이자 기록소에 마음을 보탠 사람' where code = 'expert_3000';
update public.badges set label = '금빛 기록등', description = '오래 남을 답변과 지식을 보관하는 안내자' where code = 'expert_10000';
update public.badges set label = '오리할콘 수호등', description = '기록소를 지키는 상급 안내자' where code = 'expert_50000';
update public.badges set label = '칼리의 루비 문장', description = '칼리형' where code = 'kali';
