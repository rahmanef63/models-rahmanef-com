# Next.js standalone image for the dashboard. The app lives in web/ (the repo root also holds
# the @rahmanef/models library), so the build context is the repo root and we build web/.
# Convex stays on Convex Cloud — only the public URL is baked in (NEXT_PUBLIC_CONVEX_URL buildArg).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG NEXT_PUBLIC_CONVEX_URL
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
RUN mkdir -p public && pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
