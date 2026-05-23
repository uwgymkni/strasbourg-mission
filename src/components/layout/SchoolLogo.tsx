import Image from "next/image";

interface SchoolLogoProps {
  className?: string;
  /** Height in pixels — width scales proportionally. Default 32. */
  size?: number;
}

/**
 * BG/BRG Knittelfeld school logo.
 * The PNG is a black silhouette with transparent background.
 * `invert` makes it white so it reads on the dark navy theme.
 */
export function SchoolLogo({ className = "", size = 32 }: SchoolLogoProps) {
  return (
    <Image
      src="/logo-school.png"
      alt="BG/BRG Knittelfeld"
      width={size}
      height={size}
      className={`object-contain opacity-80 ${className}`}
      style={{ filter: "brightness(0) invert(1)" }}
      priority
    />
  );
}
