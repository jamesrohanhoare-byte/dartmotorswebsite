import Image from "next/image";
import type { ReactNode } from "react";

// Full-bleed photographic banner with a soft gradient and optional overlay content.
export default function PhotoBanner({
  src,
  alt,
  children,
  height = "h-[58vh]",
}: {
  src: string;
  alt: string;
  children?: ReactNode;
  height?: string;
}) {
  return (
    <section className={`relative ${height} min-h-[400px] w-full overflow-hidden`}>
      <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-background/10" />
      {children && (
        <div className="px-page absolute inset-0 mx-auto flex max-w-[1400px] flex-col justify-end pb-14 md:pb-20">
          {children}
        </div>
      )}
    </section>
  );
}
