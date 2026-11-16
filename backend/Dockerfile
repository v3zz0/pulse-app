FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54
WORKDIR /app
ENV STRAPI_TELEMETRY_DISABLED=true
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY --chown=node:node . .
ARG PUBLIC_API_URL=
RUN PUBLIC_API_URL="$PUBLIC_API_URL" npm run build
ENV NODE_ENV=production
RUN chown node:node /app && mkdir -p /app/public/uploads && chown node:node /app/public/uploads
USER node
EXPOSE 1337
CMD ["npm","start"]
