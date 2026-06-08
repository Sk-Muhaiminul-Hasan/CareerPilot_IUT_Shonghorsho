import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface CodeBlock {
  kind: 'code';
  language: string;
  content: string;
}

interface TextBlock {
  kind: 'text';
  content: string;
}

type MarkdownBlock = CodeBlock | TextBlock;

const fencePattern = /```([a-zA-Z0-9_+.#-]*)[^\n]*\n([\s\S]*?)```/g;

export function AssistantMarkdown({ text, invert = false }: { text: string; invert?: boolean }) {
  return (
    <Box sx={{ '& > :first-of-type': { mt: 0 }, '& > :last-child': { mb: 0 } }}>
      {splitBlocks(text).map((block, index) =>
        block.kind === 'code' ? (
          <CodeBlockView key={`code-${index}`} block={block} invert={invert} />
        ) : (
          <TextBlockView key={`text-${index}`} content={block.content} invert={invert} />
        ),
      )}
    </Box>
  );
}

function splitBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(fencePattern)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      blocks.push({ kind: 'text', content: text.slice(lastIndex, start) });
    }
    blocks.push({
      kind: 'code',
      language: match[1] || 'text',
      content: (match[2] || '').trim(),
    });
    lastIndex = start + (match[0]?.length ?? 0);
  }
  if (lastIndex < text.length) {
    blocks.push({ kind: 'text', content: text.slice(lastIndex) });
  }
  return blocks.filter((block) => block.content.trim());
}

function TextBlockView({ content, invert }: { content: string; invert: boolean }) {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lineAt(lines, index);
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1] || '#';
      const headingText = heading[2] || '';
      nodes.push(
        <Typography
          key={`h-${index}`}
          variant={level.length === 1 ? 'subtitle1' : 'subtitle2'}
          sx={{ mt: 1.25, mb: 0.5, fontWeight: 800, color: invert ? '#ffffff' : '#0b1c30' }}
        >
          {renderInline(headingText, invert)}
        </Typography>,
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lineAt(lines, index))) {
        items.push(lineAt(lines, index).replace(/^[-*]\s+/, ''));
        index += 1;
      }
      nodes.push(<ListView key={`ul-${index}`} items={items} ordered={false} invert={invert} />);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lineAt(lines, index))) {
        items.push(lineAt(lines, index).replace(/^\d+[.)]\s+/, ''));
        index += 1;
      }
      nodes.push(<ListView key={`ol-${index}`} items={items} ordered invert={invert} />);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lineAt(lines, index)) {
      const current = lineAt(lines, index);
      if (/^(#{1,3})\s+/.test(current) || /^[-*]\s+/.test(current) || /^\d+[.)]\s+/.test(current)) {
        break;
      }
      paragraph.push(current);
      index += 1;
    }
    nodes.push(
      <Typography key={`p-${index}`} variant="body2" sx={{ my: 0.75, lineHeight: 1.6 }}>
        {renderInline(paragraph.join(' '), invert)}
      </Typography>,
    );
  }

  return <>{nodes}</>;
}

function lineAt(lines: string[], index: number): string {
  return (lines[index] || '').trim();
}

function ListView({
  items,
  ordered,
  invert,
}: {
  items: string[];
  ordered: boolean;
  invert: boolean;
}) {
  return (
    <Box
      component={ordered ? 'ol' : 'ul'}
      sx={{ pl: 2.4, my: 0.75, '& li': { mb: 0.35, lineHeight: 1.55 } }}
    >
      {items.map((item, index) => (
        <Typography key={`${item}-${index}`} component="li" variant="body2">
          {renderInline(item, invert)}
        </Typography>
      ))}
    </Box>
  );
}

function CodeBlockView({ block, invert }: { block: CodeBlock; invert: boolean }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        my: 1,
        overflow: 'hidden',
        borderRadius: 1,
        borderColor: invert ? 'rgba(255,255,255,0.28)' : 'divider',
        backgroundColor: invert ? 'rgba(255,255,255,0.12)' : '#101828',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          px: 1,
          py: 0.5,
          color: invert ? '#ffffff' : '#d0d5dd',
          borderBottom: '1px solid',
          borderColor: invert ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)',
        }}
      >
        {block.language}
      </Typography>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.25,
          overflowX: 'auto',
          color: '#f9fafb',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        <code>{block.content}</code>
      </Box>
    </Paper>
  );
}

function renderInline(text: string, invert: boolean): React.ReactNode[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Box
            key={`${part}-${index}`}
            component="code"
            sx={{
              px: 0.45,
              py: 0.1,
              borderRadius: 0.75,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '0.86em',
              color: invert ? '#ffffff' : '#003f9e',
              backgroundColor: invert ? 'rgba(255,255,255,0.18)' : 'rgba(0,74,198,0.08)',
            }}
          >
            {part.slice(1, -1)}
          </Box>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Box key={`${part}-${index}`} component="strong" sx={{ fontWeight: 800 }}>
            {part.slice(2, -2)}
          </Box>
        );
      }
      return part;
    });
}
