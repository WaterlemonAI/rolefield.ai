"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Context = {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  name?: string | null;
  email?: string;
  mediaJoinAvailable: boolean;
};
export function PrejoinResolver() {
  const [data, setData] = useState<Context | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const grant = new URLSearchParams(window.location.hash.slice(1)).get(
      "grant",
    );
    if (!grant) {
      queueMicrotask(() => {
        setError("This prejoin link is missing its access grant.");
        setLoading(false);
      });
      return;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    let active = true;
    fetch("/api/meetings/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "This prejoin link is unavailable.");
        if (active) setData(body.invitation);
      })
      .catch((issue) => {
        if (active) setError(issue.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="meet-prejoin">
      <Link href="/" className="meet-brand">
        <span>R</span>
        <b>rolefield</b>
      </Link>
      <section aria-live="polite">
        {loading ? (
          <div className="meet-loading" role="status">
            Checking prejoin access…
          </div>
        ) : error ? (
          <>
            <small>PREJOIN ACCESS</small>
            <h1>Link unavailable</h1>
            <p>{error}</p>
          </>
        ) : data ? (
          <>
            <small>PREJOIN CONTEXT</small>
            <h1>{data.title}</h1>
            <p>
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "full",
                timeStyle: "short",
              }).format(new Date(data.startsAt))}
            </p>
            <dl>
              <div>
                <dt>Participant</dt>
                <dd>{data.name || data.email || "Invited participant"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{data.location || "Not set"}</dd>
              </div>
            </dl>
            <div className="meet-alert">
              <span>
                Audio, video, and media joining are not available from this
                link.
              </span>
            </div>
            <p>
              This link provides prejoin meeting context only. Contact the
              organizer for meeting access instructions.
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
