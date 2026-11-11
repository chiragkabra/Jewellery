import Image, { type ImageProps } from "next/image";
import { cn, isSvg } from "@/lib/utils";

type Props = Omit<ImageProps, "alt"> & { alt: string; className?: string; imgClassName?: string };

/**
 * next/image in a positioned frame. SVG placeholders skip optimisation;
 * real photos dropped into /public/images are optimised automatically.
 */
export function Media({ src, alt, className, imgClassName, sizes = "100vw", ...rest }: Props) {
  return (
    <div className={cn("relative overflow-hidden bg-sand", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized={typeof src === "string" && isSvg(src)}
        className={cn("object-cover", imgClassName)}
        {...rest}
      />
    </div>
  );
}
