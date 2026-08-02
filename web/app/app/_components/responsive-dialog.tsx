// Re-export barrel — the overlay primitive moved to the `core` slice. App internals keep importing
// from `./responsive-dialog`; source of truth is @/features/core.
export { ResponsiveDialog, ConfirmDialog, useConfirm } from "@/features/core";
