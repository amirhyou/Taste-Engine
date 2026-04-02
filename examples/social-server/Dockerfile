# Build context must be the monorepo root so the core package is available.
# docker build -f examples/social-server/Dockerfile .

FROM node:20-alpine
WORKDIR /repo

# Copy monorepo root files needed for workspace setup
COPY package.json package-lock.json tsconfig.base.json ./

# Copy @taste-engine/core (local workspace dependency)
COPY packages/core/package.json    ./packages/core/
COPY packages/core/src/            ./packages/core/src/
COPY packages/core/tsconfig.json   ./packages/core/

# Copy social server source
COPY examples/social-server/package.json   ./examples/social-server/
COPY examples/social-server/src/           ./examples/social-server/src/
COPY examples/social-server/tsconfig.json  ./examples/social-server/

# Install all workspace deps (sets up @taste-engine/core symlink)
RUN npm ci --ignore-scripts

# Build core first, then server
RUN npm run build -w packages/core
RUN npm run build -w examples/social-server

WORKDIR /repo/examples/social-server
EXPOSE 3001

CMD ["node", "dist/index.js"]
