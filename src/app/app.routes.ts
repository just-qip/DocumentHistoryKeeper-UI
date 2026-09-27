import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/projects/projects.component').then((m) => m.ProjectsComponent),
  },
  {
    path: 'projects/:projectId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/project-detail/project-detail.component').then(
        (m) => m.ProjectDetailComponent,
      ),
  },
  {
    path: 'projects/:projectId/documents/:documentId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/document-detail/document-detail.component').then(
        (m) => m.DocumentDetailComponent,
      ),
  },
  {
    path: 'admin/access',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/access-admin/access-admin.component').then((m) => m.AccessAdminComponent),
  },
  { path: '**', redirectTo: 'projects' },
];
