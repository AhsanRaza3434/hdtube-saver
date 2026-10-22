import { Component, OnInit, OnDestroy } from '@angular/core';
import { YouTubeService } from '../youtube.service';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, EMPTY } from 'rxjs';
import { takeWhile, switchMap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-conversion-progress',
  template: `
    <div class="conversion-overlay" *ngIf="isConverting">
      <div class="conversion-container">
        <div class="conversion-content">
          <div class="icon-container">
            <div class="icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path class="download-arrow" d="M12 16L12 8M12 16L8 12M12 16L16 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path class="download-line" d="M3 15V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          <h3 class="title">{{ currentTitle }}</h3>
          <div class="progress-container">
            <div class="progress-bar" [style.width.%]="progress">
              <div class="progress-glow"></div>
            </div>
          </div>
          <p class="progress-text">{{ progress }}% (estimate)</p>
          <div class="status-message" *ngIf="status !== 'Converting and downloading...'">
            {{ getStatusMessage(status) }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .conversion-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(5px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
    }

    .conversion-container {
      background: rgba(255, 255, 255, 0.95);
      padding: 2.5rem;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      width: 90%;
      max-width: 400px;
      transform: translateY(0);
      animation: slideUp 0.3s ease;
    }

    .conversion-content {
      text-align: center;
    }

    .icon-container {
      margin-bottom: 1.5rem;
    }

    .icon {
      width: 48px;
      height: 48px;
      margin: 0 auto;
      color: var(--primary-red);
    }

    .download-arrow {
      animation: bounce 1.5s ease-in-out infinite;
    }

    .download-line {
      animation: pulse 1.5s ease-in-out infinite;
    }

    .title {
      margin: 0 0 1.5rem;
      color: #1a1a1a;
      font-size: 1.25rem;
      font-weight: 600;
      font-family: 'Roboto', sans-serif;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .progress-container {
      width: 100%;
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      margin: 1rem 0;
      position: relative;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--primary-red), #00bfff);
      border-radius: 4px;
      transition: width 0.3s ease;
      position: relative;
    }

    .progress-glow {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, 
        rgba(255,255,255,0) 0%,
        rgba(255,255,255,0.3) 50%,
        rgba(255,255,255,0) 100%);
      animation: glow 1.5s ease-in-out infinite;
    }

    .progress-text {
      font-weight: 600;
      color: var(--primary-red);
      font-size: 1.1rem;
      margin: 0.5rem 0;
      font-family: 'Roboto', sans-serif;
    }

    .status-message {
      margin-top: 1rem;
      color: #666;
      font-size: 0.9rem;
      font-family: 'Roboto', sans-serif;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes glow {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  `]
})
export class ConversionProgressComponent implements OnInit, OnDestroy {
  isConverting = false;
  progress = 0;
  status = 'Starting conversion...';
  private currentUrl = '';
  private currentTitle = '';
  private currentAudioUrl = '';
  private currentConversionId: string = '';
  private progressSubscription: Subscription | null = null;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(
    private youtubeService: YouTubeService,
    private http: HttpClient
  ) {}

  ngOnInit() {}

  startConversion(url: string, title: string, videoItag?: string, audioItag?: string) {
    this.isConverting = true;
    this.progress = 0;
    this.status = 'Starting conversion...';
    this.currentUrl = url;
    this.currentTitle = title;
    this.retryCount = 0;

    console.log('Starting conversion with:', { url, title, videoItag, audioItag });

    if (audioItag) {
      // Merge video and audio
      this.youtubeService.streamMerge(url, title, videoItag, audioItag).subscribe(
        (response: any) => {
          if (response.conversionId) {
            this.currentConversionId = response.conversionId;
            this.startProgressCheck(response.conversionId);
          } else {
            console.error('No conversion ID received:', response);
            this.handleError('Error starting merge. Please try again.');
          }
        },
        error => {
          console.error('Error starting merge:', error);
          this.handleError('Error starting merge. Please try again.');
        }
      );
    } else {
      // Single video download
      this.youtubeService.convertToMp4(url, title, videoItag).subscribe(
        (response: any) => {
          if (response.conversionId) {
            this.currentConversionId = response.conversionId;
            this.startProgressCheck(response.conversionId);
          } else {
            console.error('No conversion ID received:', response);
            this.handleError('Error starting conversion. Please try again.');
          }
        },
        error => {
          console.error('Error starting conversion:', error);
          this.handleError('Error starting conversion. Please try again.');
        }
      );
    }
  }

  private startProgressCheck(conversionId: string) {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }

    this.progressSubscription = interval(2000)
      .pipe(
        takeWhile(() => this.isConverting),
        switchMap(() => this.youtubeService.getConversionProgress(conversionId).pipe(
          catchError(error => {
            console.error('Progress check error:', error);
            this.retryCount++;
            if (this.retryCount >= this.maxRetries) {
              this.handleError('Error checking progress. Please try again.');
            }
            return EMPTY;
          })
        )),
        // Stop polling at the first terminal status so the download fires exactly once
        takeWhile((p: any) => p.status !== 'completed' && p.status !== 'error', true)
      )
      .subscribe(
        (progress: any) => {
          this.progress = progress.progress;
          this.status = progress.status;

          if (progress.status === 'merging') {
            this.progress = 95;
          }
          if (progress.status === 'completed') {
            this.progress = 100;
            // Store the conversion ID before downloading
            this.currentConversionId = conversionId;
            this.downloadFile(this.currentUrl, this.currentTitle);
          } else if (progress.status === 'error') {
            this.handleError('Conversion failed. Please try again.');
          }
        },
        error => {
          console.error('Progress check error:', error);
          this.handleError('Error checking progress. Please try again.');
        }
      );
  }

  private handleError(message: string) {
    this.status = message;
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
      this.progressSubscription = null;
    }
    setTimeout(() => {
      this.isConverting = false;
    }, 3000);
  }

  private downloadFile(videoUrl: string, title: string, audioUrl?: string) {
    this.status = 'Downloading...';
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    const filename = `${sanitizedTitle}_HDTube.mp4`;

    if (audioUrl) {
      this.youtubeService.convertToMp4(videoUrl, title).subscribe(
        (response: any) => {
          if (response.conversionId) {
            this.currentConversionId = response.conversionId;
            this.startProgressCheck(response.conversionId);
          }
        },
        error => {
          console.error('Error starting conversion:', error);
          this.handleError('Error starting conversion. Please try again.');
        }
      );
    } else {
      // Check if we have a valid conversion ID
      if (!this.currentConversionId) {
        console.error('No conversion ID available');
        this.handleError('No conversion ID available. Please try again.');
        return;
      }

      // Use the download-merged endpoint for the converted file
      const downloadUrl = `${this.youtubeService.apiUrl}/download-merged?conversionId=${this.currentConversionId}`;
      console.log('Downloading from:', downloadUrl);
      
      this.http.get(downloadUrl, {
        responseType: 'blob',
        observe: 'response'
      }).subscribe(
        response => {
          const blob = response.body;
          if (blob) {
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
            this.status = 'Download complete!';
            setTimeout(() => {
              this.isConverting = false;
            }, 1000);
          }
        },
        error => {
          console.error('Download error:', error);
          this.handleError('Error downloading file. Please try again.');
        }
      );
    }
  }

  private getStatusMessage(status: string): string {
    switch (status) {
      case 'starting':
        return 'Preparing to convert...';
      case 'converting':
        return 'Converting and downloading...';
      case 'completed':
        return 'Conversion completed!';
      case 'error':
        return 'Conversion failed. Please try again.';
      default:
        return status || 'Processing...';
    }
  }

  // Start an audio download; the upstream currently returns M4A.
  startAudioConversion(url: string, title: string, audioItag: string, abr: string) {
    this.isConverting = true;
    this.progress = 0;
    this.status = 'Starting audio conversion...';
    this.currentUrl = url;
    this.currentTitle = title;
    this.retryCount = 0;

    this.youtubeService.audioToMp3(url, title, audioItag, abr).subscribe(
      (response: any) => {
        if (response.conversionId) {
          this.currentConversionId = response.conversionId;
          this.startAudioProgressCheck(response.conversionId);
        } else {
          console.error('No conversion ID received:', response);
          this.handleError('Error starting audio conversion. Please try again.');
        }
      },
      error => {
        console.error('Error starting audio conversion:', error);
        this.handleError('Error starting audio conversion. Please try again.');
      }
    );
  }

  private startAudioProgressCheck(conversionId: string) {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
    this.progressSubscription = interval(2000)
      .pipe(
        takeWhile(() => this.isConverting),
        switchMap(() => this.youtubeService.getConversionProgress(conversionId).pipe(
          catchError(error => {
            console.error('Audio progress check error:', error);
            this.retryCount++;
            if (this.retryCount >= this.maxRetries) {
              this.handleError('Error checking audio progress. Please try again.');
            }
            return EMPTY;
          })
        )),
        takeWhile((p: any) => p.status !== 'completed' && p.status !== 'error', true)
      )
      .subscribe(
        (progress: any) => {
          this.progress = progress.progress;
          this.status = progress.status;

          if (progress.status === 'merging') {
            this.progress = 95;
          }
          if (progress.status === 'completed') {
            this.progress = 100;
            this.currentConversionId = conversionId;
            this.downloadAudioMp3();
          } else if (progress.status === 'error') {
            this.handleError('Audio conversion failed. Please try again.');
          }
        },
        error => {
          console.error('Audio progress check error:', error);
          this.handleError('Error checking audio progress. Please try again.');
        }
      );
  }

  private downloadAudioMp3() {
    this.status = 'Downloading M4A...';
    if (!this.currentConversionId) {
      this.handleError('No conversion ID available. Please try again.');
      return;
    }
    // Store the filename from the conversion progress for the download
    const sanitizedTitle = this.currentTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    this.youtubeService.currentFilename = `${sanitizedTitle}_HDTube.m4a`;
    this.youtubeService.downloadAudioMp3(this.currentConversionId).then(
      () => {
        this.status = 'Download complete!';
        setTimeout(() => {
          this.isConverting = false;
        }, 1000);
      },
      error => {
        console.error('Audio download error:', error);
        this.handleError(error.message || 'Audio download failed. Please try again.');
      }
    );
  }

  ngOnDestroy() {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
  }
} 