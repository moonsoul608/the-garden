export type ContentFormStatus = "idle" | "error" | "conflict" | "success";

export type ContentFormState = Readonly<{
  status: ContentFormStatus;
  message: string | null;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  revisionId: string | null;
  lockVersion: number | null;
  updatedAt: string | null;
}>;

export const INITIAL_CONTENT_FORM_STATE: ContentFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  revisionId: null,
  lockVersion: null,
  updatedAt: null,
};
