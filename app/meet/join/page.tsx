import type { Metadata } from "next";
import { PrejoinResolver } from "./prejoin-resolver";
import "../meet.css";

export const metadata: Metadata = {
  title: "Meeting prejoin — RoleField",
  robots: { index: false, follow: false },
};
export default function JoinPage() {
  return <PrejoinResolver />;
}
