import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
};

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role", { enum: ["admin", "editor", "viewer"] })
    .notNull()
    .default("admin"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  ...timestamps,
});

export const oidcIdentities = sqliteTable(
  "oidc_identities",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    providerLabel: text("provider_label"),
    linkedAt: integer("linked_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    issuerSubjectUnique: uniqueIndex("oidc_identities_issuer_subject_idx").on(
      table.issuer,
      table.subject,
    ),
  }),
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

export const sourceConnections = sqliteTable("source_connections", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  baseUrl: text("base_url").notNull(),
  // The user-reachable address for this source, when it differs from
  // baseUrl (the address the adapter itself calls to fetch data) — e.g.
  // Tautulli's baseUrl is its own API host, not a Plex-watchable URL, and a
  // RomM/Plex baseUrl may be a Tailscale/LAN address unreachable by an
  // email recipient on another network. Nullable and optional: every
  // consumer (per-item deep links, the Media List block's empty-pool
  // "browse the library" fallback) falls back to baseUrl when this is
  // unset, so existing source connections are unaffected.
  publicUrl: text("public_url"),
  credentialsEncrypted: text("credentials_encrypted").notNull(),
  config: text("config", { mode: "json" }).$type<Record<string, unknown>>(),
  status: text("status", { enum: ["ok", "error", "unconfigured"] })
    .notNull()
    .default("unconfigured"),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
  lastError: text("last_error"),
  ...timestamps,
});

export const recipients = sqliteTable("recipients", {
  id: id(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  unsubscribeToken: text("unsubscribe_token")
    .notNull()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const recipientGroups = sqliteTable("recipient_groups", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
});

export const recipientGroupMembers = sqliteTable(
  "recipient_group_members",
  {
    recipientId: text("recipient_id")
      .notNull()
      .references(() => recipients.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => recipientGroups.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.recipientId, table.groupId] }),
  }),
);

export const templates = sqliteTable("templates", {
  id: id(),
  name: text("name").notNull(),
  designJson: text("design_json", { mode: "json" }).$type<Record<string, unknown>>(),
  compiledMjml: text("compiled_mjml"),
  compiledHtml: text("compiled_html"),
  createdBy: text("created_by").references(() => users.id),
  ...timestamps,
});

export const smtpProfiles = sqliteTable("smtp_profiles", {
  id: id(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  secure: integer("secure", { mode: "boolean" }).notNull().default(true),
  authUserEncrypted: text("auth_user_encrypted"),
  authPassEncrypted: text("auth_pass_encrypted"),
  defaultFromName: text("default_from_name").notNull(),
  defaultFromEmail: text("default_from_email").notNull(),
});

export const newsletters = sqliteTable("newsletters", {
  id: id(),
  name: text("name").notNull(),
  templateId: text("template_id").references(() => templates.id),
  smtpProfileId: text("smtp_profile_id").references(() => smtpProfiles.id),
  senderIdentity: text("sender_identity", { mode: "json" }).$type<{
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
  }>(),
  subjectTemplate: text("subject_template").notNull().default(""),
  scheduleCron: text("schedule_cron").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  lookbackDays: integer("lookback_days").notNull().default(7),
  // Which of the default template's built-in font stacks to render with —
  // only meaningful when this newsletter has no custom templateId (see
  // apps/server/src/render/email-fonts.ts for the catalog). A custom
  // GrapesJS-authored template defines its own fonts, so this is ignored
  // once templateId is set.
  emailFont: text("email_font").notNull().default("ubuntu"),
  ...timestamps,
});

export const newsletterSources = sqliteTable(
  "newsletter_sources",
  {
    newsletterId: text("newsletter_id")
      .notNull()
      .references(() => newsletters.id, { onDelete: "cascade" }),
    sourceConnectionId: text("source_connection_id")
      .notNull()
      .references(() => sourceConnections.id, { onDelete: "cascade" }),
    mediaTypeFilter: text("media_type_filter", { mode: "json" }).$type<string[]>(),
    libraryFilter: text("library_filter", { mode: "json" }).$type<string[]>(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.newsletterId, table.sourceConnectionId] }),
  }),
);

export const newsletterRecipientGroups = sqliteTable(
  "newsletter_recipient_groups",
  {
    newsletterId: text("newsletter_id")
      .notNull()
      .references(() => newsletters.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => recipientGroups.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.newsletterId, table.groupId] }),
  }),
);

export const sendRuns = sqliteTable("send_runs", {
  id: id(),
  newsletterId: text("newsletter_id")
    .notNull()
    .references(() => newsletters.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["pending", "running", "success", "partial_failure", "failed"],
  })
    .notNull()
    .default("pending"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  itemCountIncluded: integer("item_count_included").notNull().default(0),
  recipientCount: integer("recipient_count").notNull().default(0),
  error: text("error"),
  // A lightweight snapshot of what was actually included — title/kind
  // only, not the full NewItem shape — set once rendering succeeds, even
  // if the send itself later fails partway through recipients. Null for
  // any send-run from before this column existed, and for one that failed
  // before rendering got far enough to produce content.
  itemsSnapshot: text("items_snapshot", { mode: "json" }).$type<{ title: string; kind: string }[]>(),
  // The actual rendered HTML sent, so "what did this newsletter look
  // like" doesn't require re-rendering (which could differ from what was
  // actually sent if templates/sources changed since). Same
  // set-once-rendering-succeeds timing as itemsSnapshot. Stored inline
  // rather than as a file — newsletter HTML is a few KB to at most a few
  // hundred KB with embedded images stripped to CID refs (the images
  // themselves are sent as attachments, not inlined into this column) —
  // not large enough to justify separate blob storage.
  renderedHtml: text("rendered_html"),
});

export const sendRunRecipientResults = sqliteTable("send_run_recipient_results", {
  id: id(),
  sendRunId: text("send_run_id")
    .notNull()
    .references(() => sendRuns.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id")
    .notNull()
    .references(() => recipients.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["sent", "bounced", "failed", "skipped_unsubscribed"],
  }).notNull(),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>(),
});
