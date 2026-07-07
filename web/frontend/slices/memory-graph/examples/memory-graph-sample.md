# Memory graph sample

Super Space is the AI workspace app we're building: a BYOK chat + agents playground running on @[Convex].
Convex powers the backend — reactive queries, self-hosted, and where every memory is stored via /[memory] and read back with /[recall_memory].
BYOK provider registry lets each user bring their own API keys; the @[list_my_providers] tool lists whatever they've connected.
Agent config pairs each agent with skills like @[Researcher] and @[Code reviewer], plus the tools it may call such as /[chat].
Spend caps guard the budget: every model call checks the cap before running, and users watch their burn with /[get_my_usage].
MCP server exposes our tools to Claude and ChatGPT over OAuth PKCE, so external clients can call /[recall_memory] too.
Memory graph visualizes how memories, agents, skills and tools connect — the feature you're looking at, backed by @[Convex].
Deployment runs on Dokploy — a git push triggers the build; we used the @[Planner] skill to sequence the @[MCP server] rollout after @[Spend caps] shipped.
Onboarding new devs: skim @[Super Space], the @[BYOK provider registry], and how @[Agent config] wires skills to tools — and keep notes /[terse].
