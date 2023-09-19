#! /bin/bash

# Enola webserver setup
# Loosely followed these guides: 
# https://sumantmishra.medium.com/how-to-deploy-node-js-app-on-aws-with-github-db99758294f1
# https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-debian-10
# https://github.com/nvm-sh/nvm#intro

# Download and run script to install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# Do these things to use nvm without re-opening the terminal
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Install Node. If you want to use a later version, test it first
nvm install 16

# Ensure the EC2 instance has an IAM role that allows s3FullAccess

# Install AWS command line interface
apt update
apt install awscli -y

# Make the website parent directory
mkdir ~/enola_webfiles
cd ~/enola_webfiles

# Ensure the package.json file specifies hosting on port 80 in the scripts object according to directions here https://sebhastian.com/npm-start-port/
# It should look like this:
#   "scripts": {
#    "test": "echo \"Error: no test specified\" && exit 1",
#    "start": "PORT=80 parcel index.html"
#  },

# Get the website files from an Amazon S3 bucket
aws s3 cp --recursive s3://enola-website-files .

# Install Node dependencies
npm install

# Start the server
npm start
