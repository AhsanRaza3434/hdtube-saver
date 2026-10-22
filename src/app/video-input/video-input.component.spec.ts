import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { VideoInputComponent } from './video-input.component';
import { YouTubeService } from '../youtube.service';

describe('VideoInputComponent', () => {
  let component: VideoInputComponent;
  let fixture: ComponentFixture<VideoInputComponent>;
  let youtubeService: jasmine.SpyObj<YouTubeService>;

  beforeEach(async () => {
    youtubeService = jasmine.createSpyObj('YouTubeService', ['getVideoDetails']);
    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [VideoInputComponent],
      providers: [{ provide: YouTubeService, useValue: youtubeService }],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VideoInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reject URLs that are not valid YouTube video URLs', () => {
    expect(component.isValidYouTubeUrl('https://example.com/watch?v=abcdefghijk')).toBe(false);
    expect(youtubeService.getVideoDetails).not.toHaveBeenCalled();
  });

  it('should display details after a successful lookup', () => {
    const details = { title: 'Example video' };
    youtubeService.getVideoDetails.and.returnValue(of(details));
    component.videoUrl = 'https://youtu.be/abcdefghijk';

    component.onSubmit();

    expect(component.videoDetails).toBe(details);
    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toBe('');
  });

  it('should show an error when the lookup fails', () => {
    youtubeService.getVideoDetails.and.returnValue(
      throwError({ error: { error: 'Video unavailable' } })
    );
    component.videoUrl = 'https://youtu.be/abcdefghijk';

    component.onSubmit();

    expect(component.videoDetails).toBeNull();
    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toBe('Video unavailable');
  });
});
