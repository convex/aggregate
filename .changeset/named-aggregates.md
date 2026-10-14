---
"@convex-dev/aggregate": minor
---

Breaking: `TableAggregate` and `DirectAggregate` now require a `name`, and
aggregates with different names can share one component instead of each needing
its own `app.use`. Passing `name: undefined` is deprecated and keeps using the
data stored by earlier versions. To move existing data to a name, rebuild the
aggregate under it; see "Upgrade from 0.3.x" in the README.
