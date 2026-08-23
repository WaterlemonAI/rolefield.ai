import { apiPrincipal } from "@/lib/olv/session";
import { requireSameOrigin } from "@/lib/olv/security";
import { query } from "@/lib/olv/db";
import { syncExternalAccount, type StoredExternalMailAccount } from "@/lib/olv/external-mail";
export async function POST(request:Request){requireSameOrigin(request);const p=await apiPrincipal(request);const {rows}=await query<StoredExternalMailAccount>("SELECT * FROM external_mail_accounts WHERE organization_id=$1 AND user_id=$2 AND status<>'DISCONNECTED'",[p.organizationId,p.userId]);let imported=0;for(const account of rows)try{imported+=await syncExternalAccount(account);}catch(error){console.error("External IMAP sync failed",{accountId:account.id,name:(error as Error).name});}return Response.json({imported,accounts:rows.length});}
