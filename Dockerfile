FROM node:22-alpine

WORKDIR /app

# Instala dependências de produção primeiro para otimização de cache
COPY package*.json ./
RUN npm install

# Copia os demais arquivos do projeto
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
