pipeline {
    agent any
    environment {
        DISCORD_BOT_TOKEN  = credentials('BOT_TOKEN')
    }
    tools {nodejs "12.13.0"}
    stages {
        stage('Build') {
            steps {
                echo 'Building...'
                sh label: '', script: 'npm install'
                archiveArtifacts '**/*'
            }
        }
    }
}