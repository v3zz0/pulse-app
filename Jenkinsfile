// PULSE -> docker-lavoro. I segreti stanno nella credenziale Jenkins "pulse-env" (file .env.production):
// non sono nel repository e non compaiono nei log.
pipeline {
  agent { label 'docker-vezzo' }

  options {
    disableConcurrentBuilds()
    timeout(time: 40, unit: 'MINUTES')
  }

  stages {
    stage('Verifica configurazione') {
      steps {
        withCredentials([file(credentialsId: 'pulse-env', variable: 'ENVF')]) {
          sh '''
            set +x
            docker compose --env-file "$ENVF" -f compose.jenkins.yml config --quiet
            echo "Configurazione valida"
          '''
        }
      }
    }

    stage('Deploy') {
      steps {
        withCredentials([file(credentialsId: 'pulse-env', variable: 'ENVF')]) {
          sh '''
            set +x
            export PULSE_IMAGE_TAG=$(git rev-parse --short=12 HEAD)
            docker compose --env-file "$ENVF" -f compose.jenkins.yml up -d --build --wait
            docker compose --env-file "$ENVF" -f compose.jenkins.yml ps
          '''
        }
      }
    }

    stage('Verifica') {
      steps {
        withCredentials([file(credentialsId: 'pulse-env', variable: 'ENVF')]) {
          sh '''
            set +x
            IP=$(grep '^PULSE_BIND_IP=' "$ENVF" | cut -d= -f2)
            FP=$(grep '^PULSE_FRONTEND_PORT=' "$ENVF" | cut -d= -f2)
            AP=$(grep '^PULSE_API_PORT=' "$ENVF" | cut -d= -f2)
            echo "frontend /health:" && curl --fail --silent --show-error "http://$IP:$FP/health" && echo
            echo "strapi /_health: $(curl --silent -o /dev/null -w '%{http_code}' "http://$IP:$AP/_health")"
            echo "frontend /api/auth/local (deve essere 404): $(curl --silent -o /dev/null -w '%{http_code}' "http://$IP:$FP/api/auth/local")"
            echo "frontend /admin (deve essere 404): $(curl --silent -o /dev/null -w '%{http_code}' "http://$IP:$FP/admin")"
          '''
        }
      }
    }

    stage('Pulizia') {
      steps {
        sh 'docker image prune -f || true'
      }
    }
  }
}
