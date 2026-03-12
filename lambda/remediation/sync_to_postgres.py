import boto3
import psycopg2
import json
from datetime import datetime

# DynamoDB client
dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')
table    = dynamodb.Table('remediation-state')

# PostgreSQL connection
def get_conn():
    return psycopg2.connect(
        host='localhost',
        dbname='cloud_security',
        user='postgres',
        password='postgres123',
        port=5432
    )

def sync():
    print("Scanning DynamoDB for findings...")
    response = table.scan()
    items    = response.get('Items', [])
    print(f"Found {len(items)} items in DynamoDB")

    conn = get_conn()
    cur  = conn.cursor()
    synced = 0

    for item in items:
        event_id      = item.get('event_id')
        check_id      = item.get('check_id', 'UNKNOWN')
        severity      = item.get('severity', 'UNKNOWN')
        resource_type = item.get('resource_type', 'UNKNOWN')
        resource_id   = item.get('resource_id', 'UNKNOWN')
        description   = item.get('description', '')
        status        = item.get('status', 'OPEN')
        approver      = item.get('approval', {}).get('approver') if item.get('approval') else None

        cur.execute("""
            INSERT INTO cspm.findings
                (event_id, check_id, severity, resource_type, resource_id,
                 description, status, approver, remediation_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (event_id) DO UPDATE SET
                status           = EXCLUDED.status,
                approver         = EXCLUDED.approver,
                remediation_date = CASE
                    WHEN EXCLUDED.status = 'REMEDIATED' THEN NOW()
                    ELSE cspm.findings.remediation_date
                END
        """, (event_id, check_id, severity, resource_type, resource_id,
              description, status, approver,
              datetime.now() if status == 'REMEDIATED' else None))
        synced += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Synced {synced} findings to PostgreSQL")

if __name__ == '__main__':
    sync()
