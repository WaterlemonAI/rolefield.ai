import { requireModule } from "@/lib/olv/session";
import { MailWorkspace } from "../workspace";
export const metadata={title:"RoleField Mailbox",robots:{index:false,follow:false}};
export default async function MailboxPage(){const principal=await requireModule("MAILBOX");return <MailWorkspace principal={principal}/>;}
