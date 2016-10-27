FROM mhart/alpine-node:6.7

RUN mkdir -p /app
WORKDIR /app

COPY package.json /app/package.json
RUN npm install --production

COPY . /app

ENTRYPOINT ["node", "index.js"]

