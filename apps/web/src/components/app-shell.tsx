import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Bug, Globe, Loader2, LogOut, Menu, Pencil, Scale, Sparkles, Star } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ApiError, getVersion, updateCurrentUser } from "@/lib/api";
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

function StarPopoverContent() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Star className="size-4 shrink-0 fill-amber-500 text-amber-500" aria-hidden="true" />
        Enjoying LatestArr?
      </div>
      <p className="text-xs text-muted-foreground">
        Starring the repo on GitHub helps other self-hosters find it and shows there&apos;s real
        interest in keeping it going. Costs nothing, means a lot — thank you.
      </p>
      <Button asChild size="sm">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          <Star className="size-3.5 fill-current" aria-hidden="true" />
          Star on GitHub
        </a>
      </Button>
    </div>
  );
}

/**
 * The version badge, GitHub view link, and Star popover as one deliberate
 * cluster, sitting right next to the Logo at the top of both surfaces —
 * the desktop header and, unchanged, the mobile nav sheet — so the two
 * read as one design rather than two different treatments. The "About"
 * info popover this card used to also hold (author, license, site) has
 * moved out to a real page footer (see `AppFooter` below) instead of
 * living behind an icon here.
 */
function ProjectInfoCard() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then(({ version }) => {
        if (!cancelled) setVersion(version);
      })
      .catch(() => {
        // Non-critical — the header just shows no version rather than an error.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
      <div className="min-w-0">
        {version ? (
          <Badge variant="tertiary" className="font-mono text-xs tracking-tight">
            v{version}
          </Badge>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
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
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Star on GitHub"
              title="Star on GitHub"
              className="text-amber-500 transition-colors hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
            >
              <Star className="size-4 fill-current" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end">
            <StarPopoverContent />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/**
 * The real page footer (see item 5 of the design-polish pass): the
 * author/license/issue-tracker attribution that used to live behind the
 * sidebar's "About" info-icon popover, now visible at the bottom of every
 * page instead of hidden a click away. Rendered once per page, inside
 * `AppShell` below — not duplicated per-surface the way `ProjectInfoCard`
 * is, since there's only one page footer regardless of viewport width.
 */
function AppFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(iconLinkClassName, "flex items-center gap-1.5")}
          >
            <Globe className="size-3.5 shrink-0" aria-hidden="true" />
            Jeremy Shields
          </a>
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(iconLinkClassName, "flex items-center gap-1.5")}
          >
            <Scale className="size-3.5 shrink-0" aria-hidden="true" />
            GPLv3 license
          </a>
          <a
            href={`${REPO_URL}/issues`}
            target="_blank"
            rel="noreferrer"
            className={cn(iconLinkClassName, "flex items-center gap-1.5")}
          >
            <Bug className="size-3.5 shrink-0" aria-hidden="true" />
            Report an issue
          </a>
        </div>
        <Badge variant="tertiary" className="w-fit">
          <Sparkles className="size-3" aria-hidden="true" />
          In Active Development
        </Badge>
      </div>
    </footer>
  );
}

function EditProfileDialog() {
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openWithCurrentValues(next: boolean) {
    setOpen(next);
    if (next) {
      setDisplayName(user?.displayName ?? "");
      setCurrentPassword("");
      setNewPassword("");
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if ((currentPassword || newPassword) && !(currentPassword && newPassword)) {
      setError("Enter both your current password and a new password to change it.");
      return;
    }
    setSubmitting(true);
    try {
      await updateCurrentUser({
        displayName: displayName || undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      await refresh();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openWithCurrentValues}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit profile" title="Edit profile">
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your display name or change your password.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-display-name">Display name</Label>
            <Input
              id="profile-display-name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-current-password">Current password (to change password)</Label>
            <Input
              id="profile-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-new-password">New password</Label>
            <Input
              id="profile-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Name + email + account actions, shared between the desktop header and the
 * mobile nav sheet. The email gets its own `title` so the full address is
 * always available on hover/focus even where its column truncates.
 */
function UserSummary() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={user?.displayName || undefined}>
          {user?.displayName}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={user?.email || undefined}>
          {user?.email}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <EditProfileDialog />
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
    </div>
  );
}

// navItems (lib/nav-items.ts) is a flat list with no grouping concept —
// deliberately not carved into invented sections here, since there's no
// natural "these belong together" split in the current six items. If a
// real grouping emerges as the nav grows, add a `group` field there and
// section this list by it.
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
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* Left-edge accent bar — on top of the existing background
                  tint, not instead of it, so the active item reads clearly
                  even for anyone who has trouble distinguishing the tint
                  from the hover state. */}
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary"
                />
              ) : null}
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 md:px-6">
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
              {/* Version/GitHub/Star cluster lives right under the logo,
                  matching the desktop header's placement, rather than down
                  in the footer with the account summary. */}
              <ProjectInfoCard />
              <NavList onNavigate={() => setMobileNavOpen(false)} />
              <div className="mt-auto border-t border-border pt-3">
                <UserSummary />
              </div>
            </SheetContent>
          </Sheet>

          <Logo />

          {/* Desktop-only: the project cluster and account summary now live
              here instead of the sidebar footer, since the header has the
              width to give the email room and let everything breathe. On
              mobile they stay in the nav sheet above. */}
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <div className="hidden items-center gap-3 md:flex">
              <ProjectInfoCard />
              <div className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
              <div className="w-52 lg:w-64">
                <UserSummary />
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col border-r border-border p-4 md:flex">
          <NavList />
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>

      <AppFooter />
    </div>
  );
}
