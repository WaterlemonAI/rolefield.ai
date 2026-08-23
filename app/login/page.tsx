import { redirect } from "next/navigation";
import { currentPrincipal } from "@/lib/olv/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in to OLV", robots: { index: false, follow: false } };
export default async function LoginPage() { if (await currentPrincipal()) redirect("/app"); return <LoginForm/>; }
