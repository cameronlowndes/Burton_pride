export type AnnouncementRecipient = {
  id: string;
  name: string;
  selectable: boolean;
};

/** IDs remain internal routing keys. Never turn an ID or the old generated
 * Administrator+ID placeholder into a visible recipient label. */
export function recipientLabel(person: Record<string, unknown>): string | null {
  for (const value of [
    person.username,
    person.name,
    person.display_name,
    person.displayName,
    person.full_name,
  ]) {
    if (typeof value !== "string") continue;
    const label = value.trim();
    if (
      !label ||
      label === person.id ||
      label === "Username not set" ||
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(label) ||
      /^Administrator [a-f0-9-]{8,36}$/i.test(label)
    )
      continue;
    return label;
  }
  return null;
}

export function announcementRecipients(
  input: unknown,
): AnnouncementRecipient[] {
  if (!Array.isArray(input)) return [];
  return input
    .flatMap((value) => {
      if (!value || typeof value !== "object" || typeof value.id !== "string")
        return [];
      const name = recipientLabel(value as Record<string, unknown>);
      return [
        {
          id: value.id,
          name: name ?? "Username not set",
          selectable: !!name && value.selectable !== false,
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.selectable) - Number(a.selectable) ||
        a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" }),
    );
}
