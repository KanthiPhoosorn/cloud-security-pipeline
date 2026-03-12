import json
import boto3
import urllib.parse
import urllib.request

sfn = boto3.client('stepfunctions', region_name='ap-southeast-1')

def update_slack_message(response_url, text):
    data = json.dumps({"text": text, "replace_original": True}).encode('utf-8')
    req = urllib.request.Request(
        response_url,
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    urllib.request.urlopen(req)

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    body = event.get('body', '')
    if event.get('isBase64Encoded'):
        import base64
        body = base64.b64decode(body).decode('utf-8')

    parsed      = urllib.parse.parse_qs(body)
    payload     = json.loads(parsed['payload'][0])
    action      = payload['actions'][0]
    action_id   = action['action_id']
    token       = action['value']
    user        = payload['user']['name']
    response_url = payload['response_url']

    print(f"User {user} clicked {action_id}")

    if action_id == 'approve_remediation':
        sfn.send_task_success(
            taskToken=token,
            output=json.dumps({"approved": True, "approver": user})
        )
        update_slack_message(response_url, f"✅ *Approved by {user}* — remediation executing...")
        return {"statusCode": 200, "body": ""}
    else:
        sfn.send_task_failure(
            taskToken=token,
            error="Denied",
            cause=f"Denied by {user}"
        )
        update_slack_message(response_url, f"❌ *Denied by {user}* — remediation cancelled.")
        return {"statusCode": 200, "body": ""}
