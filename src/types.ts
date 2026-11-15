export type RubricLevel = '' | '상' | '중' | '하';

export interface ArtworkItem {
  slotIndex: number;
  title: string;
  imageUrl: string;
  description: string;
}

export interface LessonConfig {
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
  createdAt: string;
  updatedAt: string;
}

export interface TeacherSessionState {
  authenticated: boolean;
  passwordConfigured: boolean;
}
