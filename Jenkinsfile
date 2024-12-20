pipeline {
  agent {
    docker {
      image 'node:18-bullseye'
    }
  }

  stages {
    stage('Build') {
      steps {
        // Jenkins runs the docker using its host's user and group id, so
        // the docker container does not have the home directory for that user.
        // Create it first since npm assumes that home dir exists.
        script {
          env.HOME = "/tmp/home/jenkins"
        }
        sh "mkdir -p $HOME"

        sh """
        npm install
        npx tsc
        """
      }
    }
  }
}
