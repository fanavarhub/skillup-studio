FROM node:26.13.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node lib/ ./lib/
COPY --chown=node:node dist/ ./dist/
COPY --chown=node:node tools/backup.mjs ./tools/backup.mjs
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
