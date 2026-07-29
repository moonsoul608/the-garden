export type GrowthNoteActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
}>;

export const INITIAL_GROWTH_NOTE_ACTION_STATE: GrowthNoteActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
