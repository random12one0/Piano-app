import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          border: "18px solid #b08d57",
          boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: 300, fontStyle: "italic", color: "#b08d57", fontFamily: "serif" }}>P</span>
      </div>
    ),
    { ...size },
  );
}
