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
      // Enhance audioFormats: always show MP3, show bitrate as quality, estimate size if missing, and filter out invalid rows
      this.audioFormats = (this.details.audioFormats || [])
        .filter((f: any) => f.abr && f.size && f.size !== 'UNKNOWN')
        .map((f: any) => {
          // Use abr for quality if available
          let quality = f.quality;
          if (f.quality && f.quality.toLowerCase().includes('kbps')) {
            quality = f.quality;
          } else if (f.abr) {
            quality = `${f.abr}kbps`;
          } else {
            quality = 'audio';
          }
          // Always show format as MP3
          let format = 'MP3';
          // Estimate size if missing (should not happen after backend fix)
          let size = f.size;
          if (!size || size === 'UNKNOWN') {
            if (f.abr && this.details.duration) {
              const abr = parseInt(f.abr, 10); // in kbps
              const duration = this.details.duration; // in seconds
              if (!isNaN(abr) && duration) {
                const sizeMB = (abr * 1000 / 8 * duration) / (1024 * 1024);
                size = `${sizeMB.toFixed(2)} MB`;
              } else {
                size = 'UNKNOWN';
              }
            } else {
              size = 'UNKNOWN';
            }
          }
          return { ...f, quality, format, size };
        });
      this.originalUrl = this.details.originalUrl || '';
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

  // Add: Download and convert audio to MP3
  downloadAudio(format: any) {
    console.log('Audio download clicked. Format:', format);
    if (!format || !format.itag) {
      alert('Download error: No audio format ID found. Please refresh and try again.');
      return;
    }
    // Pass abr as string (e.g., '54k')
    const abr = format.abr ? `${Math.round(format.abr)}k` : '128k';
    this.conversionProgress.startAudioConversion(this.originalUrl, this.details.title, format.itag, abr);
  }
}
