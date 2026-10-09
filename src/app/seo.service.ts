import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly siteUrl = 'https://hdtube-saver.netlify.app';
  private readonly siteName = 'HDTube Saver';

  private readonly routeMeta: Record<
    string,
    { title: string; description: string; schema?: object }
  > = {
    '/': {
      title: 'HDTube Saver - Download YouTube Videos in HD for Free',
      description:
        'Download YouTube videos in HD quality for free. Convert to MP4, download available audio as M4A, and choose from multiple resolutions.',
    },
    '/faq': {
      title: 'FAQ - HDTube Saver | Frequently Asked Questions',
      description:
        'Find answers to common questions about HDTube Saver. Learn about supported formats, legality, usage, and more.',
    },
    '/privacy-policy': {
      title: 'Privacy Policy - HDTube Saver',
      description:
        'Read HDTube Saver\'s privacy policy. Learn how we collect, use, and protect your data when using our YouTube downloader.',
    },
    '/terms-of-service': {
      title: 'Terms of Service - HDTube Saver',
      description:
        'Read HDTube Saver\'s terms of service. Understand the rules and guidelines for using our YouTube video downloader.',
    },
  };

  constructor(
    private titleService: Title,
    private metaService: Meta,
    private router: Router
  ) {}

  init(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateMeta();
      });
  }

  private updateMeta(): void {
    const path = this.router.url.split('?')[0].split('#')[0];
    const meta =
      this.routeMeta[path] || this.routeMeta[this.normalizePath(path)];

    if (meta) {
      this.titleService.setTitle(meta.title);
      this.metaService.updateTag(
        { name: 'description', content: meta.description },
        'name="description"'
      );
      this.metaService.updateTag(
        { property: 'og:title', content: meta.title },
        'property="og:title"'
      );
      this.metaService.updateTag(
        { property: 'og:description', content: meta.description },
        'property="og:description"'
      );
      this.metaService.updateTag(
        { property: 'og:url', content: this.siteUrl + path },
        'property="og:url"'
      );
      this.metaService.updateTag(
        { name: 'twitter:title', content: meta.title },
        'name="twitter:title"'
      );
      this.metaService.updateTag(
        { name: 'twitter:description', content: meta.description },
        'name="twitter:description"'
      );
    }

    // Update canonical URL
    const canonicalUrl = this.siteUrl + path;
    let canonical = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // Inject JSON-LD schema
    this.injectSchema(meta?.schema || this.getDefaultSchema());
  }

  private normalizePath(path: string): string {
    if (path === '/') return '/';
    return path.replace(/\/$/, '');
  }

  private getDefaultSchema(): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: this.siteName,
      url: this.siteUrl,
      description:
        'Free online YouTube video and audio downloader. Download video in HD or MP4 and available audio as M4A.',
      potentialAction: {
        '@type': 'SearchAction',
        target: this.siteUrl + '/?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    };
  }

  private injectSchema(schema: object): void {
    // Remove existing dynamic schema
    const existing = document.getElementById('dynamic-schema');
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'dynamic-schema';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }
}
