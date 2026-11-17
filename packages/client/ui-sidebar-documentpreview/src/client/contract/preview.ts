/** Renderer registration metadata shared by the document owner and renderer providers. */
/** Shared text or byte reads, or content loading owned by the renderer. */
export type DocumentLoadMode = 'text-pages' | 'bytes-complete' | 'renderer'

/** One renderer implementation, independent of its component registration. */
export interface DocumentPreviewDefinition {
  /** Unique implementation name, also used as the document slot key. */
  readonly id: string
  /** File suffixes without a leading dot; compound suffixes such as tar.gz are accepted. */
  readonly extensions: readonly string[]
  /**
   * Suffixes among `extensions` whose bytes are not readable text; a file
   * matching one loses the plain-text fallback among its viewer choices.
   * Every entry must appear in `extensions`; `register` rejects strays.
   */
  readonly binaryExtensions?: readonly string[]
  /** External implementations win over product implementations; defaults to extension. */
  readonly priority?: 'builtin' | 'extension'
  /** Localized implementation label, evaluated when the toolbar renders. @returns the visible name. */
  readonly title: () => string
  /** Content delivery mode supplied by the document owner. */
  readonly loading: DocumentLoadMode
  /** Whether the implementation consumes the document's wrap preference. */
  readonly wrap?: boolean
  /**
   * Whether a `text-pages` body exposes source-line anchors for line navigation;
   * without it, a navigation to a line is answered without moving the body.
   */
  readonly sourceLines?: boolean
}

/** Builtin fallback key shared by the document selector and plain-text provider. */
export const PLAIN_BODY_ID = '@ocean/ocean-client-ui-sidebar-documentpreview/text'
