FROM nginx:alpine

# RUN apk update && apk add bash

COPY ./dist /usr/share/nginx/html

COPY default.conf.template /etc/nginx/conf.d/default.conf.template

CMD /bin/sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf" && nginx -g 'daemon off;'

# CMD ["nginx", "-g", "daemon off;"]

# build:
# docker build . -t sayan751/planning-poker-client

# run:
# docker run -p 80:80 -d sayan751/planning-poker-client