FROM node:22.16.0

RUN apt-get update && apt-get install -y openjdk-17-jdk

WORKDIR /app
COPY . .

RUN npm install

EXPOSE 3000
CMD ["npm", "start"]
