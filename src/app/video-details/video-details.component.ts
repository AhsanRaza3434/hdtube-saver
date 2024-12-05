import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-video-details',
  templateUrl: './video-details.component.html',
  styleUrls: ['./video-details.component.css'],
})
export class VideoDetailsComponent {
  @Input() details: any;
  @Output() download = new EventEmitter<{ url: string; format: string }>();
  downloadFormat(formatUrl: string) {
    if (formatUrl) {
      this.download.emit({ url: formatUrl, format: 'mp4' });
    } else {
      console.error('Format URL is not available.');
    }
  }
  
  
}
