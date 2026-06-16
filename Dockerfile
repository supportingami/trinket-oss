# --- Stage 1: Build & Install dependencies ---
FROM node:16-bullseye AS builder

SHELL ["/bin/bash", "-c"]

# Install build dependencies for native addon compilation (e.g. bcrypt)
RUN apt-get update \
    && apt-get install -y python3 build-essential \
    && apt-get -y autoclean

WORKDIR /usr/local/node/trinket

# Copy package definition files
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies like vite/sass for CSS building)
RUN npm install --legacy-peer-deps

# Copy the rest of the application files
COPY . .

# Download frontend components from GitHub release
RUN curl -L --silent -o ./public-components.tgz \
    https://github.com/trinketapp/trinket-oss/releases/download/v1.1.0/public-components.tgz \
    && tar xzf public-components.tgz \
    && rm public-components.tgz

# Build CSS assets for distribution
RUN npm run build:css

# Prune devDependencies to keep the runtime node_modules minimal
RUN npm prune --production

# --- Stage 2: Production runtime environment ---
FROM node:16-slim AS runner

SHELL ["/bin/bash", "-c"]

# Install global PM2 to manage processes in container
RUN npm install -g pm2@5

# Create a non-root group and user
RUN groupadd -r trinket && \
    useradd -r -g trinket -m -c "trinket user" trinket

# Set up the application directory
RUN mkdir -p /usr/local/node/trinket && chown trinket:trinket /usr/local/node/trinket

USER trinket
WORKDIR /usr/local/node/trinket

# Copy only the built assets, code, and pruned node_modules from the builder stage
COPY --from=builder --chown=trinket:trinket /usr/local/node/trinket /usr/local/node/trinket

ARG COMMIT_ID
ARG NODE_ENV
ENV NODE_ENV=$NODE_ENV

EXPOSE 3000

CMD ["bash", "-c", "node scripts/generate-config.js && pm2-docker start app.js"]
