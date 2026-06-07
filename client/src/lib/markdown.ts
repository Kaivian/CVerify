// Custom Markdown to Premium HTML converter with secure HTML sanitization
export function parseAndSanitizeMarkdown(text: string): string {
  if (!text) return '';

  // 1. Basic HTML Sanitization - strip dangerous elements
  let clean = text
    .replace(/<script[^>]*>([\S\s]*?)<\/script>/gi, '')
    .replace(/<iframe[^>]*>([\S\s]*?)<\/iframe>/gi, '')
    .replace(/<object[^>]*>([\S\s]*?)<\/object>/gi, '')
    .replace(/<embed[^>]*>([\S\s]*?)<\/embed>/gi, '')
    .replace(/<style[^>]*>([\S\s]*?)<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');

  // 2. Parse Code Blocks ```code```
  clean = clean.replace(/```([\s\S]*?)```/g, (_, codeContent) => {
    const lines = codeContent.trim().split('\n');
    let language = 'text';
    let code = codeContent;
    if (lines.length > 0 && lines[0].length < 15 && !lines[0].includes(' ') && !lines[0].includes('\n')) {
      language = lines[0].trim();
      code = lines.slice(1).join('\n');
    }
    return `
      <div class="my-4 rounded-xl border border-separator bg-surface-secondary text-foreground overflow-hidden font-mono text-xs select-text shadow-lg">
        <div class="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-surface-tertiary/50 select-none text-[10px] uppercase font-bold tracking-wider text-muted">
          <span>${language}</span>
          <span class="text-muted/80">code block</span>
        </div>
        <pre class="p-4 overflow-x-auto leading-relaxed"><code>${escapeHtml(code)}</code></pre>
      </div>
    `;
  });

  // 3. Inline Code `code`
  clean = clean.replace(/`([^`\n]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-surface-secondary text-foreground font-mono text-xs font-semibold">$1</code>');

  // 4. Headers (#, ##, ###)
  clean = clean.replace(/^### (.*?)$/gm, '<h4 class="text-sm font-bold text-foreground mt-4 mb-2 font-outfit">$1</h4>');
  clean = clean.replace(/^## (.*?)$/gm, '<h3 class="text-base font-extrabold text-foreground mt-5 mb-2.5 font-outfit">$1</h3>');
  clean = clean.replace(/^# (.*?)$/gm, '<h2 class="text-lg font-black text-foreground mt-6 mb-3 font-outfit">$1</h2>');

  // 5. Bold & Italic
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-extrabold text-foreground">$1</strong>');
  clean = clean.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  // 6. Bullet lists
  clean = clean.replace(/^\s*[-*]\s+(.*?)$/gm, '<li class="ml-4 list-disc pl-1 text-foreground/90 leading-relaxed">$1</li>');

  // 7. Paragraphs (lines that don't look like block headers/lists/divs)
  const lines = clean.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<li') || trimmed.startsWith('<div') || trimmed.startsWith('</div') || trimmed.startsWith('<pre') || trimmed.startsWith('</pre') || trimmed.startsWith('<code') || trimmed.startsWith('</code')) {
      return line;
    }
    return `<p class="mb-2.5 leading-relaxed text-foreground/95">${line}</p>`;
  });

  return processedLines.join('\n');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface ParsedParagraph {
  isAccordionItem: boolean;
  title?: string;
  content?: string;
  rawText: string;
}

export interface RenderBlock {
  type: 'text' | 'accordion';
  text?: string;
  items?: Array<{ id: string; title: string; content: string }>;
}

export function parseSummaryBlocks(text: string): RenderBlock[] {
  if (!text) return [];

  // Normalize newlines
  const normalizedText = text.replace(/\r\n/g, '\n');

  // Split into lines to detect lists that are separated by single newlines
  const lines = normalizedText.split('\n');
  const paragraphs: string[] = [];
  let currentParagraph = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentParagraph) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
      continue;
    }

    // Check if the line starts a new list item
    const startsListItem = /^(?:\d+\.\s*|[-*•]\s+)\*?\*?[A-Za-z0-9]/.test(trimmed);
    if (startsListItem && currentParagraph) {
      paragraphs.push(currentParagraph.trim());
      currentParagraph = trimmed;
    } else {
      if (currentParagraph) {
        currentParagraph += '\n' + trimmed;
      } else {
        currentParagraph = trimmed;
      }
    }
  }
  if (currentParagraph) {
    paragraphs.push(currentParagraph.trim());
  }

  const parsedParagraphs: ParsedParagraph[] = paragraphs.map((p) => {
    // 1. Matches list marker prefix (e.g., "1. Title: Content" or "- Title - Content")
    const listMatch = p.match(/^(?:\d+\.\s*|[-*•]\s+)\*?\*?([A-Za-z0-9\s&/\\-_()[\]',]{2,50}?)\*?\*?\s*[:\-\u2013\u2014]\s*([\s\S]+)$/);
    if (listMatch) {
      return {
        isAccordionItem: true,
        title: listMatch[1].trim(),
        content: listMatch[2].trim(),
        rawText: p
      };
    }

    // 2. Matches bold title prefix (e.g., "**Title**: Content")
    const boldMatch = p.match(/^[*_]{2}([A-Za-z0-9\s&/\\-_()[\]',]{2,50}?)[*_]{2}\s*[:\-\u2013\u2014]\s*([\s\S]+)$/);
    if (boldMatch) {
      return {
        isAccordionItem: true,
        title: boldMatch[1].trim(),
        content: boldMatch[2].trim(),
        rawText: p
      };
    }

    return {
      isAccordionItem: false,
      rawText: p
    };
  });

  const blocks: RenderBlock[] = [];
  let currentAccordionItems: Array<{ id: string; title: string; content: string }> = [];

  for (let i = 0; i < parsedParagraphs.length; i++) {
    const p = parsedParagraphs[i];
    if (p.isAccordionItem && p.title && p.content) {
      currentAccordionItems.push({
        id: `accordion-item-${i}`,
        title: p.title,
        content: p.content
      });
    } else {
      if (currentAccordionItems.length > 0) {
        blocks.push({
          type: 'accordion',
          items: currentAccordionItems
        });
        currentAccordionItems = [];
      }
      blocks.push({
        type: 'text',
        text: p.rawText
      });
    }
  }

  if (currentAccordionItems.length > 0) {
    blocks.push({
      type: 'accordion',
      items: currentAccordionItems
    });
  }

  return blocks;
}
