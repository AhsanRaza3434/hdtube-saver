import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { YouTubeService } from '../youtube.service';
import { ConversionProgressComponent } from '../conversion-progress/conversion-progress.component';

@Component({
  selector: 'app-video-details',
  templateUrl: './video-details.component.html',
  styleUrls: ['./video-details.component.css'],
})
export class VideoDetailsComponent {
  @Input() details: any;
  @Output() download = new EventEmitter<{ url: string; format: string }>();
  @ViewChild(ConversionProgressComponent) conversionProgress!: ConversionProgressComponent;

  selectedTab: string = 'video'; // Default tab
  videoFormats: any[] = [];
  audioFormats: any[] = [];
  originalUrl: string = ''; // Store the original YouTube URL

  constructor(private youtubeService: YouTubeService) {}

  ngOnChanges() {
    if (this.details) {
      this.videoFormats = this.details.videoFormats || [];
      this.audioFormats = this.details.audioFormats || [];
      this.originalUrl = this.details.originalUrl || ''; // Get the original URL from details
    }
  }

  selectTab(tab: string) {
    this.selectedTab = tab;
  }

  mergeDownload(videoUrl: string, audioUrl: string) {
    if (videoUrl && audioUrl) {
      this.conversionProgress.startConversion(this.originalUrl, this.details.title, audioUrl);
    } else {
      console.error('Missing video or audio URL for merging.');
    }
  }

  downloadFormat(formatUrl: string) {
    if (formatUrl) {
      this.conversionProgress.startConversion(this.originalUrl, this.details.title);
    } else {
      console.error('Format URL is not available.');
    }
  }

  convertToMp4(format: any) {
    console.log('Download button clicked. Format:', format);
    if (!format || !format.itag) {
      console.error('No itag found for selected format:', format);
      alert('Download error: No format ID found. Please refresh and try again.');
      return;
    }
    // If the format needs merging (no audio), find the best audio format
    if (format.needsMerging) {
      const bestAudio = this.audioFormats && this.audioFormats.length > 0 ? this.audioFormats[0] : null;
      if (!bestAudio || !bestAudio.itag) {
        alert('No suitable audio found for merging.');
        return;
      }
      console.log('Merging video and audio:', { video: format, audio: bestAudio });
      this.conversionProgress.startConversion(this.originalUrl, this.details.title, format.itag, bestAudio.itag);
      return;
    }
    // Otherwise, just download the video format
    console.log('Converting format:', format);
    this.conversionProgress.startConversion(this.originalUrl, this.details.title, format.itag);
  }
}
