# client/Dockerfile
# שלב build (Vite + Tailwind)
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

# קונפיגים של Tailwind/PostCSS חייבים להיות בקונטקסט
COPY . .

# אם צריך להעביר URL בזמן build (ב-api.js יש VITE_API_URL || "/api")
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# שלב הרצה: Nginx סטטי + פרוקסי ל-API
FROM nginx:alpine

# קובץ nginx.conf מותאם (ראה להלן)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# קבצי סטטיק של Vite
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
