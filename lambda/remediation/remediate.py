import json
import boto3

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')
table    = dynamodb.Table('remediation-state')
ec2      = boto3.client('ec2', region_name='ap-southeast-1')
s3       = boto3.client('s3', region_name='ap-southeast-1')
iam      = boto3.client('iam', region_name='ap-southeast-1')

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    resource_type = event.get('resource_type')
    resource_id   = event.get('resource_id')
    event_id      = event.get('event_id')

    try:
        if resource_type == 'security_group':
            remediate_security_group(resource_id)
        elif resource_type == 's3_bucket':
            remediate_s3_bucket(resource_id)
        elif resource_type == 'iam_role':
            remediate_iam_role(resource_id)
        else:
            raise ValueError(f"Unknown resource type: {resource_type}")

        table.put_item(Item={**event, 'status': 'REMEDIATED'})
        return {**event, 'status': 'REMEDIATED'}

    except Exception as e:
        print(f"Remediation failed: {str(e)}")
        table.put_item(Item={**event, 'status': 'FAILED', 'error': str(e)})
        raise Exception("RemediationFailed") from e

def remediate_security_group(sg_id):
    print(f"Remediating security group: {sg_id}")
    sg = ec2.describe_security_groups(GroupIds=[sg_id])['SecurityGroups'][0]
    for rule in sg['IpPermissions']:
        bad_ranges = [r for r in rule.get('IpRanges', []) if r.get('CidrIp') == '0.0.0.0/0']
        if bad_ranges:
            ec2.revoke_security_group_ingress(
                GroupId=sg_id,
                IpPermissions=[{**rule, 'IpRanges': bad_ranges}]
            )
    print(f"Security group {sg_id} remediated")

def remediate_s3_bucket(bucket_name):
    print(f"Remediating S3 bucket: {bucket_name}")
    s3.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration={
            'BlockPublicAcls':       True,
            'IgnorePublicAcls':      True,
            'BlockPublicPolicy':     True,
            'RestrictPublicBuckets': True
        }
    )
    print(f"S3 bucket {bucket_name} remediated")

def remediate_iam_role(role_name):
    print(f"Remediating IAM role: {role_name}")

    # Get all inline policies
    policies = iam.list_role_policies(RoleName=role_name)['PolicyNames']

    for policy_name in policies:
        response   = iam.get_role_policy(RoleName=role_name, PolicyName=policy_name)
        doc        = response['PolicyDocument']
        statements = doc.get('Statement', [])
        new_stmts  = []
        modified   = False

        for stmt in statements:
            actions   = stmt.get('Action', [])
            resources = stmt.get('Resource', [])

            # Normalize to list
            if isinstance(actions, str):
                actions = [actions]
            if isinstance(resources, str):
                resources = [resources]

            # Remove wildcard actions and resources
            if '*' in actions or '*' in resources:
                print(f"Removing wildcard statement: {stmt}")
                modified = True
                # Replace with deny-all as safe default
                new_stmts.append({
                    'Effect':   'Deny',
                    'Action':   '*',
                    'Resource': '*'
                })
            else:
                new_stmts.append(stmt)

        if modified:
            doc['Statement'] = new_stmts
            iam.put_role_policy(
                RoleName=role_name,
                PolicyName=policy_name,
                PolicyDocument=json.dumps(doc)
            )
            print(f"IAM role {role_name} policy {policy_name} remediated")
