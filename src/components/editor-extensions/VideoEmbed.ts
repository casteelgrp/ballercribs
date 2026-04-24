import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { VideoEmbedNodeView } from "./VideoEmbedNodeView";
import { buildEmbedSrc, type VideoProvider } from "@/lib/video-url";

export type VideoEmbedAttrs = {
  provider: VideoProvider;
  videoId: string;
  url: string;
  startAt?: number;
  vimeoHash?: string;
};

/**
 * Video embed atom node — YouTube + Vimeo only. Same pattern as
 * PropertyCard / Gallery: inserting and editing go through a modal
 * (via the extension's onEditRequest storage callback). The editor
 * renders a compact thumbnail preview, not a live iframe — keeps the
 * editor responsive even in a post with multiple embeds.
 *
 * Provider-specific URL construction lives in @/lib/video-url; this
 * extension only stores the parsed attrs and emits the public HTML.
 * The iframe src is always privacy-enhanced (youtube-nocookie /
 * player.vimeo) and passes the sanitizer's strict src allowlist in
 * blog-sanitize.ts.
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoEmbed: {
      insertVideoEmbed: (attrs: VideoEmbedAttrs) => ReturnType;
      updateVideoEmbedAt: (pos: number, attrs: VideoEmbedAttrs) => ReturnType;
    };
  }
  interface Storage {
    videoEmbed: {
      onEditRequest:
        | null
        | ((pos: number, attrs: VideoEmbedAttrs) => void);
    };
  }
}

export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      provider: { default: "youtube" as VideoProvider },
      videoId: { default: "" },
      url: { default: "" },
      startAt: { default: null as number | null },
      vimeoHash: { default: null as string | null }
    };
  },

  addStorage() {
    return {
      onEditRequest: null as
        | null
        | ((pos: number, attrs: VideoEmbedAttrs) => void)
    };
  },

  parseHTML() {
    return [{ tag: "div[data-video-embed]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs as VideoEmbedAttrs & {
      startAt: number | null;
      vimeoHash: string | null;
    };
    const src = buildEmbedSrc({
      provider: a.provider,
      videoId: a.videoId,
      startAt: a.startAt ?? undefined,
      vimeoHash: a.vimeoHash ?? undefined
    });
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-video-embed": "true",
        "data-provider": a.provider,
        "data-video-id": a.videoId,
        class: `blog-video-embed blog-video-embed--${a.provider}`
      }),
      [
        "iframe",
        {
          src,
          title: a.provider === "youtube" ? "YouTube video" : "Vimeo video",
          width: "560",
          height: "315",
          frameborder: "0",
          loading: "lazy",
          allowfullscreen: "true",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        }
      ]
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedNodeView);
  },

  addCommands() {
    return {
      insertVideoEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              provider: attrs.provider,
              videoId: attrs.videoId,
              url: attrs.url,
              startAt: attrs.startAt ?? null,
              vimeoHash: attrs.vimeoHash ?? null
            }
          }),
      updateVideoEmbedAt:
        (pos, attrs) =>
        ({ tr, dispatch }) => {
          const n = tr.doc.nodeAt(pos);
          if (!n || n.type.name !== this.name) return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, {
              provider: attrs.provider,
              videoId: attrs.videoId,
              url: attrs.url,
              startAt: attrs.startAt ?? null,
              vimeoHash: attrs.vimeoHash ?? null
            });
            dispatch(tr);
          }
          return true;
        }
    };
  }
});
