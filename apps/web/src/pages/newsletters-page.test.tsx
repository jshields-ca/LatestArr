import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NewslettersPage } from "./newsletters-page";
import { selectOption } from "@/test/select";

function renderPage() {
  return render(
    <MemoryRouter>
      <NewslettersPage />
    </MemoryRouter>,
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) };
}

const weeklyDigest = {
  id: "n1",
  name: "Weekly digest",
  templateId: null,
  smtpProfileId: null,
  senderIdentity: null,
  subjectTemplate: "",
  scheduleCron: "0 8 * * 1",
  timezone: "UTC",
  isEnabled: true,
  lookbackDays: 7,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const tautulliSource = {
  id: "src1",
  name: "Home Tautulli",
  kind: "tautulli",
  baseUrl: "http://localhost:8181",
  status: "ok" as const,
  lastCheckedAt: null,
  lastError: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const everyoneGroup = {
  id: "g1",
  name: "Everyone",
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const primarySmtpProfile = {
  id: "smtp1",
  name: "Primary",
  host: "smtp.example.com",
  port: 587,
  secure: false,
  hasAuth: true,
  defaultFromName: "LatestArr",
  defaultFromEmail: "noreply@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const secondarySmtpProfile = { ...primarySmtpProfile, id: "smtp2", name: "Secondary" };

const weeklyLayoutTemplate = {
  id: "t1",
  name: "Weekly Layout",
  designJson: null,
  compiledMjml: null,
  compiledHtml: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function baseRoutes(overrides: Record<string, unknown> = {}) {
  return {
    "/api/newsletters": jsonResponse(200, { newsletters: [] }),
    "/api/sources": jsonResponse(200, { sources: [] }),
    "/api/recipient-groups": jsonResponse(200, { groups: [] }),
    "/api/smtp-profiles": jsonResponse(200, { smtpProfiles: [] }),
    ...overrides,
  };
}

function mockRoutes(routes: Record<string, unknown>) {
  fetchMock.mockImplementation((url: string) => {
    if (url in routes) return Promise.resolve(routes[url]);
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

describe("NewslettersPage", () => {
  it("shows the empty state", async () => {
    mockRoutes(baseRoutes());
    renderPage();
    expect(await screen.findByText("No newsletters yet")).toBeInTheDocument();
  });

  it("lists a newsletter with its schedule humanized instead of the raw cron", async () => {
    mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }) }));
    renderPage();

    expect(await screen.findByText("Weekly digest")).toBeInTheDocument();
    // weeklyDigest.scheduleCron is "0 8 * * 1" — weekly, Monday, 08:00 UTC —
    // and should read as a sentence, not the literal cron string.
    expect(screen.getByText(/Weekly on Monday at 8:00 AM \(UTC\)/)).toBeInTheDocument();
    expect(screen.queryByText(/0 8 \* \* 1/)).not.toBeInTheDocument();
  });

  it("falls back to the raw cron string for a schedule the simple picker can't express", async () => {
    const customSchedule = { ...weeklyDigest, scheduleCron: "*/15 * * * *" };
    mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [customSchedule] }) }));
    renderPage();

    expect(await screen.findByText("Weekly digest")).toBeInTheDocument();
    expect(screen.getByText(/\*\/15 \* \* \* \* \(UTC\)/)).toBeInTheDocument();
  });

  // The Add newsletter dialog mounts several real Radix Selects (Repeats,
  // Timezone, SMTP profile) even though this test never opens one — on a
  // busy CI runner just mounting them was enough to blow past the 5s
  // default, so this gets an explicit timeout too.
  it(
    "adds a newsletter through the dialog",
    async () => {
      const user = userEvent.setup();
      mockRoutes(baseRoutes());
      renderPage();
      await screen.findByText("No newsletters yet");

      await user.click(screen.getByRole("button", { name: "Add newsletter" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Name"), "Weekly digest");

      fetchMock.mockResolvedValueOnce(jsonResponse(201, { newsletter: weeklyDigest }));
      await user.click(within(dialog).getByRole("button", { name: "Add newsletter" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByText("Weekly digest")).toBeInTheDocument();

      const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      // Default simple schedule: weekly, Monday, 08:00, UTC.
      expect(body.scheduleCron).toBe("0 8 * * 1");
      expect(body.timezone).toBe("UTC");
    },
    60000,
  );

  // The Repeats <Select> is a real Radix dropdown now, not a native
  // <select> — jsdom's lack of real layout/pointer-capture support makes
  // the *next* async Testing Library call after opening/closing one
  // noticeably slower to settle than in a real browser (measured ~35-45s
  // locally, but CI's runners show much wider variance under load — one
  // otherwise-identical sibling test measured 70s+ on a busy CI run), so
  // these get a generous explicit timeout rather than the 5s default.
  it(
    "builds a daily cron expression from the simple schedule picker",
    async () => {
      const user = userEvent.setup();
      mockRoutes(baseRoutes());
      renderPage();
      await screen.findByText("No newsletters yet");

      await user.click(screen.getByRole("button", { name: "Add newsletter" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Name"), "Daily digest");
      selectOption(within(dialog).getByLabelText("Repeats"), "Every day");
      fireEvent.change(within(dialog).getByLabelText("At"), { target: { value: "09:15" } });

      fetchMock.mockResolvedValueOnce(jsonResponse(201, { newsletter: weeklyDigest }));
      await user.click(within(dialog).getByRole("button", { name: "Add newsletter" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      expect(JSON.parse(init.body as string).scheduleCron).toBe("15 9 * * *");
    },
    150000,
  );

  it(
    "builds a monthly cron expression from the simple schedule picker",
    async () => {
      const user = userEvent.setup();
      mockRoutes(baseRoutes());
      renderPage();
      await screen.findByText("No newsletters yet");

      await user.click(screen.getByRole("button", { name: "Add newsletter" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Name"), "Monthly digest");
      selectOption(within(dialog).getByLabelText("Repeats"), "Every month");
      await user.clear(within(dialog).getByLabelText("On day of the month"));
      await user.type(within(dialog).getByLabelText("On day of the month"), "5");

      fetchMock.mockResolvedValueOnce(jsonResponse(201, { newsletter: weeklyDigest }));
      await user.click(within(dialog).getByRole("button", { name: "Add newsletter" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      expect(JSON.parse(init.body as string).scheduleCron).toBe("0 8 5 * *");
    },
    150000,
  );

  it("switches to a custom cron expression and submits it as-is", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes());
    renderPage();
    await screen.findByText("No newsletters yet");

    await user.click(screen.getByRole("button", { name: "Add newsletter" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Custom schedule");
    await user.click(within(dialog).getByRole("button", { name: "Use a custom cron expression" }));
    const cronInput = within(dialog).getByLabelText("Cron expression");
    await user.clear(cronInput);
    await user.type(cronInput, "*/15 * * * *");

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { newsletter: weeklyDigest }));
    await user.click(within(dialog).getByRole("button", { name: "Add newsletter" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(init.body as string).scheduleCron).toBe("*/15 * * * *");
  });

  it(
    "changes the timezone in the add dialog",
    async () => {
      const user = userEvent.setup();
      mockRoutes(baseRoutes());
      renderPage();
      await screen.findByText("No newsletters yet");

      await user.click(screen.getByRole("button", { name: "Add newsletter" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Name"), "Winnipeg digest");
      selectOption(within(dialog).getByLabelText("Timezone"), "America/Winnipeg");

      fetchMock.mockResolvedValueOnce(jsonResponse(201, { newsletter: weeklyDigest }));
      await user.click(within(dialog).getByRole("button", { name: "Add newsletter" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      expect(JSON.parse(init.body as string).timezone).toBe("America/Winnipeg");
    },
    150000,
  );

  it("defaults the Add newsletter dialog's timezone to the browser's detected zone", async () => {
    const user = userEvent.setup();
    const dtfSpy = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(
        () => ({ resolvedOptions: () => ({ timeZone: "America/Winnipeg" }) }) as unknown as Intl.DateTimeFormat,
      );
    mockRoutes(baseRoutes());
    renderPage();
    await screen.findByText("No newsletters yet");

    await user.click(screen.getByRole("button", { name: "Add newsletter" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Timezone")).toHaveTextContent("America/Winnipeg");

    dtfSpy.mockRestore();
  });

  it("falls back to UTC when the browser reports a zone outside the supported list", async () => {
    const user = userEvent.setup();
    const dtfSpy = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(
        () => ({ resolvedOptions: () => ({ timeZone: "Not/AZone" }) }) as unknown as Intl.DateTimeFormat,
      );
    mockRoutes(baseRoutes());
    renderPage();
    await screen.findByText("No newsletters yet");

    await user.click(screen.getByRole("button", { name: "Add newsletter" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Timezone")).toHaveTextContent("UTC");

    dtfSpy.mockRestore();
  });

  it("auto-selects the sole SMTP profile in the Add newsletter dialog", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes({ "/api/smtp-profiles": jsonResponse(200, { smtpProfiles: [primarySmtpProfile] }) }));
    renderPage();
    await screen.findByText("No newsletters yet");

    await user.click(screen.getByRole("button", { name: "Add newsletter" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("SMTP profile")).toHaveTextContent("Primary");
  });

  it("leaves the SMTP profile unselected in the Add newsletter dialog when there are no profiles yet", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes());
    renderPage();
    await screen.findByText("No newsletters yet");

    await user.click(screen.getByRole("button", { name: "Add newsletter" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("SMTP profile")).toHaveValue("");
  });

  it("leaves the SMTP profile unselected in the Add newsletter dialog when there are multiple profiles", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/smtp-profiles": jsonResponse(200, { smtpProfiles: [primarySmtpProfile, secondarySmtpProfile] }),
      }),
    );
    renderPage();
    await screen.findByText("No newsletters yet");

    await user.click(screen.getByRole("button", { name: "Add newsletter" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("SMTP profile")).toHaveValue("");
  });

  it("groups delivery fields under a labeled section in the Add newsletter dialog", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes());
    renderPage();
    await screen.findByText("No newsletters yet");

    await user.click(screen.getByRole("button", { name: "Add newsletter" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Delivery")).toBeInTheDocument();
    expect(within(dialog).getByText("Schedule")).toBeInTheDocument();
  });

  it("toggles enabled via the switch", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }) }));
    renderPage();
    await screen.findByText("Weekly digest");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletter: { ...weeklyDigest, isEnabled: false } }));
    await user.click(screen.getByRole("switch"));

    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ isEnabled: false });
  });

  it(
    "expands a newsletter, links a source and a group, and sends now",
    async () => {
      const user = userEvent.setup();
      mockRoutes(
        baseRoutes({
          "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
          "/api/sources": jsonResponse(200, { sources: [tautulliSource] }),
          "/api/recipient-groups": jsonResponse(200, { groups: [everyoneGroup] }),
          "/api/newsletters/n1": jsonResponse(200, {
            newsletter: weeklyDigest,
            sources: [],
            recipientGroups: [],
          }),
          "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
        }),
      );
      renderPage();
      await screen.findByText("Weekly digest");

      await user.click(screen.getByRole("button", { name: /Weekly digest.*lookback/, expanded: false }));
      expect(await screen.findByText("No sources linked yet.")).toBeInTheDocument();
      expect(await screen.findByText("No sends yet.")).toBeInTheDocument();

      fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
      selectOption(screen.getByLabelText("Add a source to this newsletter"), "Home Tautulli");
      await user.click(screen.getAllByRole("button", { name: "Add" })[0]!);
      expect(await screen.findByLabelText("Remove Home Tautulli from newsletter")).toBeInTheDocument();

      fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
      selectOption(screen.getByLabelText("Add a recipient group to this newsletter"), "Everyone");
      await user.click(screen.getByRole("button", { name: "Add" }));
      expect(await screen.findByLabelText("Remove Everyone from newsletter")).toBeInTheDocument();

      fetchMock.mockResolvedValueOnce(jsonResponse(200, { sendRunId: "run1" }));
      await user.click(screen.getByRole("button", { name: "Send now" }));
      expect(await screen.findByText("Send started.")).toBeInTheDocument();
    },
    // Two separate Select-then-userEvent-click sequences in one test, each
    // of which costs the ~30-40s jsdom/userEvent settling delay described
    // above — see the testTimeout comment in vitest.config.ts.
    240000,
  );

  it("shows the send-now error when the newsletter is misconfigured", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
        "/api/newsletters/n1": jsonResponse(200, {
          newsletter: weeklyDigest,
          sources: [],
          recipientGroups: [],
        }),
        "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
      }),
    );
    renderPage();
    await screen.findByText("Weekly digest");
    await user.click(screen.getByRole("button", { name: /Weekly digest.*lookback/, expanded: false }));
    await screen.findByText("No sends yet.");

    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "Newsletter has no SMTP profile configured" }),
    );
    await user.click(screen.getByRole("button", { name: "Send now" }));

    expect(await screen.findByText("Newsletter has no SMTP profile configured")).toBeInTheDocument();
  });

  it("shows a specific send-now failure message inline immediately, not a generic Internal Server Error", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
        "/api/newsletters/n1": jsonResponse(200, {
          newsletter: weeklyDigest,
          sources: [],
          recipientGroups: [],
        }),
        "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
      }),
    );
    renderPage();
    await screen.findByText("Weekly digest");
    await user.click(screen.getByRole("button", { name: /Weekly digest.*lookback/, expanded: false }));
    await screen.findByText("No sends yet.");

    fetchMock.mockResolvedValueOnce(
      jsonResponse(502, {
        error: "Could not reach one of this newsletter's connected sources (fetch failed)",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Send now" }));

    expect(
      await screen.findByText("Could not reach one of this newsletter's connected sources (fetch failed)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Internal Server Error")).not.toBeInTheDocument();
  });

  it("shows a loading state on Send now while the request is in flight", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
        "/api/newsletters/n1": jsonResponse(200, {
          newsletter: weeklyDigest,
          sources: [],
          recipientGroups: [],
        }),
        "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
      }),
    );
    renderPage();
    await screen.findByText("Weekly digest");
    await user.click(screen.getByRole("button", { name: /Weekly digest.*lookback/, expanded: false }));
    await screen.findByText("No sends yet.");

    let resolveSend!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    const sendButton = screen.getByRole("button", { name: "Send now" });
    await user.click(sendButton);
    expect(sendButton).toBeDisabled();

    resolveSend(jsonResponse(200, { sendRunId: "run1" }));
    await waitFor(() => expect(sendButton).not.toBeDisabled());
  });

  it("refreshes send history right after Send now resolves, without a page reload", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
        "/api/newsletters/n1": jsonResponse(200, {
          newsletter: weeklyDigest,
          sources: [],
          recipientGroups: [],
        }),
        "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
      }),
    );
    renderPage();
    await screen.findByText("Weekly digest");
    await user.click(screen.getByRole("button", { name: /Weekly digest.*lookback/, expanded: false }));
    await screen.findByText("No sends yet.");

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { sendRunId: "run1" }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        sendRuns: [
          {
            id: "run1",
            newsletterId: "n1",
            status: "success",
            startedAt: "2026-01-02T00:00:00.000Z",
            finishedAt: "2026-01-02T00:00:05.000Z",
            itemCountIncluded: 3,
            recipientCount: 2,
            error: null,
          },
        ],
      }),
    );
    await user.click(screen.getByRole("button", { name: "Send now" }));

    expect(await screen.findByText(/3 items/)).toBeInTheDocument();
    expect(screen.queryByText("No sends yet.")).not.toBeInTheDocument();
  });

  it("visually distinguishes an empty successful send from a real one in send history", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
        "/api/newsletters/n1": jsonResponse(200, {
          newsletter: weeklyDigest,
          sources: [],
          recipientGroups: [],
        }),
        "/api/newsletters/n1/send-runs": jsonResponse(200, {
          sendRuns: [
            {
              id: "run-empty",
              newsletterId: "n1",
              status: "success",
              startedAt: "2026-01-01T00:00:00.000Z",
              finishedAt: "2026-01-01T00:00:01.000Z",
              itemCountIncluded: 0,
              recipientCount: 0,
              error: null,
            },
          ],
        }),
      }),
    );
    renderPage();
    await screen.findByText("Weekly digest");
    await user.click(screen.getByRole("button", { name: /Weekly digest.*lookback/, expanded: false }));

    expect(await screen.findByText("Sent (empty)")).toBeInTheDocument();
    expect(screen.queryByText("success")).not.toBeInTheDocument();
  });

  it(
    "creates a newsletter with a template selected in the dialog",
    async () => {
      const user = userEvent.setup();
      mockRoutes(baseRoutes({ "/api/templates": jsonResponse(200, { templates: [weeklyLayoutTemplate] }) }));
      renderPage();
      await screen.findByText("No newsletters yet");

      await user.click(screen.getByRole("button", { name: "Add newsletter" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Name"), "Weekly digest");
      selectOption(within(dialog).getByLabelText("Template"), "Weekly Layout");

      fetchMock.mockResolvedValueOnce(jsonResponse(201, { newsletter: { ...weeklyDigest, templateId: "t1" } }));
      await user.click(within(dialog).getByRole("button", { name: "Add newsletter" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toMatchObject({ templateId: "t1" });
    },
    150000,
  );

  it(
    "changes and then unsets an existing newsletter's template",
    async () => {
      const user = userEvent.setup();
      mockRoutes(
        baseRoutes({
          "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
          "/api/templates": jsonResponse(200, { templates: [weeklyLayoutTemplate] }),
          "/api/newsletters/n1": jsonResponse(200, {
            newsletter: weeklyDigest,
            sources: [],
            recipientGroups: [],
          }),
          "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
        }),
      );
      renderPage();
      await screen.findByText("Weekly digest");
      await user.click(screen.getByRole("button", { name: /Weekly digest.*lookback/, expanded: false }));
      await screen.findByLabelText("Template");

      fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletter: { ...weeklyDigest, templateId: "t1" } }));
      selectOption(screen.getByLabelText("Template"), "Weekly Layout");
      let [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({ templateId: "t1" });
      expect(await screen.findByRole("link", { name: "Edit template" })).toHaveAttribute(
        "href",
        "/templates/t1/edit",
      );

      fetchMock.mockResolvedValueOnce(jsonResponse(200, { newsletter: { ...weeklyDigest, templateId: null } }));
      selectOption(screen.getByLabelText("Template"), "Use the default layout");
      [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({ templateId: null });
      await waitFor(() => expect(screen.queryByRole("link", { name: "Edit template" })).not.toBeInTheDocument());
    },
    // Two selectOption calls, each followed by an async `findBy`/`waitFor`
    // — see the testTimeout comment in vitest.config.ts.
    240000,
  );

  it("prefills the edit dialog with the existing schedule parsed into simple mode", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }) }));
    renderPage();
    await screen.findByText("Weekly digest");

    await user.click(screen.getByRole("button", { name: "Edit Weekly digest" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Weekly digest");
    // weeklyDigest.scheduleCron is "0 8 * * 1" — weekly, Monday, 08:00.
    expect(within(dialog).getByLabelText("Repeats")).toHaveTextContent("Every week");
    expect(within(dialog).getByLabelText("At")).toHaveValue("08:00");
    expect(within(dialog).getByLabelText("On")).toHaveTextContent("Monday");
    expect(within(dialog).getByLabelText("Timezone")).toHaveTextContent("UTC");
    expect(within(dialog).queryByLabelText("Cron expression")).not.toBeInTheDocument();
  });

  it("falls back to advanced mode in the edit dialog for a cron pattern the simple picker can't express", async () => {
    const user = userEvent.setup();
    const customSchedule = { ...weeklyDigest, scheduleCron: "*/15 * * * *" };
    mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [customSchedule] }) }));
    renderPage();
    await screen.findByText("Weekly digest");

    await user.click(screen.getByRole("button", { name: "Edit Weekly digest" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Cron expression")).toHaveValue("*/15 * * * *");
    expect(within(dialog).queryByLabelText("Repeats")).not.toBeInTheDocument();
  });

  it(
    "edits a newsletter's schedule and saves",
    async () => {
      const user = userEvent.setup();
      mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }) }));
      renderPage();
      await screen.findByText("Weekly digest");

      await user.click(screen.getByRole("button", { name: "Edit Weekly digest" }));
      const dialog = await screen.findByRole("dialog");
      selectOption(within(dialog).getByLabelText("Repeats"), "Every day");
      fireEvent.change(within(dialog).getByLabelText("At"), { target: { value: "10:30" } });

      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { newsletter: { ...weeklyDigest, scheduleCron: "30 10 * * *" } }),
      );
      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body as string)).toMatchObject({
        name: "Weekly digest",
        scheduleCron: "30 10 * * *",
        timezone: "UTC",
      });
    },
    150000,
  );

  it("deletes a newsletter after confirmation", async () => {
    const user = userEvent.setup();
    mockRoutes(baseRoutes({ "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }) }));
    renderPage();
    await screen.findByText("Weekly digest");

    await user.click(screen.getByRole("button", { name: "Delete Weekly digest" }));
    fetchMock.mockResolvedValueOnce({ status: 204, ok: true, json: () => Promise.resolve(undefined) });
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.queryByText("Weekly digest")).not.toBeInTheDocument());
    expect(screen.getByText("No newsletters yet")).toBeInTheDocument();
  });

  it("has no accessibility violations in the empty state", async () => {
    mockRoutes(baseRoutes());
    const { container } = renderPage();
    await screen.findByText("No newsletters yet");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with an expanded newsletter", async () => {
    const user = userEvent.setup();
    mockRoutes(
      baseRoutes({
        "/api/newsletters": jsonResponse(200, { newsletters: [weeklyDigest] }),
        "/api/templates": jsonResponse(200, { templates: [weeklyLayoutTemplate] }),
        "/api/newsletters/n1": jsonResponse(200, {
          newsletter: weeklyDigest,
          sources: [],
          recipientGroups: [],
        }),
        "/api/newsletters/n1/send-runs": jsonResponse(200, { sendRuns: [] }),
      }),
    );
    const { container } = renderPage();
    await screen.findByText("Weekly digest");
    await user.click(screen.getByRole("button", { name: /Weekly digest.*lookback/, expanded: false }));
    await screen.findByLabelText("Template");

    expect(await axe(container)).toHaveNoViolations();
  });

  it(
    "has no accessibility violations with the add-newsletter dialog open",
    async () => {
      const user = userEvent.setup();
      mockRoutes(baseRoutes());
      renderPage();
      await screen.findByText("No newsletters yet");

      await user.click(screen.getByRole("button", { name: "Add newsletter" }));
      await screen.findByRole("dialog");

      // The timezone <select> has 400+ <option>s (every IANA zone) — axe
      // scanning the whole dialog subtree takes longer than the default
      // 5s test timeout under load.
      expect(await axe(document.body)).toHaveNoViolations();
    },
    25000,
  );
});
