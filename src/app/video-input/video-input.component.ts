import { Component } from '@angular/core';
import { YouTubeService } from '../youtube.service';

@Component({
  selector: 'app-video-input',
  templateUrl: './video-input.component.html',
  styleUrls: ['./video-input.component.css'],
})
export class VideoInputComponent {
  videoUrl: string = '';
  videoDetails: any;
  isLoading: boolean = false; // Loading flag

  constructor(private youtubeService: YouTubeService) {}


  onSubmit() {
    this.isLoading = true; // Show loading GIF
    this.videoDetails = null; // Clear previous details
    this.youtubeService.getVideoDetails(this.videoUrl).subscribe(
      (data) => {
        this.videoDetails = data;
        this.isLoading = false; // Hide loading GIF
      },
      (error) => {
        console.error('Error fetching video details:', error);
        this.isLoading = false; // Hide loading GIF on error
      }
    );
  }

  download(event: { url: string; format: string }) {
    if (event.url && event.format) {
      this.youtubeService.downloadVideo(event.url, event.format);
    } else {
      console.error('Invalid URL or format passed.');
    }
  }
  
}
