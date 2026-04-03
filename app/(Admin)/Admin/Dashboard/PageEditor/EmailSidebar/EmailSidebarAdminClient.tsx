"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  label: string;
  href: string;
  icon: string;
  is_enabled: boolean;
};

export default function EmailSidebarAdminClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [icon, setIcon] = useState("Mail");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/admin/email-sidebar");
    const data = await res.json();
    setItems(data.items || []);
  }

  async function create() {
    if (!label || !href) return;

    setLoading(true);

    await fetch("/api/admin/email-sidebar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ label, href, icon }),
    });

    setLabel("");
    setHref("");
    setIcon("Mail");

    await load();
    setLoading(false);
  }

  async function remove(id: string) {
    await fetch(`/api/admin/email-sidebar/${id}`, {
      method: "DELETE",
    });

    await load();
  }

  async function toggle(item: Item) {
    await fetch(`/api/admin/email-sidebar/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_enabled: !item.is_enabled,
      }),
    });

    await load();
  }

  return (
    <div className="mx-auto max-w-4xl p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">Email Sidebar Manager</h1>

      {/* CREATE */}
      <div className="mb-8 rounded-2xl bg-white/10 p-4">
        <h2 className="mb-4 font-semibold">Add new item</h2>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-lg p-2 text-black"
          />

          <input
            placeholder="/Admin/Email/Example"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            className="rounded-lg p-2 text-black"
          />

          <select
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="rounded-lg p-2 text-black"
          >
            <option>Mail</option>
            <option>Send</option>
            <option>FileText</option>
            <option>History</option>
            <option>TestTube2</option>
            <option>Settings</option>
            <option>PenSquare</option>
          </select>
        </div>

        <button
          onClick={create}
          disabled={loading}
          className="mt-4 rounded-xl bg-white px-4 py-2 font-bold text-black"
        >
          {loading ? "Adding..." : "Add item"}
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl bg-white/10 p-4"
          >
            <div>
              <div className="font-semibold">{item.label}</div>
              <div className="text-sm text-white/60">{item.href}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => toggle(item)}
                className="rounded-lg border px-3 py-1 text-sm"
              >
                {item.is_enabled ? "Disable" : "Enable"}
              </button>

              <button
                onClick={() => remove(item.id)}
                className="rounded-lg bg-red-500 px-3 py-1 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}