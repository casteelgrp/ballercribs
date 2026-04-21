"use client";

import { useEffect, useRef, useState } from "react";
import { ListingDescription } from "./ListingDescription";

type Mode = "edit" | "preview";

/**
 * Plain <textarea> with a quiet markdown toolbar above it. No WYSIWYG — the
 * stored value stays raw markdown, the toolbar just inserts syntax at the
 * current selection so the owner doesn't have to remember it.
 *
 * Preview swaps the textarea for the rendered ListingDescription in the same
 * visual slot (not a second pane) — keeps the form compact and matches what
 * the public page will actually show.
 */
export function DescriptionEditor({
  value,
  onChange,
  disabled = false,
  required = false,
  rows = 8,
  inputClass,
  placeholder
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  inputClass: string;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<Mode>("edit");
  const [helpOpen, setHelpOpen] = useState(false);

  // Queued cursor-restoration after a toolbar insertion. React re-renders
  // after onChange, so we re-apply selection on the next animation frame.
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  useEffect(() => {
    const sel = pendingSelection.current;
    if (!sel) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(sel.start, sel.end);
    pendingSelection.current = null;
  }, [value]);

  function getSelection() {
    const ta = textareaRef.current;
    if (!ta) return { start: value.length, end: value.length };
    return { start: ta.selectionStart, end: ta.selectionEnd };
  }

  /** Insert `prefix` at the start of the line containing the cursor. If a
   *  range is selected spanning multiple lines, prefix every selected line. */
  function applyLinePrefix(prefix: string) {
    const { start, end } = getSelection();
    // Find the start of the first affected line.
    const before = value.slice(0, start);
    const lineStart = before.lastIndexOf("\n") + 1;
    // For multi-line selection, also prefix every line inside the range.
    if (end > start && value.slice(start, end).includes("\n")) {
      const head = value.slice(0, lineStart);
      const body = value.slice(lineStart, end);
      const tail = value.slice(end);
      const prefixed = body
        .split("\n")
        .map((line) => (line.length ? prefix + line : line))
        .join("\n");
      const next = head + prefixed + tail;
      const delta = prefixed.length - body.length;
      pendingSelection.current = { start: lineStart, end: end + delta };
      onChange(next);
      return;
    }
    // Single line — insert prefix at line start unless already present
    if (value.slice(lineStart, lineStart + prefix.length) === prefix) {
      // Already prefixed; no-op (avoids stacking `## ## heading`).
      pendingSelection.current = { start, end };
      return;
    }
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    pendingSelection.current = {
      start: start + prefix.length,
      end: end + prefix.length
    };
    onChange(next);
  }

  /** Wrap selection (or insert wrapper and place cursor in the middle). */
  function applyWrap(wrapper: string) {
    const { start, end } = getSelection();
    const selected = value.slice(start, end);
    const next =
      value.slice(0, start) + wrapper + selected + wrapper + value.slice(end);
    if (start === end) {
      // No selection — drop cursor between the wrappers.
      pendingSelection.current = {
        start: start + wrapper.length,
        end: start + wrapper.length
      };
    } else {
      // Re-select the originally-highlighted text, now inside wrappers.
      pendingSelection.current = {
        start: start + wrapper.length,
        end: end + wrapper.length
      };
    }
    onChange(next);
  }

  function applyLink() {
    const { start, end } = getSelection();
    const selected = value.slice(start, end);
    const url = window.prompt("Link URL (https://… or /internal-path):");
    if (!url) return;
    let text = selected;
    if (!selected) {
      const asked = window.prompt("Link text:");
      if (!asked) return;
      text = asked;
    }
    const md = `[${text}](${url})`;
    const next = value.slice(0, start) + md + value.slice(end);
    pendingSelection.current = { start: start + md.length, end: start + md.length };
    onChange(next);
  }

  const btn =
    "text-xs uppercase tracking-widest border border-black/15 bg-white px-2.5 py-1 hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <button type="button" disabled={disabled || mode === "preview"} onClick={() => applyLinePrefix("## ")} className={btn}>
          H2
        </button>
        <button type="button" disabled={disabled || mode === "preview"} onClick={() => applyLinePrefix("### ")} className={btn}>
          H3
        </button>
        <button type="button" disabled={disabled || mode === "preview"} onClick={() => applyWrap("**")} className={btn}>
          Bold
        </button>
        <button type="button" disabled={disabled || mode === "preview"} onClick={() => applyWrap("*")} className={btn}>
          Italic
        </button>
        <button type="button" disabled={disabled || mode === "preview"} onClick={applyLink} className={btn}>
          Link
        </button>
        <button type="button" disabled={disabled || mode === "preview"} onClick={() => applyLinePrefix("- ")} className={btn}>
          List
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
            className={
              btn + (mode === "preview" ? " bg-ink text-paper border-ink" : "")
            }
            aria-pressed={mode === "preview"}
          >
            {mode === "preview" ? "Editing" : "Preview"}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setHelpOpen(true)}
            className={btn + " w-7 p-0 flex items-center justify-center"}
            aria-label="Markdown help"
            title="Markdown help"
          >
            ?
          </button>
        </div>
      </div>

      {mode === "edit" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          rows={rows}
          disabled={disabled}
          className={inputClass + " font-[inherit]"}
          placeholder={placeholder}
        />
      ) : (
        <div className="border border-black/20 bg-white px-4 py-3 min-h-[8rem]">
          {value.trim() ? (
            <ListingDescription markdown={value} />
          ) : (
            <p className="text-black/40 italic text-sm">Nothing to preview yet.</p>
          )}
        </div>
      )}

      {helpOpen && <MarkdownHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function MarkdownHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const row = "grid grid-cols-[1fr_auto] gap-4 py-1.5";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="md-help-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative z-10 w-full max-w-md bg-paper border border-black/10 p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4 gap-4">
          <h2 id="md-help-title" className="font-display text-xl leading-snug">
            Markdown cheat sheet
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-black/50 hover:text-ink -mt-1 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="text-sm divide-y divide-black/10 font-mono">
          <div className={row}>
            <code className="text-black/80">## Heading</code>
            <span className="text-black/50 font-sans">section title</span>
          </div>
          <div className={row}>
            <code className="text-black/80">**bold**</code>
            <span className="text-black/50 font-sans">bold text</span>
          </div>
          <div className={row}>
            <code className="text-black/80">*italic*</code>
            <span className="text-black/50 font-sans">italic text</span>
          </div>
          <div className={row}>
            <code className="text-black/80">[text](url)</code>
            <span className="text-black/50 font-sans">link</span>
          </div>
          <div className={row}>
            <code className="text-black/80">- item</code>
            <span className="text-black/50 font-sans">bullet list</span>
          </div>
        </div>

        <p className="text-xs text-black/55 mt-5 leading-relaxed">
          The toolbar above inserts these automatically. You can also just
          write plain text — it'll look the same as before.
        </p>
      </div>
    </div>
  );
}
