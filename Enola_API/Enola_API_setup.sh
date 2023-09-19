#! /bin/bash

# Launch template details:
# Give launch template an IAM role which has s3FullAccess privileges
# Use Ubuntu LTS
# Use t2.micro machine

# API server automated setup

# Make the API parent directory
mkdir ~/mi1_apis
cd ~/mi1_apis

# Install dependencies
sudo apt update
sudo apt install awscli python3-pip python3-dev build-essential libssl-dev libffi-dev python3-setuptools python3-venv -y

# Get the API files from an Amazon S3 bucket
aws s3 cp --recursive s3://enola-api-dev-s3-bucket .

# Create and activate a python virtual environment
python3 -m venv mi1env
source mi1env/bin/activate

# Install dependencies in the python virtual environment
pip install -r requirements.txt

# Deactiveate the python virtual environment
deactivate

# Move the mi1_apis.service file to make it a system service
sudo mv mi1_apis.service /etc/systemd/system/mi1_apis.service

# Start and enable the mi1_apis system service
sudo systemctl start mi1_apis
sudo systemctl enable mi1_apis
