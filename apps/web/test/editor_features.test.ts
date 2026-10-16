import { describe, it, expect } from 'vitest';
import { SUPPORTED_CODE_LANGUAGES } from '@envbook/shared';
import { htmlToMarkdown } from '../src/lib/exportUtils';

describe('/code Language Selector & Editor Block Features', () => {
  it('includes all 17 required programming languages with default plaintext', () => {
    const requiredLanguages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'c',
      'cpp',
      'csharp',
      'php',
      'html',
      'css',
      'json',
      'yaml',
      'sql',
      'bash',
      'powershell',
      'markdown',
      'plaintext',
    ];

    const supportedIds = SUPPORTED_CODE_LANGUAGES.map((l) => l.id);
    for (const req of requiredLanguages) {
      expect(supportedIds).toContain(req);
    }

    // Default language is plaintext
    expect(SUPPORTED_CODE_LANGUAGES[0].id).toBe('plaintext');
  });

  it('resolves common language aliases accurately', () => {
    const findLang = (query: string) => {
      const q = query.toLowerCase();
      return (
        SUPPORTED_CODE_LANGUAGES.find(
          (l) => l.id === q || l.aliases?.includes(q)
        )?.id || 'plaintext'
      );
    };

    expect(findLang('py')).toBe('python');
    expect(findLang('js')).toBe('javascript');
    expect(findLang('ts')).toBe('typescript');
    expect(findLang('sh')).toBe('bash');
    expect(findLang('cs')).toBe('csharp');
    expect(findLang('c++')).toBe('cpp');
    expect(findLang('md')).toBe('markdown');
    expect(findLang('unknown_lang')).toBe('plaintext');
  });

  it('preserves code block language attributes in markdown export and conversion', () => {
    const htmlWithCode = '<pre><code class="language-typescript">const x: number = 42;</code></pre>';
    const md = htmlToMarkdown(htmlWithCode);

    expect(md).toContain('```typescript');
    expect(md).toContain('const x: number = 42;');
    expect(md).toContain('```');
  });

  it('converts child-page blocks into clickable markdown links with pageId and title', () => {
    const htmlWithChildPage =
      '<div data-type="child-page" data-page-id="test-child-page-id" data-page-title="Test 2">' +
      '<a href="/app/page/test-child-page-id">Test 2</a>' +
      '</div>';

    const md = htmlToMarkdown(htmlWithChildPage);
    expect(md).toContain('[📄 Test 2](/app/page/test-child-page-id)');
  });
});
