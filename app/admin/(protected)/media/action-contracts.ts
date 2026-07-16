export type MediaActionStatus = "idle" | "error" | "success";

export type MediaActionState = Readonly<{
  status: MediaActionStatus;
  message: string | null;
  objectPath: string | null;
  previousObjectPath: string | null;
}>;

export const INITIAL_MEDIA_ACTION_STATE: MediaActionState = {
  status: "idle",
  message: null,
  objectPath: null,
  previousObjectPath: null,
};

