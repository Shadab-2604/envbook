import { describe, it, expect } from 'vitest';
import {
  htmlToMarkdown,
  regexHtmlToMarkdown,
  generateHtmlDocument,
} from '../src/lib/exportUtils';

describe('Document Export Utilities', () => {
  describe('htmlToMarkdown conversion', () => {
    it('converts headings, paragraphs and text formatting', () => {
      const html = '<h1>Title</h1><p>This is <strong>bold</strong> and <em>italic</em> with <code>inline code</code>.</p>';
      const md = htmlToMarkdown(html);
      expect(md).toContain('# Title');
      expect(md).toContain('**bold**');
      expect(md).toContain('*italic*');
      expect(md).toContain('`inline code`');
    });

    it('converts fenced code blocks with language', () => {
      const html = '<pre><code class="language-typescript">const apiKey = "secret_123";\nconsole.log(apiKey);</code></pre>';
      const md = htmlToMarkdown(html);
      expect(md).toContain('```typescript');
      expect(md).toContain('const apiKey = "secret_123";');
      expect(md).toContain('```');
    });

    it('converts task lists and bullet lists', () => {
      const html = `
        <ul data-type="taskList">
          <li data-type="taskItem" data-checked="true"><p>Completed item</p></li>
          <li data-type="taskItem" data-checked="false"><p>Pending item</p></li>
        </ul>
      `;
      const md = htmlToMarkdown(html);
      expect(md).toContain('- [x] Completed item');
      expect(md).toContain('- [ ] Pending item');
    });

    it('converts blockquotes and tables', () => {
      const html = `
        <blockquote><p>Security first architecture</p></blockquote>
        <table>
          <tr><th>Key</th><th>Type</th></tr>
          <tr><td>PORT</td><td>number</td></tr>
        </table>
      `;
      const md = htmlToMarkdown(html);
      expect(md).toContain('> Security first architecture');
      expect(md).toContain('| Key | Type |');
      expect(md).toContain('| --- | --- |');
      expect(md).toContain('| PORT | number |');
    });

    it('passes plain markdown through untouched', () => {
      const raw = '# Clean Title\n\n- item 1\n- item 2\n\n```bash\nnpm run test\n```';
      const md = htmlToMarkdown(raw);
      expect(md).toBe(raw);
    });
  });

  describe('generateHtmlDocument generator', () => {
    it('creates a complete styled HTML document with title and tags', () => {
      const title = 'Production Architecture';
      const body = '<p>Overview of the environment architecture.</p>';
      const tags = ['prod', 'security', 'aws'];

      const doc = generateHtmlDocument(title, body, tags);
      expect(doc).toContain('<!DOCTYPE html>');
      expect(doc).toContain('<title>Production Architecture — EnvBook</title>');
      expect(doc).toContain('<h1 class="doc-title">Production Architecture</h1>');
      expect(doc).toContain('#prod');
      expect(doc).toContain('#security');
      expect(doc).toContain('#aws');
      expect(doc).toContain('@media print');
      expect(doc).toContain('EnvBook — Zero-Knowledge Developer Workspace');
    });

    it('handles untitled documents and empty tags gracefully', () => {
      const doc = generateHtmlDocument('', '<p>Body text</p>', []);
      expect(doc).toContain('<title>Untitled Document — EnvBook</title>');
      expect(doc).toContain('<h1 class="doc-title">Untitled Document</h1>');
    });
  });
});
