import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { DatabaseReader, MutationCtx } from "./_generated/server.js";
import { internalMutation } from "./_generated/server.js";

export const DEFAULT_MAX_NODE_SIZE = 16;

export const vTreeConfig = v.object({
  maxNodeSize: v.optional(v.number()),
  rootLazy: v.optional(v.boolean()),
});

export function validateMaxNodeSize(maxNodeSize: number) {
  if (
    !Number.isInteger(maxNodeSize) ||
    maxNodeSize % 2 !== 0 ||
    maxNodeSize < 4
  ) {
    throw new Error(
      `maxNodeSize must be an even integer of at least 4, got ${maxNodeSize}`,
    );
  }
}

/**
 * Stores the install-time defaults for trees created from now on. Existing
 * trees keep the maxNodeSize and root laziness they were built with: changing
 * them means rebuilding the tree, which can't fit in the push transaction.
 *
 * Only writes when the args change, since every tree creation reads this
 * document and a write on each push would conflict with those mutations.
 */
export async function applyInstallArgs(
  ctx: Pick<MutationCtx, "db">,
  { maxNodeSize, rootLazy }: Infer<typeof vTreeConfig>,
) {
  if (maxNodeSize !== undefined) {
    validateMaxNodeSize(maxNodeSize);
  }
  const existing = await ctx.db.query("config").unique();
  if (!existing) {
    await ctx.db.insert("config", { maxNodeSize, rootLazy });
  } else if (
    existing.maxNodeSize !== maxNodeSize ||
    existing.rootLazy !== rootLazy
  ) {
    await ctx.db.replace("config", existing._id, { maxNodeSize, rootLazy });
  }
}

export const init = internalMutation({
  args: vTreeConfig.fields,
  returns: v.null(),
  handler: async (ctx, args) => {
    await applyInstallArgs(ctx, args);
    return null;
  },
});

export async function getConfig(db: DatabaseReader) {
  return await db.query("config").unique();
}
