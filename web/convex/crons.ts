import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Bound the anti-abuse rateLimits table: drop windows that have already reset.
crons.interval("sweep expired rate-limit rows", { hours: 6 }, internal.rateLimit.sweep, {});
crons.interval("curate memory", { hours: 24 }, internal.memoryCuration.curateMemories, {});
crons.interval("prune stale channel events", { hours: 12 }, internal.channelsIngest.pruneEvents, {});
crons.interval("run due agent schedules", { minutes: 5 }, internal.scheduledAgentsRun.runDue, {});
crons.interval("roll up workspace usage", { hours: 6 }, internal.usageRollups.rollupDay, {});
crons.interval("prune old audit events", { hours: 24 }, internal.audit.pruneAudit, {});
export default crons;
