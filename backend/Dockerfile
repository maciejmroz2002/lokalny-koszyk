FROM golang:alpine
WORKDIR /app
COPY main.go go.mod go.sum ./
RUN go build
CMD ["/app/backend"]