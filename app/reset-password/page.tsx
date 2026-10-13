import { notFound } from "next/navigation";

export const metadata = { title: "Not found", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  notFound();
}
