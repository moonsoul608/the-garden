export type LocalNoteReceipt = {
  sentAt: string;
  excerpt?: string;
};

export const LOCAL_NOTE_RECEIPTS_STORAGE_KEY =
  "the-garden:local-note-receipts:v2";
export const LOCAL_NOTE_RECEIPTS_CHANGED_EVENT =
  "the-garden:local-note-receipts-changed";
export const LOCAL_NOTE_RECEIPTS_LIMIT = 10;
export const LOCAL_NOTE_RECEIPT_EXCERPT_LENGTH = 120;

function cleanExcerpt(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, LOCAL_NOTE_RECEIPT_EXCERPT_LENGTH)
    .trim();
}

function isLocalNoteReceipt(value: unknown): value is LocalNoteReceipt {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LocalNoteReceipt>;
  return (
    typeof candidate.sentAt === "string" &&
    !Number.isNaN(Date.parse(candidate.sentAt)) &&
    (candidate.excerpt === undefined || typeof candidate.excerpt === "string")
  );
}

function newestFirst(left: LocalNoteReceipt, right: LocalNoteReceipt) {
  return Date.parse(right.sentAt) - Date.parse(left.sentAt);
}

export function readLocalNoteReceipts(): LocalNoteReceipt[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(
      LOCAL_NOTE_RECEIPTS_STORAGE_KEY,
    );
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isLocalNoteReceipt)
      .map((receipt) => ({
        sentAt: receipt.sentAt,
        ...(receipt.excerpt ? { excerpt: receipt.excerpt } : {}),
      }))
      .sort(newestFirst)
      .slice(0, LOCAL_NOTE_RECEIPTS_LIMIT);
  } catch {
    return [];
  }
}

function writeLocalNoteReceipts(receipts: LocalNoteReceipt[]) {
  try {
    window.localStorage.setItem(
      LOCAL_NOTE_RECEIPTS_STORAGE_KEY,
      JSON.stringify(receipts.slice(0, LOCAL_NOTE_RECEIPTS_LIMIT)),
    );
    window.dispatchEvent(new Event(LOCAL_NOTE_RECEIPTS_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function saveLocalNoteReceipt(message: string) {
  const excerpt = cleanExcerpt(message);
  return writeLocalNoteReceipts([
    {
      sentAt: new Date().toISOString(),
      ...(excerpt ? { excerpt } : {}),
    },
    ...readLocalNoteReceipts(),
  ]);
}
