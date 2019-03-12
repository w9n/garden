FROM golang:1.8.3-alpine
MAINTAINER Aurelien PERRIER <a.perrier89@gmail.com>

ENV webserver_path /go/src/github.com/perriea/
ENV PATH $PATH:$webserver_path/webserver

WORKDIR $webserver_path
RUN mkdir webserver
ADD webserver webserver

# Install gin to enable hot reloading
RUN apk add --no-cache git mercurial \
    && go get github.com/codegangsta/gin \
    && apk del git mercurial

CMD gin -p 8080 -a 8081 --path webserver run main.go

EXPOSE 8080
