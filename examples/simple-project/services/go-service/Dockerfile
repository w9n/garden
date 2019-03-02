FROM golang:1.8.3-alpine as builder
MAINTAINER Aurelien PERRIER <a.perrier89@gmail.com>

ENV webserver_path /go/src/github.com/perriea/webserver/
ENV PATH $PATH:$webserver_path

WORKDIR $webserver_path
COPY webserver/ .

RUN go build .

FROM alpine as release
RUN apk add --no-cache ca-certificates \
    busybox-extras net-tools bind-tools

ENV webserver_path /go/src/github.com/perriea/webserver/
ENV PATH $PATH:$webserver_path

WORKDIR $webserver_path

COPY --from=builder ${webserver_path}/. .

ENTRYPOINT ./webserver

EXPOSE 8080
