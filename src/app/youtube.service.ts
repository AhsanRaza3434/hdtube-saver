import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { map, switchMap, takeWhile } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class YouTubeService {
  public apiUrl = 'http://54.245.252.27:3000/api';
  // public apiUrl = 'http://localhost:3000/api';

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
    return interval(1000).pipe(
      switchMap(() => this.http.get(`${this.apiUrl}/conversion-progress?conversionId=${conversionId}`)),
      takeWhile((response: any) => response.status !== 'completed' && response.status !== 'error', true)
    );
  }

  streamMerge(url: string, title: string, videoItag: string, audioItag: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/stream-merge`, {
      url: url,
      title: title,
      videoItag: videoItag,
      audioItag: audioItag
    });
  }

  // Add: Convert audio to MP3
  audioToMp3(url: string, title: string, audioItag: string, abr: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/audio-to-mp3`, {
      url: url,
      title: title,
      audioItag: audioItag,
      abr: abr
    });
  }

  // Add: Download the converted MP3 file
  downloadAudioMp3(conversionId: string): void {
    const downloadUrl = `${this.apiUrl}/download-audio-mp3?conversionId=${encodeURIComponent(conversionId)}`;
    window.location.href = downloadUrl;
  }
}
