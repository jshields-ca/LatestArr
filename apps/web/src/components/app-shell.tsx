import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu, Pencil, Sparkles, Star } from "lucide-react";

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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveActions } from "@/components/ui/save-actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ApiError, getAuthProviders, getVersion, startSsoLink, unlinkSso, updateCurrentUser } from "@/lib/api";
import { navGroups, navItems } from "@/lib/nav-items";
import { ssoMessage, takeSsoOutcome } from "@/lib/sso";
import { hasRole, ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { askToDiscard, guardClose, hasUnsavedChanges, saveShortcutRef, useUnsavedChanges } from "@/lib/unsaved-changes";
import { confirmAction } from "@/components/confirm-dialog";

const REPO_URL = "https://github.com/jshields-ca/LatestArr";
const LICENSE_URL = "https://github.com/jshields-ca/LatestArr/blob/main/LICENSE";
const SITE_URL = "https://www.latestarr.app";
const DOCS_URL = "https://www.latestarr.app/docs";
const DISCUSSIONS_URL = "https://github.com/jshields-ca/LatestArr/discussions";
const SPONSOR_URL = "https://github.com/sponsors/jshields-ca";
const MAINTAINER_URL = "https://www.jeremyshields.ca";

// -m-1.5 p-1.5 grows the tap target to 28px without moving the icon.
const iconLinkClassName =
  "-m-1.5 p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

// Links are airmail blue, the app's second colour (see index.css).
const footerLinkClassName =
  "text-tertiary transition-colors hover:text-tertiary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

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
      {/* A quiet second option for anyone who opened this to support the
          project (#266); never shown unprompted. */}
      <a
        href={SPONSOR_URL}
        target="_blank"
        rel="noreferrer"
        className="text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        You can also sponsor development
      </a>
    </div>
  );
}

/**
 * The running version with the Docs, GitHub and Star links, at the foot of
 * the sidebar and of the phone menu (#332). It's about the project, not
 * the page, so it sits below the navigation and out of the header.
 */
function SidebarFoot() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then(({ version }) => {
        if (!cancelled) setVersion(version);
      })
      .catch(() => {
        // Non-critical — the foot just shows no version rather than an error.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-3">
        {version ? (
          <span className="font-mono tracking-tight" title="The version of LatestArr that's running">
            v{version}
          </span>
        ) : null}
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="-my-1 rounded-sm py-1 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Docs
        </a>
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
              className="star-glow star-glow-intro -m-1.5 p-1.5 text-amber-500 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
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
 * The page footer, one line: the credit (the same one as latestarr.app's)
 * and the project's links. Docs and GitHub are in the sidebar's foot.
 */
function AppFooter() {
  const links = [
    { href: SITE_URL, label: "LatestArr.app" },
    { href: DISCUSSIONS_URL, label: "Discussions" },
    // A link, never a prompt (#266).
    { href: SPONSOR_URL, label: "Sponsor" },
    { href: `${REPO_URL}/issues`, label: "Report an issue" },
    { href: LICENSE_URL, label: "GPLv3 license" },
  ];
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 text-xs text-muted-foreground md:px-6">
        {/* The project belongs to its contributors, with the maintainer
            credited as its lead. Underlined, so the link doesn't rely on
            colour alone to stand out from the sentence. */}
        <p>
          © 2026 LatestArr contributors · Led by{" "}
          <a
            href={MAINTAINER_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(footerLinkClassName, "underline underline-offset-2")}
          >
            Jeremy Shields
          </a>
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <nav aria-label="LatestArr project links" className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {links.map(({ href, label }) => (
              // py-1 makes each link 24px tall to tap.
              <a key={label} href={href} target="_blank" rel="noreferrer" className={cn(footerLinkClassName, "py-1")}>
                {label}
              </a>
            ))}
          </nav>
          <Badge variant="tertiary" className="w-fit">
            <Sparkles className="size-3" aria-hidden="true" />
            In Active Development
          </Badge>
        </div>
      </div>
    </footer>
  );
}

// Opened from the account menu (header) or the phone menu, so they hold
// its open state: a dialog inside the menu's popover would close with it.
function EditProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoAvailable, setSsoAvailable] = useState(false);
  const [ssoBusy, setSsoBusy] = useState(false);

  // Each opening starts from the current values. Only the moment it opens
  // counts: a refreshed user while it's open mustn't wipe what's typed.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      getAuthProviders()
        .then((providers) => setSsoAvailable(providers.oidc))
        .catch(() => setSsoAvailable(false));
      setDisplayName(user?.displayName ?? "");
      setCurrentPassword("");
      setNewPassword("");
      setError(null);
    }
    wasOpen.current = open;
  });

  // Linking goes to the identity provider and back (#317).
  async function handleLinkSso() {
    setSsoBusy(true);
    setError(null);
    try {
      const { url } = await startSsoLink();
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start linking SSO.");
      setSsoBusy(false);
    }
  }

  async function handleUnlinkSso() {
    const confirmed = await confirmAction({
      title: "Unlink SSO?",
      description: "You'll sign in with your password until you link it again.",
      confirmLabel: "Unlink",
    });
    if (!confirmed) return;
    setSsoBusy(true);
    setError(null);
    try {
      await unlinkSso();
      await refresh();
      toast({ variant: "success", title: "SSO unlinked" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't unlink SSO.");
    } finally {
      setSsoBusy(false);
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
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const dirty = displayName !== (user?.displayName ?? "") || currentPassword !== "" || newPassword !== "";
  useUnsavedChanges(open && dirty);

  return (
    <Dialog open={open} onOpenChange={guardClose(dirty, onOpenChange)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your display name or change your password.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} ref={saveShortcutRef} noValidate>
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
            <SaveActions dirty={dirty} saving={submitting} />
          </DialogFooter>
        </form>

        {ssoAvailable ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Single sign-on</span>
              <p className="text-xs text-muted-foreground">
                {user?.ssoLinked
                  ? "Linked: you can sign in with SSO."
                  : "Link your SSO account to sign in with it. You'll sign in at your identity provider and come back here."}
              </p>
            </div>
            <div>
              {user?.ssoLinked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleUnlinkSso()}
                  disabled={ssoBusy || !user.hasPassword}
                  title={user.hasPassword ? undefined : "This account signs in only with SSO"}
                >
                  Unlink SSO
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => void handleLinkSso()} disabled={ssoBusy}>
                  Link SSO
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Name, email and account actions at the foot of the phone menu. The email
 * gets its own `title` so the full address is available where it truncates.
 */
function UserSummary() {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
          <span className="truncate" title={user?.displayName || undefined}>
            {user?.displayName}
          </span>
          <RoleBadge />
        </p>
        <p className="truncate text-xs text-muted-foreground" title={user?.email || undefined}>
          {user?.email}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setProfileOpen(true)} aria-label="Edit profile" title="Edit profile">
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Sign out" title="Sign out">
          <LogOut />
        </Button>
      </div>
      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

// Editors and viewers see their role, so missing pages and buttons make sense.
function RoleBadge() {
  const { user } = useAuth();
  if (!user || user.role === "admin") return null;
  return (
    <Badge variant="neutral" className="shrink-0 px-1.5 py-0 text-[0.6875rem]" title={`You have ${ROLE_LABELS[user.role].toLowerCase()} access`}>
      {ROLE_LABELS[user.role]}
    </Badge>
  );
}

/**
 * The header's account menu (#332): the name opens a small menu with the
 * email, Edit profile and Sign out, each with its label, in place of a row
 * of bare icons where Sign out sat one slip from the theme switch.
 */
function AccountMenu() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="max-w-64 gap-2 px-2.5" aria-label={`${user?.displayName ?? "Account"}, account menu`}>
            <span className="truncate">{user?.displayName}</span>
            <RoleBadge />
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-64 flex-col gap-1 p-2">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{user?.displayName}</p>
            <p className="truncate text-xs text-muted-foreground" title={user?.email || undefined}>
              {user?.email}
            </p>
          </div>
          <div className="my-1 h-px bg-border" aria-hidden="true" />
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => {
              setMenuOpen(false);
              setProfileOpen(true);
            }}
          >
            <Pencil />
            Edit profile
          </Button>
          <Button variant="ghost" className="justify-start" onClick={() => void logout()}>
            <LogOut />
            Sign out
          </Button>
        </PopoverContent>
      </Popover>
      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

// Follows an in-app link straight away, or asks first when there are
// unsaved changes and follows it only if they're discarded.
function useGuardedLink() {
  const navigate = useNavigate();
  return (event: MouseEvent<HTMLAnchorElement>, to: string, after?: () => void) => {
    if (!hasUnsavedChanges()) {
      after?.();
      return;
    }
    event.preventDefault();
    void askToDiscard().then((discard) => {
      if (!discard) return;
      navigate(to);
      after?.();
    });
  };
}

// Dashboard, then the sections from lib/nav-items.ts. A section with
// nothing in it for this person's role isn't shown.
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const followLink = useGuardedLink();
  // Pages someone can't use aren't listed (the server refuses them anyway).
  const items = navItems.filter((item) => hasRole(user?.role, item.minRole));
  const sections = [undefined, ...navGroups]
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((section) => section.items.length > 0);
  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {sections.map(({ group, items: sectionItems }) => (
        <div key={group ?? "top"} role={group ? "group" : undefined} aria-label={group} className="flex flex-col gap-1">
          {group ? (
            <p aria-hidden="true" className="px-3 pb-0.5 pt-4 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--sidebar-muted)]">
              {group}
            </p>
          ) : null}
          {sectionItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={(event) => followLink(event, to, onNavigate)}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                    <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary" />
                  ) : null}
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const followLink = useGuardedLink();

  // Back from linking SSO in the profile (#317).
  useEffect(() => {
    const outcome = takeSsoOutcome();
    if (!outcome) return;
    toast({
      variant: outcome === "linked" ? "success" : "destructive",
      title: outcome === "linked" ? "SSO linked" : "SSO not linked",
      description: ssoMessage(outcome),
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* First in the tab order and shown only once focused, so keyboard
          users don't tab through the header and menu on every page. */}
      <a
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="flex h-14 w-full items-center gap-3 px-4 md:px-6">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
                <Menu />
              </Button>
            </SheetTrigger>
            {/* The phone menu is the sidebar, so it's navy too. */}
            <SheetContent className="surface-navy">
              <SheetHeader>
                <SheetTitle>
                  <Logo variant="paper" />
                </SheetTitle>
              </SheetHeader>
              <NavList onNavigate={() => setMobileNavOpen(false)} />
              <div className="mt-auto flex flex-col gap-3">
                <SidebarFoot />
                <div className="border-t border-border pt-3">
                  <UserSummary />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link
            to="/"
            onClick={(event) => followLink(event, "/")}
            aria-label="LatestArr, go to the dashboard"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Logo />
          </Link>

          {/* On phones the account lives at the foot of the menu above. */}
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <div className="hidden md:block">
              <AccountMenu />
            </div>
            <ThemeToggle />
          </div>
        </div>
        {/* The airmail stripe is the header's bottom edge on every page. */}
        <div className="airmail-stripe" aria-hidden="true" />
      </header>

      {/* `flex-1` grows this row to fill what the header leaves inside the
          root's `min-h-screen`, which keeps the footer at the bottom of the
          viewport on short pages. Nothing in the row has a viewport-based
          height: an earlier `calc(100vh-3.5rem)` on the sidebar pushed
          the page past 100vh. */}
      <div className="flex w-full flex-1">
        {/* Navy in both themes (see .surface-navy in index.css). The column
            runs the full height of the row; the list inside it sticks
            under the header and its stripe. */}
        <aside className="surface-navy hidden w-60 shrink-0 border-r border-border md:block">
          <div className="sticky top-[calc(3.5rem+3px)] flex h-[calc(100dvh-3.5rem-3px)] flex-col gap-4 overflow-y-auto p-4">
            <NavList />
            <div className="mt-auto">
              <SidebarFoot />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Focusable so "Skip to content" has somewhere to land. */}
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 p-4 focus:outline-none md:p-6">
            {children}
          </main>
          <AppFooter />
        </div>
      </div>
    </div>
  );
}
