import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule } from '@angular/common/http'; 
import { AppComponent } from './app.component';
import { VideoInputComponent } from './video-input/video-input.component';
import { VideoDetailsComponent } from './video-details/video-details.component';
import { ConversionProgressComponent } from './conversion-progress/conversion-progress.component';
import { FaqComponent } from './components/faq.component';
import { PrivacyPolicyComponent } from './components/privacy-policy.component';
import { TermsOfServiceComponent } from './components/terms-of-service.component';

@NgModule({
  declarations: [
    AppComponent,
    VideoInputComponent,
    VideoDetailsComponent,
    ConversionProgressComponent,
    FaqComponent,
    PrivacyPolicyComponent,
    TermsOfServiceComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
