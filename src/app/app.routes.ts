import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'projects',
  },
  {
    path: 'login',
    title: 'Вход',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'profile',
    title: 'Профиль',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'projects',
    title: 'Проекты',
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
    path: 'projects/:projectId/access',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/project-access/project-access.component').then(
        (m) => m.ProjectAccessComponent,
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
    title: 'Доступы',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./pages/access-admin/access-admin.component').then((m) => m.AccessAdminComponent),
  },
  { path: '**', redirectTo: 'projects' },
];
