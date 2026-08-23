import { requirePrincipal } from "@/lib/olv/session";import { MailWorkspace } from "./workspace";
export const metadata={title:"OLV Mail",robots:{index:false,follow:false}};
export default async function OLVApp(){const principal=await requirePrincipal();return <MailWorkspace principal={principal}/>;}
