#! /bin/bash

# Enola webserver setup
# Followed this guide: https://sumantmishra.medium.com/how-to-deploy-node-js-app-on-aws-with-github-db99758294f1

# Download and run script to install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# Do these things to use nvm without re-opening the terminal
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Install Node. If you want to use a later version, test it first
nvm install 16

# Ensure the EC2 instance has an IAM role that allows s3FullAccess

# Install AWS command line interface (already done on Amazon Linux, but uncomment the following line if using another OS)
# sudo apt update
# sudo apt install awscli

# Make the website parent directory
mkdir ~/enola_webfiles
cd ~/enola_webfiles

# Get the website files from an Amazon S3 bucket
aws s3 cp --recursive s3://enola-website-files .

# Install Node dependencies
npm install

# Start the server
npm start
