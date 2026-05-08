import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
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
          justifyContent: "center",
          alignItems: "center",
          background: "transparent",
          padding: "2px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "28px",
            height: "20px",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "5px",
              background: "#173874",
              borderTopLeftRadius: "6px",
            }}
          />
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              fontSize: "8px",
              fontWeight: 900,
              color: "#173874",
              lineHeight: 1,
            }}
          >
            KCPEC
          </div>
          <div
            style={{
              width: "100%",
              height: "5px",
              background: "#173874",
              borderBottomRightRadius: "6px",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
