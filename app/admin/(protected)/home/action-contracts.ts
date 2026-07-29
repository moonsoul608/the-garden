export type HomeCurationActionStatus = "idle" | "error" | "success";

export type HomeCurationActionState = Readonly<{
  status: HomeCurationActionStatus;
  message: string | null;
}>;

export const INITIAL_HOME_CURATION_ACTION_STATE: HomeCurationActionState = {
  status: "idle",
  message: null,
};
