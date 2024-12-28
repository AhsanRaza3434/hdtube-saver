import { Component, Input, Output, EventEmitter } from '@angular/core';
import { YouTubeService } from '../youtube.service';

@Component({
  selector: 'app-video-details',
  templateUrl: './video-details.component.html',
  styleUrls: ['./video-details.component.css'],
})
export class VideoDetailsComponent {
  @Input() details: any;
  @Output() download = new EventEmitter<{ url: string; format: string }>();

  selectedTab: string = 'video'; // Default tab
  videoFormats: any[] = [];
  audioFormats: any[] = [];


  constructor(private youtubeService: YouTubeService) {}

  ngOnChanges() {
    if (this.details) {
      this.videoFormats = this.details.videoFormats || [];
      this.audioFormats = this.details.audioFormats || [];
    }
  }

  selectTab(tab: string) {
    this.selectedTab = tab;
  }

  mergeDownload(videoUrl: string, audioUrl: string) {
    if (videoUrl && audioUrl) {
      const mergeUrl = `${this.youtubeService.apiUrl}/stream-merge?videoUrl=${encodeURIComponent(videoUrl)}&audioUrl=${encodeURIComponent(audioUrl)}`;
      window.open(mergeUrl, '_blank');
    } else {
      console.error('Missing video or audio URL for merging.');
    }
  }
  

  downloadFormat(formatUrl: string) {
    if (formatUrl) {
      this.download.emit({ url: formatUrl, format: this.selectedTab });
    } else {
      console.error('Format URL is not available.');
    }
  }
}
