import { requireSameOrigin } from "@/lib/olv/security";
import { apiRequireModule } from "@/lib/olv/session";

export async function meetingPrincipal(request:Request,mutation=false){if(mutation)requireSameOrigin(request);return apiRequireModule(request,"MEETINGS");}
export function meetingError(error:unknown,message="Unable to process the meeting request."){const issue=error as {status?:number;message?:string};if(!issue.status)console.error(message,{name:(error as Error)?.name});return Response.json({error:issue.status?issue.message:message},{status:issue.status||500});}
export async function json(request:Request){try{return await request.json();}catch{throw Object.assign(new Error("Invalid JSON request."),{status:400});}}
