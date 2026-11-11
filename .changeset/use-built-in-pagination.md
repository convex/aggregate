---
"@convex-dev/aggregate": patch
---

Use Convex's built-in pagination for `deadLetter.list` (#279). Existing saved
cursors cannot be reused because the cursor format changes, and callers must
observe Convex's one-pagination-per-query limit when calling this function from
a query.
