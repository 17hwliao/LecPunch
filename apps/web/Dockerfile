FROM node:20-bookworm-slim AS build

ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG PNPM_VERSION=8.15.4
ARG VITE_API_BASE_URL=
ARG VITE_LOGTO_ENDPOINT
ARG VITE_LOGTO_APP_ID=lecpunch-web
ARG VITE_LOGTO_RESOURCE=https://api.lecpunch.lec.org
ARG VITE_LOGTO_ORGANIZATION_ID=lec-studio

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY
ENV npm_config_registry=$NPM_REGISTRY
ENV NPM_CONFIG_USERCONFIG=/app/.npmrc
ENV npm_config_userconfig=/app/.npmrc
ENV XDG_CONFIG_HOME=/tmp/xdg
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_LOGTO_ENDPOINT=$VITE_LOGTO_ENDPOINT
ENV VITE_LOGTO_APP_ID=$VITE_LOGTO_APP_ID
ENV VITE_LOGTO_RESOURCE=$VITE_LOGTO_RESOURCE
ENV VITE_LOGTO_ORGANIZATION_ID=$VITE_LOGTO_ORGANIZATION_ID

WORKDIR /app

RUN rm -f /root/.npmrc /etc/npmrc /usr/local/etc/npmrc
RUN rm -rf /root/.config/pnpm /tmp/xdg && mkdir -p /tmp/xdg
RUN printf "registry=%s\nstrict-ssl=true\nreplace-registry-host=always\n" "${NPM_REGISTRY}" > /app/.npmrc
RUN npm config get registry
RUN npm install -g "pnpm@${PNPM_VERSION}" --registry=${NPM_REGISTRY}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm config get registry
RUN pnpm install --frozen-lockfile --registry=${NPM_REGISTRY}
RUN pnpm --filter @lecpunch/shared build
RUN pnpm --filter @lecpunch/web build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
