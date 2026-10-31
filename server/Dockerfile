FROM node:22-alpine
WORKDIR /app
COPY index.mjs package.json ./
USER node
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["node","index.mjs"]
