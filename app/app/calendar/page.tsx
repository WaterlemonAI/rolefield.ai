import { requireModule } from "@/lib/olv/session";
import { CalendarWorkspace } from "./calendar-workspace";

export const metadata={title:"RoleField Calendar",robots:{index:false,follow:false}};
export default async function CalendarPage(){const principal=await requireModule("CALENDAR");return <CalendarWorkspace principal={principal}/>;}
