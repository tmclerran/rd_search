# Rare Disease Web App

Codebase for the web app based on CodeMirror version 6, which forms our user interface and communicates with Looking Glass APIs

## Environment

Warning: the version of Node.js included with Ubuntu 20.04, version 10.19, is now unsupported and unmaintained. You should not use this version in production, and should install a more recent version of Node as follows

### activate the appropriate environment (jupyter_env on Tim's workstation)

conda activate jupyter_env

### install/update nvm per instructions at https://github.com/nvm-sh/nvm#intro

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

### verify installation and check version

command -v nvm
nvm -v

### install nodejs (all new versions of node are also stable, so just get the latest version as follows)

nvm install node

### verify node version

node -v

### To run the mi1 rare disease app:

npm install parcel
cd [project root]\CodeMirror
npm start

### update particlesjs.json file in \dist directory
if particles are not showing in background, copy over the contents of the \CodeMirror\particles.json file into \CodeMirror\dist\particlesjs.json.