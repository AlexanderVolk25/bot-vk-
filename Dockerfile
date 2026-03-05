FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3 py3-pip && pip3 install yt-dlp --break-system-packages
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY admin/ ./admin/
EXPOSE 3000
CMD ["node", "dist/index.js"]
