import { NextResponse } from "next/server";
export function printJson(value: unknown, status=200) {
  return NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});
}
export function validBatchId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
export function printRpcError(error: {code?:string;message?:string}) {
  const messages: Record<string,[string,number]> = {
    PAPER_BATCH_NOT_FOUND:["Paper-ticket batch not found.",404],
    PAPER_BATCH_CANCELLED:["This batch has been cancelled.",409],
    PAPER_PRINT_PDF_CHANGED:["The PDF is missing or has changed. Refresh the batch and check its preview again.",409],
    PAPER_PRINT_CHECKS_REQUIRED:["Complete every printing check before confirming the batch.",400],
    PAPER_PRINT_NOT_READY:["Generate the batch PDF before confirming printing.",409],
    PAPER_PRINT_PDF_MISSING:["The saved PDF is missing. Check the batch before printing.",409],
    PAPER_PRINT_TICKETS_CHANGED:["The batch tickets no longer match its PDF. Check the batch before printing.",409],
    PAPER_PDF_NOT_READY:["The PDF is not ready to preview.",409],
    PAPER_REPRINT_REASON_REQUIRED:["Enter a reprint reason of at least 8 characters.",400],
    LOTTERY_STATUS_BLOCKED:["This lottery's status prevents printing confirmation.",409],
    INVALID_OR_INACTIVE_ADMIN:["Your administrator account could not be verified.",403],
  };
  const key=Object.keys(messages).find(key=>error.message?.includes(key));
  return key ? printJson({ok:false,error:messages[key][0],code:key},messages[key][1])
    : printJson({ok:false,error:error.code==='PGRST202'?"Install the print-confirmation SQL before using this action.":"The database could not complete this action.",code:"PAPER_PRINT_DATABASE_FAILED"},500);
}
