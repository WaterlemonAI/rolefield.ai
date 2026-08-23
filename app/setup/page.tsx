import { redirect } from "next/navigation";
import { currentPrincipal } from "@/lib/olv/session";
import { OrganizationSetup } from "./setup-form";

export const metadata = {
  title: "Create OLV workspace",
  robots: { index: false, follow: false },
};

export default async function Page() {
  if (await currentPrincipal()) redirect("/app/admin");
  return <OrganizationSetup />;
}
