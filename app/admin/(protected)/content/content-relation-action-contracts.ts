export type ContentRelationActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
}>;

export const INITIAL_CONTENT_RELATION_ACTION_STATE: ContentRelationActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
