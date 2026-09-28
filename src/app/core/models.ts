export type SystemRole = 'USER' | 'ADMIN';
export type ProjectRole = 'VIEWER' | 'EDITOR' | 'OWNER';
export type AccessAction = 'VIEW' | 'PREVIEW' | 'DOWNLOAD';
export type DeniedReason = 'NO_SESSION' | 'INVALID_SESSION' | 'NO_ACCESS' | 'NOT_FOUND';

export interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
  systemRole: SystemRole;
  avatarUpdatedAt: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: string;
  archivedAt: string | null;
  myRole: string | null;
}

export interface Document {
  id: string;
  projectId: string;
  title: string;
  docKind: string;
  currentVersionId: string | null;
  currentVersionAuthorId: string | null;
  versionSeq: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface VersionMeta {
  id: string;
  documentId: string;
  versionNumber: number;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  parentVersionId: string | null;
  authorId: string;
  comment: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: number;
  at: string;
  type: string;
  actorId: string;
  versionId: string | null;
  payload: Record<string, unknown> | null;
  eventHash: string;
  prevEventHash: string | null;
}

export interface TimelinePage {
  documentId: string;
  entries: TimelineEvent[];
  nextCursor: string | null;
}

export interface ProjectAccess {
  id: string;
  projectId: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  accountAvatarUrl: string | null;
  role: ProjectRole;
  grantedAt: string;
  grantedBy: string | null;
}

export interface AccessLogEntry {
  id: number;
  at: string;
  action: AccessAction;
  versionId: string | null;
  versionNumber: number | null;
  attemptedVersionNumber: number | null;
  accountId: string | null;
  accountName: string | null;
  accountEmail: string | null;
  ipAddress: string | null;
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  userAgent: string | null;
  deniedReason: DeniedReason | null;
}

export interface AccessLogPage {
  documentId: string;
  entries: AccessLogEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface PerVersionStat {
  versionId: string | null;
  versionNumber: number | null;
  views: number;
  previews: number;
  downloads: number;
  lastAccessAt: string | null;
}

export interface PerUserStat {
  accountId: string;
  accountName: string;
  views: number;
  previews: number;
  downloads: number;
  lastAccessAt: string | null;
}

export interface AccessLogStats {
  documentId: string;
  totalViews: number;
  totalPreviews: number;
  totalDownloads: number;
  totalDenied: number;
  uniqueViewers: number;
  perVersion: PerVersionStat[];
  perUser: PerUserStat[];
}
