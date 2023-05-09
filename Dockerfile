# Stage 1: Build the TypeScript application
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:18-alpine as production
LABEL authors="Maxim Vinogradov <vinogradov.v.maxim@gmail.com>"

WORKDIR /app

COPY entrypoint.sh /app/entrypoint.sh

# Install production-only dependencies and generate Prisma client
COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist /app/dist

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/main.js"]
