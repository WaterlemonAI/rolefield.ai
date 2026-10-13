import type { Metadata } from "next";
import { requireModule } from "@/lib/olv/session";
import { MeetingWorkspace } from "./workspace";
import "./meet.css";

export const metadata: Metadata = {
  title: "Meet — AI meeting workspace",
  description: "Prepare, meet, follow up, and improve with RoleField.",
  robots: { index: false, follow: false },
};

export default async function MeetPage() {
  const principal = await requireModule("MEETINGS");
  return <MeetingWorkspace principal={{ name: principal.name, email: principal.email }} />;
}
