export type VisitorNoteActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string | null;
}>;

export const INITIAL_VISITOR_NOTE_ACTION_STATE: VisitorNoteActionState = {
  status: "idle",
  message: null,
};
