import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoInputComponent } from './video-input/video-input.component';

const routes: Routes = [
  { path: '', component: VideoInputComponent },
  {
    path: 'faq',
    loadChildren: () =>
      import('./components/faq.module').then((m) => m.FaqModule),
  },
  {
    path: 'privacy-policy',
    loadChildren: () =>
      import('./components/privacy-policy.module').then(
        (m) => m.PrivacyPolicyModule
      ),
  },
  {
    path: 'terms-of-service',
    loadChildren: () =>
      import('./components/terms-of-service.module').then(
        (m) => m.TermsOfServiceModule
      ),
  },
  // Redirects for old URLs
  { path: 'privacy', redirectTo: '/privacy-policy', pathMatch: 'full' },
  { path: 'terms', redirectTo: '/terms-of-service', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled',
      preloadingStrategy: undefined, // Could use PreloadAllModules for small apps
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
