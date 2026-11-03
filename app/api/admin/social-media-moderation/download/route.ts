import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import { db, evidenceAdmin, IMAGES, londonDate, readEvidence, UUID } from "../../../../(Admin)/Admin/components/SocialMediaModeration/Server/Documents/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function attachment(body: BodyInit, type: string, name: string) {
  return new Response(body, {
    headers: { ...headers, "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"` },
  });
}

export async function GET(request: Request) {
  try {
    if (!(await evidenceAdmin())) return new Response("Forbidden", { status: 403, headers });
    const query = new URL(request.url).searchParams;
    const image = query.get("image");
    if (image && UUID.test(image)) {
      const result = await db.from(IMAGES).select("image_data,mime_type").eq("id", image).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return new Response("Screenshot not found", { status: 404, headers });
      const { image_data, mime_type } = result.data;
      if (!/^\\x(?:[a-f\d]{2})+$/i.test(image_data)) throw new Error("Invalid stored image.");
      const ext = mime_type === "image/png" ? "png" : "jpg";
      return attachment(Uint8Array.from(Buffer.from(image_data.slice(2), "hex")),
        mime_type, `screenshot-${image}.${ext}`);
    }

    const id = query.get("job");
    const format = query.get("format");
    if (!id || !UUID.test(id) || (format !== "txt" && format !== "docx")) {
      return new Response("Invalid download request", { status: 400, headers });
    }
    const evidence = await readEvidence(id);
    if (!evidence) return new Response("Record not found", { status: 404, headers });

    const { job, decision, images } = evidence;
    const title = "Burton Pride C.I.C. moderation evidence";
    const lines = [
      `Platform: ${job.platform}`,
      `Job ID: ${job.id}`,
      `Comment ID: ${job.comment_id}`,
      `Received: ${londonDate.format(new Date(job.received_at))}`,
      `Decision: ${decision?.decision ?? "Pending"}`,
      `Policy version: ${decision?.policy_version ?? "Not recorded"}`,
      `Reason: ${decision?.reason ?? "Not recorded"}`,
      `Reviewed: ${decision?.reviewed_at ? londonDate.format(new Date(decision.reviewed_at)) : "Not recorded"}`,
      `Review note: ${decision?.review_note ?? "Not recorded"}`,
      "", "Captured comment", job.content || "No comment text captured.",
      "", "Screenshots (download separately)",
      ...(images.length ? images.map(item => `${item.file_name} · ${item.id}`) : ["None attached."]),
      ...(images.length === 30 ? ["Latest 30 attachments listed."] : []),
    ].join("\n").split(/\r\n?|\n/);
    const name = `moderation-evidence-${id}.${format}`;
    if (format === "txt") return attachment([title, "", ...lines].join("\n") + "\n", "text/plain; charset=utf-8", name);
    const document = new Document({ sections: [{ children: [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      ...lines.map(line => new Paragraph({ text: line.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "") })),
    ] }] });
    return attachment(Uint8Array.from(await Packer.toBuffer(document)),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name);
  } catch {
    return new Response("Could not prepare evidence download", { status: 503, headers });
  }
}
