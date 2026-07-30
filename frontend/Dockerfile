# Vite 8 requires Node >= 20.19 / 22.12. Pin 22 so the rolldown native
# bindings resolve to a musl build that actually exists.
FROM node:22-alpine

WORKDIR /app

# Copy the manifests first so `npm ci` is cached and only re-runs when a
# dependency actually changes, not on every source edit.
COPY package.json package-lock.json ./

# `ci` not `install`: installs exactly what the lockfile pins, and refuses to
# silently rewrite it inside the image.
RUN npm ci

COPY . .

EXPOSE 5173

# --host binds 0.0.0.0. Without it Vite listens on the container's loopback
# only, and the published port maps to nothing.
CMD ["npm", "run", "dev", "--", "--host"]
