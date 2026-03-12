import json
import boto3
import urllib.parse

sfn = boto3.client('stepfunctions', region_name='ap-southeast-1')

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    # API Gateway sends body as URL-encoded string
    body = event.get('body', '')
    if event.get('isBase64Encoded'):
        import base64
        body = base64.b64decode(body).decode('utf-8')

    # Parse the Slack payload
    parsed = urllib.parse.parse_qs(body)
    payload = json.loads(parsed['payload'][0])

    action    = payload['actions'][0]
    action_id = action['action_id']
    token     = action['value']
    user      = payload['user']['name']

    print(f"User {user} clicked {action_id}")

    if action_id == 'approve_remediation':
        sfn.send_task_success(
            taskToken=token,
            output=json.dumps({"approved": True, "approver": user})
        )
        return {
            "statusCode": 200,
            "body": json.dumps({"text": f"✅ Approved by {user} — remediation executing..."})
        }
    else:
        sfn.send_task_failure(
            taskToken=token,
            error="Denied",
            cause=f"Denied by {user}"
        )
        return {
            "statusCode": 200,
            "body": json.dumps({"text": f"❌ Denied by {user} — remediation cancelled."})
        }
