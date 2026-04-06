.PHONY: dev frontend backend init help

help:
	@echo "Available commands:"
	@echo "  make dev       - Run both backend and frontend development servers"
	@echo "  make db-up     - Start PostgreSQL database via Docker Compose"
	@echo "  make db-down   - Stop Database"
	@echo "  make frontend  - Start the frontend only"
	@echo "  make backend   - Start the backend only"

dev: db-up
	@echo "Starting fullstack dev environment..."
	@make -j 2 frontend backend

db-up:
	docker-compose up -d

db-down:
	docker-compose down

frontend:
	@echo "Starting Frontend..."
	cd frontend && make dev

backend:
	@echo "Starting Backend..."
	cd backend && make dev
