import { NextRequest } from "next/server";
import { lotteryAdminDb,requireLotteryPermission } from "@/lib/lottery/adminAuth";
import { printJson,validBatchId } from "@/lib/lottery/paper-print-server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const COLUMNS="id,lottery_id,batch_reference,quantity,status,created_at,cancelled_at,pdf_path,pdf_sha256,pdf_page_count,pdf_bytes,pdf_generated_at,page_size,tickets_per_sheet,duplex_flip,code_format,printed_at,lottery:lotteries(title)";
export async function GET(request: NextRequest) {
  await requireLotteryPermission("lottery:manage");
  try {
    const url=request.nextUrl;
    const batch=url.searchParams.get("batch");
    const status=url.searchParams.get("status")||"all";
    const rawPage=url.searchParams.get("page")||"1";
    if(!/^[1-9]\d*$/.test(rawPage)||Number(rawPage)>100000) return printJson({ok:false,error:"Select a valid page."},400);
    const page=Number(rawPage),pageSize=25;
    if(batch&&!validBatchId(batch)) return printJson({ok:false,error:"Invalid batch ID."},400);
    if(!["all","generated","ready_to_print","printed","cancelled"].includes(status)) return printJson({ok:false,error:"Select a valid batch status."},400);
    let query=lotteryAdminDb().from("lottery_paper_ticket_batches").select(COLUMNS,{count:"exact"});
    if(batch) query=query.eq("id",batch);
    else if(status!=="all") query=query.eq("status",status);
    const {data,error,count}=await query.order("created_at",{ascending:false}).order("id").range(batch?0:(page-1)*pageSize,batch?0:page*pageSize-1);
    if(error) return printJson({ok:false,error:"The paper-ticket batches could not be loaded."},500);
    const items=(data||[]).map(value=>{
      const row=value as unknown as Record<string,unknown>;
      const relation=row.lottery as {title:string}|{title:string}[]|null;
      const lottery=Array.isArray(relation)?relation[0]:relation;
      const {pdf_path,cancelled_at,lottery: _lottery,...safe}=row;
      return {...safe,lottery_title:lottery?.title||"Lottery",pdf_ready:!!pdf_path&&!cancelled_at&&["ready_to_print","printed"].includes(String(row.status))};
    });
    if(batch&&!items.length) return printJson({ok:false,error:"Paper-ticket batch not found."},404);
    return printJson({ok:true,items,page:batch?1:page,page_size:pageSize,total:count||0});
  } catch {return printJson({ok:false,error:"The paper-ticket batches could not be loaded."},500);}
}
