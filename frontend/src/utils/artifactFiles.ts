import type { StoredArtifact } from '@/store/useArtifactStore';
import api from '@/services/api';

const MIME_BY_FORMAT: Record<string, string> = {
  markdown: 'text/markdown;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  text: 'text/plain;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
  html: 'text/html;charset=utf-8',
  css: 'text/css;charset=utf-8',
  javascript: 'application/javascript;charset=utf-8',
  js: 'application/javascript;charset=utf-8',
  typescript: 'application/typescript;charset=utf-8',
  ts: 'application/typescript;charset=utf-8',
  tsx: 'application/typescript;charset=utf-8',
  jsx: 'application/javascript;charset=utf-8',
  python: 'text/x-python;charset=utf-8',
  py: 'text/x-python;charset=utf-8',
  cpp: 'text/x-c++;charset=utf-8',
  c: 'text/x-c;charset=utf-8',
  yaml: 'text/yaml;charset=utf-8',
  yml: 'text/yaml;charset=utf-8',
  xml: 'application/xml;charset=utf-8',
  sql: 'application/sql;charset=utf-8',
  bash: 'application/x-sh;charset=utf-8',
  sh: 'application/x-sh;charset=utf-8',
};

const EXTENSION_BY_FORMAT: Record<string, string> = {
  markdown: 'md',
  md: 'md',
  text: 'txt',
  txt: 'txt',
  python: 'py',
  py: 'py',
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  cpp: 'cpp',
  c: 'c',
  yaml: 'yml',
  yml: 'yml',
  bash: 'sh',
  sh: 'sh',
};

export function artifactFormat(artifact: Pick<StoredArtifact, 'format'>): string {
  return artifact.format || 'markdown';
}

export function artifactFilename(artifact: StoredArtifact): string {
  if (artifact.filename) return artifact.filename;
  const fmt = artifactFormat(artifact);
  const extension = EXTENSION_BY_FORMAT[fmt] || fmt;
  const name = artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'artifact';
  return `${name}.${extension}`;
}

export function downloadArtifact(artifact: StoredArtifact) {
  const format = artifactFormat(artifact);
  const mimeType = MIME_BY_FORMAT[format] || 'text/plain;charset=utf-8';
  const blob = new Blob([artifact.content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = artifactFilename(artifact);
  link.click();
  URL.revokeObjectURL(link.href);
}

export function convertMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;
  html = html.replace(/\r/g, '');

  // Strip or replace simple markdown styles
  // Bold text (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Headings (#, ##, ###)
  html = html.replace(/^# (.*?)$/gm, '<h1 style="color: #0f172a; border-bottom: 2px solid #004ac6; padding-bottom: 6px; margin-top: 24px; margin-bottom: 12px; font-size: 22px; font-weight: 800; font-family: \'Inter\', sans-serif;">$1</h1>');
  html = html.replace(/^## (.*?)$/gm, '<h2 style="color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: \'Inter\', sans-serif;">$1</h2>');
  html = html.replace(/^### (.*?)$/gm, '<h3 style="color: #334155; margin-top: 14px; margin-bottom: 6px; font-size: 13px; font-weight: 600; font-family: \'Inter\', sans-serif;">$1</h3>');

  // Parse lines to group bullet points
  const lines = html.split('\n');
  let inList = false;
  const processedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const content = trimmed.substring(2).trim();
      if (!inList) {
        processedLines.push('<ul style="margin-top: 4px; margin-bottom: 10px; padding-left: 20px; list-style-type: disc;">');
        inList = true;
      }
      processedLines.push(`<li style="margin-bottom: 4px; color: #334155; font-size: 12px; font-family: \'Inter\', sans-serif; line-height: 1.4;">${content}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      if (trimmed) {
        processedLines.push(`<p style="margin-top: 0; margin-bottom: 10px; color: #475569; font-size: 12px; font-family: \'Inter\', sans-serif; line-height: 1.5;">${line}</p>`);
      } else {
        processedLines.push('<div style="height: 6px;"></div>');
      }
    }
  }
  if (inList) {
    processedLines.push('</ul>');
  }

  return processedLines.join('\n');
}

export function downloadArtifactAsPdf(artifact: StoredArtifact) {
  if (artifact.data?.resume_id) {
    // Database-backed resume: download high-quality PDF directly from the FastAPI backend!
    const baseURL = api.defaults.baseURL || import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const downloadUrl = `${baseURL}/resumes/${artifact.data.resume_id}/download?format=pdf`;
    window.open(downloadUrl, '_blank');
    return;
  }

  // Generic document: Create a temporary iframe or pop-up to trigger printing
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Pop-up blocked. Please allow pop-ups to export as PDF.');
    return;
  }

  // Render content depending on whether it is HTML or Markdown/Text
  let bodyContent = '';
  if (artifact.format === 'html') {
    bodyContent = artifact.content;
  } else if (artifact.format === 'json') {
    bodyContent = `<pre><code>${JSON.stringify(JSON.parse(artifact.content), null, 2)}</code></pre>`;
  } else {
    bodyContent = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.6;">
        <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #004ac6; padding-bottom: 8px; margin-bottom: 20px; text-transform: uppercase;">${artifact.title}</h1>
        <p style="color: #64748b; font-size: 12px; margin-top: -12px; margin-bottom: 30px; font-style: italic;">Generated by Career Pilot Assistant</p>
        <div style="font-size: 14px;">${convertMarkdownToHtml(artifact.content)}</div>
      </div>
    `;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${artifact.title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @media print {
            body { margin: 0; background: white; }
            button { display: none; }
          }
          pre { background: #f8f9ff; padding: 16px; border-radius: 8px; border: 1px solid #c3c6d7; overflow-x: auto; }
          code { font-family: Consolas, Monaco, monospace; font-size: 13px; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        ${bodyContent}
      </body>
    </html>
  `);
  printWindow.document.close();
}

