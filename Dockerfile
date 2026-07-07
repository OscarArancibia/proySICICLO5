FROM node:18-alpine
WORKDIR /app

# Argumento para decidir qué servicio construir (backend o frontend)
ARG PROCESS_TYPE=backend
ENV PROCESS_TYPE=$PROCESS_TYPE

COPY . .

# Instalar y compilar según el tipo de proceso
RUN if [ "$PROCESS_TYPE" = "backend" ]; then \
      cd backend && npm install; \
    else \
      cd Frontend && npm install && npm run build; \
    fi

EXPOSE 5001 3000

# Ejecutar el comando adecuado
CMD if [ "$PROCESS_TYPE" = "backend" ]; then \
      cd backend && npm start; \
    else \
      cd Frontend && npm start; \
    fi
