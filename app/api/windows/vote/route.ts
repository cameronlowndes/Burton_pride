import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function makeVoterId() {
  return crypto.randomUUID();
}

// normalize names to reduce "spam" via spacing/case
function normName(s: string) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const entryId = String(body?.entryId || "").trim();
    const firstName = normName(body?.firstName);
    const lastName = normName(body?.lastName);
    const email = String(body?.email || "").trim().toLowerCase();

    if (!entryId) {
      return NextResponse.json({ ok: false, error: "Missing entryId" }, { status: 400 });
    }

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { ok: false, error: "Please enter first name, last name, and email address." },
        { status: 400 }
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email address." }, { status: 400 });
    }

    // cookie voter id
    const cookieStore = await cookies();
    let voterId = cookieStore.get("voter_id")?.value;
    const hadCookie = !!voterId;

    if (!voterId) voterId = makeVoterId();

    const voterHash = sha256(voterId);
    const ua = (await headers()).get("user-agent") || null;

    // helper to build responses AND keep cookie if it was newly set
    const withCookie = (payload: any, status = 200) => {
      const res = NextResponse.json(payload, { status });

      // only set cookie if it didn't exist before
      if (!hadCookie) {
        res.cookies.set("voter_id", voterId!, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 365,
        });
      }

      return res;
    };

    const db = supabaseAdmin; // ✅ singleton client (no brackets)

    // ✅ Block if this device already voted
    const { data: existing, error: existingErr } = await db
      .from("competition_votes")
      .select("entry_id")
      .eq("voter_hash", voterHash)
      .maybeSingle();

    if (existingErr) {
      return withCookie({ ok: false, error: existingErr.message }, 500);
    }

    if (existing?.entry_id) {
      return withCookie({
        ok: true,
        alreadyVoted: true,
        votedEntryId: existing.entry_id,
      });
    }

    // ✅ Block if this email already voted
    const { data: byEmail, error: emailErr } = await db
      .from("competition_votes")
      .select("entry_id")
      .eq("email", email)
      .maybeSingle();

    if (emailErr) {
      return withCookie({ ok: false, error: emailErr.message }, 500);
    }

    if (byEmail?.entry_id) {
      return withCookie(
        { ok: false, error: "This email address has already been used to vote." },
        400
      );
    }

    // ✅ Block if this FIRST+LAST name already voted
    const { data: byName, error: nameErr } = await db
      .from("competition_votes")
      .select("entry_id")
      .eq("first_name", firstName)
      .eq("last_name", lastName)
      .maybeSingle();

    if (nameErr) {
      return withCookie({ ok: false, error: nameErr.message }, 500);
    }

    if (byName?.entry_id) {
      return withCookie(
        { ok: false, error: "This name has already been used to vote." },
        400
      );
    }

    // Only allow approved entries
    const { data: entry, error: entryErr } = await db
      .from("competition_entries")
      .select("id,status")
      .eq("id", entryId)
      .maybeSingle();

    if (entryErr) {
      return withCookie({ ok: false, error: entryErr.message }, 500);
    }

    if (!entry || entry.status !== "approved") {
      return withCookie({ ok: false, error: "Entry is not available for voting" }, 400);
    }

    // Insert vote with details
    const { error: insertErr } = await db.from("competition_votes").insert({
      entry_id: entryId,
      voter_hash: voterHash,
      user_agent: ua,
      first_name: firstName,
      last_name: lastName,
      email,
    });

    if (insertErr) {
      const msg = String(insertErr.message || "").toLowerCase();

      if (msg.includes("competition_votes_email_uniq")) {
        return withCookie(
          { ok: false, error: "This email address has already been used to vote." },
          400
        );
      }
      if (msg.includes("competition_votes_name_uniq")) {
        return withCookie({ ok: false, error: "This name has already been used to vote." }, 400);
      }
      if (msg.includes("competition_votes_voter_hash_uniq")) {
        return withCookie(
          { ok: false, error: "You have already voted on this device/browser." },
          400
        );
      }

      if (msg.includes("duplicate") || msg.includes("unique")) {
        return withCookie({ ok: false, error: "You have already voted." }, 400);
      }

      return withCookie({ ok: false, error: insertErr.message }, 500);
    }

    // ✅ Success
    return withCookie({ ok: true, alreadyVoted: false }, 200);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}