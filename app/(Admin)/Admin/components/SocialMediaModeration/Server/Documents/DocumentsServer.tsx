import { redirect } from "next/navigation";
import { db, evidenceAdmin, imageMime, IMAGES, londonDate, MAX_IMAGE_BYTES, PAGE, readEvidence, UUID } from "./evidence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function uploadScreenshot(form: FormData) {
  "use server";
  const actor = await evidenceAdmin();
  if (!actor) redirect(PAGE);
  const id = form.get("job");
  if (typeof id !== "string" || !UUID.test(id)) redirect(PAGE);
  const back = PAGE + "?job=" + id;
  const file = form.get("screenshot");
  if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES) redirect(back + "&result=invalid");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = imageMime(bytes);
  if (!mime) redirect(back + "&result=invalid");
  const name = file.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180) || "Screenshot";
  const { error } = await db.from(IMAGES).insert({
    job_id: id, file_name: name, mime_type: mime, image_data: "\\x" + bytes.toString("hex"), uploaded_by: actor,
  });
  redirect(back + (error ? "&result=failed" : "&result=saved"));
}

const card = "min-w-0 rounded-2xl border border-white/15 bg-slate-900/70 p-5";
const button = "inline-flex min-h-11 items-center rounded-xl border border-white/25 px-4 py-2 font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export default async function DocumentsPage({ searchParams }: {
  searchParams: Promise<{ job?: string; result?: string }>;
}) {
  if (!(await evidenceAdmin())) return <main className="p-6"><h1>Documents are restricted to main admins</h1></main>;
  const params = await searchParams;
  const selected = typeof params.job === "string" && UUID.test(params.job) ? params.job : undefined;
  const [jobs, evidence] = await Promise.all([
    db.from("moderation_jobs").select("id,platform,received_at,status")
      .order("received_at", { ascending: false }).order("id", { ascending: false }).limit(30),
    selected ? readEvidence(selected) : null,
  ]);
  if (jobs.error) throw new Error("Could not load moderation records.");
  const download = PAGE + "/download";
  return (
    <main className="w-full min-w-0 space-y-6 px-4 py-6 text-white sm:px-6">
      <header>
        <p className="text-sm text-slate-300">Social Media Moderation</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Documents</h1>
        <p className="mt-2 text-slate-300">Read captured comments, attach screenshots and export evidence for review.</p>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,3fr)]">
        <nav className={card} aria-label="Recent captured comments">
          <h2 className="text-lg font-semibold">Recent captures</h2>
          <p className="mt-1 text-sm text-slate-300">Up to 30 recent records. Times are shown in UK time.</p>
          <form action={PAGE} className="mt-4 flex flex-wrap gap-2">
            <label htmlFor="job" className="w-full text-sm">Open an older record by job ID</label>
            <input id="job" name="job" required className="min-w-0 flex-1 rounded-lg border border-white/30 bg-slate-950 p-2" />
            <button className={button}>Open</button>
          </form>
          <ul className="mt-4 space-y-2">
            {jobs.data.map(job => <li key={job.id}>
              <a href={PAGE + "?job=" + job.id} aria-current={selected === job.id ? "page" : undefined}
                className={"block rounded-xl border px-3 py-2 focus-visible:outline focus-visible:outline-2 " +
                  (selected === job.id ? "border-purple-300 bg-purple-500/20" : "border-white/10 hover:bg-white/10")}>
                <span className="font-semibold capitalize">{job.platform}</span>
                <span className="block text-sm text-slate-300">{londonDate.format(new Date(job.received_at))} · {job.status}</span>
              </a>
            </li>)}
          </ul>
          {!jobs.data.length && <p className="mt-4 text-slate-300">No comments have been captured yet.</p>}
        </nav>
        <section className={card}>
          {!evidence ? <p>{params.job ? "That record could not be found. Check the job ID." : "Select a capture to view its evidence."}</p> : <>
            <h2 className="text-xl font-semibold capitalize">{evidence.job.platform} comment</h2>
            <p className="mt-1 break-all text-sm text-slate-300">Job ID {evidence.job.id} · Comment ID {evidence.job.comment_id}</p>
            <p className="mt-1 text-sm text-slate-300">Received {londonDate.format(new Date(evidence.job.received_at))}</p>
            <blockquote className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-slate-950/70 p-4">{evidence.job.content || "No comment text captured."}</blockquote>
            <p className="mt-4 text-sm text-slate-200">Decision {evidence.decision?.decision ?? "Pending"}</p>
            {evidence.decision?.reason && <p className="mt-1 break-words text-sm text-slate-300">{evidence.decision.reason}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <a className={button} href={download + "?job=" + evidence.job.id + "&format=txt"}>Download text</a>
              <a className={button} href={download + "?job=" + evidence.job.id + "&format=docx"}>Download Word document</a>
            </div>
            <h3 className="mt-6 border-t border-white/15 pt-5 text-lg font-semibold">Screenshots</h3>
            <p id="screenshot-help" className="mt-1 text-sm text-slate-300">Attach a PNG or JPEG up to 750 KB. Images are downloaded separately from the report.</p>
            <form action={uploadScreenshot} className="mt-3 flex flex-wrap items-center gap-3">
              <input type="hidden" name="job" value={evidence.job.id} />
              <label htmlFor="screenshot" className="sr-only">Choose screenshot</label>
              <input id="screenshot" name="screenshot" type="file" accept=".png,.jpg,.jpeg" required aria-describedby="screenshot-help" className="max-w-full text-sm" />
              <button className={button}>Attach screenshot</button>
            </form>
            {params.result === "saved" && <p className="mt-3 text-emerald-200" role="status">Screenshot attached.</p>}
            {params.result === "invalid" && <p className="mt-3 text-amber-200" role="alert">Choose a PNG or JPEG up to 750 KB.</p>}
            {params.result === "failed" && <p className="mt-3 text-amber-200" role="alert">Screenshot could not be saved. Check the record before retrying.</p>}
            <ul className="mt-4 space-y-2">
              {evidence.images.map(image => <li key={image.id}>
                <a className="break-all underline" href={download + "?image=" + image.id}>{image.file_name}</a>
                <span className="ml-2 text-sm text-slate-300">{londonDate.format(new Date(image.uploaded_at))}</span>
              </li>)}
            </ul>
            {evidence.images.length === 30 && <p className="mt-3 text-sm text-slate-300">Showing the latest 30 attachments.</p>}
          </>}
        </section>
      </div>
    </main>
  );
}
