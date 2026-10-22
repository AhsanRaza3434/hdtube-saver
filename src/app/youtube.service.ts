import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class YouTubeService {
  public apiUrl = environment.apiUrl;
  public currentFilename: string = '';

  constructor(private http: HttpClient) {}

  getVideoDetails(url: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/video-details?url=${encodeURIComponent(url)}`);
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
  
  convertToMp4(url: string, title: string, itag?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/convert-to-mp4`, {
      url: url,
      title: title,
      itag: itag
    });
  }

  getConversionProgress(conversionId: string): Observable<any> {
    // Single request; callers own the polling interval.
    return this.http.get(`${this.apiUrl}/conversion-progress?conversionId=${conversionId}`);
  }

  streamMerge(url: string, title: string, videoItag: string, audioItag: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/stream-merge`, {
      url: url,
      title: title,
      videoItag: videoItag,
      audioItag: audioItag
    });
  }

  // The upstream service returns M4A audio; the legacy route name is retained.
  audioToMp3(url: string, title: string, audioItag: string, abr: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/audio-to-mp3`, {
      url: url,
      title: title,
      audioItag: audioItag,
      abr: abr
    });
  }

  // The legacy method name is retained for compatibility with existing callers.
  downloadAudioMp3(conversionId: string): Promise<void> {
    const downloadUrl = `${this.apiUrl}/download-audio-mp3?conversionId=${encodeURIComponent(conversionId)}`;
    // Fetch as blob first so we can detect error responses (e.g. 404 JSON) instead of saving them as a file
    return fetch(downloadUrl)
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.error || `Download failed (${response.status})`);
          });
        }
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return response.json().then(err => {
            throw new Error(err.error || 'Download failed');
          });
        }
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // Use the video title from the conversion progress, fallback to conversionId
        link.download = this.currentFilename || `${conversionId}_HDTube.m4a`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      })
  }
}
