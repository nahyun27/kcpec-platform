import Link from "next/link";

interface LogoProps {
  variant?: "default" | "white";
  kind?: "horizontal" | "mark";
  className?: string;
  imgClassName?: string;
}

export function Logo({
  variant = "default",
  kind = "horizontal",
  className = "",
  imgClassName,
}: LogoProps) {
  const logoSrc =
    kind === "mark"
      ? "/images/logo-mark.png?v=20240507_v2"
      : "/images/logo-horizontal.png?v=20240507_v2";

  const sizeCls = imgClassName ?? (kind === "mark" ? "h-10 w-10" : "h-8 w-auto");

  return (
    <Link href="/" className={`flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        alt="KCPEC 한국범죄예방교육센터"
        className={`block ${sizeCls} object-contain ${variant === "white" ? "brightness-0 invert" : ""}`}
      />
    </Link>
  );
}
