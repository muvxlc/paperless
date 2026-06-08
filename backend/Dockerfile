FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install

COPY . .

EXPOSE 3001

# Start the server (Run db:init automatically to ensure tables exist, then start)
CMD ["sh", "-c", "bun run db:init && bun run start"]
