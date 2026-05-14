# Use Node.js official image
FROM node:18-alpine

# Install system dependencies first
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg

# Install yt-dlp
RUN pip3 install yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["npm", "start"]
