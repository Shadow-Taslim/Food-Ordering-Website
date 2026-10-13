# All-in-one image: MongoDB (in-memory) + Express API + React frontend + admin panel
FROM node:20-bookworm

WORKDIR /app

# ---- dependencies (cached layer) ----
# root package.json is required: the sub-packages declare
# "tomato-food-delivery-root": "file:.." as a dependency
COPY package.json ./
COPY backend/package*.json backend/
RUN cd backend && npm install
COPY frontend/package*.json frontend/
RUN cd frontend && npm install
COPY admin/package*.json admin/
RUN cd admin && npm install

# ---- source + production builds ----
COPY frontend frontend
RUN cd frontend && npm run build
COPY admin admin
RUN cd admin && npm run build -- --base=/admin/
COPY backend backend

# ---- pre-download the mongod binary so container start needs no network ----
RUN cd backend && node -e "import('mongodb-memory-server').then(async ({MongoMemoryServer}) => { const m = await MongoMemoryServer.create(); await m.stop(); console.log('mongod cached'); })"

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "backend/preview-boot.mjs"]
