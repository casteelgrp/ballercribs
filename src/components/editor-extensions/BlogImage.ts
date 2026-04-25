import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlogImageNodeView } from "./BlogImageNodeView";

export type BlogImageAttrs = {
  src: string;
  alt: string;
  caption: string;
};

/**
 * Extension of the stock @tiptap/extension-image that adds editorial alt
 * text + an optional caption. Output shape:
 *
 *   - Caption present: <figure class="blog-figure"><img alt><figcaption /></figure>
 *   - Caption empty:   <img alt> (bare, same as before)
 *
 * Bare-<img> output is preserved when no caption so existing published
 * posts (which all predate this extension) keep rendering unchanged
 * after they round-trip through the editor again. parseHTML accepts
 * both shapes.
 *
 * Edits flow through the same modal pattern as PropertyCard / Gallery /
 * VideoEmbed: NodeView's Edit pill calls `onEditRequest` on the
 * extension's storage; <BlogEditor> wires that callback to open its
 * modal pre-filled.
 */
// Storage is keyed by ext.name at runtime — `image` here matches
// name: "image" below, which has to stay "image" so existing posts'
// {type: "image"} JSON nodes hydrate against the same slot and
// setImage() still works.
//
// Commands gets its own `blogImage` namespace because the stock
// Image extension already declares Commands["image"] = { setImage }
// and TS interface merging treats two different shapes on the same
// key as a conflict, not a merge. The namespace key is type-only —
// runtime command lookup is flat — so updateInlineImageAt is reachable
// via editor.chain().updateInlineImageAt(...) regardless.
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blogImage: {
      updateInlineImageAt: (pos: number, attrs: BlogImageAttrs) => ReturnType;
    };
  }
  interface Storage {
    image: {
      onEditRequest:
        | null
        | ((pos: number, attrs: BlogImageAttrs) => void);
    };
  }
}

export const BlogImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        // Caption is editorial copy that lives in <figcaption>, not a DOM
        // attribute — `rendered: false` keeps mergeAttributes from
        // emitting `caption="..."` on the <img>.
        rendered: false,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-caption") ?? ""
      }
    };
  },

  addStorage() {
    return {
      onEditRequest: null as
        | null
        | ((pos: number, attrs: BlogImageAttrs) => void)
    };
  },

  parseHTML() {
    return [
      // Figure-wrapped form (with caption). Pulled before the bare-img
      // rule because prosemirror tries rules in order and we want the
      // <figure> ancestor recognized whenever it's present.
      {
        tag: "figure.blog-figure",
        getAttrs: (node) => {
          const figure = node as HTMLElement;
          const img = figure.querySelector("img");
          const cap = figure.querySelector("figcaption");
          if (!img) return false;
          return {
            src: img.getAttribute("src") ?? "",
            alt: img.getAttribute("alt") ?? "",
            title: img.getAttribute("title") ?? null,
            caption: cap?.textContent?.trim() ?? ""
          };
        }
      },
      // Bare <img> — covers every published post pre-migration plus
      // newly-inserted images that haven't been given a caption.
      { tag: "img[src]" }
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const caption = ((node.attrs.caption as string | null) ?? "").trim();
    if (caption) {
      // Wrap in <figure class="blog-figure"> so the public CSS hooks
      // catch only inline images, not gallery figures (which are
      // descendants of [data-gallery]).
      return [
        "figure",
        { class: "blog-figure" },
        ["img", HTMLAttributes],
        ["figcaption", {}, caption]
      ];
    }
    return ["img", HTMLAttributes];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlogImageNodeView);
  },

  addCommands() {
    return {
      ...this.parent?.(),
      updateInlineImageAt:
        (pos, attrs) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              src: attrs.src,
              alt: attrs.alt,
              caption: attrs.caption
            });
            dispatch(tr);
          }
          return true;
        }
    };
  }
});
