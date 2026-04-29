FROM golang:alpine
WORKDIR /app
COPY go.mod go.sum main.go .
RUN go build
CMD ["/app/backend"]