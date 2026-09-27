FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
RUN useradd --system --uid 10001 satre && chown -R satre /srv
USER satre

EXPOSE 8001
# 0.0.0.0 solo dentro del contenedor: publicar como 127.0.0.1:8001:8001 o en una red interna de Docker.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--no-access-log", "--workers", "2"]
