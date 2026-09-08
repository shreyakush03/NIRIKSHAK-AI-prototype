"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  // Render custom header for landing/home page ("/")
  if (pathname === "/") {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-transparent bg-background/90 backdrop-blur-md">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-8">
          <div className="font-headline font-extrabold text-3xl text-primary tracking-tight">
            NIRIKSHAK<span className="text-secondary">AI</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#overview" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">
              View Overview
            </a>
            <Link href="/projects" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">
              Explore Projects &rarr;
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const links = [
    { name: "Overview", href: "/overview" },
    { name: "Browse States", href: "/states" },
    { name: "Projects", href: "/projects" },
    { name: "Anomalies", href: "/anomalies" },
    { name: "Compliance Audit", href: "/compliance" },
    { name: "ML Dashboard", href: "/ml-dashboard" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-surface/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center px-4 md:px-8">
        <Link href="/" className="font-headline font-bold text-2xl text-primary tracking-tight">
          NIRIKSHAK<span className="text-secondary">AI</span>
        </Link>
        <nav className="ml-8 hidden gap-6 md:flex font-body font-semibold">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`py-5 transition-colors ${
                  isActive
                    ? "text-primary border-b-2 border-primary"
                    : "text-gray-600 hover:text-primary"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
