export type SystemRole = 'USER' | 'ADMIN';
export type ProjectRole = 'VIEWER' | 'EDITOR' | 'OWNER';

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
  role: ProjectRole;
  grantedAt: string;
  grantedBy: string | null;
}
