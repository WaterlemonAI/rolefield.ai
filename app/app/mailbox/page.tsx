import { requirePrincipal } from "@/lib/olv/session";
import { MailWorkspace } from "../workspace";
export const metadata={title:"RoleField Mailbox",robots:{index:false,follow:false}};
export default async function MailboxPage(){const principal=await requirePrincipal();return <MailWorkspace principal={principal}/>;}
