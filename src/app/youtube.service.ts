import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class YouTubeService {
  public apiUrl = 'https://hdtube-saver.onrender.com/api';
  // public apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getVideoDetails(url: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/video-details`, { url });
  }

  downloadVideo(url: string, format: string): void {
    if (!url || !format) {
      console.error('Invalid URL or format');
      return;
    }
    // Make sure the URL is encoded properly
    const downloadUrl = `${this.apiUrl}/download?url=${encodeURIComponent(url)}&quality=${encodeURIComponent(format)}`;
    window.open(downloadUrl, '_blank');
  }
  
}
