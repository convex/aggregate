---
"@convex-dev/aggregate": minor
---

Allow multiple aggregates to share one component, by passing the `name` option
to `TableAggregate` and `DirectAggregate`.

Each aggregate in a component should have a unique name. Defining two aggregates
with the same name will make them share the same data.

`name` is undefined for existing aggregates from before this version. To
upgrade, pass `name: undefined` to your existing aggregates. Omitting `name` is
deprecated and will not be supported in a future release.

To migrate an existing unnamed aggregate into a named aggregate, backfill the
named aggregate from your table as in "Attach Aggregate to an existing table" in
the README, then clear the old one with `clearAll` or remove its component.

`paginateNamespaces` cursors from earlier versions can't be reused because the
cursor format changes; restart the pagination from the beginning.

0.4.0 uses a new index, `by_name_namespace`. If you have a large number of
namespaces, you can backfill the new index asynchronously to avoid blocking code
push by first deploying 0.3.5 of the aggregate. This stages the index and builds
it in the background. To check its progress, open your deployment's dashboard,
go to **Data**, select the aggregate component (e.g. `aggregate`), open the
`btree` table, and choose **Indexes** from the **⋮** menu. Once it shows
**Backfill completed**, deploy 0.4.0. If you deploy 0.4.0 before the index is
ready, the deploy will wait until the index finishes building.
