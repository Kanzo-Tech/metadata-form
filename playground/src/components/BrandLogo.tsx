/** A bundled example's wordmark, shown in the app title with no background box.
 *  The source asset is the brand's white wordmark; we use it as a CSS mask and fill
 *  it with the brand colour (`color`), so it recolours cleanly to sit on the light
 *  chrome — and adapts to dark mode when `color` is a theme token. */
export function BrandLogo({
  url,
  ratio,
  height = 26,
  color = "var(--foreground)",
  label,
}: {
  url: string;
  /** Intrinsic width/height ratio of the wordmark (keeps it crisp at any height). */
  ratio: number;
  height?: number;
  color?: string;
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      style={{
        display: "inline-block",
        height,
        width: height * ratio,
        backgroundColor: color,
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
