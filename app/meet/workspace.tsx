"use client";
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- dialog containers own keyboard focus trapping */

import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Meeting = {
  id: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  location?: string | null;
  status?: string;
};
type Participant = {
  id?: string;
  userId?: string | null;
  email?: string;
  name?: string | null;
  organizationName?: string | null;
  role?: string | null;
};
type Preparation = {
  status?: string;
  agenda?: string | null;
  objectives?: string | null;
  brief?: string | null;
} | null;
type ActionItem = {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  dueAt?: string | null;
  assigneeUserId?: string | null;
  evidenceId?: string | null;
};
type Evidence = {
  id: string;
  kind: string;
  content: string;
  visibility?: string;
};
type Nudge = {
  id: string;
  message: string;
  createdAt?: string;
  createdBy?: string | null;
};
type MeetingDetail = {
  meeting: Meeting;
  participants: Participant[];
  preparation: Preparation;
  actionItems: ActionItem[];
  evidence: Evidence[];
  nudges: Nudge[];
};
type Principal = { name: string; email: string };
type View = "overview" | "meetings" | "actions";

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok)
    throw new Error(body.error || "The request could not be completed.");
  return body as T;
};
const when = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(
    undefined,
    options || { dateStyle: "medium", timeStyle: "short" },
  ).format(new Date(value));
const initials = (name?: string | null) =>
  (name || "Guest")
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
function useDialog<T extends HTMLElement>(close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    if (!node) return;
    const shell = node.closest(".meet-shell");
    const siblings = shell
      ? [...shell.children].filter(
          (child) => child !== node && !(child as HTMLElement).contains(node),
        )
      : [];
    siblings.forEach((child) => ((child as HTMLElement).inert = true));
    [...node.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[href],[tabindex]:not([tabindex="-1"])',
    )].find(
      (element) =>
        element.offsetParent !== null &&
        !element.hidden &&
        !element.closest('[inert],[aria-hidden="true"]'),
    )?.focus();
    return () => {
      siblings.forEach((child) => ((child as HTMLElement).inert = false));
      previous?.focus();
    };
  }, []);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const focusable = [
      ...ref.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[href],[tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      (element) =>
        element.offsetParent !== null &&
        !element.hidden &&
        !element.closest('[inert],[aria-hidden="true"]'),
    );
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return [ref, onKeyDown] as const;
}

export function MeetingWorkspace({ principal }: { principal: Principal }) {
  const [view, setView] = useState<View>("overview"),
    [meetings, setMeetings] = useState<Meeting[]>([]),
    [selected, setSelected] = useState<MeetingDetail | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [scheduleOpen, setScheduleOpen] = useState(false),
    [detailOpen, setDetailOpen] = useState(false),
    [liveOpen, setLiveOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMeetings(
        (await api<{ meetings: Meeting[] }>("/api/meetings")).meetings,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<{ meetings: Meeting[] }>("/api/meetings")
      .then(
        (result) => {
          if (active) setMeetings(result.meetings);
        },
        (issue) => {
          if (active) setError((issue as Error).message);
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const openMeeting = async (id: string) => {
    setError("");
    try {
      setSelected(await api<MeetingDetail>(`/api/meetings/${id}`));
      setDetailOpen(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const refreshMeeting = async (id: string) => {
    setError("");
    try {
      setSelected(await api<MeetingDetail>(`/api/meetings/${id}`));
    } catch (issue) {
      setError((issue as Error).message);
    }
  };
  const upcoming = useMemo(
    () =>
      meetings
        .filter((m) => new Date(m.endsAt) > new Date())
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    [meetings],
  );
  return (
    <main className="meet-shell">
      <a className="meet-skip" href="#meeting-content">
        Skip to meeting content
      </a>
      <aside className="meet-sidebar">
        <Link
          href="/app"
          className="meet-brand"
          aria-label="RoleField app home"
        >
          <span>R</span>
          <b>rolefield</b>
        </Link>
        <nav aria-label="Meeting workspace">
          {(
            [
              ["overview", "Overview"],
              ["meetings", "Meetings"],
              ["actions", "Actions"],
            ] as [View, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              aria-current={view === key ? "page" : undefined}
              onClick={() => setView(key)}
            >
              <span aria-hidden="true">
                {key === "overview" ? "⌂" : key === "meetings" ? "◉" : "✓"}
              </span>
              {label}
            </button>
          ))}
        </nav>
        <div className="meet-account">
          <span>{initials(principal.name)}</span>
          <div>
            <b>{principal.name}</b>
            <small>{principal.email}</small>
          </div>
        </div>
      </aside>
      <section className="meet-main">
        <header className="meet-topbar">
          <Link href="/app">All apps</Link>
          <button
            className="meet-primary"
            onClick={() => setScheduleOpen(true)}
          >
            Schedule meeting
          </button>
        </header>
        <div id="meeting-content" className="meet-page" tabIndex={-1}>
          {error && (
            <div className="meet-alert" role="alert">
              <span>{error}</span>
              <button onClick={() => void load()}>Try again</button>
            </div>
          )}
          {view === "overview" && (
            <Overview
              name={principal.name}
              upcoming={upcoming}
              loading={loading}
              openMeeting={openMeeting}
              schedule={() => setScheduleOpen(true)}
            />
          )}{" "}
          {view === "meetings" && (
            <MeetingList
              meetings={meetings}
              loading={loading}
              openMeeting={openMeeting}
              schedule={() => setScheduleOpen(true)}
            />
          )}{" "}
          {view === "actions" && (
            <ActionsPanel
              actions={
                selected?.actionItems.filter((a) => a.status !== "COMPLETED") ||
                []
              }
              hasSelection={Boolean(selected)}
              onSelectMeeting={() => setView("meetings")}
              update={async (a, status) => {
                if (!selected) return;
                await api(
                  `/api/meetings/${selected.meeting.id}/actions/${a.id}`,
                  { method: "PATCH", body: JSON.stringify({ status }) },
                );
                await refreshMeeting(selected.meeting.id);
              }}
            />
          )}
        </div>
      </section>
      {scheduleOpen && (
        <ScheduleDialog
          close={() => setScheduleOpen(false)}
          saved={async (m) => {
            setScheduleOpen(false);
            await load();
            await openMeeting(m.id);
          }}
        />
      )}
      {selected && detailOpen && !liveOpen && (
        <MeetingDrawer
          detail={selected}
          close={() => setDetailOpen(false)}
          refresh={() => refreshMeeting(selected.meeting.id)}
          enterLive={() => setLiveOpen(true)}
        />
      )}{" "}
      {liveOpen && selected && (
        <LiveShell
          detail={selected}
          close={() => setLiveOpen(false)}
          refresh={() => refreshMeeting(selected.meeting.id)}
        />
      )}
    </main>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="meet-heading">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </header>
  );
}
function Empty({
  title,
  copy,
  action,
  label,
}: {
  title: string;
  copy: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="meet-empty">
      <span aria-hidden="true">◇</span>
      <h2>{title}</h2>
      <p>{copy}</p>
      {action && (
        <button className="meet-primary" onClick={action}>
          {label}
        </button>
      )}
    </div>
  );
}
function Loading() {
  return (
    <div className="meet-loading" role="status">
      <span />
      Loading meeting records…
    </div>
  );
}
function Overview({
  name,
  upcoming,
  loading,
  openMeeting,
  schedule,
}: {
  name: string;
  upcoming: Meeting[];
  loading: boolean;
  openMeeting: (id: string) => void;
  schedule: () => void;
}) {
  const next = upcoming[0];
  return (
    <>
      <PageHeading
        eyebrow="MEETING WORKSPACE"
        title={`Welcome, ${name.split(" ")[0]}.`}
        description="Prepare, collaborate, and follow through from one accountable record."
      />
      {loading ? (
        <Loading />
      ) : next ? (
        <section className="meet-feature">
          <div>
            <small>NEXT MEETING</small>
            <time dateTime={next.startsAt}>{when(next.startsAt)}</time>
            <h2>{next.title}</h2>
            <p>{next.description || "No description has been added."}</p>
            <dl>
              <div>
                <dt>Location</dt>
                <dd>{next.location || "Not set"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{next.status || "Scheduled"}</dd>
              </div>
            </dl>
            <button
              className="meet-primary"
              onClick={() => openMeeting(next.id)}
            >
              Open meeting
            </button>
          </div>
          <aside>
            <h3>Before you join</h3>
            <ul>
              <li>Review the agenda and preparation brief.</li>
              <li>Confirm recording and transcription preferences.</li>
              <li>Use the live workspace only when the meeting begins.</li>
            </ul>
          </aside>
        </section>
      ) : (
        <Empty
          title="No upcoming meetings"
          copy="Schedule a meeting to start a persistent preparation and follow-up record."
          action={schedule}
          label="Schedule meeting"
        />
      )}
      <section className="meet-section">
        <div className="meet-section-title">
          <div>
            <small>UPCOMING</small>
            <h2>Your schedule</h2>
          </div>
        </div>
        {!loading && upcoming.length > 0 && (
          <div className="meet-list">
            {upcoming.slice(0, 5).map((m) => (
              <MeetingRow
                key={m.id}
                meeting={m}
                open={() => openMeeting(m.id)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
function MeetingList({
  meetings,
  loading,
  openMeeting,
  schedule,
}: {
  meetings: Meeting[];
  loading: boolean;
  openMeeting: (id: string) => void;
  schedule: () => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="MEETINGS"
        title="Meeting records"
        description="Scheduled, active, and completed meetings available to your organization."
      />
      {loading ? (
        <Loading />
      ) : meetings.length ? (
        <div className="meet-list">
          {meetings.map((m) => (
            <MeetingRow key={m.id} meeting={m} open={() => openMeeting(m.id)} />
          ))}
        </div>
      ) : (
        <Empty
          title="No meeting records"
          copy="Your authorized meeting records will appear here."
          action={schedule}
          label="Schedule meeting"
        />
      )}
    </>
  );
}
function MeetingRow({ meeting, open }: { meeting: Meeting; open: () => void }) {
  return (
    <article className="meet-row">
      <div className="meet-date">
        <b>{new Date(meeting.startsAt).getDate()}</b>
        <span>
          {new Intl.DateTimeFormat(undefined, { month: "short" }).format(
            new Date(meeting.startsAt),
          )}
        </span>
      </div>
      <div>
        <h3>{meeting.title}</h3>
        <p>
          {when(meeting.startsAt)} · {meeting.location || "No location"}
        </p>
      </div>
      <span className="meet-status">{meeting.status || "Scheduled"}</span>
      <button onClick={open} aria-label={`Open ${meeting.title}`}>
        Open <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}
function ScheduleDialog({
  close,
  saved,
}: {
  close: () => void;
  saved: (m: Meeting) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [dialogRef, onDialogKeyDown] = useDialog<HTMLElement>(close);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const emails = String(f.get("participants") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const internal = String(f.get("internalParticipants") || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [email, userId] = line.split("|").map((part) => part.trim());
          return { email, userId };
        });
      const result = await api<{ meeting: Meeting }>("/api/meetings", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          title: f.get("title"),
          description: f.get("description"),
          startsAt: new Date(String(f.get("startsAt"))).toISOString(),
          endsAt: new Date(String(f.get("endsAt"))).toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: f.get("location"),
          recordingRequested: false,
          transcriptionRequested: false,
          participants: [...emails.map((email) => ({ email })), ...internal],
        }),
      });
      saved(result.meeting);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="meet-modal"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        ref={dialogRef}
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-title"
      >
        <header>
          <div>
            <small>NEW MEETING</small>
            <h2 id="schedule-title">Schedule meeting</h2>
          </div>
          <button onClick={close} aria-label="Close schedule form">
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Title
            <input name="title" required maxLength={200} />
          </label>
          <label>
            Description
            <textarea name="description" maxLength={5000} />
          </label>
          <div className="meet-fields">
            <label>
              Starts
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label>
              Ends
              <input name="endsAt" type="datetime-local" required />
            </label>
          </div>
          <label>
            Location
            <input name="location" maxLength={300} />
          </label>
          <label>
            External participant emails{" "}
            <small>Separate addresses with commas</small>
            <input
              name="participants"
              type="text"
              placeholder="person@example.com"
            />
          </label>
          <label>
            Internal participants{" "}
            <small>One per line as email | user UUID</small>
            <textarea
              name="internalParticipants"
              placeholder="colleague@example.com | 00000000-0000-0000-0000-000000000000"
            />
          </label>
          {error && (
            <p className="meet-form-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="meet-primary" disabled={busy}>
              {busy ? "Scheduling…" : "Schedule meeting"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
function MeetingDrawer({
  detail,
  close,
  refresh,
  enterLive,
}: {
  detail: MeetingDetail;
  close: () => void;
  refresh: () => void;
  enterLive: () => void;
}) {
  const { meeting, participants, preparation, actionItems, evidence } = detail;
  const [editing, setEditing] = useState(false);
  const [dialogRef, onDialogKeyDown] = useDialog<HTMLElement>(close);
  return (
    <div
      className="meet-drawer-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <aside
        ref={dialogRef}
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
        className="meet-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <header>
          <button onClick={close} aria-label="Close meeting details">
            ×
          </button>
          <small>{meeting.status || "MEETING"}</small>
          <h2 id="detail-title">{meeting.title}</h2>
          <p>
            {when(meeting.startsAt)} —{" "}
            {when(meeting.endsAt, { timeStyle: "short" })}
          </p>
        </header>
        <div className="meet-drawer-body">
          <section>
            <div className="meet-section-title">
              <h3>Preparation</h3>
              <button onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit"}
              </button>
            </div>
            {editing ? (
              <PreparationForm
                meetingId={meeting.id}
                value={preparation}
                done={() => {
                  setEditing(false);
                  void refresh();
                }}
              />
            ) : (
              <div className="meet-copy">
                <b>{preparation?.status || "Not started"}</b>
                <p>
                  {preparation?.brief || "No preparation brief has been added."}
                </p>
                {preparation?.agenda && (
                  <>
                    <small>AGENDA</small>
                    <p>{preparation.agenda}</p>
                  </>
                )}
              </div>
            )}
          </section>
          <section>
            <h3>Participants</h3>
            {participants.length ? (
              <ul className="meet-people">
                {participants.map((p, i) => (
                  <li key={p.id || p.email || i}>
                    <span>{initials(p.name || p.email)}</span>
                    <div>
                      <b>{p.name || p.email || "Participant"}</b>
                      <small>{p.organizationName || p.role || "Invited"}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meet-muted">No participants added.</p>
            )}
            <InvitationManager
              meetingId={meeting.id}
              participants={participants}
            />
          </section>
          <section>
            <div className="meet-section-title">
              <h3>Evidence</h3>
            </div>
            {evidence.length ? (
              <ul className="meet-evidence">
                {evidence.map((x) => (
                  <li key={x.id}>
                    <small>{x.kind}</small>
                    <p>{x.content}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meet-muted">No evidence captured yet.</p>
            )}
            <EvidenceForm meetingId={meeting.id} done={refresh} />
          </section>
          <section>
            <h3>Action items</h3>
            {actionItems.length ? (
              <ul className="meet-evidence">
                {actionItems.map((x) => (
                  <li key={x.id}>
                    <small>{x.status || "OPEN"}</small>
                    <p>{x.title}</p>
                    <small>
                      Assignee:{" "}
                      {participants.find(
                        (person) => person.userId === x.assigneeUserId,
                      )?.name ||
                        participants.find(
                          (person) => person.userId === x.assigneeUserId,
                        )?.email ||
                        x.assigneeUserId ||
                        "Unassigned"}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="meet-muted">No action items captured yet.</p>
            )}
            <ActionForm
              meetingId={meeting.id}
              participants={participants}
              evidence={evidence}
              done={refresh}
            />
          </section>
        </div>
        <footer>
          <p>
            Live audio, video, recording, and transcription require a configured
            media provider. This workspace does not claim those capabilities.
          </p>
          <button className="meet-primary" onClick={enterLive}>
            Open collaboration workspace
          </button>
        </footer>
      </aside>
    </div>
  );
}
function PreparationForm({
  meetingId,
  value,
  done,
}: {
  meetingId: string;
  value: Preparation;
  done: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/meetings/${meetingId}/preparation`, {
        method: "PUT",
        body: JSON.stringify({
          status: "READY",
          agenda: f.get("agenda"),
          objectives: f.get("objectives"),
          brief: f.get("brief"),
        }),
      });
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="meet-prep-form" onSubmit={submit}>
      <label>
        Brief
        <textarea name="brief" defaultValue={value?.brief || ""} />
      </label>
      <label>
        Agenda
        <textarea name="agenda" defaultValue={value?.agenda || ""} />
      </label>
      <label>
        Objectives
        <textarea name="objectives" defaultValue={value?.objectives || ""} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="meet-primary" disabled={busy}>
        {busy ? "Saving…" : "Save preparation"}
      </button>
    </form>
  );
}
type Invitation = {
  id: string;
  participantId: string;
  email: string;
  name?: string | null;
  expiresAt: string;
  deliveryStatus: string;
  createdAt: string;
};
function InvitationManager({
  meetingId,
  participants,
}: {
  meetingId: string;
  participants: Participant[];
}) {
  const [items, setItems] = useState<Invitation[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [joinUrl, setJoinUrl] = useState(""),
    [copied, setCopied] = useState("");
  const load = useCallback(async () => {
    try {
      setItems(
        (
          await api<{ invitations: Invitation[] }>(
            `/api/meetings/${meetingId}/invitations`,
          )
        ).invitations,
      );
    } catch (issue) {
      setError((issue as Error).message);
    }
  }, [meetingId]);
  useEffect(() => {
    let active = true;
    api<{ invitations: Invitation[] }>(
      `/api/meetings/${meetingId}/invitations`,
    ).then(
      (result) => {
        if (active) setItems(result.invitations);
      },
      (issue) => {
        if (active) setError((issue as Error).message);
      },
    );
    return () => {
      active = false;
    };
  }, [meetingId]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setCopied("");
    setJoinUrl("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<{
        invitation: Invitation & { joinUrl: string };
      }>(`/api/meetings/${meetingId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ participantId: data.get("participantId") }),
      });
      setJoinUrl(result.invitation.joinUrl);
      await load();
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/meetings/${meetingId}/invitations`, {
        method: "DELETE",
        body: JSON.stringify({ invitationId: id }),
      });
      await load();
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="meet-create">
      <summary>Manage prejoin access</summary>
      <p className="meet-muted">
        Creates a context-only prejoin link. RoleField does not deliver the link
        or provide media access.
      </p>
      <form onSubmit={create}>
        <label>
          Participant
          <select name="participantId" required>
            <option value="">Choose participant</option>
            {participants
              .filter((person) => person.id)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name || person.email || person.id}
                </option>
              ))}
          </select>
        </label>
        <button className="meet-primary" disabled={busy}>
          {busy ? "Creating…" : "Create prejoin link"}
        </button>
      </form>
      {joinUrl && (
        <div className="meet-copy-link">
          <label>
            New prejoin link
            <input readOnly value={joinUrl} />
          </label>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(joinUrl);
                setCopied("Copied");
              } catch {
                setCopied("Select and copy the link manually.");
              }
            }}
          >
            Copy
          </button>
        </div>
      )}
      {copied && (
        <p role="status" className="meet-success">
          {copied}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {items.length > 0 && (
        <ul className="meet-invitations">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <b>{item.name || item.email}</b>
                <small>
                  {item.deliveryStatus} · Expires {when(item.expiresAt)}
                </small>
              </div>
              <button disabled={busy} onClick={() => void revoke(item.id)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
function EvidenceForm({
  meetingId,
  done,
}: {
  meetingId: string;
  done: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api(`/api/meetings/${meetingId}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          kind: data.get("kind"),
          content: data.get("content"),
          visibility: data.get("visibility"),
        }),
      });
      form.reset();
      await done();
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="meet-create">
      <summary>Add evidence</summary>
      <form onSubmit={submit}>
        <label>
          Type
          <input
            name="kind"
            required
            maxLength={60}
            placeholder="Decision, note, or transcript excerpt"
          />
        </label>
        <label>
          Evidence
          <textarea name="content" required maxLength={100000} />
        </label>
        <label>
          Visibility
          <select name="visibility" defaultValue="ORGANIZATION_PRIVATE">
            <option value="ORGANIZATION_PRIVATE">My organization</option>
            <option value="USER_PRIVATE">Only me</option>
            <option value="PUBLIC_MEETING">Meeting participants</option>
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="meet-primary" disabled={busy}>
          {busy ? "Saving…" : "Save evidence"}
        </button>
      </form>
    </details>
  );
}
function ActionForm({
  meetingId,
  participants,
  evidence,
  done,
}: {
  meetingId: string;
  participants: Participant[];
  evidence: Evidence[];
  done: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const internal = participants.filter((person) => person.userId);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const due = String(data.get("dueAt") || "");
      await api(`/api/meetings/${meetingId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description"),
          assigneeUserId: data.get("assigneeUserId") || undefined,
          dueAt: due ? new Date(due).toISOString() : undefined,
          visibility: "ORGANIZATION_PRIVATE",
          evidenceId: data.get("evidenceId") || undefined,
        }),
      });
      form.reset();
      await done();
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="meet-create">
      <summary>Add action item</summary>
      <form onSubmit={submit}>
        <label>
          Action
          <input name="title" required maxLength={300} />
        </label>
        <label>
          Description
          <textarea name="description" maxLength={10000} />
        </label>
        <label>
          Assignee
          <select name="assigneeUserId">
            <option value="">Unassigned</option>
            {internal.map((person) => (
              <option key={person.userId!} value={person.userId!}>
                {person.name || person.email || person.userId}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due date
          <input name="dueAt" type="datetime-local" />
        </label>
        <label>
          Supporting evidence
          <select name="evidenceId">
            <option value="">None</option>
            {evidence.map((item) => (
              <option key={item.id} value={item.id}>
                {item.kind}: {item.content.slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="meet-primary" disabled={busy}>
          {busy ? "Saving…" : "Save action"}
        </button>
      </form>
    </details>
  );
}
function ActionsPanel({
  actions,
  hasSelection,
  onSelectMeeting,
  update,
}: {
  actions: ActionItem[];
  hasSelection: boolean;
  onSelectMeeting: () => void;
  update: (a: ActionItem, s: string) => Promise<void>;
}) {
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const complete = async (action: ActionItem) => {
    if (pending) return;
    setPending(action.id);
    setError("");
    try {
      await update(action, "COMPLETED");
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setPending("");
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="FOLLOW-THROUGH"
        title="Action items"
        description="Commitments captured against the meeting record and assigned a clear status."
      />
      {error && (
        <div className="meet-alert" role="alert">
          {error}
        </div>
      )}
      {!hasSelection ? (
        <Empty
          title="Choose a meeting"
          copy="Open a meeting record first to review and update its action items."
          action={onSelectMeeting}
          label="Browse meetings"
        />
      ) : actions.length ? (
        <div className="meet-actions">
          {actions.map((a) => (
            <article key={a.id}>
              <button
                disabled={Boolean(pending)}
                aria-label={`Complete ${a.title}`}
                onClick={() => void complete(a)}
              >
                {pending === a.id ? "…" : "✓"}
              </button>
              <div>
                <h2>{a.title}</h2>
                <p>{a.description || "No description"}</p>
                <small>
                  {a.assigneeUserId || "Unassigned"}
                  {a.dueAt
                    ? ` · Due ${when(a.dueAt, { dateStyle: "medium" })}`
                    : ""}
                </small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="No open actions"
          copy="This meeting has no open action items."
        />
      )}
    </>
  );
}
function LiveShell({
  detail,
  close,
  refresh,
}: {
  detail: MeetingDetail;
  close: () => void;
  refresh: () => void;
}) {
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [panelOpen, setPanelOpen] = useState(false);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  const [dialogRef, onDialogKeyDown] = useDialog<HTMLDivElement>(close);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/meetings/${detail.meeting.id}/nudges`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ message }),
      });
      setMessage("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      ref={dialogRef}
      onKeyDown={onDialogKeyDown}
      tabIndex={-1}
      className={`meet-live ${panelOpen ? "panel-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-title"
    >
      <header>
        <div>
          <small>COLLABORATION WORKSPACE</small>
          <h1 id="live-title">{detail.meeting.title}</h1>
        </div>
        <div>
          <button
            ref={panelToggleRef}
            className="meet-panel-toggle"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen(!panelOpen)}
          >
            Team notes
          </button>
          <button onClick={close}>Leave workspace</button>
        </div>
      </header>
      <main>
        <section className="meet-live-stage">
          <div className="meet-live-notice">
            <span aria-hidden="true">◌</span>
            <h2>Media is not configured</h2>
            <p>
              This workspace supports the persisted meeting record. Audio,
              video, recording, and transcription remain unavailable until a
              media provider is configured.
            </p>
          </div>
          <div className="meet-participant-grid">
            {detail.participants.map((p, i) => (
              <article key={p.id || p.email || i}>
                <span>{initials(p.name || p.email)}</span>
                <b>{p.name || p.email || "Participant"}</b>
                <small>{p.organizationName || p.role || "Invited"}</small>
              </article>
            ))}
          </div>
        </section>
        <aside aria-label="Private organization notes">
          <header>
            <button
              className="meet-panel-close"
              onClick={() => {
                setPanelOpen(false);
                requestAnimationFrame(() => panelToggleRef.current?.focus());
              }}
              aria-label="Close team notes"
            >
              ×
            </button>
            <small>ORGANIZATION NOTES</small>
            <h2>Private nudges</h2>
            <p>Visible only within your organization.</p>
          </header>
          <div className="meet-nudges">
            {detail.nudges.length ? (
              detail.nudges.map((n) => (
                <article key={n.id}>
                  <b>
                    {n.createdBy
                      ? `Organization member · ${n.createdBy}`
                      : "Organization member"}
                  </b>
                  <p>{n.message}</p>
                  {n.createdAt && <time>{when(n.createdAt)}</time>}
                </article>
              ))
            ) : (
              <p className="meet-muted">No nudges yet.</p>
            )}
          </div>
          <form onSubmit={send}>
            <label htmlFor="nudge">Send a private nudge</label>
            <textarea
              id="nudge"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={1000}
            />
            {error && <p role="alert">{error}</p>}
            <button className="meet-primary" disabled={busy}>
              {busy ? "Sending…" : "Send nudge"}
            </button>
          </form>
        </aside>
      </main>
    </div>
  );
}
