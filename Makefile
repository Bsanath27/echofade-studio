.PHONY: help install run run-backend run-frontend stop clean download-font

help:
	@echo "Available commands:"
	@echo "  make install      - Install frontend and backend dependencies"
	@echo "  make download-font - Download the aesthetic Montserrat font"
	@echo "  make run          - Run both frontend and backend in the background"
	@echo "  make run-frontend - Run only the frontend"
	@echo "  make run-backend  - Run only the backend"
	@echo "  make stop         - Stop the running servers"
	@echo "  make clean        - Remove dependencies, logs, and temp files"

install:
	@echo "==> Setting up backend virtual environment..."
	python3 -m venv backend/venv
	@echo "==> Installing backend dependencies..."
	backend/venv/bin/pip install --upgrade pip
	backend/venv/bin/pip install -r backend/requirements.txt
	@echo "==> Installing frontend dependencies..."
	cd frontend && npm install

download-font:
	@echo "==> Downloading Montserrat-Bold font..."
	curl -sSL "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Bold.ttf" -o backend/Montserrat-Bold.ttf
	@echo "==> Font downloaded to backend/Montserrat-Bold.ttf"

run-backend:
	@echo "==> Starting backend server..."
	@cd backend && . venv/bin/activate && python3 main.py > backend.log 2>&1 & echo $$! > .backend.pid
	@echo "Backend running on http://127.0.0.1:8000 (logs in backend/backend.log)"

run-frontend:
	@echo "==> Starting frontend server..."
	@cd frontend && npm run dev > frontend.log 2>&1 & echo $$! > .frontend.pid
	@echo "Frontend running on http://localhost:5173 (logs in frontend/frontend.log)"

run: run-backend run-frontend
	@echo "==> All services started in the background."
	@echo "Run 'make stop' to shut them down."

stop:
	@echo "==> Stopping services..."
	@-if [ -f backend/.backend.pid ]; then kill `cat backend/.backend.pid` 2>/dev/null || true; rm backend/.backend.pid; fi
	@-if [ -f frontend/.frontend.pid ]; then kill `cat frontend/.frontend.pid` 2>/dev/null || true; rm frontend/.frontend.pid; fi
	@echo "==> Services stopped."

clean: stop
	@echo "==> Cleaning up..."
	rm -rf backend/venv
	rm -rf backend/temp/*
	rm -f backend/backend.log
	rm -rf frontend/node_modules
	rm -rf frontend/dist
	rm -f frontend/frontend.log
