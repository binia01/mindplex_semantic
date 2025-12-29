#!/bin/bash

CLUSTER=$1
FAMILY=$2
LOG_GROUP=$3

echo "Deployment Failed. Checking for crashed tasks in ${CLUSTER}..."

TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER --desired-status STOPPED --family $FAMILY --max-items 1 --sort DESC --query 'taskArns[0]' --output text --region us-east-1)

if [ "$TASK_ARN" == "None" ] || [ -z "$TASK_ARN" ]; then
  echo "No crashed tasks found. The failure might be a timeout or health check issue."
  exit 0
fi

TASK_ID=$(basename $TASK_ARN)
echo "Fetching logs for crashed task: $TASK_ID"
echo "\`\`\`"
aws logs get-log-events --log-group-name $LOG_GROUP --log-stream-name ecs/app/$TASK_ID --limit 50 --region us-east-1 --query 'events[*].message' --output text
echo "\`\`\`"