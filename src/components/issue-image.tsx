import Image from "next/image";

interface Props {
  src: string;
  alt: string;
  /** Sizing/aspect utilities for the wrapper box (e.g. "w-36 h-24" or "w-full aspect-[16/9]"). */
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function IssueImage({ src, alt, className, sizes, priority }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-muted ${className ?? ""}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "(max-width: 640px) 50vw, 33vw"}
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
