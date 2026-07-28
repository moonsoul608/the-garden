export const VISITOR_NOTE_MAX_NAME_LENGTH = 80;
export const VISITOR_NOTE_MAX_MESSAGE_LENGTH = 1200;
export const VISITOR_NOTE_MIN_MESSAGE_LENGTH = 2;
export const VISITOR_NOTE_MAX_LINKS = 3;

export type VisitorNoteInput = {
  name: string | null;
  message: string;
};

export type VisitorNoteValidationResult =
  | { ok: true; note: VisitorNoteInput }
  | { ok: false; error: string };

function cleanText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countLinks(value: string) {
  return value.match(/https?:\/\/|www\./gi)?.length ?? 0;
}

export function prepareVisitorNoteInput(input: {
  name?: unknown;
  message?: unknown;
}): VisitorNoteValidationResult {
  if (typeof input.message !== "string") {
    return { ok: false, error: "Please leave a note before sending." };
  }

  const message = cleanText(input.message);
  const name = typeof input.name === "string" ? cleanText(input.name) : "";

  if (message.length < VISITOR_NOTE_MIN_MESSAGE_LENGTH) {
    return { ok: false, error: "Please leave a note before sending." };
  }

  if (message.length > VISITOR_NOTE_MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Please keep your note under ${VISITOR_NOTE_MAX_MESSAGE_LENGTH} characters.`,
    };
  }

  if (name.length > VISITOR_NOTE_MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `Please keep your name under ${VISITOR_NOTE_MAX_NAME_LENGTH} characters.`,
    };
  }

  if (countLinks(message) > VISITOR_NOTE_MAX_LINKS) {
    return {
      ok: false,
      error: "Please send a note with fewer links.",
    };
  }

  return {
    ok: true,
    note: {
      name: name || null,
      message,
    },
  };
}

