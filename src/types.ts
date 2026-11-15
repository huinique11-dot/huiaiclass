export type RubricLevel = '' | '상' | '중' | '하';

export interface ArtworkItem {
  slotIndex: number;
  title: string;
  imageUrl: string;
  description: string;
}

export interface EraSong {
  id: string;
  title: string;
  url: string;
  form?: string; // 연주 형태 (독창, 합창, 독주, 중주, 관현악·합주 …)
  movement?: string; // 사조·양식 (예: 인상주의, 미니멀리즘)
}

// 시대마다 역사적 배경·미술 시각 자료는 공통, 대표 감상곡은 여러 곡 중 선택
export interface Era {
  id: string;
  title: string;
  historicalContext: string;
  artworkNote: string;
  artworks: ArtworkItem[];
  songs: EraSong[];
  links?: EraLink[]; // 더 많은 작품 둘러보기(새 탭으로 열림)
}

export interface EraLink {
  id: string;
  title: string;
  url: string;
}

export interface StudentProfile {
  studentId: string;
  studentName: string;
  classGroup: string;
}

export interface LessonConfig {
  eras: Era[];
  eraTitle: string;
  songTitle: string;
  audioOrLinkUrl: string;
  historicalContext: string;
  artworkNote: string;
  artworks: ArtworkItem[];
  empathyPrompt: string;
  shareWithClass: boolean;
  isCustomized: boolean;
  updatedAt: string;
}

export interface StudentResponse {
  id: string;
  studentId: string;
  studentName: string;
  classGroup: string;
  reflectionText: string;
  presentConnection: string;
  isPublic: boolean;
  rubricLevel: RubricLevel;
  teacherFeedback: string;
  eraTitle?: string;
  songTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherSessionState {
  authenticated: boolean;
  passwordConfigured: boolean;
}
