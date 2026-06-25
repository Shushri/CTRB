FROM node:20-alpine

# Install build dependencies for native node addons (e.g., bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
