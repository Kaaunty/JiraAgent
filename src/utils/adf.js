/**
 * Converte texto Markdown para o Atlassian Document Format (ADF).
 *
 * Implementação própria que não depende de bibliotecas externas,
 * garantindo compatibilidade total com a API REST v3 do Jira Cloud.
 *
 * Suporta: headings (#, ##, ###), bold, italic, inline code,
 *          bullet lists, numbered lists, checklist items (- [ ]).
 *
 * @param {string} markdown - O texto em markdown.
 * @returns {object} Documento ADF compatível com a API v3 do Jira.
 */
export function convertMarkdownToAdf(markdown) {
  if (!markdown || typeof markdown !== "string") {
    return buildDoc([]);
  }

  try {
    const lines = markdown.split("\n");
    const content = parseLines(lines);
    return buildDoc(content);
  } catch (error) {
    console.error("Erro ao converter markdown para ADF:", error);
    return buildDoc([buildParagraph([buildText(markdown)])]);
  }
}

// ---------------------------------------------------------------------------
// Parser de linhas
// ---------------------------------------------------------------------------

function parseLines(lines) {
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Linha vazia — separador
    if (trimmed === "") {
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      nodes.push(buildHeading(headingMatch[2], headingMatch[1].length));
      i++;
      continue;
    }

    // Bullet list (-, *, +) — agrupa itens consecutivos numa só bulletList
    if (/^\s*[-*+]\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[-*+]\s*/, "");
        // Checklist item: - [ ] texto ou - [x] texto
        // Jira não suporta taskItem dentro de bulletList — usamos prefix visual
        const checkMatch = itemText.match(/^\[([ xX])\]\s*(.+)$/);
        if (checkMatch) {
          const done = checkMatch[1] !== " ";
          const prefix = done ? "✅ " : "☐ ";
          listItems.push(buildListItem(parseInline(prefix + checkMatch[2])));
        } else {
          listItems.push(buildListItem(parseInline(itemText)));
        }
        i++;
      }
      nodes.push({ type: "bulletList", content: listItems });
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*\d+\.\s*/, "");
        listItems.push(buildListItem(parseInline(itemText)));
        i++;
      }
      nodes.push({ type: "orderedList", content: listItems });
      continue;
    }

    // Parágrafo: agrega linhas contíguas não-vazias
    const paragraphLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().match(/^#{1,6}\s/) &&
      !/^\s*[-*+]\s/.test(lines[i]) &&
      !/^\s*\d+\.\s/.test(lines[i])
    ) {
      paragraphLines.push(lines[i].trim());
      i++;
    }

    if (paragraphLines.length > 0) {
      const joined = paragraphLines.join(" ");
      nodes.push(buildParagraph(parseInline(joined)));
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Parser de inline (bold, italic, code, texto)
// ---------------------------------------------------------------------------

function parseInline(text) {
  if (!text) return [buildText("")];

  const tokens = [];
  // Regex que captura bold (**), italic (*), code (`)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Texto antes do match
    if (match.index > lastIndex) {
      tokens.push(buildText(text.slice(lastIndex, match.index)));
    }

    if (match[0].startsWith("**")) {
      tokens.push(buildText(match[2], ["strong"]));
    } else if (match[0].startsWith("*")) {
      tokens.push(buildText(match[3], ["em"]));
    } else if (match[0].startsWith("`")) {
      tokens.push(buildText(match[4], ["code"]));
    }

    lastIndex = regex.lastIndex;
  }

  // Texto restante
  if (lastIndex < text.length) {
    tokens.push(buildText(text.slice(lastIndex)));
  }

  return tokens.length > 0 ? tokens : [buildText(text)];
}

// ---------------------------------------------------------------------------
// Builders ADF
// ---------------------------------------------------------------------------

function buildDoc(content) {
  return { type: "doc", version: 1, content };
}

function buildHeading(text, level) {
  return {
    type: "heading",
    attrs: { level },
    content: [buildText(text)]
  };
}

function buildParagraph(inlineNodes) {
  return {
    type: "paragraph",
    content: Array.isArray(inlineNodes) ? inlineNodes : [buildText(String(inlineNodes))]
  };
}

function buildListItem(inlineNodes) {
  return {
    type: "listItem",
    content: [buildParagraph(inlineNodes)]
  };
}

function buildTaskItem(text, checked) {
  return {
    type: "taskItem",
    attrs: { localId: Math.random().toString(36).slice(2), state: checked ? "DONE" : "TODO" },
    content: parseInline(text)
  };
}

function buildText(text, marks = []) {
  const node = { type: "text", text: String(text) };
  if (marks.length > 0) {
    node.marks = marks.map(m => ({ type: m }));
  }
  return node;
}
