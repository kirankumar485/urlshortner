FROM node:14

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json .
RUN npm install

# Copy the rest of your app
COPY . .

# Expose the port your app will run on
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
