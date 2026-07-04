import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Bound the anti-abuse rateLimits table: drop windows that have already reset.
crons.interval("sweep expired rate-limit rows", { hours: 6 }, internal.rateLimit.sweep, {});
export default crons;
