pipeline {
    agent any
    environment {
        DISCORD_BOT_TOKEN  = credentials('BOT_TOKEN')
    }
    stage('Build') {
        steps {
            echo 'Building...'
            nodejs('12.13.0') {
                npm install
            }
            archiveArtifacts '**/*'
        }
    }
}