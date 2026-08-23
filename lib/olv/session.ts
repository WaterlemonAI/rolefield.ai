import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";
import { randomToken, safeMetadata, tokenHash } from "./security";

export const OLV_COOKIE="olv_session";
export type Principal={userId:string;organizationId:string;email:string;name:string;orgRole:"ADMIN"|"MEMBER"};
export async function createSession(userId:string,organizationId:string,request:Request){const token=randomToken();const ttl=Number(process.env.SESSION_TTL_HOURS||12);const meta=safeMetadata(request);await query("INSERT INTO sessions(organization_id,user_id,token_hash,expires_at,ip_hash,user_agent) VALUES($1,$2,$3,now()+($4||' hours')::interval,$5,$6)",[organizationId,userId,tokenHash(token),ttl,meta.ipHash,meta.userAgent]);return {token,maxAge:ttl*3600};}
export async function principalFromToken(token?:string):Promise<Principal|null>{if(!token)return null;const {rows}=await query<Principal>(`SELECT u.id "userId",om.organization_id "organizationId",u.recovery_email email,u.name,om.role "orgRole" FROM sessions s JOIN users u ON u.id=s.user_id JOIN organization_members om ON om.user_id=u.id AND om.organization_id=s.organization_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()`,[tokenHash(token)]);return rows[0]||null;}
export async function currentPrincipal(){return principalFromToken((await cookies()).get(OLV_COOKIE)?.value);}
export async function requirePrincipal(){const p=await currentPrincipal();if(!p)redirect("/login");return p;}
export async function apiPrincipal(request:Request){const p=await principalFromToken(request.headers.get("cookie")?.match(/(?:^|; )olv_session=([^;]+)/)?.[1]);if(!p)throw Object.assign(new Error("Authentication required."),{status:401});return p;}
export async function requireMailbox(p:Principal,mailboxId:string){const {rows}=await query(`SELECT m.id,a.address,mm.role,m.type FROM mailbox_members mm JOIN mailboxes m ON m.id=mm.mailbox_id AND m.organization_id=mm.organization_id JOIN mailbox_addresses a ON a.mailbox_id=m.id AND a.is_primary WHERE mm.organization_id=$1 AND mm.user_id=$2 AND mm.mailbox_id=$3 AND m.active`,[p.organizationId,p.userId,mailboxId]);if(!rows[0])throw Object.assign(new Error("Mailbox access denied."),{status:403});return rows[0] as {id:string,address:string,role:string,type:string};}
