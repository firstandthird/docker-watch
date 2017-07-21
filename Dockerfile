FROM node:8.1-alpine

ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init

RUN mkdir -p /app
WORKDIR /app

COPY package.json /app/package.json
RUN npm install --production

COPY . /app

ENTRYPOINT ["dumb-init", "node", "index.js"]

