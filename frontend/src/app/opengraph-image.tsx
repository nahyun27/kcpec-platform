import { ImageResponse } from "next/og";

export const alt = "한국범죄예방교육센터 KCPEC";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px 96px",
          background:
            "linear-gradient(135deg, #0a1730 0%, #16295a 45%, #2a4b8d 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -140,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "rgba(37, 99, 235, 0.35)",
            filter: "blur(10px)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 18px",
              borderRadius: 10,
              background: "#ffffff",
              color: "#16295a",
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            KCPEC
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 3,
              color: "#93c5fd",
              textTransform: "uppercase",
            }}
          >
            Korea Crime Prevention Education Center
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 76,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -1,
          }}
        >
          한국범죄예방교육센터
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 32,
            fontWeight: 500,
            color: "#cbd5e1",
          }}
        >
          심리·준법교육 및 전문가 심리상담, 양형자료 준비 플랫폼
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
          {["온라인 교육", "전문가 심리상담", "수료증 발급"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.06)",
                color: "#f1f5f9",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
