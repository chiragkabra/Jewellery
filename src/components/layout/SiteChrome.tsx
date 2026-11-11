"use client";
import { usePathname } from "next/navigation";
import { UtilityBar } from "./UtilityBar";
import { RateTicker } from "./RateTicker";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { LensSwitcher } from "./LensSwitcher";
import { FloatingActions } from "./FloatingActions";
import { CartDrawer } from "./CartDrawer";
import { SmoothScroll } from "./SmoothScroll";
export function SiteChrome({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  if(pathname === "/crm") return <main id="main">{children}</main>;
  return <><SmoothScroll/><UtilityBar/><RateTicker/><Header/><main id="main">{children}</main><Footer/><LensSwitcher/><FloatingActions/><CartDrawer/></>;
}
