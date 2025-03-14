#!/bin/bash

# Cannot run with -u because we check for unbound variables
# and the script will exit prematurely if '-u' is set
set -ef -o pipefail

SCRIPT=$(realpath "$0")
FILE_NAME=$(basename "${SCRIPT}")
SOURCE=$(dirname "$SCRIPT")
PROJECT_ROOT=$(realpath "${SOURCE}/..")
source "${PROJECT_ROOT}/config/datafed.sh"

VERSION="1.0.0"
echo "$FILE_NAME $VERSION"

ERROR_DETECTED=0
# The admin should who should be receiving emails about the backups
if [ -z "$DATAFED_ADMIN_EMAIL" ]
then
  echo "Error DATAFED_ADMIN_EMAIL is not defined, this is a required argument."
  ERROR_DETECTED=1
fi

# DataFed system email is from the actual system not from a person, it is
# used to fill in the from field when sending emails out to admins or users.
if [ -z "$DATAFED_SYSTEM_EMAIL" ]
then
  echo "Error DATAFED_SYSTEM_EMAIL is not defined, this is a required argument"
  ERROR_DETECTED=1
fi

# Where the database backups will be placed.
if [ -z "$DATAFED_DATABASE_BACKUP_PATH" ]
then
  echo "Error DATAFED_DATABASE_BACKUP_PATH is not defined, this is a required argument"
  ERROR_DETECTED=1
fi

if [ "$ERROR_DETECTED" == "1" ]
then
  exit 1
fi

cat << OUTER_EOF > "$PROJECT_ROOT/scripts/admin_datafed_backup.sh"
#!/bin/bash

# This script needs to be registered in the crontab
# 45 23 * * 0 ${DATAFED_INSTALL_PATH}/scripts/admin_datafed-backup.sh
# This will run at 11:45 pm every sunday night
# If need to send mail to SMTP machine

# NOTE this script is generated by $SCRIPT, to recreate it change
# settings in datafed.sh and rerun $SCRIPT.
echo "DataFed - running DB backup"

# Shutdown DataFed services
systemctl stop globus-gridftp-server.service
systemctl stop datafed-ws.service
systemctl stop datafed-repo.service
systemctl stop datafed-core.service
systemctl stop arangodb3.service

backup_file=DataFed_DB_Backup_\$(date +"%Y_%m_%d").tar.gz

# Tar contents of arangodb directory without full path
tar -C /var/lib/arangodb3 -cvzf \${backup_file} .

# Move backup file to storage location
mv \${backup_file} ${DATAFED_DATABASE_BACKUP_PATH}/backups

# Restart DataFed services
systemctl start arangodb3.service
systemctl start datafed-core.service
systemctl start globus-gridftp-server.service
systemctl start datafed-repo.service
systemctl start datafed-ws.service

echo "DataFed - backup completed"

sendmail "$DATAFED_ADMIN_EMAIL" << EOF
To: $DATAFED_ADMIN_EMAIL
From: $DATAFED_SYSTEM_EMAIL
Subject: DataFed Database Backup Notification

DataFed has been backed up. A new backup exists at ${DATAFED_DATABASE_BACKUP_PATH}/backups.
EOF
OUTER_EOF

chmod +x "$PROJECT_ROOT/scripts/admin_datafed_backup.sh"
