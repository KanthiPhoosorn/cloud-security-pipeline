import json
import boto3
import os

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')
table = dynamodb.Table('remediation-state')

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    if event.get('action') == 'notify':
        finding = event.get('input', {})
        task_token = event.get('taskToken')
        sfn = boto3.client('stepfunctions', region_name='ap-southeast-1')
        sfn.send_task_success(
            taskToken=task_token,
            output=json.dumps(finding)
        )
        return finding

    detail = event.get('detail', {})
    bucket = detail.get('bucket', {}).get('name', '')
    key = detail.get('object', {}).get('key', '')

    # Use resource_id from input if provided, otherwise default
    resource_id   = event.get('resource_id', 'sg-test')
    resource_type = event.get('resource_type', 'security_group')

    finding = {
        'event_id':     f"{bucket}/{key}",
        'severity':     event.get('severity', 'HIGH'),
        'resource_type': resource_type,
        'resource_id':  resource_id,
        'check_id':     event.get('check_id', 'CKV_AWS_24'),
        'description':  event.get('description', 'Security group allows SSH from 0.0.0.0/0')
    }

    existing = table.get_item(Key={'event_id': finding['event_id']})
    if 'Item' in existing:
        print(f"Already processed. Skipping.")
        return existing['Item']

    table.put_item(Item={**finding, 'status': 'PROCESSING'})
    return finding
