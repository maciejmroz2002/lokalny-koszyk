FROM golang:alpine

WORKDIR /app/backend
COPY ./ ./

RUN go build -o main .

CMD ["./main"]