import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16181b",
        }}
      >
        <span style={{ fontSize: 108, fontStyle: "italic", color: "#b08d57", fontFamily: "serif" }}>P</span>
      </div>
    ),
    { ...size },
  );
}
