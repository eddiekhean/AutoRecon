.PHONY: dev build run tidy generate-keys

dev: tidy generate-keys
	go run cmd/server/main.go

generate-keys:
	@echo "Generating RSA 256 keys..."
	@mkdir -p keys
	@if [ ! -f keys/private.pem ]; then \
		openssl genrsa -out keys/private.pem 2048 && \
		openssl rsa -in keys/private.pem -pubout -out keys/public.pem && \
		echo "Keys generated successfully in keys/ directory"; \
	else \
		echo "Keys already exist. Skipping..."; \
	fi

build:
	go build -o bin/server cmd/server/main.go

run: build
	./bin/server

tidy:
	go mod tidy
