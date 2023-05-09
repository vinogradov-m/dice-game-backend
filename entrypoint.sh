#!/usr/bin/env sh
# Run Prisma migrations
npx prisma migrate deploy
# Start the application
exec "$@"
