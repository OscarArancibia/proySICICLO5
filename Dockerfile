FROM node:18-alpine
WORKDIR /app

# Copiar archivos del proyecto
COPY . .

# Instalar dependencias del Backend
RUN cd backend && npm install

# Instalar dependencias del Frontend y compilar la aplicación Next.js
RUN cd Frontend && npm install && npm run build

# Exponer el puerto del Frontend (Next.js)
EXPOSE 3000

# Arrancar el Backend en el puerto 5001 en segundo plano, 
# y luego el Frontend (Next.js) en primer plano (escuchará en el puerto asignado por Railway)
CMD cd backend && PORT=5001 npm start & cd Frontend && npm start
