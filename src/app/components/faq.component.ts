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
      a: 'Absolutely! You can download videos in HD or MP4, or download the available audio as M4A.'
    },
    {
      q: 'Is it legal to download YouTube videos?',
      a: 'Downloads may be restricted by YouTube\'s terms and copyright law. Only download content when you have the necessary rights or permission.'
    },
    {
      q: 'What formats are supported?',
      a: 'Video downloads are provided in MP4. Audio downloads are provided in M4A.'
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