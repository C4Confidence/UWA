import { ImageResponse } from "next/og";

export const alt =
  "UWA — Everyday, upgraded. Good things for the way you live.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#f8d434",
          color: "#1c1d19",
          width: "100%",
          height: "100%",
          padding: "65px 75px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 55,
            fontWeight: 800,
            letterSpacing: "-4px",
          }}
        >
          uwa®
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 100,
            lineHeight: 1,
            letterSpacing: "-6px",
          }}
        >
          <span>Good finds.</span>
          <span>Great living.</span>
        </div>
        <div style={{ display: "flex", fontSize: 22 }}>
          A fresh perspective on everyday living.
        </div>
      </div>
    ),
    size,
  );
}
