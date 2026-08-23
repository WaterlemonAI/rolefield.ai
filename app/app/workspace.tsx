"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Principal } from "@/lib/olv/session";
type Folder = "Inbox" | "Sent" | "Drafts" | "Archive" | "Trash";
type Mailbox = { id: string; name: string; address: string; type: string };
type Person = { kind: string; email: string; name?: string };
type Thread = {
  id: string;
  subject: string;
  latest_at: string;
  message_id: string;
  text_body: string;
  html_body: string | null;
  direction: string;
  state: string;
  received_at: string | null;
  sent_at: string | null;
  internet_message_id: string;
  in_reply_to: string | null;
  reference_ids: string[];
  unread: boolean;
  participants: Person[];
  message_count: number;
  attachment_count: number;
  draft?: boolean;
  to_list?: { email: string }[];
  cc_list?: { email: string }[];
  bcc_list?: { email: string }[];
  attachments?: { id:string;filename:string;contentType:string;size:number }[];
  conversation?: { id:string;text_body:string;html_body:string|null;sent_at:string|null;received_at:string|null;state:string;direction:string;participants:Person[];attachments?:{id:string;filename:string;contentType:string;size:number}[] }[];
};
type ComposeData = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  text: string;
  threadId?: string;
  inReplyTo?: string;
  references: string[];
};
const emptyCompose: ComposeData = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  text: "",
  references: [],
};
function parseAddresses(value: string) {
  return value
    .split(",")
    .map((email) => ({ email: email.trim().toLowerCase() }))
    .filter((entry) => entry.email);
}
const folders: Folder[] = ["Inbox", "Sent", "Drafts", "Archive", "Trash"];
function label(t: Thread) {
  const p = t.participants?.find(
    (x) => x.kind === (t.direction === "INBOUND" ? "FROM" : "TO"),
  );
  return p?.name || p?.email || "Unknown sender";
}
export function MailWorkspace({ principal }: { principal: Principal }) {
  const [folder, setFolder] = useState<Folder>("Inbox"),
    [mailboxes, setMailboxes] = useState<Mailbox[]>([]),
    [mailboxId, setMailboxId] = useState(""),
    [threads, setThreads] = useState<Thread[]>([]),
    [selected, setSelected] = useState(""),
    [queryText, setQueryText] = useState(""),
    [search, setSearch] = useState(""),
    [compose, setCompose] = useState(false),
    [composeData, setComposeData] = useState<ComposeData>(emptyCompose),
    [draftId, setDraftId] = useState(""),
    [draftStatus, setDraftStatus] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ folder });
      if (mailboxId) params.set("mailboxId", mailboxId);
      if (search) params.set("q", search);
      const response = await fetch(`/api/olv/data?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMailboxes(data.mailboxes || []);
      if (!mailboxId && data.mailboxes?.[0]) setMailboxId(data.mailboxes[0].id);
      setThreads(data.threads || []);
      setSelected((current) =>
        (data.threads || []).some((t: Thread) => t.message_id === current)
          ? current
          : data.threads?.[0]?.message_id || "",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load mail.");
    } finally {
      setLoading(false);
    }
  }, [folder, mailboxId, search]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const active = useMemo(
    () => threads.find((t) => t.message_id === selected),
    [threads, selected],
  );
  const mailbox = mailboxes.find((m) => m.id === mailboxId);
  function openCompose(mode: "new" | "reply" | "replyAll" | "forward" = "new") {
    if (!active || mode === "new") setComposeData(emptyCompose);
    else if (mode === "forward")
      setComposeData({
        ...emptyCompose,
        subject: active.subject.toLowerCase().startsWith("fwd:")
          ? active.subject
          : `Fwd: ${active.subject}`,
        text: `\n\n---------- Forwarded message ----------\n${active.text_body}`,
      });
    else {
      const from =
        active.participants.find((person) => person.kind === "FROM")?.email ||
        "";
      const everyone = active.participants
        .filter((person) => ["FROM", "TO", "CC"].includes(person.kind))
        .map((person) => person.email)
        .filter((address) => address !== mailbox?.address);
      setComposeData({
        to: mode === "replyAll" ? [...new Set(everyone)].join(", ") : from,
        cc: "",
        bcc: "",
        subject: active.subject.toLowerCase().startsWith("re:")
          ? active.subject
          : `Re: ${active.subject}`,
        text: "",
        threadId: active.id,
        inReplyTo: active.internet_message_id,
        references: [...active.reference_ids, active.internet_message_id],
      });
    }
    setDraftId("");
    setDraftStatus("");
    setCompose(true);
  }
  useEffect(() => {
    if (
      !compose ||
      !mailboxId ||
      !(composeData.to || composeData.subject || composeData.text)
    )
      return;
    const timer = window.setTimeout(async () => {
      const response = await fetch("/api/olv/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          id: draftId || undefined,
          mailboxId,
          to: parseAddresses(composeData.to),
          cc: parseAddresses(composeData.cc),
          bcc: parseAddresses(composeData.bcc),
          subject: composeData.subject,
          text: composeData.text,
          threadId: composeData.threadId,
          inReplyTo: composeData.inReplyTo,
          references: composeData.references,
        }),
      });
      if (response.ok) {
        const body = await response.json();
        setDraftId(body.id);
        setDraftStatus("Saved");
      } else setDraftStatus("Draft save failed");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [compose, composeData, draftId, mailboxId]);
  async function logout() {
    await fetch("/api/olv/logout", { method: "POST" });
    location.assign("/login");
  }
  async function changeState(action: "archive" | "trash") {
    if (!active) return;
    await fetch("/api/olv/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "state",
        mailboxId,
        messageId: active.message_id,
        archived: action === "archive" || undefined,
        trashed: action === "trash" || undefined,
      }),
    });
    await load();
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/olv/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        mailboxId,
        to: parseAddresses(composeData.to),
        cc: parseAddresses(composeData.cc),
        bcc: parseAddresses(composeData.bcc),
        subject: composeData.subject,
        text: composeData.text,
        threadId: composeData.threadId,
        inReplyTo: composeData.inReplyTo,
        references: composeData.references,
        draftId: draftId || undefined,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error);
      return;
    }
    setCompose(false);
    setDraftId("");
    setComposeData(emptyCompose);
    setFolder("Sent");
  }
  async function uploadAttachment(file: File) {
    if (!draftId) {
      setDraftStatus(
        "Type a subject or message first so the draft can be saved.",
      );
      return;
    }
    setDraftStatus("Uploading attachment…");
    const response = await fetch("/api/olv/attachments", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Filename": encodeURIComponent(file.name),
        "X-Mailbox-Id": mailboxId,
        "X-Draft-Id": draftId,
      },
      body: file,
    });
    const body = await response.json();
    setDraftStatus(
      response.ok
        ? `${body.filename} attached`
        : body.error || "Attachment upload failed",
    );
  }
  async function discardDraft() {
    if (draftId) await fetch("/api/olv/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discard", mailboxId, draftId }) });
    setCompose(false); setDraftId(""); setComposeData(emptyCompose);
    if (folder === "Drafts") await load();
  }
  async function downloadAttachment(id:string){const response=await fetch(`/api/olv/attachments?id=${encodeURIComponent(id)}`);const body=await response.json();if(response.ok)location.assign(body.url);else setError(body.error||"Unable to open attachment.");}
  return (
    <main className="olv-app">
      <aside className="olv-sidebar">
        <div className="olv-app-brand">
          <span>O</span>
          <div>
            <b>OLV</b>
            <small>by RoleField</small>
          </div>
        </div>
        <button
          className="olv-compose"
          disabled={!mailbox}
          onClick={() => openCompose("new")}
        >
          <span>＋</span> Compose
        </button>
        <nav aria-label="Mail folders">
          {folders.map((name) => (
            <button
              key={name}
              className={folder === name ? "active" : ""}
              onClick={() => {
                setFolder(name);
                setSelected("");
              }}
            >
              <i>
                {name === "Inbox"
                  ? "⌂"
                  : name === "Sent"
                    ? "↗"
                    : name === "Drafts"
                      ? "□"
                      : name === "Archive"
                        ? "▱"
                        : "⌫"}
              </i>
              {name}
            </button>
          ))}
        </nav>
        <div className="olv-storage">
          <span>
            <i />
          </span>
          <small>SECURE MAIL WORKSPACE</small>
          <p>SES transport · private S3 objects</p>
        </div>
        <div className="olv-user">
          <span>{principal.name[0]?.toUpperCase()}</span>
          <div>
            <b>{principal.name}</b>
            <small>{principal.email}</small>
          </div>
          <button onClick={logout} aria-label="Sign out">
            ↪
          </button>
        </div>
      </aside>
      <section className="olv-mail">
        <header className="olv-topbar">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(queryText);
            }}
          >
            <label>
              <span>⌕</span>
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Search sender, subject or message"
                aria-label="Search mail"
              />
            </label>
          </form>
          <div>
            {mailboxes.length > 0 && (
              <select
                value={mailboxId}
                onChange={(e) => setMailboxId(e.target.value)}
                aria-label="Current mailbox"
              >
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.address}
                  </option>
                ))}
              </select>
            )}
            <a href="/app/admin">Admin</a>
          </div>
        </header>
        <div className="olv-mail-head">
          <div>
            <p>
              MAILBOX / <b>{folder.toUpperCase()}</b>
            </p>
            <h1>{folder}</h1>
          </div>
          <div>
            <button onClick={load} aria-label="Refresh">
              ↻
            </button>
          </div>
        </div>
        {error && (
          <div className="olv-api-error" role="alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        <div className="olv-content">
          <section className="olv-list">
            <div className="olv-list-tools">
              <span>
                {loading ? "Loading…" : `${threads.length} conversations`}
              </span>
            </div>
            {!loading &&
              threads.map((t) => (
                <button
                  key={t.message_id}
                  className={`${selected === t.message_id ? "selected" : ""} ${t.unread ? "unread" : ""}`}
                  onClick={() => {
                    if (t.draft) {
                      setDraftId(t.id);
                      setComposeData({
                        to: (t.to_list || []).map((x) => x.email).join(", "),
                        cc: (t.cc_list || []).map((x) => x.email).join(", "),
                        bcc: (t.bcc_list || []).map((x) => x.email).join(", "),
                        subject: t.subject === "(no subject)" ? "" : t.subject,
                        text: t.text_body,
                        references: [],
                      });
                      setCompose(true);
                    } else setSelected(t.message_id);
                  }}
                >
                  <i />
                  <div>
                    <header>
                      <b>{label(t)}</b>
                      <time>
                        {new Date(t.latest_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </header>
                    <strong>
                      {t.subject}
                      {Number(t.message_count) > 1 && (
                        <small>{t.message_count}</small>
                      )}
                    </strong>
                    <p>{t.text_body}</p>
                  </div>
                </button>
              ))}
            {!loading && !threads.length && (
              <div className="olv-empty">
                <span>□</span>
                <b>{mailbox ? "No messages here" : "No mailbox access"}</b>
                <p>
                  {mailbox
                    ? "This folder is clear."
                    : "Ask an administrator to create or share a mailbox."}
                </p>
              </div>
            )}
          </section>
          <article className="olv-reader">
            {active ? (
              <>
                <header>
                  <div>
                    <p>CONVERSATION</p>
                    <h2>{active.subject}</h2>
                    <span>
                      {active.message_count} message
                      {Number(active.message_count) === 1 ? "" : "s"} ·{" "}
                      {active.state}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => changeState("archive")}
                      title="Archive"
                    >
                      ▱
                    </button>
                    <button onClick={() => changeState("trash")} title="Trash">
                      ⌫
                    </button>
                  </div>
                </header>
                {(active.conversation?.length ? active.conversation : [active]).map((message) => <section className="olv-message" key={message.id || active.message_id}>
                  <div className="olv-avatar">{label(active)[0]}</div>
                  <header>
                    <div>
                      <b>{label(active)}</b>
                      <span>
                        {message.participants
                          ?.filter((p) => p.kind === "FROM")
                          .map((p) => p.email)
                          .join(", ")}
                      </span>
                    </div>
                    <time>
                      {new Date(
                        message.received_at ||
                          message.sent_at ||
                          active.latest_at,
                      ).toLocaleString()}
                    </time>
                  </header>
                  {message.html_body ? (
                    <div
                      className="olv-email-html"
                      dangerouslySetInnerHTML={{ __html: message.html_body }}
                    />
                  ) : (
                    <p>{message.text_body}</p>
                  )}
                  {message.attachments?.length ? <div className="olv-message-attachments">{message.attachments.map(attachment=><button key={attachment.id} onClick={()=>void downloadAttachment(attachment.id)}>▱ {attachment.filename}<small>{Math.ceil(Number(attachment.size)/1024)} KB</small></button>)}</div> : null}
                </section>)}
                <footer>
                  <button onClick={() => openCompose("reply")}>↩ Reply</button>
                  <button onClick={() => openCompose("replyAll")}>
                    ⇉ Reply all
                  </button>
                  <button onClick={() => openCompose("forward")}>
                    ↗ Forward
                  </button>
                </footer>
              </>
            ) : (
              <div className="olv-empty reader">
                <span>◇</span>
                <b>Select a conversation</b>
                <p>Choose a message to read it here.</p>
              </div>
            )}
          </article>
        </div>
      </section>
      {compose && mailbox && (
        <div className="olv-compose-modal">
          <form onSubmit={send}>
            <header>
              <b>New message</b>
              <button type="button" onClick={() => setCompose(false)}>
                ×
              </button>
            </header>
            <label>
              From
              <input readOnly value={mailbox.address} />
            </label>
            <label>
              To
              <input
                name="to"
                type="text"
                required
                placeholder="name@company.com"
                value={composeData.to}
                onChange={(e) =>
                  setComposeData({ ...composeData, to: e.target.value })
                }
              />
            </label>
            <label>
              Cc
              <input
                name="cc"
                type="text"
                value={composeData.cc}
                onChange={(e) =>
                  setComposeData({ ...composeData, cc: e.target.value })
                }
              />
            </label>
            <label>
              Bcc
              <input
                name="bcc"
                type="text"
                value={composeData.bcc}
                onChange={(e) =>
                  setComposeData({ ...composeData, bcc: e.target.value })
                }
              />
            </label>
            <div className="olv-compose-subject">
              <input
                name="subject"
                required
                placeholder="Subject"
                value={composeData.subject}
                onChange={(e) =>
                  setComposeData({ ...composeData, subject: e.target.value })
                }
              />
            </div>
            <textarea
              name="text"
              required
              placeholder="Write a message…"
              value={composeData.text}
              onChange={(e) =>
                setComposeData({ ...composeData, text: e.target.value })
              }
            />
            <footer>
              <button type="submit">Send</button>
              <label className="olv-attach">
                Attach
                <input
                  type="file"
                  disabled={!draftId}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadAttachment(file);
                  }}
                />
              </label>
              <span>{draftStatus || "Queued securely for SES delivery"}</span>
              <button type="button" onClick={() => void discardDraft()}>
                ⌫
              </button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
