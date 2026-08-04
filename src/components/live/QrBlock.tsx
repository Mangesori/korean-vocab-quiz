import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * 참여 링크 QR. 대기실에서 학생이 스캔해 바로 들어오는 용도라
 * 대비를 최대로 두고(밝은 배경 + 잉크색) 여백도 넉넉히 잡는다.
 */
export function QrBlock({ value, size = 176 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      width: size * 2, // 레티나 대응
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1A1714", light: "#FFFFFF" },
    })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className="rounded-lg bg-muted animate-pulse"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="참여 링크 QR 코드"
      className="rounded-lg"
    />
  );
}
