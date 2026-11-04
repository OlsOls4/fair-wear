"use client";

import ArrowIcon from "@/components/ArrowIcon";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="/" aria-label="Fair Wear home">
          <svg className="brand-mark" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 26V13l9-7 9 7v13M4 14 16 4l12 10M12 26v-8h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="m12 12 3 3 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span>Fair Wear<span className="brand-dot">.</span></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="/upload" aria-current={pathname === "/upload" ? "page" : undefined}>How it works</a>
          <a href="/inspect" aria-current={pathname === "/inspect" ? "page" : undefined}>Evidence lab</a>
          <a href="/case-builder" aria-current={pathname === "/case-builder" ? "page" : undefined}>Case builder</a>
          <a className="nav-review" href="/demo" aria-current={pathname === "/demo" ? "page" : undefined}>Sample review <ArrowIcon /></a>
        </nav>
      </div>
    </header>
  );
}
