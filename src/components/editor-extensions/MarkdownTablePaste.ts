import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Auto-converts pasted markdown tables (pipe + dash syntax) into native
 * TipTap table nodes. Without this, a paste from a Notion / chat / doc
 * lands as plain text — pipes get stripped during paragraph
 * normalization and the table flattens to a wall of words.
 *
 * Detection is intentionally strict: we only fire on text that opens
 * with a pipe-bearing header line followed by a dash separator. Plain
 * prose that happens to contain `this | that` falls through to TipTap's
 * default paste path. A single false negative (something looks
 * table-ish but the regex doesn't match) is far less disruptive than
 * mangling normal text into an unintended table.
 *
 * Out of scope (intentionally):
 *   - HTML tables (Excel / Google Sheets paste — different code path)
 *   - Inline mark formatting inside cells (bold / italic / links)
 *   - Column alignment from `|:---:|` separators
 *
 * Alignment + inline formatting can layer on later if a post needs
 * them. The Mykonos comparison table is the immediate driver and only
 * needs plain-text cells.
 */
export const MarkdownTablePaste = Extension.create({
  name: "markdownTablePaste",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownTablePaste"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain");
            if (!text) return false;
            const parsed = parseMarkdownTable(text);
            if (!parsed) return false;
            insertParsedTable(view, parsed);
            event.preventDefault();
            return true;
          }
        }
      })
    ];
  }
});

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

/**
 * Parse a markdown table block. Returns null if the input doesn't
 * match the shape — caller falls through to TipTap's default paste.
 *
 * Tolerated variations:
 *   - Leading + trailing pipes are optional
 *   - Whitespace around cells is trimmed
 *   - Body rows shorter than the header are padded; longer rows are
 *     truncated to header column count (avoids ragged-grid surprises)
 *   - Alignment markers in the separator (`:---`, `---:`, `:---:`)
 *     are accepted in detection but not surfaced in the output —
 *     every cell renders left-aligned via the .blog-table CSS
 */
export function parseMarkdownTable(text: string): ParsedTable | null {
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;

  const headerLine = lines[0];
  if (!headerLine.includes("|")) return null;

  // Separator: pipes, dashes, optional alignment colons, whitespace.
  // Must have at least one dash so plain prose with pipes doesn't trip.
  const separatorLine = lines[1];
  if (!/^\|?[\s|:-]+\|?$/.test(separatorLine)) return null;
  if (!separatorLine.includes("-")) return null;

  const parseRow = (line: string): string[] =>
    line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

  const headers = parseRow(headerLine);
  const bodyRaw = lines.slice(2).map(parseRow).filter((row) => row.length > 0);

  // Normalize column count to header width — pad short rows, truncate
  // long ones. Authors hand-typing a table sometimes drop a trailing
  // empty column or accidentally add one; we prefer "looks reasonable"
  // over "throws on uneven input."
  const cols = headers.length;
  const rows = bodyRaw.map((row) => {
    if (row.length === cols) return row;
    if (row.length < cols) {
      const padded = row.slice();
      while (padded.length < cols) padded.push("");
      return padded;
    }
    return row.slice(0, cols);
  });

  return { headers, rows };
}

/**
 * Build a TipTap table node from parsed cells + replace the current
 * selection with it. Schema lookup goes through `view.state.schema`
 * so the same code works regardless of which Editor instance is
 * active (StrictMode double-mount, HMR, multiple editors on a page).
 *
 * Empty cells become a single space — schema.text("") throws on the
 * empty string, and we'd rather render an empty-but-present cell
 * than fail the whole paste.
 */
function insertParsedTable(view: EditorView, parsed: ParsedTable): void {
  const { schema } = view.state;
  const { tableHeader, tableCell, tableRow, table, paragraph } = schema.nodes;
  if (!tableHeader || !tableCell || !tableRow || !table || !paragraph) return;

  const cellContent = (text: string) =>
    paragraph.create(null, schema.text(text.length > 0 ? text : " "));

  const headerCells = parsed.headers.map((text) =>
    tableHeader.create(null, cellContent(text))
  );
  const headerRow = tableRow.create(null, headerCells);

  const bodyRows = parsed.rows.map((row) => {
    const cells = row.map((text) => tableCell.create(null, cellContent(text)));
    return tableRow.create(null, cells);
  });

  const tableNode = table.create(null, [headerRow, ...bodyRows]);

  const tr = view.state.tr.replaceSelectionWith(tableNode);
  view.dispatch(tr);
}
