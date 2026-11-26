# API image for Cloud Run (see deploy-to-development.sh).
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# Uploaded images live here; on Cloud Run a Cloud Storage bucket is mounted over it.
RUN mkdir -p uploads

ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/index.js"]
