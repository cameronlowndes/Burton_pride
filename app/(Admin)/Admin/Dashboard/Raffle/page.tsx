
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bug,
  Gift,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

type RaffleEntry = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  ticket_amount: string | null;
  message: string | null;
  status: string | null;
  payment_status: string | null;
  amount_pence: number | null;
  currency: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  raffle_winner_position: number | null;
  raffle_won_at: string | null;
  raffle_draw_notes: string | null;
};

type ApiStats = {
  totalEntries: number;
  paidEntries: number;
  checkoutStartedEntries: number;
  totalTickets: number;
  totalRaisedPence: number;
  winners: RaffleEntry[];
};

type DrawInfo = {
  prizePosition: number;
  prize: string;
  totalPaidPeople: number;
  totalTicketsInDraw: number;
  randomWinningTicketNumber: number;
  drawnAt: string;
  notes: string;
};

type BigMessage = {
  type: "official" | "test";
  title: string;
  subtitle: string;
  winnerName: string;
  winnerEmail: string;
  winnerPhone: string;
  prize: string;
  tickets: number;
  notes: string;
};

function money(amountPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((amountPence || 0) / 100);
}

function ticketCount(value: string | null) {
  const n = Number(value || 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function prizeLabel(position: number | null) {
  if (position === 1) return "1st Prize";
  if (position === 2) return "2nd Prize";
  if (position === 3) return "3rd Prize";
  return "";
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminRafflePage() {
  const drawSectionRef = useRef<HTMLElement | null>(null);

  const [entries, setEntries] = useState<RaffleEntry[]>([]);
  const [stats, setStats] = useState<ApiStats>({
    totalEntries: 0,
    paidEntries: 0,
    checkoutStartedEntries: 0,
    totalTickets: 0,
    totalRaisedPence: 0,
    winners: [],
  });

  const [filter, setFilter] = useState<
    "all" | "paid" | "checkout_started" | "winners"
  >("all");

  const [loading, setLoading] = useState(true);
  const [creatingTestEntries, setCreatingTestEntries] = useState(false);
  const [drawing, setDrawing] = useState<number | null>(null);
  const [drawHighlight, setDrawHighlight] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<any>(null);

  const [drawModal, setDrawModal] = useState<number | null>(null);
  const [redoModal, setRedoModal] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<RaffleEntry | null>(null);
  const [deleteAllModal, setDeleteAllModal] = useState(false);

  const [latestWinner, setLatestWinner] = useState<RaffleEntry | null>(null);
  const [latestDraw, setLatestDraw] = useState<DrawInfo | null>(null);
  const [bigMessage, setBigMessage] = useState<BigMessage | null>(null);

  async function loadEntries() {
    try {
      setLoading(true);
      setError("");
      setErrorDetails(null);

      const res = await fetch(`/api/admin/raffle/entries?t=${Date.now()}`, {
        cache: "no-store",
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to load raffle entries",
          details: data,
          status: res.status,
        };
      }

      setEntries(data.entries || []);
      setStats(
        data.stats || {
          totalEntries: 0,
          paidEntries: 0,
          checkoutStartedEntries: 0,
          totalTickets: 0,
          totalRaisedPence: 0,
          winners: [],
        }
      );
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  const filteredEntries = useMemo(() => {
    if (filter === "all") return entries;

    if (filter === "paid") {
      return entries.filter((entry) => entry.payment_status === "paid");
    }

    if (filter === "checkout_started") {
      return entries.filter(
        (entry) => entry.payment_status === "checkout_started"
      );
    }

    if (filter === "winners") {
      return entries.filter((entry) => entry.raffle_winner_position);
    }

    return entries;
  }, [entries, filter]);

  function scrollToDraw() {
    const section = drawSectionRef.current;

    if (!section) {
      setError("Draw raffle section could not be found on this page.");
      return;
    }

    section.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    setDrawHighlight(true);

    window.setTimeout(() => {
      section.focus();
    }, 500);

    window.setTimeout(() => {
      setDrawHighlight(false);
    }, 2500);
  }

  function testRandomDraw() {
    setError("");
    setErrorDetails(null);

    let testEntries = entries.filter(
      (entry) =>
        entry.payment_status === "paid" && !entry.raffle_winner_position
    );

    if (testEntries.length === 0) {
      testEntries = entries.filter((entry) => !entry.raffle_winner_position);
    }

    const ticketPool: RaffleEntry[] = [];

    for (const entry of testEntries) {
      const count = ticketCount(entry.ticket_amount);

      for (let i = 0; i < count; i++) {
        ticketPool.push(entry);
      }
    }

    if (ticketPool.length === 0) {
      setBigMessage({
        type: "test",
        title: "Test Draw Result",
        subtitle:
          "This is only a test. No real raffle entries were found, so this shows a demo winner message.",
        winnerName: "Demo Test Winner",
        winnerEmail: "demo@example.com",
        winnerPhone: "01283 000000",
        prize: "Test Prize",
        tickets: 1,
        notes:
          "This is a demo test message only. It has NOT saved anything and it is NOT the official raffle draw.",
      });

      return;
    }

    const randomIndex = Math.floor(Math.random() * ticketPool.length);
    const testWinner = ticketPool[randomIndex];

    setBigMessage({
      type: "test",
      title: "Test Draw Result",
      subtitle:
        "This is only a test. It has NOT saved the winner and it is NOT the official raffle draw.",
      winnerName: testWinner.full_name,
      winnerEmail: testWinner.email,
      winnerPhone: testWinner.phone || "—",
      prize: "Test Prize",
      tickets: ticketCount(testWinner.ticket_amount),
      notes: `Test randomly picked ticket ${randomIndex + 1} of ${
        ticketPool.length
      }. This test can use checkout-started entries if no paid entries exist yet.`,
    });
  }

  async function createTestEntries() {
    try {
      setCreatingTestEntries(true);
      setError("");
      setErrorDetails(null);
      setBigMessage(null);

      const res = await fetch("/api/admin/raffle/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_test_entries",
        }),
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to create test entries",
          details: data,
          status: res.status,
        };
      }

      setBigMessage({
        type: "test",
        title: "10 Test Entries Created",
        subtitle:
          "These are fake paid raffle entries so you can test the raffle draw.",
        winnerName: "Test Entries Added",
        winnerEmail: `${data.created || 10} fake paid entries added`,
        winnerPhone: "—",
        prize: "Test Data",
        tickets: data.totalTickets || 10,
        notes:
          "You can now test the official draw. Remember to delete test entries before doing the real raffle.",
      });

      await loadEntries();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setCreatingTestEntries(false);
    }
  }

  async function drawWinner(position: number) {
    try {
      setDrawing(position);
      setError("");
      setErrorDetails(null);
      setLatestWinner(null);
      setLatestDraw(null);
      setBigMessage(null);

      const res = await fetch("/api/admin/raffle/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "draw",
          prizePosition: position,
        }),
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to draw winner",
          details: data,
          status: res.status,
        };
      }

      setLatestWinner(data.winner);
      setLatestDraw(data.draw);

      setBigMessage({
        type: "official",
        title: "Official Winner Drawn",
        subtitle:
          "This winner has been saved in Supabase as part of the official raffle draw.",
        winnerName: data.winner.full_name,
        winnerEmail: data.winner.email,
        winnerPhone: data.winner.phone || "—",
        prize: data.draw.prize,
        tickets: ticketCount(data.winner.ticket_amount),
        notes: data.draw.notes,
      });

      setDrawModal(null);
      await loadEntries();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDrawing(null);
    }
  }

  async function redoDraw(position: number) {
    try {
      setDrawing(position);
      setError("");
      setErrorDetails(null);
      setLatestWinner(null);
      setLatestDraw(null);
      setBigMessage(null);

      const res = await fetch("/api/admin/raffle/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "redo_draw",
          prizePosition: position,
        }),
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to redo draw",
          details: data,
          status: res.status,
        };
      }

      setRedoModal(null);

      setBigMessage({
        type: "test",
        title: "Draw Reset",
        subtitle:
          "The saved winner for this prize has been cleared. You can now draw this prize again.",
        winnerName: `${prizeLabel(position)} Reset`,
        winnerEmail: "Winner removed",
        winnerPhone: "—",
        prize: prizeLabel(position),
        tickets: 0,
        notes:
          "The previous winner has been removed from this prize only. You can now draw this prize again.",
      });

      await loadEntries();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDrawing(null);
    }
  }

  async function deleteEntry(entry: RaffleEntry) {
    try {
      setDeleting(true);
      setError("");
      setErrorDetails(null);
      setBigMessage(null);

      const res = await fetch("/api/admin/raffle/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete_entry",
          entryId: entry.id,
        }),
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to delete raffle entry",
          details: data,
          status: res.status,
        };
      }

      setDeleteModal(null);

      setBigMessage({
        type: "test",
        title: "Raffle Entry Deleted",
        subtitle: "The selected raffle entry has been deleted.",
        winnerName: entry.full_name,
        winnerEmail: entry.email,
        winnerPhone: entry.phone || "—",
        prize: "Deleted Entry",
        tickets: ticketCount(entry.ticket_amount),
        notes:
          "This entry has been removed from Supabase and will no longer be included in the raffle draw.",
      });

      await loadEntries();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeleting(false);
    }
  }

  async function deleteAllTestEntries() {
    try {
      setDeleting(true);
      setError("");
      setErrorDetails(null);
      setBigMessage(null);

      const res = await fetch("/api/admin/raffle/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete_all_test_entries",
        }),
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to delete all test entries",
          details: data,
          status: res.status,
        };
      }

      setDeleteAllModal(false);

      setBigMessage({
        type: "test",
        title: "Test Entries Deleted",
        subtitle: "All fake test raffle entries have been deleted.",
        winnerName: "Test Entries Removed",
        winnerEmail: `${data.deleted || 0} entries deleted`,
        winnerPhone: "—",
        prize: "Cleaned Test Data",
        tickets: 0,
        notes:
          "Only entries marked as test raffle entries were deleted. Real raffle entries were not removed.",
      });

      await loadEntries();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070716] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Raffle Admin</h1>
              <p className="text-sm text-white/60">
                View raffle entries, paid tickets, total raised, and randomly
                draw winners.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={scrollToDraw}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-pink-500/20 hover:bg-pink-400"
              >
                <Trophy className="h-4 w-4" />
                Go To Draw Raffle
              </button>

              <button
                type="button"
                onClick={testRandomDraw}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-black hover:bg-yellow-300"
              >
                <Sparkles className="h-4 w-4" />
                Test Random Draw
              </button>

              <button
                type="button"
                onClick={createTestEntries}
                disabled={creatingTestEntries}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-400 px-5 py-3 text-sm font-black text-black hover:bg-blue-300 disabled:opacity-60"
              >
                <Bug className="h-4 w-4" />
                {creatingTestEntries ? "Creating..." : "Create 10 Test Entries"}
              </button>

              <button
                type="button"
                onClick={() => setDeleteAllModal(true)}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-400 disabled:opacity-60"
              >
                <Bug className="h-4 w-4" />
                Delete all Test Entries
              </button>

              <button
                type="button"
                onClick={loadEntries}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold hover:bg-white/20"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5">
            <div className="flex items-center gap-2 font-bold text-red-100">
              <Bug className="h-5 w-5" />
              Error
            </div>

            <p className="mt-2 text-sm text-red-100">{error}</p>

            {errorDetails && (
              <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-red-100">
                {JSON.stringify(errorDetails, null, 2)}
              </pre>
            )}
          </section>
        )}

        {bigMessage && (
          <section
            className={`rounded-[2rem] border p-8 shadow-2xl ${
              bigMessage.type === "official"
                ? "border-yellow-300/40 bg-yellow-400/15"
                : "border-blue-300/40 bg-blue-500/15"
            }`}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-3xl ${
                      bigMessage.type === "official"
                        ? "bg-yellow-400 text-black"
                        : "bg-blue-400 text-black"
                    }`}
                  >
                    <Trophy className="h-8 w-8" />
                  </div>

                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-white/60">
                      {bigMessage.type === "official"
                        ? "Official Draw"
                        : "Test Draw"}
                    </p>
                    <h2 className="text-3xl font-black sm:text-5xl">
                      {bigMessage.title}
                    </h2>
                  </div>
                </div>

                <p className="mt-4 max-w-3xl text-base leading-7 text-white/75">
                  {bigMessage.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBigMessage(null)}
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold hover:bg-white/20"
              >
                Close Message
              </button>
            </div>

            <div className="mt-8 rounded-[2rem] border border-white/10 bg-black/25 p-6">
              <p className="text-sm font-bold uppercase tracking-widest text-white/50">
                Winner / Message
              </p>

              <h3 className="mt-2 text-4xl font-black text-white sm:text-6xl">
                {bigMessage.winnerName}
              </h3>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-white/50">Prize</p>
                  <p className="text-lg font-black">{bigMessage.prize}</p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-white/50">Tickets</p>
                  <p className="text-lg font-black">{bigMessage.tickets}</p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-white/50">Email</p>
                  <p className="break-words text-sm font-bold">
                    {bigMessage.winnerEmail}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-white/50">Phone</p>
                  <p className="text-sm font-bold">{bigMessage.winnerPhone}</p>
                </div>
              </div>

              <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/70">
                {bigMessage.notes}
              </p>
            </div>
          </section>
        )}

        {latestWinner && latestDraw && (
          <section className="rounded-3xl border border-yellow-300/30 bg-yellow-400/10 p-5">
            <div className="flex items-center gap-2 text-xl font-black text-yellow-100">
              <Trophy className="h-6 w-6" />
              Last Official Winner
            </div>

            <p className="mt-2 text-white">
              <strong>{latestDraw.prize}</strong> winner is{" "}
              <strong>{latestWinner.full_name}</strong>.
            </p>

            <p className="mt-2 text-sm text-white/60">{latestDraw.notes}</p>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-3xl bg-pink-500/10 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-400/20">
              <Users className="h-5 w-5 text-pink-100" />
            </div>
            <p className="text-sm text-pink-100">Total Entries</p>
            <p className="text-3xl font-bold">{stats.totalEntries}</p>
          </div>

          <div className="rounded-3xl bg-emerald-500/10 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/20">
              <Ticket className="h-5 w-5 text-emerald-100" />
            </div>
            <p className="text-sm text-emerald-100">Paid Entries</p>
            <p className="text-3xl font-bold">{stats.paidEntries}</p>
          </div>

          <div className="rounded-3xl bg-yellow-500/10 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/20">
              <ShieldCheck className="h-5 w-5 text-yellow-100" />
            </div>
            <p className="text-sm text-yellow-100">Started</p>
            <p className="text-3xl font-bold">
              {stats.checkoutStartedEntries}
            </p>
          </div>

          <div className="rounded-3xl bg-blue-500/10 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-400/20">
              <Gift className="h-5 w-5 text-blue-100" />
            </div>
            <p className="text-sm text-blue-100">Tickets In Draw</p>
            <p className="text-3xl font-bold">{stats.totalTickets}</p>
          </div>

          <div className="rounded-3xl bg-purple-500/10 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-400/20">
              <Wallet className="h-5 w-5 text-purple-100" />
            </div>
            <p className="text-sm text-purple-100">Total Raised</p>
            <p className="text-3xl font-bold">
              {money(stats.totalRaisedPence)}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-bold">How the Random Draw Works</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-lg font-black">1 ticket = 1 chance</p>
              <p className="mt-2 text-sm leading-6 text-white/60">
                If someone buys 5 tickets, their entry goes into the draw 5
                times. If someone buys 1 ticket, they go in once.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-lg font-black">Paid entries only</p>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Entries are only included if Stripe has confirmed payment and
                the status is marked as paid.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-lg font-black">Official server draw</p>
              <p className="mt-2 text-sm leading-6 text-white/60">
                The official draw uses crypto.randomInt on the server to choose
                one ticket from the paid ticket pool.
              </p>
            </div>
          </div>
        </section>

        <section
          id="draw-raffle-section"
          ref={drawSectionRef}
          tabIndex={-1}
          className={`scroll-mt-28 rounded-3xl border bg-white/[0.04] p-5 outline-none transition-all duration-500 ${
            drawHighlight
              ? "scale-[1.01] border-pink-300 ring-4 ring-pink-400/80 shadow-2xl shadow-pink-500/40"
              : "border-white/10"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">Draw Winners</h2>
              <p className="mt-1 text-sm text-white/60">
                Winners are drawn from paid entries only. More tickets means
                more chances in the draw. Once someone wins, they are removed
                from the next prize draw.
              </p>
            </div>

            <button
              type="button"
              onClick={testRandomDraw}
              className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-black hover:bg-yellow-300"
            >
              Test Draw Here
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((position) => {
              const existingWinner = stats.winners.find(
                (winner) => winner.raffle_winner_position === position
              );

              return (
                <div
                  key={position}
                  className="rounded-3xl border border-white/10 bg-black/20 p-5"
                >
                  <p className="text-lg font-black">{prizeLabel(position)}</p>

                  {existingWinner ? (
                    <div className="mt-3 rounded-2xl bg-yellow-400/10 p-4">
                      <p className="font-bold text-yellow-100">
                        {existingWinner.full_name}
                      </p>

                      <p className="mt-1 text-xs text-white/60">
                        {existingWinner.email}
                      </p>

                      <p className="mt-1 text-xs text-white/60">
                        Phone: {existingWinner.phone || "—"}
                      </p>

                      <p className="mt-1 text-xs text-white/60">
                        Tickets: {ticketCount(existingWinner.ticket_amount)}
                      </p>

                      <p className="mt-1 text-xs text-white/60">
                        Drawn: {formatDate(existingWinner.raffle_won_at)}
                      </p>

                      {existingWinner.raffle_draw_notes && (
                        <p className="mt-2 text-xs text-white/50">
                          {existingWinner.raffle_draw_notes}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => setRedoModal(position)}
                        disabled={drawing !== null}
                        className="mt-4 w-full rounded-2xl border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Redo {prizeLabel(position)}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDrawModal(position)}
                      disabled={drawing !== null || stats.totalTickets < 1}
                      className="mt-4 w-full rounded-2xl bg-pink-500 px-4 py-3 text-sm font-black text-white hover:bg-pink-400 disabled:opacity-50"
                    >
                      Draw {prizeLabel(position)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Raffle Entries</h2>
              <p className="text-sm text-white/60">
                All raffle checkouts and paid entries.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "paid", "checkout_started", "winners"] as const).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${
                      filter === item
                        ? "bg-white text-black"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {item === "all"
                      ? "All"
                      : item === "paid"
                      ? "Paid"
                      : item === "checkout_started"
                      ? "Started"
                      : "Winners"}
                  </button>
                )
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-white/60">Loading raffle entries...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-white/60">No raffle entries found.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[1350px] text-sm">
                <thead className="bg-white/10 text-white/60">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Phone</th>
                    <th className="p-3 text-left">Tickets</th>
                    <th className="p-3 text-left">Payment</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-left">Winner</th>
                    <th className="p-3 text-left">Message</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-white/10">
                      <td className="p-3">{formatDate(entry.created_at)}</td>

                      <td className="p-3 font-bold">{entry.full_name}</td>

                      <td className="p-3">{entry.email}</td>

                      <td className="p-3">{entry.phone || "—"}</td>

                      <td className="p-3 font-bold">
                        {ticketCount(entry.ticket_amount)}
                      </td>

                      <td className="p-3">
                        <span
                          className={`rounded-xl px-3 py-2 text-xs font-bold ${
                            entry.payment_status === "paid"
                              ? "bg-emerald-500/15 text-emerald-100"
                              : entry.payment_status === "checkout_started"
                              ? "bg-yellow-500/15 text-yellow-100"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          {entry.payment_status || "not_paid"}
                        </span>
                      </td>

                      <td className="p-3 text-right font-bold">
                        {money(entry.amount_pence || 0)}
                      </td>

                      <td className="p-3">
                        {entry.raffle_winner_position ? (
                          <span className="rounded-xl bg-yellow-400/15 px-3 py-2 text-xs font-black text-yellow-100">
                            {prizeLabel(entry.raffle_winner_position)}
                          </span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>

                      <td className="p-3 text-white/60">
                        <div className="max-w-[280px] whitespace-pre-wrap">
                          {entry.message || "—"}
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteModal(entry)}
                          disabled={deleting}
                          className="rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 hover:bg-red-500/25 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-300/20 bg-[#070716] p-6 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-100">
                <Bug className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-red-200/70">
                  Delete Entry
                </p>
                <h2 className="text-xl font-black">Delete raffle entry?</h2>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="font-black text-white">{deleteModal.full_name}</p>
              <p className="mt-1 text-sm text-white/60">
                {deleteModal.email}
              </p>
              <p className="mt-1 text-sm text-white/60">
                Tickets: {ticketCount(deleteModal.ticket_amount)}
              </p>
              <p className="mt-1 text-sm text-white/60">
                Payment: {deleteModal.payment_status || "not_paid"}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              This will permanently delete this raffle entry from Supabase.
              This cannot be undone.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => deleteEntry(deleteModal)}
                disabled={deleting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Yes, Delete Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-300/20 bg-[#070716] p-6 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-100">
                <Bug className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-red-200/70">
                  Delete Test Entries
                </p>
                <h2 className="text-xl font-black">
                  Delete all test entries?
                </h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-white/70">
              This will delete all fake test raffle entries created by the
              <strong> Create 10 Test Entries</strong> button.
            </p>

            <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              Real raffle entries will not be deleted. Only entries with test
              email/session details will be removed.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteAllModal(false)}
                disabled={deleting}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteAllTestEntries}
                disabled={deleting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Yes, Delete Test Entries"}
              </button>
            </div>
          </div>
        </div>
      )}

      {redoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-300/20 bg-[#070716] p-6 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-100">
                <RefreshCcw className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-red-200/70">
                  Redo Draw
                </p>
                <h2 className="text-xl font-black">
                  Redo {prizeLabel(redoModal)}?
                </h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-white/70">
              This will remove the current saved winner for{" "}
              <strong>{prizeLabel(redoModal)}</strong>. After this, you can draw
              that prize again.
            </p>

            <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              This does not delete the raffle entry. It only clears the winner
              fields for this prize.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRedoModal(null)}
                disabled={drawing !== null}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => redoDraw(redoModal)}
                disabled={drawing !== null}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white hover:bg-red-400 disabled:opacity-60"
              >
                {drawing ? "Resetting..." : `Yes, Redo ${prizeLabel(redoModal)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {drawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">
              Draw {prizeLabel(drawModal)}?
            </h2>

            <p className="mt-3 text-sm text-white/70">
              This will randomly choose one winning ticket from all paid tickets.
              If someone bought 5 tickets, they have 5 chances. Once a person
              wins, they cannot win another prize.
            </p>

            <div className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
              This action saves the winner in Supabase. Only click this when you
              are ready to do the official draw.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDrawModal(null)}
                disabled={drawing !== null}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => drawWinner(drawModal)}
                disabled={drawing !== null}
                className="rounded-xl bg-pink-500 px-4 py-2 text-sm font-bold text-white hover:bg-pink-400 disabled:opacity-60"
              >
                {drawing ? "Drawing..." : "Draw Winner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}