FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy source code and config
COPY . .

# Expose API port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
