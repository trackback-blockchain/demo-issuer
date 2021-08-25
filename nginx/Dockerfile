FROM nginx

ENV appDir /var/www/public
RUN mkdir -p  /var/www/public
COPY ./nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p  /var/www/public
WORKDIR ${appDir}

EXPOSE 80