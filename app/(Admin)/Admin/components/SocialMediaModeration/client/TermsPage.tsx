import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PATH = "/Admin/SocialMediaModeration/Terms";
const TABLE = "moderation_policy_versions";
const MAX_BYTES = 256 * 1024;
const METADATA = "id,version,file_name,uploaded_at,approved_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function access() {
  const admin = await getCurrentAdmin();
  if (!admin) return null;
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;

  const result = await supabaseAdmin.from("admin_users")
    .select("id,role,is_main_admin")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (result.error) throw new Error("Could not verify moderation policy access.");
  if (!result.data) return null;
  return {
    id: result.data.id,
    canManage: result.data.is_main_admin === true || result.data.role === "main_admin",
  };
}

async function manager() {
  const actor = await access();
  if (!actor?.canManage) redirect(PATH + "?result=forbidden");
  return actor;
}

async function uploadTerms(formData: FormData) {
  "use server";
  const actor = await manager();
  const file = formData.get("terms");
  if (!(file instanceof File) || !/\.(txt|md)$/i.test(file.name) ||
      !file.size || file.size > MAX_BYTES || file.name.length > 255) {
    redirect(PATH + "?result=invalid");
  }

  let body = "";
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    redirect(PATH + "?result=invalid");
  }
  if (!body.trim() || body.includes("\0")) redirect(PATH + "?result=invalid");

  const { error } = await supabaseAdmin.from(TABLE).insert({
    file_name: file.name,
    body,
    uploaded_by: actor.id,
  });
  if (error) {
    console.error("Moderation policy upload failed", error.code);
    redirect(PATH + "?result=failed");
  }
  revalidatePath(PATH);
  redirect(PATH + "?result=uploaded");
}

async function approveTerms(formData: FormData) {
  "use server";
  const actor = await manager();
  const id = formData.get("id");
  if (typeof id !== "string" || !UUID.test(id)) redirect(PATH + "?result=invalid");

  const { data, error } = await supabaseAdmin.rpc("approve_moderation_policy_version", {
    policy_id: id,
    approver_id: actor.id,
  });
  if (error) {
    console.error("Moderation policy approval failed", error.code);
    redirect(PATH + "?result=failed");
  }
  if (data !== true) redirect(PATH + "?result=stale");
  revalidatePath(PATH);
  redirect(PATH + "?result=approved");
}

type PolicyVersion = {
  id: string;
  version: number;
  file_name: string;
  uploaded_at: string;
  approved_at: string | null;
  body?: string;
};

const messages: Record<string, string> = {
  uploaded: "New draft uploaded and ready for review.",
  approved: "Terms approved.",
  forbidden: "Only a main admin can upload or approve terms.",
  invalid: "Choose a non-empty UTF-8 .txt or .md file up to 256 KB, or reload the policy before approving.",
  failed: "The change could not be saved. Refresh and check the version history before retrying.",
  stale: "That draft has already been approved or a newer draft is available. Review the latest version.",
};

const date = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London",
});
const panel = "rounded-2xl border border-white/15 bg-white/5 p-5";
const button = "rounded-xl bg-white px-4 py-2 font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export default async function TermsPage({ searchParams }: {
  searchParams: Promise<{ version?: string; result?: string }>;
}) {
  const actor = await access();
  if (!actor) return <main className="p-6"><h1>Admin sign-in required</h1></main>;

  const params = await searchParams;
  const [history, approved] = await Promise.all([
    supabaseAdmin.from(TABLE).select(METADATA).order("version", { ascending: false }).limit(50),
    supabaseAdmin.from(TABLE).select(METADATA).not("approved_at", "is", null)
      .order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (history.error || approved.error) throw new Error("Could not load policy versions.");

  const latest = history.data[0] as PolicyVersion | undefined;
  const selectedId = typeof params.version === "string" && UUID.test(params.version)
    ? params.version : latest?.id;
  const selected = selectedId
    ? await supabaseAdmin.from(TABLE).select(METADATA + ",body").eq("id", selectedId).maybeSingle()
    : null;
  if (selected && selected.error) throw new Error("Could not load the selected policy.");

  const policy: PolicyVersion | null = selected && selected.data && !selected.error
    ? (selected.data as unknown as PolicyVersion)
    : null;
  const current: PolicyVersion | null = approved.data && !approved.error
    ? (approved.data as unknown as PolicyVersion)
    : null;
  const message = typeof params.result === "string" && Object.prototype.hasOwnProperty.call(messages, params.result)
    ? messages[params.result] : null;

  return (
    <main className="w-full min-w-0 space-y-6 px-4 py-5 text-white sm:px-6 sm:py-6">
      <header>
        <p className="text-sm text-white/70">Social Media Moderation</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Terms and moderation policy</h1>
        <p className="mt-2 text-white/80">
          {current ? <>Current approved terms <a className="underline" href={PATH + "?version=" + current.id}>Version {current.version}</a></>
            : "Awaiting approval. There are no approved terms yet."}
        </p>
      </header>
      {message && <p role="status" className={panel}>{message}</p>}

      <section className={panel}>
        {policy ? <>
          <h2 className="text-xl font-bold">Version {policy.version}</h2>
          <p className="mt-1 text-sm text-white/75">
            {policy.approved_at ? (current?.id === policy.id ? "Approved" : "Previously approved")
              : latest?.id === policy.id ? "Awaiting approval" : "Superseded draft"} · {policy.file_name}
          </p>
          <PolicyText body={policy.body ?? ""} markdown={/\.md$/i.test(policy.file_name)} />
          {actor.canManage && policy.id === latest?.id && !policy.approved_at && (
            <form action={approveTerms} className="mt-6">
              <input type="hidden" name="id" value={policy.id} />
              <button className={button}>Approve terms</button>
            </form>
          )}
        </> : <p>{selectedId ? "That version could not be found." : "No terms have been uploaded."}</p>}
      </section>

      {actor.canManage && (
        <section className={panel}>
          <h2 className="text-xl font-bold">Upload new terms</h2>
          <p id="upload-help" className="mt-1 text-sm text-white/75">
            Upload a UTF-8 .txt or .md file up to 256 KB. It becomes a draft. The current approved version stays in effect until the new draft is approved.
          </p>
          <p className="mt-2 text-sm text-white/75">Use # for headings, - for bullets and a blank line between paragraphs. The same page styling applies to every version.</p>
          <form action={uploadTerms} className="mt-4 flex flex-wrap items-center gap-3">
            <label htmlFor="terms" className="sr-only">Choose terms file</label>
            <input id="terms" name="terms" type="file" accept=".txt,.md" required aria-describedby="upload-help" />
            <button className={button}>Upload draft</button>
          </form>
        </section>
      )}

      <section className={panel}>
        <h2 className="text-xl font-bold">Version history</h2>
        <ul className="mt-3 space-y-2">
          {history.data.map((item) => (
            <li key={item.id}>
              <a className="underline" href={PATH + "?version=" + item.id}>Version {item.version}</a>
              {" · "}{date.format(new Date(item.uploaded_at))}
              {" · "}{item.approved_at ? "Approved " + date.format(new Date(item.approved_at))
                : item.id === latest?.id ? "Awaiting approval" : "Superseded draft"}
            </li>
          ))}
        </ul>
        {history.data.length === 50 && <p className="mt-3 text-sm text-white/70">Showing the latest 50 versions.</p>}
      </section>
    </main>
  );
}

function PolicyText({ body, markdown }: { body: string; markdown: boolean }) {
  const blocks: Array<{ kind: "heading" | "paragraph" | "list" | "ordered"; lines: string[]; start?: number }> = [];
  let paragraph: string[] = [];

  function finishParagraph() {
    if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  }

  for (const rawLine of body.split(/\r\n?|\n/)) {
    const line = rawLine.trim();
    if (!line) {
      finishParagraph();
      continue;
    }

    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    const bullet = /^[•*+-]\s+(.+)$/.exec(line);
    const ordered = markdown ? /^(\d{1,9})[.)]\s+(.+)$/.exec(line) : null;
    if (heading || (!markdown && /^\d{1,2}\.?\s+[A-Za-z]/.test(line))) {
      finishParagraph();
      blocks.push({ kind: "heading", lines: [heading?.[1] ?? line] });
    } else if (bullet || ordered) {
      finishParagraph();
      const kind = bullet ? "list" : "ordered";
      const item = bullet?.[1] ?? ordered![2];
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === kind) previous.lines.push(item);
      else blocks.push({ kind, lines: [item], start: ordered ? Number(ordered[1]) : undefined });
    } else {
      paragraph.push(line);
    }
  }
  finishParagraph();

  return (
    <article className="mt-6 max-w-[85ch] space-y-4 break-words text-base leading-relaxed text-slate-200">
      {blocks.map(({ kind, lines, start }, index) => {
        if (kind === "heading") {
          return <h3 key={index} className="!mt-8 border-t border-white/10 pt-5 text-lg font-semibold tracking-tight text-white">{lines[0]}</h3>;
        }
        if (kind === "ordered") {
          return (
            <ol key={index} start={start} className="list-decimal space-y-2 pl-6 marker:text-fuchsia-300">
              {lines.map((line, item) => <li key={item}>{line}</li>)}
            </ol>
          );
        }
        if (kind === "list") {
          return (
            <ul key={index} className="list-disc space-y-2 pl-6 marker:text-fuchsia-300">
              {lines.map((line, item) => <li key={item}>{line}</li>)}
            </ul>
          );
        }
        return <p key={index} className="whitespace-pre-wrap">{lines.join("\n")}</p>;
      })}
    </article>
  );
}
