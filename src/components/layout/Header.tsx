"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { site } from "@/data/site";
import { mainNav } from "@/data/navigation";
import { useCart } from "@/context/CartContext";
import { useMode } from "@/context/ModeContext";
import { useModal } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { MaterialKey } from "@/lib/types";
import { MegaMenu } from "./MegaMenu";
import { ModeToggle } from "./ModeToggle";
import { SearchOverlay } from "./SearchOverlay";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState<MaterialKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { bag, quote, openDrawer } = useCart();
  const { isTrade } = useMode();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMega(null);
    setMobileOpen(false);
  }, [pathname]);

  const openMega = (m: MaterialKey) => {
    clearTimeout(closeTimer.current);
    setMega(m);
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMega(null), 140);
  };

  const count = isTrade ? quote.length : bag.reduce((n, i) => n + i.qty, 0);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-500",
          scrolled || mega ? "border-b border-line bg-ivory/85 backdrop-blur-md" : "border-b border-transparent bg-ivory"
        )}
        onMouseLeave={scheduleClose}
        onKeyDown={(e) => e.key === "Escape" && setMega(null)}
      >
        <div
          className={cn(
            "container-site flex items-center justify-between gap-6 transition-[height] duration-500 ease-lux",
            scrolled ? "h-16" : "h-[84px]"
          )}
        >
          <Link
            href="/"
            className={cn(
              "font-display tracking-[0.18em] transition-[font-size] duration-500",
              scrolled ? "text-[22px]" : "text-[26px]"
            )}
            aria-label={`${site.name} home`}
          >
            {site.name}
          </Link>

          <nav aria-label="Main" className="hidden h-full items-stretch xl:flex">
            {mainNav.map((item) => (
              <div
                key={item.href}
                className="flex items-center"
                onMouseEnter={() => (item.material ? openMega(item.material) : scheduleClose())}
              >
                <Link
                  href={item.href}
                  onFocus={() => (item.material ? openMega(item.material) : setMega(null))}
                  aria-expanded={item.material ? mega === item.material : undefined}
                  aria-haspopup={item.material ? "true" : undefined}
                  className={cn(
                    "relative px-3.5 py-2 text-[13px] font-medium tracking-[0.06em] transition-colors hover:text-accent",
                    (isActive(item.href) || mega === item.material) && "text-accent"
                  )}
                >
                  {item.label}
                  {isActive(item.href) && (
                    <motion.span layoutId="nav-underline" className="absolute inset-x-3.5 -bottom-0.5 h-px bg-current" />
                  )}
                </Link>
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <ModeToggle className="mr-2 hidden lg:inline-flex" />
            <IconButton label="Search" onClick={() => setSearchOpen(true)}>
              <Search size={20} strokeWidth={1.5} />
            </IconButton>
            <Link
              href="/account"
              aria-label="Account"
              className="hidden h-11 w-11 place-items-center transition-colors hover:text-accent sm:grid"
            >
              <User size={20} strokeWidth={1.5} />
            </Link>
            <IconButton
              label={isTrade ? `Quote (${count} items)` : `Bag (${count} items)`}
              onClick={() => openDrawer(isTrade ? "quote" : "bag")}
            >
              {isTrade ? <FileText size={20} strokeWidth={1.5} /> : <ShoppingBag size={20} strokeWidth={1.5} />}
              {count > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-ivory">
                  {count}
                </span>
              )}
            </IconButton>
            <IconButton label="Open menu" onClick={() => setMobileOpen(true)} className="xl:hidden">
              <Menu size={22} strokeWidth={1.5} />
            </IconButton>
          </div>
        </div>

        <AnimatePresence>
          {mega && (
            <div onMouseEnter={() => openMega(mega)} className="hidden xl:block">
              <MegaMenu material={mega} onNavigate={() => setMega(null)} />
            </div>
          )}
        </AnimatePresence>
      </header>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn("relative grid h-11 w-11 place-items-center transition-colors hover:text-accent", className)}
    >
      {children}
    </button>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const close = useCallback(() => onClose(), [onClose]);
  useModal(open, close);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={{ clipPath: "inset(0 0 100% 0)" }}
          animate={{ clipPath: "inset(0 0 0% 0)" }}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[70] flex flex-col bg-ink text-ivory"
          data-lenis-prevent
        >
          <div className="container-site flex h-[84px] shrink-0 items-center justify-between">
            <span className="font-display text-[26px] tracking-[0.18em]">{site.name}</span>
            <button onClick={close} aria-label="Close menu" className="grid h-11 w-11 place-items-center">
              <X size={24} strokeWidth={1.5} />
            </button>
          </div>
          <nav aria-label="Mobile" className="container-site flex-1 overflow-y-auto pb-10">
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } } }}
              className="mt-6 border-t border-ivory/15"
            >
              {mainNav.map((item) => (
                <motion.li
                  key={item.href}
                  variants={{
                    hidden: { opacity: 0, y: 28 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
                  }}
                  className="border-b border-ivory/15"
                >
                  <Link
                    href={item.href}
                    onClick={close}
                    className="flex min-h-[64px] items-center justify-between font-display text-[34px] leading-none"
                  >
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.7 } }}
              className="mt-10 space-y-6"
            >
              <div>
                <p className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ivory/60">Buying as</p>
                <div className="inline-block bg-ivory">
                  <ModeToggle layoutId="mode-pill-mobile" />
                </div>
              </div>
              <div className="space-y-1 text-[15px] text-ivory/80">
                <p>Trade desk: {site.contact.tradePhone}</p>
                <p>{site.contact.tradeEmail}</p>
              </div>
              <Link href="/account" onClick={close} className="btn-outline-light w-full">
                Trade login
              </Link>
            </motion.div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
