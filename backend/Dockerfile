FROM node:24-bookworm-slim
WORKDIR /app
ENV STRAPI_TELEMETRY_DISABLED=true
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
ENV NODE_ENV=production
RUN chown -R node:node /app
USER node
EXPOSE 1337
CMD ["npm","start"]
