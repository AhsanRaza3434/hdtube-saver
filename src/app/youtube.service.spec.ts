import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { YouTubeService } from './youtube.service';

describe('YoutubeService', () => {
  let service: YouTubeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(YouTubeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
