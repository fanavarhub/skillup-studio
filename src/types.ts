export type ProjectCategory = 'AI' | 'Game' | 'Communication';
export type ProjectStatus = 'approved' | 'pending' | 'revision_required' | 'rejected';
export type ConsultationStatus = 'pending' | 'contacted' | 'canceled';

export interface Course {
  id: string;
  title: string;
  description: string;
  level: string;
  price: string;
  duration: string;
  coverImage: string;
  offlineVideos: { id: string; title: string; duration: string; url: string; week?: string }[];
  onlineMeetingLink: string;
  instructor?: string;
  capacity?: number;
  enrolled?: number;
  nextSessionAt?: string;
  scheduleText?: string;
  isActive?: boolean;
  sessionCount?: number;
  isPurchased?: boolean;
  faqs?: Array<{ question: string; answer: string }>;
}

export interface StudentProject {
  id: string;
  title: string;
  description: string;
  category: ProjectCategory;
  embedUrl: string;
  offlineEmbedUrl?: string;
  scratchId?: string;
  studentName: string;
  studentAge: number;
  coverImage: string;
  status: ProjectStatus;
  createdAt: string;
  likes: number;
  featured?: boolean;
  profileBio?: string;
  profileAvatar?: string;
  assignmentId?: string;
  submissionVersion?: number;
  adminNotes?: string;
  rubric?: Array<{ title: string; score: number; maxScore: number }>;
  scoreAwarded?: number;
  userId?: string;
}

export interface ConsultationRequest {
  id: string;
  phone: string;
  childName?: string;
  ip: string;
  device: string;
  browser: string;
  createdAt: string;
  status: ConsultationStatus;
  notes?: string;
}

export interface Certificate {
  id: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  issuedAt: string;
  verificationCode: string;
}

export interface StudentProfile {
  studentName: string;
  xp: number;
  level: number;
  completedVideos?: string[];
  completedSessions?: string[];
  completedQuizzes?: string[];
  unlockedRewards?: string[];
  purchasedCourses?: string[];
  levelXp?: number;
  nextLevelXp?: number;
  progress?: number;
  tier?: 'Starter' | 'Skiller' | 'Skill Master';
  avatar?: string;
  xpLedger?: Array<{ delta: number; eventType: string; reason?: string; createdAt: string }>;
}

export type SessionAssetKind = 'video' | 'pdf' | 'zip' | 'image' | 'excel';

export interface SessionAsset {
  id: string;
  kind: SessionAssetKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  externalUrl?: string;
}

export interface LearningSession {
  id: string;
  courseId: string;
  title: string;
  description: string;
  orderIndex: number;
  xpReward: number;
  durationSeconds: number;
  isPublished: boolean;
  assets: SessionAsset[];
  progress?: { currentTime: number; watchedSeconds: number; watchedPercent: number; completed: boolean };
}

export interface SiteMessage {
  id: string;
  userId?: string;
  name: string;
  body: string;
  rating: number;
  status?: 'pending' | 'approved' | 'rejected';
  adminReply?: string;
  featured?: boolean;
  createdAt: string;
}

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentRequest {
  id: string;
  studentName: string;
  phone: string;
  courseId: string;
  courseTitle: string;
  amount: string;
  receiptNumber: string;
  cardLastFour?: string;
  payerName?: string;
  notes?: string;
  status: PaymentStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: string;
}

export type UserRole = 'guest' | 'student' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  avatar?: string;
}

export type FreeRegistrationStatus = 'pending' | 'account_created' | 'account_linked';

export interface FreeCourseRegistration {
  id: string;
  fullName: string;
  phone: string;
  age: number;
  province: string;
  educationGrade: string;
  relation: 'خودم' | 'فرزندم' | 'خواهر / برادر' | 'دوست یا آشنا';
  bannerShared: boolean;
  programmingExperience: 'کاملاً مبتدی هستم' | 'کمی آشنایی دارم' | 'قبلاً تجربه برنامه‌نویسی داشته‌ام';
  status: FreeRegistrationStatus;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}
