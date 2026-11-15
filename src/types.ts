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
}

// 시대마다 역사적 배경·미술 시각 자료는 공통, 대표 감상곡은 여러 곡 중 선택
export interface Era {
  id: string;
  title: string;
  historicalContext: string;
  artworkNote: string;
  artworks: ArtworkItem[];
  songs: EraSong[];
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
