#!/bin/bash/

# Create an S3 bucket and upload the dump file. The upload may take a few hours
# For help, see Decoding DevOps video 101: "S3". Name the bucket "neo4jdumpfiles"

# Create an AWS EC2 instance following https://neo4j.com/developer/neo4j-cloud-aws-ec2-ami/
# Use 35 GB of EBS storage for the instance
# t3.large works. Could try with t3.medium or small

# Create an IAM role that has s3FullAccess permission, then go to the instance > Actions > Security > Manage IAM Role and assign the role you just created that has s3FullAccess
# For help, see Decoding DevOps video 106: "Build and Deploy Artifacts" 



# Create a database from the Neo4j dump file
# References
# https://neo4j.com/docs/operations-manual/current/backup-restore/restore-dump/
# https://community.neo4j.com/t5/neo4j-graph-platform/restore-not-working/td-p/26910

#!/bin/bash

# Switch user to root
sudo -i

# Set the initial password for the database
neo4j-admin set-initial-password up3rSecR3t

# Stop the neo4j server and system service
neo4j stop
systemctl stop neo4j

# Copy the dump file from the S3 bucket to the data/dumps folder in the selected database in Neo4j Desktop.
# SSH into the instance, then
aws s3 cp --recursive s3://neo4jdumpfiles /var/lib/neo4j/data/dumps
DUMPFILE_FULLPATH=$(find /var/lib/neo4j/data/dumps -name *.dump)

# Load the dump file
neo4j-admin load --from=$DUMPFILE_FULLPATH --database=neo4j --force

# Ensure that proper permissions are given to the directories of the database that was created via the neo4j-admin load
chown -R neo4j:neo4j /var/lib/neo4j/data/databases/
chown -R neo4j:neo4j /var/lib/neo4j/data/transactions/

# Start neo4j server and system service
neo4j start
systemctl start neo4j
