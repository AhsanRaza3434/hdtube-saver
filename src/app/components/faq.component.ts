import { Component } from '@angular/core';

@Component({
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.css']
})
export class FaqComponent {
  faqs = [
    {
      q: 'Is HDTube Saver free to use?',
      a: 'Yes, HDTube Saver is completely free for all users.'
    },
    {
      q: 'Can I download both video and audio from YouTube?',
      a: 'Absolutely! You can download videos in HD, MP4, or just extract the audio as MP3.'
    },
    {
      q: 'Is it legal to download YouTube videos?',
      a: 'Downloading YouTube videos is allowed for personal, non-commercial use. Please respect YouTube\'s terms of service and copyright laws.'
    },
    {
      q: 'What formats are supported?',
      a: 'You can download in MP4, MP3, and other popular formats depending on the video.'
    },
    {
      q: 'Do I need to install any software?',
      a: 'No installation required! HDTube Saver works directly in your browser.'
    }
  ];
  openedIndex: number | null = null;
  toggleFaq(i: number) {
    this.openedIndex = this.openedIndex === i ? null : i;
  }
} 