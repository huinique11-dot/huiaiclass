// 연주 형태 분류 (중학교 음악 교육과정에서 통용되는 성악·기악 구분을 바탕으로)
export const PERFORMANCE_FORMS = [
  { key: '독창', group: '성악', desc: '한 사람이 노래 (반주가 있을 수 있음)' },
  { key: '중창', group: '성악', desc: '2~8명 정도가 각자 다른 성부를 노래' },
  { key: '합창', group: '성악', desc: '여러 사람이 성부를 나누어 노래' },
  { key: '독주', group: '기악', desc: '한 사람이 악기 연주' },
  { key: '중주', group: '기악', desc: '2~9명 정도가 각자 다른 성부를 연주 (실내악)' },
  { key: '관현악·합주', group: '기악', desc: '많은 연주자가 함께 연주 (오케스트라·밴드)' },
  { key: '협주곡', group: '기악', desc: '독주 악기와 관현악이 함께 연주' },
  { key: '성악과 기악', group: '성악+기악', desc: '노래와 관현악이 함께 (오페라·오라토리오·칸타타 등)' },
  { key: '전자·미디어', group: '기타', desc: '전자 악기·컴퓨터·영상과 결합한 음악' },
] as const;

export type PerformanceForm = (typeof PERFORMANCE_FORMS)[number]['key'];
export const FORM_KEYS: string[] = PERFORMANCE_FORMS.map((f) => f.key);
