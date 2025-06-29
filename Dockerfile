# Use Node.js base image (21.x)
FROM node:21

# Install ffmpeg, pip, and yt-dlp safely
RUN apt-get update && \
    apt-get install -y ffmpeg python3-pip && \
    pip3 install -U yt-dlp --break-system-packages

# Create app directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install @whiskeysockets/baileys@latest
RUN npm install



# Copy rest of the code
COPY . .

# Expose your app's port
EXPOSE 3000

# Start your app
CMD ["node", "src/index.js"]
