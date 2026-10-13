import type { PoolClient } from "pg";
import type { Principal } from "@/lib/olv/session";

export function canAccessMeetingRole(orgRole:Principal["orgRole"],participantRole:string|null,mutation=false){return orgRole==="ADMIN"||participantRole!==null&&(!mutation||participantRole==="ORGANIZER");}

export async function requireMeeting(client:PoolClient,p:Principal,id:string,mutation=false){const result=await client.query(`SELECT m.* FROM meetings m WHERE m.id=$1 AND m.organization_id=$2 AND ($3='ADMIN' OR EXISTS(SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id=m.id AND mp.organization_id=m.organization_id AND mp.user_id=$4${mutation?" AND mp.role='ORGANIZER'":""}))`,[id,p.organizationId,p.orgRole,p.userId]);if(!result.rows[0])throw Object.assign(new Error(mutation?"Meeting organizer access required.":"Meeting not found."),{status:mutation?403:404});return result.rows[0];}
export async function requireOrganizationUser(client:PoolClient,p:Principal,userId?:string){if(!userId)return;const found=await client.query("SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2",[p.organizationId,userId]);if(!found.rowCount)throw Object.assign(new Error("User is not a member of this organization."),{status:400});}
export function visibilitySql(alias:string,p:Principal,startAt=3){return {sql:`(${alias}.visibility='PUBLIC_MEETING' OR ${alias}.visibility='ORGANIZATION_PRIVATE' OR (${alias}.visibility='USER_PRIVATE' AND ${alias}.owner_user_id=$${startAt}) OR (${alias}.visibility='ADMIN_PRIVATE' AND $${startAt+1}='ADMIN'))`,values:[p.userId,p.orgRole]};}
export function ownerForVisibility(visibility:string,p:Principal){return visibility==="USER_PRIVATE"?p.userId:null;}
