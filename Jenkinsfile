pipeline {
  agent { label 'built-in' }

  options {
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  triggers {
    pollSCM('H/5 * * * *')
  }

  environment {
    IMAGE_TAG = "jenkins-${env.BUILD_NUMBER}"
  }

  stages {
    stage('Deploy demo') {
      steps {
        sh 'bash scripts/demo-deploy.sh'
      }
    }
  }
}
