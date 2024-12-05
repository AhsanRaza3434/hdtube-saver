import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoInputComponent } from './video-input/video-input.component'; // Import your component

const routes: Routes = [
  { path: '', component: VideoInputComponent }, // Default route
  { path: '**', redirectTo: '' } // Wildcard route to handle undefined routes
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
