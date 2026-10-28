import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type IframeHTMLAttributes,
} from "react";
import { createMetadataFormFrame, type MetadataFormFrame as FrameHandle } from "./host.js";
import type { EmbedConfig, EmbedState } from "./protocol.js";

export interface MetadataFormFrameProps
  extends Omit<IframeHTMLAttributes<HTMLIFrameElement>, "src" | "onChange"> {
  /** Where the app serves the page from `dist/frame/`, e.g. `/embeds/metadata-form/index.html`. */
  src: string;
  config: EmbedConfig;
  onChange?: (state: EmbedState) => void;
  onReady?: () => void;
}

export interface MetadataFormFrameHandle {
  revealErrors(): void;
  reset(): void;
}

/**
 * The form in an iframe, for React apps: {@link createMetadataFormFrame} with
 * the iframe's height following the form. A new `config` (compared by value)
 * starts the form again with it.
 */
export const MetadataFormFrame = forwardRef<MetadataFormFrameHandle, MetadataFormFrameProps>(
  function MetadataFormFrame({ src, config, onChange, onReady, style, title, ...rest }, ref) {
    const iframe = useRef<HTMLIFrameElement>(null);
    const frame = useRef<FrameHandle>(undefined);
    const [height, setHeight] = useState(600);
    const [ready, setReady] = useState(false);
    const latest = useRef({ config, onChange, onReady });
    latest.current = { config, onChange, onReady };

    useEffect(() => {
      const handle = createMetadataFormFrame(iframe.current!, {
        config: latest.current.config,
        onChange: (state) => latest.current.onChange?.(state),
        onReady: () => {
          setReady(true);
          latest.current.onReady?.();
        },
        onResize: (h) => setHeight(Math.max(200, Math.ceil(h))),
      });
      frame.current = handle;
      return () => handle.destroy();
    }, [src]);

    const configKey = JSON.stringify(config);
    useEffect(() => {
      frame.current?.configure(latest.current.config);
    }, [configKey]);

    useImperativeHandle(ref, () => ({
      revealErrors: () => frame.current?.revealErrors(),
      reset: () => frame.current?.reset(),
    }), []);

    return (
      <iframe
        ref={iframe}
        src={src}
        title={title ?? "Metadata form"}
        aria-busy={!ready}
        style={{ border: 0, width: "100%", height, ...style }}
        {...rest}
      />
    );
  },
);
