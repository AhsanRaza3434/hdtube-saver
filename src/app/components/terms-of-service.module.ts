import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { TermsOfServiceComponent } from './terms-of-service.component';

const routes: Routes = [{ path: '', component: TermsOfServiceComponent }];

@NgModule({
  declarations: [TermsOfServiceComponent],
  imports: [CommonModule, RouterModule.forChild(routes)],
})
export class TermsOfServiceModule {}
