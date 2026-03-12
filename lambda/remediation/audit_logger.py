import json
import boto3
import psycopg2
import os
from datetime import datetime

ssm = boto3.client('ssm', region_name='ap-southeast-1')

def get_db_config():
    return {
        'host':     'localhost',
        'dbname':   'cloud_security',
        'user':     'postgres',
        'password': '',
        'port':     5432
    }

def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    event_id      = event.get('event_id')
    check_id      = event.get('check_id', 'UNKNOWN')
    severity      = event.get('severity', 'UNKNOWN')
    resource_type = event.get('resource_type', 'UNKNOWN')
    resource_id   = event.get('resource_id', 'UNKNOWN')
    description   = event.get('description', '')
    status        = event.get('status', 'OPEN')
    approver      = event.get('approval', {}).get('approver') if event.get('approval') else None

    try:
        conn = psycopg2.connect(**get_db_config())
        cur  = conn.cursor()

        # Upsert finding
        cur.execute("""
            INSERT INTO cspm.findings
                (event_id, check_id, severity, resource_type, resource_id, description, status, approver, remediation_date)
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

        conn.commit()
        cur.close()
        conn.close()

        print(f"Audit log written for {event_id}")
        return {**event, 'audit_logged': True}

    except Exception as e:
        print(f"Audit logging failed: {str(e)}")
        # Don't fail the pipeline if audit fails
        return {**event, 'audit_logged': False, 'audit_error': str(e)}
