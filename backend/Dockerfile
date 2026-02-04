FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install

COPY . .

EXPOSE 3001

# Start the server (Migration must be run manually: bun run db:push)
CMD ["bun", "run", "start"]
