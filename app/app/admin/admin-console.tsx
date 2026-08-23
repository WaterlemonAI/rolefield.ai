"use client";
import { FormEvent, useEffect, useState } from "react";
type Domain = {
  id: string;
  name: string;
  state: string;
  last_checked_at: string | null;
  failure_reason: string | null;
  verification?: LiveStatus | null;
  records: {
    id: string;
    type: string;
    host: string;
    value: string;
    purpose: string;
    required: boolean;
    verified: boolean;
  }[];
};
type Box = {
  id: string;
  name: string;
  address: string;
  type: string;
  department: string | null;
  member_count: number;
  active: boolean;
};
type User = {
  id: string;
  name: string;
  recovery_email: string;
  activated_at: string | null;
  role: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  last_login_at: string | null;
  suspension_reason: string | null;
  modules: Module[];
  mailbox_address: string | null;
};
type Department = { id: string; name: string };
type Module = "MAILBOX" | "VOICE" | "SOCIAL" | "DOCUMENTS";
const ALL_MODULES: Module[] = ["MAILBOX", "VOICE", "SOCIAL", "DOCUMENTS"];
type LiveStatus = { state: string; identity: boolean; dkim: boolean; requiredDns: boolean; health: "GREEN" | "AMBER" | "RED"; checkedAt: string };
export function AdminConsole() {
  const [domains, setDomains] = useState<Domain[]>([]),
    [boxes, setBoxes] = useState<Box[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [departments, setDepartments] = useState<Department[]>([]),
    [live, setLive] = useState<Record<string, LiveStatus>>({}),
    [checking, setChecking] = useState<string[]>([]),
    [creatingMailbox, setCreatingMailbox] = useState(false),
    [message, setMessage] = useState("");
  const domainIds = domains.map((domain) => domain.id).join(",");
  async function load() {
    const [d, m, a] = await Promise.all([
      fetch("/api/olv/domains").then((r) => r.json()),
      fetch("/api/olv/mailboxes").then((r) => r.json()),
      fetch("/api/olv/admin").then((r) => r.json()),
    ]);
    setDomains(d.domains || []);
    setBoxes(m.mailboxes || []);
    setUsers(a.users || []);
    setDepartments(a.departments || []);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!domains.length) return;
    const poll = () => domains.forEach((domain) => void verify(domain.id, true));
    const initial = window.setTimeout(poll, 500);
    const interval = window.setInterval(poll, 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
    // Domain IDs intentionally control the polling lifecycle; status-only reloads must not reset the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainIds]);
  async function verify(id: string, silent = false) {
    setChecking((current) => current.includes(id) ? current : [...current, id]);
    if (!silent) setMessage("Running a live check against authoritative DNS and AWS SES…");
    const r = await fetch("/api/olv/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", domainId: id }),
    });
    const b = await r.json().catch(() => ({ error: "Live verification failed." }));
    if (r.ok) setLive((current) => ({ ...current, [id]: { ...b, checkedAt: new Date().toISOString() } }));
    if (!silent || !r.ok) setMessage(r.ok ? `Live verification complete: ${b.state.replace("_", " ")}` : b.error);
    setChecking((current) => current.filter((value) => value !== id));
    await load();
  }
  async function addDomain(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const domain = String(new FormData(form).get("domain"));
    setMessage(`Connecting ${domain} to AWS SES…`);
    const response = await fetch("/api/olv/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", domain }) });
    const body = await response.json().catch(() => ({ error: "Unable to add domain." }));
    setMessage(response.ok ? `${body.name} connected. Add the generated DNS records below.` : body.error);
    if (response.ok) form.reset();
    await load();
  }
  async function removeDomain(domain: Domain) {
    if (!window.confirm(`Remove ${domain.name} from this workspace? This is blocked while any mailbox address still uses it.`)) return;
    const response = await fetch("/api/olv/domains", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainId: domain.id }) });
    const body = await response.json().catch(() => ({ error: "Unable to remove domain." }));
    setMessage(response.ok ? `${domain.name} removed from this workspace.` : body.error);
    if (response.ok) setLive((current) => { const next = { ...current }; delete next[domain.id]; return next; });
    await load();
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    setCreatingMailbox(true);
    setMessage("Creating mailbox…");
    const formData = new FormData(formElement);
    const form = Object.fromEntries(formData);
    try {
      const r = await fetch("/api/olv/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          departmentId: form.departmentId || null,
          modules: formData.getAll("modules"),
        }),
      });
      const b = await r.json().catch(() => ({ error: "Unable to create mailbox." }));
      setMessage(r.ok ? `Mailbox ${b.address} created.${b.deliveryStatus === "SENT" ? " Password setup was sent to the recovery email." : b.deliveryStatus === "FAILED" ? " The account was saved, but invitation delivery failed; use Resend invitation." : ""}${b.active ? " It is ready to use." : " It will activate automatically when the domain becomes mail-ready."}` : b.error);
      if (r.ok) formElement.reset();
      await load();
    } catch {
      setMessage("Unable to create the mailbox. Check your connection and try again.");
    } finally {
      setCreatingMailbox(false);
    }
  }
  async function createDepartment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name"));
    const response = await fetch("/api/olv/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "department", name }),
    });
    const body = await response.json();
    setMessage(response.ok ? `Department ${name} saved.` : body.error);
    if (response.ok) e.currentTarget.reset();
    await load();
  }
  async function changeMember(mailboxId: string, value: string) {
    if (!value) return;
    const [action, userId] = value.split(":");
    const response = await fetch("/api/olv/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, mailboxId, userId }),
    });
    const body = await response.json();
    setMessage(response.ok ? "Shared mailbox membership updated." : body.error);
    await load();
  }
  async function employeeAction(user: User, action: "resendInvitation" | "suspendUser" | "reactivateUser" | "revokeSessions" | "updateModules", modules?: Module[]) {
    const response = await fetch("/api/olv/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId: user.id, ...(modules ? { modules } : {}) }) });
    const body = await response.json().catch(() => ({ error: "Unable to update employee." }));
    setMessage(response.ok ? action === "resendInvitation" ? `Invitation ${body.deliveryStatus === "SENT" ? "sent" : "could not be delivered"} to ${user.recovery_email}.` : "Employee access updated." : body.error);
    await load();
  }
  return (
    <main className="olv-admin">
      <header>
        <a href="/app">← Apps</a>
        <div>
          <p>OLV ADMINISTRATION</p>
          <h1>Workspace control</h1>
        </div>
      </header>
      {message && <p className="olv-admin-status">{message}</p>}
      <section>
        <div className="olv-admin-title">
          <div>
            <p>DOMAINS</p>
            <h2>Mail readiness</h2>
          </div>
          <form className="olv-add-domain" onSubmit={addDomain}>
            <label>Add another domain<input name="domain" required placeholder="company.com" /></label>
            <button className="button dark">Connect domain</button>
          </form>
        </div>
        <p className="olv-live-note"><i /> Green means every required DNS and AWS check passed. Amber means partially connected. Red means no required connection was found. Checks use authoritative DNS and AWS SES every 30 seconds.</p>
        {domains.map((d) => (
          <details className={`olv-domain health-${(live[d.id]?.health || d.verification?.health || "RED").toLowerCase()}`} key={d.id}>
            <summary>
              <div>
                <b>{d.name}</b>
                <span className={`state health-${(live[d.id]?.health || d.verification?.health || "RED").toLowerCase()}`}>
                  {live[d.id]?.health || d.verification?.health || "RED"}
                </span>
                <small className="olv-domain-live"><i className={checking.includes(d.id) ? "checking" : live[d.id]?.state === "MAIL_READY" ? "ready" : ""} />{checking.includes(d.id) ? "Checking live…" : live[d.id] ? `Checked ${new Date(live[d.id].checkedAt).toLocaleTimeString()} · SES identity ${live[d.id].identity ? "verified" : "pending"} · DKIM ${live[d.id].dkim ? "verified" : "pending"} · DNS ${live[d.id].requiredDns ? "complete" : "pending"}` : d.last_checked_at ? `Last checked ${new Date(d.last_checked_at).toLocaleString()}` : "Waiting for first live check"}</small>
              </div>
              <span>Expand DNS details</span>
            </summary>
            <div className="olv-domain-actions"><button onClick={() => void verify(d.id)} disabled={checking.includes(d.id)}>{checking.includes(d.id) ? "Testing connection…" : "Test connection"}</button><button className="danger" onClick={() => void removeDomain(d)}>Remove</button></div>
            <div className="olv-dns-table">
              <b>TYPE</b>
              <b>HOST</b>
              <b>VALUE</b>
              <b>PURPOSE</b>
              {d.records?.map((r) => (
                <span key={r.id} className="olv-dns-row">
                  <code>{r.type}</code>
                  <code>{r.host}</code>
                  <code>{r.value}</code>
                  <small>
                    {r.purpose}
                    <i>
                      {r.verified
                        ? "Verified"
                        : r.required
                          ? "Required · Pending"
                          : "Recommended"}
                    </i>
                  </small>
                </span>
              ))}
            </div>
          </details>
        ))}
      </section>
      <section>
        <div className="olv-admin-title">
          <div>
            <p>ORGANIZATION</p>
            <h2>Departments and users</h2>
          </div>
        </div>
        <div className="olv-admin-grid">
          <form onSubmit={createDepartment}>
            <h3>Create department</h3>
            <label>
              Department name
              <input name="name" required list="department-suggestions" />
            </label>
            <datalist id="department-suggestions">
              <option>Sales</option>
              <option>Marketing</option>
              <option>Finance</option>
              <option>Customer Support</option>
              <option>Operations</option>
              <option>Management</option>
              <option>Other</option>
            </datalist>
            <button className="button dark">Save department</button>
            <div className="olv-department-tags">
              {departments.map((d) => (
                <span key={d.id}>{d.name}</span>
              ))}
            </div>
          </form>
          <div className="olv-box-list">
            {users.map((user) => (
              <article key={user.id}>
                <span>{user.name[0]}</span>
                <div>
                  <b>{user.name}</b>
                  <small>{user.recovery_email}{user.mailbox_address ? ` · ${user.mailbox_address}` : ""}</small>
                  <small>{user.modules?.length ? user.modules.join(" · ") : "No modules enabled"}</small>
                </div>
                <em>{user.role === "ADMIN" ? "ADMIN" : `EMPLOYEE · ${user.status}`}</em>
                {user.role !== "ADMIN" && <div className="olv-user-actions">
                  {user.status === "INVITED" && <button onClick={() => void employeeAction(user, "resendInvitation")}>Resend invitation</button>}
                  {user.status === "SUSPENDED" ? <button onClick={() => void employeeAction(user, "reactivateUser")}>Reactivate</button> : <button onClick={() => void employeeAction(user, "suspendUser")}>Suspend</button>}
                  <button onClick={() => void employeeAction(user, "revokeSessions")}>Revoke sessions</button>
                  <details><summary>Edit modules</summary>{ALL_MODULES.map((module) => <label key={module}><input type="checkbox" defaultChecked={user.modules?.includes(module)} onChange={(event) => { const next = event.target.checked ? [...new Set([...(user.modules || []), module])] : (user.modules || []).filter((value) => value !== module); void employeeAction(user, "updateModules", next); }} />{module}</label>)}</details>
                </div>}
              </article>
            ))}
          </div>
        </div>
      </section>
      <section>
        <div className="olv-admin-title">
          <div>
            <p>MAILBOXES</p>
            <h2>People and shared addresses</h2>
          </div>
        </div>
        <div className="olv-admin-grid">
          <form onSubmit={create}>
            <h3>Create mailbox</h3>
            <label>
              Display name
              <input name="name" required />
            </label>
            <label>
              Local part
              <input name="localPart" required placeholder="sales" />
            </label>
            <label>
              Domain
              <select name="domainId" required>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.state === "MAIL_READY" ? "ready" : "connection pending"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select name="type" defaultValue="INDIVIDUAL">
                <option>INDIVIDUAL</option>
                <option>SHARED</option>
              </select>
            </label>
            <label>
              Recovery email (required for an employee)
              <input name="recoveryEmail" type="email" placeholder="employee@gmail.com" />
              <small>The secure password setup link is sent here. It is not the new RoleField mailbox address.</small>
            </label>
            <label>
              Department
              <select name="departmentId">
                <option value="">None</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset><legend>Employee modules</legend>{ALL_MODULES.map((module) => <label key={module}><input type="checkbox" name="modules" value={module} defaultChecked={module === "MAILBOX"} />{module}</label>)}</fieldset>
            <p className="olv-mailbox-owner-note">For an individual mailbox, RoleField creates an invitation-only employee login and emails a one-time password setup link to the recovery address. Shared mailboxes remain managed by assigned members.</p>
            <button className="button dark" disabled={creatingMailbox}>{creatingMailbox ? "Creating…" : "Create mailbox"}</button>
          </form>
          <div className="olv-box-list">
            {boxes.map((b) => (
              <article key={b.id}>
                <span>{b.type === "SHARED" ? "S" : "I"}</span>
                <div>
                  <b>{b.name}</b>
                  <small>{b.address}</small>
                </div>
                <em>
                  {!b.active ? "Pending domain · " : ""}{b.member_count} member
                  {Number(b.member_count) === 1 ? "" : "s"}
                </em>
                {b.type === "SHARED" && (
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      void changeMember(b.id, event.target.value);
                      event.target.value = "";
                    }}
                    aria-label={`Change members for ${b.address}`}
                  >
                    <option value="">Manage members…</option>
                    {users.flatMap((user) => [
                      <option
                        key={`add-${user.id}`}
                        value={`addMember:${user.id}`}
                      >
                        Add {user.name}
                      </option>,
                      <option
                        key={`remove-${user.id}`}
                        value={`removeMember:${user.id}`}
                      >
                        Remove {user.name}
                      </option>,
                    ])}
                  </select>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
