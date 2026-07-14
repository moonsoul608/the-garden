# The Garden V2 Phase 02B Report

Task: `02B Storage`  
Report date: `2026-07-14`  
Repository: `D:\the-garden\the-garden-codex-docs\the-garden-codex-docs`

This report covers the repository configuration and completed manual Supabase Dashboard verification for the Version 2 cover-image Storage bucket. The project uses a Dashboard-first manual Supabase workflow, so repository configuration and Dashboard execution are recorded as two explicit parts of Phase 02B.

# 1. Repository Configuration Completed

Added `supabase/config.toml` with the following declaration:

- bucket identifier: `cover-images`;
- access model: private (`public = false`);
- maximum file size: `5MiB`;
- allowed MIME types: `image/jpeg`, `image/png`, and `image/webp`.

The confirmed future object-path convention is:

```text
contents/{content-id}/{unique-file-name}
```

No object, image, seed data, or Storage policy is included in the repository configuration.

# 2. Supabase Dashboard Verification Completed

Manual verification confirmed that the `cover-images` bucket was created in the intended non-Production Supabase project with the following final configuration:

- bucket identifier: `cover-images`;
- visibility: private;
- file-size limit: 5 MB in the Dashboard (`5MiB` in the repository declaration);
- allowed MIME types: `image/jpeg`, `image/png`, and `image/webp`.

The Dashboard verification also confirmed that no Storage policies were created and that no Auth or RLS configuration changed.

# 3. Deferred Security and Application Work

Storage policies remain deferred to Phase 02D. This task adds no RLS policy and does not define public-read access for Published covers or Garden Keeper write permissions.

The following remain deferred to their approved later phases:

- Garden Keeper authentication and authorization;
- upload UI and Auth integration;
- upload, replace, remove, and unused-object cleanup workflows;
- application and Supabase client integration;
- Published-cover delivery;
- cover validation in the application;
- existing-image migration.

# 4. Scope and Status

No existing migration SQL, Supabase client file, environment file, dependency file, application code, Auth configuration, content record, or image file was changed.

Repository configuration and remote Dashboard verification for the bucket, allowed formats, and upload-size limit are complete. Storage access behavior, Garden Keeper permissions, policies, and application integration remain pending. Phase 2 acceptance is not complete.
