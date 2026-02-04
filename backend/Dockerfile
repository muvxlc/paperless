FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install

COPY . .

EXPOSE 3001

# Run migrations, seed default admin, and then start the server
CMD ["sh", "-c", "bun run db:push && bun run src/scripts/seed.ts && bun run start"]
