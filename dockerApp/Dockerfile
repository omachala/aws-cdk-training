FROM node:12
WORKDIR /Users/ondrej/fargate2/dockerApp
COPY package*.json index.js ./
RUN npm install
EXPOSE 3000
CMD ["node", "index.js"]
