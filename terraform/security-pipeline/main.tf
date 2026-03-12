terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-southeast-1"
}

resource "aws_dynamodb_table" "remediation_state" {
  name         = "remediation-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"

  attribute {
    name = "event_id"
    type = "S"
  }

  tags = { Name = "remediation-state" }
}

resource "aws_iam_role" "lambda_role" {
  name = "remediation-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "remediation-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeSecurityGroups",
          "ec2:RevokeSecurityGroupIngress",
          "s3:GetBucketPublicAccessBlock",
          "s3:PutPublicAccessBlock",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion",
          "iam:ListPolicyVersions",
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "states:SendTaskSuccess",
          "states:SendTaskFailure"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "sfn_role" {
  name = "remediation-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "sfn_policy" {
  name = "remediation-sfn-policy"
  role = aws_iam_role.sfn_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "lambda:InvokeFunction",
        "logs:CreateLogGroup",
        "logs:CreateLogDelivery",
        "logs:PutLogEvents"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "eventbridge_role" {
  name = "remediation-eventbridge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "eventbridge_policy" {
  name = "remediation-eventbridge-policy"
  role = aws_iam_role.eventbridge_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["states:StartExecution"]
      Resource = aws_sfn_state_machine.remediation.arn
    }]
  })
}

data "archive_file" "parse_finding" {
  type        = "zip"
  source_file = "${path.module}/../../lambda/remediation/parse_finding.py"
  output_path = "${path.module}/../../lambda/remediation/parse_finding.zip"
}

resource "aws_lambda_function" "parse_finding" {
  filename         = data.archive_file.parse_finding.output_path
  function_name    = "parse-finding"
  role             = aws_iam_role.lambda_role.arn
  handler          = "parse_finding.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.parse_finding.output_base64sha256
}

data "archive_file" "remediate" {
  type        = "zip"
  source_file = "${path.module}/../../lambda/remediation/remediate.py"
  output_path = "${path.module}/../../lambda/remediation/remediate.zip"
}

resource "aws_lambda_function" "remediate" {
  filename         = data.archive_file.remediate.output_path
  function_name    = "remediate-finding"
  role             = aws_iam_role.lambda_role.arn
  handler          = "remediate.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.remediate.output_base64sha256
  timeout          = 60
}

resource "aws_sfn_state_machine" "remediation" {
  name     = "remediation-pipeline"
  role_arn = aws_iam_role.sfn_role.arn

  definition = jsonencode({
    Comment = "Automated Cloud Security Remediation Pipeline"
    StartAt = "ParseFinding"
    States = {
      ParseFinding = {
        Type     = "Task"
        Resource = aws_lambda_function.parse_finding.arn
        Next     = "CheckSeverity"
        Catch = [{
          ErrorEquals = ["States.ALL"]
          Next        = "Failed"
        }]
      }
      CheckSeverity = {
        Type = "Choice"
        Choices = [
          {
            Variable      = "$.severity"
            StringMatches = "CRITICAL"
            Next          = "WaitForApproval"
          },
          {
            Variable      = "$.severity"
            StringMatches = "HIGH"
            Next          = "WaitForApproval"
          }
        ]
        Default = "AutoRemediate"
      }
      WaitForApproval = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke.waitForTaskToken"
        Parameters = {
          FunctionName = aws_lambda_function.notify_slack.arn
          Payload = {
            "action"      = "notify"
            "input.$"     = "$"
            "taskToken.$" = "$$.Task.Token"
          }
        }
        TimeoutSeconds = 3600
        ResultPath     = "$.approval"
        Next           = "AutoRemediate"
        Catch = [{
          ErrorEquals = ["States.TaskTimedOut"]
          Next        = "Failed"
        }]
      }
      AutoRemediate = {
        Type     = "Task"
        Resource = aws_lambda_function.remediate.arn
        Next     = "Succeeded"
        Catch = [{
          ErrorEquals = ["States.ALL"]
          Next        = "Failed"
        }]
      }
      Succeeded = {
        Type = "Succeed"
      }
      Failed = {
        Type  = "Fail"
        Error = "RemediationFailed"
        Cause = "An error occurred during remediation"
      }
    }
  })
}

resource "aws_cloudwatch_event_rule" "prowler_findings" {
  name        = "prowler-findings-trigger"
  description = "Trigger remediation pipeline when Prowler uploads findings"

  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = { name = ["prowler-findings-951510214540"] }
      object = { key = [{ suffix = ".json" }] }
    }
  })
}

resource "aws_cloudwatch_event_target" "sfn_target" {
  rule     = aws_cloudwatch_event_rule.prowler_findings.name
  arn      = aws_sfn_state_machine.remediation.arn
  role_arn = aws_iam_role.eventbridge_role.arn
}

# ─────────────────────────────────────────
# SSM Permission for Lambda
# ─────────────────────────────────────────
resource "aws_iam_role_policy" "lambda_ssm_policy" {
  name = "remediation-lambda-ssm-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter"]
      Resource = "arn:aws:ssm:ap-southeast-1:951510214540:parameter/cloud-security-pipeline/*"
    }]
  })
}

# ─────────────────────────────────────────
# Lambda — Slack notification
# ─────────────────────────────────────────
data "archive_file" "notify_slack" {
  type        = "zip"
  source_file = "${path.module}/../../lambda/remediation/notify_slack.py"
  output_path = "${path.module}/../../lambda/remediation/notify_slack.zip"
}

resource "aws_lambda_function" "notify_slack" {
  filename         = data.archive_file.notify_slack.output_path
  function_name    = "notify-slack"
  role             = aws_iam_role.lambda_role.arn
  handler          = "notify_slack.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.notify_slack.output_base64sha256
  timeout          = 30
}

# ─────────────────────────────────────────
# Lambda — Slack callback
# ─────────────────────────────────────────
data "archive_file" "slack_callback" {
  type        = "zip"
  source_file = "${path.module}/../../lambda/remediation/slack_callback.py"
  output_path = "${path.module}/../../lambda/remediation/slack_callback.zip"
}

resource "aws_lambda_function" "slack_callback" {
  filename         = data.archive_file.slack_callback.output_path
  function_name    = "slack-callback"
  role             = aws_iam_role.lambda_role.arn
  handler          = "slack_callback.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.slack_callback.output_base64sha256
  timeout          = 30
}

# ─────────────────────────────────────────
# API Gateway — Slack webhook endpoint
# ─────────────────────────────────────────
resource "aws_apigatewayv2_api" "slack_api" {
  name          = "slack-callback-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "slack_integration" {
  api_id             = aws_apigatewayv2_api.slack_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.slack_callback.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "slack_route" {
  api_id    = aws_apigatewayv2_api.slack_api.id
  route_key = "POST /slack/callback"
  target    = "integrations/${aws_apigatewayv2_integration.slack_integration.id}"
}

resource "aws_apigatewayv2_stage" "slack_stage" {
  api_id      = aws_apigatewayv2_api.slack_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "slack_api_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_callback.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.slack_api.execution_arn}/*/*"
}
