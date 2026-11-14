# Separate milestone recovery files

The complete working project is at the repository root. These files preserve the milestones separately; they are not substitutes for the working tree.

- `MILESTONE_1.patch`: commits after original baseline `f82b293` through `aeb54a6` (3D terrain and final verification).
- `MILESTONE_2.patch`: commits after `aeb54a6` through `ee376b6` (hazard analysis and slope-discrepancy investigation).
- Separate acceptance reports: `docs/MILESTONE1_ACCEPTANCE.md` and `docs/MILESTONE2_ACCEPTANCE.md`.

Use `git am` on the corresponding base only when recovering a missing milestone. Do not apply these patches to this final repository: their commits are already ancestors of main. The original complete Milestone 1 ZIP remains at the root for existing download links.
