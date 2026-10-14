import { defineApp } from "convex/server";
import aggregate from "@convex-dev/aggregate/convex.config";
import migrations from "@convex-dev/migrations/convex.config";

const app = defineApp();
app.use(aggregate);

app.use(migrations);

export default app;
