FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
# Use npm ci when lockfile is present, otherwise fall back to npm install
RUN if [ -f package-lock.json ]; then npm ci --production; else npm install --production --no-audit --progress=false; fi
COPY . .
EXPOSE 4001
CMD ["node", "index.js"]
