export type ReviewActionStatus =
  | "idle"
  | "success"
  | "error"
  | "conflict";

export type ReviewActionState = Readonly<{
  status: ReviewActionStatus;
  message: string | null;
  destination: string | null;
  publishedAt: string | null;
}>;

export const INITIAL_REVIEW_ACTION_STATE: ReviewActionState = {
  status: "idle",
  message: null,
  destination: null,
  publishedAt: null,
};
