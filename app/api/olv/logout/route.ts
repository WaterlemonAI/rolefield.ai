import { NextResponse } from "next/server";
import { apiPrincipal, OLV_COOKIE } from "@/lib/olv/session";
import { query, transaction } from "@/lib/olv/db";
import { tokenHash } from "@/lib/olv/security";
import { audit } from "@/lib/olv/audit";
export async function POST(request:Request){const p=await apiPrincipal(request);const token=request.headers.get("cookie")?.match(/(?:^|; )olv_session=([^;]+)/)?.[1]||"";await query("UPDATE sessions SET revoked_at=now() WHERE organization_id=$1 AND user_id=$2 AND token_hash=$3",[p.organizationId,p.userId,tokenHash(token)]);await transaction(c=>audit(c,p,"LOGOUT","session"));const response=NextResponse.json({ok:true});response.cookies.set(OLV_COOKIE,"",{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:0});return response;}
