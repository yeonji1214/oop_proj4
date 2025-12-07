# Build frontend assets
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Allow overriding API root / project id at build time
ARG VITE_API_ROOT
ARG VITE_PROJECT_ID
ENV VITE_API_ROOT=${VITE_API_ROOT}
ENV VITE_PROJECT_ID=${VITE_PROJECT_ID}

RUN npm run build

# Serve built assets with a lightweight static server (no nginx)
FROM node:20-alpine AS serve

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
