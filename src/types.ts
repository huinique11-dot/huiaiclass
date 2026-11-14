export type RubricLevel = '' | '상' | '중' | '하';

export interface LessonConfig {
  eraTitle: string;
  songTitle: string;
  audioOrLinkUrl: string;
  historicalContext: string;
  artworkNote: string;
  empathyPrompt: string;
  shareWithClass: boolean;
  isCustomized: boolean;
  updatedAt: string;
}

export interface StudentResponse {
  id: string;
  studentName: string;
  classGroup: string;
  reflectionText: string;
  presentConnection: string;
  rubricLevel: RubricLevel;
  teacherFeedback: string;
  createdAt: string;
  updatedAt: string;
}
