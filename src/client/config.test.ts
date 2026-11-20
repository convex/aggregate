import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { defineSchema } from "convex/server";
import { DirectAggregate } from "./index.js";
import {
  components,
  componentSchema,
  componentModules,
  modules,
} from "./setup.test.js";
import { applyInstallArgs } from "../component/config.js";

const schema = defineSchema({});

type Ns = DirectAggregate<{ Key: number; Id: string; Namespace: string }>;

function setup(args?: Record<string, unknown>) {
  const t = convexTest(schema, modules);
  t.registerComponent("aggregate", componentSchema, componentModules, {
    args,
  });
  return t;
}

async function inComponent<T>(
  t: ReturnType<typeof setup>,
  fn: (ctx: any) => Promise<T>,
): Promise<T> {
  return await (t as any).runInComponent("aggregate", fn);
}

async function trees(t: ReturnType<typeof setup>) {
  return await inComponent(t, async (ctx) => {
    const result: Record<string, { maxNodeSize: number; rootLazy: boolean }> =
      {};
    for (const tree of await ctx.db.query("btree").collect()) {
      const root = await ctx.db.get("btreeNode", tree.root);
      result[tree.namespace ?? ""] = {
        maxNodeSize: tree.maxNodeSize,
        rootLazy: root.aggregate === undefined,
      };
    }
    return result;
  });
}

describe("install args", () => {
  const aggregate: Ns = new DirectAggregate(components.aggregate);

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("trees created at runtime use the install args", async () => {
    const t = setup({ maxNodeSize: 4, rootLazy: false });
    await t.run(async (ctx) => {
      for (let i = 0; i < 10; i++) {
        await aggregate.insert(ctx, { namespace: "a", key: i, id: `${i}` });
      }
    });
    expect(await trees(t)).toEqual({
      a: { maxNodeSize: 4, rootLazy: false },
    });
    expect(
      await t.run((ctx) => aggregate.count(ctx, { namespace: "a" })),
    ).toEqual(10);
  });

  test("without args, trees use the built-in defaults", async () => {
    const t = setup();
    await t.run((ctx) =>
      aggregate.insert(ctx, { namespace: "a", key: 1, id: "1" }),
    );
    expect(await trees(t)).toEqual({ a: { maxNodeSize: 16, rootLazy: true } });
  });

  test("changed args apply to new trees, not existing or cleared ones", async () => {
    const t = setup({ maxNodeSize: 4 });
    await t.run((ctx) =>
      aggregate.insert(ctx, { namespace: "old", key: 1, id: "1" }),
    );
    // A later push with different args.
    await inComponent(t, (ctx) =>
      applyInstallArgs(ctx, { maxNodeSize: 8, rootLazy: false }),
    );
    await t.run((ctx) =>
      aggregate.insert(ctx, { namespace: "new", key: 1, id: "1" }),
    );
    expect(await trees(t)).toEqual({
      old: { maxNodeSize: 4, rootLazy: true },
      new: { maxNodeSize: 8, rootLazy: false },
    });

    await t.run((ctx) => aggregate.clear(ctx, { namespace: "old" }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await trees(t)).old).toEqual({ maxNodeSize: 4, rootLazy: true });
  });

  test("new trees fall back to the default-namespace tree, below the install args", async () => {
    const withoutArgs = setup();
    await withoutArgs.mutation(components.aggregate.public.clear, {
      maxNodeSize: 4,
      rootLazy: false,
    });
    await withoutArgs.run((ctx) =>
      aggregate.insert(ctx, { namespace: "a", key: 1, id: "1" }),
    );
    expect((await trees(withoutArgs)).a).toEqual({
      maxNodeSize: 4,
      rootLazy: false,
    });

    const withArgs = setup({ maxNodeSize: 8 });
    await withArgs.mutation(components.aggregate.public.clear, {
      maxNodeSize: 4,
      rootLazy: false,
    });
    await withArgs.run((ctx) =>
      aggregate.insert(ctx, { namespace: "a", key: 1, id: "1" }),
    );
    expect((await trees(withArgs)).a).toEqual({
      maxNodeSize: 8,
      rootLazy: false,
    });
  });

  test("an explicit clear option overrides the install args", async () => {
    const t = setup({ maxNodeSize: 8 });
    await t.run((ctx) =>
      aggregate.clear(ctx, { namespace: "a", maxNodeSize: 4 }),
    );
    expect((await trees(t)).a.maxNodeSize).toEqual(4);
  });

  test("an invalid maxNodeSize fails the push", async () => {
    const t = setup({ maxNodeSize: 5 });
    await expect(t.runInits()).rejects.toThrow(/maxNodeSize must be an even/);
  });

  test("args of the wrong type fail validation", async () => {
    const t = setup({ maxNodeSize: "16" });
    await expect(t.runInits()).rejects.toThrow(
      /Invalid arguments for the init/,
    );
  });
});
