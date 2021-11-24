FROM mhart/alpine-node:16 as build-deps
RUN apk add --no-cache git
RUN apk add --no-cache python2
RUN apk add --no-cache make

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install
RUN yarn global add pm2

COPY . .

CMD ["pm2-runtime", "index.js"]
EXPOSE 80