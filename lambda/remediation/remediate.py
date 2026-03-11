import json
import boto3

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')
table = dynamodb.Table('remediation-state')

def lambda_handler(event, context):
    print(f"Remediating: {json.dumps(event)}")

    resource_type = event.get('resource_type')
    resource_id   = event.get('resource_id')

    try:
        if resource_type == 'security_group':
            remediate_security_group(resource_id)
        elif resource_type == 's3_bucket':
            remediate_s3_bucket(resource_id)
        else:
            print(f"No remediation defined for {resource_type}")

        table.put_item(Item={**event, 'status': 'REMEDIATED'})
        return {**event, 'status': 'REMEDIATED'}

    except Exception as e:
        table.put_item(Item={**event, 'status': 'FAILED', 'error': str(e)})
        raise

def remediate_security_group(sg_id):
    ec2 = boto3.client('ec2', region_name='ap-southeast-1')
    sg = ec2.describe_security_groups(GroupIds=[sg_id])['SecurityGroups'][0]
    for rule in sg['IpPermissions']:
        for ip_range in rule.get('IpRanges', []):
            if ip_range.get('CidrIp') == '0.0.0.0/0':
                ec2.revoke_security_group_ingress(
                    GroupId=sg_id,
                    IpPermissions=[{
                        'IpProtocol': rule['IpProtocol'],
                        'FromPort':   rule.get('FromPort', 0),
                        'ToPort':     rule.get('ToPort', 0),
                        'IpRanges':   [{'CidrIp': '0.0.0.0/0'}]
                    }]
                )

def remediate_s3_bucket(bucket_name):
    s3 = boto3.client('s3', region_name='ap-southeast-1')
    s3.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration={
            'BlockPublicAcls':       True,
            'IgnorePublicAcls':      True,
            'BlockPublicPolicy':     True,
            'RestrictPublicBuckets': True
        }
    )
