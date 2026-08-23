import type { PoolClient } from "pg";
import type { Principal } from "./session";
export async function audit(client:PoolClient,p:Principal|{organizationId:string;userId?:string},action:string,targetType?:string,targetId?:string,metadata:Record<string,unknown>={}){await client.query("INSERT INTO audit_logs(organization_id,actor_user_id,action,target_type,target_id,request_metadata) VALUES($1,$2,$3,$4,$5,$6)",[p.organizationId,p.userId||null,action,targetType||null,targetId||null,JSON.stringify(metadata)]);}
