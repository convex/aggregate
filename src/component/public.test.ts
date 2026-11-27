import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TestConvex } from "convex-test";
import type schema from "./schema.js";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function treeNames(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("btree").collect()).map((tree) => ({
      namespace: tree.namespace,
      name: tree.name,
    })),
  );
}

describe("name", () => {
  test("is stored on trees created by writes", async () => {
    const t = initConvexTest();
    await t.mutation(api.public.insert, {
      key: 1,
      value: "a",
      namespace: "x",
      name: "scores",
    });
    await t.mutation(api.public.insert, { key: 2, value: "b", namespace: "y" });
    expect(await treeNames(t)).toEqual([
      { namespace: "x", name: "scores" },
      { namespace: "y", name: undefined },
    ]);
  });

  test("is stored on trees created by queued writes", async () => {
    const t = initConvexTest();
    await t.mutation(api.public.enqueue, {
      operation: {
        type: "insert",
        key: 1,
        value: "a",
        namespace: "x",
        name: "scores",
      },
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await treeNames(t)).toEqual([{ namespace: "x", name: "scores" }]);
  });

  test("scopes clear to its aggregate", async () => {
    const t = initConvexTest();
    await t.mutation(api.public.insert, { key: 1, value: "a", name: "scores" });
    await t.mutation(api.public.insert, { key: 1, value: "a" });
    await t.mutation(api.public.clear, { name: "scores" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.query(api.btree.aggregateBetween, { name: "scores" }),
    ).toEqual({ count: 0, sum: 0 });
    expect(await t.query(api.btree.aggregateBetween, {})).toEqual({
      count: 1,
      sum: 0,
    });
  });
});
