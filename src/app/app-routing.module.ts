import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoInputComponent } from './video-input/video-input.component'; // Import your component
import { FaqComponent } from './components/faq.component';
import { PrivacyPolicyComponent } from './components/privacy-policy.component';
import { TermsOfServiceComponent } from './components/terms-of-service.component';

const routes: Routes = [
  { path: '', component: VideoInputComponent }, // Default route
  { path: 'faq', component: FaqComponent },
  { path: 'privacy', component: PrivacyPolicyComponent },
  { path: 'terms', component: TermsOfServiceComponent },
  { path: '**', redirectTo: '' } // Wildcard route to handle undefined routes
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
