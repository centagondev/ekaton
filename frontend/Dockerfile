# Use an official Node.js image
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Copy all the rest of your frontend code into the container
COPY . .

EXPOSE 5173

CMD [ "npm", "run", "dev", "--", "--host"]