"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DataQualityTaskButton({findingId,title,detail,href,severity}:{findingId:string;title:string;detail:string;href:string;severity:"ACTION"|"REVIEW"}) {
  const [busy,setBusy]=useState(false);
  const router=useRouter();
  async function create(){setBusy(true);try{const response=await fetch("/api/admin/corporate/work-items",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description:detail,priority:severity==="ACTION"?"HIGH":"NORMAL",sourceType:"DATA_QUALITY",sourceId:findingId,sourceKey:`data-quality:${findingId}`,sourceHref:href,dueDate:new Date().toISOString().slice(0,10)})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Could not create work item");toast.success("Finding added to Administrative Work");router.refresh();}catch(error){toast.error(error instanceof Error?error.message:"Could not create work item");}finally{setBusy(false);}}
  return <Button size="sm" variant="outline" disabled={busy} onClick={create}>{busy?"Adding…":"Add to work"}</Button>;
}
