FROM mhart/alpine-node:16 as build-deps
RUN apk add --no-cache git
RUN apk add --no-cache python2
RUN apk add --no-cache make

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

RUN yarn build

FROM nginx:1.12-alpine
COPY --from=build-deps /usr/src/app/build /var/www
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]