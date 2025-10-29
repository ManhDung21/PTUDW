"""Vercel serverless entrypoint for the FastAPI application."""

from mangum import Mangum

from app.main import app

# Expose handler expected by Vercel's Python runtime.
handler = Mangum(app)
