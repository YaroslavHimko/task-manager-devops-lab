# Build Angular inside Linux. No local Node installation is needed for Docker builds.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./
# npm install is used because the training archive does not include a lockfile.
# In a production project, commit package-lock.json and use npm ci instead.
RUN npm install --no-audit --no-fund
COPY . ./
RUN npm run build

# Serve compiled static files. No Node server needed at runtime.
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser/ /usr/share/nginx/html/
EXPOSE 80
