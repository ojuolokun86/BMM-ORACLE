# Use Node.js base image (21.x as per your engines)
FROM node:21

# Create app directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Start your app
CMD ["node", "src/index.js"]
