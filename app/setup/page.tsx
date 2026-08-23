import { redirect } from "next/navigation";

export const metadata = {
  title: "Create OLV workspace",
  robots: { index: false, follow: false },
};

export default async function Page() {
  redirect("/login");
}
