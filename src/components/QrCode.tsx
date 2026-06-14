import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders a QR code as a PNG `<img>` (sharp at any size — we generate at
 * 4× resolution so it stays crisp when scaled up for print).
 *
 *   - errorCorrectionLevel "H" → up to 30% damage tolerance (ink / fold safe).
 *   - margin 1 module → tiny white quiet-zone, won't waste paper.
 *
 * The generated data URL is cached at the module level for any given (url, size)
 * pair so we don't redraw on every re-render of the live preview.
 */
interface QrCodeProps {
  url: string;
  sizeMm: number;     // visible width/height
  pxScale?: number;   // px per mm — defaults to a high-DPI 16 px/mm (= ~406 DPI)
  className?: string;
  style?: React.CSSProperties;
}

const cache = new Map<string, string>();

async function getQrDataUrl(url: string, pxSize: number): Promise<string> {
  const key = `${url}::${pxSize}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const data = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: pxSize,
    color: { dark: "#000000", light: "#ffffff" },
  });
  cache.set(key, data);
  return data;
}

export default function QrCode({ url, sizeMm, pxScale = 16, className, style }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const px = Math.max(64, Math.round(sizeMm * pxScale));
    getQrDataUrl(url, px).then((d) => { if (!cancelled) setSrc(d); });
    return () => { cancelled = true; };
  }, [url, sizeMm, pxScale]);
  return (
    <img
      src={src ?? undefined}
      alt=""
      draggable={false}
      className={className}
      style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm`, display: "block", ...style }}
    />
  );
}
