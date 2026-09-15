import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LogOut, Menu, Star } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getVersion } from "@/lib/api";
import { navItems } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

const REPO_URL = "https://github.com/jshields-ca/LatestArr";
const LICENSE_URL = "https://github.com/jshields-ca/LatestArr/blob/main/LICENSE";
const AUTHOR_URL = "https://www.scootr.ca";

const iconLinkClassName =
  "text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

// lucide-react ships no GitHub mark — this is the standard octocat glyph
// used across the ecosystem for "view/star on GitHub" links (e.g. GitHub's
// own badges, simple-icons).
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55 0-.27-.01-1.13-.02-2.04-3.2.7-3.87-1.35-3.87-1.35-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.72-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.25 5.68.42.36.78 1.08.78 2.18 0 1.58-.01 2.85-.01 3.24 0 .3.22.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

function ProjectLinks() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then(({ version }) => {
        if (!cancelled) setVersion(version);
      })
      .catch(() => {
        // Non-critical — the sidebar just shows no version rather than an error.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <span>{version ? `v${version}` : null}</span>
        <div className="flex items-center gap-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            title="View on GitHub"
            aria-label="View on GitHub"
            className={iconLinkClassName}
          >
            <GitHubMark className="size-4" />
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            title="Star on GitHub"
            aria-label="Star on GitHub"
            className="text-amber-500 transition-colors hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
          >
            <Star className="size-4 fill-current" />
          </a>
        </div>
      </div>
      <p>
        Jeremy Shields &middot;{" "}
        <a href={LICENSE_URL} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          GPLv3
        </a>{" "}
        &middot;{" "}
        <a href={AUTHOR_URL} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          scootr.ca
        </a>
      </p>
    </div>
  );
}

function UserFooter() {
  const { user, logout } = useAuth();

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user?.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void logout()}
        aria-label="Log out"
        title="Log out"
      >
        <LogOut />
      </Button>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )
          }
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <NavList onNavigate={() => setMobileNavOpen(false)} />
            <div className="mt-auto flex flex-col gap-3">
              <ProjectLinks />
              <UserFooter />
            </div>
          </SheetContent>
        </Sheet>

        <Logo className="md:hidden" />

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col border-r border-border p-4 md:flex">
          <div className="mb-4">
            <Logo />
          </div>
          <NavList />
          <div className="mt-auto flex flex-col gap-3">
            <ProjectLinks />
            <UserFooter />
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
