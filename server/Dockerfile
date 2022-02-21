FROM node:16

WORKDIR /usr/src/app

COPY ./dist .

EXPOSE 3000

CMD [ "node", "index.js" ]

# build:
# docker build . -t sayan751/planning-poker-server

# run:
# docker run -p 3000:3000 -d sayan751/planning-poker-server