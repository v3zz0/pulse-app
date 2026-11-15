#!/bin/sh
# Codex Cloud only: trust the session CA without storing it in image layers.
set -eu
: "${CODEX_PROXY_CERT:?Certificato di sessione non disponibile}"
task_build_dir=$(mktemp -d)
trap 'rm -rf "$task_build_dir"' EXIT HUP INT TERM
for component in frontend backend; do
  sed 's/RUN npm ci/RUN --mount=type=secret,id=proxy_ca,required=true NODE_EXTRA_CA_CERTS=\/run\/secrets\/proxy_ca npm ci --strict-ssl=true/' "$component/Dockerfile" > "$task_build_dir/$component.Dockerfile"
  image=pulse-frontend
  if [ "$component" = backend ]; then image=pulse-strapi; fi
  docker build -f "$task_build_dir/$component.Dockerfile" --secret "id=proxy_ca,src=$CODEX_PROXY_CERT" -t "$image" "./$component"
done
