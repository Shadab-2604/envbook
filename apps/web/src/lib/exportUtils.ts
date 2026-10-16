/**
 * Document Export Utilities for EnvBook
 * Supports clean client-side export to Markdown (.md), Standalone Styled HTML (.html), and PDF (.pdf)
 */

export interface ExportOptions {
  title: string;
  content: string;
  tags?: string[];
}

/**
 * Converts DOM nodes to markdown recursively when in browser environment
 */
function domNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map(domNodeToMarkdown).join('');

  switch (tag) {
    case 'h1':
      return `\n\n# ${children.trim()}\n\n`;
    case 'h2':
      return `\n\n## ${children.trim()}\n\n`;
    case 'h3':
      return `\n\n### ${children.trim()}\n\n`;
    case 'p':
      return `\n${children.trim()}\n`;
    case 'strong':
    case 'b':
      return `**${children}**`;
    case 'em':
    case 'i':
      return `*${children}*`;
    case 's':
    case 'del':
    case 'strike':
      return `~~${children}~~`;
    case 'code':
      if (el.parentElement?.tagName.toLowerCase() === 'pre') {
        return children;
      }
      return `\`${children}\``;
    case 'pre': {
      const codeEl = el.querySelector('code');
      const className = codeEl?.className || '';
      const match = className.match(/language-(\w+)/);
      const lang = match ? match[1] : '';
      const codeContent = codeEl ? codeEl.textContent : el.textContent;
      return `\n\n\`\`\`${lang}\n${(codeContent || '').trim()}\n\`\`\`\n\n`;
    }
    case 'blockquote':
      return (
        '\n\n' +
        children
          .trim()
          .split('\n')
          .map((line) => `> ${line.trim()}`)
          .join('\n') +
        '\n\n'
      );
    case 'ul':
      return `\n${children}\n`;
    case 'ol': {
      let index = 1;
      return (
        '\n' +
        Array.from(el.children)
          .map((li) => {
            const liContent = Array.from(li.childNodes).map(domNodeToMarkdown).join('').trim();
            return `${index++}. ${liContent}\n`;
          })
          .join('') +
        '\n'
      );
    }
    case 'li': {
      const isTask = el.getAttribute('data-type') === 'taskItem';
      const checked = el.getAttribute('data-checked') === 'true';
      const prefix = isTask ? (checked ? '- [x] ' : '- [ ] ') : '- ';
      return `${prefix}${children.trim()}\n`;
    }
    case 'hr':
      return `\n\n---\n\n`;
    case 'a': {
      const href = el.getAttribute('href') || '';
      return `[${children}](${href})`;
    }
    case 'table': {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (rows.length === 0) return '';
      const lines: string[] = [];
      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('th, td')).map((cell) =>
          cell.textContent?.trim().replace(/\|/g, '\\|') || ''
        );
        lines.push(`| ${cells.join(' | ')} |`);
        if (rowIndex === 0) {
          lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
        }
      });
      return `\n\n${lines.join('\n')}\n\n`;
    }
    default:
      return children;
  }
}

/**
 * Universal regex-based HTML-to-Markdown parser (runs cleanly in Node & browser)
 */
export function regexHtmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;

  // Protect code blocks
  const codeBlocks: string[] = [];
  md = md.replace(/<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi, (_, lang, code) => {
    const unescaped = code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');
    const placeholder = `__ENVBOOK_CB_${codeBlocks.length}__`;
    codeBlocks.push(`\`\`\`${lang || ''}\n${unescaped.trim()}\n\`\`\``);
    return `\n\n${placeholder}\n\n`;
  });

  // Protect inline code
  const inlineCodes: string[] = [];
  md = md.replace(/<code>([\s\S]*?)<\/code>/gi, (_, code) => {
    const unescaped = code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');
    const placeholder = `__ENVBOOK_IC_${inlineCodes.length}__`;
    inlineCodes.push(`\`${unescaped}\``);
    return placeholder;
  });

  // Task list items
  md = md.replace(/<li[^>]*data-type="taskItem"[^>]*data-checked="true"[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const clean = inner.replace(/<\/?p[^>]*>/gi, '').trim();
    return `- [x] ${clean}\n`;
  });
  md = md.replace(/<li[^>]*data-type="taskItem"[^>]*data-checked="false"[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const clean = inner.replace(/<\/?p[^>]*>/gi, '').trim();
    return `- [ ] ${clean}\n`;
  });

  // Regular list items
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const clean = inner.replace(/<\/?p[^>]*>/gi, '').trim();
    return `- ${clean}\n`;
  });
  md = md.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');

  // Horizontal Rule
  md = md.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, quote) => {
    const lines = quote
      .replace(/<\/?p[^>]*>/gi, '')
      .trim()
      .split('\n');
    return '\n\n' + lines.map((l: string) => `> ${l.trim()}`).join('\n') + '\n\n';
  });

  // Table handling
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rowMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    if (rowMatches.length === 0) return '';
    const tableLines: string[] = [];
    rowMatches.forEach((rowHtml: string, rowIndex: number) => {
      const cellMatches = rowHtml.match(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
      const cells = cellMatches.map((c: string) =>
        c.replace(/<(th|td)[^>]*>|<\/(th|td)>/gi, '').trim().replace(/\|/g, '\\|')
      );
      tableLines.push(`| ${cells.join(' | ')} |`);
      if (rowIndex === 0) {
        tableLines.push(`| ${cells.map(() => '---').join(' | ')} |`);
      }
    });
    return `\n\n${tableLines.join('\n')}\n\n`;
  });

  // Paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');

  // Text formatting
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  md = md.replace(/<(s|del|strike)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Strip residual tags
  md = md.replace(/<[^>]+>/g, '');

  // HTML entity decode
  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Restore code blocks and inline code
  codeBlocks.forEach((cb, idx) => {
    md = md.replace(`__ENVBOOK_CB_${idx}__`, cb);
  });
  inlineCodes.forEach((ic, idx) => {
    md = md.replace(`__ENVBOOK_IC_${idx}__`, ic);
  });

  return md.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Converts HTML content to clean Markdown string
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html.trim();
  }

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const parsed = domNodeToMarkdown(doc.body);
      if (parsed) return parsed.replace(/\n{3,}/g, '\n\n').trim();
    } catch {
      // Fallback to regex
    }
  }

  return regexHtmlToMarkdown(html);
}

/**
 * Generates a self-contained, publication-ready styled HTML document
 */
export function generateHtmlDocument(title: string, contentHtml: string, tags: string[] = []): string {
  const safeTitle = title || 'Untitled Document';
  const tagBadges = tags
    .map(
      (t) =>
        `<span style="display:inline-block;padding:2px 8px;margin-right:6px;border-radius:4px;background:#161f2e;color:#10b981;font-size:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;border:1px solid #1e2d42;">#${t}</span>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} — EnvBook</title>
  <style>
    :root {
      --bg: #090d13;
      --card-bg: #0d121a;
      --border: #1e2633;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --accent: #10b981;
      --code-bg: #161b22;
    }
    * { box-sizing: border-box; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.65;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 840px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 48px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .doc-header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    h1.doc-title {
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 16px 0;
      letter-spacing: -0.02em;
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      color: var(--text-muted);
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .doc-content h1 { font-size: 26px; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 32px; color: #fff; }
    .doc-content h2 { font-size: 20px; margin-top: 24px; color: #fff; }
    .doc-content h3 { font-size: 16px; margin-top: 20px; color: #fff; }
    .doc-content p { margin: 16px 0; }
    .doc-content a { color: var(--accent); text-decoration: none; }
    .doc-content a:hover { text-decoration: underline; }
    .doc-content code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 85%;
      border: 1px solid var(--border);
      color: #38bdf8;
    }
    .doc-content pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
    }
    .doc-content pre code {
      background: none;
      padding: 0;
      border: none;
      color: #e6edf3;
      font-size: 13px;
    }
    .doc-content blockquote {
      border-left: 3px solid var(--accent);
      margin: 16px 0;
      padding: 8px 16px;
      background: rgba(16, 185, 129, 0.05);
      border-radius: 0 6px 6px 0;
      color: var(--text-muted);
    }
    .doc-content ul, .doc-content ol { padding-left: 24px; margin: 16px 0; }
    .doc-content li { margin: 6px 0; }
    .doc-content ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    .doc-content li[data-type="taskItem"] { display: flex; align-items: flex-start; gap: 8px; }
    .doc-content li[data-type="taskItem"] > input[type="checkbox"] { margin-top: 4px; accent-color: var(--accent); }
    .doc-content hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }
    .doc-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
    }
    .doc-content th, .doc-content td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    .doc-content th { background: #161b22; font-weight: 600; color: #fff; }
    .doc-footer {
      border-top: 1px solid var(--border);
      margin-top: 48px;
      padding-top: 20px;
      font-size: 11px;
      color: var(--text-muted);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { background: #fff !important; color: #111 !important; padding: 0 !important; }
      .container { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; background: #fff !important; }
      h1.doc-title, .doc-content h1, .doc-content h2, .doc-content h3 { color: #000 !important; }
      .meta-bar, .doc-footer { color: #666 !important; }
      .doc-content pre, .doc-content code { background: #f6f8fa !important; color: #000 !important; border-color: #ddd !important; }
      .doc-content th { background: #f0f0f0 !important; color: #000 !important; }
      .doc-content blockquote { background: #f9f9f9 !important; border-color: #059669 !important; color: #444 !important; }
      .doc-content pre, .doc-content table, .doc-content blockquote { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="doc-header">
      <h1 class="doc-title">${safeTitle}</h1>
      <div class="meta-bar">
        <span>Exported: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        ${tags.length > 0 ? `<div>${tagBadges}</div>` : ''}
      </div>
    </header>
    <main class="doc-content">
      ${contentHtml || '<p>No content</p>'}
    </main>
    <footer class="doc-footer">
      <span>EnvBook — Zero-Knowledge Developer Workspace</span>
      <span>Confidential</span>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Triggers a client-side file download
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generates and downloads a clean Markdown (.md) file
 */
export function exportToMarkdown(title: string, content: string): void {
  const safeName =
    (title || 'untitled-document')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '') || 'document';

  let mdBody = htmlToMarkdown(content);
  if (!mdBody.startsWith('# ')) {
    mdBody = `# ${title || 'Untitled Document'}\n\n${mdBody}`;
  }

  downloadFile(`${safeName}.md`, mdBody, 'text/markdown;charset=utf-8');
}

/**
 * Generates and downloads a standalone styled HTML (.html) file
 */
export function exportToHtml(title: string, content: string, tags: string[] = []): void {
  const safeName =
    (title || 'untitled-document')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '') || 'document';

  let htmlBody = content;
  if (!/<[a-z][\s\S]*>/i.test(content)) {
    htmlBody = content
      .split('\n\n')
      .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
      .join('\n');
  }

  const fullHtml = generateHtmlDocument(title, htmlBody, tags);
  downloadFile(`${safeName}.html`, fullHtml, 'text/html;charset=utf-8');
}

/**
 * Triggers native browser print/save-to-PDF dialog via an invisible isolated iframe
 */
export function exportToPdf(title: string, content: string, tags: string[] = []): void {
  if (typeof window === 'undefined') return;

  let htmlBody = content;
  if (!/<[a-z][\s\S]*>/i.test(content)) {
    htmlBody = content
      .split('\n\n')
      .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
      .join('\n');
  }

  const fullHtml = generateHtmlDocument(title, htmlBody, tags);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(fullHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('[exportToPdf] Error invoking print dialog:', err);
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) {
          win.onload = () => win.print();
        }
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 300);
  }
}
