FROM nginx:alpine

# Custom nginx config for single port
RUN echo 'server { listen 3000; location / { root /usr/share/nginx/html; index index.html; } }' \
    > /etc/nginx/conf.d/default.conf

COPY index.html /usr/share/nginx/html/index.html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
