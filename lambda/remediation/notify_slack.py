import json
import boto3
import urllib.request
import urllib.parse

ssm = boto3.client('ssm', region_name='ap-southeast-1')

def get_webhook_url():
    response = ssm.get_parameter(
        Name='/cloud-security-pipeline/slack-webhook-url',
        WithDecryption=True
    )
    return response['Parameter']['Value']

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    finding    = event.get('input', {})
    task_token = event.get('taskToken')

    severity    = finding.get('severity', 'UNKNOWN')
    resource_id = finding.get('resource_id', 'unknown')
    check_id    = finding.get('check_id', 'unknown')
    description = finding.get('description', 'No description')

    # Severity emoji
    emoji = {
        'CRITICAL': '🔴',
        'HIGH':     '🟠',
        'MEDIUM':   '🟡',
        'LOW':      '🟢'
    }.get(severity, '⚪')

    # Build Slack Block Kit message with Approve/Deny buttons
    message = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} Security Finding Requires Approval"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Severity:*\n{emoji} {severity}"},
                    {"type": "mrkdwn", "text": f"*Check ID:*\n`{check_id}`"},
                    {"type": "mrkdwn", "text": f"*Resource:*\n`{resource_id}`"},
                    {"type": "mrkdwn", "text": f"*Issue:*\n{description}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Action:* Automated remediation is ready to execute. Do you approve?"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "✅ Approve"},
                        "style": "primary",
                        "action_id": "approve_remediation",
                        "value": task_token
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "❌ Deny"},
                        "style": "danger",
                        "action_id": "deny_remediation",
                        "value": task_token
                    }
                ]
            }
        ]
    }

    # Send to Slack
    webhook_url = get_webhook_url()
    data = json.dumps(message).encode('utf-8')
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    urllib.request.urlopen(req)
    print("Slack notification sent successfully")

    return {"status": "notification_sent"}
