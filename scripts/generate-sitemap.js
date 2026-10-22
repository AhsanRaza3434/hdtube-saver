/**
 * Dynamic Sitemap Generator for HDTube Saver
 * Run: node scripts/generate-sitemap.js
 * Generates sitemap.xml with all active routes
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SITE_URL || 'https://hdtube-saver.netlify.app';

const routes = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/faq', priority: '0.7', changefreq: 'monthly' },
  { path: '/privacy-policy', priority: '0.5', changefreq: 'monthly' },
  { path: '/terms-of-service', priority: '0.5', changefreq: 'monthly' },
];

function generateSitemap() {
  const now = new Date().toISOString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
  xml += '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9\n';
  xml += '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n';

  routes.forEach((route) => {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${route.path}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    xml += `    <priority>${route.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  xml += '</urlset>';

  const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
  fs.writeFileSync(outputPath, xml, 'utf8');
  console.log(`✅ Sitemap generated at ${outputPath}`);
  console.log(`   ${routes.length} URLs included`);
}

generateSitemap();
