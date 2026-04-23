import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PropertyCardNodeView } from "./PropertyCardNodeView";

export type PropertyCardAttrs = {
  name: string;
  location: string;
  photoUrl: string;
  blurb: string;
  url: string;
  ctaLabel: string;
};

/**
 * Custom TipTap node for inline property cards. Editorial primitive that
 * drives affiliate revenue — photo + pitch + outbound CTA, rendered as a
 * styled block in public HTML.
 *
 * Atom + block so it behaves like a self-contained unit (you can't type
 * inside it). Edits flow through a modal: clicking the card in the editor
 * dispatches `onEditRequest` on the extension's storage, which the
 * surrounding <BlogEditor> wires to open its modal pre-filled.
 *
 * The public renderHTML output is the same HTML that lands in body_html
 * and ships to readers — target="_blank" + rel="noopener noreferrer" are
 * enforced at the markup level so a misconfigured sanitizer can't strip
 * them silently.
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    propertyCard: {
      insertPropertyCard: (attrs: PropertyCardAttrs) => ReturnType;
      updatePropertyCardAt: (pos: number, attrs: PropertyCardAttrs) => ReturnType;
    };
  }
  interface Storage {
    propertyCard: {
      onEditRequest:
        | null
        | ((pos: number, attrs: PropertyCardAttrs) => void);
    };
  }
}

export const PropertyCard = Node.create({
  name: "propertyCard",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      name: { default: "" },
      location: { default: "" },
      photoUrl: { default: "" },
      blurb: { default: "" },
      url: { default: "" },
      ctaLabel: { default: "View property →" }
    };
  },

  addStorage() {
    return {
      // Populated by <BlogEditor> after editor mount — the NodeView calls
      // this to request a modal open with the current attrs + position.
      onEditRequest: null as
        | null
        | ((pos: number, attrs: PropertyCardAttrs) => void)
    };
  },

  parseHTML() {
    return [{ tag: "div[data-property-card]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs as PropertyCardAttrs;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-property-card": "true",
        class: "property-card"
      }),
      [
        "a",
        {
          href: a.url,
          target: "_blank",
          rel: "noopener noreferrer",
          class: "property-card__link"
        },
        [
          "div",
          { class: "property-card__media" },
          ["img", { src: a.photoUrl, alt: a.name, loading: "lazy" }]
        ],
        [
          "div",
          { class: "property-card__body" },
          ["p", { class: "property-card__eyebrow" }, "Property"],
          ["h3", { class: "property-card__name" }, a.name],
          ["p", { class: "property-card__location" }, a.location],
          ["p", { class: "property-card__blurb" }, a.blurb],
          ["span", { class: "property-card__cta" }, a.ctaLabel]
        ]
      ]
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PropertyCardNodeView);
  },

  addCommands() {
    return {
      insertPropertyCard:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
      updatePropertyCardAt:
        (pos, attrs) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, attrs);
            dispatch(tr);
          }
          return true;
        }
    };
  }
});
