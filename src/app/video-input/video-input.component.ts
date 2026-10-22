import { Component } from '@angular/core';
import { YouTubeService } from '../youtube.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-video-input',
  templateUrl: './video-input.component.html',
  styleUrls: ['./video-input.component.css'],
})
export class VideoInputComponent {
  videoUrl: string = '';
  videoDetails: any;
  isLoading: boolean = false; // Loading flag
  errorMessage: string = '';

  constructor(private youtubeService: YouTubeService) {}

  // Add: Robust YouTube URL validation
  isValidYouTubeUrl(url: string): boolean {
    // Accepts all common YouTube URL formats
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)[\w-]{11}([&?].*)?$/;
    return regex.test(url.trim());
  }

  onSubmit() {
    this.errorMessage = '';
    if (!this.isValidYouTubeUrl(this.videoUrl)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid YouTube URL',
        text: 'Please enter a valid YouTube video URL. Examples:- https://www.youtube.com/watch?v=XXXXXXXXXXX - https://youtu.be/XXXXXXXXXXX',
        confirmButtonText: 'OK',
        customClass: {
          popup: 'swal-compact',
          title: 'swal-title-compact'
        }
      });
      return;
    }
    this.isLoading = true; // Show loading GIF
    this.videoDetails = null; // Clear previous details
    this.youtubeService.getVideoDetails(this.videoUrl).subscribe(
      (data) => {
        this.videoDetails = data;
        this.isLoading = false; // Hide loading GIF
      },
      (error) => {
        console.error('Error fetching video details:', error);
        this.errorMessage =
          (error.error && error.error.error) ||
          'Unable to fetch video details. Please check the URL and try again.';
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
