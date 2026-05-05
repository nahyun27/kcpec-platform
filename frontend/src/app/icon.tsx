import { ImageResponse } from "next/og";

export const runtime = "edge";
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
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px 0",
          background: "white", // adding a white background so it looks good as a favicon
        }}
      >
        <div
          style={{
            width: "100%",
            height: "128px",
            background: "#173874",
            borderTopLeftRadius: "140px",
            borderTopRightRadius: "14px",
            borderBottomLeftRadius: "14px",
            borderBottomRightRadius: "14px",
          }}
        />
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: "140px",
              fontWeight: 900,
              color: "#173874",
              letterSpacing: "0.05em",
              fontFamily: "sans-serif",
            }}
          >
            KCPEC
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: "128px",
            background: "#173874",
            borderBottomRightRadius: "140px",
            borderTopRightRadius: "14px",
            borderBottomLeftRadius: "14px",
            borderTopLeftRadius: "14px",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
