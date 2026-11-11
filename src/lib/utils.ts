import clsx, { type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const isSvg = (src: string) => src.toLowerCase().endsWith(".svg");
