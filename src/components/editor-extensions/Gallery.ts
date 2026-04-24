import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { GalleryNodeView } from "./GalleryNodeView";

export type GalleryItem = {
  url: string;
  caption: string;
  width?: number;
  height?: number;
};

export type GalleryAttrs = {
  images: GalleryItem[];
};

/**
 * Multi-image gallery block. Atom + block like PropertyCard — the
 * gallery renders as a self-contained unit, editing is modal-only.
 *
 * Storage shape on the node: `images: GalleryItem[]`. renderHTML emits
 * a `<div data-gallery>` container with `<figure>` children and
 * optional `<figcaption>`; the public detail page's BlogBody client
 * component scans those markers and wires the lightbox.
 *
 * Edit requests go through the extension storage's onEditRequest
 * callback (same pattern as PropertyCard) so the NodeView can dispatch
 * "open modal pre-filled" up to BlogEditor without tight coupling.
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    gallery: {
      insertGallery: (attrs: GalleryAttrs) => ReturnType;
      updateGalleryAt: (pos: number, attrs: GalleryAttrs) => ReturnType;
    };
  }
  interface Storage {
    gallery: {
      onEditRequest:
        | null
        | ((pos: number, attrs: GalleryAttrs) => void);
    };
  }
}

export const Gallery = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      images: {
        default: [] as GalleryItem[],
        // Serialize to/from the DOM as a data-images JSON blob — the
        // per-figure markup is decorative/readable-HTML; images stays the
        // source of truth for round-trip correctness.
        parseHTML: (el) => {
          const raw = (el as HTMLElement).getAttribute("data-images");
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({
          "data-images": JSON.stringify(attrs.images ?? [])
        })
      }
    };
  },

  addStorage() {
    return {
      onEditRequest: null as
        | null
        | ((pos: number, attrs: GalleryAttrs) => void)
    };
  },

  parseHTML() {
    return [{ tag: "div[data-gallery]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const images = (node.attrs.images ?? []) as GalleryItem[];
    // Container carries the canonical data-images JSON for round-trip +
    // a class for styling. The inner <figure> + <img> + <figcaption>
    // markup is what readers see; the lightbox wiring reads <img src>
    // and the <figcaption> text directly so the data-images blob stays
    // an implementation detail.
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-gallery": "true",
        class: `blog-gallery blog-gallery--${imagesSizeClass(images.length)}`,
        "data-count": String(images.length)
      }),
      ...images.map((item) => {
        const fig: any[] = [
          "figure",
          { class: "blog-gallery__item" },
          [
            "img",
            {
              src: item.url,
              alt: item.caption || "",
              loading: "lazy"
            }
          ]
        ];
        if (item.caption && item.caption.trim()) {
          fig.push([
            "figcaption",
            { class: "blog-gallery__caption" },
            item.caption
          ]);
        }
        return fig;
      })
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GalleryNodeView);
  },

  addCommands() {
    return {
      insertGallery:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
      updateGalleryAt:
        (pos, attrs) =>
        ({ tr, dispatch }) => {
          const n = tr.doc.nodeAt(pos);
          if (!n || n.type.name !== this.name) return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, attrs);
            dispatch(tr);
          }
          return true;
        }
    };
  }
});

/**
 * Map image count to a CSS modifier class so the grid adapts without a
 * useless single-column "3 images" pattern on 1-image galleries. The
 * public CSS defines blog-gallery--1 / --2 / --many variants.
 */
function imagesSizeClass(n: number): string {
  if (n <= 1) return "1";
  if (n === 2) return "2";
  return "many";
}
